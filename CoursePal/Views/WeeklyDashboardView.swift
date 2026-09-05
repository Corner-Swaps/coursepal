import SwiftUI
import SwiftData

// MARK: - CoursePal Theme & Course Color Palette
public struct CoursePalTheme {
    public static let textDark = Color(red: 0.07, green: 0.11, blue: 0.20)      // Deep Slate Dark
    public static let textMuted = Color(red: 0.35, green: 0.42, blue: 0.52)     // Crisp Slate Gray
    public static let accentBlue = Color(red: 0.14, green: 0.44, blue: 0.96)    // Electric Blue
    public static let pillBlueBg = Color(red: 0.89, green: 0.93, blue: 1.0)     // Soft Blue Pill
    public static let bgCanvas = Color(red: 0.95, green: 0.96, blue: 0.98)      // Light Slate Canvas
    public static let cardBg = Color.white                                       // Pure White Card
}

// MARK: - Standardized 3-Tier Typography (1 Font: System Rounded, 3 Sizes & Weights)
extension Font {
    /// Tier 1 (Thick / Bold): Page Titles, Screen Headers, Modal Titles (21.5pt Bold Rounded - 10% reduction)
    public static let cpPageTitle = Font.system(size: 21.5, weight: .bold, design: .rounded)
    
    /// Tier 2 (Thick / Bold): Item Titles, Assignment Names, Reading Titles, Course Names, Card Titles, Add Buttons (14.5pt Bold Rounded - 10% reduction)
    public static let cpItemTitle = Font.system(size: 14.5, weight: .bold, design: .rounded)
    
    /// Tier 3 (Thin / Regular): Descriptions, Dates, Subtitles, Metadata, Body Text (13pt Regular/Medium/Bold Rounded)
    public static let cpDescription = Font.system(size: 13, weight: .regular, design: .rounded)
    public static let cpDescriptionMedium = Font.system(size: 13, weight: .medium, design: .rounded)
    public static let cpDescriptionBold = Font.system(size: 13, weight: .bold, design: .rounded)
}

// MARK: - Fuzzed Top & Bottom Scroll Edges Modifier
extension View {
    public func fuzzedScrollEdges(top: CGFloat = 36, bottom: CGFloat = 85) -> some View {
        self.mask(
            VStack(spacing: 0) {
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0.0),
                        .init(color: .black.opacity(0.4), location: 0.45),
                        .init(color: .black, location: 1.0)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: top)

                Rectangle()
                    .fill(Color.black)

                LinearGradient(
                    stops: [
                        .init(color: .black, location: 0.0),
                        .init(color: .black.opacity(0.4), location: 0.55),
                        .init(color: .clear, location: 1.0)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: bottom)
            }
        )
    }
}

// MARK: - Reading Title Cleaner & Chapter Extractor Engine
public struct ReadingTitleCleaner {
    /// Extracts chapter info such as "Chapter 1", "Ch. 1", "Chapter 1–2", "Chapter 6 & 7", etc.
    public static func extractChapter(from text: String) -> String? {
        let pattern = #"(?i)\b(chapters?|chs?\.?)\s*\d+([\s&,\-–]+\d+)?"#
        if let range = text.range(of: pattern, options: .regularExpression) {
            let extracted = String(text[range]).trimmingCharacters(in: .whitespacesAndNewlines)
            if extracted.lowercased().hasPrefix("chapter") {
                return extracted.capitalized
            } else if extracted.lowercased().hasPrefix("ch") {
                return extracted.replacingOccurrences(of: "ch", with: "Ch", options: .caseInsensitive)
            }
            return extracted
        }
        return nil
    }

    /// Cleans reading titles by stripping out "Week 1", "Week 2", "Week N", "Week N Core Concepts", 
    /// "C Week N Core Concepts", and leading "Chapter N Textbook & Lecture Notes: " prefixes.
    public static func cleanTitle(_ title: String) -> String {
        var clean = title

        // 1. Strip leading "Chapter N Textbook & Lecture Notes: " if present
        clean = clean.replacingOccurrences(of: #"(?i)^chapter\s*\d+([\s&,\-–]+\d+)?\s*textbook\s*&\s*lecture\s*notes:\s*"#, with: "Textbook & Lecture Notes: ", options: .regularExpression)

        // 2. Strip "Chapter N — ", "Ch. N — ", "Chapter N: " from the middle/beginning if extracted separately
        clean = clean.replacingOccurrences(of: #"(?i)\bchapter\s*\d+([\s&,\-–]+\d+)?\s*[\:\—\-]\s*"#, with: "", options: .regularExpression)

        // 3. Strip "C Week N Core Concepts", "Week N Core Concepts", "Week N" patterns
        clean = clean.replacingOccurrences(of: #"(?i)\b[a-z0-9]*\s*week\s*\d+\s*(core\s*concepts)?\b"#, with: "", options: .regularExpression)
        clean = clean.replacingOccurrences(of: #"(?i)\bcore\s*concepts\s*core\s*concepts\b"#, with: "Core Concepts", options: .regularExpression)

        // 4. Cleanup trailing or leading separators/whitespace
        clean = clean.replacingOccurrences(of: #":\s*:"#, with: ":")
        clean = clean.replacingOccurrences(of: #"\s+:\s*$"#, with: "", options: .regularExpression)
        clean = clean.replacingOccurrences(of: #"\s+-\s*$"#, with: "", options: .regularExpression)
        clean = clean.trimmingCharacters(in: .whitespacesAndNewlines)

        if clean.hasPrefix(":") || clean.hasPrefix("-") || clean.hasPrefix("—") {
            clean = String(clean.dropFirst()).trimmingCharacters(in: .whitespaces)
        }

        return clean.isEmpty ? title : clean
    }
}

public struct WeeklyDashboardView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Course.createdAt, order: .reverse) private var courses: [Course]
    @Query(sort: \Week.weekNumber) private var allWeeks: [Week]
    @Query(filter: #Predicate<Reading> { !$0.isDeleted }) private var readings: [Reading]
    @Query(filter: #Predicate<Assignment> { !$0.isDeleted }) private var dbAssignments: [Assignment]
    @Query(filter: #Predicate<Reading> { $0.isDeleted }) private var deletedReadings: [Reading]
    @Query(filter: #Predicate<Assignment> { $0.isDeleted }) private var deletedAssignments: [Assignment]

    @State private var selectedDate: Date = Date()
    @State private var isDateFilterActive: Bool = false
    @State private var searchQuery: String = ""
    @State private var selectedWeekFilter: Int = 0 // 0 = All Weeks, 1..16
    @State private var sortMode: String = "readings" // "readings", "completed", "trash"
    @State private var showingAddModal: Bool = false
    @State private var showingScanSheet: Bool = false
    @State private var selectedReadingForInfo: Reading? = nil
    @State private var selectedCourseForDrillDown: Course? = nil
    @State private var itemToDelete: Reading? = nil
    @State private var showingDeleteConfirm: Bool = false
    @State private var showingCompletedSheet: Bool = false
    @State private var showingTrashSheet: Bool = false
    @State private var selectedCourseFilter: Course? = nil
    @State private var showingCourseFilterSheet: Bool = false
    @State private var showingInfoSheet: Bool = false
    @State private var showingEmptyTrashConfirmation: Bool = false
    @State private var courseForAIChat: Course? = nil
    @State private var showingConfetti: Bool = false
    @State private var confettiTitle: String = ""

    private var completedCount: Int {
        readings.filter({ !$0.isDeleted && $0.isCompleted }).count
    }

    private var activeReadings: [Reading] {
        var list = readings
        if let selectedCourseFilter {
            list = list.filter { $0.week?.course?.persistentModelID == selectedCourseFilter.persistentModelID }
        }
        if !searchQuery.isEmpty {
            list = list.filter { $0.title.localizedCaseInsensitiveContains(searchQuery) }
        }
        if isDateFilterActive {
            let cal = Calendar.current
            let exactMatches = list.filter { r in
                guard let due = r.dueDate else { return false }
                return cal.isDate(due, inSameDayAs: selectedDate)
            }
            if !exactMatches.isEmpty {
                list = exactMatches
            } else if let matchedWeek = weekNumber(for: selectedDate) {
                list = list.filter { ($0.week?.weekNumber ?? 0) == matchedWeek }
            } else {
                list = []
            }
        }
        return list
    }

    private func weekNumber(for date: Date) -> Int? {
        let cal = Calendar.current
        let targetDay = cal.startOfDay(for: date)
        for r in readings where !r.isDeleted {
            if let due = r.dueDate, cal.isDate(due, inSameDayAs: targetDay) {
                if let w = r.week?.weekNumber, w > 0 {
                    return w
                }
            }
        }
        for w in allWeeks where w.weekNumber > 0 {
            let wStart = cal.startOfDay(for: w.computedStartDate)
            let wEnd = cal.date(byAdding: .day, value: 7, to: wStart) ?? wStart
            if targetDay >= wStart && targetDay < wEnd {
                return w.weekNumber
            }
        }
        return nil
    }

    private var deletedReadingsCount: Int {
        deletedReadings.count + deletedAssignments.count
    }

    // Group active readings by week number (for lookup)
    private var readingsByWeek: [Int: [Reading]] {
        var grouped: [Int: [Reading]] = [:]
        for reading in activeReadings {
            let weekNum = reading.week?.weekNumber ?? 0
            grouped[weekNum, default: []].append(reading)
        }
        return grouped
    }

    // All course weeks sorted chronologically by calendar date (earliest dates first)
    private var sortedCourseWeeks: [Week] {
        let filtered = allWeeks.filter { $0.course != nil && $0.weekNumber > 0 }
        return filtered.sorted { w1, w2 in
            if w1.computedStartDate != w2.computedStartDate {
                return w1.computedStartDate < w2.computedStartDate
            }
            return w1.weekNumber < w2.weekNumber
        }
    }

    // Week numbers ordered strictly by their earliest calendar date (e.g. Sept 5 before Sept 20)
    private var courseWeekNumbers: [Int] {
        var earliestDateForWeek: [Int: Date] = [:]
        for reading in activeReadings {
            let w = reading.week?.weekNumber ?? 0
            if w > 0 {
                if let d = reading.dueDate {
                    if let existing = earliestDateForWeek[w] {
                        if d < existing { earliestDateForWeek[w] = d }
                    } else {
                        earliestDateForWeek[w] = d
                    }
                } else if let wStart = reading.week?.startDate {
                    if let existing = earliestDateForWeek[w] {
                        if wStart < existing { earliestDateForWeek[w] = wStart }
                    } else {
                        earliestDateForWeek[w] = wStart
                    }
                }
            }
        }
        for week in sortedCourseWeeks where week.weekNumber > 0 {
            if earliestDateForWeek[week.weekNumber] == nil {
                earliestDateForWeek[week.weekNumber] = week.computedStartDate
            }
        }
        let sortedPositiveWeeks = Array(earliestDateForWeek.keys).sorted { w1, w2 in
            let date1 = earliestDateForWeek[w1] ?? WeekDateConverter.date(forWeek: w1)
            let date2 = earliestDateForWeek[w2] ?? WeekDateConverter.date(forWeek: w2)
            if date1 != date2 {
                return date1 < date2
            }
            return w1 < w2
        }

        let hasWeek0 = activeReadings.contains(where: { ($0.week?.weekNumber ?? 0) == 0 })
        if hasWeek0 {
            return [0] + sortedPositiveWeeks
        }
        return sortedPositiveWeeks
    }

    public enum CourseGroupingType {
        case week
        case module
        case unit
        case session
        case none
    }

    // Detect whether the course or active readings are structured by Modules, Weeks, Sessions, or Units
    private var courseGroupingType: CourseGroupingType {
        var moduleCount = 0
        var weekCount = 0
        var unitCount = 0
        var sessionCount = 0
        for r in activeReadings {
            let top = (r.relevantTopics ?? "").lowercased()
            let theme = (r.week?.theme ?? "").lowercased()
            if top.contains("module") || theme.contains("module") { moduleCount += 1 }
            if top.contains("week") || theme.contains("week") { weekCount += 1 }
            if top.contains("unit") || theme.contains("unit") { unitCount += 1 }
            if top.contains("session") || theme.contains("session") { sessionCount += 1 }
        }
        for w in sortedCourseWeeks {
            let theme = (w.theme ?? "").lowercased()
            if theme.contains("module") { moduleCount += 1 }
            if theme.contains("week") && !theme.hasPrefix("week ") { weekCount += 1 }
        }
        if moduleCount > weekCount && moduleCount > 0 {
            return .module
        } else if weekCount > 0 {
            return .week
        } else if unitCount > 0 {
            return .unit
        } else if sessionCount > 0 {
            return .session
        } else {
            let distinctWeeks = Set(activeReadings.compactMap { $0.week?.weekNumber }).filter { $0 > 1 }
            if distinctWeeks.count >= 2 {
                return .week
            }
            return .none
        }
    }

    private var courseSectionKind: String {
        switch courseGroupingType {
        case .module: return "Module"
        case .week: return "Week"
        case .unit: return "Unit"
        case .session: return "Session"
        case .none: return ""
        }
    }

    private func sectionMetadata(for weekNum: Int) -> (pillTitle: String, headerBadge: String, isBreak: Bool) {
        let weekReadings = readingsByWeek[weekNum] ?? []
        let weekObj = allWeeks.first(where: { $0.weekNumber == weekNum })
        let rawTheme = weekObj?.theme ?? weekReadings.compactMap({ $0.relevantTopics }).first

        let lower = (rawTheme ?? "").lowercased()
        let isBreak = lower.contains("reading week") || lower.contains("spring break") || lower.contains("break")

        if isBreak {
            return (
                pillTitle: "Break",
                headerBadge: "Reading Week",
                isBreak: true
            )
        }

        switch courseGroupingType {
        case .module:
            return (pillTitle: "Mod \(weekNum)", headerBadge: "Module \(weekNum)", isBreak: false)
        case .week:
            return (pillTitle: "Week \(weekNum)", headerBadge: "Week \(weekNum)", isBreak: false)
        case .unit:
            return (pillTitle: "Unit \(weekNum)", headerBadge: "Unit \(weekNum)", isBreak: false)
        case .session:
            return (pillTitle: "Session \(weekNum)", headerBadge: "Session \(weekNum)", isBreak: false)
        case .none:
            return (pillTitle: "All", headerBadge: "Course Readings", isBreak: false)
        }
    }

    private func scheduledDate(for reading: Reading) -> Date {
        if let due = reading.dueDate { return due }
        if let start = reading.week?.startDate { return start }
        let w = reading.week?.weekNumber ?? 1
        return WeekDateConverter.date(forWeek: w)
    }

    // Active week numbers that currently have readings (or single week if filtered)
    private var activeWeekNumbersWithReadings: [Int] {
        if selectedWeekFilter > 0 {
            return [selectedWeekFilter]
        }
        let weeksWithReadings = Set(readingsByWeek.filter({ !$0.value.isEmpty }).map({ $0.key }))
        var ordered: [Int] = []
        for w in courseWeekNumbers where weeksWithReadings.contains(w) && w > 0 {
            if !ordered.contains(w) { ordered.append(w) }
        }
        let remainingPositive = weeksWithReadings.filter({ $0 > 0 && !ordered.contains($0) }).sorted()
        ordered.append(contentsOf: remainingPositive)
        if weeksWithReadings.contains(0) {
            ordered.append(0)
        }
        return ordered
    }

    private func weekModuleMention(for weekNum: Int) -> String? {
        if let selectedCourseFilter {
            guard selectedCourseFilter.hasDocumentModules else { return nil }
            return selectedCourseFilter.weeks.first(where: { $0.weekNumber == weekNum })?.moduleMention
                ?? selectedCourseFilter.cachedModuleForWeek(weekNum)
        }
        let weekReadings = readingsByWeek[weekNum] ?? []
        for r in weekReadings {
            if let course = r.week?.course, course.hasDocumentModules {
                if let mod = r.week?.moduleMention ?? course.cachedModuleForWeek(weekNum) {
                    return mod
                }
            }
        }
        return nil
    }

    private func weekDateRange(for weekNum: Int) -> String? {
        let weekReadings = readingsByWeek[weekNum] ?? []
        for r in weekReadings {
            if let range = r.week?.dateRangeStr, !range.isEmpty, range.lowercased() != "unknown" {
                return range
            }
            if let range = r.dateRangeStr, !range.isEmpty, range.lowercased() != "unknown" {
                return range
            }
        }
        if let w = allWeeks.first(where: { $0.weekNumber == weekNum }) {
            if let range = w.dateRangeStr, !range.isEmpty, range.lowercased() != "unknown" {
                return range
            }
        }
        return nil
    }

    // MARK: - Static Formatters (Zero allocations per render)
    private static let dayNameFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateFormat = "EEEE"
        return df
    }()

    private static let monthYearFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateFormat = "MMMM yyyy"
        return df
    }()

    private static let bannerDateFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateStyle = .medium
        return df
    }()

    private func dayNumber(for date: Date) -> Int {
        Calendar.current.component(.day, from: date)
    }

    private func dayNameString(for date: Date) -> String {
        Self.dayNameFormatter.string(from: date)
    }

    private func monthYearString(for date: Date) -> String {
        Self.monthYearFormatter.string(from: date)
    }

    private var readingsByDay: [Date: [Reading]] {
        var dict: [Date: [Reading]] = [:]
        let cal = Calendar.current
        let source = (selectedCourseFilter != nil)
            ? readings.filter { !$0.isDeleted && $0.week?.course?.persistentModelID == selectedCourseFilter?.persistentModelID }
            : readings.filter { !$0.isDeleted }

        for r in source {
            guard let due = r.dueDate else { continue }
            let start = cal.startOfDay(for: due)
            dict[start, default: []].append(r)
        }
        return dict
    }

    private func hasReadingOnDate(_ date: Date) -> Bool {
        let dayKey = Calendar.current.startOfDay(for: date)
        return !(readingsByDay[dayKey]?.isEmpty ?? true)
    }

    private func courseColorsForDate(_ date: Date) -> [Color] {
        let dayKey = Calendar.current.startOfDay(for: date)
        let matching = readingsByDay[dayKey] ?? []
        let colors = Array(Set(matching.map { CourseColorHelper.color(for: $0.week?.course?.hexColor ?? "#2563EB") }))
        return colors.isEmpty ? [Color(red: 0.14, green: 0.44, blue: 0.96)] : Array(colors.prefix(3))
    }

    private func generateDaysInMonth(for date: Date) -> [Date?] {
        let calendar = Calendar.current
        guard let monthInterval = calendar.dateInterval(of: .month, for: date),
              let firstDay = calendar.date(from: calendar.dateComponents([.year, .month], from: monthInterval.start)) else {
            return []
        }

        let firstWeekday = calendar.component(.weekday, from: firstDay) - 1
        let numberOfDays = calendar.range(of: .day, in: .month, for: date)?.count ?? 30

        var days: [Date?] = Array(repeating: nil, count: firstWeekday)
        for day in 0..<numberOfDays {
            if let dayDate = calendar.date(byAdding: .day, value: day, to: firstDay) {
                days.append(dayDate)
            }
        }
        return days
    }

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 16) {

                    // MARK: - Page Header (Top Title & Top Right Action Pills: Filter, Done Checkmark, Trash)
                    let remainingTotalCount = activeReadings.filter({ !$0.isCompleted }).count

                    HStack(alignment: .center) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Readings")
                                .font(.cpPageTitle)
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("\(remainingTotalCount) reading\(remainingTotalCount == 1 ? "" : "s") remaining")
                                .font(.cpDescriptionMedium)
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }

                        Spacer()

                        HStack(spacing: 5) {
                            // Filter Pill (On the LEFT of the Checkmark)
                            Button(action: {
                                showingCourseFilterSheet = true
                            }) {
                                Image(systemName: "line.3.horizontal.decrease.circle.fill")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(selectedCourseFilter != nil ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.35, green: 0.42, blue: 0.52))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 6)
                                    .background(selectedCourseFilter != nil ? Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.15) : Color.white)
                                    .cornerRadius(12)
                                    .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
                            }
                            .buttonStyle(.plain)

                            // Completed Pill (Checkmark)
                            Button(action: {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    sortMode = (sortMode == "completed") ? "readings" : "completed"
                                }
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(Color(red: 0.18, green: 0.72, blue: 0.40))
                                    Text("\(completedCount)")
                                        .font(.cpDescriptionBold)
                                        .foregroundColor(Color(red: 0.18, green: 0.72, blue: 0.40))
                                }
                                .padding(.horizontal, 9)
                                .padding(.vertical, 6)
                                .background(sortMode == "completed" ? Color(red: 0.18, green: 0.72, blue: 0.40).opacity(0.15) : Color.white)
                                .cornerRadius(12)
                                .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
                            }
                            .buttonStyle(.plain)

                            // Trash Pill (Deleted Count)
                            Button(action: {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    sortMode = (sortMode == "trash") ? "readings" : "trash"
                                }
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "trash")
                                        .font(.system(size: 14, weight: .regular))
                                        .foregroundColor(Color(red: 0.85, green: 0.25, blue: 0.20))
                                    Text("\(deletedReadingsCount)")
                                        .font(.cpDescriptionBold)
                                        .foregroundColor(Color(red: 0.85, green: 0.25, blue: 0.20))
                                }
                                .padding(.horizontal, 9)
                                .padding(.vertical, 6)
                                .background(sortMode == "trash" ? Color(red: 0.85, green: 0.25, blue: 0.20).opacity(0.15) : Color.white)
                                .cornerRadius(12)
                                .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 18)

                    // MARK: - Interactive Deadlines Calendar Card (Matching Assignments)
                    VStack(spacing: 12) {
                        // Month Nav Header (< Month Year >)
                        HStack {
                            Button(action: {
                                if let prev = Calendar.current.date(byAdding: .month, value: -1, to: selectedDate) {
                                    selectedDate = prev
                                }
                            }) {
                                Image(systemName: "chevron.left")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }
                            .buttonStyle(.plain)

                            Spacer()

                            Text(monthYearString(for: selectedDate))
                                .font(.cpItemTitle)
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                            Spacer()

                            Button(action: {
                                if let next = Calendar.current.date(byAdding: .month, value: 1, to: selectedDate) {
                                    selectedDate = next
                                }
                            }) {
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }
                            .buttonStyle(.plain)
                        }

                        // Split Row: Left Hero Date + Right Mini Month Grid
                        HStack(alignment: .center, spacing: 18) {
                            // Left Hero Date (Tuesday 4) - Tapping filters/unfilters
                            Button(action: {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    isDateFilterActive = true
                                    selectedWeekFilter = 0
                                }
                            }) {
                                VStack(spacing: 2) {
                                    Text(dayNameString(for: selectedDate))
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    Text("\(dayNumber(for: selectedDate))")
                                        .font(.system(size: 50, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                }
                                .frame(width: 86)
                            }
                            .buttonStyle(.plain)

                            Divider()
                                .frame(height: 140)

                            // Right Mini Month Grid
                            VStack(spacing: 6) {
                                HStack(spacing: 0) {
                                    ForEach(["S", "M", "T", "W", "T", "F", "S"], id: \.self) { day in
                                        Text(day)
                                            .font(.system(size: 12, weight: .bold))
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                            .frame(maxWidth: .infinity)
                                    }
                                }

                                let daysInMonth = generateDaysInMonth(for: selectedDate)
                                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 4) {
                                    ForEach(daysInMonth, id: \.self) { dateObj in
                                        if let date = dateObj {
                                            let isSelected = isDateFilterActive && Calendar.current.isDate(date, inSameDayAs: selectedDate)
                                            let hasDeadline = hasReadingOnDate(date)

                                            Button(action: {
                                                withAnimation(.easeInOut(duration: 0.2)) {
                                                    if isDateFilterActive && Calendar.current.isDate(date, inSameDayAs: selectedDate) {
                                                        isDateFilterActive = false
                                                    } else {
                                                        selectedDate = date
                                                        isDateFilterActive = true
                                                        selectedWeekFilter = 0
                                                    }
                                                }
                                            }) {
                                                VStack(spacing: 1) {
                                                    ZStack {
                                                        Circle()
                                                            .fill(isSelected ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color.clear)
                                                            .frame(width: 28, height: 28)

                                                        Text("\(dayNumber(for: date))")
                                                            .font(.system(size: 12, weight: isSelected ? .bold : .semibold))
                                                            .foregroundColor(isSelected ? .white : Color(red: 0.08, green: 0.12, blue: 0.22))
                                                    }

                                                    if hasDeadline {
                                                        HStack(spacing: 2) {
                                                            ForEach(courseColorsForDate(date), id: \.self) { cColor in
                                                                Circle()
                                                                    .fill(cColor)
                                                                    .frame(width: 4, height: 4)
                                                            }
                                                        }
                                                    } else {
                                                        Spacer().frame(height: 4)
                                                    }
                                                }
                                            }
                                            .buttonStyle(.plain)
                                        } else {
                                            Text("")
                                                .frame(width: 28, height: 28)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(16)
                    .background(Color.white)
                    .cornerRadius(20)
                    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)
                    .padding(.horizontal, 18)

                    // MARK: - 2. Search Bar (Below Week Bar)
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.secondary)
                        TextField("Search readings…", text: $searchQuery)
                            .font(.cpDescription)
                            .autocorrectionDisabled()
                            .onSubmit {
                                #if os(iOS)
                                UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                                #endif
                            }

                        if !searchQuery.isEmpty {
                            Button(action: {
                                withAnimation {
                                    searchQuery = ""
                                    #if os(iOS)
                                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                                    #endif
                                }
                            }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(Color(red: 0.55, green: 0.62, blue: 0.72))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(10)
                    .background(Color.white)
                    .cornerRadius(12)
                    .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 2)
                    .padding(.horizontal, 18)

                    // MARK: - Per-Course Reading Progress Bars
                    let coursesForProgress: [Course] = {
                        if let selectedCourseFilter {
                            return [selectedCourseFilter]
                        }
                        return courses
                    }()

                    if !coursesForProgress.isEmpty && !activeReadings.isEmpty {
                        VStack(spacing: 12) {
                            ForEach(coursesForProgress) { course in
                                let courseReadings = readings.filter { !$0.isDeleted && $0.week?.course?.persistentModelID == course.persistentModelID }
                                let cTotal = courseReadings.count
                                let cDone = courseReadings.filter { $0.isCompleted }.count
                                let cPct = cTotal > 0 ? Int((Double(cDone) / Double(cTotal)) * 100) : 0
                                let cColor = CourseColorHelper.color(for: course.hexColor)

                                VStack(alignment: .leading, spacing: 6) {
                                    HStack(spacing: 6) {
                                        Circle()
                                            .fill(cColor)
                                            .frame(width: 8, height: 8)

                                        Text(course.courseCode ?? course.courseName)
                                            .font(.system(size: 13, weight: .bold, design: .rounded))
                                            .foregroundColor(CoursePalTheme.textDark)
                                            .lineLimit(1)

                                        Spacer()
                                    }

                                    HStack(spacing: 8) {
                                        GeometryReader { geo in
                                            ZStack(alignment: .leading) {
                                                RoundedRectangle(cornerRadius: 4)
                                                    .fill(Color(red: 0.89, green: 0.91, blue: 0.94))
                                                    .frame(height: 6)

                                                RoundedRectangle(cornerRadius: 4)
                                                    .fill(cColor)
                                                    .frame(width: geo.size.width * CGFloat(cTotal > 0 ? Double(cDone) / Double(cTotal) : 0), height: 6)
                                            }
                                        }
                                        .frame(height: 6)

                                        Text("\(cDone) of \(cTotal) (\(cPct)%)")
                                            .font(.system(size: 11, weight: .bold, design: .rounded))
                                            .foregroundColor(.white)
                                            .padding(.horizontal, 7)
                                            .padding(.vertical, 2)
                                            .background(cColor)
                                            .cornerRadius(6)
                                    }
                                }
                            }
                        }
                        .padding(14)
                        .background(Color.white)
                        .cornerRadius(18)
                        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
                        .padding(.horizontal, 18)
                    }

                    // Active Course Filter Banner
                    if let course = selectedCourseFilter {
                        HStack(spacing: 8) {
                            Circle()
                                .fill(CourseColorHelper.color(for: course.hexColor))
                                .frame(width: 8, height: 8)

                            Text("Showing:")
                                .font(.cpDescription)
                                .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))

                            Text(course.courseName)
                                .font(.cpItemTitle)
                                .foregroundColor(CourseColorHelper.color(for: course.hexColor))

                            Spacer()

                            Button(action: {
                                withAnimation {
                                    selectedCourseFilter = nil
                                }
                            }) {
                                HStack(spacing: 3) {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 11, weight: .bold))
                                    Text("Clear")
                                        .font(.cpDescriptionBold)
                                }
                                .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.white)
                                .cornerRadius(8)
                                .shadow(color: Color.black.opacity(0.03), radius: 3, x: 0, y: 1)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(CourseColorHelper.color(for: course.hexColor).opacity(0.12))
                        .cornerRadius(12)
                        .padding(.horizontal, 18)
                    }

                    // MARK: - Filtered Readings Content
                    if courses.isEmpty && sortMode != "trash" {
                        VStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 18)
                                    .fill(Color(red: 0.89, green: 0.93, blue: 1.0))
                                    .frame(width: 56, height: 56)
                                Image(systemName: "book.fill")
                                    .font(.system(size: 24))
                                    .foregroundColor(CoursePalTheme.accentBlue)
                            }

                            Text("No courses yet")
                                .font(.cpItemTitle)
                                .foregroundColor(CoursePalTheme.textDark)
                            Text("Upload a syllabus to automatically populate your reading schedule.")
                                .font(.cpDescription)
                                .foregroundColor(CoursePalTheme.textMuted)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: 240)
                        }
                        .padding(.vertical, 32)
                        .padding(.horizontal, 20)
                        .frame(maxWidth: .infinity)
                        .background(Color.white)
                        .cornerRadius(20)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                        )
                        .shadow(color: Color.black.opacity(0.03), radius: 8, x: 0, y: 2)
                    } else if activeReadings.isEmpty && sortMode != "trash" {
                        VStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 18)
                                    .fill(Color(red: 0.89, green: 0.93, blue: 1.0))
                                    .frame(width: 56, height: 56)
                                Image(systemName: isDateFilterActive ? "calendar.badge.exclamationmark" : "book.fill")
                                    .font(.system(size: 24))
                                    .foregroundColor(CoursePalTheme.accentBlue)
                            }

                            Text(isDateFilterActive ? "No Readings on This Date" : (searchQuery.isEmpty ? "No readings yet" : "No results found"))
                                .font(.cpItemTitle)
                                .foregroundColor(CoursePalTheme.textDark)
                            Text(isDateFilterActive ? "There are no readings scheduled for this date." : (searchQuery.isEmpty ? "Upload a syllabus to automatically populate your reading schedule." : "Nothing matches \"\(searchQuery)\"."))
                                .font(.cpDescription)
                                .foregroundColor(CoursePalTheme.textMuted)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: 260)

                            if isDateFilterActive {
                                Button(action: {
                                    withAnimation(.easeOut(duration: 0.15)) {
                                        isDateFilterActive = false
                                    }
                                }) {
                                    Text("Show All Readings")
                                        .font(.system(size: 13, weight: .bold, design: .rounded))
                                        .foregroundColor(.white)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 8)
                                        .background(CoursePalTheme.accentBlue)
                                        .cornerRadius(10)
                                }
                                .buttonStyle(.plain)
                                .padding(.top, 4)
                            }
                        }
                        .padding(.vertical, 32)
                        .padding(.horizontal, 20)
                        .frame(maxWidth: .infinity)
                        .background(Color.white)
                        .cornerRadius(20)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                        )
                        .shadow(color: Color.black.opacity(0.03), radius: 8, x: 0, y: 2)
                        .padding(.horizontal, 18)
                    } else if sortMode == "readings" || sortMode == "week" {
                        // ── READINGS GROUPED BY WEEK ──
                        VStack(alignment: .leading, spacing: 18) {
                            ForEach(activeWeekNumbersWithReadings, id: \.self) { weekNum in
                                let weekReadings = (readingsByWeek[weekNum] ?? []).sorted(by: { scheduledDate(for: $0) < scheduledDate(for: $1) })

                                VStack(alignment: .leading, spacing: 10) {
                                    if weekNum > 0 {
                                        HStack(spacing: 6) {
                                            Text("Week \(weekNum)")
                                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                                .foregroundColor(.white)
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 3)
                                                .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                                .clipShape(Capsule())

                                            if let mod = weekModuleMention(for: weekNum), !mod.isEmpty {
                                                Text(mod)
                                                    .font(.system(size: 11, weight: .bold, design: .rounded))
                                                    .foregroundColor(.white)
                                                    .padding(.horizontal, 8)
                                                    .padding(.vertical, 3)
                                                    .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                                    .clipShape(Capsule())
                                            }

                                            if let range = weekDateRange(for: weekNum), !range.isEmpty {
                                                Text(range)
                                                    .font(.system(size: 11, weight: .medium, design: .rounded))
                                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                            }

                                            Spacer()
                                        }
                                        .padding(.top, 4)
                                    } else {
                                        HStack(spacing: 6) {
                                            Text("General Readings")
                                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                                .foregroundColor(.white)
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 3)
                                                .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                                .clipShape(Capsule())

                                            Spacer()
                                        }
                                        .padding(.top, 4)
                                    }

                                    VStack(spacing: 10) {
                                        ForEach(weekReadings) { reading in
                                            WeekReadingCardView(
                                                reading: reading,
                                                onToggle: { toggleReading(reading) },
                                                onInfo: { selectedReadingForInfo = reading },
                                                onCourseTap: {
                                                    if let course = reading.week?.course ?? courses.first {
                                                        selectedCourseForDrillDown = course
                                                    }
                                                },
                                                onDelete: { softDeleteReading(reading) }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 18)
                    } else if sortMode == "course" {
                        // ── GROUPED BY COURSE ──────────────────
                        let groupedByCourse = Dictionary(
                            grouping: activeReadings,
                            by: { $0.week?.course?.courseName ?? "Unassigned" }
                        )
                        let courseOrder = courses.map { $0.courseName } + ["Unassigned"]
                        let sortedCourseNames = groupedByCourse.keys.sorted {
                            let iA = courseOrder.firstIndex(of: $0) ?? 999
                            let iB = courseOrder.firstIndex(of: $1) ?? 999
                            return iA < iB
                        }

                        VStack(alignment: .leading, spacing: 18) {
                            ForEach(sortedCourseNames, id: \.self) { courseName in
                                let courseReadings = groupedByCourse[courseName] ?? []
                                let courseObj = courses.first(where: { $0.courseName == courseName })
                                let courseColor = CourseColorHelper.color(for: courseObj?.hexColor ?? "#2563EB")

                                VStack(alignment: .leading, spacing: 8) {
                                    HStack(spacing: 8) {
                                        RoundedRectangle(cornerRadius: 3)
                                            .fill(courseColor)
                                            .frame(width: 4, height: 36)
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(courseName)
                                                .font(.cpItemTitle)
                                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                            if let desc = courseObj?.courseDescription, !desc.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                                Text(desc.trimmingCharacters(in: .whitespacesAndNewlines))
                                                    .font(.cpDescription)
                                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                                    .lineLimit(1)
                                            }
                                        }
                                        Spacer()
                                        Text("\(courseReadings.count) reading\(courseReadings.count == 1 ? "" : "s")")
                                            .font(.cpDescriptionBold)
                                            .foregroundColor(courseColor)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(courseColor.opacity(0.10))
                                            .cornerRadius(8)
                                    }
                                    .padding(.leading, 4)

                                    ForEach(courseReadings) { reading in
                                        WeekReadingCardView(
                                            reading: reading,
                                            onToggle: { toggleReading(reading) },
                                            onInfo: { selectedReadingForInfo = reading },
                                            onCourseTap: {
                                                if let course = reading.week?.course ?? courses.first {
                                                    selectedCourseForDrillDown = course
                                                }
                                            },
                                            onDelete: { softDeleteReading(reading) }
                                        )
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 18)
                    } else if sortMode == "completed" {
                        // ── COMPLETED READINGS ──────────────────
                        let completedReadings = activeReadings.filter { $0.isCompleted }

                        VStack(alignment: .leading, spacing: 14) {
                            HStack {
                                Image(systemName: "checkmark.seal.fill")
                                    .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                                Text("COMPLETED READINGS (\(completedReadings.count))")
                                    .font(.cpItemTitle)
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                Spacer()
                            }
                            .padding(.leading, 4)

                            if completedReadings.isEmpty {
                                VStack(spacing: 10) {
                                    ZStack {
                                        Circle()
                                            .fill(Color(red: 0.95, green: 0.96, blue: 0.98))
                                            .frame(width: 48, height: 48)
                                        Image(systemName: "checkmark.circle")
                                            .font(.system(size: 20))
                                            .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                                    }
                                    Text("No Completed Readings")
                                        .font(.cpItemTitle)
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                    Text("Readings you mark as complete will be shown here.")
                                        .font(.cpDescription)
                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                }
                                .padding(.vertical, 32)
                                .frame(maxWidth: .infinity)
                                .background(Color.white)
                                .cornerRadius(18)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 18)
                                        .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                                )
                            } else {
                                ForEach(completedReadings) { reading in
                                    WeekReadingCardView(
                                        reading: reading,
                                        onToggle: { toggleReading(reading) },
                                        onInfo: { selectedReadingForInfo = reading },
                                        onCourseTap: {
                                            if let course = reading.week?.course ?? courses.first {
                                                selectedCourseForDrillDown = course
                                            }
                                        },
                                        onDelete: { softDeleteReading(reading) }
                                    )
                                }
                            }
                        }
                        .padding(.horizontal, 18)
                    } else if sortMode == "trash" {
                        // ── INLINE TRASH BIN (Readings & Assignments) ──────────────────
                        let totalDeleted = deletedReadings.count + deletedAssignments.count
                        VStack(alignment: .leading, spacing: 14) {
                            if totalDeleted > 0 {
                                Button(action: {
                                    showingEmptyTrashConfirmation = true
                                }) {
                                    HStack(spacing: 8) {
                                        Spacer()
                                        Image(systemName: "trash.fill")
                                            .font(.system(size: 13, weight: .bold))
                                        Text("Empty Trash (\(totalDeleted))")
                                            .font(.cpItemTitle)
                                        Spacer()
                                    }
                                    .foregroundColor(.white)
                                    .padding(.vertical, 12)
                                    .frame(maxWidth: .infinity)
                                    .background(Color(red: 0.90, green: 0.22, blue: 0.22))
                                    .cornerRadius(14)
                                    .shadow(color: Color.red.opacity(0.2), radius: 6, x: 0, y: 3)
                                }
                                .buttonStyle(.plain)
                                .padding(.bottom, 4)
                            }

                            if totalDeleted == 0 {
                                VStack(spacing: 10) {
                                    ZStack {
                                        Circle()
                                            .fill(Color(red: 0.95, green: 0.96, blue: 0.98))
                                            .frame(width: 48, height: 48)
                                        Image(systemName: "trash")
                                            .font(.system(size: 20))
                                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                    }
                                    Text("Trash is Empty")
                                        .font(.system(size: 15, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                    Text("Items moved to trash will appear here for review and recovery.")
                                        .font(.system(size: 12))
                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                }
                                .padding(.vertical, 32)
                                .frame(maxWidth: .infinity)
                                .background(Color.white)
                                .cornerRadius(18)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 18)
                                        .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                                )
                            } else {
                                // Deleted Readings List
                                if !deletedReadings.isEmpty {
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("DELETED READINGS (\(deletedReadings.count))")
                                            .font(.system(size: 11, weight: .bold, design: .rounded))
                                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                            .padding(.leading, 4)

                                        ForEach(deletedReadings) { reading in
                                            HStack(spacing: 10) {
                                                VStack(alignment: .leading, spacing: 3) {
                                                    Text(reading.title)
                                                        .font(.system(size: 14, weight: .bold))
                                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                        .lineLimit(2)
                                                    Text("Reading • \(reading.week?.course?.courseName ?? "Course") • Week \(reading.week?.weekNumber ?? 1)")
                                                        .font(.caption)
                                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                }

                                                Spacer()

                                                Button(action: {
                                                    withAnimation {
                                                        reading.isDeleted = false
                                                        try? modelContext.save()
                                                    }
                                                }) {
                                                    Text("Restore")
                                                        .font(.system(size: 11.5, weight: .bold))
                                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                                        .padding(.horizontal, 10)
                                                        .padding(.vertical, 5)
                                                        .background(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.1))
                                                        .cornerRadius(8)
                                                }
                                                .buttonStyle(.plain)

                                                Button(action: {
                                                    withAnimation {
                                                        modelContext.delete(reading)
                                                        try? modelContext.save()
                                                    }
                                                }) {
                                                    Image(systemName: "xmark.circle.fill")
                                                        .font(.system(size: 16))
                                                        .foregroundColor(Color.red.opacity(0.8))
                                                }
                                                .buttonStyle(.plain)
                                            }
                                            .padding(12)
                                            .background(Color.white)
                                            .cornerRadius(14)
                                            .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 2)
                                        }
                                    }
                                }

                                // Deleted Assignments List
                                if !deletedAssignments.isEmpty {
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("DELETED ASSIGNMENTS (\(deletedAssignments.count))")
                                            .font(.system(size: 11, weight: .bold, design: .rounded))
                                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                            .padding(.leading, 4)
                                            .padding(.top, 6)

                                        ForEach(deletedAssignments) { assignment in
                                            HStack(spacing: 10) {
                                                VStack(alignment: .leading, spacing: 3) {
                                                    Text(assignment.title)
                                                        .font(.system(size: 14, weight: .bold))
                                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                        .lineLimit(2)
                                                    Text("Assignment • \(assignment.course?.courseName ?? "Course") • Week \(assignment.weekNumber)")
                                                        .font(.caption)
                                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                }

                                                Spacer()

                                                Button(action: {
                                                    withAnimation {
                                                        assignment.isDeleted = false
                                                        try? modelContext.save()
                                                    }
                                                }) {
                                                    Text("Restore")
                                                        .font(.system(size: 11.5, weight: .bold))
                                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                                        .padding(.horizontal, 10)
                                                        .padding(.vertical, 5)
                                                        .background(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.1))
                                                        .cornerRadius(8)
                                                }
                                                .buttonStyle(.plain)

                                                Button(action: {
                                                    withAnimation {
                                                        modelContext.delete(assignment)
                                                        try? modelContext.save()
                                                    }
                                                }) {
                                                    Image(systemName: "xmark.circle.fill")
                                                        .font(.system(size: 16))
                                                        .foregroundColor(Color.red.opacity(0.8))
                                                }
                                                .buttonStyle(.plain)
                                            }
                                            .padding(12)
                                            .background(Color.white)
                                            .cornerRadius(14)
                                            .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 2)
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 18)
                    }

                    Spacer(minLength: 90)
                }
            }
            .fuzzedScrollEdges(top: 36, bottom: 85)
            .scrollDismissesKeyboard(.immediately)
            .background(CoursePalTheme.bgCanvas)
            .alert("Empty Trash?", isPresented: $showingEmptyTrashConfirmation) {
                Button("Empty Trash", role: .destructive) {
                    withAnimation {
                        for r in deletedReadings { modelContext.delete(r) }
                        for a in deletedAssignments { modelContext.delete(a) }
                        try? modelContext.save()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to permanently delete all \(deletedReadings.count + deletedAssignments.count) items in the trash? This action cannot be undone.")
            }
            .sheet(isPresented: $showingScanSheet) {
                SyllabusScanView()
            }
            .sheet(isPresented: $showingCompletedSheet) {
                UnifiedCompletedFolderSheet(
                    onSelectWeek: { weekNum in
                        selectedWeekFilter = weekNum
                    },
                    onSelectCourse: { course in
                        selectedCourseForDrillDown = course
                    }
                )
            }
            .sheet(isPresented: $showingTrashSheet) {
                UnifiedTrashFolderSheet()
            }
            .sheet(item: $selectedReadingForInfo) { reading in
                EditReadingSheet(reading: reading)
            }
            .sheet(item: $selectedCourseForDrillDown) { course in
                CourseDetailView(course: course)
            }
            .sheet(item: $courseForAIChat) { course in
                CourseAIChatView(course: course)
            }
            .sheet(isPresented: $showingCourseFilterSheet) {
                CourseFilterPickerSheet(courses: courses, selectedCourse: $selectedCourseFilter)
            }
            .sheet(isPresented: $showingInfoSheet) {
                InfoCreditsSheetView()
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
        }
        .overlay {
            if showingConfetti {
                ConfettiCelebrationView(isPresented: $showingConfetti, title: confettiTitle)
            }
        }
        .dismissKeyboardOnTap()
        .onAppear {
            let cal = Calendar.current
            let hasReadingsInSelectedMonth = readings.contains { r in
                guard !r.isDeleted, let due = r.dueDate else { return false }
                return cal.isDate(due, equalTo: selectedDate, toGranularity: .month)
            }
            if !hasReadingsInSelectedMonth {
                let validDueDates = readings.filter { !$0.isDeleted }.compactMap { $0.dueDate }.sorted()
                let today = cal.startOfDay(for: Date())
                if let nextDue = validDueDates.first(where: { $0 >= today }) ?? validDueDates.first {
                    selectedDate = nextDue
                }
            }
        }
    }

    private func triggerConfetti(title: String) {
        confettiTitle = title
        withAnimation {
            showingConfetti = true
        }
    }

    private func toggleReading(_ reading: Reading) {
        let willBeCompleted = !reading.isCompleted
        reading.isCompleted = willBeCompleted
        try? modelContext.save()
        DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
        
        if willBeCompleted {
            // 1. Check if this course's readings are now 100% complete
            if let course = reading.week?.course {
                let courseReadings = readings.filter { !$0.isDeleted && $0.week?.course?.persistentModelID == course.persistentModelID }
                let remaining = courseReadings.filter { !$0.isCompleted }.count
                if remaining == 0 && !courseReadings.isEmpty {
                    triggerConfetti(title: "🎉 \(course.courseCode ?? course.courseName) Readings 100% Done!")
                    return
                }
            }
            
            // 2. Check if all active readings across all courses are now 100% complete
            let allActive = activeReadings
            let remainingAll = allActive.filter { !$0.isCompleted }.count
            if remainingAll == 0 && !allActive.isEmpty {
                triggerConfetti(title: "🎉 All Readings 100% Complete!")
            }
        }
    }

    private func softDeleteReading(_ reading: Reading) {
        withAnimation(.easeInOut(duration: 0.25)) {
            reading.isDeleted = true
            try? modelContext.save()
            DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
        }
    }
}

public struct WeekFilterChip: View {
    public let title: String
    public let isSelected: Bool
    public let action: () -> Void

    public var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: isSelected ? .bold : .semibold))
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(isSelected ? CoursePalTheme.accentBlue : Color.white)
                .foregroundColor(isSelected ? .white : CoursePalTheme.textDark)
                .cornerRadius(22)
                .shadow(color: isSelected ? CoursePalTheme.accentBlue.opacity(0.25) : Color.black.opacity(0.04), radius: isSelected ? 6 : 4, x: 0, y: 2)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Week Reading Card View with Course Color Badge & Matching Action Icons

public struct WeekReadingCardView: View {
    public let reading: Reading
    public let onToggle: () -> Void
    public let onInfo: () -> Void
    public let onCourseTap: () -> Void
    public let onDelete: () -> Void

    private var courseColor: Color {
        CourseColorHelper.color(for: reading.week?.course?.hexColor ?? "#2563EB")
    }

    private var displayTitle: String {
        var raw = reading.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cCode = reading.courseCode ?? reading.week?.course?.courseCode
        let cName = reading.week?.course?.courseName

        if raw.isEmpty || (cCode != nil && raw.lowercased() == cCode!.lowercased()) || (cName != nil && raw.lowercased() == cName!.lowercased()) {
            return reading.chapterAndPagesDisplay ?? "Required Reading"
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

        return raw.isEmpty ? (reading.chapterAndPagesDisplay ?? "Required Reading") : raw
    }

    public var body: some View {
        HStack(spacing: 10) {
            // Single Vertical Course Color Line Indicator
            RoundedRectangle(cornerRadius: 3)
                .fill(courseColor)
                .frame(width: 4, height: 36)

            // Content Area
            VStack(alignment: .leading, spacing: 3) {
                // Top Line: Course Title Pill (Left, white letters) & Media Type Badge (if not standard textbook)
                let pillTitle: String = {
                    if let cName = reading.week?.course?.courseName, !cName.isEmpty {
                        return cName
                    }
                    if let cCode = reading.courseCode ?? reading.week?.course?.courseCode, !cCode.isEmpty {
                        return cCode
                    }
                    return "Reading"
                }()

                HStack(spacing: 6) {
                    Text(pillTitle)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2.5)
                        .background(courseColor)
                        .cornerRadius(5)


                    if reading.mediaType != .textbook {
                        Text(reading.mediaType.displayName)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(red: 0.93, green: 0.94, blue: 0.96))
                            .cornerRadius(4)
                    }

                    Spacer(minLength: 0)
                }

                // Reading Title with Chapter before name, in black
                let titleColor = reading.isCompleted ? CoursePalTheme.textMuted : Color(red: 0.08, green: 0.12, blue: 0.22)
                let fullTitleString: String = {
                    if let ch = reading.cleanChapterText, !ch.isEmpty {
                        let lowerTitle = displayTitle.lowercased()
                        let lowerCh = ch.lowercased()
                        if lowerTitle.hasPrefix("chapter") || lowerTitle.hasPrefix("ch.") || lowerTitle.hasPrefix("ch ") {
                            let strippedTitle = displayTitle.replacingOccurrences(of: #"(?i)^\s*(?:chapters?|chaps?\.?|chs?\.?)\s*[\d\s,&–\-and]+\s*[:\-–·•.]*\s*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                            if !strippedTitle.isEmpty {
                                return "\(ch) · \(strippedTitle)"
                            }
                            return ch
                        }
                        if !lowerTitle.contains(lowerCh) {
                            return "\(ch) · \(displayTitle)"
                        }
                    }
                    return displayTitle
                }()

                Text(fullTitleString)
                    .font(.cpItemTitle)
                    .foregroundColor(titleColor)
                    .strikethrough(reading.isCompleted)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                // Subtitle: Authors · Pages (Cleaned of stray colons/semicolons, NO chapters underneath)
                if let subtitle = reading.authorAndPagesSubtitle, !subtitle.isEmpty {
                    if !displayTitle.lowercased().contains(subtitle.lowercased()) && !subtitle.lowercased().contains(displayTitle.lowercased()) {
                        Text(subtitle)
                            .font(.cpDescriptionMedium)
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            .lineLimit(2)
                    } else if let auth = reading.authorName, !auth.isEmpty, !displayTitle.lowercased().contains(auth.lowercased()) {
                        Text(auth)
                            .font(.cpDescriptionMedium)
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            .lineLimit(2)
                    }
                }

                // Date Display (Clean calendar date without redundant "Due" or "Week X")
                if let explicitDate = reading.dueDate {
                    let dateText: String = {
                        let formatter = DateFormatter()
                        let calendar = Calendar.current
                        let itemYear = calendar.component(.year, from: explicitDate)
                        let currentYear = calendar.component(.year, from: Date())
                        formatter.dateFormat = (itemYear != currentYear) ? "EEEE, MMMM d, yyyy" : "EEEE, MMMM d"
                        return formatter.string(from: explicitDate)
                    }()

                    HStack(spacing: 5) {
                        Image(systemName: "calendar")
                            .font(.system(size: 10.5))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                        Text(dateText)
                            .font(.cpDescription)
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    }
                    .padding(.top, 1)
                }

                // Real Clickable Resource Link (Only displayed if a valid URL exists)
                if let videoUrl = reading.videoUrl, URLHelper.isValidURL(videoUrl), let url = URLHelper.formatURL(videoUrl) {
                    Link(destination: url) {
                        HStack(spacing: 4) {
                            Image(systemName: "link.circle.fill")
                                .font(.system(size: 12, weight: .bold))
                            Text(url.absoluteString)
                                .font(.cpDescriptionMedium)
                                .lineLimit(1)
                            Image(systemName: "arrow.up.right.square")
                                .font(.system(size: 11, weight: .bold))
                        }
                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3.5)
                        .background(Color(red: 0.94, green: 0.96, blue: 1.0))
                        .cornerRadius(6)
                    }
                    .buttonStyle(.plain)
                }
            }

            Spacer(minLength: 4)

            // Right-side Action Buttons: Checkmark Ring & Trashcan
            HStack(spacing: 8) {
                // Completion Checkmark Ring Button
                Button(action: {
                    onToggle()
                }) {
                    ZStack {
                        Circle()
                            .fill(reading.isCompleted ? CoursePalTheme.accentBlue : Color.clear)
                            .frame(width: 22, height: 22)
                            .overlay(
                                Circle()
                                    .stroke(reading.isCompleted ? CoursePalTheme.accentBlue : Color(red: 0.75, green: 0.80, blue: 0.86), lineWidth: 1.8)
                            )

                        if reading.isCompleted {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }
                    .frame(width: 32, height: 36)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                // Trashcan Button
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        onDelete()
                    }
                }) {
                    Image(systemName: "trash")
                        .font(.system(size: 15, weight: .regular))
                        .foregroundColor(Color.red.opacity(0.85))
                        .frame(width: 30, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
        .background(CoursePalTheme.cardBg)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
        .contentShape(Rectangle())
        .onTapGesture {
            onInfo()
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash.fill")
            }
        }
    }
}

// MARK: - Edit Reading Sheet (Matching Edit Assignment Sheet)

public struct EditReadingSheet: View {
    @Bindable public var reading: Reading
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var courseNameInput: String = ""
    @State private var selectedWeekNum: Int = 1
    @State private var weekString: String = "1"
    @State private var selectedModuleNum: Int = 0
    @State private var moduleInput: String = ""
    @State private var videoUrlInput: String = ""
    @State private var hasDueDate: Bool = false
    @State private var dueDateInput: Date = Date()
    @State private var chapterInput: String = ""
    @State private var topicInputs: [String] = []
    @State private var topicsInput: String = ""
    @State private var notesInput: String = ""
    @State private var noteInputs: [String] = []
    @State private var cachedCourseStartDate: Date? = nil

    public var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.95, green: 0.96, blue: 0.98)
                    .ignoresSafeArea()

                Form {
                    // Section 1: Title & Course Name (Matching Assignment Information)
                    Section("Reading Information") {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Title")
                                .font(.caption)
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            TextField("Title", text: $reading.title)
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                        }
                        .padding(.vertical, 1)

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Course Name")
                                .font(.caption)
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            TextField("Enter course name...", text: $courseNameInput)
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .onChange(of: courseNameInput) { _, newValue in
                                    if let course = reading.week?.course {
                                        course.courseName = newValue
                                    }
                                }
                        }
                        .padding(.vertical, 1)
                    }

                    // Section 2: Schedule & Due Date (Week, Module, and Due Date - No Made-up Date Ranges)
                    // Section 2: Schedule & Due Date (Week, Module, and Due Date - No Made-up Date Ranges)
                    Section("Schedule") {
                        HStack(spacing: 8) {
                            Text("Week")
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            TextField("1", text: $weekString)
                                .keyboardType(.numberPad)
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                .frame(width: 80)
                                .onChange(of: weekString) { _, newVal in
                                    let digits = newVal.filter { $0.isNumber }
                                    if digits != newVal { weekString = digits }
                                    if let w = Int(digits), w > 0 {
                                        selectedWeekNum = w
                                    }
                                }
                            Spacer()
                        }

                        HStack(spacing: 8) {
                            TextField("Module", text: $moduleInput)
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        }

                        Toggle("Due Date", isOn: $hasDueDate)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))

                        if hasDueDate {
                            DatePicker("Select Date", selection: $dueDateInput, displayedComponents: [.date])
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .onChange(of: dueDateInput) { _, newDate in
                                    let derivedW: Int
                                    if let firstDate = cachedCourseStartDate {
                                        derivedW = WeekDateConverter.deriveWeekNumber(for: newDate, courseStartDate: firstDate)
                                    } else {
                                        derivedW = WeekDateConverter.weekNumber(for: newDate)
                                    }
                                    if selectedWeekNum != derivedW {
                                        selectedWeekNum = derivedW
                                        weekString = "\(derivedW)"
                                    }
                                }
                        }
                    }

                    // Section 4: Dedicated Chapter & Pages Section
                    Section("Chapter & Pages") {
                        TextField("e.g. Chapter 4, pp. 120-155", text: $chapterInput)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .onChange(of: chapterInput) { _, newValue in
                                let (ch, pg) = LocalSyllabusParser.shared.extractChapterAndPages(from: newValue)
                                let fullCh: String? = {
                                    guard let c = ch ?? (newValue.isEmpty ? nil : newValue) else { return nil }
                                    return Reading.expandChapterToFullWord(c)
                                }()
                                reading.chapterText = fullCh
                                reading.pagesText = pg
                            }
                    }

                    // Section 5: Dedicated Topics Section (Clean numbered list: 1 - Topic, editable like rest of sections)
                    Section("Topics") {
                        if topicInputs.isEmpty {
                            Button {
                                topicInputs.append("")
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 13, weight: .semibold))
                                    Text("Add Topic")
                                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                                }
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                            }
                        } else {
                            ForEach(0..<topicInputs.count, id: \.self) { idx in
                                HStack(spacing: 8) {
                                    Text("\(idx + 1) -")
                                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                                    TextField("Topic description...", text: Binding(
                                        get: { idx < topicInputs.count ? topicInputs[idx] : "" },
                                        set: { newVal in
                                            if idx < topicInputs.count {
                                                topicInputs[idx] = newVal
                                                let nonEmpty = topicInputs.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
                                                reading.relevantTopics = nonEmpty.isEmpty ? nil : nonEmpty.joined(separator: ", ")
                                            }
                                        }
                                    ))
                                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                }
                            }

                            Button {
                                topicInputs.append("")
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 13, weight: .semibold))
                                    Text("Add Topic")
                                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                                }
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                            }
                        }
                    }

                    // Section 5: Media Type Picker (Textbook, Video, Podcast, Article)
                    Section("Media Type") {
                        Picker("Type", selection: $reading.mediaType) {
                            Text("Textbook").tag(MediaType.textbook)
                            Text("Video").tag(MediaType.video)
                            Text("Podcast").tag(MediaType.podcast)
                            Text("Article / Paper").tag(MediaType.article)
                        }
                        .pickerStyle(.menu)
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                    }

                    // Section 6: Resource Link Section
                    Section("Resource Link") {
                        TextField("Paste video or article URL...", text: $videoUrlInput)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .onChange(of: videoUrlInput) { _, newValue in
                                reading.videoUrl = newValue
                            }

                        if URLHelper.isValidURL(videoUrlInput), let url = URLHelper.formatURL(videoUrlInput) {
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

                    // Section 7: Notes
                    Section("Notes") {
                        if noteInputs.isEmpty {
                            Button {
                                noteInputs.append("")
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 13, weight: .semibold))
                                    Text("Add Note")
                                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                                }
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                            }
                        } else {
                            VStack(spacing: 14) { // Generous space between each note
                                ForEach(0..<noteInputs.count, id: \.self) { idx in
                                    HStack(alignment: .top, spacing: 12) {
                                        Text("\(idx + 1) -")
                                            .font(.system(size: 15, weight: .bold, design: .rounded))
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                            .padding(.top, 2)

                                        TextField("Add note or instruction...", text: Binding(
                                            get: { idx < noteInputs.count ? noteInputs[idx] : "" },
                                            set: { newVal in
                                                if idx < noteInputs.count {
                                                    noteInputs[idx] = newVal
                                                }
                                            }
                                        ), axis: .vertical)
                                        .font(.system(size: 15, weight: .regular, design: .rounded))
                                        .lineSpacing(6) // Separate text lines more inside the note
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                        .lineLimit(3...16)

                                        Spacer(minLength: 4)

                                        Button {
                                            if idx < noteInputs.count {
                                                noteInputs.remove(at: idx)
                                            }
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.system(size: 16))
                                                .foregroundColor(Color(red: 0.70, green: 0.75, blue: 0.82))
                                        }
                                        .buttonStyle(.plain)
                                        .padding(.top, 2)
                                    }
                                    .padding(.horizontal, 18)
                                    .padding(.vertical, 18)
                                    .frame(minHeight: 90, alignment: .topLeading) // Taller note pill
                                    .background(Color(red: 0.97, green: 0.98, blue: 0.99))
                                    .cornerRadius(14)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 14)
                                            .stroke(Color(red: 0.90, green: 0.92, blue: 0.95), lineWidth: 1)
                                    )
                                }
                            }
                            .padding(.vertical, 4)

                            Button {
                                noteInputs.append("")
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 13, weight: .semibold))
                                    Text("Add Note")
                                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                                }
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                .padding(.top, 2)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .scrollContentBackground(.hidden)
                .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                .scrollDismissesKeyboard(.immediately)
            }
            .onAppear {
                courseNameInput = reading.week?.course?.courseName ?? ""
                selectedWeekNum = reading.week?.weekNumber ?? 1
                weekString = "\(selectedWeekNum)"
                if let mod = reading.moduleMention {
                    moduleInput = mod
                    if let match = mod.range(of: #"\d+"#, options: .regularExpression), let num = Int(mod[match]) {
                        selectedModuleNum = num
                    } else {
                        selectedModuleNum = 0
                    }
                } else {
                    moduleInput = ""
                    selectedModuleNum = 0
                }
                videoUrlInput = reading.videoUrl ?? ""
                if let d = reading.dueDate {
                    hasDueDate = true
                    dueDateInput = d
                } else {
                    hasDueDate = false
                    dueDateInput = Date()
                }
                
                if let chDisplay = reading.chapterAndPagesDisplay, !chDisplay.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    chapterInput = Reading.expandChapterToFullWord(chDisplay) ?? chDisplay
                } else {
                    let (ch, pg) = LocalSyllabusParser.shared.extractChapterAndPages(from: reading.title)
                    var parts: [String] = []
                    if let c = ch { parts.append(Reading.expandChapterToFullWord(c) ?? c) }
                    if let p = pg { parts.append(p) }
                    chapterInput = parts.joined(separator: " • ")
                    if !parts.isEmpty {
                        reading.chapterText = Reading.expandChapterToFullWord(ch) ?? ch
                        reading.pagesText = pg
                    }
                }
                
                let currentTopics = reading.computedTopics.filter { !$0.lowercased().hasPrefix("module") && !$0.lowercased().hasPrefix("mod ") }
                if !currentTopics.isEmpty {
                    topicInputs = currentTopics
                } else if let rel = reading.relevantTopics, !rel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    topicInputs = [rel.trimmingCharacters(in: .whitespacesAndNewlines)]
                } else {
                    topicInputs = []
                }
                topicsInput = reading.relevantTopics ?? ""
                let rawNotes = reading.summaryText
                notesInput = rawNotes
                noteInputs = rawNotes.components(separatedBy: .newlines)
                    .map { $0.replacingOccurrences(of: #"^[•\-\*▪●]\s*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                cachedCourseStartDate = reading.week?.course?.weeks.compactMap({ $0.startDate }).min() ?? reading.week?.course?.earliestItemDate
            }
            .navigationTitle("Details")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color(red: 0.95, green: 0.96, blue: 0.98), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.light, for: .navigationBar)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if let course = reading.week?.course {
                            if let targetWeek = course.weeks.first(where: { $0.weekNumber == selectedWeekNum }) {
                                reading.week = targetWeek
                            } else {
                                let newWeek = Week(id: UUID(), weekNumber: selectedWeekNum, theme: "Week \(selectedWeekNum) Schedule")
                                newWeek.course = course
                                course.weeks.append(newWeek)
                                modelContext.insert(newWeek)
                                reading.week = newWeek
                            }
                        }
                        reading.dueDate = hasDueDate ? dueDateInput : nil
                        reading.dateRangeStr = nil
                        let nonEmptyTopics = topicInputs.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
                        if !nonEmptyTopics.isEmpty {
                            reading.relevantTopics = nonEmptyTopics.joined(separator: ", ")
                        } else {
                            let t = topicsInput.trimmingCharacters(in: .whitespacesAndNewlines)
                            reading.relevantTopics = t.isEmpty ? nil : t
                        }

                        let nonEmptyNotes = noteInputs.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
                        reading.summaryText = nonEmptyNotes.joined(separator: "\n")

                        let trimmedMod = moduleInput.trimmingCharacters(in: .whitespacesAndNewlines)
                        if let course = reading.week?.course, !trimmedMod.isEmpty {
                            course.cacheModule(trimmedMod, forWeek: selectedWeekNum)
                        }
                        try? modelContext.save()
                        dismiss()
                    }
                    .bold()
                }
            }
        }
        .dismissKeyboardOnTap()
    }
}

// MARK: - Unified Completed Items Sheet

public struct UnifiedCompletedFolderSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(filter: #Predicate<Reading> { !$0.isDeleted }) private var readings: [Reading]
    @Query(filter: #Predicate<Assignment> { !$0.isDeleted }) private var dbAssignments: [Assignment]

    var onSelectWeek: ((Int) -> Void)? = nil
    var onSelectCourse: ((Course) -> Void)? = nil

    public init(onSelectWeek: ((Int) -> Void)? = nil, onSelectCourse: ((Course) -> Void)? = nil) {
        self.onSelectWeek = onSelectWeek
        self.onSelectCourse = onSelectCourse
    }

    private var completedReadings: [Reading] {
        readings.filter { $0.isCompleted }
    }

    private var completedAssignments: [Assignment] {
        dbAssignments.filter { $0.isCompleted }
    }

    private var totalCount: Int {
        readings.count + dbAssignments.count
    }

    private var totalCompletedCount: Int {
        completedReadings.count + completedAssignments.count
    }

    private var completionPct: Int {
        totalCount > 0 ? Int((Double(totalCompletedCount) / Double(totalCount)) * 100) : 0
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                // Top Card Box: Overall Term Progress & Progress Bar
                VStack(spacing: 10) {
                    HStack {
                        HStack(spacing: 6) {
                            Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(Color(red: 0.05, green: 0.60, blue: 0.40))
                            Text("Overall Term Progress")
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        }

                        Spacer()

                        Text("\(totalCompletedCount) out of \(totalCount) Done (\(completionPct)%)")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.05, green: 0.60, blue: 0.40))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color(red: 0.05, green: 0.60, blue: 0.40).opacity(0.12))
                            .cornerRadius(10)
                    }

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color(red: 0.89, green: 0.91, blue: 0.94))
                                .frame(height: 8)

                            RoundedRectangle(cornerRadius: 6)
                                .fill(LinearGradient(colors: [Color(red: 0.05, green: 0.60, blue: 0.40), Color(red: 0.10, green: 0.75, blue: 0.45)], startPoint: .leading, endPoint: .trailing))
                                .frame(width: geo.size.width * CGFloat(totalCount > 0 ? Double(totalCompletedCount) / Double(totalCount) : 0), height: 8)
                        }
                    }
                    .frame(height: 8)
                }
                .padding(14)
                .background(Color.white)
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
                .padding(.horizontal, 16)
                .padding(.top, 12)

                if completedReadings.isEmpty && completedAssignments.isEmpty {
                    VStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(Color(red: 0.90, green: 0.97, blue: 0.93))
                                .frame(width: 56, height: 56)
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 26))
                                .foregroundColor(Color(red: 0.05, green: 0.60, blue: 0.40))
                        }
                        Text("No completed items yet")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        Text("Items you mark completed with the checkmark ring will appear here.")
                            .font(.system(size: 12.5))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 240)
                    }
                    .padding(32)
                    Spacer()
                } else {
                    List {
                        if !completedReadings.isEmpty {
                            Section("COMPLETED READINGS (\(completedReadings.count))") {
                                ForEach(completedReadings) { reading in
                                    HStack {
                                        Button(action: {
                                            if let weekNum = reading.week?.weekNumber {
                                                onSelectWeek?(weekNum)
                                            } else if let course = reading.week?.course {
                                                onSelectCourse?(course)
                                            }
                                            dismiss()
                                        }) {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(reading.title)
                                                    .font(.system(size: 14, weight: .bold))
                                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                    .strikethrough()

                                                HStack(spacing: 6) {
                                                    Text(reading.week?.course?.courseName ?? "Course")
                                                        .font(.caption)
                                                        .fontWeight(.bold)
                                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))

                                                    Text("·  Week \(reading.week?.weekNumber ?? 1)")
                                                        .font(.caption)
                                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                }
                                            }
                                        }
                                        .buttonStyle(.plain)

                                        Spacer()

                                        Button("Uncheck") {
                                            withAnimation {
                                                reading.isCompleted = false
                                                try? modelContext.save()
                                            }
                                        }
                                        .font(.system(size: 12, weight: .bold))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(Color(red: 0.90, green: 0.97, blue: 0.93))
                                        .foregroundColor(Color(red: 0.05, green: 0.60, blue: 0.40))
                                        .cornerRadius(10)
                                    }
                                }
                            }
                        }

                        if !completedAssignments.isEmpty {
                            Section("COMPLETED ASSIGNMENTS (\(completedAssignments.count))") {
                                ForEach(completedAssignments) { assignment in
                                    HStack {
                                        Button(action: {
                                            if let course = assignment.course {
                                                onSelectCourse?(course)
                                            }
                                            dismiss()
                                        }) {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(assignment.title)
                                                    .font(.system(size: 14, weight: .bold))
                                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                    .strikethrough()

                                                HStack(spacing: 6) {
                                                    Text(assignment.course?.courseName ?? "Course")
                                                        .font(.caption)
                                                        .fontWeight(.bold)
                                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))

                                                    Text("·  Week \(assignment.weekNumber)")
                                                        .font(.caption)
                                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                }
                                            }
                                        }
                                        .buttonStyle(.plain)

                                        Spacer()

                                        Button("Uncheck") {
                                            withAnimation {
                                                assignment.isCompleted = false
                                                try? modelContext.save()
                                            }
                                        }
                                        .font(.system(size: 12, weight: .bold))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(Color(red: 0.90, green: 0.97, blue: 0.93))
                                        .foregroundColor(Color(red: 0.05, green: 0.60, blue: 0.40))
                                        .cornerRadius(10)
                                    }
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Completed Items")
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

// MARK: - Unified Trash Folder Recovery Sheet

public struct UnifiedTrashFolderSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @Query(filter: #Predicate<Reading> { $0.isDeleted }, sort: \Reading.title) private var deletedReadings: [Reading]
    @Query(filter: #Predicate<Assignment> { $0.isDeleted }, sort: \Assignment.title) private var deletedAssignments: [Assignment]

    private var totalDeletedCount: Int {
        deletedReadings.count + deletedAssignments.count
    }

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            // Top Header Bar: Centered Title & Top-Right X Close Button
            ZStack {
                Text("Trash Bin")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                HStack {
                    Spacer()
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 22))
                            .foregroundColor(Color(red: 0.55, green: 0.62, blue: 0.72))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 14)

            // Underneath: 3 Action Button Wrappers (Trash Count, Empty Trash, Done)
            HStack(spacing: 8) {
                // Button 1: Trash (Count)
                HStack(spacing: 5) {
                    Image(systemName: "trash.fill")
                        .font(.system(size: 12, weight: .bold))
                    Text("Trash (\(totalDeletedCount))")
                        .font(.system(size: 12, weight: .bold))
                }
                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                .padding(.horizontal, 8)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity)
                .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color(red: 0.88, green: 0.90, blue: 0.94), lineWidth: 1)
                )

                // Button 2: Empty Trash
                Button(action: {
                    withAnimation {
                        for r in deletedReadings { modelContext.delete(r) }
                        for a in deletedAssignments { modelContext.delete(a) }
                        try? modelContext.save()
                    }
                }) {
                    HStack(spacing: 5) {
                        Image(systemName: "trash.slash.fill")
                            .font(.system(size: 12, weight: .bold))
                        Text("Empty Trash")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundColor(Color.red)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
                    .background(Color.red.opacity(0.08))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.red.opacity(0.2), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .disabled(totalDeletedCount == 0)
                .opacity(totalDeletedCount == 0 ? 0.5 : 1.0)

                // Button 3: Done
                Button(action: { dismiss() }) {
                    HStack(spacing: 5) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 12, weight: .bold))
                        Text("Done")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
                    .background(Color(red: 0.92, green: 0.95, blue: 1.0))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color(red: 0.78, green: 0.86, blue: 0.98), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 12)

            Divider()

            // List of Deleted Items
            List {
                if deletedReadings.isEmpty && deletedAssignments.isEmpty {
                    ContentUnavailableView("Trash is Empty", systemImage: "trash", description: Text("Items moved to trash will appear here for easy recovery."))
                } else {
                    if !deletedReadings.isEmpty {
                        Section("DELETED READINGS (\(deletedReadings.count))") {
                            ForEach(deletedReadings) { reading in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(reading.title)
                                            .font(.system(size: 14, weight: .bold))
                                        let readWeekNum = reading.week?.weekNumber ?? 0
                                        let readWeekSuffix = readWeekNum > 0 ? " · Week \(readWeekNum)" : ""
                                        Text("\(reading.week?.course?.courseName ?? "Course")\(readWeekSuffix)")
                                            .font(.caption)
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    }
                                    Spacer()
                                    Button("Restore") {
                                        withAnimation {
                                            reading.isDeleted = false
                                            try? modelContext.save()
                                        }
                                    }
                                    .font(.system(size: 12, weight: .bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(Color(red: 0.92, green: 0.95, blue: 1.0))
                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    .cornerRadius(10)

                                    Button(action: {
                                        withAnimation {
                                            modelContext.delete(reading)
                                            try? modelContext.save()
                                        }
                                    }) {
                                        Image(systemName: "trash")
                                            .font(.system(size: 14))
                                            .foregroundColor(.red)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    if !deletedAssignments.isEmpty {
                        Section("DELETED ASSIGNMENTS (\(deletedAssignments.count))") {
                            ForEach(deletedAssignments) { assignment in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(assignment.title)
                                            .font(.system(size: 14, weight: .bold))
                                        let assignWeekSuffix = assignment.weekNumber > 0 ? " · Week \(assignment.weekNumber)" : ""
                                        Text("\(assignment.course?.courseName ?? "Course")\(assignWeekSuffix)")
                                            .font(.caption)
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    }
                                    Spacer()
                                    Button("Restore") {
                                        withAnimation {
                                            assignment.isDeleted = false
                                            try? modelContext.save()
                                        }
                                    }
                                    .font(.system(size: 12, weight: .bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(Color(red: 0.92, green: 0.95, blue: 1.0))
                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    .cornerRadius(10)

                                    Button(action: {
                                        withAnimation {
                                            modelContext.delete(assignment)
                                            try? modelContext.save()
                                        }
                                    }) {
                                        Image(systemName: "trash")
                                            .font(.system(size: 14))
                                            .foregroundColor(.red)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.plain)
        }
    }
}

// MARK: - Confetti Particle Model

public struct ConfettiParticle: Identifiable {
    public let id = UUID()
    public let startX: CGFloat
    public let startY: CGFloat
    public let vx: CGFloat
    public let vy: CGFloat
    public let gravity: CGFloat
    public let wobbleSpeed: Double
    public let wobbleAmplitude: CGFloat
    public let rotationSpeed: Double
    public let initialRotation: Double
    public let size: CGSize
    public let color: Color
    public let shape: ConfettiShape
    
    public enum ConfettiShape: CaseIterable {
        case rectangle
        case circle
        case strip
    }
}

// MARK: - Confetti Celebration View

public struct ConfettiCelebrationView: View {
    @Binding public var isPresented: Bool
    public var title: String? = nil
    
    @State private var startTime: Date = Date()
    @State private var particles: [ConfettiParticle] = []
    public init(isPresented: Binding<Bool>, title: String? = nil) {
        self._isPresented = isPresented
        self.title = title
    }
    
    public var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                // Canvas Particle System with Hardware-Accelerated Physics
                TimelineView(.animation) { timeline in
                    let elapsed = timeline.date.timeIntervalSince(startTime)
                    
                    Canvas { context, size in
                        guard elapsed < 3.2 else { return }
                        
                        let globalAlpha = elapsed < 2.2 ? 1.0 : max(0.0, 1.0 - (elapsed - 2.2) / 1.0)
                        
                        for p in particles {
                            // Compute position over elapsed time
                            let x = p.startX + p.vx * elapsed + sin(elapsed * p.wobbleSpeed) * p.wobbleAmplitude
                            let y = p.startY + p.vy * elapsed + 0.5 * p.gravity * elapsed * elapsed
                            
                            guard y < size.height + 40 && x > -40 && x < size.width + 40 else { continue }
                            
                            let rotation = Angle.radians(p.initialRotation + p.rotationSpeed * elapsed)
                            
                            var pCtx = context
                            pCtx.opacity = globalAlpha
                            pCtx.translateBy(x: x, y: y)
                            pCtx.rotate(by: rotation)
                            
                            let rect = CGRect(x: -p.size.width / 2, y: -p.size.height / 2, width: p.size.width, height: p.size.height)
                            
                            switch p.shape {
                            case .rectangle:
                                pCtx.fill(Path(roundedRect: rect, cornerRadius: 1.5), with: .color(p.color))
                            case .circle:
                                pCtx.fill(Path(ellipseIn: rect), with: .color(p.color))
                            case .strip:
                                pCtx.fill(Path(roundedRect: rect, cornerRadius: 1.0), with: .color(p.color))
                            }
                        }
                    }
                    .onChange(of: elapsed >= 3.2) { _, finished in
                        if finished {
                            isPresented = false
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .allowsHitTesting(false)
            .onAppear {
                spawnParticles(in: geo.size)
                #if os(iOS)
                let gen = UINotificationFeedbackGenerator()
                gen.notificationOccurred(.success)
                #endif
            }
        }
        .ignoresSafeArea()
    }
    
    private func spawnParticles(in size: CGSize) {
        startTime = Date()
        var newParticles: [ConfettiParticle] = []
        
        let colors: [Color] = [
            Color(red: 0.98, green: 0.75, blue: 0.18), // Gold
            Color(red: 0.05, green: 0.75, blue: 0.45), // Emerald Green
            Color(red: 0.14, green: 0.44, blue: 0.96), // Royal Blue
            Color(red: 0.95, green: 0.25, blue: 0.55), // Hot Pink
            Color(red: 0.55, green: 0.27, blue: 0.96), // Purple
            Color(red: 0.98, green: 0.48, blue: 0.18), // Coral
            Color(red: 0.02, green: 0.78, blue: 0.88), // Cyan
            Color(red: 1.00, green: 0.92, blue: 0.23)  // Bright Yellow
        ]
        
        let shapes = ConfettiParticle.ConfettiShape.allCases
        let particleCount = 85
        
        let width = size.width > 0 ? size.width : 390
        let height = size.height > 0 ? size.height : 844
        
        for _ in 0..<particleCount {
            let startX = CGFloat.random(in: width * 0.15...width * 0.85)
            let startY = CGFloat.random(in: height * 0.25...height * 0.45)
            
            let angle = Double.random(in: -Double.pi * 0.85 ... -Double.pi * 0.15)
            let speed = CGFloat.random(in: 260...620)
            let vx = cos(angle) * speed
            let vy = sin(angle) * speed
            
            let shape = shapes.randomElement() ?? .rectangle
            let particleSize: CGSize = {
                switch shape {
                case .rectangle:
                    return CGSize(width: CGFloat.random(in: 7...12), height: CGFloat.random(in: 6...10))
                case .circle:
                    let d = CGFloat.random(in: 6...10)
                    return CGSize(width: d, height: d)
                case .strip:
                    return CGSize(width: CGFloat.random(in: 12...18), height: CGFloat.random(in: 4...6))
                }
            }()
            
            newParticles.append(ConfettiParticle(
                startX: startX,
                startY: startY,
                vx: vx,
                vy: vy,
                gravity: CGFloat.random(in: 550...850),
                wobbleSpeed: Double.random(in: 4.0...10.0),
                wobbleAmplitude: CGFloat.random(in: 15...35),
                rotationSpeed: Double.random(in: -8.0...8.0),
                initialRotation: Double.random(in: 0...Double.pi * 2),
                size: particleSize,
                color: colors.randomElement() ?? .yellow,
                shape: shape
            ))
        }
        
        self.particles = newParticles
    }
}



