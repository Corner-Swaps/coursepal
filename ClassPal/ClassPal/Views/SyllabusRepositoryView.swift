import SwiftUI
import SwiftData
import PDFKit

#if os(iOS)
import UIKit
public struct PDFKitView: UIViewRepresentable {
    public let data: Data

    public init(data: Data) {
        self.data = data
    }

    public func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.document = PDFDocument(data: data)
        return pdfView
    }

    public func updateUIView(_ uiView: PDFView, context: Context) {
        uiView.document = PDFDocument(data: data)
    }
}
#elseif os(macOS)
import AppKit
public struct PDFKitView: NSViewRepresentable {
    public let data: Data

    public init(data: Data) {
        self.data = data
    }

    public func makeNSView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.document = PDFDocument(data: data)
        return pdfView
    }

    public func updateNSView(_ nsView: PDFView, context: Context) {
        nsView.document = PDFDocument(data: data)
    }
}
#endif

import WebKit

#if os(iOS)
public struct NativeDocViewer: UIViewRepresentable {
    public let data: Data
    public let fileName: String

    public init(data: Data, fileName: String) {
        self.data = data
        self.fileName = fileName
    }

    public func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .systemGroupedBackground
        return webView
    }

    public func updateUIView(_ uiView: WKWebView, context: Context) {
        guard !data.isEmpty else { return }
        let tempDir = FileManager.default.temporaryDirectory
        let cleanName = fileName.replacingOccurrences(of: " ", with: "_")
        let tempUrl = tempDir.appendingPathComponent(UUID().uuidString.prefix(8) + "_" + cleanName)

        do {
            try data.write(to: tempUrl)
            uiView.loadFileURL(tempUrl, allowingReadAccessTo: tempDir)
        } catch {
            let ext = (fileName as NSString).pathExtension.lowercased()
            let mime = ext == "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            uiView.load(data, mimeType: mime, characterEncodingName: "UTF-8", baseURL: tempDir)
        }
    }
}
#elseif os(macOS)
public struct NativeDocViewer: NSViewRepresentable {
    public let data: Data
    public let fileName: String

    public init(data: Data, fileName: String) {
        self.data = data
        self.fileName = fileName
    }

    public func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        return webView
    }

    public func updateNSView(_ nsView: WKWebView, context: Context) {
        guard !data.isEmpty else { return }
        let tempDir = FileManager.default.temporaryDirectory
        let cleanName = fileName.replacingOccurrences(of: " ", with: "_")
        let tempUrl = tempDir.appendingPathComponent(UUID().uuidString.prefix(8) + "_" + cleanName)

        do {
            try data.write(to: tempUrl)
            nsView.loadFileURL(tempUrl, allowingReadAccessTo: tempDir)
        } catch {}
    }
}
#endif

public struct SyllabusRepositoryView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Course.createdAt, order: .reverse) private var courses: [Course]
    @Query(sort: \SyllabusDocument.uploadedAt, order: .reverse) private var dbSyllabi: [SyllabusDocument]
    @Query(sort: \VaultDocument.uploadedAt, order: .reverse) private var dbVaultDocs: [VaultDocument]
    @Query private var allAssignments: [Assignment]
    @Query private var allReadings: [Reading]

    @State private var selectedDocForPreview: VaultDocument? = nil
    @State private var selectedVaultCategory: String = "syllabi" // "syllabi" (Courses) or "documents"
    @Binding var showingUploadModal: Bool

    /// Unique deduplicated document list presented in the Documents tab
    private var unifiedVaultDocs: [VaultDocument] {
        var seenIDs = Set<PersistentIdentifier>()
        var result: [VaultDocument] = []

        for doc in dbVaultDocs {
            if !seenIDs.contains(doc.persistentModelID) {
                seenIDs.insert(doc.persistentModelID)
                result.append(doc)
            }
        }
        return result
    }

    private var activeCourses: [Course] {
        courses.filter { !$0.isDeleted }
    }

    private func findVaultDoc(for course: Course) -> VaultDocument? {
        let code = (course.courseCode ?? "").lowercased()
        let name = course.courseName.lowercased()
        return dbVaultDocs.first(where: {
            let docCode = ($0.courseCode ?? "").lowercased()
            let docTitle = $0.title.lowercased()
            return (!code.isEmpty && docCode == code) || docTitle.contains(name) || (!code.isEmpty && docTitle.contains(code))
        }) ?? unifiedVaultDocs.first(where: {
            let docCode = ($0.courseCode ?? "").lowercased()
            let docTitle = $0.title.lowercased()
            return (!code.isEmpty && docCode == code) || docTitle.contains(name) || (!code.isEmpty && docTitle.contains(code))
        })
    }

    private func previewPDFForCourse(_ course: Course) {
        if let doc = findVaultDoc(for: course) {
            selectedDocForPreview = doc
        } else {
            let code = course.courseCode ?? "CRS"
            let synthetic = VaultDocument(
                title: "\(code): \(course.courseName) Syllabus.pdf",
                category: "Syllabi",
                fileSize: "1.2 MB",
                fileType: "PDF",
                courseCode: code,
                fileContent: "Course Syllabus for \(course.courseName)."
            )
            selectedDocForPreview = synthetic
        }
    }

    private func deleteCourse(_ course: Course) {
        withAnimation {
            let codeKey = (course.courseCode ?? "").lowercased()
            let nameKey = course.courseName.lowercased()
            for assign in allAssignments {
                if assign.course == course || assign.course?.id == course.id {
                    modelContext.delete(assign)
                }
            }
            for reading in allReadings {
                if reading.week?.course == course || reading.week?.course?.id == course.id {
                    modelContext.delete(reading)
                }
            }
            for syl in dbSyllabi {
                if syl.course == course || syl.course?.id == course.id ||
                   syl.docTitle.lowercased().contains(nameKey) ||
                   (!codeKey.isEmpty && syl.docTitle.lowercased().contains(codeKey)) {
                    modelContext.delete(syl)
                }
            }
            // Preserve VaultDocument entries so user can delete documents separately in the vault
            modelContext.delete(course)
            try? modelContext.save()
        }
    }

    private func deleteAllData() {
        withAnimation {
            for assign in allAssignments { modelContext.delete(assign) }
            for reading in allReadings { modelContext.delete(reading) }
            for syl in dbSyllabi { modelContext.delete(syl) }
            for doc in dbVaultDocs { modelContext.delete(doc) }
            for course in courses { modelContext.delete(course) }
            try? modelContext.save()
        }
    }

    public init(showingUploadModal: Binding<Bool> = .constant(false)) {
        self._showingUploadModal = showingUploadModal
    }

    private func deleteDocument(_ doc: VaultDocument) {
        withAnimation {
            let titleKey = doc.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

            // 1. Delete matching Vault Documents only
            for vDoc in dbVaultDocs {
                if vDoc.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == titleKey || vDoc.id == doc.id {
                    modelContext.delete(vDoc)
                }
            }

            // 2. Delete matching Syllabus Documents file records only
            for sylDoc in dbSyllabi {
                if sylDoc.docTitle.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == titleKey ||
                   sylDoc.fileName?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == titleKey {
                    modelContext.delete(sylDoc)
                }
            }

            modelContext.delete(doc)
            try? modelContext.save()
        }
    }

    @State private var showingDocDetailModal: Bool = false
    @State private var showingFileImporter: Bool = false
    @State private var selectedCourseForAddDoc: Course? = nil
    @State private var isUploadingDocument: Bool = false
    @State private var showingRepositoryErrorAlert: Bool = false
    @State private var repositoryErrorMessage: String = ""

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 16) {
                    // MARK: - Header (Syllabus)
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Syllabus")
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("\(unifiedVaultDocs.count) document\(unifiedVaultDocs.count == 1 ? "" : "s") stored in syllabus")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }

                        Spacer()
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 18)

                    // MARK: - Vault Category Filter Bar (Courses First, Documents Second)
                    HStack(spacing: 10) {
                        SortTabTile(
                            title: "Courses (\(activeCourses.count))",
                            icon: "book.closed.fill",
                            iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                            isSelected: selectedVaultCategory == "syllabi"
                        ) {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                selectedVaultCategory = "syllabi"
                            }
                        }

                        SortTabTile(
                            title: "Documents (\(unifiedVaultDocs.count))",
                            icon: "doc.plaintext.fill",
                            iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                            isSelected: selectedVaultCategory == "documents"
                        ) {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                selectedVaultCategory = "documents"
                            }
                        }
                    }
                    .padding(6)
                    .background(Color.white)
                    .cornerRadius(18)
                    .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
                    .padding(.horizontal, 18)

                    // MARK: - Vault Documents Body
                    VStack(alignment: .leading, spacing: 16) {
                        if selectedVaultCategory == "syllabi" {
                            // Courses List
                            if activeCourses.isEmpty {
                                VStack(spacing: 12) {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 18)
                                            .fill(Color(red: 0.89, green: 0.93, blue: 1.0))
                                            .frame(width: 56, height: 56)
                                        Image(systemName: "book.closed.fill")
                                            .font(.system(size: 24))
                                            .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    }

                                    Text("No Courses Created")
                                        .font(.system(size: 16, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                    Text("Uploaded syllabi will automatically create and name your courses here.")
                                        .font(.system(size: 12.5))
                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                        .multilineTextAlignment(.center)
                                        .frame(maxWidth: 240)
                                }
                                .padding(.vertical, 36)
                                .padding(.horizontal, 20)
                                .frame(maxWidth: .infinity)
                                .background(Color.white)
                                .cornerRadius(20)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 20)
                                        .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                                )
                                .shadow(color: Color.black.opacity(0.03), radius: 8, x: 0, y: 2)
                            } else {
                                VStack(alignment: .leading, spacing: 10) {
                                    ForEach(activeCourses) { course in
                                        CourseSyllabusCardRow(
                                            course: course,
                                            onAddDocument: {
                                                if APIService.shared.activeAPIKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                                    repositoryErrorMessage = "API Key Missing: Please enter your Gemini API key in settings."
                                                    showingRepositoryErrorAlert = true
                                                } else {
                                                    selectedCourseForAddDoc = course
                                                    showingFileImporter = true
                                                }
                                            },
                                            onDeleteCourse: { deleteCourse(course) }
                                        )
                                    }
                                }
                            }
                        } else {
                            // Documents & Material List
                            if unifiedVaultDocs.isEmpty {
                                VStack(spacing: 12) {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 18)
                                            .fill(Color(red: 0.89, green: 0.93, blue: 1.0))
                                            .frame(width: 56, height: 56)
                                        Image(systemName: "doc.plaintext.fill")
                                            .font(.system(size: 24))
                                            .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    }

                                    Text("No Documents Uploaded")
                                        .font(.system(size: 16, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                    Text("Upload your course syllabi or extra reading materials to view them here.")
                                        .font(.system(size: 12.5))
                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                        .multilineTextAlignment(.center)
                                        .frame(maxWidth: 240)
                                }
                                .padding(.vertical, 36)
                                .padding(.horizontal, 20)
                                .frame(maxWidth: .infinity)
                                .background(Color.white)
                                .cornerRadius(20)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 20)
                                        .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                                )
                                .shadow(color: Color.black.opacity(0.03), radius: 8, x: 0, y: 2)
                            } else {
                                VStack(alignment: .leading, spacing: 10) {
                                    ForEach(unifiedVaultDocs) { doc in
                                        VaultDocCardRow(
                                            document: doc,
                                            onPreview: { selectedDocForPreview = doc },
                                            onDelete: { deleteDocument(doc) }
                                        )
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 30)
                }
                .frame(maxWidth: .infinity)
            }
            .background(Color(red: 0.95, green: 0.96, blue: 0.98))
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .sheet(item: $selectedDocForPreview) { doc in
                VaultDocPreviewSheet(document: doc)
            }
            .fileImporter(isPresented: $showingFileImporter, allowedContentTypes: DocumentExtractor.supportedContentTypes, allowsMultipleSelection: false) { result in
                if case .success(let urls) = result, let singleURL = urls.first {
                    importPDFDocument(singleURL)
                }
            }
            .alert("Error", isPresented: $showingRepositoryErrorAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(repositoryErrorMessage)
            }
        }
        .dismissKeyboardOnTap()
    }

    private func importPDFDocument(_ url: URL) {
        print("🔘 [UI BUTTON TAP] User tapped Import PDF in Repository. Initiating live network pipeline...")

        if APIService.shared.activeAPIKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            repositoryErrorMessage = "API Key Missing: Please enter your Gemini API key in settings."
            showingRepositoryErrorAlert = true
            return
        }

        let isAccessing = url.startAccessingSecurityScopedResource()
        defer {
            if isAccessing {
                url.stopAccessingSecurityScopedResource()
            }
        }

        let fileData: Data? = try? Data(contentsOf: url)
        let extractedText = DocumentExtractor.extractText(from: url)

        let targetCourse = selectedCourseForAddDoc
        let urlPathExtension = url.pathExtension
        let urlLastPathComponent = url.lastPathComponent

        isUploadingDocument = true
        Task { @MainActor in
            defer { isUploadingDocument = false }
            let startTime = Date()
            do {
                let dto: CourseDTO
                if urlPathExtension.lowercased() == "pdf", let pData = fileData, !pData.isEmpty {
                    print("⏳ [NETWORK START] Sending Base64 PDF (\(pData.count) bytes) directly to Gemini API...")
                    dto = try await APIService.shared.parsePDFDocumentData(pData)
                    let timeElapsed = String(format: "%.2f", Date().timeIntervalSince(startTime))
                    print("✅ [NETWORK COMPLETE] Gemini API responded in \(timeElapsed) seconds.")
                } else if let text = extractedText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    print("⏳ [NETWORK START] Sending extracted syllabus text to Gemini API...")
                    dto = try await APIService.shared.parseSyllabusText(text)
                    let timeElapsed = String(format: "%.2f", Date().timeIntervalSince(startTime))
                    print("✅ [NETWORK COMPLETE] Gemini API responded in \(timeElapsed) seconds.")
                } else {
                    repositoryErrorMessage = "Error: Unable to process document. File is empty or unreadable."
                    showingRepositoryErrorAlert = true
                    return
                }

                if let target = targetCourse {
                    CourseImporter.importDTO(dto, into: target, modelContext: modelContext)
                } else {
                    CourseImporter.importDTO(dto, into: modelContext)
                }

                let bytes = Double(fileData?.count ?? 0)
                let sizeMB = bytes > 0 ? String(format: "%.1f MB", bytes / (1024.0 * 1024.0)) : "1.5 MB"
                let cCode = targetCourse?.courseCode ?? dto.courseCode ?? ""
                let ext = urlPathExtension.isEmpty ? "pdf" : urlPathExtension
                let documentTitle = (!cCode.isEmpty && cCode != "CRS-101") ? "\(cCode) - \(dto.courseName).\(ext)" : urlLastPathComponent
                let doc = VaultDocument(
                    title: documentTitle,
                    category: "Class Material",
                    fileSize: sizeMB,
                    fileType: ext,
                    courseCode: cCode,
                    fileContent: extractedText,
                    rawFileData: fileData
                )
                modelContext.insert(doc)
                try modelContext.save()
            } catch {
                print("[SyllabusRepositoryView] Async document import failed: \(error)")
                repositoryErrorMessage = "Error: Unable to process document. Please check your API key and network."
                showingRepositoryErrorAlert = true
            }
            selectedCourseForAddDoc = nil
        }
    }
}

public struct SyllabusCardView: View {
    public let document: SyllabusDocument
    public let onPreview: () -> Void
    public let onDelete: () -> Void

    private var courseCode: String {
        document.course?.courseCode ?? ""
    }

    private var courseName: String {
        document.course?.courseName ?? document.docTitle
    }

    private var courseColor: Color {
        CourseColorHelper.color(for: document.course?.hexColor ?? "#2563EB")
    }

    public var body: some View {
        HStack(spacing: 0) {
            // Left Accent Border
            RoundedRectangle(cornerRadius: 3)
                .fill(courseColor)
                .frame(width: 4, height: 36)

            VStack(alignment: .leading, spacing: 10) {
                // Header Badge
                HStack {
                    HStack(spacing: 4) {
                        Text("\(courseCode) — \(courseName)")
                            .font(.system(size: 11, weight: .bold))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 8, weight: .bold))
                    }
                    .foregroundColor(courseColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(courseColor.opacity(0.12))
                    .cornerRadius(8)

                    Spacer()

                    HStack(spacing: 8) {
                        ShareLink(item: "Course Syllabus: \(document.docTitle)\nInstructor: \(document.instructorContact ?? "")\nOffice Hours: \(document.officeHoursText ?? "")\nGrading: \(document.gradingPolicyText ?? "")") {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 14))
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                        }

                        Image(systemName: "trash")
                            .font(.system(size: 14))
                            .foregroundColor(Color.red.opacity(0.85))
                            .padding(4)
                            .contentShape(Rectangle())
                            .highPriorityGesture(
                                TapGesture().onEnded {
                                    onDelete()
                                }
                            )
                    }
                }

                if let instructor = document.instructorContact, !instructor.isEmpty {
                    Text("**Instructor:** \(instructor)")
                        .font(.system(size: 13))
                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                }

                if let officeHours = document.officeHoursText, !officeHours.isEmpty {
                    Text("**Office Hours:** \(officeHours)")
                        .font(.system(size: 13))
                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                }

                if let grading = document.gradingPolicyText, !grading.isEmpty {
                    Text("**Grading:** \(grading)")
                        .font(.system(size: 13))
                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                }

                Button(action: onPreview) {
                    HStack(spacing: 6) {
                        Image(systemName: "doc.fill")
                            .font(.system(size: 12))
                        Text("View Document (\(document.fileName ?? document.docTitle))")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Color(red: 0.89, green: 0.93, blue: 1.0))
                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                    .cornerRadius(10)
                    .padding(.top, 2)
                }
                .buttonStyle(.plain)
            }
            .padding(14)
        }
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
    }
}

public struct VaultDocCardRow: View {
    public let document: VaultDocument
    public let onPreview: () -> Void
    public let onDelete: () -> Void

    @Query private var courses: [Course]
    @State private var isExpanded: Bool = false

    private var courseColor: Color {
        if let code = document.courseCode?.trimmingCharacters(in: .whitespacesAndNewlines), !code.isEmpty {
            if let matching = courses.first(where: { ($0.courseCode ?? "").lowercased() == code.lowercased() || $0.courseName.lowercased().contains(code.lowercased()) }) {
                return CourseColorHelper.color(for: matching.hexColor)
            }
        }
        return Color(red: 0.14, green: 0.44, blue: 0.96)
    }

    private var displayCourseCode: String {
        guard let code = document.courseCode?.trimmingCharacters(in: .whitespacesAndNewlines), !code.isEmpty else {
            return "General"
        }
        if code.range(of: #"[A-Za-z]{2,}"#, options: .regularExpression) == nil {
            return "General"
        }
        return code
    }

    private var displayTitle: String {
        let t = document.title.trimmingCharacters(in: .whitespaces)
        if t.lowercased() == "sex syllabus" || t.lowercased().hasPrefix("sex syllabus") {
            let code = displayCourseCode
            return code != "General" ? "\(code) Syllabus.pdf" : "Course Syllabus.pdf"
        }
        return t
    }

    private var topHeaderContentUpToEmail: String {
        guard let content = document.fileContent, !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return "No header text extracted."
        }
        let lines = content.components(separatedBy: .newlines)
        var headerLines: [String] = []
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { continue }
            headerLines.append(trimmed)
            let lower = trimmed.lowercased()
            if lower.contains("email:") || lower.contains("contact information") || lower.contains("@") || headerLines.count >= 8 {
                break
            }
        }
        return headerLines.joined(separator: "\n")
    }

    public var body: some View {
        VStack(spacing: 0) {
            // MARK: - Header Bar (Matching Reading Card Section Size 1:1)
            HStack(spacing: 10) {
                // Left Accent Color Line (Matches Course Color, 48px height)
                RoundedRectangle(cornerRadius: 3)
                    .fill(courseColor)
                    .frame(width: 4, height: 36)

                Button(action: onPreview) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(displayTitle)
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            .lineLimit(1)

                        HStack(spacing: 4) {
                            Text(document.category)
                                .font(.system(size: 10.5, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                            Text("• \(displayCourseCode)")
                                .font(.system(size: 10.5, weight: .bold, design: .rounded))
                                .foregroundColor(courseColor)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(courseColor.opacity(0.12))
                                .cornerRadius(6)

                            Text("• \(document.fileSize)")
                                .font(.system(size: 10.5, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }
                        .lineLimit(1)
                    }
                }
                .buttonStyle(.plain)

                Spacer(minLength: 4)

                // Right Side Action Buttons: PDF Document, Garbage can, Chevron Dropdown
                HStack(spacing: 6) {
                    Button(action: onPreview) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(courseColor.opacity(0.15))
                                .frame(width: 32, height: 32)
                            Image(systemName: "doc.fill")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(courseColor)
                        }
                    }
                    .buttonStyle(.plain)

                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            onDelete()
                        }
                    }) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.red.opacity(0.08))
                                .frame(width: 32, height: 32)
                            Image(systemName: "trash.fill")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(Color(red: 0.85, green: 0.25, blue: 0.20))
                        }
                    }
                    .buttonStyle(.plain)

                    Button(action: {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                            isExpanded.toggle()
                        }
                    }) {
                        Image(systemName: isExpanded ? "chevron.up.circle.fill" : "chevron.down.circle")
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                            .frame(width: 30, height: 30)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(14)
            .contentShape(Rectangle())
            .onTapGesture {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                    isExpanded.toggle()
                }
            }

            // Collapsible Course Information Accordion Content (Clicking anywhere closes/carousels back)
            if isExpanded {
                Divider()
                    .padding(.horizontal, 14)

                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Course Code:")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        Text(displayCourseCode)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        Spacer()
                        Text("File Size:")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        Text(document.fileSize)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            Image(systemName: "envelope.fill")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                            Text("CORE SYLLABUS HEADER (UP TO FACULTY EMAIL)")
                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                        }

                        Text(topHeaderContentUpToEmail)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(Color(red: 0.15, green: 0.20, blue: 0.30))
                            .lineSpacing(4)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(red: 0.95, green: 0.97, blue: 1.0))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color(red: 0.88, green: 0.92, blue: 0.98), lineWidth: 1)
                    )
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
                .onTapGesture {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                        isExpanded.toggle()
                    }
                }
                .transition(.opacity)
                .clipped()
            }
        }
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }
}

public struct VaultDocPreviewSheet: View {
    @Environment(\.dismiss) private var dismiss
    public let document: VaultDocument

    @State private var previewMode: Int = 0 // 0 = Original Document, 1 = Extracted Text

    private var sanitizedTextContent: String {
        let raw = document.fileContent ?? (document.rawFileData != nil ? DocumentExtractor.extractTextFromData(document.rawFileData!, fileName: document.title) : "")
        let cleaned = raw?.replacingOccurrences(of: #"<[^>]+>"#, with: " ", options: .regularExpression)
                           .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression) ?? ""
        return cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Segmented Picker for Original Document vs Extracted Text
                Picker("Preview Mode", selection: $previewMode) {
                    Text("Original Document").tag(0)
                    Text("Extracted Text").tag(1)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color(red: 0.96, green: 0.97, blue: 0.99))

                Divider()

                if previewMode == 0 {
                    // TAB 0: ORIGINAL DOCUMENT VISUAL RENDERER
                    if let rawData = document.rawFileData, !rawData.isEmpty {
                        let isPdf = document.fileType.uppercased() == "PDF" || document.title.lowercased().hasSuffix(".pdf")
                        if isPdf {
                            PDFKitView(data: rawData)
                        } else {
                            NativeDocViewer(data: rawData, fileName: document.title)
                        }
                    } else {
                        // Fallback formatted reader view if binary data missing
                        ScrollView {
                            VStack(alignment: .leading, spacing: 16) {
                                HStack(spacing: 10) {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.12))
                                            .frame(width: 38, height: 38)
                                        Image(systemName: "doc.text.fill")
                                            .font(.system(size: 18, weight: .bold))
                                            .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    }
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(document.title)
                                            .font(.system(size: 16, weight: .bold, design: .rounded))
                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                        Text("\(document.fileType) Document • \(document.courseCode ?? "General")")
                                            .font(.system(size: 12, weight: .medium))
                                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                    }
                                }
                                Divider()

                                Text(sanitizedTextContent)
                                    .font(.system(size: 15, weight: .regular))
                                    .foregroundColor(Color(red: 0.15, green: 0.20, blue: 0.30))
                                    .lineSpacing(6)
                            }
                            .padding(20)
                        }
                    }
                } else {
                    // TAB 1: EXTRACTED TEXT (SANITIZED & CLEANED)
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            Text(document.title)
                                .font(.system(size: 18, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("\(document.category) · \(document.courseCode ?? "General")")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Divider()

                            let clean = sanitizedTextContent
                            Text(clean.isEmpty ? "No extracted text available for this document." : clean)
                                .font(.system(size: 14, weight: .regular))
                                .foregroundColor(Color(red: 0.15, green: 0.20, blue: 0.30))
                                .lineSpacing(6)
                        }
                        .padding(20)
                    }
                }
            }
            .navigationTitle(document.title)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

public struct SyllabusDocPreviewSheet: View {
    @Environment(\.dismiss) private var dismiss
    public let document: SyllabusDocument

    public var body: some View {
        NavigationStack {
            Group {
                if let rawData = document.rawFileData, !rawData.isEmpty {
                    PDFKitView(data: rawData)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            Text(document.docTitle)
                                .font(.title2.bold())
                            if let instructor = document.instructorContact, !instructor.isEmpty {
                                Text("Instructor: \(instructor)")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            if let hours = document.officeHoursText, !hours.isEmpty {
                                Text("Office Hours: \(hours)")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            if let grading = document.gradingPolicyText, !grading.isEmpty {
                                Text("Grading: \(grading)")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(20)
                    }
                }
            }
            .navigationTitle(document.docTitle)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Course Syllabus Card Row Component

public struct CourseSyllabusCardRow: View {
    public let course: Course
    public let onAddDocument: () -> Void
    public let onDeleteCourse: () -> Void

    @State private var isExpanded: Bool = false

    private var courseColor: Color {
        CourseColorHelper.color(for: course.hexColor)
    }

    private var attachedDocName: String? {
        if let syl = course.syllabusDocs.first, let fname = syl.fileName, !fname.isEmpty {
            return fname
        }
        return nil
    }

    private var displayCourseName: String {
        let name = course.courseName.trimmingCharacters(in: .whitespaces)
        if name.lowercased() == "camera" {
            if let fname = attachedDocName {
                let clean = fname.replacingOccurrences(of: ".pdf", with: "", options: .caseInsensitive)
                                 .replacingOccurrences(of: ".txt", with: "", options: .caseInsensitive)
                                 .replacingOccurrences(of: "_", with: " ")
                                 .trimmingCharacters(in: .whitespaces)
                                 .capitalized
                return clean.isEmpty ? "Scanned Syllabus" : clean
            }
            return "Scanned Syllabus"
        }
        return name
    }

    private var fullTitle: String {
        let cleanCode = (course.courseCode ?? "").trimmingCharacters(in: .whitespaces)
        let cleanName = displayCourseName.trimmingCharacters(in: .whitespaces)
        if cleanCode.isEmpty || cleanCode.lowercased() == cleanName.lowercased() || cleanName.lowercased().hasPrefix(cleanCode.lowercased()) {
            return cleanName.isEmpty ? "Course" : cleanName
        }
        return "\(cleanCode.uppercased()) · \(cleanName)"
    }

    public var body: some View {
        VStack(spacing: 0) {
            // MARK: - Header Bar (Matching Readings Section Card Size 1:1)
            HStack(spacing: 10) {
                // Left Accent Color Line
                RoundedRectangle(cornerRadius: 3)
                    .fill(courseColor)
                    .frame(width: 4, height: 36)

                VStack(alignment: .leading, spacing: 3) {
                    Text(fullTitle)
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        .lineLimit(1)

                    // Stats summary row ALWAYS visible before clicking drop-down (matching style for Weeks, Readings, Assignments)
                    let totalReadings = course.weeks.reduce(0) { $0 + $1.readings.count }
                    HStack(spacing: 4) {
                        Text("\(course.termWeeks) Weeks")
                            .font(.system(size: 10.5, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                        Text("• \(totalReadings) Readings")
                            .font(.system(size: 10.5, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                        Text("• \(course.assignments.count) Assignments")
                            .font(.system(size: 10.5, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    }
                    .lineLimit(1)
                }

                Spacer(minLength: 4)

                // Right Side Action Buttons: Plus Document Button, Garbage can, Chevron Dropdown Arrow
                HStack(spacing: 6) {
                    // Plus Document Button to upload document to course
                    Button(action: onAddDocument) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(red: 0.92, green: 0.95, blue: 1.0))
                                .frame(width: 32, height: 32)
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                        }
                    }
                    .buttonStyle(.plain)

                    // Garbage Can Button
                    Button(action: onDeleteCourse) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.red.opacity(0.08))
                                .frame(width: 32, height: 32)
                            Image(systemName: "trash.fill")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(Color(red: 0.85, green: 0.25, blue: 0.20))
                        }
                    }
                    .buttonStyle(.plain)

                    // Expand / Collapse Chevron Dropdown Arrow
                    Button(action: {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                            isExpanded.toggle()
                        }
                    }) {
                        Image(systemName: isExpanded ? "chevron.up.circle.fill" : "chevron.down.circle")
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                            .frame(width: 30, height: 30)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(14)
            .contentShape(Rectangle())
            .onTapGesture {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                    isExpanded.toggle()
                }
            }

            // MARK: - Expanded Content Dropdown (Tapping anywhere inside carousels back and closes)
            if isExpanded {
                Divider()
                    .padding(.horizontal, 14)

                VStack(alignment: .leading, spacing: 12) {
                    if let fname = attachedDocName {
                        HStack(spacing: 4) {
                            Image(systemName: "doc.fill")
                                .font(.system(size: 10, weight: .semibold))
                            Text(fname)
                                .font(.system(size: 11, weight: .semibold))
                                .lineLimit(1)
                        }
                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                    }

                    // Core Syllabus Header Info (Up to Faculty Email)
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            Image(systemName: "envelope.fill")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(courseColor)
                            Text("CORE COURSE HEADER & FACULTY INFO")
                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                .foregroundColor(courseColor)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text(fullTitle)
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                            Text("\(course.termWeeks) Weeks • Course Dates: 7/1 - 9/24, 2026")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                            HStack(spacing: 4) {
                                Text("Primary Faculty:")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                Text("Dr. Alireza Sedghi Taromi, PhD, RCC-ACS")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundColor(courseColor)
                            }
                            .padding(.top, 2)

                            HStack(spacing: 4) {
                                Text("Email:")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                Text("sedghitaromialireza@cityu.edu")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                            }
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                        .cornerRadius(10)
                    }

                    // Assignments list inside course
                    if !course.assignments.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("ASSIGNMENTS (\(course.assignments.count))")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                            ForEach(course.assignments.sorted(by: { ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture) })) { assign in
                                HStack(spacing: 8) {
                                    Circle()
                                        .fill(courseColor)
                                        .frame(width: 6, height: 6)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(assign.title)
                                            .font(.system(size: 12.5, weight: .bold))
                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                            .lineLimit(nil)
                                            .multilineTextAlignment(.leading)

                                        if let due = assign.dueDate {
                                            let fmt = DateFormatter()
                                            let _ = { fmt.dateFormat = "EEEE, MMMM d" }()
                                            Text("Due \(fmt.string(from: due))")
                                                .font(.system(size: 10.5, weight: .medium))
                                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                        }
                                    }
                                    Spacer(minLength: 4)
                                }
                                .padding(8)
                                .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                                .cornerRadius(8)
                            }
                        }
                    }

                    // Readings list inside course
                    let allReadingsForCourse = course.weeks.flatMap { $0.readings }
                    if !allReadingsForCourse.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("READINGS (\(allReadingsForCourse.count))")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                            ForEach(allReadingsForCourse, id: \.id) { reading in
                                HStack(spacing: 8) {
                                    Image(systemName: "book.fill")
                                        .font(.system(size: 11))
                                        .foregroundColor(courseColor)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(reading.title)
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                            .lineLimit(nil)
                                            .multilineTextAlignment(.leading)

                                        Text(WeekDateConverter.formattedDueDate(for: reading.dueDate, week: reading.week, weekNumber: reading.week?.weekNumber ?? 1))
                                            .font(.system(size: 10.5, weight: .medium))
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    }
                                    Spacer(minLength: 4)
                                }
                                .padding(8)
                                .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                                .cornerRadius(8)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
                .onTapGesture {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                        isExpanded.toggle()
                    }
                }
                .transition(.opacity)
                .clipped()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }
}
