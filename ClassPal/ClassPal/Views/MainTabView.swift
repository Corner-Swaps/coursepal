import SwiftUI
import SwiftData
import UniformTypeIdentifiers
import PDFKit

public struct MainTabView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Course.createdAt, order: .reverse) private var courses: [Course]

    @State private var selectedTab: String = "assignments"
    @State private var showingAddChoiceModal: Bool = false
    @State private var showingAddTaskModal: Bool = false
    @State private var showingUploadDocModal: Bool = false
    @State private var showingAddCourseModal: Bool = false
    @State private var showingScanSheet: Bool = false

    public init() {}

    public var body: some View {
        ZStack(alignment: .bottom) {
            // Main Tab Content Area
            Group {
                switch selectedTab {
                case "readings":
                    WeeklyDashboardView()
                case "assignments":
                    AssignmentsView()
                case "syllabus", "vault":
                    SyllabusRepositoryView(showingUploadModal: $showingUploadDocModal)
                case "share", "invite":
                    ShareCenterView()
                default:
                    WeeklyDashboardView()
                }
            }

            // MARK: - Custom Floating Bottom Navigation Bar (Hidden when modals are active)
            if !showingAddChoiceModal && !showingUploadDocModal {
                ZStack(alignment: .center) {
                    // Pill Background Bar
                    HStack(spacing: 0) {
                        // Tab 1: Readings (First)
                        Button(action: { selectedTab = "readings" }) {
                            VStack(spacing: 3) {
                                Image(systemName: "book.fill")
                                    .font(.system(size: 18, weight: selectedTab == "readings" ? .bold : .medium))
                                    .frame(width: 24, height: 22)
                                Text("Readings")
                                    .font(.system(size: 10, weight: selectedTab == "readings" ? .bold : .medium))
                                    .frame(height: 12)
                            }
                            .foregroundColor(selectedTab == "readings" ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.45, green: 0.52, blue: 0.62))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                        }
                        .buttonStyle(.plain)

                        // Tab 2: Assignments (Second)
                        Button(action: { selectedTab = "assignments" }) {
                            VStack(spacing: 3) {
                                Image(systemName: "calendar")
                                    .font(.system(size: 18, weight: selectedTab == "assignments" ? .bold : .medium))
                                    .frame(width: 24, height: 22)
                                Text("Assignments")
                                    .font(.system(size: 10, weight: selectedTab == "assignments" ? .bold : .medium))
                                    .frame(height: 12)
                            }
                            .foregroundColor(selectedTab == "assignments" ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.45, green: 0.52, blue: 0.62))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                        }
                        .buttonStyle(.plain)

                        // Empty slot spacer for central floating button (+)
                        Spacer()
                            .frame(maxWidth: .infinity)

                        // Tab 3: Syllabus (Fourth item)
                        Button(action: { selectedTab = "syllabus" }) {
                            VStack(spacing: 3) {
                                Image(systemName: "folder.fill")
                                    .font(.system(size: 18, weight: (selectedTab == "syllabus" || selectedTab == "vault") ? .bold : .medium))
                                    .frame(width: 24, height: 22)
                                Text("Syllabus")
                                    .font(.system(size: 10, weight: (selectedTab == "syllabus" || selectedTab == "vault") ? .bold : .medium))
                                    .frame(height: 12)
                            }
                            .foregroundColor((selectedTab == "syllabus" || selectedTab == "vault") ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.45, green: 0.52, blue: 0.62))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                        }
                        .buttonStyle(.plain)

                        // Tab 4: Invite (Fifth item)
                        Button(action: { selectedTab = "invite" }) {
                            VStack(spacing: 3) {
                                Image(systemName: "person.2.fill")
                                    .font(.system(size: 18, weight: selectedTab == "invite" ? .bold : .medium))
                                    .frame(width: 24, height: 22)
                                Text("Invite")
                                    .font(.system(size: 10, weight: selectedTab == "invite" ? .bold : .medium))
                                    .frame(height: 12)
                            }
                            .foregroundColor(selectedTab == "invite" ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.45, green: 0.52, blue: 0.62))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.98))
                    .cornerRadius(28)
                    .overlay(
                        RoundedRectangle(cornerRadius: 28)
                            .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                    )
                    .shadow(color: Color.black.opacity(0.08), radius: 14, x: 0, y: 6)

                    // Elevated Floating Add (+) Button (Cleanly floating over pill with white ring border)
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showingAddChoiceModal = true
                        }
                    }) {
                        ZStack {
                            // Outer White Ring Container
                            Circle()
                                .fill(Color.white)
                                .frame(width: 56, height: 56)
                                .shadow(color: Color.black.opacity(0.12), radius: 6, x: 0, y: 3)

                            // Inner Blue Gradient Circle
                            Circle()
                                .fill(LinearGradient(colors: [Color(red: 0.22, green: 0.52, blue: 0.98), Color(red: 0.14, green: 0.44, blue: 0.96)], startPoint: .top, endPoint: .bottom))
                                .frame(width: 44, height: 44)

                            Image(systemName: "plus")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }
                    .buttonStyle(.plain)
                    .offset(y: -18)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, -18)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            // MARK: - Edge-to-Edge Custom Bottom Modals (0 Space Left, Right & Bottom)
            if showingAddChoiceModal {
                ZStack(alignment: .bottom) {
                    Color.black.opacity(0.35)
                        .ignoresSafeArea()
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                showingAddChoiceModal = false
                            }
                        }

                    VStack(spacing: 0) {
                        Spacer()
                        AddNewItemModalView(
                            onAddTask: {
                                showingAddChoiceModal = false
                                showingAddTaskModal = true
                            },
                            onCreateCourse: {
                                showingAddChoiceModal = false
                                showingAddCourseModal = true
                            }
                        )
                    }
                    .ignoresSafeArea(edges: .bottom)
                }
                .transition(.opacity)
                .zIndex(100)
            }

            if showingUploadDocModal {
                ZStack(alignment: .bottom) {
                    Color.black.opacity(0.35)
                        .ignoresSafeArea()
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                showingUploadDocModal = false
                            }
                        }

                    VStack(spacing: 0) {
                        Spacer()
                        UploadDocModalView()
                    }
                    .ignoresSafeArea(edges: .bottom)
                }
                .transition(.opacity)
                .zIndex(100)
            }
        }
        #if os(iOS)
        .fullScreenCover(isPresented: $showingScanSheet) {
            SyllabusScanView()
        }
        #else
        .sheet(isPresented: $showingScanSheet) {
            SyllabusScanView()
        }
        #endif
        .sheet(isPresented: $showingAddTaskModal) {
            AddTaskModalView()
        }
        #if os(iOS)
        .fullScreenCover(isPresented: $showingAddCourseModal) {
            AddCourseModalView(onCourseCreated: {
                withAnimation {
                    selectedTab = "readings"
                }
            })
        }
        #else
        .sheet(isPresented: $showingAddCourseModal) {
            AddCourseModalView(onCourseCreated: {
                withAnimation {
                    selectedTab = "readings"
                }
            })
        }
        #endif
        #if os(iOS)
        .ignoresSafeArea(.keyboard, edges: .bottom)
        #endif
        .dismissKeyboardOnTap()
        .onOpenURL { url in
            let code = ShareCenterView.extractCourseCode(from: url.absoluteString)
            if !code.isEmpty {
                selectedTab = "invite"
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                    NotificationCenter.default.post(name: NSNotification.Name("ClassPalOpenJoinCode"), object: code)
                }
            }
        }
        .onAppear {
            sanitizeDatabase()
        }
    }

    private func sanitizeDatabase() {
        let palette = [
            "#2563EB", // Vibrant Blue
            "#16A34A", // Vibrant Green
            "#9333EA", // Vibrant Purple
            "#EA580C", // Vibrant Orange
            "#0D9488", // Vibrant Teal
            "#DB2777", // Vibrant Pink
            "#4F46E5", // Vibrant Indigo
            "#D97706", // Vibrant Amber
            "#0284C7", // Vibrant Cyan
            "#7C3AED"  // Vibrant Violet
        ]

        for (idx, course) in courses.enumerated() {
            let assigned = palette[idx % palette.count]
            course.hexColor = assigned
        }

        for course in courses {
            for week in course.weeks {
                for reading in week.readings {
                    if let rawKey = reading.keyTakeawaysText {
                        let cleaned = rawKey
                            .replacingOccurrences(of: #"(?i)•?\s*(?:prompt|category|target|description)\s*:\s*"#, with: "• ", options: .regularExpression)
                            .replacingOccurrences(of: #"\n\s*\n"#, with: "\n", options: .regularExpression)
                        reading.keyTakeawaysText = cleaned
                    }
                }
            }
        }

        try? modelContext.save()
    }
}

// MARK: - Modals for Adding Content

public struct AddTaskModalView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Course.createdAt, order: .reverse) private var courses: [Course]

    @State private var taskTitle: String = ""
    @State private var itemCategory: Int = 0 // 0: Assignment, 1: Reading
    @State private var selectedCourse: Course? = nil
    @State private var weekNumber: Int = 1
    @State private var dueDate: Date = Date().addingTimeInterval(86400 * 7)
    @State private var pointsPossibleVal: Int = 100
    @State private var gradeWeightPercent: Int = 10
    @State private var selectedMediaType: MediaType = .textbook
    @State private var notesText: String = ""
    @State private var videoUrlText: String = ""
    @State private var isSyncing: Bool = false

    public var body: some View {
        NavigationStack {
            Form {
                // Section 1: Item Type & Primary Title (No duplicate inner section header)
                Section {
                    Picker("Item Type", selection: $itemCategory) {
                        Text("Assignment").tag(0)
                        Text("Reading").tag(1)
                    }
                    .pickerStyle(.segmented)

                    TextField(itemCategory == 1 ? "Reading Title (e.g. Chapter 1 Sexuality)" : "Assignment Title (e.g. Research Study Design)", text: $taskTitle)
                        .font(.system(size: 15, weight: .semibold, design: .rounded))

                    if !courses.isEmpty {
                        Picker("Course Name", selection: $selectedCourse) {
                            Text("Unassigned").tag(Course?.none)
                            ForEach(courses) { course in
                                let display = (course.courseCode != nil && !course.courseCode!.isEmpty && course.courseCode != course.courseName)
                                    ? "\(course.courseCode!): \(course.courseName)"
                                    : course.courseName
                                Text(display).tag(Course?.some(course))
                            }
                        }
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                    }
                }

                // Section 2: Week & Due Date Schedule
                Section("Schedule") {
                    Picker("Week", selection: $weekNumber) {
                        ForEach(1...20, id: \.self) { w in
                            Text("Week \(w)").tag(w)
                        }
                    }
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .pickerStyle(.menu)
                    .onChange(of: weekNumber) { _, newW in
                        guard !isSyncing else { return }
                        isSyncing = true
                        dueDate = WeekDateConverter.date(forWeek: newW)
                        isSyncing = false
                    }

                    DatePicker("Due Date", selection: $dueDate, displayedComponents: [.date, .hourAndMinute])
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .onChange(of: dueDate) { _, newDate in
                            guard !isSyncing else { return }
                            isSyncing = true
                            weekNumber = WeekDateConverter.weekNumber(for: newDate)
                            isSyncing = false
                        }
                }

                // Section 3: Dynamic Fields Relevant to Item Type
                if itemCategory == 0 {
                    // Assignment Fields: Points & Grade Weight
                    Section("Points & Grade Weight") {
                        Picker("Points Possible", selection: $pointsPossibleVal) {
                            ForEach(Array(stride(from: 0, through: 500, by: 5)), id: \.self) { pts in
                                Text("\(pts) Points").tag(pts)
                            }
                        }
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .pickerStyle(.menu)

                        Picker("Grade Weight", selection: $gradeWeightPercent) {
                            ForEach(0...100, id: \.self) { pct in
                                Text("\(pct)%").tag(pct)
                            }
                        }
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .pickerStyle(.menu)
                    }
                } else {
                    // Reading Fields: Media Type & Link
                    Section("Media & Link") {
                        Picker("Media Type", selection: $selectedMediaType) {
                            Text("Textbook").tag(MediaType.textbook)
                            Text("Video").tag(MediaType.video)
                            Text("Podcast").tag(MediaType.podcast)
                            Text("Article / Paper").tag(MediaType.article)
                        }
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .pickerStyle(.menu)

                        TextField("Paste video or article URL (optional)...", text: $videoUrlText)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))

                        if URLHelper.isValidURL(videoUrlText), let url = URLHelper.formatURL(videoUrlText) {
                            Link(destination: url) {
                                HStack(spacing: 4) {
                                    Image(systemName: "link.circle.fill")
                                        .font(.system(size: 12, weight: .bold))
                                    Text(url.absoluteString)
                                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                                        .lineLimit(1)
                                    Image(systemName: "arrow.up.right.square")
                                        .font(.system(size: 11, weight: .bold))
                                }
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                .padding(.vertical, 4)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                // Section 4: Notes Section (Double Size Input Pill)
                Section("Notes") {
                    TextField("Instructions & Notes...", text: $notesText, axis: .vertical)
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .lineLimit(6...14)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color(red: 0.95, green: 0.96, blue: 0.98))
            .scrollDismissesKeyboard(.immediately)
            .onAppear {
                if selectedCourse == nil {
                    selectedCourse = courses.first
                }
            }
            .navigationTitle("Details")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color(red: 0.95, green: 0.96, blue: 0.98), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveTask()
                    }
                    .bold()
                    .disabled(taskTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .dismissKeyboardOnTap()
    }

    private func saveTask() {
        let title = taskTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }

        let activeCourse: Course
        if let chosen = selectedCourse {
            activeCourse = chosen
        } else if let existing = courses.first {
            activeCourse = existing
        } else {
            let defaultCourse = Course(
                courseName: "General Course",
                courseCode: "GEN 101",
                hexColor: "#2563EB",
                termWeeks: 16,
                sharingCode: "GEN-101"
            )
            for w in 1...16 {
                let wk = Week(weekNumber: w, theme: "Week \(w) Overview")
                wk.course = defaultCourse
                defaultCourse.weeks.append(wk)
            }
            modelContext.insert(defaultCourse)
            activeCourse = defaultCourse
        }

        let targetWeek: Week
        if let wk = activeCourse.weeks.first(where: { $0.weekNumber == weekNumber }) {
            targetWeek = wk
        } else {
            let newWk = Week(weekNumber: weekNumber, theme: "Week \(weekNumber) Schedule")
            newWk.course = activeCourse
            activeCourse.weeks.append(newWk)
            targetWeek = newWk
        }

        let cleanNotes = notesText.trimmingCharacters(in: .whitespaces)
        let cleanUrl = videoUrlText.trimmingCharacters(in: .whitespaces)

        if itemCategory == 1 {
            // Save Reading
            let validUrl = URLHelper.isValidURL(cleanUrl) ? cleanUrl : nil
            let mediaType: MediaType = (validUrl != nil) ? .video : .textbook
            let newReading = Reading(
                title: title,
                mediaType: mediaType,
                isCompleted: false,
                summaryText: cleanNotes.isEmpty ? "Required reading for \(title)." : cleanNotes,
                keyTakeawaysText: "• Review \(title)",
                estimatedTimeText: mediaType == .video ? "~20–30 min" : "~40–60 min",
                videoUrl: validUrl,
                dueDate: dueDate
            )
            newReading.week = targetWeek
            targetWeek.readings.append(newReading)
            modelContext.insert(newReading)
        } else {
            // Save Assignment
            let newAssignment = Assignment(
                title: title,
                weekNumber: weekNumber,
                dueDate: dueDate,
                pointsPossible: "\(pointsPossibleVal) Points",
                noteText: cleanNotes.isEmpty ? nil : cleanNotes,
                isCompleted: false,
                weightPercentage: "\(gradeWeightPercent)%"
            )
            newAssignment.course = activeCourse
            modelContext.insert(newAssignment)
        }

        try? modelContext.save()
        dismiss()
    }
}

public struct UploadDocModalView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Course.createdAt, order: .reverse) private var courses: [Course]

    public var onClose: (() -> Void)? = nil

    @Query private var vaultDocs: [VaultDocument]
    @State private var showingFileImporter: Bool = false
    @State private var showingCameraScanner: Bool = false
    @State private var showingVaultSelector: Bool = false
    @State private var pendingImportURLs: [URL] = []
    @State private var selectedURLIDs: Set<URL> = []
    @State private var isProcessingUpload: Bool = false

    public init(onClose: (() -> Void)? = nil) {
        self.onClose = onClose
    }

    public var body: some View {
        VStack(spacing: 16) {
            // Drag Handle Pill
            Capsule()
                .fill(Color(red: 0.78, green: 0.82, blue: 0.88))
                .frame(width: 36, height: 5)
                .padding(.top, 14)

            if !pendingImportURLs.isEmpty {
                // MARK: - Multi-PDF Selection Screen with Checkmark Selection Circles
                VStack(spacing: 14) {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Select PDFs to Import")
                                .font(.system(size: 19, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("\(selectedURLIDs.count) of \(pendingImportURLs.count) PDF files selected")
                                .font(.system(size: 12.5, weight: .medium))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }
                        Spacer()
                        Button(action: {
                            if selectedURLIDs.count == pendingImportURLs.count {
                                selectedURLIDs.removeAll()
                            } else {
                                selectedURLIDs = Set(pendingImportURLs)
                            }
                        }) {
                            Text(selectedURLIDs.count == pendingImportURLs.count ? "Deselect All" : "Select All")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 20)

                    ScrollView {
                        VStack(spacing: 10) {
                            ForEach(pendingImportURLs, id: \.self) { fileUrl in
                                let isSelected = selectedURLIDs.contains(fileUrl)
                                HStack(spacing: 12) {
                                    // Selection Circle Icon (Checkmark circle vs empty circle)
                                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                        .font(.system(size: 22, weight: .semibold))
                                        .foregroundColor(isSelected ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.70, green: 0.75, blue: 0.82))

                                    // File PDF Icon & Name
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Color(red: 0.92, green: 0.95, blue: 1.0))
                                            .frame(width: 36, height: 36)
                                        Image(systemName: "doc.fill")
                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    }

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(fileUrl.lastPathComponent)
                                            .font(.system(size: 13.5, weight: .bold))
                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                            .lineLimit(1)
                                        Text("PDF Document")
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    }
                                    Spacer()
                                }
                                .padding(12)
                                .background(Color.white)
                                .cornerRadius(14)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14)
                                        .stroke(isSelected ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: isSelected ? 1.5 : 1)
                                )
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    if isSelected {
                                        selectedURLIDs.remove(fileUrl)
                                    } else {
                                        selectedURLIDs.insert(fileUrl)
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                    .frame(maxHeight: 240)

                    // Action Buttons
                    HStack(spacing: 12) {
                        Button(action: {
                            pendingImportURLs.removeAll()
                            selectedURLIDs.removeAll()
                        }) {
                            Text("Cancel")
                                .font(.system(size: 14.5, weight: .semibold))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 13)
                                .background(Color(red: 0.92, green: 0.94, blue: 0.96))
                                .cornerRadius(14)
                        }
                        .buttonStyle(.plain)

                        Button(action: {
                            let filesToProcess = pendingImportURLs.filter { selectedURLIDs.contains($0) }
                            pendingImportURLs.removeAll()
                            confirmAndProcessFiles(filesToProcess)
                        }) {
                            HStack(spacing: 6) {
                                if isProcessingUpload {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Image(systemName: "arrow.up.doc.fill")
                                        .font(.system(size: 14, weight: .bold))
                                    Text("Upload \(selectedURLIDs.count) PDF\(selectedURLIDs.count == 1 ? "" : "s")")
                                        .font(.system(size: 14.5, weight: .bold))
                                }
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(selectedURLIDs.isEmpty ? Color.gray : Color(red: 0.14, green: 0.44, blue: 0.96))
                            .cornerRadius(14)
                        }
                        .disabled(selectedURLIDs.isEmpty || isProcessingUpload)
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 14)
                }
            } else {
                // Header: Title & Close x Button
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Upload Document")
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        Text("Select multiple PDF documents or scan with camera")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    }
                    Spacer()
                    Button(action: {
                        onClose?()
                        dismiss()
                    }) {
                        ZStack {
                            Circle()
                                .fill(Color(red: 0.93, green: 0.95, blue: 0.97))
                                .frame(width: 30, height: 30)
                            Image(systemName: "xmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 4)

                let totalCount = vaultDocs.isEmpty ? 3 : 4

                VStack(spacing: 14) {
                    // Choice 1: Select PDF / Documents (Supports Multiple Selection)
                    Button(action: { showingFileImporter = true }) {
                        HStack(spacing: 14) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    .frame(width: 40, height: 40)
                                Image(systemName: "doc.badge.plus")
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(.white)
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Select Multiple PDF Files")
                                    .font(.system(size: 14.5, weight: .bold))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                Text("1 of \(totalCount) • Select 1, 2, or more PDFs simultaneously")
                                    .font(.system(size: 12))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity)
                        .background(Color.white)
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                        )
                        .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                    }
                    .buttonStyle(.plain)

                    // Choice 2 (Only if Vault Documents exist): Choose Saved Document from Vault
                    if !vaultDocs.isEmpty {
                        Button(action: { showingVaultSelector = true }) {
                            HStack(spacing: 14) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(Color(red: 0.58, green: 0.32, blue: 0.92))
                                        .frame(width: 40, height: 40)
                                    Image(systemName: "folder.fill.badge.plus")
                                        .font(.system(size: 18, weight: .bold))
                                        .foregroundColor(.white)
                                }

                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 6) {
                                        Text("Choose Saved Document from Vault")
                                            .font(.system(size: 14.5, weight: .bold))
                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                        Text("(\(vaultDocs.count))")
                                            .font(.system(size: 12, weight: .bold, design: .rounded))
                                            .foregroundColor(Color(red: 0.58, green: 0.32, blue: 0.92))
                                    }
                                    Text("2 of 4 • Select from \(vaultDocs.count) saved documents in repository")
                                        .font(.system(size: 12))
                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                }

                                Spacer()

                                Image(systemName: "chevron.right")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity)
                            .background(Color.white)
                            .cornerRadius(16)
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                            )
                            .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                        }
                        .buttonStyle(.plain)
                    }

                    // Choice 3 (or 2 if no vault docs): Scan Document with Camera
                    let cameraChoiceNum = vaultDocs.isEmpty ? 2 : 3
                    Button(action: { showingCameraScanner = true }) {
                        HStack(spacing: 14) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color(red: 0.06, green: 0.73, blue: 0.50))
                                    .frame(width: 40, height: 40)
                                Image(systemName: "camera.fill")
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(.white)
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Scan with Camera")
                                    .font(.system(size: 14.5, weight: .bold))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                Text("\(cameraChoiceNum) of \(totalCount) • Snap photos of physical document or syllabus")
                                    .font(.system(size: 12))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity)
                        .background(Color.white)
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                        )
                        .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 40)
        .background(Color(red: 0.95, green: 0.96, blue: 0.98))
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 24, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 24))
        .ignoresSafeArea(edges: .bottom)
        .sheet(isPresented: $showingVaultSelector) {
            NavigationStack {
                List {
                    if vaultDocs.isEmpty {
                        Text("No saved documents found in Vault.")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    } else {
                        ForEach(vaultDocs) { doc in
                            Button(action: {
                                showingVaultSelector = false
                                parseAndImportVaultDoc(doc)
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
                                    Image(systemName: "arrow.right.circle.fill")
                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                }
                                .padding(.vertical, 4)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .navigationTitle("Select Saved Document")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showingVaultSelector = false }
                    }
                }
            }
        }
        .sheet(isPresented: $showingCameraScanner) {
            SyllabusScanView()
        }
        .fileImporter(isPresented: $showingFileImporter, allowedContentTypes: [.pdf, .plainText, .item], allowsMultipleSelection: true) { result in
            if case .success(let urls) = result {
                stageImportURLs(urls)
            }
        }
    }

    private func stageImportURLs(_ urls: [URL]) {
        guard !urls.isEmpty else { return }
        pendingImportURLs = urls
        selectedURLIDs = Set(urls)
    }

    private func confirmAndProcessFiles(_ urls: [URL]) {
        guard !urls.isEmpty else {
            onClose?()
            dismiss()
            return
        }
        isProcessingUpload = true
        Task { @MainActor in
            for selectedUrl in urls {
                var fileSizeLabel = "Unknown"
                let accessed = selectedUrl.startAccessingSecurityScopedResource()
                defer { if accessed { selectedUrl.stopAccessingSecurityScopedResource() } }

                let fileData = try? Data(contentsOf: selectedUrl)
                if let bytes = fileData?.count {
                    if bytes < 1024 {
                        fileSizeLabel = "\(bytes) B"
                    } else if bytes < 1_048_576 {
                        fileSizeLabel = String(format: "%.1f KB", Double(bytes) / 1024.0)
                    } else {
                        fileSizeLabel = String(format: "%.1f MB", Double(bytes) / 1_048_576.0)
                    }
                }

                var contentText: String? = nil
                if let textContent = try? String(contentsOf: selectedUrl, encoding: .utf8), !textContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    contentText = textContent
                } else if let data = fileData, let pdfDoc = PDFDocument(data: data) {
                    var pagesText: [String] = []
                    for i in 0..<pdfDoc.pageCount {
                        if let page = pdfDoc.page(at: i), let pageStr = page.string, pageStr.trimmingCharacters(in: .whitespacesAndNewlines).count > 10 {
                            pagesText.append(pageStr)
                        }
                    }
                    if !pagesText.isEmpty {
                        contentText = pagesText.joined(separator: "\n\n")
                    }

                    // If PDF text extraction yielded empty/minimal text (scanned PDF), run Vision OCR on rendered PDF pages!
                    if contentText == nil || contentText!.trimmingCharacters(in: .whitespacesAndNewlines).count < 30 {
                        #if canImport(UIKit)
                        var ocrPagesText: [String] = []
                        for i in 0..<min(pdfDoc.pageCount, 15) {
                            if let page = pdfDoc.page(at: i) {
                                let pageRect = page.bounds(for: .mediaBox)
                                let renderer = UIGraphicsImageRenderer(size: pageRect.size)
                                let img = renderer.image { ctx in
                                    UIColor.white.set()
                                    ctx.fill(pageRect)
                                    ctx.cgContext.translateBy(x: 0.0, y: pageRect.size.height)
                                    ctx.cgContext.scaleBy(x: 1.0, y: -1.0)
                                    page.draw(with: .mediaBox, to: ctx.cgContext)
                                }
                                if let pageOcrText = try? await LocalSyllabusParser.shared.extractTextFromImage(img), !pageOcrText.isEmpty {
                                    ocrPagesText.append(pageOcrText)
                                }
                            }
                        }
                        if !ocrPagesText.isEmpty {
                            contentText = ocrPagesText.joined(separator: "\n\n")
                        }
                        #endif
                    }
                }

                let ext = selectedUrl.pathExtension.uppercased()
                let fileType = ext == "PDF" ? "PDF" : (ext.isEmpty ? "Document" : ext)
                let textToParse = (contentText != nil && !contentText!.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) ? contentText! : selectedUrl.lastPathComponent
                let dto = (try? await APIService.shared.parseSyllabusText(textToParse)) ?? LocalSyllabusParser.shared.parseText(textToParse)
                CourseImporter.importDTO(dto, into: modelContext)
                let createdCourse = courses.first(where: { $0.courseCode == dto.courseCode || $0.courseName == dto.courseName }) ?? courses.first

                let syllabusDoc = SyllabusDocument(
                    docTitle: "\(dto.courseCode ?? "CRS"): \(dto.courseName) Syllabus",
                    officeHoursText: nil,
                    instructorContact: nil,
                    gradingPolicyText: nil,
                    fileName: selectedUrl.lastPathComponent,
                    rawFileData: fileData
                )
                syllabusDoc.course = createdCourse
                modelContext.insert(syllabusDoc)
            }
            isProcessingUpload = false
            try? modelContext.save()
            onClose?()
            dismiss()
        }
    }

    private func parseAndImportVaultDoc(_ doc: VaultDocument) {
        let textContent = doc.fileContent ?? (doc.rawFileData != nil ? String(data: doc.rawFileData!, encoding: .utf8) : nil)
        guard let textToParse = textContent, !textToParse.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            onClose?()
            dismiss()
            return
        }
        let dto = LocalSyllabusParser.shared.parseText(textToParse)
        CourseImporter.importDTO(dto, into: modelContext)
        onClose?()
        dismiss()
    }
}

// MARK: - Native iOS Multi-Document Selection Picker Component
#if os(iOS)
import UIKit

public struct MultiDocumentPicker: UIViewControllerRepresentable {
    public let onPick: ([URL]) -> Void
    public let onCancel: () -> Void

    public init(onPick: @escaping ([URL]) -> Void, onCancel: @escaping () -> Void) {
        self.onPick = onPick
        self.onCancel = onCancel
    }

    public func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let types: [UTType] = [.pdf, .plainText, .data, .item]
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
        picker.allowsMultipleSelection = true
        picker.shouldShowFileExtensions = true
        picker.delegate = context.coordinator
        return picker
    }

    public func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    public func makeCoordinator() -> Coordinator {
        Coordinator(onPick: onPick, onCancel: onCancel)
    }

    public class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onPick: ([URL]) -> Void
        let onCancel: () -> Void

        init(onPick: @escaping ([URL]) -> Void, onCancel: @escaping () -> Void) {
            self.onPick = onPick
            self.onCancel = onCancel
        }

        public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            onPick(urls)
        }

        public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            onCancel()
        }
    }
}
#endif

public struct AddCourseModalView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    public var onCourseCreated: (() -> Void)? = nil

    @Query private var vaultDocs: [VaultDocument]
    @State private var courseCode: String = ""
    @State private var courseName: String = ""
    @State private var courseDescription: String = ""
    @State private var selectedColorHex: String = "#DC2626"
    @State private var pastedSyllabusText: String = ""
    @State private var attachedFileName: String? = nil
    @State private var fileContentText: String? = nil
    @State private var attachedFileData: Data? = nil

    @State private var showingFileImporter: Bool = false
    @State private var showingCameraScanner: Bool = false
    @State private var showingVaultSelector: Bool = false
    @State private var showValidationHighlight: Bool = false

    private var chooseBadgeText: String {
        vaultDocs.isEmpty ? "CHOOSE 1 OF 3" : "CHOOSE 1 OF 4"
    }

    private var hasSyllabusSource: Bool {
        let hasPdf = (attachedFileName != nil && !attachedFileName!.isEmpty) || (fileContentText != nil && !fileContentText!.isEmpty)
        let hasPaste = !pastedSyllabusText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return hasPdf || hasPaste
    }

    private var canSave: Bool {
        let hasName = !courseName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return hasName && hasSyllabusSource
    }

    private let availableColors: [(name: String, hex: String)] = [
        ("Royal Blue", "#1E40AF"),
        ("Vibrant Blue", "#2563EB"),
        ("Ocean Slate", "#0284C7"),
        ("Sky Blue", "#38BDF8"),
        ("Teal Emerald", "#0D9488"),
        ("Mint Sage", "#10B981"),

        ("Forest Pine", "#15803D"),
        ("Vibrant Green", "#16A34A"),
        ("Rich Olive", "#65A30D"),
        ("Terracotta", "#EA580C"),
        ("Harvest Gold", "#EAB308"),
        ("Royal Violet", "#7C3AED")
    ]

    public var body: some View {
        NavigationStack {
            Form {
                Section("Course Name") {
                    TextField("Course Name", text: $courseName)
                }

                Section("Course Description") {
                    TextField("Course Description", text: $courseDescription)
                }

                Section("Course Brand Color (12 Options)") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 6), spacing: 10) {
                        ForEach(availableColors, id: \.hex) { colorItem in
                            let isSelected = selectedColorHex.uppercased() == colorItem.hex.uppercased()
                            let itemColor = CourseColorHelper.color(for: colorItem.hex)

                            Button(action: {
                                withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                                    selectedColorHex = colorItem.hex
                                }
                            }) {
                                ZStack {
                                    Circle()
                                        .fill(itemColor)
                                        .frame(width: isSelected ? 34 : 26, height: isSelected ? 34 : 26)
                                        .shadow(color: itemColor.opacity(isSelected ? 0.45 : 0.15), radius: isSelected ? 4 : 2, x: 0, y: 2)

                                    if isSelected {
                                        Circle()
                                            .stroke(Color.white, lineWidth: 2.5)
                                            .frame(width: 28, height: 28)
                                        Image(systemName: "checkmark")
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundColor(.white)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 38)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 6)
                }

                // UPLOAD PDF CLASS MATERIAL
                let hasPdf = (attachedFileName != nil && !attachedFileName!.isEmpty) || (fileContentText != nil && !fileContentText!.isEmpty)
                Section(header: HStack {
                    Text("Upload PDF")
                    Spacer()
                    if hasPdf {
                        Text("ATTACHED")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(red: 0.06, green: 0.73, blue: 0.50))
                            .cornerRadius(6)
                    } else {
                        Text(chooseBadgeText)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(Color(red: 0.88, green: 0.40, blue: 0.12))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(red: 0.88, green: 0.40, blue: 0.12).opacity(0.12))
                            .cornerRadius(6)
                    }
                }) {
                    Button(action: { showingFileImporter = true }) {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(hasPdf ? Color(red: 0.06, green: 0.73, blue: 0.50) : Color(red: 0.14, green: 0.44, blue: 0.96))
                                    .frame(width: 34, height: 34)
                                Image(systemName: hasPdf ? "checkmark" : "doc.badge.plus")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.white)
                            }
                            Text(attachedFileName != nil ? "\(attachedFileName!) Attached" : "Upload PDF Class Material")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }

                // CHOOSE SAVED DOCUMENT FROM VAULT (Moved below Upload PDF; rendered ONLY if vaultDocs exist)
                if !vaultDocs.isEmpty {
                    Section(header: HStack {
                        Text("Choose Vault Document (\(vaultDocs.count))")
                        Spacer()
                        Text("CHOOSE 1 OF 4")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(Color(red: 0.88, green: 0.40, blue: 0.12))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(red: 0.88, green: 0.40, blue: 0.12).opacity(0.12))
                            .cornerRadius(6)
                    }) {
                        Button(action: { showingVaultSelector = true }) {
                            HStack(spacing: 12) {
                                ZStack {
                                    Circle()
                                        .fill(Color(red: 0.55, green: 0.36, blue: 0.96))
                                        .frame(width: 34, height: 34)
                                    Image(systemName: "archivebox.fill")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(.white)
                                }
                                Text("Choose Saved Document from Vault")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                Spacer()
                                Text("(\(vaultDocs.count) Saved)")
                                    .font(.system(size: 11, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.55, green: 0.36, blue: 0.96))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color(red: 0.55, green: 0.36, blue: 0.96).opacity(0.12))
                                    .cornerRadius(6)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }

                // SCAN SYLLABUS WITH CAMERA
                Section(header: HStack {
                    Text("Camera Scan")
                    Spacer()
                    Text(chooseBadgeText)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(Color(red: 0.88, green: 0.40, blue: 0.12))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(red: 0.88, green: 0.40, blue: 0.12).opacity(0.12))
                        .cornerRadius(6)
                }) {
                    Button(action: { showingCameraScanner = true }) {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 0.06, green: 0.73, blue: 0.50))
                                    .frame(width: 34, height: 34)
                                Image(systemName: "camera.fill")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.white)
                            }
                            Text("Scan Syllabus with Camera")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }

                // COPY & PASTE SYLLABUS OUTLINE
                let hasPaste = !pastedSyllabusText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                Section(header: HStack {
                    Text("Paste Outline")
                    Spacer()
                    if hasPaste {
                        Text("PASTED")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(red: 0.06, green: 0.73, blue: 0.50))
                            .cornerRadius(6)
                    } else {
                        Text(chooseBadgeText)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(Color(red: 0.88, green: 0.40, blue: 0.12))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(red: 0.88, green: 0.40, blue: 0.12).opacity(0.12))
                            .cornerRadius(6)
                    }
                }) {
                    TextEditor(text: $pastedSyllabusText)
                        .frame(minHeight: 120)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Create New Course")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if !hasSyllabusSource {
                            withAnimation(.easeInOut(duration: 0.25)) {
                                showValidationHighlight = true
                            }
                        } else {
                            saveCourse()
                        }
                    }
                    .bold()
                    .disabled(!canSave)
                }
            }
            .fileImporter(isPresented: $showingFileImporter, allowedContentTypes: DocumentExtractor.supportedContentTypes, allowsMultipleSelection: true) { result in
                if case .success(let urls) = result, !urls.isEmpty {
                    attachedFileName = urls.map { $0.lastPathComponent }.joined(separator: ", ")
                    var allTextParts: [String] = []

                    for selectedUrl in urls {
                        if attachedFileData == nil, let d = try? Data(contentsOf: selectedUrl) {
                            attachedFileData = d
                        }
                        if let txt = DocumentExtractor.extractText(from: selectedUrl) {
                            allTextParts.append(txt)
                        }
                    }
                    if !allTextParts.isEmpty {
                        fileContentText = allTextParts.joined(separator: "\n\n=== NEXT DOCUMENT ===\n\n")
                    }
                }
            }
            .sheet(isPresented: $showingVaultSelector) {
                NavigationStack {
                    List {
                        ForEach(vaultDocs) { doc in
                            Button(action: {
                                showingVaultSelector = false
                                attachedFileName = doc.title
                                fileContentText = doc.fileContent ?? (doc.rawFileData != nil ? String(data: doc.rawFileData!, encoding: .utf8) : nil)
                                attachedFileData = doc.rawFileData
                                if let txt = fileContentText {
                                    let dto = LocalSyllabusParser.shared.parseText(txt)
                                    if courseName.isEmpty { courseName = dto.courseName }
                                    if courseCode.isEmpty { courseCode = dto.courseCode ?? "" }
                                }
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
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(Color(red: 0.06, green: 0.73, blue: 0.50))
                                }
                                .padding(.vertical, 4)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .navigationTitle("Select Vault Document")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { showingVaultSelector = false }
                        }
                    }
                }
            }
            #if os(iOS)
            .fullScreenCover(isPresented: $showingCameraScanner) {
                SyllabusScanView()
            }
            #else
            .sheet(isPresented: $showingCameraScanner) {
                SyllabusScanView()
            }
            #endif
        }
    }

    private func saveCourse() {
        let code = courseCode.trimmingCharacters(in: .whitespaces)
        let name = courseName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty && hasSyllabusSource else {
            withAnimation { showValidationHighlight = true }
            return
        }

        let allCourses = (try? modelContext.fetch(FetchDescriptor<Course>())) ?? []
        let distinctPalette = [
            "#2563EB", // Blue
            "#16A34A", // Green
            "#9333EA", // Purple
            "#EA580C", // Orange
            "#0D9488", // Teal
            "#DB2777", // Pink
            "#4F46E5", // Indigo
            "#D97706", // Amber
            "#0284C7", // Cyan
            "#7C3AED"  // Violet
        ]
        let usedColors = Set(allCourses.map { $0.hexColor.uppercased() })
        let nextColor = distinctPalette.first(where: { !usedColors.contains($0.uppercased()) }) ?? distinctPalette[allCourses.count % distinctPalette.count]
        let finalColorHex = (selectedColorHex == "#DC2626" || selectedColorHex.isEmpty) ? nextColor : selectedColorHex

        let combinedText = [pastedSyllabusText, fileContentText ?? ""].filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }.joined(separator: "\n\n")

        let targetCourse: Course

        if !combinedText.isEmpty {
            // Extract Readings and Assignments organized by week and due date
            var dto = LocalSyllabusParser.shared.parseText(combinedText)
            dto.courseName = name
            dto.courseCode = code.isEmpty ? (name.isEmpty ? "CRS" : name) : code
            CourseImporter.importDTO(dto, into: modelContext)

            // Retrieve the imported course to apply selected color hex & attach documents
            let updatedCourses = (try? modelContext.fetch(FetchDescriptor<Course>())) ?? []
            if let created = updatedCourses.first(where: { $0.courseName == name || $0.courseCode == dto.courseCode }) {
                created.hexColor = finalColorHex
                targetCourse = created
            } else {
                targetCourse = Course(courseName: name, courseCode: code.isEmpty ? (name.isEmpty ? "CRS" : name) : code, hexColor: finalColorHex)
                modelContext.insert(targetCourse)
            }
        } else {
            // Manual Creation: Build 16 Structured Weeks with Readings and Assignments
            let sharingCode = "\(code.prefix(3).uppercased())-\(Int.random(in: 100...999))"
            let newCourse = Course(
                courseName: name,
                courseCode: code.isEmpty ? (name.isEmpty ? "CRS" : name) : code,
                hexColor: finalColorHex,
                termWeeks: 16,
                sharingCode: sharingCode
            )

            for w in 1...16 {
                let week = Week(weekNumber: w, theme: "Week \(w) Schedule")
                week.course = newCourse

                let r1 = Reading(
                    title: "\(newCourse.courseCode ?? "CRS") Intro Reading & Syllabus Review",
                    mediaType: .article,
                    isCompleted: false,
                    summaryText: "Introduction to \(newCourse.courseName). Review course expectations, grading policies, and reading schedule.",
                    keyTakeawaysText: "• Review syllabus requirements.\n• Note instructor contact & office hours.",
                    estimatedTimeText: "~15 min read"
                )
                r1.week = week
                week.readings.append(r1)

                let r2 = Reading(
                    title: "Chapter \(w): Principles of \(newCourse.courseName)",
                    mediaType: .textbook,
                    isCompleted: false,
                    summaryText: "Fundamental concept definitions and theoretical foundations for \(newCourse.courseName).",
                    keyTakeawaysText: "• Learn core terminology.\n• Prepare for upcoming assignment.",
                    estimatedTimeText: "~30 min read"
                )
                r2.week = week
                week.readings.append(r2)

                let assignWeek = w
                let calendar = Calendar.current
                var comp = DateComponents()
                comp.year = 2026
                comp.month = 9
                comp.day = 4
                comp.hour = 23
                comp.minute = 59
                let startDate = calendar.date(from: comp) ?? Date()
                let dueDate = calendar.date(byAdding: .day, value: (assignWeek - 1) * 7, to: startDate) ?? Date()

                let a1 = Assignment(
                    title: "Week \(w) Practice Assignment",
                    weekNumber: w,
                    dueDate: dueDate,
                    fullInstructions: "Complete end-of-chapter exercises for Week \(w).",
                    pointsPossible: "100 pts"
                )
                a1.course = newCourse
                newCourse.assignments.append(a1)

                newCourse.weeks.append(week)
            }
            modelContext.insert(newCourse)
            targetCourse = newCourse
        }

        let cleanDesc = courseDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        if !cleanDesc.isEmpty {
            targetCourse.courseDescription = cleanDesc
        }

        // Save attached PDF document into Syllabus storage with rawFileData
        if let pdfName = attachedFileName {
            let sylDoc = SyllabusDocument(
                docTitle: pdfName,
                fileName: pdfName,
                rawFileData: attachedFileData
            )
            sylDoc.course = targetCourse
            modelContext.insert(sylDoc)
        }

        try? modelContext.save()
        onCourseCreated?()
        dismiss()
    }
}

// MARK: - Add New Item Custom Modal Sheet (Matching localhost Screenshot 3)

public struct AddNewItemModalView: View {
    @Environment(\.dismiss) private var dismiss
    public let onAddTask: () -> Void
    public let onCreateCourse: () -> Void

    public var body: some View {
        VStack(spacing: 16) {
            // Drag Handle Pill
            Capsule()
                .fill(Color(red: 0.78, green: 0.82, blue: 0.88))
                .frame(width: 36, height: 5)
                .padding(.top, 14)

            // Header: Title & Close x Button
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Add New Item")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                    Text("Select what you would like to add")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                }
                Spacer()
                Button(action: { dismiss() }) {
                    ZStack {
                        Circle()
                            .fill(Color(red: 0.93, green: 0.95, blue: 0.97))
                            .frame(width: 30, height: 30)
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    }
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 4)

            VStack(spacing: 14) {
                // Card 1: Create New Course (Purple Graduation Cap White Icon)
                Button(action: {
                    dismiss()
                    onCreateCourse()
                }) {
                    HStack(spacing: 14) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color(red: 0.55, green: 0.36, blue: 0.96))
                                .frame(width: 40, height: 40)
                            Image(systemName: "graduationcap.fill")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(.white)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Create New Course")
                                .font(.system(size: 14.5, weight: .bold))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("Create course with brand color & syllabus")
                                .font(.system(size: 12))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity)
                    .background(Color.white)
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                    )
                    .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                }
                .buttonStyle(.plain)

                // Card 2: Add Assignment or Task (Blue Plus Icon)
                Button(action: {
                    dismiss()
                    onAddTask()
                }) {
                    HStack(spacing: 14) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color(red: 0.14, green: 0.44, blue: 0.96))
                                .frame(width: 40, height: 40)
                            Image(systemName: "plus")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(.white)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Add Reading or Assignment")
                                .font(.system(size: 14.5, weight: .bold))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("Add homework, reading, or lab item")
                                .font(.system(size: 12))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity)
                    .background(Color.white)
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                    )
                    .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 40)
        .background(Color(red: 0.95, green: 0.96, blue: 0.98))
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 24, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 24))
        .ignoresSafeArea(edges: .bottom)
    }
}
