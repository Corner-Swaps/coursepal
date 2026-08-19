import SwiftUI
import SwiftData

// MARK: - CoursePal Theme & Course Color Palette
public struct CoursePalTheme {
    static let textDark = Color(red: 0.07, green: 0.11, blue: 0.20)      // Deep Slate Dark
    static let textMuted = Color(red: 0.35, green: 0.42, blue: 0.52)     // Crisp Slate Gray
    static let accentBlue = Color(red: 0.14, green: 0.44, blue: 0.96)    // Electric Blue
    static let pillBlueBg = Color(red: 0.89, green: 0.93, blue: 1.0)     // Soft Blue Pill
    static let bgCanvas = Color(red: 0.95, green: 0.96, blue: 0.98)      // Light Slate Canvas
    static let cardBg = Color.white                                       // Pure White Card
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

    @State private var searchQuery: String = ""
    @State private var selectedDate: Date = Date()
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

    private var completedCount: Int {
        activeReadings.filter({ $0.isCompleted }).count
    }

    private var activeReadings: [Reading] {
        var list = readings
        if let selectedCourseFilter {
            list = list.filter { $0.week?.course?.persistentModelID == selectedCourseFilter.persistentModelID }
        }
        if !searchQuery.isEmpty {
            list = list.filter { $0.title.localizedCaseInsensitiveContains(searchQuery) }
        }
        return list
    }

    private var deletedReadingsCount: Int {
        deletedReadings.count + deletedAssignments.count
    }

    // Group active readings by week number (for lookup)
    private var readingsByWeek: [Int: [Reading]] {
        var grouped: [Int: [Reading]] = [:]
        for reading in activeReadings {
            let weekNum = reading.week?.weekNumber ?? 1
            grouped[weekNum, default: []].append(reading)
        }
        return grouped
    }

    // All course weeks sorted chronologically by calendar date (earliest dates first)
    private var sortedCourseWeeks: [Week] {
        let filtered = allWeeks.filter { $0.course != nil }
        return filtered.sorted { w1, w2 in
            if w1.computedStartDate != w2.computedStartDate {
                return w1.computedStartDate < w2.computedStartDate
            }
            return w1.weekNumber < w2.weekNumber
        }
    }

    // Week numbers ordered strictly by their earliest calendar date (e.g. Sept 5 before Sept 20)
    private var courseWeekNumbers: [Int] {
        let uniqueWeeks = Array(Set(sortedCourseWeeks.map { $0.weekNumber }))
        return uniqueWeeks.sorted { w1, w2 in
            let date1 = sortedCourseWeeks.first(where: { $0.weekNumber == w1 })?.computedStartDate ?? WeekDateConverter.date(forWeek: w1)
            let date2 = sortedCourseWeeks.first(where: { $0.weekNumber == w2 })?.computedStartDate ?? WeekDateConverter.date(forWeek: w2)
            if date1 != date2 {
                return date1 < date2
            }
            return w1 < w2
        }
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
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("\(remainingTotalCount) reading\(remainingTotalCount == 1 ? "" : "s") remaining")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }

                        Spacer()

                        HStack(spacing: 5) {
                            // Info Button
                            Button(action: {
                                showingInfoSheet = true
                            }) {
                                Image(systemName: "info.circle")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 6)
                                    .background(Color.white)
                                    .cornerRadius(12)
                                    .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
                            }
                            .buttonStyle(.plain)

                            // Filter Pill (On the LEFT of the Checkmark)
                            Button(action: {
                                showingCourseFilterSheet = true
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "line.3.horizontal.decrease.circle.fill")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(selectedCourseFilter != nil ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.35, green: 0.42, blue: 0.52))
                                    Text("Filter")
                                        .font(.system(size: 12, weight: .bold, design: .rounded))
                                        .foregroundColor(selectedCourseFilter != nil ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.35, green: 0.42, blue: 0.52))
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(selectedCourseFilter != nil ? Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.15) : Color.white)
                                .cornerRadius(12)
                                .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
                            }
                            .buttonStyle(.plain)

                            // Green Checkmark Pill (Completed Count)
                            Button(action: {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    sortMode = (sortMode == "completed") ? "readings" : "completed"
                                }
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 15, weight: .bold))
                                        .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                                    Text("\(completedCount)")
                                        .font(.system(size: 13, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                                }
                                .padding(.horizontal, 9)
                                .padding(.vertical, 6)
                                .background(sortMode == "completed" ? Color(red: 0.05, green: 0.65, blue: 0.40).opacity(0.15) : Color.white)
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
                                        .font(.system(size: 13, weight: .bold, design: .rounded))
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

                    // MARK: - 1. Master Tall Hero Weekly Reading Tracker Card Box (Matching Assignments Calendar Scale ~280-300pt Tall)

                    VStack(alignment: .leading, spacing: 16) {
                        // 1. Clean Title at the Very Top (Full width, unsquished, no icon, no subtitle)
                        HStack {
                            Text("Weekly Reading Tracker")
                                .font(.system(size: 20, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                            Spacer()
                        }

                        // 2. Large Spacious Horizontal Scrolling Week Cards (Taller pills matching Calendar card scale & edge-to-edge scroll)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                // "ALL WEEKS" Card Pill (width: 86, height: 136) using bottom-left menu book.fill icon!
                                Button(action: {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        if sortMode == "completed" || sortMode == "trash" {
                                            sortMode = "readings"
                                        }
                                        selectedWeekFilter = 0
                                    }
                                }) {
                                    VStack(spacing: 8) {
                                        Text("ALL")
                                            .font(.system(size: 13, weight: .bold))
                                            .foregroundColor(selectedWeekFilter == 0 ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.35, green: 0.42, blue: 0.52))

                                        ZStack {
                                            RoundedRectangle(cornerRadius: 18)
                                                .fill(selectedWeekFilter == 0 ? LinearGradient(colors: [Color(red: 0.14, green: 0.44, blue: 0.96), Color(red: 0.25, green: 0.55, blue: 0.98)], startPoint: .topLeading, endPoint: .bottomTrailing) : LinearGradient(colors: [Color(red: 0.94, green: 0.95, blue: 0.97), Color(red: 0.91, green: 0.93, blue: 0.96)], startPoint: .top, endPoint: .bottom))
                                                .frame(width: 50, height: 50)

                                            Image(systemName: "book.fill")
                                                .font(.system(size: 22, weight: .bold))
                                                .foregroundColor(selectedWeekFilter == 0 ? .white : Color(red: 0.35, green: 0.42, blue: 0.52))
                                        }

                                        Text("\(remainingTotalCount) Total")
                                            .font(.system(size: 11.5, weight: .bold, design: .rounded))
                                            .foregroundColor(selectedWeekFilter == 0 ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.45, green: 0.52, blue: 0.62))
                                    }
                                    .padding(.vertical, 12)
                                    .padding(.horizontal, 10)
                                    .frame(width: 86, height: 136)
                                    .background(selectedWeekFilter == 0 ? Color(red: 0.89, green: 0.93, blue: 1.0) : Color(red: 0.97, green: 0.98, blue: 0.99))
                                    .cornerRadius(20)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 20)
                                            .stroke(selectedWeekFilter == 0 ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: selectedWeekFilter == 0 ? 2 : 1)
                                    )
                                }
                                .buttonStyle(.plain)

                                // Dynamic Week Cards (W1, W2, W3 ... W16) - Large Spacious Format (width: 86, height: 136)
                                let weekNums = courseWeekNumbers.isEmpty
                                    ? Array(1...(courses.map { $0.termWeeks }.max() ?? 12))
                                    : courseWeekNumbers

                                ForEach(weekNums, id: \.self) { weekNum in
                                    let isSelected = selectedWeekFilter == weekNum
                                    let weekReadings = readingsByWeek[weekNum] ?? []
                                    let uncompletedWeekReadings = weekReadings.filter { !$0.isCompleted }
                                    let weekDone = !weekReadings.isEmpty && uncompletedWeekReadings.isEmpty
                                    let weekCount = uncompletedWeekReadings.count

                                    Button(action: {
                                        withAnimation(.easeInOut(duration: 0.2)) {
                                            if sortMode == "completed" || sortMode == "trash" {
                                                sortMode = "readings"
                                            }
                                            selectedWeekFilter = (selectedWeekFilter == weekNum) ? 0 : weekNum
                                        }
                                    }) {
                                        VStack(spacing: 8) {
                                            Text("Week \(weekNum)")
                                                .font(.system(size: 13, weight: isSelected ? .bold : .semibold))
                                                .foregroundColor(isSelected ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.35, green: 0.42, blue: 0.52))

                                            ZStack {
                                                Circle()
                                                    .fill(isSelected ? LinearGradient(colors: [Color(red: 0.14, green: 0.44, blue: 0.96), Color(red: 0.25, green: 0.55, blue: 0.98)], startPoint: .topLeading, endPoint: .bottomTrailing) : (weekDone ? LinearGradient(colors: [Color(red: 0.05, green: 0.65, blue: 0.40), Color(red: 0.10, green: 0.75, blue: 0.45)], startPoint: .top, endPoint: .bottom) : LinearGradient(colors: [Color(red: 0.93, green: 0.94, blue: 0.96), Color(red: 0.89, green: 0.91, blue: 0.94)], startPoint: .top, endPoint: .bottom)))
                                                    .frame(width: 50, height: 50)

                                                if weekDone {
                                                    Image(systemName: "checkmark")
                                                        .font(.system(size: 18, weight: .bold))
                                                        .foregroundColor(.white)
                                                } else {
                                                    Text("\(weekCount)")
                                                        .font(.system(size: 18, weight: .bold, design: .rounded))
                                                        .foregroundColor(isSelected ? .white : Color(red: 0.08, green: 0.12, blue: 0.22))
                                                }
                                            }
                                            .transaction { $0.animation = nil }

                                            // Item Count Display under Week Circle (Static 'Items' per user directive)
                                            Text("Items")
                                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                                .foregroundColor(isSelected ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.35, green: 0.42, blue: 0.52))
                                                .frame(height: 16)
                                        }
                                        .padding(.vertical, 12)
                                        .padding(.horizontal, 10)
                                        .frame(width: 86, height: 136)
                                        .background(isSelected ? Color(red: 0.89, green: 0.93, blue: 1.0) : Color.white)
                                        .cornerRadius(20)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 20)
                                                .stroke(isSelected ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: isSelected ? 2 : 1)
                                        )
                                        .shadow(color: isSelected ? Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.15) : Color.black.opacity(0.02), radius: 6, x: 0, y: 3)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 4)
                        }
                        .padding(.horizontal, -16)

                    }
                    .padding(16)
                    .background(Color.white)
                    .cornerRadius(20)
                    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)
                    .padding(.horizontal, 18)
                    .transaction { $0.animation = nil }

                    // MARK: - 2. Search Bar (Below Week Bar)
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.secondary)
                        TextField("Search readings…", text: $searchQuery)
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

                    // MARK: - Reading Progress Bar Box (Persistent on Main Readings Page under Search Pill)
                    let totalActiveCount = activeReadings.count
                    let progressPct = totalActiveCount > 0 ? Int((Double(completedCount) / Double(totalActiveCount)) * 100) : 0

                    if totalActiveCount > 0 && completedCount == totalActiveCount {
                        // Dedicated Celebration Card overtaking standard progress bar when 100% complete
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 0.05, green: 0.65, blue: 0.40).opacity(0.18))
                                    .frame(width: 38, height: 38)
                                Image(systemName: "checkmark.seal.fill")
                                    .font(.system(size: 20, weight: .bold))
                                    .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Congratulations! 🎉")
                                    .font(.system(size: 14.5, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.05, green: 0.55, blue: 0.35))

                                Text("You finished all readings!")
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }

                            Spacer()

                            Text("100%")
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(Color(red: 0.05, green: 0.65, blue: 0.40))
                                .cornerRadius(12)
                        }
                        .padding(14)
                        .background(Color(red: 0.05, green: 0.65, blue: 0.40).opacity(0.08))
                        .cornerRadius(18)
                        .overlay(
                            RoundedRectangle(cornerRadius: 18)
                                .stroke(Color(red: 0.05, green: 0.65, blue: 0.40).opacity(0.25), lineWidth: 1)
                        )
                        .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                        .padding(.horizontal, 18)
                    } else {
                        VStack(spacing: 8) {
                            HStack {
                                HStack(spacing: 6) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                                    Text("Readings Progress")
                                        .font(.system(size: 13, weight: .bold, design: .rounded))
                                        .foregroundColor(CoursePalTheme.textDark)
                                }
                                Spacer()
                                Button(action: {
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                        sortMode = "completed"
                                    }
                                }) {
                                    Text("\(completedCount) of \(totalActiveCount) Done (\(progressPct)%)")
                                        .font(.system(size: 11, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Color(red: 0.05, green: 0.65, blue: 0.40).opacity(0.12))
                                        .cornerRadius(12)
                                }
                                .buttonStyle(.plain)
                            }

                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    RoundedRectangle(cornerRadius: 6)
                                        .fill(Color(red: 0.89, green: 0.91, blue: 0.94))
                                        .frame(height: 7)

                                    RoundedRectangle(cornerRadius: 6)
                                        .fill(LinearGradient(colors: [Color(red: 0.05, green: 0.65, blue: 0.40), Color(red: 0.10, green: 0.75, blue: 0.45)], startPoint: .leading, endPoint: .trailing))
                                        .frame(width: geo.size.width * CGFloat(totalActiveCount > 0 ? Double(completedCount) / Double(totalActiveCount) : 0), height: 7)
                                }
                            }
                            .frame(height: 7)
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
                            Text("Filtered by: \(course.courseCode ?? "CRS") · \(course.courseName)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Spacer()
                            Button(action: {
                                withAnimation {
                                    selectedCourseFilter = nil
                                }
                            }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(Color(red: 0.55, green: 0.62, blue: 0.72))
                                    .font(.system(size: 14))
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color.white)
                        .cornerRadius(12)
                        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
                        .padding(.horizontal, 18)
                        .padding(.bottom, 4)
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
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(CoursePalTheme.textDark)
                            Text("Upload a syllabus to automatically populate your reading schedule.")
                                .font(.system(size: 12.5))
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
                        .padding(.horizontal, 18)
                    } else if sortMode == "readings" || sortMode == "week" {
                        // ── READINGS GROUPED BY WEEK ──────────────────
                        let allWeekNums = courseWeekNumbers.isEmpty
                            ? Array(1...(courses.map { $0.termWeeks }.max() ?? 12))
                            : courseWeekNumbers
                        let displayNums: [Int] = selectedWeekFilter == 0
                            ? allWeekNums
                            : (allWeekNums.filter { $0 == selectedWeekFilter }.isEmpty ? [selectedWeekFilter] : allWeekNums.filter { $0 == selectedWeekFilter })
                        let activeDisplayNums: [Int] = {
                            let filtered = displayNums.filter { num in
                                if selectedWeekFilter != 0 && num == selectedWeekFilter { return true }
                                let weekReadings = readingsByWeek[num] ?? []
                                return !weekReadings.isEmpty
                            }
                            if filtered.isEmpty {
                                return [selectedWeekFilter == 0 ? 1 : selectedWeekFilter]
                            }
                            return filtered
                        }()

                        VStack(alignment: .leading, spacing: 18) {
                            ForEach(activeDisplayNums, id: \.self) { weekNum in
                                let weekReadings = readingsByWeek[weekNum] ?? []

                                VStack(alignment: .leading, spacing: 10) {
                                    HStack(spacing: 8) {
                                        Text("Week \(weekNum)")
                                            .font(.system(size: 13, weight: .bold, design: .rounded))
                                            .foregroundColor(CoursePalTheme.accentBlue)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 4)
                                            .background(CoursePalTheme.pillBlueBg)
                                            .cornerRadius(10)

                                        Spacer()

                                        if !weekReadings.isEmpty {
                                            Button(action: {
                                                withAnimation { deleteWeekSection(weekNum: weekNum) }
                                            }) {
                                                HStack(spacing: 4) {
                                                    Image(systemName: "trash.fill")
                                                        .font(.system(size: 10, weight: .bold))
                                                    Text("Delete Week")
                                                        .font(.system(size: 10.5, weight: .bold))
                                                }
                                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 5)
                                                .background(Color(red: 0.93, green: 0.94, blue: 0.96))
                                                .cornerRadius(12)
                                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(red: 0.85, green: 0.88, blue: 0.92), lineWidth: 1))
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }

                                    if weekReadings.isEmpty {
                                        HStack(spacing: 10) {
                                            Image(systemName: "calendar.badge.clock")
                                                .font(.system(size: 14))
                                                .foregroundColor(CoursePalTheme.textMuted)
                                            Text("No readings assigned for this week")
                                                .font(.system(size: 12.5))
                                                .foregroundColor(CoursePalTheme.textMuted)
                                            Spacer()
                                            Button(action: { showingAddModal = true }) {
                                                Text("+ Add")
                                                    .font(.system(size: 11, weight: .bold))
                                                    .foregroundColor(CoursePalTheme.accentBlue)
                                                    .padding(.horizontal, 10)
                                                    .padding(.vertical, 5)
                                                    .background(CoursePalTheme.pillBlueBg)
                                                    .cornerRadius(10)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                        .padding(14)
                                        .frame(maxWidth: .infinity)
                                        .background(Color.white)
                                        .cornerRadius(14)
                                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(red: 0.89, green: 0.91, blue: 0.94).opacity(0.6), lineWidth: 1))
                                    } else {
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
                                            Text(courseObj?.courseCode ?? courseName)
                                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                                .foregroundColor(courseColor)
                                            Text(courseName)
                                                .font(.system(size: 10.5, weight: .medium))
                                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                        }
                                        Spacer()
                                        Text("\(courseReadings.count) reading\(courseReadings.count == 1 ? "" : "s")")
                                            .font(.system(size: 10, weight: .bold))
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
                                    .font(.system(size: 11, weight: .bold))
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
                                        .font(.system(size: 15, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                    Text("Readings you mark as complete will be shown here.")
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
                        // ── INLINE TRASH BIN ──────────────────
                        VStack(alignment: .leading, spacing: 10) {
                            if !deletedReadings.isEmpty || !deletedAssignments.isEmpty {
                                Button(action: {
                                    withAnimation {
                                        for r in deletedReadings { modelContext.delete(r) }
                                        for a in deletedAssignments { modelContext.delete(a) }
                                        try? modelContext.save()
                                    }
                                }) {
                                    HStack(spacing: 8) {
                                        Spacer()
                                        Image(systemName: "trash.fill")
                                            .font(.system(size: 13, weight: .bold))
                                        Text("Empty Trash")
                                            .font(.system(size: 13, weight: .bold))
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
                                .padding(.bottom, 6)
                            }

                            if deletedReadings.isEmpty {
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
                                    Text("Deleted readings will be stored here for easy recovery.")
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
                                ForEach(deletedReadings) { reading in
                                    HStack {
                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(reading.title)
                                                .font(.system(size: 14, weight: .bold))
                                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                            Text("\(reading.week?.course?.courseCode ?? "CRS") · Week \(reading.week?.weekNumber ?? 1)")
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
                                                .font(.system(size: 11, weight: .bold))
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
                        .padding(.horizontal, 18)
                    }

                    Spacer(minLength: 90)
                }
            }
            .scrollDismissesKeyboard(.immediately)
            .background(CoursePalTheme.bgCanvas)
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
        .dismissKeyboardOnTap()
    }

    private func toggleReading(_ reading: Reading) {
        reading.isCompleted.toggle()
        try? modelContext.save()
    }

    private func softDeleteReading(_ reading: Reading) {
        withAnimation(.easeInOut(duration: 0.25)) {
            reading.isDeleted = true
            try? modelContext.save()
        }
    }

    private func deleteWeekSection(weekNum: Int) {
        withAnimation(.easeInOut(duration: 0.25)) {
            for r in readings.filter({ $0.week?.weekNumber == weekNum }) {
                r.isDeleted = true
            }
            for a in dbAssignments.filter({ $0.weekNumber == weekNum }) {
                a.isDeleted = true
            }
            try? modelContext.save()
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

    public var body: some View {
        HStack(spacing: 10) {
            // Single Vertical Course Color Line Indicator
            RoundedRectangle(cornerRadius: 3)
                .fill(courseColor)
                .frame(width: 4, height: 36)

            // Content Area
            VStack(alignment: .leading, spacing: 3) {
                // Top Line: Course Main Title Pill (Left) & Media Type Badge (Right)
                let rawCourseName = reading.week?.course?.courseName
                let rawCourseCode = reading.week?.course?.courseCode
                let displayCourseTitle: String = {
                    if let code = rawCourseCode, !code.trimmingCharacters(in: .whitespaces).isEmpty, code.lowercased() != "course" {
                        if let name = rawCourseName, !name.trimmingCharacters(in: .whitespaces).isEmpty, name.lowercased() != "course", name.lowercased() != "unassigned" {
                            let cleanCode = code.trimmingCharacters(in: .whitespaces)
                            let cleanName = name.trimmingCharacters(in: .whitespaces)
                            if cleanName.lowercased().hasPrefix(cleanCode.lowercased()) {
                                return cleanName
                            }
                            return "\(cleanCode) · \(cleanName)"
                        }
                        return code
                    }
                    return rawCourseName ?? "COURSE"
                }()

                HStack(spacing: 6) {
                    Text(displayCourseTitle)
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(courseColor)

                    // 2. Media Type Badge (Video, Textbook, etc.) nestled right next to course title
                    HStack(spacing: 3) {
                        Image(systemName: reading.mediaType.iconName)
                            .font(.system(size: 8.5, weight: .semibold))
                        Text(reading.mediaType.displayName.uppercased())
                            .font(.system(size: 9.5, weight: .semibold, design: .rounded))
                    }
                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Color(red: 0.94, green: 0.95, blue: 0.97))
                    .cornerRadius(6)

                    Spacer(minLength: 0)
                }

                // Reading Title (Verbatim title without regex truncation or forced capitalization)
                Text(reading.title)
                    .font(.system(size: 14.5, weight: .bold, design: .rounded))
                    .foregroundColor(reading.isCompleted ? CoursePalTheme.textMuted : Color(red: 0.22, green: 0.28, blue: 0.38))
                    .strikethrough(reading.isCompleted)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                // Date Display (Due date formatted: "Due [Day], [Month] [Date] · Week [WeekNumber]")
                let readingDateText: String = {
                    let w = reading.week?.weekNumber ?? 1
                    return WeekDateConverter.formattedDueDate(for: reading.dueDate, week: reading.week, weekNumber: w)
                }()

                HStack(spacing: 8) {
                    Text(readingDateText)
                        .font(.system(size: 10.5, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                }
                .padding(.top, 1)

                // Real Clickable Resource Link (Only displayed if a valid URL exists)
                if let videoUrl = reading.videoUrl, URLHelper.isValidURL(videoUrl), let url = URLHelper.formatURL(videoUrl) {
                    Link(destination: url) {
                        HStack(spacing: 4) {
                            Image(systemName: "link.circle.fill")
                                .font(.system(size: 10, weight: .bold))
                            Text(url.absoluteString)
                                .font(.system(size: 10.5, weight: .semibold, design: .rounded))
                                .lineLimit(1)
                            Image(systemName: "arrow.up.right.square")
                                .font(.system(size: 9.5, weight: .bold))
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

            // Right-side Clean Action Buttons: Checkmark Ring & Trashcan
            HStack(spacing: 12) {
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
                    .frame(width: 36, height: 36)
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
                        .frame(width: 32, height: 32)
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
    @State private var videoUrlInput: String = ""
    @State private var dateRangeInput: String = ""
    @State private var dueDateInput: Date = Date()
    @State private var chapterInput: String = ""
    @State private var topicsInput: String = ""
    @State private var notesInput: String = ""
    @State private var isSyncing: Bool = false

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

                    // Section 2: Combined Week & Date Range Section with Bidirectional Sync
                    Section("Week & Date Range") {
                        Picker("Week", selection: $selectedWeekNum) {
                            ForEach(1...20, id: \.self) { w in
                                Text("Week \(w)").tag(w)
                            }
                        }
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .pickerStyle(.menu)
                        .onChange(of: selectedWeekNum) { _, newWeekNum in
                            guard !isSyncing else { return }
                            isSyncing = true
                            if let course = reading.week?.course,
                               let targetWeek = course.weeks.first(where: { $0.weekNumber == newWeekNum }) {
                                reading.week = targetWeek
                            }
                            let calculatedDate = reading.week?.computedStartDate ?? WeekDateConverter.date(forWeek: newWeekNum)
                            dueDateInput = calculatedDate
                            reading.dueDate = calculatedDate
                            let formatter = DateFormatter()
                            formatter.dateStyle = .medium
                            reading.dateRangeStr = reading.week?.dateRangeStr ?? formatter.string(from: calculatedDate)
                            isSyncing = false
                        }

                        DatePicker("Date Range", selection: $dueDateInput, displayedComponents: [.date])
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .onChange(of: dueDateInput) { _, newDate in
                                guard !isSyncing else { return }
                                isSyncing = true
                                reading.dueDate = newDate
                                let formatter = DateFormatter()
                                formatter.dateStyle = .medium
                                reading.dateRangeStr = formatter.string(from: newDate)
                                let calculatedWeek = WeekDateConverter.weekNumber(for: newDate)
                                selectedWeekNum = calculatedWeek
                                if let course = reading.week?.course,
                                   let targetWeek = course.weeks.first(where: { $0.weekNumber == calculatedWeek }) {
                                    reading.week = targetWeek
                                }
                                isSyncing = false
                            }
                    }

                    // Section 3: Dedicated Chapter & Pages Section
                    Section("Chapter & Pages") {
                        TextField("e.g. Chapter 4, pp. 120-155", text: $chapterInput)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .onChange(of: chapterInput) { _, newValue in
                                let (ch, pg) = LocalSyllabusParser.shared.extractChapterAndPages(from: newValue)
                                reading.chapterText = ch ?? newValue
                                reading.pagesText = pg
                            }
                    }

                    // Section 4: Dedicated Topics Section (Read-only display of document topics & descriptions)
                    Section("Topics") {
                        let topicsList = reading.computedTopics
                        if !topicsList.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                ForEach(Array(topicsList.enumerated()), id: \.offset) { idx, topicStr in
                                    VStack(alignment: .leading, spacing: 4) {
                                        HStack(spacing: 6) {
                                            Image(systemName: "book.pages.fill")
                                                .font(.system(size: 11, weight: .bold))
                                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))

                                            Text("TOPIC \(idx + 1)")
                                                .font(.system(size: 10, weight: .bold))
                                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                        }

                                        Text(topicStr)
                                            .font(.system(size: 13.5, weight: .semibold, design: .rounded))
                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                            .fixedSize(horizontal: false, vertical: true)
                                    }
                                    .padding(12)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color.white)
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                                    )
                                }
                            }
                            .padding(.vertical, 4)
                        } else {
                            Text("No topics specified in document")
                                .font(.system(size: 13.5, weight: .medium, design: .rounded))
                                .foregroundColor(Color(red: 0.55, green: 0.62, blue: 0.72))
                                .padding(.vertical, 4)
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

                    // Section 7: Notes Section (Clean & Empty by default)
                    Section("Notes") {
                        TextField("Enter notes...", text: $notesInput, axis: .vertical)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .lineLimit(4...10)
                            .onChange(of: notesInput) { _, newValue in
                                reading.summaryText = newValue
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
                videoUrlInput = reading.videoUrl ?? ""
                dateRangeInput = reading.dateRangeStr ?? reading.week?.dateRangeStr ?? ""
                dueDateInput = reading.dueDate ?? (reading.week?.computedEndDate ?? WeekDateConverter.date(forWeek: selectedWeekNum))
                
                if let chDisplay = reading.chapterAndPagesDisplay, !chDisplay.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    chapterInput = chDisplay
                } else {
                    let (ch, pg) = LocalSyllabusParser.shared.extractChapterAndPages(from: reading.title)
                    var parts: [String] = []
                    if let c = ch { parts.append(c) }
                    if let p = pg { parts.append(p) }
                    chapterInput = parts.joined(separator: " • ")
                    if !parts.isEmpty {
                        reading.chapterText = ch
                        reading.pagesText = pg
                    }
                }
                
                topicsInput = reading.relevantTopics ?? ""
                notesInput = reading.summaryText
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
                                                    Text(reading.week?.course?.courseCode ?? "Course")
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
                                                    Text(assignment.course?.courseCode ?? "Course")
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
                                        Text("\(reading.week?.course?.courseCode ?? "Course") · Week \(reading.week?.weekNumber ?? 1)")
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
                                        Text("\(assignment.course?.courseCode ?? "Course") · Week \(assignment.weekNumber)")
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


