import SwiftUI
import SwiftData

public struct AssignmentDetailView: View {
    @Bindable public var assignment: Assignment
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss


    @State private var selectedWeekNum: Int = 1
    @State private var weekTextState: String = "1"
    @State private var selectedModuleNum: Int = 0
    @State private var moduleTextState: String = ""
    @State private var dueDateState: Date = Date()
    @State private var cachedCourseStartDate: Date? = nil
    @State private var isSyncing: Bool = false
    @State private var isSyncingToCalendar: Bool = false
    @State private var calendarSyncSuccess: Bool = false
    @State private var calendarSyncMessage: String? = nil

    @State private var aiMilestones: [String] = []
    @State private var completedMilestones: Set<Int> = []
    @State private var isGeneratingMilestones: Bool = false
    @State private var showingEditSheet: Bool = false
    @State private var noteTextState: String = ""

    public init(assignment: Assignment) {
        self.assignment = assignment
        let initW = assignment.weekNumber > 0 ? assignment.weekNumber : 1
        _selectedWeekNum = State(initialValue: initW)
        _weekTextState = State(initialValue: "\(initW)")
        _moduleTextState = State(initialValue: assignment.moduleMention ?? "")
        _dueDateState = State(initialValue: assignment.dueDate ?? Date())
        _noteTextState = State(initialValue: assignment.noteText ?? "")
        _cachedCourseStartDate = State(initialValue: assignment.course?.weeks.compactMap({ $0.startDate }).min() ?? assignment.course?.earliestItemDate)
        if let mod = assignment.moduleMention, let match = mod.range(of: #"\d+"#, options: .regularExpression), let num = Int(mod[match]) {
            _selectedModuleNum = State(initialValue: num)
        } else {
            _selectedModuleNum = State(initialValue: 0)
        }

        if let stored = assignment.relevantTopics, stored.contains("|||") {
            let steps = stored.components(separatedBy: "|||").filter { !$0.isEmpty }
            _aiMilestones = State(initialValue: steps)
        }
    }

    private var courseCodeStr: String {
        if let code = assignment.courseCode ?? assignment.course?.courseCode, !code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return code.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return assignment.course?.courseName ?? "Course"
    }

    private var courseTitleStr: String {
        assignment.course?.courseName ?? "Course"
    }

    private var displayTitle: String {
        var raw = assignment.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cCode = assignment.courseCode ?? assignment.course?.courseCode
        let cName = assignment.course?.courseName

        if raw.isEmpty || (cCode != nil && raw.lowercased() == cCode!.lowercased()) || (cName != nil && raw.lowercased() == cName!.lowercased()) {
            return assignment.displaySubType.isEmpty ? "Assignment" : assignment.displaySubType
        }

        if let cCode = cCode, !cCode.isEmpty {
            let pattern = #"^(?i)\Q"# + cCode + #"\E\s*[:\-–\.]*\s*"#
            raw = raw.replacingOccurrences(of: pattern, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if let cName = cName, !cName.isEmpty {
            let pattern = #"^(?i)\Q"# + cName + #"\E\s*[:\-–\.]*\s*"#
            raw = raw.replacingOccurrences(of: pattern, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        raw = raw.replacingOccurrences(of: #"^[A-Z]{2,5}\s*\d{3,4}[A-Z]?\s*[:\-–\.]*\s*"#, with: "", options: [.regularExpression, .caseInsensitive]).trimmingCharacters(in: .whitespacesAndNewlines)

        return raw.isEmpty ? (assignment.displaySubType.isEmpty ? "Assignment" : assignment.displaySubType) : raw
    }

    private var courseColor: Color {
        CourseColorHelper.color(for: assignment.course?.hexColor ?? "#2563EB")
    }

    private static let rubricDelimiterRegex = try? NSRegularExpression(pattern: #"(?:\r?\n|\||;|\s*,\s*(?=[A-Za-z0-9\s]+[:\-–]|\d+\s*(?:pts|points|%)))"#)

    private var rubricItems: [(title: String, points: String, percentage: String)] {
        let structured = assignment.rubricCriteria
        if !structured.isEmpty {
            return structured.map { criterion in
                let ptsStr: String = {
                    if let pts = criterion.points {
                        return pts.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(pts)) pts" : "\(pts) pts"
                    }
                    return ""
                }()
                let pctStr: String = {
                    if let pct = criterion.percentage {
                        return pct.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(pct))%" : "\(pct)%"
                    } else if let desc = criterion.description, let match = desc.range(of: #"\b\d+(?:\.\d+)?\s*%"#, options: .regularExpression) {
                        let digits = desc[match].components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
                        return "\(digits)%"
                    }
                    return ""
                }()
                return (title: criterion.criterionName, points: ptsStr, percentage: pctStr)
            }
        }

        guard let breakdown = assignment.pointsBreakdown, !breakdown.isEmpty else { return [] }
        
        let rawSegments: [String]
        if let regex = Self.rubricDelimiterRegex {
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

        var result: [(title: String, points: String, percentage: String)] = []
        for segment in rawSegments {
            let trimmed = segment.replacingOccurrences(of: #"^[•\-\*▪●]\s*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }
            
            var working = trimmed
            var pctStr = ""
            if let pctMatch = working.range(of: #"\b\d+(?:\.\d+)?\s*%"#, options: .regularExpression) {
                let raw = String(working[pctMatch])
                let digits = raw.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
                if !digits.isEmpty { pctStr = "\(digits)%" }
                working.removeSubrange(pctMatch)
            }
            
            var ptsStr = ""
            if let ptsMatch = working.range(of: #"\b\d+(?:\.\d+)?\s*(?:pts|points|pt)\b"#, options: [.regularExpression, .caseInsensitive]) {
                let raw = String(working[ptsMatch])
                let digits = raw.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
                if !digits.isEmpty { ptsStr = "\(digits) pts" }
                working.removeSubrange(ptsMatch)
            }
            
            if ptsStr.isEmpty && pctStr.isEmpty {
                if let numMatch = working.range(of: #"\b\d+(?:\.\d+)?\b"#, options: .regularExpression) {
                    let raw = String(working[numMatch])
                    ptsStr = "\(raw) pts"
                    working.removeSubrange(numMatch)
                }
            }
            
            var cleanTitle = working
                .replacingOccurrences(of: #"^[\d\s\-\:\.\)]+"#, with: "", options: .regularExpression)
                .replacingOccurrences(of: #"[\:\-\–\(\)]+"#, with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
                
            if cleanTitle.isEmpty {
                cleanTitle = "Item"
            }
            
            result.append((title: cleanTitle, points: ptsStr, percentage: pctStr))
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
                    .font(.cpDescriptionBold)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(courseColor.opacity(0.15))
                    .foregroundColor(courseColor)
                    .cornerRadius(8)

                if let badge = assignment.contextBadgeText {
                    Text(badge)
                        .font(.cpDescriptionBold)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.gray.opacity(0.12))
                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        .cornerRadius(8)
                }

                subTypeBadgeView

                Spacer()
            }

            let topicTag: String? = assignment.moduleMention ?? assignment.course?.weeks.first(where: { $0.weekNumber == assignment.weekNumber })?.theme

            VStack(alignment: .leading, spacing: 8) {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .center, spacing: 8) {
                        Text(displayTitle)
                            .font(.cpPageTitle)
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                        if let weight = assignment.weightPercentage, !weight.isEmpty {
                            let cleanWeight = weight.contains("%") ? weight : "\(weight)%"
                            Text(cleanWeight)
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color(red: 0.14, green: 0.44, blue: 0.96))
                                .clipShape(Capsule())
                        }

                        if assignment.weekNumber > 0 {
                            Text("Week \(assignment.weekNumber)")
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                .clipShape(Capsule())
                        }

                        if let mod = topicTag, !mod.isEmpty, mod.count <= 14 {
                            Text(mod)
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                .clipShape(Capsule())
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text(displayTitle)
                            .font(.cpPageTitle)
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            .lineLimit(nil)
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: 8) {
                            if let weight = assignment.weightPercentage, !weight.isEmpty {
                                let cleanWeight = weight.contains("%") ? weight : "\(weight)%"
                                Text(cleanWeight)
                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    .clipShape(Capsule())
                            }

                            if assignment.weekNumber > 0 {
                                Text("Week \(assignment.weekNumber)")
                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                    .clipShape(Capsule())
                            }

                            if let mod = topicTag, !mod.isEmpty, mod.count <= 14 {
                                Text(mod)
                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }

                // If topic / module is long, render as a bigger pill so the entire title is fully visible
                if let mod = topicTag, !mod.isEmpty, mod.count > 14 {
                    Text(mod)
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .lineLimit(nil)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }

            HStack {
                if courseTitleStr != courseCodeStr {
                    Text(courseTitleStr)
                        .font(.cpDescriptionMedium)
                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                }

                Spacer()

                HStack(spacing: 5) {
                    Image(systemName: "calendar")
                        .font(.system(size: 12, weight: .bold))
                    if let due = assignment.dueDate {
                        Text(WeekDateConverter.formattedDueDate(for: due, weekNumber: assignment.weekNumber))
                            .font(.cpDescriptionBold)
                    } else if assignment.weekNumber > 0 {
                        Text("Week \(assignment.weekNumber)")
                            .font(.cpDescriptionBold)
                    } else {
                        Text("No due date specified")
                            .font(.cpDescriptionBold)
                    }
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
                                .font(.cpItemTitle)
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        }

                        HStack(spacing: 12) {
                            // Week Field (Editable keyboard number input, no pickers/toggles)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Week")
                                    .font(.cpDescriptionMedium)
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                HStack {
                                    TextField("1", text: $weekTextState)
                                        .keyboardType(.numberPad)
                                        .font(.cpDescriptionBold)
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                        .onChange(of: weekTextState) { _, newVal in
                                            let digits = newVal.filter { $0.isNumber }
                                            if digits != newVal { weekTextState = digits }
                                            if let w = Int(digits), w > 0 {
                                                guard !isSyncing else { return }
                                                isSyncing = true
                                                selectedWeekNum = w
                                                assignment.weekNumber = w
                                                isSyncing = false
                                            }
                                        }
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                                .cornerRadius(10)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            // Module Field
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Module")
                                    .font(.cpDescriptionMedium)
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                HStack(spacing: 6) {
                                    TextField("Module", text: $moduleTextState)
                                        .font(.cpDescriptionBold)
                                        .onChange(of: moduleTextState) { _, newVal in
                                            let trimmed = newVal.trimmingCharacters(in: .whitespacesAndNewlines)
                                            if !trimmed.isEmpty {
                                                assignment.relevantTopics = trimmed
                                            } else {
                                                assignment.relevantTopics = nil
                                            }
                                        }
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                                .cornerRadius(10)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        // Due Date Section
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Due Date")
                                .font(.cpDescriptionMedium)
                                .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                            if let due = assignment.dueDate {
                                HStack(spacing: 6) {
                                    DatePicker("", selection: Binding(
                                        get: { due },
                                        set: { newDate in
                                            guard !isSyncing else { return }
                                            isSyncing = true
                                            let cleanDate = Calendar.current.startOfDay(for: newDate)
                                            assignment.dueDate = cleanDate
                                            dueDateState = cleanDate
                                            if let firstDate = cachedCourseStartDate {
                                                let derivedW = WeekDateConverter.deriveWeekNumber(for: cleanDate, courseStartDate: firstDate)
                                                selectedWeekNum = derivedW
                                                weekTextState = "\(derivedW)"
                                                assignment.weekNumber = derivedW
                                            } else {
                                                let w = WeekDateConverter.weekNumber(for: cleanDate)
                                                selectedWeekNum = w
                                                weekTextState = "\(w)"
                                                assignment.weekNumber = w
                                            }
                                            try? modelContext.save()
                                            DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
                                            // Module is untouched
                                            isSyncing = false
                                        }
                                    ), displayedComponents: [.date])
                                    .labelsHidden()
                                    .font(.cpDescriptionMedium)

                                    Button {
                                        assignment.dueDate = nil
                                        try? modelContext.save()
                                        DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
                                    } label: {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundColor(.gray)
                                            .font(.system(size: 14))
                                    }
                                    .buttonStyle(.plain)
                                }
                            } else {
                                Button {
                                    let newD = Calendar.current.startOfDay(for: Date())
                                    assignment.dueDate = newD
                                    dueDateState = newD
                                    if let firstDate = cachedCourseStartDate {
                                        let derivedW = WeekDateConverter.deriveWeekNumber(for: newD, courseStartDate: firstDate)
                                        selectedWeekNum = derivedW
                                        weekTextState = "\(derivedW)"
                                        assignment.weekNumber = derivedW
                                    } else {
                                        let w = WeekDateConverter.weekNumber(for: newD)
                                        selectedWeekNum = w
                                        weekTextState = "\(w)"
                                        assignment.weekNumber = w
                                    }
                                    try? modelContext.save()
                                    DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
                                } label: {
                                    Text("No date set (+ Add)")
                                        .font(.cpDescriptionBold)
                                        .foregroundColor(.blue)
                                        .padding(.vertical, 6)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

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
                                    .font(.cpDescriptionBold)
                                    .foregroundColor(calendarSyncSuccess ? .green : Color(red: 0.14, green: 0.44, blue: 0.96))
                                Spacer()
                                if let msg = calendarSyncMessage, !calendarSyncSuccess {
                                    Text(msg)
                                        .font(.cpDescription)
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
                                    .fill(Color(red: 0.92, green: 0.94, blue: 0.97))
                                    .frame(width: 32, height: 32)
                                Image(systemName: "chart.bar.doc.horizontal.fill")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }
                            Text("Points Breakdown")
                                .font(.cpItemTitle)
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        }

                        // Top Row: Total Points Pill
                        HStack(spacing: 10) {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 0.90, green: 0.92, blue: 0.95))
                                    .frame(width: 30, height: 30)
                                Image(systemName: "number")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Total Points")
                                    .font(.cpDescription)
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                Text(assignment.pointsPossible ?? "100 Points")
                                    .font(.cpItemTitle)
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            }
                            Spacer()
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                        .cornerRadius(14)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(Color(red: 0.90, green: 0.92, blue: 0.95), lineWidth: 1)
                        )

                        // Rubric Items - Dedicated Pill Row for Each Item
                        if !rubricItems.isEmpty {
                            VStack(spacing: 8) {
                                ForEach(rubricItems.indices, id: \.self) { idx in
                                    let item = rubricItems[idx]
                                    HStack(alignment: .center, spacing: 8) {
                                        Text("\(idx + 1) -")
                                            .font(.system(size: 14, weight: .bold, design: .rounded))
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                                        Text(item.title)
                                            .font(.system(size: 14, weight: .bold, design: .rounded))
                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                                        Spacer()

                                        if !item.points.isEmpty {
                                            let cleanPts: String = {
                                                let raw = item.points.replacingOccurrences(of: "pts", with: "", options: .caseInsensitive)
                                                    .replacingOccurrences(of: "pt", with: "", options: .caseInsensitive)
                                                    .trimmingCharacters(in: .whitespacesAndNewlines)
                                                return raw.isEmpty ? item.points : "\(raw) pts"
                                            }()
                                            Text(cleanPts)
                                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                                .foregroundColor(Color(red: 0.15, green: 0.20, blue: 0.30))
                                                .padding(.horizontal, 9)
                                                .padding(.vertical, 4)
                                                .background(Color(red: 0.92, green: 0.94, blue: 0.97))
                                                .cornerRadius(8)
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 8)
                                                        .stroke(Color(red: 0.88, green: 0.90, blue: 0.93), lineWidth: 1)
                                                )
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
                        } else if let rawRubric = assignment.pointsBreakdown, !rawRubric.isEmpty {
                            Text(rawRubric)
                                .font(.cpDescription)
                                .foregroundColor(Color(red: 0.20, green: 0.25, blue: 0.35))
                                .lineSpacing(4)
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color(red: 0.97, green: 0.98, blue: 0.99))
                                .cornerRadius(12)
                        }
                    }
                    .padding(18)
                    .background(Color.white)
                    .cornerRadius(20)
                    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)

                    // MARK: - AI Study Roadmap & Milestones Section
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "sparkles")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(Color(red: 0.55, green: 0.27, blue: 0.96))
                            Text("AI Study Roadmap & Milestones")
                                .font(.cpItemTitle)
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Spacer()
                            if isGeneratingMilestones {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Button(action: { generateRoadmap() }) {
                                    HStack(spacing: 4) {
                                        Image(systemName: aiMilestones.isEmpty ? "wand.and.stars" : "arrow.clockwise")
                                            .font(.system(size: 11, weight: .bold))
                                        Text(aiMilestones.isEmpty ? "Generate" : "Regenerate")
                                            .font(.system(size: 11.5, weight: .semibold, design: .rounded))
                                    }
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(Color(red: 0.55, green: 0.27, blue: 0.96).opacity(0.12))
                                    .foregroundColor(Color(red: 0.55, green: 0.27, blue: 0.96))
                                    .cornerRadius(8)
                                }
                            }
                        }

                        if aiMilestones.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Let AI break down this assignment into actionable, step-by-step milestones to help you stay on track.")
                                    .font(.system(size: 13))
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                Button(action: { generateRoadmap() }) {
                                    HStack {
                                        Image(systemName: "sparkles")
                                        Text("Generate Actionable Milestones")
                                    }
                                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 10)
                                    .frame(maxWidth: .infinity)
                                    .background(Color(red: 0.55, green: 0.27, blue: 0.96))
                                    .cornerRadius(12)
                                }
                                .padding(.top, 4)
                            }
                        } else {
                            VStack(spacing: 8) {
                                ForEach(aiMilestones.indices, id: \.self) { idx in
                                    let isDone = completedMilestones.contains(idx)
                                    Button(action: {
                                        if isDone {
                                            completedMilestones.remove(idx)
                                        } else {
                                            completedMilestones.insert(idx)
                                            #if os(iOS)
                                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                            #endif
                                        }
                                    }) {
                                        HStack(spacing: 12) {
                                            Image(systemName: isDone ? "checkmark.circle.fill" : "circle")
                                                .font(.system(size: 18, weight: .semibold))
                                                .foregroundColor(isDone ? Color.green : Color.gray.opacity(0.4))
                                            Text(aiMilestones[idx])
                                                .font(.system(size: 13.5, weight: isDone ? .regular : .medium))
                                                .foregroundColor(isDone ? Color.gray : Color(red: 0.12, green: 0.16, blue: 0.24))
                                                .strikethrough(isDone, color: Color.gray.opacity(0.6))
                                                .multilineTextAlignment(.leading)
                                            Spacer()
                                        }
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 10)
                                        .background(isDone ? Color.green.opacity(0.06) : Color(red: 0.97, green: 0.98, blue: 0.99))
                                        .cornerRadius(12)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12)
                                                .stroke(isDone ? Color.green.opacity(0.2) : Color(red: 0.90, green: 0.92, blue: 0.95), lineWidth: 1)
                                        )
                                    }
                                }
                            }
                        }
                    }
                    .padding(18)
                    .background(Color.white)
                    .cornerRadius(20)
                    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)

                    // MARK: - Notes Section
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "note.text")
                                .foregroundColor(Color(red: 0.55, green: 0.27, blue: 0.96))
                            Text("Notes")
                                .font(.cpItemTitle)
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Spacer()
                        }

                        TextField("Add note or instruction...", text: Binding(
                            get: { noteTextState },
                            set: { newVal in
                                noteTextState = newVal
                                let clean = newVal.trimmingCharacters(in: .whitespacesAndNewlines)
                                assignment.noteText = clean.isEmpty ? nil : clean
                                try? modelContext.save()
                            }
                        ), axis: .vertical)
                        .font(.system(size: 15, weight: .regular, design: .rounded))
                        .lineSpacing(6)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 16)
                        .frame(maxWidth: .infinity, minHeight: 100, alignment: .topLeading)
                        .background(Color(red: 0.97, green: 0.98, blue: 0.99))
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color(red: 0.90, green: 0.92, blue: 0.95), lineWidth: 1)
                        )
                    }
                    .padding(18)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white)
                    .cornerRadius(20)
                    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)

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
                                    .font(.cpItemTitle)
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                if let theme = assignment.course?.weeks.first(where: { $0.weekNumber == assignment.weekNumber })?.theme, !theme.isEmpty {
                                    Text("Module Context: \(theme)")
                                        .font(.cpDescription)
                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                }
                            }
                        }

                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(Array(assignment.computedTopics.enumerated()), id: \.offset) { idx, topic in
                                HStack(alignment: .top, spacing: 8) {
                                    Text("\(idx + 1) -")
                                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    Text(topic)
                                        .font(.system(size: 15, weight: .medium, design: .rounded))
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                        .lineLimit(nil)
                                        .fixedSize(horizontal: false, vertical: true)
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
                                    .font(.cpItemTitle)
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
                                            let fullReadingTitleString: String = reading.displayTitleWithChapter

                                            Text(fullReadingTitleString)
                                                .font(.cpItemTitle)
                                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                .lineLimit(2)

                                            if let subtitle = reading.authorAndPagesSubtitle, !subtitle.isEmpty {
                                                Text(subtitle)
                                                    .font(.cpDescriptionMedium)
                                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                    .lineLimit(2)
                                            } else if let pages = reading.pagesText, !pages.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                                let cleanPages = pages.trimmingCharacters(in: .whitespacesAndNewlines)
                                                let pageLabel = cleanPages.lowercased().contains("pp") ? cleanPages : "pp. \(cleanPages)"
                                                Text(pageLabel)
                                                    .font(.cpDescriptionMedium)
                                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                            }
                                            let cleanReadingSummary: String = {
                                                let raw = reading.summaryText.trimmingCharacters(in: .whitespacesAndNewlines)
                                                let lower = raw.lowercased()
                                                if lower.hasPrefix("required reading") || lower.hasPrefix("see brightspace") || raw == reading.title || lower.contains("corey ch.") || lower.contains("yalom ch.") {
                                                    return ""
                                                }
                                                return raw
                                            }()
                                            if !cleanReadingSummary.isEmpty {
                                                Text(cleanReadingSummary)
                                                    .font(.cpDescription)
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
                                    .font(.cpItemTitle)
                            }

                            Link(destination: url) {
                                HStack {
                                    Image(systemName: "play.circle.fill")
                                        .font(.title3)
                                    Text(media)
                                        .font(.cpDescriptionMedium)
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
                ToolbarItem(placement: .primaryAction) {
                    Button("Edit") {
                        showingEditSheet = true
                    }
                    .font(.system(size: 15, weight: .semibold))
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 15, weight: .bold))
                }
            }
            .sheet(isPresented: $showingEditSheet, onDismiss: {
                noteTextState = assignment.noteText ?? ""
            }) {
                EditAssignmentSheet(assignment: assignment)
            }
            .onAppear {
                noteTextState = assignment.noteText ?? ""
            }
            .onDisappear {
                try? modelContext.save()
                DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
            }
        }
    }

    private func generateRoadmap() {
        guard !isGeneratingMilestones else { return }
        isGeneratingMilestones = true

        Task {
            let rubrics = rubricItems.map { "\($0.title): \([$0.points, $0.percentage].filter { !$0.isEmpty }.joined(separator: ", "))" }
            do {
                let steps = try await APIService.shared.generateAssignmentMilestones(
                    title: assignment.title,
                    instructions: assignment.fullInstructions,
                    weight: assignment.weightPercentage,
                    points: assignment.pointsPossible,
                    rubric: rubrics
                )
                await MainActor.run {
                    self.aiMilestones = steps
                    self.completedMilestones.removeAll()
                    self.assignment.relevantTopics = steps.joined(separator: "|||")
                    try? modelContext.save()
                    self.isGeneratingMilestones = false
                    #if os(iOS)
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    #endif
                }
            } catch {
                await MainActor.run {
                    self.isGeneratingMilestones = false
                }
            }
        }
    }

    private func formatNoteContent(_ text: String) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return text }
        
        // If the text already contains linebreaks, ensure clean double spacing between paragraphs
        if trimmed.contains("\n") {
            let lines = trimmed.components(separatedBy: .newlines)
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
            return lines.joined(separator: "\n\n")
        }
        
        var separated = trimmed
        // If it contains bullet markers like • or ▪ or ●, split them into distinct paragraphs
        separated = separated.replacingOccurrences(of: #"\s*[•▪●\*\-]+\s*(?=[A-Za-z0-9])"#, with: "\n\n", options: .regularExpression)
        
        // If it's a paragraph with multiple sentences, separate them into distinct paragraphs for easy reading
        let sentencePattern = #"(?<!\b(?:e\.g|i\.e|vs|p|pp|dr|mr|mrs|ms|prof|etc|fig|vol|no))\b([.?!])\s+(?=[A-Z0-9])"#
        if let regex = try? NSRegularExpression(pattern: sentencePattern, options: .caseInsensitive) {
            let range = NSRange(location: 0, length: (separated as NSString).length)
            separated = regex.stringByReplacingMatches(in: separated, options: [], range: range, withTemplate: "$1\n\n")
        }
        
        return separated.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
