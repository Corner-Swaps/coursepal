import SwiftUI
import SwiftData
import PDFKit

// MARK: - Authentic PDF Highlight Annotation

public final class AuthenticPDFHighlightAnnotation: PDFAnnotation {
    public override func draw(with box: PDFDisplayBox, in context: CGContext) {
        context.saveGState()
        context.setBlendMode(.multiply)
        // High-fidelity translucent yellow highlighter pen ink
        context.setFillColor(CGColor(red: 1.0, green: 0.94, blue: 0.15, alpha: 0.45))
        let padX: CGFloat = 3.5
        let padY: CGFloat = 2.0
        let hRect = bounds.insetBy(dx: -padX, dy: -padY)
        let path = CGPath(roundedRect: hRect, cornerWidth: 3.5, cornerHeight: 3.5, transform: nil)
        context.addPath(path)
        context.fillPath()
        context.restoreGState()
    }
}

#if os(iOS)
import UIKit

public struct PDFKitView: UIViewRepresentable {
    public let data: Data
    public let initialPage: Int?
    public let highlightSearchTerms: [String]

    public init(
        data: Data,
        initialPage: Int? = nil,
        highlightSearchTerms: [String] = []
    ) {
        self.data = data
        self.initialPage = initialPage
        self.highlightSearchTerms = highlightSearchTerms
    }

    public init(
        data: Data,
        initialPage: Int? = nil,
        highlightRects: [CGRect] = [],
        shouldZoomToHighlight: Bool = true
    ) {
        self.data = data
        self.initialPage = initialPage
        self.highlightSearchTerms = []
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    public class Coordinator {
        var hasNavigated = false
    }

    public func makeUIView(context: Context) -> PDFView {
        print("🔥 [PDF_KIT] makeUIView called! data.count = \(data.count), initialPage = \(initialPage ?? -1), searchTerms = \(highlightSearchTerms)")
        let pdfView = PDFView()
        pdfView.displayMode = .singlePageContinuous
        pdfView.displaysPageBreaks = true
        pdfView.displayDirection = .vertical
        pdfView.isUserInteractionEnabled = true
        pdfView.backgroundColor = UIColor.systemGroupedBackground

        var loadedDoc = PDFDocument(data: data)
        if loadedDoc == nil {
            let prefixStr = String(data: data.prefix(128), encoding: .utf8) ?? "non-utf8"
            let hex = data.prefix(16).map { String(format: "%02x", $0) }.joined(separator: " ")
            print("❌ [PDF_KIT] PDFDocument(data:) returned NIL! count=\(data.count), hex: \(hex), utf8 prefix: \(prefixStr). Falling back to bundled PDF...")
            if let fallback = PDFHighlightSnapshotEngine.getFallbackPDFData() {
                loadedDoc = PDFDocument(data: fallback)
            }
        }

        if let doc = loadedDoc {
            print("🔥 [PDF_KIT] PDFDocument loaded successfully! pageCount = \(doc.pageCount)")
            pdfView.document = doc
            pdfView.autoScales = true
            applyHighlights(to: pdfView, doc: doc)
        }
        return pdfView
    }

    public func updateUIView(_ uiView: PDFView, context: Context) {
        print("🔥 [PDF_KIT] updateUIView called! bounds = \(uiView.bounds), currentDoc = \(uiView.document != nil ? "yes(\(uiView.document!.pageCount) pages)" : "nil"), hasNavigated = \(context.coordinator.hasNavigated)")
        if uiView.document == nil {
            var doc = PDFDocument(data: data)
            if doc == nil, let fallback = PDFHighlightSnapshotEngine.getFallbackPDFData() {
                doc = PDFDocument(data: fallback)
            }
            if let doc = doc {
                uiView.document = doc
                uiView.autoScales = true
                applyHighlights(to: uiView, doc: doc)
            }
        }

        uiView.autoScales = true

        if !context.coordinator.hasNavigated, let doc = uiView.document {
            let pageNum = initialPage ?? 1
            if pageNum >= 1 && pageNum <= doc.pageCount, let targetPage = doc.page(at: pageNum - 1) {
                if uiView.bounds.width > 0 {
                    context.coordinator.hasNavigated = true
                    uiView.autoScales = true
                    print("🔥 [PDF_KIT] Navigating to page \(pageNum) immediately!")
                    uiView.go(to: targetPage)
                } else {
                    print("🔥 [PDF_KIT] Bounds width is 0, deferring navigation to page \(pageNum)...")
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                        guard !context.coordinator.hasNavigated else { return }
                        context.coordinator.hasNavigated = true
                        uiView.autoScales = true
                        print("🔥 [PDF_KIT] Deferred navigating to page \(pageNum) (bounds = \(uiView.bounds))")
                        uiView.go(to: targetPage)
                    }
                }
            } else {
                context.coordinator.hasNavigated = true
            }
        }
    }

    private func applyHighlights(to pdfView: PDFView, doc: PDFDocument) {
        guard !highlightSearchTerms.isEmpty else { return }
        var allSelections: [PDFSelection] = []
        for term in highlightSearchTerms {
            let clean = term.trimmingCharacters(in: .whitespacesAndNewlines)
            guard clean.count >= 4 else { continue }
            let found = doc.findString(clean, withOptions: [.caseInsensitive])
            allSelections.append(contentsOf: found)
        }
        if !allSelections.isEmpty {
            pdfView.highlightedSelections = allSelections
        }
    }
}
#elseif os(macOS)
import AppKit
public struct PDFKitView: NSViewRepresentable {
    public let data: Data
    public let initialPage: Int?
    public let highlightRects: [CGRect]
    public let shouldZoomToHighlight: Bool

    public init(
        data: Data,
        initialPage: Int? = nil,
        highlightRects: [CGRect] = [],
        shouldZoomToHighlight: Bool = true
    ) {
        self.data = data
        self.initialPage = initialPage
        self.highlightRects = highlightRects
        self.shouldZoomToHighlight = shouldZoomToHighlight
    }

    public init(
        data: Data,
        initialPage: Int? = nil,
        highlightSearchTerms: [String] = []
    ) {
        self.data = data
        self.initialPage = initialPage
        self.highlightRects = []
        self.shouldZoomToHighlight = false
    }

    public func makeNSView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = false
        if let doc = PDFDocument(data: data) {
            pdfView.document = doc
            let pageNum = initialPage ?? 1
            if pageNum >= 1 && pageNum <= doc.pageCount,
               let targetPage = doc.page(at: pageNum - 1) {
                for rect in highlightRects where rect.width > 2 && rect.height > 2 {
                    let annot = AuthenticPDFHighlightAnnotation(bounds: rect, forType: .highlight, withProperties: nil)
                    targetPage.addAnnotation(annot)
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    let fitScale = pdfView.scaleFactorForSizeToFit
                    if shouldZoomToHighlight {
                        pdfView.scaleFactor = max(fitScale * 2.0, 1.5)
                        if let first = highlightRects.first {
                            let union = highlightRects.reduce(first) { $0.union($1) }
                            pdfView.go(to: union, on: targetPage)
                        } else {
                            pdfView.go(to: targetPage)
                        }
                    } else {
                        pdfView.scaleFactor = fitScale
                        pdfView.go(to: targetPage)
                    }
                }
            }
        }
        return pdfView
    }

    public func updateNSView(_ nsView: PDFView, context: Context) {}
}
#endif

import WebKit

#if os(iOS)
import UIKit
import QuickLook

public struct QuickLookDocViewer: UIViewControllerRepresentable {
    public let data: Data
    public let fileName: String

    public init(data: Data, fileName: String) {
        self.data = data
        self.fileName = fileName
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(data: data, fileName: fileName)
    }

    public class Coordinator: NSObject, QLPreviewControllerDataSource {
        var tempFileURL: URL?

        init(data: Data, fileName: String) {
            super.init()
            guard !data.isEmpty else { return }
            let tempDir = FileManager.default.temporaryDirectory
            var cleanName = fileName.replacingOccurrences(of: " ", with: "_")
            let ext = (cleanName as NSString).pathExtension.lowercased()
            if ext.isEmpty {
                if data.starts(with: [0x25, 0x50, 0x44, 0x46]) {
                    cleanName += ".pdf"
                } else {
                    cleanName += ".docx"
                }
            }
            let url = tempDir.appendingPathComponent("ql_\(UUID().uuidString.prefix(8))_\(cleanName)")
            do {
                try data.write(to: url)
                self.tempFileURL = url
            } catch {
                print("❌ [QuickLookDocViewer] Failed to write temp file: \(error)")
            }
        }

        public func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
            return tempFileURL != nil ? 1 : 0
        }

        public func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
            return (tempFileURL ?? URL(fileURLWithPath: "")) as NSURL
        }
    }

    public func makeUIViewController(context: Context) -> QLPreviewController {
        let ql = QLPreviewController()
        ql.dataSource = context.coordinator
        return ql
    }

    public func updateUIViewController(_ uiViewController: QLPreviewController, context: Context) {
        uiViewController.reloadData()
    }
}

public struct NativeDocViewer: View {
    public let data: Data
    public let fileName: String

    public init(data: Data, fileName: String) {
        self.data = data
        self.fileName = fileName
    }

    public var body: some View {
        QuickLookDocViewer(data: data, fileName: fileName)
            .ignoresSafeArea(edges: .bottom)
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
    @State private var editingCourse: Course? = nil
    @State private var editingFaculty: Course? = nil
    @State private var editingAssignment: Assignment? = nil
    @State private var editingReading: Reading? = nil
    @State private var courseForAddingTask: Course? = nil
    @State private var addingTaskCategory: Int = 0 // 0: Assignment, 1: Reading
    @State private var showingAddTaskModal: Bool = false
    @State private var courseForCameraScan: Course? = nil
    @State private var showingCameraScanSheet: Bool = false
    @State private var coursePendingDeletion: Course? = nil
    @State private var showingDeleteCourseConfirm: Bool = false
    @State private var docPendingDeletion: VaultDocument? = nil
    @State private var showingDeleteDocConfirm: Bool = false
    @State private var showingVaultPickerSheet: Bool = false
    @State private var selectedCourseForVaultPicker: Course? = nil
    @Binding var showingUploadModal: Bool
    @Binding var isGlobalProcessing: Bool
    @Binding var selectedCourseForAddDoc: Course?

    public init(showingUploadModal: Binding<Bool> = .constant(false), isGlobalProcessing: Binding<Bool> = .constant(false), selectedCourseForAddDoc: Binding<Course?> = .constant(nil)) {
        self._showingUploadModal = showingUploadModal
        self._isGlobalProcessing = isGlobalProcessing
        self._selectedCourseForAddDoc = selectedCourseForAddDoc
    }

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
        courses.filter { !$0.isDeleted }.sorted {
            $0.createdAt > $1.createdAt
        }
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
            SyllabusUploadManager.shared.cancelUpload(forCourseId: course.id)
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
            DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
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
            DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
        }
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
            DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
        }
    }

    @State private var showingDocDetailModal: Bool = false
    @State private var showingFileImporter: Bool = false
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
                                .font(.cpPageTitle)
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("\(unifiedVaultDocs.count) document\(unifiedVaultDocs.count == 1 ? "" : "s") stored in syllabus")
                                .font(.cpDescriptionMedium)
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
                            icon: "doc.fill",
                            iconColor: Color(red: 0.49, green: 0.23, blue: 0.93),
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

                    // MARK: - Loading Status Pill (Above Courses)
                    if SyllabusUploadManager.shared.isUploading {
                        let activeCount = SyllabusUploadManager.shared.uploadingCourseIds.count
                        let titleText = activeCount > 1 ? "Processing \(activeCount) courses..." : (SyllabusUploadManager.shared.statusText.isEmpty ? "Analyzing syllabus document..." : SyllabusUploadManager.shared.statusText)
                        
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 10) {
                                ProgressView()
                                    .controlSize(.small)
                                    .tint(Color(red: 0.14, green: 0.44, blue: 0.96))

                                Text(titleText)
                                    .font(.cpDescriptionBold)
                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    .lineLimit(1)

                                Spacer()

                                ContinuousProgressBar()
                                    .frame(width: 60)
                            }

                            // Reassuring Educational Banner
                            HStack(alignment: .top, spacing: 6) {
                                Image(systemName: "info.circle.fill")
                                    .font(.system(size: 12))
                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.8))
                                    .padding(.top, 1)

                                Text("Deep analysis takes 1–2 minutes to extract all readings and assignments accurately. You can freely browse other sections or exit the app — processing will continue in the background.")
                                    .font(.system(size: 11.5, weight: .regular))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .background(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.08))
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.2), lineWidth: 1)
                        )
                        .padding(.horizontal, 18)
                        .transition(.opacity)
                    }

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
                                        .font(.cpItemTitle)
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                    Text("Uploaded syllabi will automatically create and name your courses here.")
                                        .font(.cpDescription)
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
                                                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                                                        showingFileImporter = true
                                                    }
                                                }
                                            },
                                            onAddExistingDocument: {
                                                selectedCourseForVaultPicker = course
                                                showingVaultPickerSheet = true
                                            },
                                            onScanDocument: {
                                                courseForCameraScan = course
                                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                                                    showingCameraScanSheet = true
                                                }
                                            },
                                            onAddAssignment: {
                                                courseForAddingTask = course
                                                addingTaskCategory = 0
                                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                                                    showingAddTaskModal = true
                                                }
                                            },
                                            onAddReading: {
                                                courseForAddingTask = course
                                                addingTaskCategory = 1
                                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                                                    showingAddTaskModal = true
                                                }
                                            },
                                            onDeleteCourse: {
                                                coursePendingDeletion = course
                                                showingDeleteCourseConfirm = true
                                            },
                                            onEditCourse: { editingCourse = course },
                                            onEditFaculty: { editingFaculty = course },
                                            onEditAssignment: { assign in editingAssignment = assign },
                                            onEditReading: { reading in editingReading = reading }
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
                                            onDelete: {
                                                docPendingDeletion = doc
                                                showingDeleteDocConfirm = true
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 130)
                }
                .frame(maxWidth: .infinity)
            }
            .fuzzedScrollEdges(top: 36, bottom: 85)
            .background(Color(red: 0.95, green: 0.96, blue: 0.98))
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .sheet(item: $selectedDocForPreview) { doc in
                VaultDocPreviewSheet(document: doc)
            }
            .sheet(item: $editingCourse) { c in
                CourseDetailView(course: c)
            }
            .sheet(item: $editingFaculty) { c in
                EditFacultyModalView(course: c)
            }
            .sheet(item: $editingAssignment) { a in
                EditAssignmentModalView(assignment: a)
            }
            .sheet(item: $editingReading) { r in
                EditReadingModalView(reading: r)
            }
            .sheet(isPresented: $showingAddTaskModal) {
                AddTaskModalView(initialCourse: courseForAddingTask, initialCategory: addingTaskCategory)
            }
            #if os(iOS)
            .fullScreenCover(isPresented: $showingCameraScanSheet) {
                SyllabusScanView(targetCourse: courseForCameraScan)
            }
            #else
            .sheet(isPresented: $showingCameraScanSheet) {
                SyllabusScanView(targetCourse: courseForCameraScan)
            }
            #endif

            .fileImporter(isPresented: $showingFileImporter, allowedContentTypes: DocumentExtractor.supportedContentTypes, allowsMultipleSelection: true) { result in
                if case .success(let urls) = result, !urls.isEmpty {
                    importPDFDocuments(urls)
                }
            }
            .alert("Error", isPresented: $showingRepositoryErrorAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(repositoryErrorMessage)
            }
            .alert("Delete Course?", isPresented: $showingDeleteCourseConfirm) {
                Button("Delete Course", role: .destructive) {
                    if let c = coursePendingDeletion {
                        deleteCourse(c)
                        coursePendingDeletion = nil
                    }
                }
                Button("Cancel", role: .cancel) {
                    coursePendingDeletion = nil
                }
            } message: {
                if let c = coursePendingDeletion {
                    let readingCount = c.weeks.reduce(0) { $0 + $1.readings.count }
                    let assignmentCount = c.assignments.count
                    let docCount = c.syllabusDocs.count
                    Text("Are you sure you want to delete '\(c.courseName)'? This will remove its \(readingCount) readings, \(assignmentCount) assignments, and \(docCount) attached documents.")
                } else {
                    Text("Are you sure you want to delete this course?")
                }
            }
            .alert("Delete Document?", isPresented: $showingDeleteDocConfirm) {
                Button("Delete Document", role: .destructive) {
                    if let d = docPendingDeletion {
                        deleteDocument(d)
                        docPendingDeletion = nil
                    }
                }
                Button("Cancel", role: .cancel) {
                    docPendingDeletion = nil
                }
            } message: {
                if let d = docPendingDeletion {
                    Text("Are you sure you want to permanently delete '\(d.title)' from your stored documents?")
                } else {
                    Text("Are you sure you want to delete this document?")
                }
            }
            .sheet(isPresented: $showingVaultPickerSheet) {
                if let targetCourse = selectedCourseForVaultPicker {
                    NavigationStack {
                        List {
                            if unifiedVaultDocs.isEmpty {
                                Text("No saved documents found in Vault.")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            } else {
                                ForEach(unifiedVaultDocs) { doc in
                                    Button(action: {
                                        showingVaultPickerSheet = false
                                        importVaultDoc(doc, into: targetCourse)
                                    }) {
                                        HStack(spacing: 12) {
                                            Image(systemName: "doc.fill")
                                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(doc.title)
                                                    .font(.system(size: 14, weight: .bold))
                                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                Text("\(doc.courseCode ?? "General") • \(doc.fileSize)")
                                                    .font(.caption)
                                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                            }
                                            Spacer()
                                            Image(systemName: "plus.circle.fill")
                                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                        }
                                        .padding(.vertical, 4)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .navigationTitle("Add Existing Document")
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Cancel") { showingVaultPickerSheet = false }
                            }
                        }
                    }
                }
            }
            .onChange(of: SyllabusUploadManager.shared.isUploading) { oldValue, newValue in
                if !newValue {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        selectedVaultCategory = "syllabi"
                    }
                }
            }
        }
        .dismissKeyboardOnTap()
    }

    private func importVaultDoc(_ doc: VaultDocument, into target: Course) {
        if let data = doc.rawFileData, !data.isEmpty {
            let stagedURL = PersistentFileStager.stage(data: data, filename: doc.title)
            SyllabusUploadManager.shared.startUpload(urls: [stagedURL], targetCourse: target, modelContext: modelContext)
        } else if let txt = doc.fileContent, !txt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let stagedURL = PersistentFileStager.stage(data: txt.data(using: .utf8) ?? Data(), filename: "\(doc.title).txt")
            SyllabusUploadManager.shared.startUpload(urls: [stagedURL], targetCourse: target, modelContext: modelContext)
        }
    }

    private func importPDFDocuments(_ urls: [URL]) {
        print("🔘 [UI BUTTON TAP] User tapped Import PDF in Repository. Initiating live network pipeline...")

        if APIService.shared.activeAPIKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            repositoryErrorMessage = "API Key Missing: Please enter your Gemini API key in settings."
            showingRepositoryErrorAlert = true
            return
        }

        var tempURLs: [URL] = []
        for url in urls {
            tempURLs.append(PersistentFileStager.stage(url: url))
        }

        let targetCourse = selectedCourseForAddDoc
        withAnimation {
            selectedVaultCategory = "syllabi"
        }
        SyllabusUploadManager.shared.startUpload(urls: tempURLs, targetCourse: targetCourse, modelContext: modelContext)
        selectedCourseForAddDoc = nil
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
                HStack {
                    HStack(spacing: 4) {
                        Text("\(courseCode) — \(courseName)")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                    }

                    Spacer()

                    HStack(spacing: 8) {
                        ShareLink(item: "Course Syllabus: \(document.docTitle)\nInstructor: \(document.instructorContact ?? "")\nOffice Hours: \(document.officeHoursText ?? "")\nGrading: \(document.gradingPolicyText ?? "")") {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 14))
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                        }

                        Button(action: {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                onDelete()
                            }
                        }) {
                            Image(systemName: "trash")
                                .font(.system(size: 15, weight: .regular))
                                .foregroundColor(Color.red.opacity(0.85))
                                .frame(width: 32, height: 32)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
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
    @Query private var allSyllabiDocs: [SyllabusDocument]
    @Query private var allVaultDocs: [VaultDocument]
    @State private var isExpanded: Bool = false

    private var matchingCourse: Course? {
        if let code = document.courseCode?.trimmingCharacters(in: .whitespacesAndNewlines), !code.isEmpty {
            return courses.first(where: { ($0.courseCode ?? "").lowercased() == code.lowercased() || $0.courseName.lowercased().contains(code.lowercased()) })
        }
        return nil
    }

    private var courseColor: Color {
        if let matching = matchingCourse {
            return CourseColorHelper.color(for: matching.hexColor)
        }
        return Color(red: 0.14, green: 0.44, blue: 0.96)
    }

    private var documentColor: Color {
        let index = allVaultDocs.firstIndex(where: { $0.id == document.id }) ?? 0
        let docHex = CourseImporter.getDistinctVaultDocColor(docIndex: index, courseHex: matchingCourse?.hexColor)
        return CourseColorHelper.color(for: docHex)
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
        HStack(spacing: 12) {
            Button(action: onPreview) {
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color(red: 0.49, green: 0.23, blue: 0.93).opacity(0.12))
                            .frame(width: 36, height: 36)
                        Image(systemName: "doc.fill")
                            .font(.system(size: 16))
                            .foregroundColor(Color(red: 0.49, green: 0.23, blue: 0.93))
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(displayTitle)
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            .multilineTextAlignment(.leading)
                            .lineLimit(1)

                        Text(displayCourseCode)
                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            .lineLimit(1)
                    }
                }
            }
            .buttonStyle(.plain)

            Spacer()

            Button(action: onPreview) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.10))
                        .frame(width: 32, height: 32)
                    Image(systemName: "eye.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                }
            }
            .buttonStyle(.plain)

            Button(action: {
                withAnimation(.easeInOut(duration: 0.2)) {
                    onDelete()
                }
            }) {
                Image(systemName: "trash")
                    .font(.system(size: 15, weight: .regular))
                    .foregroundColor(Color.red.opacity(0.85))
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(Color.white)
        .cornerRadius(14)
        .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
        )
    }
}

public struct VaultDocPreviewSheet: View {
    @Environment(\.dismiss) private var dismiss
    public let title: String
    public let fileType: String
    public let courseCode: String?
    public let rawFileData: Data?
    public let fileContent: String?
    public var initialPage: Int? = nil
    public var highlightSearchTerms: [String] = []

    public init(document: VaultDocument, initialPage: Int? = nil, highlightSearchTerms: [String] = [], pdfData: Data? = nil) {
        self.title = document.title
        self.fileType = document.fileType
        self.courseCode = document.courseCode
        self.rawFileData = document.rawFileData
        self.fileContent = document.fileContent
        self.initialPage = initialPage
        self.highlightSearchTerms = highlightSearchTerms
        self._secondaryPDFData = State(initialValue: pdfData)
        let isDirectPdf = (document.rawFileData != nil) && PDFHighlightSnapshotEngine.isValidPDFData(document.rawFileData)
        self._selectedFormat = State(initialValue: isDirectPdf ? 0 : (pdfData != nil ? 1 : 0))
    }

    public init(
        title: String,
        rawFileData: Data?,
        courseCode: String? = nil,
        fileType: String = "PDF",
        fileContent: String? = nil,
        initialPage: Int? = nil,
        highlightSearchTerms: [String] = [],
        pdfData: Data? = nil
    ) {
        self.title = title
        self.fileType = fileType
        self.courseCode = courseCode
        self.rawFileData = rawFileData
        self.fileContent = fileContent
        self.initialPage = initialPage
        self.highlightSearchTerms = highlightSearchTerms
        self._secondaryPDFData = State(initialValue: pdfData)
        let isDirectPdf = (rawFileData != nil) && PDFHighlightSnapshotEngine.isValidPDFData(rawFileData)
        self._selectedFormat = State(initialValue: isDirectPdf ? 0 : (pdfData != nil ? 1 : 0))
    }

    @State private var previewMode: Int = 0 // 0 = Original Document, 1 = Extracted Text
    @State private var secondaryPDFData: Data? = nil
    @State private var selectedFormat: Int = 0 // 0 = Original, 1 = PDF Syllabus

    private var sanitizedTextContent: String {
        let raw = fileContent ?? (rawFileData != nil ? DocumentExtractor.extractTextFromData(rawFileData!, fileName: title) : "")
        let cleaned = raw?.replacingOccurrences(of: #"<[^>]+>"#, with: " ", options: .regularExpression)
                           .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression) ?? ""
        return cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                let isDirectPdf = (rawFileData != nil) &&
                                  (fileType.uppercased() == "PDF" ||
                                   title.lowercased().hasSuffix(".pdf") ||
                                   rawFileData!.starts(with: [0x25, 0x50, 0x44, 0x46])) &&
                                  PDFHighlightSnapshotEngine.isValidPDFData(rawFileData)

                if isDirectPdf, let data = rawFileData {
                    PDFKitView(data: data, initialPage: initialPage, highlightSearchTerms: highlightSearchTerms)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if selectedFormat == 1, let pdf = secondaryPDFData {
                    PDFKitView(data: pdf, initialPage: initialPage, highlightSearchTerms: highlightSearchTerms)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let rawData = rawFileData, !rawData.isEmpty {
                    NativeDocViewer(data: rawData, fileName: title)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let pdf = secondaryPDFData {
                    PDFKitView(data: pdf, initialPage: initialPage, highlightSearchTerms: highlightSearchTerms)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
                                    Text(title)
                                        .font(.system(size: 16, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                    Text("\(fileType) Document • \(courseCode ?? "General")")
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
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle(title)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                let isDirectPdf = (rawFileData != nil) && PDFHighlightSnapshotEngine.isValidPDFData(rawFileData)
                if secondaryPDFData != nil && !isDirectPdf {
                    ToolbarItem(placement: .principal) {
                        Picker("Format", selection: $selectedFormat) {
                            Text(fileType.uppercased()).tag(0)
                            Text("PDF Syllabus").tag(1)
                        }
                        .pickerStyle(.segmented)
                        .frame(maxWidth: 220)
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear {
                let isDirectPdf = (rawFileData != nil) && PDFHighlightSnapshotEngine.isValidPDFData(rawFileData)
                if !isDirectPdf && secondaryPDFData == nil {
                    DispatchQueue.global(qos: .userInitiated).async {
                        if let resolved = PDFHighlightSnapshotEngine.resolvePDFData(
                            course: nil,
                            courseCode: courseCode,
                            courseName: title,
                            preferredDocName: title
                        ), PDFHighlightSnapshotEngine.isValidPDFData(resolved) {
                            DispatchQueue.main.async {
                                self.secondaryPDFData = resolved
                                if self.initialPage != nil {
                                    self.selectedFormat = 1
                                }
                            }
                        }
                    }
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
                    if PDFHighlightSnapshotEngine.isValidPDFData(rawData) {
                        PDFKitView(data: rawData, shouldZoomToHighlight: false)
                    } else {
                        NativeDocViewer(data: rawData, fileName: document.fileName ?? document.docTitle)
                    }
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
    @Environment(\.modelContext) private var modelContext
    public let course: Course
    public let onAddDocument: () -> Void
    public var onAddExistingDocument: (() -> Void)? = nil
    public let onScanDocument: () -> Void
    public let onAddAssignment: () -> Void
    public let onAddReading: () -> Void
    public let onDeleteCourse: () -> Void
    public let onEditCourse: () -> Void
    public let onEditFaculty: () -> Void
    public let onEditAssignment: (Assignment) -> Void
    public let onEditReading: (Reading) -> Void

    @State private var isExpanded: Bool = false
    @State private var showingAnalysisLoadingAlert: Bool = false

    private var isUploading: Bool {
        SyllabusUploadManager.shared.isUploading && SyllabusUploadManager.shared.uploadingCourseIds.contains(course.id)
    }

    private var uploadStatus: String {
        SyllabusUploadManager.shared.status(for: course.id) ?? "Analyzing syllabus..."
    }

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
        let cleanName = displayCourseName.trimmingCharacters(in: .whitespaces)
        return cleanName.isEmpty ? "Course" : cleanName
    }

    public var body: some View {
        VStack(spacing: 0) {
            // MARK: - Header Bar (Matching Readings Section Card Size 1:1)
            HStack(spacing: 10) {
                // Left Single Course Accent Line
                RoundedRectangle(cornerRadius: 3)
                    .fill(courseColor)
                    .frame(width: 4, height: 36)

                VStack(alignment: .leading, spacing: 3) {
                    Text(fullTitle)
                        .font(.cpItemTitle)
                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        .lineLimit(1)

                    if isUploading {
                        Text(uploadStatus)
                            .font(.cpDescriptionMedium)
                            .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                            .lineLimit(1)
                    } else {
                        // Stats summary row (Readings and Assignments)
                        let totalReadings = course.weeks.reduce(0) { $0 + $1.readings.count }
                        HStack(spacing: 4) {
                            Text("\(totalReadings) Readings")
                                .font(.cpDescription)
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                            Text("• \(course.assignments.count) Assignments")
                                .font(.cpDescription)
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }
                        .lineLimit(1)
                    }
                }

                Spacer(minLength: 4)

                // Right Side Action Buttons: Plus Document/Item Menu, Trash, Chevron
                HStack(spacing: 6) {

                    if isUploading {
                        Button(action: {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                SyllabusUploadManager.shared.cancelUpload(forCourseId: course.id)
                            }
                        }) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color.red.opacity(0.12))
                                Image(systemName: "xmark")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(Color.red)
                            }
                            .frame(width: 30, height: 30)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.red.opacity(0.25), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    } else {
                        Menu {
                            Button(action: onAddDocument) {
                                Label("Upload Material / Syllabus", systemImage: "doc.badge.plus")
                            }
                            if let onAddExisting = onAddExistingDocument {
                                Button(action: onAddExisting) {
                                    Label("Add Existing from Vault", systemImage: "folder.fill.badge.plus")
                                }
                            }
                            Button(action: onScanDocument) {
                                Label("Scan with Camera", systemImage: "camera.fill")
                            }
                            Button(action: onAddAssignment) {
                                Label("Add Assignment", systemImage: "checklist")
                            }
                            Button(action: onAddReading) {
                                Label("Add Reading", systemImage: "book.fill")
                            }
                        } label: {
                            ZStack {
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color(red: 0.95, green: 0.96, blue: 0.98))
                                Image(systemName: "plus")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                            }
                            .frame(width: 30, height: 30)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                            )
                        }
                    }

                    // Delete Course Button (Trash)
                    Button(action: onDeleteCourse) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(red: 0.95, green: 0.96, blue: 0.98))
                            Image(systemName: "trash")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(Color(red: 0.85, green: 0.25, blue: 0.20))
                        }
                        .frame(width: 30, height: 30)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)

                    // Expand / Collapse Chevron Dropdown Button
                    Button(action: {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                            isExpanded.toggle()
                        }
                    }) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(red: 0.95, green: 0.96, blue: 0.98))
                            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                        }
                        .frame(width: 30, height: 30)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                        )
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

            // MARK: - Expanded Content Dropdown
            if isExpanded {
                Divider()
                    .padding(.horizontal, 14)

                VStack(alignment: .leading, spacing: 16) {
                    // Explanatory Pill above Course & Faculty Details (No icon)
                    HStack(spacing: 8) {
                        Text("Tap anywhere below to edit course and faculty details")
                            .font(.cpItemTitle)
                            .foregroundColor(Color.black)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(red: 0.94, green: 0.95, blue: 0.97))
                    .cornerRadius(10)

                    // Core Syllabus Header Info & Faculty Container
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Course & Faculty Details")
                            .font(.cpItemTitle)
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                        Button(action: onEditCourse) {
                            VStack(alignment: .leading, spacing: 10) {
                                // Faculty Row (No icon, same font size as assignment titles: .cpItemTitle)
                                HStack(spacing: 6) {
                                    Text("Faculty:")
                                        .font(.cpItemTitle)
                                        .foregroundColor(Color(red: 0.22, green: 0.28, blue: 0.38))

                                    Text((course.instructorName ?? "").isEmpty ? "Not specified" : course.instructorName!)
                                        .font(.cpItemTitle)
                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                        .lineLimit(1)

                                    Spacer()
                                }

                                // Email Row (No icon, same font size as assignment titles: .cpItemTitle)
                                HStack(spacing: 6) {
                                    Text("Email:")
                                        .font(.cpItemTitle)
                                        .foregroundColor(Color(red: 0.22, green: 0.28, blue: 0.38))

                                    Text((course.instructorEmail ?? "").isEmpty ? "Not specified" : course.instructorEmail!)
                                        .font(.cpItemTitle)
                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                        .lineLimit(1)

                                    Spacer()
                                }
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    // Assignments list inside course with Last Plus Action Pill
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Assignments")
                            .font(.cpItemTitle)
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                        VStack(spacing: 8) {
                            ForEach(course.assignments.sorted(by: { ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture) })) { assign in
                                Button(action: { onEditAssignment(assign) }) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        HStack(spacing: 6) {
                                            if assign.weekNumber > 0 {
                                                Text("Week \(assign.weekNumber)")
                                                    .font(.system(size: 11, weight: .bold, design: .rounded))
                                                    .foregroundColor(.white)
                                                    .padding(.horizontal, 7)
                                                    .padding(.vertical, 2.5)
                                                    .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                                    .clipShape(Capsule())
                                            }

                                            if let mod = assign.moduleMention, !mod.isEmpty {
                                                Text(mod)
                                                    .font(.system(size: 11, weight: .bold, design: .rounded))
                                                    .foregroundColor(.white)
                                                    .padding(.horizontal, 7)
                                                    .padding(.vertical, 2.5)
                                                    .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                                    .clipShape(Capsule())
                                            }
                                        }

                                        Text(assign.title)
                                            .font(.cpItemTitle)
                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                            .lineLimit(nil)
                                            .multilineTextAlignment(.leading)

                                        if let due = assign.dueDate {
                                            let fmt = DateFormatter()
                                            let _ = { fmt.dateFormat = "EEEE, MMMM d" }()
                                            Text("Due \(fmt.string(from: due))")
                                                .font(.cpDescription)
                                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                        }
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(10)
                                    .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                                    .cornerRadius(10)
                                }
                                .buttonStyle(.plain)
                            }

                            // Last Pill: Action Pill for Adding an Assignment (Identical size & neutral style to item pills, no subtext)
                            Button(action: {
                                if isUploading {
                                    showingAnalysisLoadingAlert = true
                                } else {
                                    onAddAssignment()
                                }
                            }) {
                                HStack(spacing: 8) {
                                    Image(systemName: "plus")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                    Text("Add Assignment")
                                        .font(.cpItemTitle)
                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                    Spacer()
                                }
                                .padding(10)
                                .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                                .cornerRadius(10)
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    // Readings list organized by week sections
                    let activeWeeks = course.weeks
                        .sorted(by: { $0.weekNumber < $1.weekNumber })
                        .filter { !$0.readings.filter({ !$0.isDeleted }).isEmpty }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Readings")
                            .font(.cpItemTitle)
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                        if activeWeeks.isEmpty {
                            HStack {
                                Text("No readings in this course yet.")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                Spacer()
                            }
                            .padding(10)
                            .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                            .cornerRadius(10)
                        } else {
                            ForEach(activeWeeks, id: \.id) { week in
                                VStack(alignment: .leading, spacing: 6) {
                                    // Week Section Header on top
                                    HStack(spacing: 6) {
                                        Text("Week \(week.weekNumber)")
                                            .font(.system(size: 11, weight: .bold, design: .rounded))
                                            .foregroundColor(.white)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 3)
                                            .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                            .clipShape(Capsule())

                                        if let mod = week.moduleMention, !mod.isEmpty {
                                            Text(mod)
                                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                                .foregroundColor(.white)
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 3)
                                                .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                                .clipShape(Capsule())
                                        }

                                        if let range = week.dateRangeStr, !range.isEmpty, range.lowercased() != "unknown" {
                                            Text(range)
                                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                                .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                        }

                                        Spacer()
                                    }
                                    .padding(.top, 4)

                                    // Readings for this week: "we don't need to put the week next to the title. Let's bring that back."
                                    VStack(spacing: 6) {
                                        ForEach(week.readings.filter({ !$0.isDeleted }), id: \.id) { reading in
                                            Button(action: { onEditReading(reading) }) {
                                                VStack(alignment: .leading, spacing: 4) {
                                                    // Title with Chapter in black before the name
                                                    Text(reading.displayTitleWithChapter)
                                                        .font(.cpItemTitle)
                                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                        .lineLimit(nil)
                                                        .multilineTextAlignment(.leading)

                                                    if let subtitle = reading.authorAndPagesSubtitle, !subtitle.isEmpty {
                                                        Text(subtitle)
                                                            .font(.cpDescriptionMedium)
                                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                    }

                                                    if let explicitDate = reading.dueDate {
                                                        Text(WeekDateConverter.formattedDueDate(for: explicitDate, week: reading.week, weekNumber: week.weekNumber))
                                                            .font(.cpDescription)
                                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                    }
                                                }
                                                .frame(maxWidth: .infinity, alignment: .leading)
                                                .padding(10)
                                                .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                                                .cornerRadius(10)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                }
                            }
                        }

                        // Last Pill: Action Pill for Adding a Reading (Identical size & neutral style to item pills, no subtext)
                        Button(action: {
                            if isUploading {
                                showingAnalysisLoadingAlert = true
                            } else {
                                onAddReading()
                            }
                        }) {
                            HStack(spacing: 8) {
                                Image(systemName: "plus")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                Text("Add Reading")
                                    .font(.cpItemTitle)
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                Spacer()
                            }
                            .padding(10)
                            .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                            .cornerRadius(10)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .transition(.opacity)
                .clipped()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .cornerRadius(16)
        .onAppear {
            if (course.instructorName ?? "").isEmpty || (course.instructorEmail ?? "").isEmpty {
                for doc in course.syllabusDocs {
                    var text = ""
                    if let data = doc.rawFileData, let pdf = PDFDocument(data: data) {
                        text = (0..<min(4, pdf.pageCount)).compactMap { pdf.page(at: $0)?.string }.joined(separator: "\n")
                    }
                    if text.isEmpty, let content = doc.instructorContact, !content.isEmpty {
                        text = content
                    }
                    if !text.isEmpty {
                        let (name, email) = FacultyExtractor.extractFaculty(from: text)
                        if (course.instructorName ?? "").isEmpty, let name = name {
                            course.instructorName = name
                        }
                        if (course.instructorEmail ?? "").isEmpty, let email = email {
                            course.instructorEmail = email
                        }
                    }
                }
            }

            // 1. Chapter and pages extraction from reading titles if missing
            for week in course.weeks {
                for reading in week.readings {
                    if (reading.chapterText ?? "").isEmpty {
                        let (ch, pg) = LocalSyllabusParser.shared.extractChapterAndPages(from: reading.title)
                        if let ch = ch, !ch.isEmpty {
                            reading.chapterText = ch
                            reading.title = CourseImporter.cleanAndSummarizeTitle(reading.title, isReading: true, courseCode: course.courseCode, courseName: course.courseName)
                        }
                        if (reading.pagesText ?? "").isEmpty, let pg = pg, !pg.isEmpty {
                            reading.pagesText = pg
                        }
                    }
                }
            }

            // 2. Module enrichment - ONLY if the course document explicitly contains modules
            if course.hasDocumentModules {
                let needsModuleCheck = course.weeks.contains(where: { ($0.theme ?? "").isEmpty || !($0.theme ?? "").lowercased().contains("module") })
                if needsModuleCheck {
                    var docText = ""
                    for doc in course.syllabusDocs {
                        if let data = doc.rawFileData, let pdf = PDFDocument(data: data) {
                            docText += (0..<pdf.pageCount).compactMap { pdf.page(at: $0)?.string }.joined(separator: "\n") + "\n"
                        }
                    }
                    if !docText.isEmpty {
                        let (wMap, itemMap) = ModuleExtractor.extractModulesFromText(docText)
                        for week in course.weeks {
                            if let mod = wMap[week.weekNumber] {
                                if let existing = week.theme, !existing.isEmpty {
                                    if !existing.lowercased().contains("module") {
                                        week.theme = "\(mod) - \(existing)"
                                    }
                                } else {
                                    week.theme = mod
                                }
                            }
                            for reading in week.readings {
                                let wNum = reading.week?.weekNumber ?? week.weekNumber
                                let mod = wMap[wNum] ?? itemMap[reading.title.lowercased()]
                                if let mod = mod, !mod.isEmpty {
                                    if let topics = reading.relevantTopics, !topics.isEmpty {
                                        if !topics.lowercased().contains("module") {
                                            reading.relevantTopics = "\(mod), \(topics)"
                                        }
                                    } else {
                                        reading.relevantTopics = mod
                                    }
                                }
                            }
                        }
                        for assignment in course.assignments {
                            let wNum = assignment.weekNumber
                            let mod = wMap[wNum] ?? itemMap[assignment.title.lowercased()]
                            if let mod = mod, !mod.isEmpty {
                                if let topics = assignment.relevantTopics, !topics.isEmpty {
                                    if !topics.lowercased().contains("module") {
                                        assignment.relevantTopics = "\(mod), \(topics)"
                                    }
                                } else {
                                    assignment.relevantTopics = mod
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Continuous Looping Progress Bar
public struct ContinuousProgressBar: View {
    @State private var animProgress: CGFloat = 0.0

    public init() {}

    public var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.20))

                Capsule()
                    .fill(Color(red: 0.14, green: 0.44, blue: 0.96))
                    .frame(width: max(6, geo.size.width * animProgress))
            }
        }
        .frame(height: 6)
        .onAppear {
            animProgress = 0.0
            withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: false)) {
                animProgress = 1.0
            }
        }
    }
}

// MARK: - Edit Course Modal View
public struct EditCourseModalView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    public let course: Course

    @State private var courseName: String
    @State private var courseCode: String
    @FocusState private var isFocused: Bool

    public init(course: Course) {
        self.course = course
        _courseName = State(initialValue: course.courseName)
        _courseCode = State(initialValue: course.courseCode ?? "")
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Course Information")) {
                    TextField("Course Name", text: $courseName)
                        .focused($isFocused)
                    TextField("Course Code", text: $courseCode)
                }
            }
            .navigationTitle("Edit Course Title & Code")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let cleanName = courseName.trimmingCharacters(in: .whitespacesAndNewlines)
                        let cleanCode = courseCode.trimmingCharacters(in: .whitespacesAndNewlines)

                        if !cleanName.isEmpty { course.courseName = cleanName }
                        if !cleanCode.isEmpty { course.courseCode = cleanCode }
                        try? modelContext.save()
                        dismiss()
                    }
                    .bold()
                }
            }
            .task {
                isFocused = true
            }
        }
        #if os(iOS)
        .presentationDetents([.height(230)])
        #endif
    }
}

// MARK: - Edit Faculty Modal View
public struct EditFacultyModalView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    public let course: Course

    @State private var instructorName: String
    @State private var instructorEmail: String
    @FocusState private var isFocused: Bool

    public init(course: Course) {
        self.course = course
        _instructorName = State(initialValue: course.instructorName ?? "")
        _instructorEmail = State(initialValue: course.instructorEmail ?? "")
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Faculty Contact Information")) {
                    TextField("Primary Faculty", text: $instructorName)
                        .focused($isFocused)
                    TextField("Faculty Email", text: $instructorEmail)
                        #if os(iOS)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        #endif
                }
            }
            .navigationTitle("Edit Faculty & Contact")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let cleanFaculty = instructorName.trimmingCharacters(in: .whitespacesAndNewlines)
                        let cleanEmail = instructorEmail.trimmingCharacters(in: .whitespacesAndNewlines)
                        course.instructorName = cleanFaculty
                        course.instructorEmail = cleanEmail
                        try? modelContext.save()
                        dismiss()
                    }
                    .bold()
                }
            }
            .task {
                isFocused = true
            }
        }
        #if os(iOS)
        .presentationDetents([.height(230)])
        #endif
    }
}

// MARK: - Edit Assignment Modal View
public struct EditAssignmentModalView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    public let assignment: Assignment

    @State private var title: String
    @State private var instructions: String
    @FocusState private var isFocused: Bool

    public init(assignment: Assignment) {
        self.assignment = assignment
        _title = State(initialValue: assignment.title)
        _instructions = State(initialValue: assignment.fullInstructions ?? "")
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Assignment Title")) {
                    TextField("Title", text: $title)
                        .focused($isFocused)
                }
                Section(header: Text("Instructions & Details")) {
                    TextEditor(text: $instructions)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Edit Assignment")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !cleanTitle.isEmpty { assignment.title = cleanTitle }
                        assignment.fullInstructions = instructions.trimmingCharacters(in: .whitespacesAndNewlines)
                        try? modelContext.save()
                        dismiss()
                    }
                    .bold()
                }
            }
            .task {
                isFocused = true
            }
        }
        #if os(iOS)
        .presentationDetents([.height(310)])
        #endif
    }
}

// MARK: - Edit Reading Modal View
public struct EditReadingModalView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    public let reading: Reading

    @State private var title: String
    @State private var summary: String
    @FocusState private var isFocused: Bool

    public init(reading: Reading) {
        self.reading = reading
        _title = State(initialValue: reading.title)
        _summary = State(initialValue: reading.summaryText)
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Reading Title")) {
                    TextField("Title", text: $title)
                        .focused($isFocused)
                }
                Section(header: Text("Summary & Notes")) {
                    TextEditor(text: $summary)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Edit Reading")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !cleanTitle.isEmpty { reading.title = cleanTitle }
                        reading.summaryText = summary.trimmingCharacters(in: .whitespacesAndNewlines)
                        try? modelContext.save()
                        dismiss()
                    }
                    .bold()
                }
            }
            .task {
                isFocused = true
            }
        }
        #if os(iOS)
        .presentationDetents([.height(310)])
        #endif
    }
}
