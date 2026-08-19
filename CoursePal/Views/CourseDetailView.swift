import SwiftUI
import SwiftData

public struct CourseDetailView: View {
    @Bindable public var course: Course
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var isCopiedSharingCode: Bool = false

    public init(course: Course) {
        self.course = course
    }

    private var courseColor: Color {
        CourseColorHelper.color(for: course.hexColor)
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // MARK: - Course Header Card
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(course.courseCode ?? "CS 101")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(courseColor)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(courseColor.opacity(0.15))
                                    .cornerRadius(8)

                                Text(course.courseName)
                                    .font(.system(size: 22, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.07, green: 0.11, blue: 0.20))
                            }
                            Spacer()

                            Text("\(course.termWeeks) Weeks")
                                .font(.system(size: 12, weight: .bold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(courseColor.opacity(0.15))
                                .foregroundColor(courseColor)
                                .clipShape(Capsule())
                        }

                        Divider()

                        // Peer Sharing Code Box
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("PEER SHARING CODE")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.gray)
                                Text(course.sharingCode)
                                    .font(.system(.subheadline, design: .monospaced))
                                    .fontWeight(.bold)
                            }
                            Spacer()

                            Button(action: copySharingCode) {
                                HStack(spacing: 4) {
                                    Image(systemName: isCopiedSharingCode ? "checkmark" : "doc.on.doc")
                                    Text(isCopiedSharingCode ? "Copied!" : "Copy Code")
                                }
                                .font(.system(size: 12, weight: .bold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(isCopiedSharingCode ? Color.green : courseColor)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                            }
                        }
                    }
                    .padding(16)
                    .background(Color.white)
                    .cornerRadius(16)
                    .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)

                    // MARK: - Course Assignments Section (At the Very Top)
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Course Assignments (\(course.assignments.count))")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.07, green: 0.11, blue: 0.20))

                        if course.assignments.isEmpty {
                            Text("No assignments scheduled for this course.")
                                .font(.system(size: 12.5))
                                .foregroundColor(.gray)
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.white)
                                .cornerRadius(12)
                        } else {
                            ForEach(course.assignments) { assignment in
                                HStack {
                                    Circle()
                                        .fill(courseColor)
                                        .frame(width: 8, height: 8)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(assignment.title)
                                            .font(.system(size: 14, weight: .bold))
                                        let weightText = (assignment.pointsPossible != nil && !assignment.pointsPossible!.trimmingCharacters(in: .whitespaces).isEmpty) ? " • \(assignment.pointsPossible!.trimmingCharacters(in: .whitespaces))" : ""
                                        Text("Due \(assignment.dueDate != nil ? formattedDate(assignment.dueDate!) : "TBD")\(weightText)")
                                            .font(.caption)
                                            .foregroundColor(.gray)
                                    }
                                    Spacer()
                                }
                                .padding(12)
                                .background(Color.white)
                                .cornerRadius(12)
                            }
                        }
                    }

                    // MARK: - Weekly Readings Section (Below Assignments)
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Course Readings")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.07, green: 0.11, blue: 0.20))

                        let sortedWeeks = course.weeks.sorted(by: { $0.computedStartDate < $1.computedStartDate })
                        let weeksWithReadings = sortedWeeks.filter { !$0.readings.isEmpty }

                        if weeksWithReadings.isEmpty {
                            Text("No readings scheduled for this course.")
                                .font(.system(size: 12.5))
                                .foregroundColor(.gray)
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.white)
                                .cornerRadius(12)
                        } else {
                            ForEach(weeksWithReadings) { week in
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("WEEK \(week.weekNumber)")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundColor(courseColor)

                                    ForEach(week.readings) { reading in
                                        HStack {
                                            Image(systemName: reading.mediaType.iconName)
                                                .foregroundColor(courseColor)
                                            Text(reading.title)
                                                .font(.system(size: 13, weight: .medium))
                                            Spacer()
                                        }
                                        .padding(10)
                                        .background(Color.white)
                                        .cornerRadius(10)
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(18)
            }
            .background(Color(red: 0.95, green: 0.96, blue: 0.98))
            .navigationTitle(course.courseCode ?? "Course Detail")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func copySharingCode() {
        #if os(iOS)
        UIPasteboard.general.string = course.sharingCode
        #elseif os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(course.sharingCode, forType: .string)
        #endif
        isCopiedSharingCode = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            isCopiedSharingCode = false
        }
    }

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "E, MMM d"
        return formatter.string(from: date)
    }
}
