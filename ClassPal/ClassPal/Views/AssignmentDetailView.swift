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

    private var rubricItems: [(title: String, points: String)] {
        guard let breakdown = assignment.pointsBreakdown, !breakdown.isEmpty else { return [] }
        let rawLines = breakdown
            .components(separatedBy: CharacterSet.newlines)
            .flatMap { $0.components(separatedBy: "|") }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        var result: [(title: String, points: String)] = []
        for line in rawLines {
            if line.contains(":") {
                let parts = line.components(separatedBy: ":")
                let title = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
                let pts = parts.dropFirst().joined(separator: ":").trimmingCharacters(in: .whitespacesAndNewlines)
                result.append((title: title, points: pts))
            } else if line.contains(" - ") {
                let parts = line.components(separatedBy: " - ")
                let title = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
                let pts = parts.dropFirst().joined(separator: " - ").trimmingCharacters(in: .whitespacesAndNewlines)
                result.append((title: title, points: pts))
            } else {
                result.append((title: line, points: ""))
            }
        }
        return result
    }

    @ViewBuilder
    private var subTypeBadgeView: some View {
        HStack(spacing: 4) {
            Image(systemName: assignment.subTypeIconName)
                .font(.system(size: 11, weight: .bold))
            Text(assignment.displaySubType)
                .font(.system(size: 11, weight: .bold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(Color.blue.opacity(0.12))
        .foregroundColor(.blue)
        .cornerRadius(8)
    }

    @ViewBuilder
    private var headerBannerView: some View {
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

                subTypeBadgeView

                Spacer()
            }

            Text(assignment.title)
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

            Text(courseTitleStr)
                .font(.system(size: 14, weight: .semibold, design: .rounded))
                .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .cornerRadius(20)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)
    }

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: true) {
                VStack(alignment: .leading, spacing: 20) {
                    headerBannerView

                    // MARK: - Points & Grading Section
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.12))
                                    .frame(width: 32, height: 32)
                                Image(systemName: "chart.bar.doc.horizontal.fill")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                            }
                            Text("Points & Grading Breakdown")
                                .font(.system(size: 17, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        }

                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Total Points Possible")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                Text(assignment.pointsPossible ?? "100 Points")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                            .cornerRadius(14)

                            if let weight = assignment.weightPercentage {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text("Grade Weight")
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                    Text(weight)
                                        .font(.system(size: 16, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                                }
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.green.opacity(0.08))
                                .cornerRadius(14)
                            }
                        }

                        if !rubricItems.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("How Points Are Made Up (Rubric Breakdown)")
                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.30, green: 0.38, blue: 0.50))

                                VStack(spacing: 8) {
                                    ForEach(rubricItems.indices, id: \.self) { idx in
                                        let item = rubricItems[idx]
                                        HStack {
                                            HStack(spacing: 8) {
                                                Circle()
                                                    .fill(Color(red: 0.14, green: 0.44, blue: 0.96))
                                                    .frame(width: 6, height: 6)
                                                Text(item.title)
                                                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                                                    .foregroundColor(Color(red: 0.15, green: 0.20, blue: 0.30))
                                            }
                                            Spacer()
                                            if !item.points.isEmpty {
                                                Text(item.points)
                                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                                    .padding(.horizontal, 8)
                                                    .padding(.vertical, 3)
                                                    .background(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.12))
                                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                                    .cornerRadius(6)
                                            }
                                        }
                                        .padding(.vertical, 6)
                                        .padding(.horizontal, 10)
                                        .background(Color.white)
                                        .cornerRadius(10)

                                        if idx < rubricItems.count - 1 {
                                            Divider()
                                                .opacity(0.5)
                                        }
                                    }
                                }
                                .padding(10)
                                .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                                .cornerRadius(12)
                            }
                        } else if let rawRubric = assignment.pointsBreakdown, !rawRubric.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("How Points Are Made Up (Rubric Breakdown)")
                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.30, green: 0.38, blue: 0.50))
                                Text(rawRubric)
                                    .font(.system(size: 13, weight: .regular))
                                    .foregroundColor(Color(red: 0.20, green: 0.25, blue: 0.35))
                                    .lineSpacing(4)
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

                    // MARK: - Relevant Topics & Module Context Section
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            ZStack {
                                Circle()
                                    .fill(Color.orange.opacity(0.12))
                                    .frame(width: 32, height: 32)
                                Image(systemName: "lightbulb.max.fill")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.orange)
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Relevant Topics & Key Concepts")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                if let theme = assignment.course?.weeks.first(where: { $0.weekNumber == assignment.weekNumber })?.theme, !theme.isEmpty {
                                    Text("Module Context: \(theme)")
                                        .font(.caption)
                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                }
                            }
                        }

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(assignment.computedTopics, id: \.self) { topic in
                                    HStack(spacing: 5) {
                                        Image(systemName: "tag.fill")
                                            .font(.system(size: 9, weight: .bold))
                                        Text(topic)
                                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                                    }
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.orange.opacity(0.1))
                                    .foregroundColor(Color(red: 0.82, green: 0.42, blue: 0.0))
                                    .cornerRadius(10)
                                }
                            }
                        }
                    }
                    .padding(18)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white)
                    .cornerRadius(20)
                    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)

                    // MARK: - Associated Course Readings & Materials Section
                    if !assignment.associatedReadings.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                ZStack {
                                    Circle()
                                        .fill(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.12))
                                        .frame(width: 32, height: 32)
                                    Image(systemName: "book.closed.fill")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                }
                                Text("Associated Course Readings & Materials")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            }

                            VStack(spacing: 10) {
                                ForEach(assignment.associatedReadings) { reading in
                                    HStack(spacing: 12) {
                                        ZStack {
                                            RoundedRectangle(cornerRadius: 8)
                                                .fill(Color(red: 0.92, green: 0.95, blue: 1.0))
                                                .frame(width: 32, height: 32)
                                            Image(systemName: reading.mediaType.iconName)
                                                .font(.system(size: 14, weight: .semibold))
                                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                        }

                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(reading.title)
                                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                .lineLimit(1)
                                            if let chapter = reading.chapterText, !chapter.isEmpty {
                                                Text(chapter)
                                                    .font(.caption)
                                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                            } else if let summary = reading.summaryText, !summary.isEmpty {
                                                Text(summary)
                                                    .font(.caption)
                                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                                    .lineLimit(1)
                                            }
                                        }

                                        Spacer()

                                        if let urlStr = reading.videoUrl, let url = URL(string: urlStr) {
                                            Link(destination: url) {
                                                Image(systemName: "arrow.up.right.circle.fill")
                                                    .font(.system(size: 18))
                                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                            }
                                        }
                                    }
                                    .padding(10)
                                    .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                                    .cornerRadius(12)
                                }
                            }
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
