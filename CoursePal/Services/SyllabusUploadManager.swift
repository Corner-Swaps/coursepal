import SwiftUI
import SwiftData
import UniformTypeIdentifiers
#if canImport(UIKit)
import UIKit
#endif

public struct UploadJob: Identifiable {
    public let id = UUID()
    public let urls: [URL]
    public let targetCourse: Course?
    public let completion: (() -> Void)?
}

public struct PersistentFileStager {
    public static var stagedDirectory: URL {
        let docsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let stagedDir = docsDir.appendingPathComponent("StagedUploads", isDirectory: true)
        try? FileManager.default.createDirectory(at: stagedDir, withIntermediateDirectories: true)
        return stagedDir
    }

    public static func stage(url: URL) -> URL {
        let securityScoped = url.startAccessingSecurityScopedResource()
        defer { if securityScoped { url.stopAccessingSecurityScopedResource() } }

        let targetURL = stagedDirectory.appendingPathComponent(UUID().uuidString + "_" + url.lastPathComponent)
        if let data = (try? Data(contentsOf: url)), !data.isEmpty {
            try? data.write(to: targetURL)
            return targetURL
        } else if (try? FileManager.default.copyItem(at: url, to: targetURL)) != nil {
            return targetURL
        }
        return url
    }

    public static func stage(data: Data, filename: String) -> URL {
        let targetURL = stagedDirectory.appendingPathComponent(UUID().uuidString + "_" + filename)
        try? data.write(to: targetURL)
        return targetURL
    }
}

@MainActor
@Observable
public final class SyllabusUploadManager {
    public static let shared = SyllabusUploadManager()

    public var isUploading: Bool = false
    public var uploadingCourseIds: Set<UUID> = []
    public var targetCourseId: UUID? {
        uploadingCourseIds.first
    }
    public var progressRatio: Double = 0.0
    public var statusText: String = ""
    public var currentFileName: String = ""
    public var lastImportedCourseName: String? = nil
    public var errorMessage: String? = nil
    public var showingErrorAlert: Bool = false
    public var successMessage: String? = nil
    public var showingSuccessAlert: Bool = false

    private var uploadQueue: [UploadJob] = []
    private var currentJob: UploadJob? = nil
    private var isQueueProcessing: Bool = false
    private var activeQueueTask: Task<Void, Never>? = nil
    private var activeJobTask: Task<Void, Never>? = nil

    #if os(iOS)
    private var bgTaskID: UIBackgroundTaskIdentifier = .invalid
    #endif

    public func ensureBackgroundTask() {
        #if os(iOS)
        if bgTaskID == .invalid {
            bgTaskID = UIApplication.shared.beginBackgroundTask(withName: "CoursePalSyllabusProcessing") { [weak self] in
                Task { @MainActor in
                    guard let self = self else { return }
                    if self.bgTaskID != .invalid {
                        UIApplication.shared.endBackgroundTask(self.bgTaskID)
                        self.bgTaskID = .invalid
                    }
                }
            }
        }
        #endif
    }

    private init() {}

    public func cancelUpload(forCourseId courseId: UUID) {
        uploadQueue.removeAll { $0.targetCourse?.id == courseId }
        uploadingCourseIds.remove(courseId)

        if currentJob?.targetCourse?.id == courseId {
            activeJobTask?.cancel()
            currentJob = nil
            statusText = "Upload cancelled for course."
        }

        if uploadQueue.isEmpty && currentJob == nil {
            isUploading = false
            isQueueProcessing = false
            progressRatio = 0.0
            uploadingCourseIds.removeAll()
            #if os(iOS)
            if bgTaskID != .invalid {
                UIApplication.shared.endBackgroundTask(bgTaskID)
                bgTaskID = .invalid
            }
            #endif
        }
    }

    public func cancelAllUploads() {
        uploadQueue.removeAll()
        uploadingCourseIds.removeAll()
        activeJobTask?.cancel()
        activeQueueTask?.cancel()
        currentJob = nil
        isUploading = false
        progressRatio = 0.0
        statusText = "Upload cancelled."
        #if os(iOS)
        if bgTaskID != .invalid {
            UIApplication.shared.endBackgroundTask(bgTaskID)
            bgTaskID = .invalid
        }
        #endif
    }

    public func startUpload(urls: [URL], targetCourse: Course? = nil, modelContext: ModelContext, completion: (() -> Void)? = nil) {
        guard !urls.isEmpty else { return }
        ensureBackgroundTask()

        var stagedFileURLs: [URL] = []
        for url in urls {
            stagedFileURLs.append(PersistentFileStager.stage(url: url))
        }

        var courseForJob = targetCourse
        if courseForJob == nil, let firstURL = stagedFileURLs.first {
            let rawFileName = firstURL.lastPathComponent.replacingOccurrences(of: #"^[0-9A-FA-F\-]{36}_"#, with: "", options: .regularExpression)
            let fileName = rawFileName.replacingOccurrences(of: #"\.[^.]+$"#, with: "", options: .regularExpression)
            let cleanTitle = fileName.isEmpty ? "New Course" : fileName.replacingOccurrences(of: "_", with: " ").capitalized

            let allCourses = (try? modelContext.fetch(FetchDescriptor<Course>())) ?? []
            let distinctPalette = [
                "#2563EB", "#16A34A", "#9333EA", "#EA580C", "#0D9488",
                "#DB2777", "#4F46E5", "#D97706", "#0284C7", "#7C3AED"
            ]
            let usedColors = Set(allCourses.map { $0.hexColor.uppercased() })
            let nextColor = distinctPalette.first(where: { !usedColors.contains($0.uppercased()) }) ?? distinctPalette[allCourses.count % distinctPalette.count]

            let placeholder = Course(courseName: cleanTitle, courseCode: "CRS", hexColor: nextColor)
            modelContext.insert(placeholder)
            try? modelContext.save()
            courseForJob = placeholder
        }

        let job = UploadJob(urls: stagedFileURLs, targetCourse: courseForJob, completion: completion)
        uploadQueue.append(job)

        if let cid = courseForJob?.id {
            uploadingCourseIds.insert(cid)
        }

        isUploading = true
        processQueueIfNeeded(modelContext: modelContext)
    }

    private func processQueueIfNeeded(modelContext: ModelContext) {
        guard !isQueueProcessing, !uploadQueue.isEmpty else { return }
        isQueueProcessing = true
        ensureBackgroundTask()

        activeQueueTask = Task { @MainActor in
            while !self.uploadQueue.isEmpty {
                self.ensureBackgroundTask()
                let currentJob = self.uploadQueue.removeFirst()
                self.currentJob = currentJob

                let jobTask = Task { @MainActor in
                    await self.executeJob(currentJob, modelContext: modelContext)
                }
                self.activeJobTask = jobTask
                await jobTask.value
                self.activeJobTask = nil
                self.currentJob = nil
            }

            self.isQueueProcessing = false
            self.isUploading = false
            self.uploadingCourseIds.removeAll()

            #if os(iOS)
            if self.bgTaskID != .invalid {
                UIApplication.shared.endBackgroundTask(self.bgTaskID)
                self.bgTaskID = .invalid
            }
            #endif
        }
    }

    private func executeJob(_ job: UploadJob, modelContext: ModelContext) async {
        let stagedFileURLs = job.urls
        let targetCourse = job.targetCourse
        let completion = job.completion

        defer {
            self.currentJob = nil
            if let cid = targetCourse?.id {
                self.uploadingCourseIds.remove(cid)
            }
            // Cleanup temp files
            for stagedURL in stagedFileURLs {
                try? FileManager.default.removeItem(at: stagedURL)
            }
        }

        let totalFiles = stagedFileURLs.count
        var completedCount = 0

        for (index, url) in stagedFileURLs.enumerated() {
            if Task.isCancelled { break }

            let fileName = url.lastPathComponent
            let cleanFileName: String
            if let range = fileName.range(of: "_") {
                cleanFileName = String(fileName[range.upperBound...])
            } else {
                cleanFileName = fileName
            }
            self.currentFileName = cleanFileName
            self.statusText = "Extracting data from '\(cleanFileName)'..."
            self.progressRatio = 0.75 + (Double(index) / Double(totalFiles)) * 0.20

            let ext = url.pathExtension.uppercased()
            let fileData: Data? = (try? Data(contentsOf: url))

            // Security Validation (10MB Max Size & MIME Verification)
            if let data = fileData {
                do {
                    let utType = UTType(filenameExtension: url.pathExtension)
                    try DocumentSecurityValidator.validate(data: data, utType: utType)
                } catch {
                    self.errorMessage = error.localizedDescription
                    self.showingErrorAlert = true
                    continue
                }
            }

            let extractedText: String? = DocumentExtractor.extractText(from: url)

            // Duplicate Check across Database
            let fetchVault = FetchDescriptor<VaultDocument>()
            let fetchSyllabi = FetchDescriptor<SyllabusDocument>()
            let fetchCourses = FetchDescriptor<Course>()

            let dbVaultDocs = (try? modelContext.fetch(fetchVault)) ?? []
            let dbSyllabi = (try? modelContext.fetch(fetchSyllabi)) ?? []
            let dbCourses = (try? modelContext.fetch(fetchCourses)) ?? []

            let normUrlName = cleanFileName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

            let isDuplicateInVault = dbVaultDocs.contains {
                $0.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normUrlName
            }
            let isDuplicateInSyllabi = dbSyllabi.contains {
                $0.fileName?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normUrlName
            }
            let isDuplicateInCourse = dbCourses.contains { c in
                c.syllabusDocs.contains {
                    $0.fileName?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normUrlName
                }
            }

            if isDuplicateInVault || isDuplicateInSyllabi || isDuplicateInCourse {
                print("ℹ️ [DUPLICATE GUARD] Document '\(cleanFileName)' is already in the database. Updating existing records...")
            }

            var parsedDTO: CourseDTO? = nil

            // 1. Smart Text-First Route: If clean native text was extracted, parse directly (10x faster & token-efficient)
            if let text = extractedText, text.trimmingCharacters(in: .whitespacesAndNewlines).count >= 150 {
                self.statusText = "Analyzing syllabus text with Gemini AI..."
                print("⚡️ [UPLOAD] Fast text-first route for: \(cleanFileName) (\(text.count) chars)")
                do {
                    let textDTO = try await APIService.shared.parseSyllabusText(text)
                    if (textDTO.items?.count ?? 0) > 0 || (textDTO.weeks?.flatMap { $0.readings ?? [] }.count ?? 0) > 0 {
                        parsedDTO = textDTO
                        print("✅ [UPLOAD] Gemini Text Parse SUCCESS — items: \(textDTO.items?.count ?? 0)")
                    }
                } catch {
                    print("⚠️ [UPLOAD] Gemini text parse failed: \(error.localizedDescription). Falling back to multimodal parser.")
                }
            }

            // 2. Multimodal Vision Route: If text was sparse/empty or text parse yielded no items, parse via Base64 PDF
            let hasItems = (parsedDTO?.items?.count ?? 0) > 0 || (parsedDTO?.weeks?.flatMap { $0.readings ?? [] }.count ?? 0) > 0
            if !hasItems, ext == "PDF", let pData = fileData, !pData.isEmpty {
                self.statusText = "Analyzing syllabus with Gemini Multimodal AI..."
                print("🤖 [UPLOAD] Attempting Gemini Multimodal parse for PDF: \(cleanFileName)")
                do {
                    parsedDTO = try await APIService.shared.parsePDFDocumentData(pData)
                    print("✅ [UPLOAD] Gemini Multimodal PDF parse SUCCESS — items: \(parsedDTO?.items?.count ?? 0)")
                } catch {
                    print("❌ [UPLOAD] Gemini Multimodal parse failed: \(error.localizedDescription).")
                }
            }

            // 3. Fallback to LocalSyllabusParser if AI parsing failed or yielded no items
            let finalHasItems = (parsedDTO?.items?.count ?? 0) > 0 || (parsedDTO?.weeks?.flatMap { $0.readings ?? [] }.count ?? 0) > 0
            if !finalHasItems {
                self.statusText = "Processing syllabus with local parser..."
                print("📋 [UPLOAD] Using LOCAL parser fallback for: \(cleanFileName)")
                var textToParse: String = extractedText ?? ""
                if textToParse.isEmpty, let pData = fileData, !pData.isEmpty {
                    textToParse = DocumentExtractor.extractText(from: url) ?? ""
                }
                if !textToParse.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    parsedDTO = LocalSyllabusParser.shared.parseText(textToParse)
                }
            }

            // 4. Fallback guarantee: Never fail document import
            let dto: CourseDTO = {
                if let p = parsedDTO { return p }
                let cleanTitle = cleanFileName.replacingOccurrences(of: #"\.[^.]+$"#, with: "", options: .regularExpression)
                let courseCode = "CRS-\(Int.random(in: 100...999))"
                return CourseDTO(
                    id: "course-\(UUID().uuidString.prefix(8))",
                    creatorId: "local-user",
                    courseName: cleanTitle.capitalized,
                    courseCode: courseCode,
                    termWeeks: 12,
                    sharingCode: String(format: "%06d", Int.random(in: 100000...999999)),
                    weeks: [],
                    assignments: []
                )
            }()

            do {
                let importedCourse: Course
                if let target = targetCourse {
                    importedCourse = CourseImporter.importDTO(dto, into: target, modelContext: modelContext)
                } else {
                    let textToCheck = extractedText ?? ""
                    let hasSyllabusKeywords = CourseImporter.containsSyllabusMarkers(in: textToCheck)
                    let weekNumbers = Set((dto.items ?? []).compactMap { $0.weekNumber })
                    let spansMultipleWeeks = weekNumbers.count > 1
                    
                    let isSyllabus = hasSyllabusKeywords || spansMultipleWeeks
                    print("🔍 [UPLOAD] Syllabus check for \(cleanFileName): hasKeywords = \(hasSyllabusKeywords), spansMultipleWeeks = \(spansMultipleWeeks) -> isSyllabus = \(isSyllabus)")
                    importedCourse = CourseImporter.importDTO(dto, into: modelContext, forceNewCourse: !isSyllabus)
                }
                self.uploadingCourseIds.insert(importedCourse.id)

                let bytes = Double(fileData?.count ?? 0)
                let sizeMB = bytes > 0 ? String(format: "%.1f MB", bytes / (1024.0 * 1024.0)) : "1.5 MB"
                let cCode = targetCourse?.courseCode ?? dto.courseCode ?? ""
                let fileExt = url.pathExtension.isEmpty ? "pdf" : url.pathExtension
                let documentTitle = (!cCode.isEmpty && cCode != "CRS-101") ? "\(cCode) - \(dto.courseName).\(fileExt)" : cleanFileName
                let normTitle = documentTitle.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

                if let existing = dbVaultDocs.first(where: {
                    let titleNorm = $0.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                    return titleNorm == normTitle || titleNorm == normUrlName
                }) {
                    if let data = fileData { existing.rawFileData = data }
                    if let txt = extractedText { existing.fileContent = txt }
                } else {
                    let doc = VaultDocument(
                        title: documentTitle,
                        category: "Class Material",
                        fileSize: sizeMB,
                        fileType: fileExt,
                        courseCode: cCode,
                        fileContent: extractedText,
                        rawFileData: fileData
                    )
                    modelContext.insert(doc)
                }

                try modelContext.save()
                completedCount += 1
                self.lastImportedCourseName = dto.courseName
                let itemCount = (dto.items?.count ?? 0) + (dto.assignments?.count ?? 0) + (dto.weeks?.reduce(0) { $0 + ($1.readings?.count ?? 0) } ?? 0)
                self.successMessage = "Success! Extracted '\(dto.courseName)' (\(dto.courseCode ?? "Course")) with \(itemCount) items!"
                self.showingSuccessAlert = true
            } catch {
                print("❌ [BACKGROUND UPLOAD ERROR] \(error.localizedDescription)")
                self.errorMessage = error.localizedDescription
                self.showingErrorAlert = true
            }
        }

        self.progressRatio = 1.0
        if completedCount > 0 {
            self.statusText = "Syllabus processing complete! Course data saved."
        } else if self.errorMessage != nil {
            self.statusText = "Processing finished with warning."
        } else {
            self.statusText = "Upload complete."
        }

        completion?()
    }
}
