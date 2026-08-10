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
    @State private var isGlobalProcessing: Bool = false
    @State private var selectedCourseForAddDoc: Course? = nil

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
                    SyllabusRepositoryView(showingUploadModal: $showingUploadDocModal, isGlobalProcessing: $isGlobalProcessing, selectedCourseForAddDoc: $selectedCourseForAddDoc)
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
                            showingUploadDocModal = false
                        }

                    VStack(spacing: 0) {
                        Spacer()
                        UploadDocModalView(targetCourse: selectedCourseForAddDoc, onClose: {
                            showingUploadDocModal = false
                            withAnimation(.easeInOut(duration: 0.25)) {
                                selectedTab = "syllabus"
                            }
                        })
                    }
                    .ignoresSafeArea(edges: .bottom)
                }
                .transition(.identity)
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
                    selectedTab = "syllabus"
                }
            })
        }
        #else
        .sheet(isPresented: $showingAddCourseModal) {
            AddCourseModalView(onCourseCreated: {
                withAnimation {
                    selectedTab = "syllabus"
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
    @Query private var vaultDocs: [VaultDocument]

    public var targetCourse: Course? = nil
    public var onClose: (() -> Void)? = nil

    @State private var showingFileImporter: Bool = false
    @State private var showingCameraScanner: Bool = false
    @State private var showingVaultSelector: Bool = false
    @State private var showingUploadErrorAlert: Bool = false
    @State private var uploadErrorMessage: String = ""

    public init(targetCourse: Course? = nil, onClose: (() -> Void)? = nil) {
        self.targetCourse = targetCourse
        self.onClose = onClose
    }

    public var body: some View {
        VStack(spacing: 16) {
            // Drag Handle Pill
            Capsule()
                .fill(Color(red: 0.78, green: 0.82, blue: 0.88))
                .frame(width: 36, height: 5)
                .padding(.top, 14)

            // Header: Concise Title (< 5 words) & Close Button
            HStack {
                Text("Upload Document")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
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
            .padding(.top, 8)
            .padding(.bottom, 4)

            VStack(spacing: 12) {
                // Choice 1: Select PDF File
                Button(action: {
                    if APIService.shared.activeAPIKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        uploadErrorMessage = "API Key Missing: Please enter your Gemini API key in settings."
                        showingUploadErrorAlert = true
                    } else {
                        showingFileImporter = true
                    }
                }) {
                    HStack(spacing: 14) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color(red: 0.14, green: 0.44, blue: 0.96))
                                .frame(width: 40, height: 40)
                            Image(systemName: "doc.badge.plus")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(.white)
                        }

                        Text("Select PDF File")
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    }
                    .padding(16)
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

                            Text("Choose Saved Document from Vault")
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }
                        .padding(16)
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

                // Choice 3: Scan with Camera
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

                        Text("Scan with Camera")
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    }
                    .padding(16)
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
        .fileImporter(isPresented: $showingFileImporter, allowedContentTypes: DocumentExtractor.supportedContentTypes, allowsMultipleSelection: false) { result in
            if case .success(let urls) = result, !urls.isEmpty {
                confirmAndProcessFiles(urls)
            }
        }
        .alert("Upload Error", isPresented: $showingUploadErrorAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(uploadErrorMessage)
        }
    }

    private func confirmAndProcessFiles(_ urls: [URL]) {
        guard !urls.isEmpty else {
            onClose?()
            dismiss()
            return
        }
        onClose?()
        dismiss()
        SyllabusUploadManager.shared.startUpload(urls: urls, targetCourse: targetCourse, modelContext: modelContext)
    }

    private func parseAndImportVaultDoc(_ doc: VaultDocument) {
        onClose?()
        dismiss()
        if let data = doc.rawFileData, !data.isEmpty {
            if let tempURL = try? saveTempFile(data: data, filename: doc.title) {
                SyllabusUploadManager.shared.startUpload(urls: [tempURL], targetCourse: targetCourse, modelContext: modelContext)
            }
        } else if let textToParse = doc.fileContent, !textToParse.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            if let tempURL = try? saveTempFile(data: textToParse.data(using: .utf8) ?? Data(), filename: "\(doc.title).txt") {
                SyllabusUploadManager.shared.startUpload(urls: [tempURL], targetCourse: targetCourse, modelContext: modelContext)
            }
        }
    }

    private func saveTempFile(data: Data, filename: String) throws -> URL {
        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent(filename)
        try data.write(to: fileURL)
        return fileURL
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
        let types: [UTType] = [.pdf, .plainText]
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
        picker.allowsMultipleSelection = false
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
    @State private var uploadedFilesList: [(title: String, data: Data?, text: String?)] = []
    @State private var parsedPreviewDTO: CourseDTO? = nil

    @State private var showingFileImporter: Bool = false
    @State private var showingCameraScanner: Bool = false
    @State private var showingVaultSelector: Bool = false
    @State private var selectedVaultDocIDs: Set<PersistentIdentifier> = []
    @State private var showValidationHighlight: Bool = false

    @State private var isProcessingCourse: Bool = false
    @State private var processingStatusText: String = "Analyzing uploaded documents & syllabus..."
    @State private var processingProgress: Double = 0.0
    @State private var showingAddCourseAlert: Bool = false
    @State private var addCourseErrorMessage: String = ""

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

                Section {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "info.circle.fill")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Upload Materials for ONE Course at a Time")
                                .font(.system(size: 12.5, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("Attach syllabus & documents specifically for this course. Each course receives its own dedicated materials & vault.")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }
                    }
                    .padding(.vertical, 2)
                }

                // UPLOAD PDF CLASS MATERIAL
                let hasPdf = (attachedFileName != nil && !attachedFileName!.isEmpty) || (fileContentText != nil && !fileContentText!.isEmpty)
                Section(header: HStack {
                    Text("Upload PDF")
                    Spacer()
                    if isProcessingCourse {
                        Text("PROCESSING...")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(red: 0.14, green: 0.44, blue: 0.96))
                            .cornerRadius(6)
                    } else if hasPdf {
                        Text("ATTACHED")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(red: 0.06, green: 0.73, blue: 0.50))
                            .cornerRadius(6)
                    } else if !hasSyllabusSource {
                        Text(chooseBadgeText)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(Color(red: 0.88, green: 0.40, blue: 0.12))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(red: 0.88, green: 0.40, blue: 0.12).opacity(0.12))
                            .cornerRadius(6)
                    }
                }) {
                    HStack(spacing: 12) {
                        Button(action: {
                            if APIService.shared.activeAPIKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                addCourseErrorMessage = "API Key Missing: Please enter your Gemini API key in settings."
                                showingAddCourseAlert = true
                            } else {
                                showingFileImporter = true
                            }
                        }) {
                            HStack(spacing: 12) {
                                ZStack {
                                    if isProcessingCourse {
                                        ContinuousProgressRing()
                                    } else {
                                        Circle()
                                            .fill(hasPdf ? Color(red: 0.06, green: 0.73, blue: 0.50) : Color(red: 0.14, green: 0.44, blue: 0.96))
                                            .frame(width: 34, height: 34)
                                        Image(systemName: hasPdf ? "checkmark" : "doc.badge.plus")
                                            .font(.system(size: 14, weight: .bold))
                                            .foregroundColor(.white)
                                    }
                                }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(attachedFileName != nil ? "\(attachedFileName!) Attached" : "Upload PDF Class Material")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                                    if isProcessingCourse {
                                        Text(processingStatusText)
                                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                                            .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    } else if hasPdf {
                                        Text("Tap to replace document")
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    }
                                }
                                Spacer()
                            }
                        }
                        .buttonStyle(.plain)

                        if hasPdf && !isProcessingCourse {
                            Button(action: {
                                withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                                    attachedFileName = nil
                                    fileContentText = nil
                                    attachedFileData = nil
                                    uploadedFilesList = []
                                    parsedPreviewDTO = nil
                                }
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "trash.fill")
                                        .font(.system(size: 11, weight: .bold))
                                    Text("Remove")
                                        .font(.system(size: 12, weight: .bold))
                                }
                                .foregroundColor(Color(red: 0.93, green: 0.27, blue: 0.27))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color(red: 0.93, green: 0.27, blue: 0.27).opacity(0.12))
                                .clipShape(Capsule())
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                }

                // LIVE EXTRACTION SUMMARY CARD
                if let dto = parsedPreviewDTO {
                    Section(header: HStack {
                        Text("Extracted Course Data")
                        Spacer()
                        Text("READY TO LAUNCH")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(red: 0.06, green: 0.73, blue: 0.50))
                            .cornerRadius(6)
                    }) {
                        VStack(alignment: .leading, spacing: 10) {
                            let totalReadings = (dto.weeks ?? []).reduce(0) { $0 + ($1.readings?.count ?? 0) }
                            HStack(spacing: 10) {
                                ZStack {
                                    Circle()
                                        .fill(Color(red: 0.06, green: 0.73, blue: 0.50).opacity(0.12))
                                        .frame(width: 28, height: 28)
                                    Image(systemName: "book.fill")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundColor(Color(red: 0.06, green: 0.73, blue: 0.50))
                                }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(totalReadings) Weekly Readings Extracted")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                    Text("Required course readings & materials")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }

                            HStack(spacing: 10) {
                                ZStack {
                                    Circle()
                                        .fill(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.12))
                                        .frame(width: 28, height: 28)
                                    Image(systemName: "calendar.badge.clock")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\((dto.assignments?.count ?? 0)) Major Assignments Detected")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                    Text("Complete with percentages & due dates")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }

                            if !uploadedFilesList.isEmpty {
                                HStack(spacing: 10) {
                                    ZStack {
                                        Circle()
                                            .fill(Color(red: 0.55, green: 0.36, blue: 0.96).opacity(0.12))
                                            .frame(width: 28, height: 28)
                                        Image(systemName: "folder.fill.badge.plus")
                                            .font(.system(size: 12, weight: .bold))
                                            .foregroundColor(Color(red: 0.55, green: 0.36, blue: 0.96))
                                    }
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("\(uploadedFilesList.count) PDF & DOCX Files Attached")
                                            .font(.system(size: 13, weight: .bold))
                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                        Text("Saved to Documents Vault automatically")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                // CHOOSE SAVED DOCUMENT FROM VAULT (Moved below Upload PDF; rendered ONLY if vaultDocs exist)
                if !vaultDocs.isEmpty {
                    let hasVaultAttached = !uploadedFilesList.isEmpty && (attachedFileName != nil && !attachedFileName!.isEmpty)
                    Section(header: HStack {
                        Text("Choose Vault Document (\(vaultDocs.count))")
                        Spacer()
                        if hasVaultAttached {
                            Text("SELECTED")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color(red: 0.06, green: 0.73, blue: 0.50))
                                .cornerRadius(6)
                        } else if !hasSyllabusSource {
                            Text("CHOOSE 1 OF 4")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(Color(red: 0.88, green: 0.40, blue: 0.12))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color(red: 0.88, green: 0.40, blue: 0.12).opacity(0.12))
                                .cornerRadius(6)
                        }
                    }) {
                        Button(action: { showingVaultSelector = true }) {
                            HStack(spacing: 12) {
                                ZStack {
                                    Circle()
                                        .fill(hasVaultAttached ? Color(red: 0.06, green: 0.73, blue: 0.50) : Color(red: 0.55, green: 0.36, blue: 0.96))
                                        .frame(width: 34, height: 34)
                                    Image(systemName: hasVaultAttached ? "checkmark" : "archivebox.fill")
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
                    if !hasSyllabusSource {
                        Text(chooseBadgeText)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(Color(red: 0.88, green: 0.40, blue: 0.12))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(red: 0.88, green: 0.40, blue: 0.12).opacity(0.12))
                            .cornerRadius(6)
                    }
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
                    } else if !hasSyllabusSource {
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
            .fileImporter(isPresented: $showingFileImporter, allowedContentTypes: DocumentExtractor.supportedContentTypes, allowsMultipleSelection: false) { result in
                if case .success(let urls) = result, let selectedUrl = urls.first {
                    let accessed = selectedUrl.startAccessingSecurityScopedResource()
                    defer { if accessed { selectedUrl.stopAccessingSecurityScopedResource() } }

                    let fileName = selectedUrl.lastPathComponent
                    let fileData = try? Data(contentsOf: selectedUrl)
                    let textContent = DocumentExtractor.extractText(from: selectedUrl)
                    let normFileName = fileName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

                    let isDuplicateInVault = vaultDocs.contains { doc in
                        let titleNorm = doc.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                        if titleNorm == normFileName { return true }
                        if let docData = doc.rawFileData, let newFileData = fileData, !docData.isEmpty && !newFileData.isEmpty && docData == newFileData {
                            return true
                        }
                        return false
                    }

                    let allCourses = (try? modelContext.fetch(FetchDescriptor<Course>())) ?? []
                    let isDuplicateInCourses = allCourses.contains { c in
                        c.syllabusDocs.contains { syl in
                            let nameNorm = (syl.fileName ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                            return nameNorm == normFileName
                        }
                    }

                    if isDuplicateInVault || isDuplicateInCourses {
                        addCourseErrorMessage = "Duplicate Document: '\(fileName)' has already been uploaded."
                        showingAddCourseAlert = true
                        attachedFileName = nil
                        attachedFileData = nil
                        fileContentText = nil
                        uploadedFilesList = []
                        return
                    }

                    attachedFileName = fileName
                    attachedFileData = fileData
                    fileContentText = textContent
                    uploadedFilesList = [(title: fileName, data: fileData, text: textContent)]
                }
            }
            .alert("API Error", isPresented: $showingAddCourseAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(addCourseErrorMessage)
            }
            .sheet(isPresented: $showingVaultSelector) {
                NavigationStack {
                    List {
                        ForEach(vaultDocs) { doc in
                            let isSelected = selectedVaultDocIDs.contains(doc.persistentModelID)
                            Button(action: {
                                withAnimation(.spring(response: 0.25, dampingFraction: 0.75)) {
                                    if isSelected {
                                        selectedVaultDocIDs.remove(doc.persistentModelID)
                                    } else {
                                        selectedVaultDocIDs.insert(doc.persistentModelID)
                                    }
                                }
                            }) {
                                HStack(spacing: 12) {
                                    ZStack {
                                        Circle()
                                            .fill(isSelected ? Color(red: 0.06, green: 0.73, blue: 0.50) : Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.12))
                                            .frame(width: 32, height: 32)
                                        Image(systemName: isSelected ? "checkmark" : (doc.fileType.uppercased() == "PDF" ? "doc.fill" : "doc.text.fill"))
                                            .font(.system(size: 13, weight: .bold))
                                            .foregroundColor(isSelected ? .white : Color(red: 0.14, green: 0.44, blue: 0.96))
                                    }

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(doc.title)
                                            .font(.system(size: 14, weight: .bold, design: .rounded))
                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                        Text("\(doc.courseCode ?? "General") • \(doc.fileSize)")
                                            .font(.caption)
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    }
                                    Spacer()

                                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                        .font(.system(size: 20, weight: .semibold))
                                        .foregroundColor(isSelected ? Color(red: 0.06, green: 0.73, blue: 0.50) : Color.secondary.opacity(0.4))
                                }
                                .padding(.vertical, 6)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .navigationTitle("Select Vault Documents")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { showingVaultSelector = false }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button(action: {
                                showingVaultSelector = false
                                var selectedDocs = vaultDocs.filter { selectedVaultDocIDs.contains($0.persistentModelID) }
                                if selectedDocs.isEmpty, let first = vaultDocs.first {
                                    selectedDocs = [first]
                                }

                                attachedFileName = selectedDocs.map { $0.title }.joined(separator: ", ")
                                var allTexts: [String] = []

                                for doc in selectedDocs {
                                    let txt = doc.fileContent ?? (doc.rawFileData != nil ? DocumentExtractor.extractTextFromData(doc.rawFileData!, fileName: doc.title) : nil)
                                    if let t = txt, !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                        allTexts.append(t)
                                    }
                                    uploadedFilesList.append((title: doc.title, data: doc.rawFileData, text: txt))
                                }

                                if !allTexts.isEmpty {
                                    let combined = allTexts.joined(separator: "\n\n=== NEXT VAULT DOCUMENT ===\n\n")
                                    fileContentText = combined
                                }
                            }) {
                                Text(selectedVaultDocIDs.isEmpty ? "Done" : "Attach Selected (\(selectedVaultDocIDs.count))")
                                    .bold()
                            }
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
            "#2563EB", "#16A34A", "#9333EA", "#EA580C", "#0D9488",
            "#DB2777", "#4F46E5", "#D97706", "#0284C7", "#7C3AED"
        ]
        let usedColors = Set(allCourses.map { $0.hexColor.uppercased() })
        let nextColor = distinctPalette.first(where: { !usedColors.contains($0.uppercased()) }) ?? distinctPalette[allCourses.count % distinctPalette.count]
        let finalColorHex = (selectedColorHex == "#DC2626" || selectedColorHex.isEmpty) ? nextColor : selectedColorHex

        let finalCourseCode = code.isEmpty ? (name.isEmpty ? "CRS" : name) : code
        let newCourse = Course(courseName: name, courseCode: finalCourseCode, hexColor: finalColorHex)
        let cleanDesc = courseDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        if !cleanDesc.isEmpty {
            newCourse.courseDescription = cleanDesc
        }
        modelContext.insert(newCourse)
        try? modelContext.save()

        // Prepare files for background upload pipeline
        var uploadURLs: [URL] = []
        let tempDir = FileManager.default.temporaryDirectory

        if !uploadedFilesList.isEmpty {
            for file in uploadedFilesList {
                let fname = file.title
                let fileURL = tempDir.appendingPathComponent(fname)
                if let data = file.data {
                    try? data.write(to: fileURL)
                    uploadURLs.append(fileURL)
                } else if let txt = file.text, let tData = txt.data(using: .utf8) {
                    try? tData.write(to: fileURL)
                    uploadURLs.append(fileURL)
                }
            }
        } else if let pData = attachedFileData, !pData.isEmpty {
            let fname = attachedFileName ?? "syllabus.pdf"
            let fileURL = tempDir.appendingPathComponent(fname)
            try? pData.write(to: fileURL)
            uploadURLs.append(fileURL)
        } else if !pastedSyllabusText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let fileURL = tempDir.appendingPathComponent("pasted_outline.txt")
            try? pastedSyllabusText.data(using: .utf8)?.write(to: fileURL)
            uploadURLs.append(fileURL)
        }

        if !uploadURLs.isEmpty {
            SyllabusUploadManager.shared.startUpload(urls: uploadURLs, targetCourse: newCourse, modelContext: modelContext)
        }

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

struct ContinuousProgressRing: View {
    @State private var progress: CGFloat = 0.0

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.2), lineWidth: 3)
                .frame(width: 36, height: 36)

            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    Color(red: 0.14, green: 0.44, blue: 0.96),
                    style: StrokeStyle(lineWidth: 3, lineCap: .round)
                )
                .frame(width: 36, height: 36)
                .rotationEffect(.degrees(-90))

            Image(systemName: "doc.fill")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
        }
        .onAppear {
            progress = 0.0
            withAnimation(.linear(duration: 3.2).repeatForever(autoreverses: false)) {
                progress = 1.0
            }
        }
    }
}
