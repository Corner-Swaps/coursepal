import SwiftUI

public struct ReviewScheduleView: View {
    @Environment(\.dismiss) private var dismiss
    
    @State public var courseName: String
    @State public var courseCode: String
    @State public var weeks: [EditableWeek]
    @State public var assignments: [EditableAssignment]

    public var onConfirmSave: (CourseDTO) -> Void

    public struct EditableReading: Identifiable, Hashable {
        public let id: String
        public var title: String
        public var mediaType: String
    }

    public struct EditableWeek: Identifiable, Hashable {
        public let id: String
        public var weekNumber: Int
        public var theme: String
        public var readings: [EditableReading]
    }

    public struct EditableAssignment: Identifiable, Hashable {
        public let id: String
        public var title: String
        public var dueDate: String
        public var instructions: String
        public var points: String
    }

    public init(courseDTO: CourseDTO, onConfirmSave: @escaping (CourseDTO) -> Void) {
        _courseName = State(initialValue: courseDTO.courseName)
        _courseCode = State(initialValue: courseDTO.courseCode ?? "")
        
        let initialWeeks = (courseDTO.weeks ?? []).map { w in
            EditableWeek(
                id: w.id,
                weekNumber: w.weekNumber,
                theme: w.theme ?? "",
                readings: (w.readings ?? []).map { r in
                    EditableReading(id: r.id, title: r.title, mediaType: r.mediaType ?? "textbook")
                }
            )
        }
        _weeks = State(initialValue: initialWeeks)

        let initialAssignments = (courseDTO.assignments ?? []).map { a in
            EditableAssignment(
                id: a.id,
                title: a.title,
                dueDate: a.dueDate ?? "",
                instructions: a.fullInstructions ?? "",
                points: a.pointsPossible ?? "100 pts"
            )
        }
        _assignments = State(initialValue: initialAssignments)
        self.onConfirmSave = onConfirmSave
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Course Information")) {
                    TextField("Course Name", text: $courseName)
                    TextField("Course Code (e.g. CS 101)", text: $courseCode)
                }

                Section(header: Text("Extracted Weekly Breakdown (\(weeks.count) Weeks)")) {
                    ForEach($weeks) { $week in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(week.weekNumber == 0 ? "Fallback Week" : "Week \(week.weekNumber)")
                                    .fontWeight(.bold)
                                    .foregroundColor(week.weekNumber == 0 ? .orange : .blue)
                                Spacer()
                            }
                            TextField("Week Theme", text: $week.theme)
                                .font(.system(size: 15))
                            
                            ForEach($week.readings) { $reading in
                                HStack {
                                    Image(systemName: "book")
                                        .foregroundColor(.secondary)
                                    TextField("Reading Title", text: $reading.title)
                                        .font(.system(size: 15))
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                Section(header: Text("Graded Assignments (\(assignments.count))")) {
                    ForEach($assignments) { $assignment in
                        VStack(alignment: .leading, spacing: 6) {
                            TextField("Assignment Title", text: $assignment.title)
                                .font(.system(size: 15, weight: .medium))
                            HStack {
                                TextField("Due Date", text: $assignment.dueDate)
                                    .font(.system(size: 14))
                                    .foregroundColor(.secondary)
                                Spacer()
                                TextField("Points", text: $assignment.points)
                                    .font(.system(size: 14))
                                    .multilineTextAlignment(.trailing)
                                    .frame(width: 80)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("Review & Edit Schedule")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save & Import") {
                        let finalDTO = buildFinalDTO()
                        onConfirmSave(finalDTO)
                        dismiss()
                    }
                    .fontWeight(.bold)
                }
            }
        }
    }

    private func buildFinalDTO() -> CourseDTO {
        let finalWeeks = weeks.map { w in
            WeekDTO(
                id: w.id,
                weekNumber: w.weekNumber,
                startDate: nil,
                theme: w.theme,
                readings: w.readings.map { r in
                    ReadingDTO(id: r.id, title: r.title, mediaType: r.mediaType, isCompleted: false)
                }
            )
        }

        let finalAssignments = assignments.map { a in
            AssignmentDTO(
                id: a.id,
                title: a.title,
                dueDate: a.dueDate.isEmpty ? nil : a.dueDate,
                fullInstructions: a.instructions.isEmpty ? nil : a.instructions,
                pointsPossible: a.points,
                noteText: nil
            )
        }

        // Generate a unique sharing code from course name initials
        let initials = courseName
            .components(separatedBy: .whitespaces)
            .compactMap { $0.first.map { String($0).uppercased() } }
            .prefix(3)
            .joined()
        let uniqueSharing = "\(initials.isEmpty ? "CRS" : initials)-\(Int.random(in: 1000...9999))"

        return CourseDTO(
            id: UUID().uuidString,
            creatorId: "00000000-0000-0000-0000-000000000001",
            courseName: courseName,
            courseCode: courseCode.isEmpty ? nil : courseCode,
            termWeeks: finalWeeks.count,
            sharingCode: uniqueSharing,
            weeks: finalWeeks,
            assignments: finalAssignments
        )
    }
}
