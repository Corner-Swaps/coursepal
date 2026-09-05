import SwiftUI
import SwiftData
import UniformTypeIdentifiers
import PDFKit
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
        if url.path.hasPrefix(stagedDirectory.path) {
            return url
        }
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

    public static func stageBundledSyllabiIfNeeded() {
        let subdirs: [String?] = [nil, "Syllabi", "Resources/Syllabi"]
        for sub in subdirs {
            if let urls = Bundle.main.urls(forResourcesWithExtension: "pdf", subdirectory: sub) {
                for bundleURL in urls {
                    let dest = stagedDirectory.appendingPathComponent(bundleURL.lastPathComponent)
                    if !FileManager.default.fileExists(atPath: dest.path) {
                        try? FileManager.default.copyItem(at: bundleURL, to: dest)
                    }
                }
            }
        }
    }
}

@MainActor
@Observable
public final class SyllabusUploadManager {
    public static let shared = SyllabusUploadManager()

    public var isUploading: Bool = false
    public var uploadingCourseIds: Set<UUID> = []
    public var courseUploadStatuses: [UUID: String] = [:]

    public func status(for courseId: UUID) -> String? {
        courseUploadStatuses[courseId]
    }

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

    private var pendingJobQueue: [UploadJob] = []
    private var currentRunningTask: Task<Void, Never>? = nil
    private var currentJob: UploadJob? = nil

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

    private func endBackgroundTaskIfNeeded() {
        #if os(iOS)
        if pendingJobQueue.isEmpty && currentRunningTask == nil && uploadingCourseIds.isEmpty && bgTaskID != .invalid {
            UIApplication.shared.endBackgroundTask(bgTaskID)
            bgTaskID = .invalid
        }
        #endif
    }

    private init() {}

    public func cancelUpload(forCourseId courseId: UUID) {
        print("🛑 [SyllabusUploadManager] User requested cancelUpload for course: \(courseId)")
        uploadingCourseIds.remove(courseId)
        courseUploadStatuses.removeValue(forKey: courseId)
        pendingJobQueue.removeAll(where: { $0.targetCourse?.id == courseId })

        if currentJob?.targetCourse?.id == courseId || currentJob?.targetCourse == nil {
            currentRunningTask?.cancel()
            currentRunningTask = nil
            currentJob = nil
        }

        if uploadingCourseIds.isEmpty && pendingJobQueue.isEmpty && currentRunningTask == nil {
            isUploading = false
            progressRatio = 0.0
            statusText = ""
            endBackgroundTaskIfNeeded()
        }
    }

    public func cancelAllUploads() {
        print("🛑 [SyllabusUploadManager] User requested cancelAllUploads()")
        pendingJobQueue.removeAll()
        currentRunningTask?.cancel()
        currentRunningTask = nil
        currentJob = nil
        uploadingCourseIds.removeAll()
        courseUploadStatuses.removeAll()
        isUploading = false
        progressRatio = 0.0
        statusText = ""
        endBackgroundTaskIfNeeded()
    }

    public func startUpload(urls: [URL], targetCourse: Course? = nil, modelContext: ModelContext, completion: (() -> Void)? = nil) {
        guard !urls.isEmpty else { return }
        ensureBackgroundTask()

        if let existingTarget = targetCourse {
            // Adding one or multiple documents to an existing course
            var stagedFileURLs: [URL] = []
            for url in urls {
                stagedFileURLs.append(PersistentFileStager.stage(url: url))
            }

            let job = UploadJob(urls: stagedFileURLs, targetCourse: existingTarget, completion: completion)
            uploadingCourseIds.insert(existingTarget.id)
            if currentRunningTask != nil {
                courseUploadStatuses[existingTarget.id] = "Queued — waiting to process..."
            } else {
                courseUploadStatuses[existingTarget.id] = "Analyzing syllabus..."
            }
            pendingJobQueue.append(job)
            isUploading = true
            processQueue(modelContext: modelContext)
        } else {
            // Adding one or multiple new course syllabi sequentially
            for url in urls {
                let stagedURL = PersistentFileStager.stage(url: url)
                let rawFileName = stagedURL.lastPathComponent.replacingOccurrences(of: #"^[0-9A-FA-F\-]{36}_"#, with: "", options: .regularExpression)
                let fileName = rawFileName.replacingOccurrences(of: #"\.[^.]+$"#, with: "", options: .regularExpression)
                let cleanTitle = fileName.isEmpty ? "New Course" : fileName.replacingOccurrences(of: "_", with: " ").capitalized

                let allCourses = (try? modelContext.fetch(FetchDescriptor<Course>())) ?? []
                let distinctPalette = [
                    "#2563EB", "#16A34A", "#9333EA", "#EA580C", "#0D9488",
                    "#DB2777", "#4F46E5", "#D97706", "#0284C7", "#7C3AED"
                ]
                let usedColors = Set(allCourses.map { $0.hexColor.uppercased() })
                let nextColor = distinctPalette.first(where: { !usedColors.contains($0.uppercased()) }) ?? distinctPalette[allCourses.count % distinctPalette.count]

                let placeholder = Course(courseName: cleanTitle, courseCode: "", hexColor: nextColor)
                modelContext.insert(placeholder)
                try? modelContext.save()

                let job = UploadJob(urls: [stagedURL], targetCourse: placeholder, completion: completion)
                uploadingCourseIds.insert(placeholder.id)
                if currentRunningTask != nil {
                    courseUploadStatuses[placeholder.id] = "Queued — waiting to process..."
                } else {
                    courseUploadStatuses[placeholder.id] = "Analyzing syllabus..."
                }
                pendingJobQueue.append(job)
                isUploading = true
            }
            processQueue(modelContext: modelContext)
        }
    }

    private func processQueue(modelContext: ModelContext) {
        guard currentRunningTask == nil else { return }

        guard !pendingJobQueue.isEmpty else {
            if uploadingCourseIds.isEmpty {
                isUploading = false
                progressRatio = 0.0
                endBackgroundTaskIfNeeded()
            }
            return
        }

        let nextJob = pendingJobQueue.removeFirst()
        currentJob = nextJob
        if let cid = nextJob.targetCourse?.id {
            courseUploadStatuses[cid] = "Analyzing syllabus..."
        }
        isUploading = true

        currentRunningTask = Task { @MainActor in
            await self.executeJob(nextJob, modelContext: modelContext)
            self.currentRunningTask = nil
            self.currentJob = nil
            self.processQueue(modelContext: modelContext)
        }
    }

    private func executeJob(_ job: UploadJob, modelContext: ModelContext) async {
        let stagedFileURLs = job.urls
        let targetCourse = job.targetCourse
        let completion = job.completion

        defer {
            if let cid = targetCourse?.id {
                self.uploadingCourseIds.remove(cid)
                self.courseUploadStatuses.removeValue(forKey: cid)
            }
            if self.uploadingCourseIds.isEmpty && self.pendingJobQueue.isEmpty {
                self.isUploading = false
                self.progressRatio = 0.0
                self.endBackgroundTaskIfNeeded()
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
            let courseTitle = targetCourse?.courseName ?? cleanFileName
            self.currentFileName = cleanFileName
            self.statusText = "Processing '\(courseTitle)'..."
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

            let extractedText: String? = DocumentExtractor.extractTargetedSyllabusText(from: url) ?? DocumentExtractor.extractText(from: url)

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
                print("ℹ️ [DUPLICATE GUARD] Document '\(cleanFileName)' is already in the database. Checking cache for instant import...")
            }

            var parsedDTO: CourseDTO? = nil

            // ── CHECK 0: Fast Pre-Parsed Syllabus Cache (Instant O(1) Local Resolution) ──
            if let cached = ParsedSyllabusCache.shared.get(forData: fileData, text: extractedText, fileName: cleanFileName) {
                print("⚡️ [CACHE HIT] Found pre-parsed CourseDTO for '\(cleanFileName)'. Bypassing Gemini API roundtrip!")
                parsedDTO = cached
            } else if let matchingCourse = dbCourses.first(where: { c in
                c.syllabusDocs.contains {
                    let dNorm = $0.docTitle.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                    let fNorm = ($0.fileName ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                    return dNorm == normUrlName || fNorm == normUrlName
                }
            }), !matchingCourse.weeks.isEmpty || !matchingCourse.assignments.isEmpty {
                print("⚡️ [DATABASE HIT] Found existing Course with syllabus items for '\(cleanFileName)'. Reconstructing DTO instantly!")
                let reconstructed = matchingCourse.toCourseDTO()
                ParsedSyllabusCache.shared.save(dto: reconstructed, forData: fileData, text: extractedText, fileName: cleanFileName)
                parsedDTO = reconstructed
            }

            if Task.isCancelled { return }

            if let cid = targetCourse?.id {
                self.courseUploadStatuses[cid] = parsedDTO != nil ? "Attaching pre-parsed syllabus..." : "Analyzing syllabus..."
            }

            // 1. PRIMARY ROUTE A: Ultra-Fast Token-Efficient Text Route (Uses ~600 tokens total via Gemini 3.5 Flash-Lite)
            if parsedDTO == nil, !Task.isCancelled, NetworkMonitor.shared.isOnline, let text = extractedText, text.trimmingCharacters(in: .whitespacesAndNewlines).count >= 100 {
                self.statusText = "Analyzing syllabus..."
                if let cid = targetCourse?.id {
                    self.courseUploadStatuses[cid] = "Analyzing syllabus..."
                }
                print("⚡️ [UPLOAD] Running PRIMARY Text Reader (gemini-3.5-flash-lite) for: \(cleanFileName) (\(text.count) chars)")
                do {
                    let textDTO = try await APIService.shared.parseSyllabusText(text)
                    let itemsCount = (textDTO.items?.count ?? 0) + (textDTO.assignments?.count ?? 0) + (textDTO.weeks?.flatMap { $0.readings ?? [] }.count ?? 0)
                    if itemsCount > 0 {
                        parsedDTO = textDTO
                        ParsedSyllabusCache.shared.save(dto: textDTO, forData: fileData, text: extractedText, fileName: cleanFileName)
                        print("✅ [UPLOAD] Gemini 3.5 Flash-Lite Text Parse SUCCESS — total items: \(itemsCount)")
                    }
                } catch is CancellationError {
                    print("🛑 [UPLOAD] Text parse cancelled by user.")
                    return
                } catch {
                    if Task.isCancelled { return }
                    print("⚠️ [UPLOAD] Gemini text parse error: \(error.localizedDescription). Proceeding to vision/local fallback...")
                }
            }

            if Task.isCancelled { return }

            // 2. PRIMARY ROUTE B: Multimodal Vision Route (For Pure Scanned Image PDFs / Photos without Text Layer)
            let hasTextSuccess = ((parsedDTO?.items?.count ?? 0) + (parsedDTO?.assignments?.count ?? 0) + (parsedDTO?.weeks?.flatMap { $0.readings ?? [] }.count ?? 0)) > 0
            if parsedDTO == nil, !hasTextSuccess, !Task.isCancelled, NetworkMonitor.shared.isOnline, ext == "PDF", let pData = fileData, !pData.isEmpty {
                self.statusText = "Scanning schedule pages..."
                if let cid = targetCourse?.id {
                    self.courseUploadStatuses[cid] = "Scanning schedule pages..."
                }
                print("🤖 [UPLOAD] Running PRIMARY AI Vision Reader for scanned PDF: \(cleanFileName)")
                do {
                    let pdfDTO = try await APIService.shared.parsePDFDocumentData(pData)
                    let pdfItemsCount = (pdfDTO.items?.count ?? 0) + (pdfDTO.assignments?.count ?? 0) + (pdfDTO.weeks?.flatMap { $0.readings ?? [] }.count ?? 0)
                    if pdfItemsCount > 0 {
                        parsedDTO = pdfDTO
                        ParsedSyllabusCache.shared.save(dto: pdfDTO, forData: fileData, text: extractedText, fileName: cleanFileName)
                        print("✅ [UPLOAD] Gemini Vision Parse SUCCESS — total items: \(pdfItemsCount)")
                    }
                } catch is CancellationError {
                    print("🛑 [UPLOAD] PDF vision parse cancelled by user.")
                    return
                } catch {
                    if Task.isCancelled { return }
                    print("⚠️ [UPLOAD] Gemini Vision parse error: \(error.localizedDescription). Proceeding to local offline fallback...")
                }
            }

            if Task.isCancelled { return }

            // 3. OFFLINE / NETWORK ERROR FALLBACK: Native On-Device iPhone Reader (0 API Tokens, 100% Offline)
            let hasAISuccess = ((parsedDTO?.items?.count ?? 0) + (parsedDTO?.assignments?.count ?? 0) + (parsedDTO?.weeks?.flatMap { $0.readings ?? [] }.count ?? 0)) > 0
            if !hasAISuccess, !Task.isCancelled {
                self.statusText = "Extracting syllabus locally..."
                if let cid = targetCourse?.id {
                    self.courseUploadStatuses[cid] = "Extracting syllabus locally..."
                }
                print("📱 [UPLOAD] Running OFFLINE Fallback Native On-Device Reader for: \(cleanFileName)")
                var textToParse: String = extractedText ?? ""
                if textToParse.isEmpty, let pData = fileData, !pData.isEmpty {
                    textToParse = DocumentExtractor.extractText(from: url) ?? ""
                }
                if !textToParse.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    let localDTO = LocalSyllabusParser.shared.parseText(textToParse)
                    let localAssignCount = (localDTO.assignments?.count ?? 0) + (localDTO.items?.filter { $0.category == "Assignment" }.count ?? 0)
                    let localReadCount = (localDTO.weeks?.reduce(0) { $0 + ($1.readings?.count ?? 0) } ?? 0) + (localDTO.items?.filter { $0.category == "Reading" }.count ?? 0)
                    print("📊 [LOCAL PARSER RESULTS] Assignments: \(localAssignCount), Readings: \(localReadCount)")
                    parsedDTO = localDTO
                    ParsedSyllabusCache.shared.save(dto: localDTO, forData: fileData, text: extractedText, fileName: cleanFileName)
                }
            }

            if Task.isCancelled { return }

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

            if let cid = targetCourse?.id {
                self.courseUploadStatuses[cid] = "Building weekly schedule..."
            }

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

                // Guarantee faculty name & email extraction if missing from DTO
                if (importedCourse.instructorName ?? "").isEmpty || (importedCourse.instructorEmail ?? "").isEmpty {
                    var textToScan = extractedText ?? ""
                    if textToScan.isEmpty, let data = fileData, let pdf = PDFDocument(data: data) {
                        textToScan = (0..<min(3, pdf.pageCount)).compactMap { pdf.page(at: $0)?.string }.joined(separator: "\n")
                    }
                    if !textToScan.isEmpty {
                        let (fallbackName, fallbackEmail) = FacultyExtractor.extractFaculty(from: textToScan)
                        if (importedCourse.instructorName ?? "").isEmpty, let name = fallbackName {
                            importedCourse.instructorName = name
                        }
                        if (importedCourse.instructorEmail ?? "").isEmpty, let email = fallbackEmail {
                            importedCourse.instructorEmail = email
                        }
                    }
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

                if let data = fileData, !data.isEmpty {
                    let sylDoc = SyllabusDocument(
                        docTitle: documentTitle,
                        fileName: cleanFileName,
                        rawFileData: data,
                        uploadedAt: Date(),
                        courseCode: cCode
                    )
                    sylDoc.course = importedCourse
                    importedCourse.syllabusDocs.append(sylDoc)
                    modelContext.insert(sylDoc)
                }

                try modelContext.save()
                completedCount += 1
                let finalName = targetCourse?.courseName ?? dto.courseName
                self.lastImportedCourseName = finalName
                let itemCount = (dto.items?.count ?? 0) + (dto.assignments?.count ?? 0) + (dto.weeks?.reduce(0) { $0 + ($1.readings?.count ?? 0) } ?? 0)
                if itemCount > 0 {
                    self.successMessage = "Success! Extracted '\(finalName)' with \(itemCount) items!"
                } else {
                    self.successMessage = "Saved '\(finalName)' to Vault. Note: No structured schedule or reading items were detected in this document."
                }
                if self.pendingJobQueue.isEmpty {
                    self.showingSuccessAlert = true
                }
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
