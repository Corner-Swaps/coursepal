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

    @State private var isShowingScanner: Bool = false
    @State private var isShowingFilePicker: Bool = false
    @State private var rawSyllabusText: String = ""
    @State private var isParsing: Bool = false
    @State private var parsedCourseDTO: CourseDTO? = nil
    @State private var isShowingReviewSheet: Bool = false
    @State private var errorMessage: String? = nil

    public init() {}

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
                    Text("Extracting Syllabus with Vision AI...")
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
                allowsMultipleSelection: false
            ) { result in
                if case .success(let urls) = result, let singleURL = urls.first {
                    handlePDFUploads([singleURL])
                }
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

    private func handlePDFUploads(_ urls: [URL]) {
        guard let firstURL = urls.first else {
            errorMessage = "Could not read PDF document."
            return
        }

        isParsing = true
        errorMessage = nil
        parsedCourseDTO = nil

        let accessed = firstURL.startAccessingSecurityScopedResource()
        let pdfData = try? Data(contentsOf: firstURL)
        let extractedText = DocumentExtractor.extractText(from: firstURL) ?? ""
        if accessed { firstURL.stopAccessingSecurityScopedResource() }

        Task {
            if let pData = pdfData, !pData.isEmpty {
                if let dto = try? await APIService.shared.parsePDFDocumentData(pData) {
                    parsedCourseDTO = dto
                    isParsing = false
                    return
                }
            }
            if !extractedText.isEmpty {
                let dto = LocalSyllabusParser.shared.parseText(extractedText)
                parsedCourseDTO = dto
            } else {
                errorMessage = "Could not parse PDF content."
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
                    parsedCourseDTO = dto
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
        CourseImporter.importDTO(dto, into: modelContext)

        let createdCourse = courses.first(where: { $0.courseCode == dto.courseCode || $0.courseName == dto.courseName }) ?? courses.first
        let rawData = rawSyllabusText.data(using: .utf8)
        let docTitle = "\(dto.courseCode ?? "Course")_Syllabus"
        let syllabusDoc = SyllabusDocument(
            docTitle: "\(dto.courseCode ?? "CRS"): \(dto.courseName) Syllabus",
            officeHoursText: "Refer to original syllabus document",
            instructorContact: "Instructor details in original syllabus document",
            gradingPolicyText: "Grading policy per original syllabus document",
            fileName: "\(docTitle).txt",
            rawFileData: rawData,
            uploadedAt: Date()
        )
        syllabusDoc.course = createdCourse
        modelContext.insert(syllabusDoc)

        try? modelContext.save()

        parsedCourseDTO = nil
        rawSyllabusText = ""
        dismiss()
    }
}
