import SwiftUI
import SwiftData
import UniformTypeIdentifiers

@MainActor
@Observable
public final class SyllabusUploadManager {
    public static let shared = SyllabusUploadManager()

    public var isUploading: Bool = false
    public var progressRatio: Double = 0.0
    public var statusText: String = ""
    public var currentFileName: String = ""
    public var lastImportedCourseName: String? = nil
    public var errorMessage: String? = nil
    public var showingErrorAlert: Bool = false

    private var activeUploadTask: Task<Void, Never>? = nil

    private init() {}

    public func startUpload(urls: [URL], targetCourse: Course? = nil, modelContext: ModelContext, completion: (() -> Void)? = nil) {
        guard !urls.isEmpty else { return }

        // Cancel any existing background upload task gracefully
        activeUploadTask?.cancel()

        isUploading = true
        progressRatio = 0.75
        currentFileName = urls.first?.lastPathComponent ?? "Document"
        statusText = "Processing \(currentFileName)..."
        errorMessage = nil

        activeUploadTask = Task { @MainActor in
            let totalFiles = urls.count
            var completedCount = 0

            for (index, url) in urls.enumerated() {
                if Task.isCancelled { break }

                let fileName = url.lastPathComponent
                self.currentFileName = fileName
                self.statusText = "Extracting data from '\(fileName)'..."
                self.progressRatio = 0.75 + (Double(index) / Double(totalFiles)) * 0.20

                let securityScoped = url.startAccessingSecurityScopedResource()
                defer {
                    if securityScoped {
                        url.stopAccessingSecurityScopedResource()
                    }
                }

                let ext = url.pathExtension.uppercased()
                var fileData: Data? = nil
                var extractedText: String? = nil

                if ext == "PDF" {
                    fileData = try? Data(contentsOf: url)
                } else {
                    fileData = try? Data(contentsOf: url)
                    extractedText = DocumentExtractor.extractText(from: url)
                }

                // Duplicate Check across Database
                let fetchVault = FetchDescriptor<VaultDocument>()
                let fetchSyllabi = FetchDescriptor<SyllabusDocument>()
                let fetchCourses = FetchDescriptor<Course>()

                let dbVaultDocs = (try? modelContext.fetch(fetchVault)) ?? []
                let dbSyllabi = (try? modelContext.fetch(fetchSyllabi)) ?? []
                let dbCourses = (try? modelContext.fetch(fetchCourses)) ?? []

                let urlLastPathComponent = url.lastPathComponent
                let normUrlName = urlLastPathComponent.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

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
                    print("⚠️ [DUPLICATE BLOCKED] File '\(urlLastPathComponent)' is already uploaded.")
                    self.errorMessage = "Duplicate Document: '\(urlLastPathComponent)' has already been uploaded."
                    self.showingErrorAlert = true
                    continue
                }

                let dto: CourseDTO
                do {
                    if ext == "PDF", let pData = fileData, !pData.isEmpty {
                        self.statusText = "Analyzing syllabus with AI..."
                        dto = try await APIService.shared.parsePDFDocumentData(pData)
                    } else if let text = extractedText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        self.statusText = "Analyzing syllabus text with AI..."
                        dto = try await APIService.shared.parseSyllabusText(text)
                    } else {
                        self.errorMessage = "Unable to process document. File content is empty."
                        self.showingErrorAlert = true
                        continue
                    }

                    if let target = targetCourse {
                        CourseImporter.importDTO(dto, into: target, modelContext: modelContext)
                    } else {
                        CourseImporter.importDTO(dto, into: modelContext)
                    }

                    let bytes = Double(fileData?.count ?? 0)
                    let sizeMB = bytes > 0 ? String(format: "%.1f MB", bytes / (1024.0 * 1024.0)) : "1.5 MB"
                    let cCode = targetCourse?.courseCode ?? dto.courseCode ?? ""
                    let fileExt = url.pathExtension.isEmpty ? "pdf" : url.pathExtension
                    let documentTitle = (!cCode.isEmpty && cCode != "CRS-101") ? "\(cCode) - \(dto.courseName).\(fileExt)" : urlLastPathComponent
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

            try? await Task.sleep(nanoseconds: 3_000_000_000)
            self.isUploading = false
        }
    }
}
