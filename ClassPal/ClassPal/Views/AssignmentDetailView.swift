import SwiftUI
import SwiftData

public struct AssignmentDetailView: View {
    @Bindable public var assignment: Assignment
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var scratchpadText: String = ""
    @State private var isSavingNote: Bool = false
    @State private var debounceTask: Task<Void, Never>? = nil

    public init(assignment: Assignment) {
        self.assignment = assignment
        _scratchpadText = State(initialValue: assignment.noteText ?? "")
    }

    private var courseCodeStr: String {
        assignment.course?.courseCode ?? assignment.courseCode ?? "CRS"
    }

    private var courseTitleStr: String {
        assignment.course?.courseName ?? "Course"
    }

    private var courseColor: Color {
        CourseColorHelper.color(for: assignment.course?.hexColor ?? "#2563EB")
    }

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: true) {
                VStack(alignment: .leading, spacing: 20) {

                    // MARK: - Header Banner (Course Code, Course Title, Assignment Title 3-5 words max)
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 8) {
                            Text(courseCodeStr)
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(courseColor.opacity(0.15))
                                .foregroundColor(courseColor)
                                .cornerRadius(8)

                            Text("Week \(assignment.weekNumber)")
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Color.gray.opacity(0.12))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                .cornerRadius(8)

                            HStack(spacing: 4) {
                                Image(systemName: assignment.subTypeIconName)
                                    .font(.system(size: 11, weight: .bold))
                                Text(assignment.displaySubType)
                                    .font(.system(size: 11, weight: .bold))
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.purple.opacity(0.12))
                            .foregroundColor(.purple)
                            .cornerRadius(8)

                            Spacer()
                        }

                        Text(courseTitleStr)
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))

                        Text(assignment.title)
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            .lineLimit(3)

                        if let dueDate = assignment.dueDate {
                            HStack(spacing: 6) {
                                Image(systemName: "calendar")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(Color(red: 0.85, green: 0.25, blue: 0.20))
                                Text("Due \(dueDate.formatted(date: .complete, time: .shortened))")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }
                            .padding(.top, 2)
                        }
                    }
                    .padding(18)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white)
                    .cornerRadius(20)
                    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)

                    // MARK: - Points & Grading Section
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "chart.bar.doc.horizontal.fill")
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                            Text("Points & Grading Breakdown")
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        }

                        HStack(spacing: 12) {
                            if let pts = assignment.pointsPossible {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Points Possible")
                                        .font(.caption)
                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                    Text(pts)
                                        .font(.system(size: 15, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                }
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                                .cornerRadius(12)
                            }

                            if let weight = assignment.weightPercentage {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Grade Weight")
                                        .font(.caption)
                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                    Text(weight)
                                        .font(.system(size: 15, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                                }
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.green.opacity(0.08))
                                .cornerRadius(12)
                            }
                        }

                        if let rubric = assignment.pointsBreakdown, !rubric.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Rubric Breakdown")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                Text(rubric)
                                    .font(.system(size: 13, weight: .regular))
                                    .foregroundColor(Color(red: 0.20, green: 0.25, blue: 0.35))
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                            .cornerRadius(12)
                        }
                    }
                    .padding(18)
                    .background(Color.white)
                    .cornerRadius(20)
                    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)

                    // MARK: - Description & Requirements Section
                    if let instructions = assignment.fullInstructions, !instructions.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Image(systemName: "text.alignleft")
                                    .foregroundColor(Color(red: 0.55, green: 0.27, blue: 0.96))
                                Text("Description & Requirements")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            }

                            Text(instructions)
                                .font(.system(size: 14, weight: .regular, design: .rounded))
                                .foregroundColor(Color(red: 0.20, green: 0.25, blue: 0.35))
                                .lineSpacing(4)
                        }
                        .padding(18)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white)
                        .cornerRadius(20)
                        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)
                    }

                    // MARK: - Attached Media & Clickable Links
                    if let media = assignment.mediaUrl, !media.isEmpty, let url = URL(string: media) {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Image(systemName: "link.circle.fill")
                                    .foregroundColor(.blue)
                                Text("Attached Media / Resource Link")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                            }

                            Link(destination: url) {
                                HStack {
                                    Image(systemName: "play.circle.fill")
                                        .font(.title3)
                                    Text(media)
                                        .font(.system(size: 13, weight: .medium))
                                        .lineLimit(1)
                                    Spacer()
                                    Image(systemName: "arrow.up.right")
                                        .font(.caption.bold())
                                }
                                .padding(12)
                                .background(Color.blue.opacity(0.1))
                                .cornerRadius(12)
                            }
                        }
                        .padding(18)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white)
                        .cornerRadius(20)
                        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)
                    }

                    // MARK: - Personal Scratchpad & Notes
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Image(systemName: "note.text")
                                .foregroundColor(.purple)
                            Text("Personal Notes & Scratchpad")
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Spacer()
                            if isSavingNote {
                                ProgressView()
                                    .scaleEffect(0.8)
                            }
                        }

                        TextEditor(text: $scratchpadText)
                            .frame(minHeight: 120)
                            .padding(8)
                            .background(Color(red: 0.97, green: 0.98, blue: 0.99))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.purple.opacity(0.2), lineWidth: 1)
                            )
                            .onChange(of: scratchpadText) { _, newValue in
                                assignment.noteText = newValue
                                debounceTask?.cancel()
                                debounceTask = Task {
                                    try? await Task.sleep(nanoseconds: 1_000_000_000)
                                    guard !Task.isCancelled else { return }
                                    isSavingNote = true
                                    await OfflineLedgerManager.shared.enqueueSaveNote(
                                        assignmentId: assignment.id.uuidString,
                                        noteText: newValue
                                    )
                                    isSavingNote = false
                                }
                            }
                    }
                    .padding(18)
                    .background(Color.white)
                    .cornerRadius(20)
                    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 18)
            }
            .background(Color(red: 0.95, green: 0.96, blue: 0.98))
            .navigationTitle("Assignment Details")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 15, weight: .bold))
                }
            }
        }
    }
}
