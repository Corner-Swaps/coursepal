import SwiftUI
import SwiftData

public struct AssignmentDetailView: View {
    @Bindable public var assignment: Assignment
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var scratchpadText: String = ""
    @State private var isSavingNote: Bool = false
    @State private var debounceTask: Task<Void, Never>? = nil

    @State private var selectedWeekNum: Int = 1
    @State private var dueDateState: Date = Date()
    @State private var isSyncing: Bool = false
    @State private var isSyncingToCalendar: Bool = false
    @State private var calendarSyncSuccess: Bool = false
    @State private var calendarSyncMessage: String? = nil

    public init(assignment: Assignment) {
        self.assignment = assignment
        _scratchpadText = State(initialValue: assignment.noteText ?? "")
        _selectedWeekNum = State(initialValue: assignment.weekNumber)
        _dueDateState = State(initialValue: assignment.dueDate ?? WeekDateConverter.date(forWeek: assignment.weekNumber))
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
        
        let delimiterPattern = #"(?:\r?\n|\||;|\s*,\s*(?=[A-Za-z0-9\s]+[:\-–]|\d+\s*(?:pts|points|%)))"#
        let rawSegments: [String]
        if let regex = try? NSRegularExpression(pattern: delimiterPattern) {
            let nsString = breakdown as NSString
            let matches = regex.matches(in: breakdown, range: NSRange(location: 0, length: nsString.length))
            var segments: [String] = []
            var lastIdx = 0
            for match in matches {
                let r = NSRange(location: lastIdx, length: match.range.location - lastIdx)
                let sub = nsString.substring(with: r).trimmingCharacters(in: .whitespacesAndNewlines)
                if !sub.isEmpty { segments.append(sub) }
                lastIdx = match.range.location + match.range.length
            }
            let tail = nsString.substring(from: lastIdx).trimmingCharacters(in: .whitespacesAndNewlines)
            if !tail.isEmpty { segments.append(tail) }
            rawSegments = segments.isEmpty ? [breakdown] : segments
        } else {
            rawSegments = breakdown.components(separatedBy: CharacterSet(charactersIn: "\n|;,")).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        }

        var result: [(title: String, points: String)] = []
        for segment in rawSegments {
            let trimmed = segment.replacingOccurrences(of: #"^[•\-\*]\s*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }
            
            if let colonIdx = trimmed.firstIndex(of: ":") {
                let title = String(trimmed[..<colonIdx]).trimmingCharacters(in: .whitespacesAndNewlines)
                let pts = String(trimmed[trimmed.index(after: colonIdx)...]).trimmingCharacters(in: .whitespacesAndNewlines)
                result.append((title: title, points: pts))
            } else if let dashIdx = trimmed.range(of: " - ") {
                let title = String(trimmed[..<dashIdx.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
                let pts = String(trimmed[dashIdx.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                result.append((title: title, points: pts))
            } else if let match = trimmed.range(of: #"\b\d+\s*(?:pts|points|pt|%)\b"#, options: [.regularExpression, .caseInsensitive]) {
                let pts = String(trimmed[match]).trimmingCharacters(in: .whitespacesAndNewlines)
                let title = trimmed.replacingCharacters(in: match, with: "").replacingOccurrences(of: #"[\(\)]"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                result.append((title: title.isEmpty ? "Criterion" : title, points: pts))
            } else {
                result.append((title: trimmed, points: ""))
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
        VStack(alignment: .leading, spacing: 12) {
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
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

            HStack {
                Text(courseTitleStr)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))

                Spacer()

                HStack(spacing: 5) {
                    Image(systemName: "calendar.badge.clock")
                        .font(.system(size: 12, weight: .bold))
                    Text("Due: \(WeekDateConverter.formattedDueDate(for: assignment.dueDate, weekNumber: assignment.weekNumber))")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color(red: 0.85, green: 0.25, blue: 0.20).opacity(0.1))
                .foregroundColor(Color(red: 0.85, green: 0.25, blue: 0.20))
                .cornerRadius(8)
            }
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

                    // MARK: - Week & Due Date (Bidirectional Sync)
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            ZStack {
                                Circle()
                                    .fill(Color.blue.opacity(0.12))
                                    .frame(width: 32, height: 32)
                                Image(systemName: "calendar")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.blue)
                            }
                            Text("Schedule & Due Date")
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        }

                        HStack(spacing: 12) {
                            // Week Picker
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Week")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                Picker("Week", selection: $selectedWeekNum) {
                                    ForEach(1...20, id: \.self) { w in
                                        Text("Week \(w)").tag(w)
                                    }
                                }
                                .pickerStyle(.menu)
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                                .cornerRadius(10)
                                .onChange(of: selectedWeekNum) { _, newW in
                                    guard !isSyncing else { return }
                                    isSyncing = true
                                    assignment.weekNumber = newW
                                    let calcDate = WeekDateConverter.date(forWeek: newW)
                                    dueDateState = calcDate
                                    assignment.dueDate = calcDate
                                    isSyncing = false
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            // Due Date Picker
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Due Date & Time")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                DatePicker("", selection: $dueDateState, displayedComponents: [.date, .hourAndMinute])
                                    .labelsHidden()
                                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                                    .onChange(of: dueDateState) { _, newDate in
                                        guard !isSyncing else { return }
                                        isSyncing = true
                                        assignment.dueDate = newDate
                                        let calcWeek = WeekDateConverter.weekNumber(for: newDate)
                                        selectedWeekNum = calcWeek
                                        assignment.weekNumber = calcWeek
                                        isSyncing = false
                                    }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Divider()
                            .padding(.vertical, 2)

                        Button {
                            Task {
                                isSyncingToCalendar = true
                                let due = assignment.dueDate ?? dueDateState
                                let success = await CalendarSyncService.shared.syncAssignmentToCalendar(
                                    title: assignment.title,
                                    dueDate: due,
                                    courseCode: courseCodeStr,
                                    points: assignment.pointsPossible
                                )
                                isSyncingToCalendar = false
                                calendarSyncSuccess = success
                                calendarSyncMessage = CalendarSyncService.shared.syncMessage
                                
                                #if os(iOS)
                                let generator = UINotificationFeedbackGenerator()
                                generator.notificationOccurred(success ? .success : .error)
                                #endif
                            }
                        } label: {
                            HStack(spacing: 8) {
                                if isSyncingToCalendar {
                                    ProgressView()
                                        .scaleEffect(0.85)
                                } else {
                                    Image(systemName: calendarSyncSuccess ? "checkmark.circle.fill" : "calendar.badge.plus")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(calendarSyncSuccess ? .green : Color(red: 0.14, green: 0.44, blue: 0.96))
                                }
                                Text(calendarSyncSuccess ? "Synced to Apple Calendar" : "Add to Apple Calendar")
                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                    .foregroundColor(calendarSyncSuccess ? .green : Color(red: 0.14, green: 0.44, blue: 0.96))
                                Spacer()
                                if let msg = calendarSyncMessage, !calendarSyncSuccess {
                                    Text(msg)
                                        .font(.caption2)
                                        .foregroundColor(.red)
                                        .lineLimit(1)
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(calendarSyncSuccess ? Color.green.opacity(0.1) : Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.08))
                            .cornerRadius(12)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(18)
                    .background(Color.white)
                    .cornerRadius(20)
                    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)

                    // MARK: - Points & Grading Section
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.12))
                                    .frame(width: 32, height: 32)
                                Image(systemName: "chart.bar.doc.horizontal.fill")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                            }
                            Text("Points Breakdown")
                                .font(.system(size: 17, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        }

                        // Top Row: Grade Weight & Total Points Pills
                        HStack(spacing: 12) {
                            if let weight = assignment.weightPercentage, !weight.isEmpty {
                                HStack(spacing: 10) {
                                    ZStack {
                                        Circle()
                                            .fill(Color.green.opacity(0.18))
                                            .frame(width: 30, height: 30)
                                        Image(systemName: "percent")
                                            .font(.system(size: 12, weight: .bold))
                                            .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                                    }
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text("Grade Weight")
                                            .font(.system(size: 10.5, weight: .semibold))
                                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                        Text(weight)
                                            .font(.system(size: 15, weight: .bold, design: .rounded))
                                            .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                                    }
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.green.opacity(0.08))
                                .cornerRadius(14)
                            }

                            HStack(spacing: 10) {
                                ZStack {
                                    Circle()
                                        .fill(Color.blue.opacity(0.15))
                                        .frame(width: 30, height: 30)
                                    Image(systemName: "star.fill")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                }
                                VStack(alignment: .leading, spacing: 1) {
                                    Text("Total Points")
                                        .font(.system(size: 10.5, weight: .semibold))
                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                    Text(assignment.pointsPossible ?? "100 Points")
                                        .font(.system(size: 15, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                            .cornerRadius(14)
                        }

                        // Rubric Items - Dedicated Pill Row for Each Item
                        if !rubricItems.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Rubric Criteria")
                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.40, green: 0.48, blue: 0.58))

                                VStack(spacing: 8) {
                                    ForEach(rubricItems.indices, id: \.self) { idx in
                                        let item = rubricItems[idx]
                                        HStack(spacing: 10) {
                                            ZStack {
                                                Circle()
                                                    .fill(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.12))
                                                    .frame(width: 24, height: 24)
                                                Image(systemName: "checkmark")
                                                    .font(.system(size: 10, weight: .bold))
                                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                            }

                                            Text(item.title)
                                                .font(.system(size: 13.5, weight: .semibold, design: .rounded))
                                                .foregroundColor(Color(red: 0.12, green: 0.16, blue: 0.24))

                                            Spacer()

                                            if !item.points.isEmpty {
                                                Text(item.points)
                                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                                    .padding(.horizontal, 10)
                                                    .padding(.vertical, 4)
                                                    .background(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.12))
                                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                                    .cornerRadius(8)
                                            }
                                        }
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 10)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .background(Color(red: 0.97, green: 0.98, blue: 0.99))
                                        .cornerRadius(12)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12)
                                                .stroke(Color(red: 0.90, green: 0.92, blue: 0.95), lineWidth: 1)
                                        )
                                    }
                                }
                            }
                        } else if let rawRubric = assignment.pointsBreakdown, !rawRubric.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Rubric Details")
                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.40, green: 0.48, blue: 0.58))
                                Text(rawRubric)
                                    .font(.system(size: 13, weight: .medium, design: .rounded))
                                    .foregroundColor(Color(red: 0.20, green: 0.25, blue: 0.35))
                                    .lineSpacing(4)
                                    .padding(12)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color(red: 0.97, green: 0.98, blue: 0.99))
                                    .cornerRadius(12)
                            }
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
                                            if let pagesOrChapter = reading.chapterAndPagesDisplay {
                                                Text(pagesOrChapter)
                                                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                            }
                                            if !reading.summaryText.isEmpty {
                                                Text(reading.summaryText)
                                                    .font(.caption)
                                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                                    .lineLimit(2)
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
