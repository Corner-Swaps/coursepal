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
                allowedContentTypes: [.pdf, .plainText, .item],
                allowsMultipleSelection: true
            ) { result in
                if case .success(let urls) = result, !urls.isEmpty {
                    handlePDFUploads(urls)
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
                isParsing = false
                errorMessage = "Parsing failed. Please check text formatting."
            }
        }
    }

    private func handlePDFUploads(_ urls: [URL]) {
        var extractedDocs: [String] = []

        for url in urls {
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }

            var extractedText = ""
            if let textContent = try? String(contentsOf: url, encoding: .utf8), !textContent.isEmpty {
                extractedText = textContent
            } else if let pdfDoc = PDFDocument(url: url) {
                var pages: [String] = []
                for i in 0..<pdfDoc.pageCount {
                    if let page = pdfDoc.page(at: i), let pageText = page.string, !pageText.isEmpty {
                        pages.append(pageText)
                    }
                }
                extractedText = pages.joined(separator: "\n")
            }
            if !extractedText.isEmpty {
                extractedDocs.append(extractedText)
            }
        }

        guard !extractedDocs.isEmpty else {
            errorMessage = "Could not extract text from selected PDF(s). Try scanning with camera instead."
            return
        }

        let combinedText = extractedDocs.joined(separator: "\n\n=== NEXT DOCUMENT ===\n\n")
        rawSyllabusText = combinedText

        isParsing = true
        errorMessage = nil
        parsedCourseDTO = nil

        Task {
            do {
                let dto = try await APIService.shared.parseSyllabusText(combinedText)
                parsedCourseDTO = dto
                isParsing = false
            } catch {
                isParsing = false
                errorMessage = "PDF parsed but schedule extraction failed. You can edit the text and try again."
            }
        }
    }

    private func handleScannedImages(_ payload: Any) {
        #if os(iOS)
        guard let images = payload as? [UIImage], !images.isEmpty else { return }

        isParsing = true
        errorMessage = nil
        parsedCourseDTO = nil

        Task { @MainActor in
            do {
                var allPageTexts: [String] = []
                for image in images {
                    let pageText = try await LocalSyllabusParser.shared.extractTextFromImage(image)
                    if !pageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        allPageTexts.append(pageText)
                    }
                }
                let combinedText = allPageTexts.joined(separator: "\n")

                if combinedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    if let firstImage = images.first,
                       let jpegData = firstImage.jpegData(compressionQuality: 0.8) {
                        let dto = try await APIService.shared.parseSyllabusImageData(jpegData)
                        parsedCourseDTO = dto
                    }
                } else {
                    rawSyllabusText = combinedText
                    let dto = try await APIService.shared.parseSyllabusText(combinedText)
                    parsedCourseDTO = dto
                }
                isParsing = false
            } catch {
                isParsing = false
                errorMessage = "Image parsing failed. Please try again or paste the text manually."
            }
        }
        #endif
    }

    @Query(sort: \Course.createdAt, order: .reverse) private var courses: [Course]

    private func importCourseToSwiftData(_ dto: CourseDTO) {
        CourseImporter.importDTO(dto, into: modelContext)

        let createdCourse = courses.first(where: { $0.courseCode == dto.courseCode || $0.courseName == dto.courseName }) ?? courses.first
        let rawData = rawSyllabusText.data(using: .utf8)
        let docTitle = "\(dto.courseCode ?? "Course")_Syllabus"

        let vaultDoc = VaultDocument(
            title: docTitle,
            category: "Syllabi",
            fileSize: "1.2 MB",
            fileType: "TXT",
            courseCode: createdCourse?.courseCode ?? dto.courseCode,
            fileContent: rawSyllabusText,
            rawFileData: rawData
        )
        modelContext.insert(vaultDoc)

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
