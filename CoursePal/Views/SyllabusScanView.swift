import SwiftUI
import SwiftData
import PDFKit
import UniformTypeIdentifiers
#if canImport(UIKit)
import UIKit
#endif

public struct SyllabusScanView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    public var targetCourse: Course? = nil

    @State private var isShowingScanner: Bool = false
    @State private var isShowingFilePicker: Bool = false
    @State private var rawSyllabusText: String = ""
    @State private var isParsing: Bool = false
    @State private var parsedCourseDTO: CourseDTO? = nil
    @State private var isShowingReviewSheet: Bool = false
    @State private var errorMessage: String? = nil

    public init(targetCourse: Course? = nil) {
        self.targetCourse = targetCourse
    }

    public var body: some View {
        #if os(iOS)
        ZStack {
            Color.black.ignoresSafeArea()

            if let dto = parsedCourseDTO {
                ReviewScheduleView(
                    courseDTO: dto,
                    onConfirmSave: { updatedDTO in
                        importCourseToSwiftData(updatedDTO)
                    }
                )
            } else if isParsing {
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.4)
                        .tint(.white)
                    Text("Analyzing syllabus...")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.black.opacity(0.85))
                .ignoresSafeArea()
            } else {
                DocumentScannerView(
                    onScanCompleted: { result in
                        handleScannedImages(result)
                    },
                    onCancel: {
                        dismiss()
                    }
                )
                .ignoresSafeArea()
            }
        }
        #else
        NavigationStack {
            VStack(spacing: 20) {
                Text("Smart Syllabus Extractor")
                    .font(.title2.bold())
                Button("Upload Syllabus File") {
                    isShowingFilePicker = true
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .fileImporter(
                isPresented: $isShowingFilePicker,
                allowedContentTypes: DocumentExtractor.supportedContentTypes,
                allowsMultipleSelection: true
            ) { result in
                handleFileImportResult(result)
            }
        }
        #endif
    }

    // MARK: - Actions & Parser Methods

    private func parseTextAction() {
        let text = rawSyllabusText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }

        isParsing = true
        errorMessage = nil
        parsedCourseDTO = nil

        Task {
            do {
                let dto = try await APIService.shared.parseSyllabusText(text)
                parsedCourseDTO = dto
                isParsing = false
            } catch {
                let fallbackDTO = LocalSyllabusParser.shared.parseText(text)
                parsedCourseDTO = fallbackDTO
                isParsing = false
            }
        }
    }

    private func handleFileImportResult(_ result: Result<[URL], Error>) {
        guard case .success(let urls) = result, let firstURL = urls.first else {
            errorMessage = "Could not read document."
            return
        }

        isParsing = true
        errorMessage = nil
        parsedCourseDTO = nil

        let accessed = firstURL.startAccessingSecurityScopedResource()
        let pdfData = try? Data(contentsOf: firstURL)
        let extractedText = DocumentExtractor.extractText(from: firstURL) ?? ""
        if accessed { firstURL.stopAccessingSecurityScopedResource() }

        Task { @MainActor in
            let trimmedText = extractedText.trimmingCharacters(in: .whitespacesAndNewlines)

            // 1. PRIMARY ROUTE A: High-Fidelity Gemini AI Text Parser (Fast, 100% of all pages, no page limits)
            if trimmedText.count >= 100, NetworkMonitor.shared.isOnline {
                rawSyllabusText = trimmedText
                do {
                    let dto = try await APIService.shared.parseSyllabusText(trimmedText)
                    let itemsCount = (dto.items?.count ?? 0) + (dto.assignments?.count ?? 0) + (dto.weeks?.flatMap { $0.readings ?? [] }.count ?? 0)
                    if itemsCount > 0 {
                        parsedCourseDTO = dto
                        isParsing = false
                        return
                    }
                } catch {
                    print("⚠️ [SyllabusScanView] Gemini text parse error: \(error.localizedDescription). Proceeding to vision/local fallback...")
                }
            }

            // 2. PRIMARY ROUTE B: Multimodal Gemini Vision Route (For Pure Scans / Photos without Text Layer)
            if let pData = pdfData, !pData.isEmpty, NetworkMonitor.shared.isOnline {
                do {
                    let dto = try await APIService.shared.parsePDFDocumentData(pData)
                    let itemsCount = (dto.items?.count ?? 0) + (dto.assignments?.count ?? 0) + (dto.weeks?.flatMap { $0.readings ?? [] }.count ?? 0)
                    if itemsCount > 0 {
                        parsedCourseDTO = dto
                        if !trimmedText.isEmpty {
                            rawSyllabusText = trimmedText
                        }
                        isParsing = false
                        return
                    }
                } catch {
                    print("⚠️ [SyllabusScanView] Gemini vision parse error: \(error.localizedDescription). Proceeding to local offline fallback...")
                }
            }

            // 3. OFFLINE / EMERGENCY FALLBACK: Native On-Device Parser
            if !trimmedText.isEmpty {
                rawSyllabusText = trimmedText
                let dto = LocalSyllabusParser.shared.parseText(trimmedText)
                parsedCourseDTO = dto
            } else {
                errorMessage = "Could not parse document content. Please try pasting the text manually."
            }
            isParsing = false
        }
    }

    private func handleScannedImages(_ payload: Any) {
        #if os(iOS)
        guard let images = payload as? [UIImage], !images.isEmpty else { return }

        isParsing = true
        errorMessage = nil
        parsedCourseDTO = nil

        Task { @MainActor in
            var allPageTexts: [String] = []
            for image in images {
                let pageText = (try? await LocalSyllabusParser.shared.extractTextFromImage(image)) ?? ""
                if !pageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    allPageTexts.append(pageText)
                }
            }
            let combinedText = allPageTexts.joined(separator: "\n")

            if !combinedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                rawSyllabusText = combinedText
                if let dto = try? await APIService.shared.parseSyllabusText(combinedText) {
                    let itemsCount = (dto.items?.count ?? 0) + (dto.assignments?.count ?? 0) + (dto.weeks?.flatMap { $0.readings ?? [] }.count ?? 0)
                    if itemsCount > 0 {
                        parsedCourseDTO = dto
                    } else {
                        parsedCourseDTO = LocalSyllabusParser.shared.parseText(combinedText)
                    }
                } else {
                    parsedCourseDTO = LocalSyllabusParser.shared.parseText(combinedText)
                }
            } else if let firstImage = images.first, let jpegData = firstImage.jpegData(compressionQuality: 0.8) {
                parsedCourseDTO = try? await APIService.shared.parseSyllabusImageData(jpegData)
            }

            if parsedCourseDTO == nil {
                errorMessage = "Image parsing failed. Please try pasting the text manually."
            }
            isParsing = false
        }
        #endif
    }

    @Query(sort: \Course.createdAt, order: .reverse) private var courses: [Course]

    private func importCourseToSwiftData(_ dto: CourseDTO) {
        let importedCourse: Course
        if let target = targetCourse {
            importedCourse = CourseImporter.importDTO(dto, into: target, modelContext: modelContext)
        } else {
            importedCourse = CourseImporter.importDTO(dto, into: modelContext)
        }

        let rawData = rawSyllabusText.data(using: .utf8)
        let docTitle = "\(dto.courseCode ?? "Course")_Syllabus"
        let syllabusDoc = SyllabusDocument(
            docTitle: "\(dto.courseCode ?? "CRS"): \(dto.courseName) Syllabus",
            officeHoursText: dto.officeHours,
            instructorContact: dto.instructorName != nil ? [dto.instructorName, dto.instructorEmail].compactMap { $0 }.joined(separator: " • ") : nil,
            gradingPolicyText: nil,
            fileName: "\(docTitle).txt",
            rawFileData: rawData,
            uploadedAt: Date()
        )
        syllabusDoc.course = importedCourse
        modelContext.insert(syllabusDoc)

        try? modelContext.save()

        parsedCourseDTO = nil
        rawSyllabusText = ""
        dismiss()
    }
}
