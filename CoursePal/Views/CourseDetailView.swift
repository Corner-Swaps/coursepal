import SwiftUI
import SwiftData

public struct CourseDetailView: View {
    @Bindable public var course: Course
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var courseName: String
    @State private var courseCode: String
    @State private var instructorName: String
    @State private var instructorEmail: String

    @State private var showingAIChat: Bool = false
    @State private var editingAssignment: Assignment? = nil
    @State private var editingReading: Reading? = nil
    @State private var showingAddTaskModal: Bool = false
    @State private var addingTaskCategory: Int = 0 // 0 = assignment, 1 = reading

    public init(course: Course) {
        self.course = course
        _courseName = State(initialValue: course.courseName)
        _courseCode = State(initialValue: course.courseCode ?? "")
        _instructorName = State(initialValue: course.instructorName ?? "")
        _instructorEmail = State(initialValue: course.instructorEmail ?? "")
    }

    private var courseColor: Color {
        CourseColorHelper.color(for: course.hexColor)
    }

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 18) {
                    
                    // MARK: - 0. Ask Course AI Assistant Card
                    Button(action: { showingAIChat = true }) {
                        HStack(spacing: 14) {
                            ZStack {
                                Circle()
                                    .fill(courseColor.opacity(0.15))
                                    .frame(width: 44, height: 44)
                                Image(systemName: "sparkles")
                                    .font(.system(size: 20, weight: .bold))
                                    .foregroundColor(courseColor)
                            }

                            VStack(alignment: .leading, spacing: 3) {
                                HStack(spacing: 6) {
                                    Text("Ask Course AI")
                                        .font(.system(size: 15, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.1, green: 0.14, blue: 0.24))
                                    Text("GEMINI")
                                        .font(.system(size: 9, weight: .black, design: .rounded))
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(courseColor.opacity(0.12))
                                        .foregroundColor(courseColor)
                                        .cornerRadius(6)
                                }
                                Text("Instant answers for policies, rubrics & schedule")
                                    .font(.system(size: 12))
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(Color.gray.opacity(0.5))
                        }
                        .padding(14)
                        .background(Color.white)
                        .cornerRadius(16)
                        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
                    }
                    .sheet(isPresented: $showingAIChat) {
                        CourseAIChatView(course: course)
                    }

                    // MARK: - 1. Course Header Section (Direct In-Place Editing)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Course Header")
                            .font(.cpItemTitle)
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                        VStack(alignment: .leading, spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("COURSE TITLE")
                                    .font(.system(size: 10.5, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))

                                TextField("Course Name (e.g. Intro to Psychology)", text: $courseName)
                                    .font(.cpItemTitle)
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                    .onChange(of: courseName) { _, newValue in
                                        course.courseName = newValue
                                        try? modelContext.save()
                                    }
                            }

                            Divider()

                            VStack(alignment: .leading, spacing: 4) {
                                Text("COURSE CODE")
                                    .font(.system(size: 10.5, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))

                                TextField("Course Code (e.g. PSYC 101)", text: $courseCode)
                                    .font(.cpDescriptionBold)
                                    .foregroundColor(courseColor)
                                    .onChange(of: courseCode) { _, newValue in
                                        course.courseCode = newValue
                                        try? modelContext.save()
                                    }
                            }
                        }
                        .padding(14)
                        .background(Color.white)
                        .cornerRadius(14)
                        .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 2)
                    }

                    // MARK: - 2. Faculty & Contact Info Section (Full Size In-Place Editing)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Faculty & Contact Info")
                            .font(.cpItemTitle)
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                        VStack(alignment: .leading, spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("INSTRUCTOR / FACULTY")
                                    .font(.system(size: 10.5, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))

                                TextField("Faculty Name (e.g. Dr. Jane Smith)", text: $instructorName)
                                    .font(.cpItemTitle)
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                    .onChange(of: instructorName) { _, newValue in
                                        course.instructorName = newValue
                                        try? modelContext.save()
                                    }
                            }

                            Divider()

                            VStack(alignment: .leading, spacing: 4) {
                                Text("EMAIL ADDRESS")
                                    .font(.system(size: 10.5, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))

                                TextField("Email (e.g. jsmith@university.edu)", text: $instructorEmail)
                                    .font(.cpDescriptionBold)
                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    .keyboardType(.emailAddress)
                                    .autocapitalization(.none)
                                    .onChange(of: instructorEmail) { _, newValue in
                                        course.instructorEmail = newValue
                                        try? modelContext.save()
                                    }
                            }
                        }
                        .padding(14)
                        .background(Color.white)
                        .cornerRadius(14)
                        .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 2)
                    }

                    // MARK: - 3. Course Assignments Section
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Assignments")
                            .font(.cpItemTitle)
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                        VStack(spacing: 8) {
                            ForEach(course.assignments.sorted(by: { ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture) })) { assign in
                                EditableAssignmentRow(assignment: assign)
                            }

                            // Add Assignment Action Pill (Clean text box)
                            Button(action: {
                                addingTaskCategory = 0
                                showingAddTaskModal = true
                            }) {
                                HStack {
                                    Text("+ Add Assignment")
                                        .font(.cpItemTitle)
                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    Spacer()
                                }
                                .padding(10)
                                .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                                .cornerRadius(10)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(14)
                        .background(Color.white)
                        .cornerRadius(14)
                        .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 2)
                    }

                    // MARK: - 4. Course Readings Section
                    let allReadingsForCourse = course.weeks.flatMap { $0.readings }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Readings")
                            .font(.cpItemTitle)
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                        VStack(spacing: 8) {
                            ForEach(allReadingsForCourse, id: \.id) { reading in
                                EditableReadingRow(reading: reading)
                            }

                            // Add Reading Action Pill (Clean text box)
                            Button(action: {
                                addingTaskCategory = 1
                                showingAddTaskModal = true
                            }) {
                                HStack {
                                    Text("+ Add Reading")
                                        .font(.cpItemTitle)
                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    Spacer()
                                }
                                .padding(10)
                                .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                                .cornerRadius(10)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(14)
                        .background(Color.white)
                        .cornerRadius(14)
                        .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 2)
                    }
                    
                    Spacer(minLength: 40)
                }
                .padding(18)
            }
            .fuzzedScrollEdges(top: 36, bottom: 85)
            .scrollDismissesKeyboard(.immediately)
            .background(Color(red: 0.95, green: 0.96, blue: 0.98))
            .navigationTitle("Edit Course")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        saveChanges()
                        dismiss()
                    }
                    .font(.cpDescriptionBold)
                }
            }
            .sheet(item: $editingAssignment) { a in
                EditAssignmentModalView(assignment: a)
            }
            .sheet(item: $editingReading) { r in
                EditReadingModalView(reading: r)
            }
            .sheet(isPresented: $showingAddTaskModal) {
                AddTaskModalView(initialCourse: course, initialCategory: addingTaskCategory)
            }
        }
        .dismissKeyboardOnTap()
    }

    private func saveChanges() {
        let cleanName = courseName.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanCode = courseCode.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanInstructor = instructorName.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanEmail = instructorEmail.trimmingCharacters(in: .whitespacesAndNewlines)

        if !cleanName.isEmpty { course.courseName = cleanName }
        if !cleanCode.isEmpty { course.courseCode = cleanCode }
        course.instructorName = cleanInstructor.isEmpty ? nil : cleanInstructor
        course.instructorEmail = cleanEmail.isEmpty ? nil : cleanEmail

        try? modelContext.save()
    }
}

// MARK: - Direct Editable Textbox Rows (No Icons, Adjust & Retype)

struct EditableAssignmentRow: View {
    @Bindable var assignment: Assignment
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            TextField("Assignment Title", text: $assignment.title)
                .font(.cpItemTitle)
                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                .onChange(of: assignment.title) { _, _ in
                    try? modelContext.save()
                }

            if let due = assignment.dueDate {
                let fmt = DateFormatter()
                let _ = { fmt.dateFormat = "EEEE, MMMM d" }()
                Text("Due \(fmt.string(from: due))")
                    .font(.cpDescription)
                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.96, green: 0.97, blue: 0.99))
        .cornerRadius(10)
    }
}

struct EditableReadingRow: View {
    @Bindable var reading: Reading
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            TextField("Reading Title", text: $reading.title)
                .font(.cpItemTitle)
                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                .onChange(of: reading.title) { _, _ in
                    try? modelContext.save()
                }

            Text(WeekDateConverter.formattedDueDate(for: reading.dueDate, week: reading.week, weekNumber: reading.week?.weekNumber ?? 0))
                .font(.cpDescription)
                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.96, green: 0.97, blue: 0.99))
        .cornerRadius(10)
    }
}
