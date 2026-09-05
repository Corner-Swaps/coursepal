import SwiftUI
import SwiftData
import UniformTypeIdentifiers

// MARK: - Course Color Utilities
public struct CourseColorHelper {
    public static func color(for hex: String) -> Color {
        let cleanHex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted).uppercased()
        var int: UInt64 = 0
        Scanner(string: cleanHex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch cleanHex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 37, 99, 235)
        }
        return Color(
            .sRGB,
            red: Double(r) / 255.0,
            green: Double(g) / 255.0,
            blue: Double(b) / 255.0,
            opacity: Double(a) / 255.0
        )
    }
}

public struct AssignmentsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Course.createdAt, order: .reverse) private var courses: [Course]
    @Query(filter: #Predicate<Assignment> { !$0.isDeleted }, sort: \Assignment.weekNumber, order: .forward) private var dbAssignments: [Assignment]
    @Query(filter: #Predicate<Assignment> { $0.isDeleted }) private var deletedAssignments: [Assignment]
    @Query(filter: #Predicate<Reading> { $0.isDeleted }) private var deletedReadings: [Reading]
    @Query private var allReadings: [Reading]
    @Query private var allWeeks: [Week]

    @State private var searchQuery: String = ""
    @State private var selectedDate: Date = Date()
    @State private var isDateFilterActive: Bool = false
    @State private var sortMode: String = "assignments" // default: assignments section
    @State private var expandedCourseCodes: Set<String> = []
    @State private var editingAssignment: Assignment? = nil
    @State private var attachingToAssignment: Assignment? = nil
    @State private var showingFileImporter: Bool = false
    @State private var itemToDelete: Assignment? = nil
    @State private var showingDeleteConfirm: Bool = false
    @State private var showingTrashSheet: Bool = false
    @State private var selectedCourseFilter: Course? = nil
    @State private var showingCourseFilterSheet: Bool = false
    @State private var showingInfoSheet: Bool = false
    @State private var showingEmptyTrashConfirmation: Bool = false
    @State private var showingConfetti: Bool = false
    @State private var confettiTitle: String = ""

    private var activeAssignments: [Assignment] {
        var list = dbAssignments.filter { !$0.isDeleted }
        if let selectedCourseFilter {
            list = list.filter { $0.course?.persistentModelID == selectedCourseFilter.persistentModelID }
        }
        if !searchQuery.isEmpty {
            let q = searchQuery.lowercased()
            list = list.filter {
                $0.title.lowercased().contains(q) ||
                ($0.noteText?.lowercased().contains(q) ?? false) ||
                ($0.course?.courseName.lowercased().contains(q) ?? false) ||
                ($0.course?.courseCode?.lowercased().contains(q) ?? false)
            }
        }
        return list
    }

    private var completedAssignments: [Assignment] {
        dbAssignments.filter { !$0.isDeleted && $0.isCompleted }
    }

    private var assignmentsForSelectedDate: [Assignment] {
        dbAssignments.filter { assign in
            guard let due = assign.dueDate else { return false }
            return !assign.isDeleted && Calendar.current.isDate(due, inSameDayAs: selectedDate)
        }
    }

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 16) {
                    // MARK: - Page Header
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Assignments")
                                .font(.cpPageTitle)
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("\(activeAssignments.count) assignments this term")
                                .font(.cpDescriptionMedium)
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }
                        Spacer()

                        // Top Right Corner Action Icons: Filter, Done (Green Count) & Trash (Red Count)
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
                                    sortMode = (sortMode == "completed") ? "assignments" : "completed"
                                }
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(Color(red: 0.18, green: 0.72, blue: 0.40))
                                    Text("\(completedAssignments.count)")
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

                            Button(action: {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    sortMode = (sortMode == "trash") ? "assignments" : "trash"
                                }
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "trash")
                                        .font(.system(size: 14, weight: .regular))
                                        .foregroundColor(Color(red: 0.85, green: 0.25, blue: 0.20))
                                    Text("\(deletedAssignments.count + deletedReadings.count)")
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

                    // MARK: - Interactive Deadlines Calendar Card (Split Layout matching localhost Screenshot 2)
                    VStack(spacing: 12) {
                        // Month Nav Header (< Aug 2026 >)
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
                            // Left Hero Date (Tuesday 4) - Tapping brings up Calendar Schedule view
                            Button(action: {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    isDateFilterActive = true
                                    sortMode = "calendar"
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
                                            let hasDeadline = hasAssignmentOnDate(date)

                                            Button(action: {
                                                withAnimation(.easeInOut(duration: 0.2)) {
                                                    if isDateFilterActive && Calendar.current.isDate(date, inSameDayAs: selectedDate) && sortMode == "calendar" {
                                                        isDateFilterActive = false
                                                    } else {
                                                        selectedDate = date
                                                        isDateFilterActive = true
                                                        sortMode = "calendar"
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

                    // MARK: - Search Bar (Module 4.2 with Native X Clear Button)
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.secondary)
                        TextField("Search assignments...", text: $searchQuery)
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

                    // MARK: - Per-Course Assignment Progress Bars
                    let coursesForProgress: [Course] = {
                        if let selectedCourseFilter {
                            return [selectedCourseFilter]
                        }
                        return courses
                    }()

                    if !coursesForProgress.isEmpty && !activeAssignments.isEmpty {
                        VStack(spacing: 12) {
                            ForEach(coursesForProgress) { course in
                                let courseAssigns = dbAssignments.filter { !$0.isDeleted && $0.course?.persistentModelID == course.persistentModelID }
                                let cTotal = courseAssigns.count
                                let cDone = courseAssigns.filter { $0.isCompleted }.count
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
                            Text("Filtered by: \(course.courseCode ?? "CRS") · \(course.courseName)")
                                .font(.cpDescriptionBold)
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
                        .padding(.bottom, 10)
                    }

                    // MARK: - Filtered Assignments Section
                    if activeAssignments.isEmpty && sortMode != "trash" {
                        VStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 18)
                                    .fill(Color(red: 0.89, green: 0.93, blue: 1.0))
                                    .frame(width: 56, height: 56)
                                Image(systemName: "checkmark.seal.fill")
                                    .font(.system(size: 24))
                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                            }

                            Text(searchQuery.isEmpty ? "No assignments yet" : "No results found")
                                .font(.cpItemTitle)
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text(searchQuery.isEmpty ? "Add assignments manually or parse a syllabus to populate them automatically." : "Nothing matches \"\(searchQuery)\".")
                                .font(.cpDescription)
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: 240)
                        }
                        .padding(.vertical, 36)
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
                    } else {
                        VStack(alignment: .leading, spacing: 14) {
                            if sortMode == "assignments" || sortMode == "all" {
                                VStack(alignment: .leading, spacing: 18) {
                                    ForEach(activeWeekNumbersForAssignments, id: \.self) { weekNum in
                                        let weekAssigns = (assignmentsByWeek[weekNum] ?? []).sorted(by: { ($0.dueDate ?? Date.distantFuture) < ($1.dueDate ?? Date.distantFuture) })

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

                                                    if let mod = weekModuleMentionForAssignment(for: weekNum), !mod.isEmpty {
                                                        Text(mod)
                                                            .font(.system(size: 11, weight: .bold, design: .rounded))
                                                            .foregroundColor(.white)
                                                            .padding(.horizontal, 8)
                                                            .padding(.vertical, 3)
                                                            .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                                            .clipShape(Capsule())
                                                    }

                                                    if let range = weekDateRangeForAssignment(for: weekNum), !range.isEmpty {
                                                        Text(range)
                                                            .font(.system(size: 11, weight: .medium, design: .rounded))
                                                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                                    }

                                                    Spacer()
                                                }
                                                .padding(.top, 4)
                                            } else {
                                                HStack(spacing: 6) {
                                                    Text("General Deliverables")
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

                                            VStack(spacing: 8) {
                                                ForEach(weekAssigns) { assignment in
                                                    AssignmentCardRow(
                                                        assignment: assignment,
                                                        onToggle: {
                                                            toggleAssignment(assignment)
                                                        },
                                                        onEdit: { editingAssignment = assignment },
                                                        onDelete: {
                                                            withAnimation(.easeInOut(duration: 0.25)) {
                                                                assignment.isDeleted = true
                                                                try? modelContext.save()
                                                                DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
                                                            }
                                                        }
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            } else if sortMode == "completed" {
                                let completedList = activeAssignments.filter { $0.isCompleted }
                                if completedList.isEmpty {
                                    VStack(spacing: 8) {
                                        Text("No completed assignments yet")
                                            .font(.cpDescription)
                                            .foregroundColor(.gray)
                                    }
                                    .padding(16)
                                    .frame(maxWidth: .infinity)
                                    .background(Color.white)
                                    .cornerRadius(14)
                                } else {
                                    ForEach(completedList) { assignment in
                                        AssignmentCardRow(
                                            assignment: assignment,
                                            onToggle: {
                                                toggleAssignment(assignment)
                                            },
                                            onEdit: { editingAssignment = assignment },
                                            onDelete: {
                                                withAnimation(.easeInOut(duration: 0.25)) {
                                                    assignment.isDeleted = true
                                                    try? modelContext.save()
                                                    DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
                                                }
                                            }
                                        )
                                    }
                                }
                            } else if sortMode == "categories" {
                                // ── CATEGORIES & WEIGHT BREAKDOWN SEPARATE SECTION ────────────────
                                let categoriesList = ["Exams & Tests", "Quizzes & Assessments", "Projects & Papers", "Homework & Coursework", "Attendance & Participation"]
                                let grouped = Dictionary(grouping: activeAssignments) { categoryForAssignment($0) }

                                ForEach(categoriesList, id: \.self) { catName in
                                    if let catAssigns = grouped[catName], !catAssigns.isEmpty {
                                        let totalWeight: String = {
                                            var pctSum = 0
                                            var ptsSum = 0
                                            for a in catAssigns {
                                                let ptsStr = a.pointsPossible ?? ""
                                                let digits = ptsStr.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                                                if let val = Int(digits), val > 0 {
                                                    if ptsStr.contains("%") {
                                                        pctSum += val
                                                    } else {
                                                        ptsSum += val
                                                    }
                                                }
                                            }
                                            if pctSum > 0 && ptsSum > 0 {
                                                return "\(pctSum)% Weight • \(ptsSum) Pts"
                                            } else if pctSum > 0 {
                                                return "\(pctSum)% Weight Total"
                                            } else if ptsSum > 0 {
                                                return "\(ptsSum) Pts Total"
                                            } else {
                                                return "\(catAssigns.count) Items"
                                            }
                                        }()

                                        VStack(alignment: .leading, spacing: 12) {
                                            // Category Section Header
                                            HStack {
                                                HStack(spacing: 8) {
                                                    Image(systemName: "folder.fill")
                                                        .font(.system(size: 14))
                                                        .foregroundColor(Color(red: 0.06, green: 0.73, blue: 0.50))
                                                    Text(catName)
                                                        .font(.system(size: 15, weight: .bold, design: .rounded))
                                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                }

                                                Spacer()

                                                Text(totalWeight)
                                                    .font(.system(size: 11.5, weight: .bold))
                                                    .foregroundColor(Color(red: 0.06, green: 0.73, blue: 0.50))
                                                    .padding(.horizontal, 10)
                                                    .padding(.vertical, 4)
                                                    .background(Color(red: 0.06, green: 0.73, blue: 0.50).opacity(0.1))
                                                    .cornerRadius(8)
                                            }
                                            .padding(.horizontal, 4)

                                            // List of assignments in this category
                                            ForEach(catAssigns) { assignment in
                                                AssignmentCardRow(
                                                    assignment: assignment,
                                                    onToggle: {
                                                        toggleAssignment(assignment)
                                                    },
                                                    onEdit: { editingAssignment = assignment },
                                                    onDelete: {
                                                        withAnimation(.easeInOut(duration: 0.25)) {
                                                            assignment.isDeleted = true
                                                            try? modelContext.save()
                                                            DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
                                                        }
                                                    }
                                                )
                                            }
                                        }
                                        .padding(.bottom, 8)
                                    }
                                }
                            } else if sortMode == "calendar" {
                                // Calendar Date Section (Shows exact date instead of week)
                                let groupedByDate = assignmentsByDay
                                let datesToShow = isDateFilterActive ? [Calendar.current.startOfDay(for: selectedDate)] : groupedByDate.keys.sorted()

                                ForEach(datesToShow, id: \.self) { dateKey in
                                    let dateAssigns = groupedByDate[dateKey] ?? []
                                    VStack(alignment: .leading, spacing: 8) {
                                        HStack {
                                            HStack(spacing: 6) {
                                                Image(systemName: "calendar.badge.clock")
                                                    .font(.system(size: 12, weight: .bold))
                                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                                Text(fullDateHeaderString(for: dateKey))
                                                    .font(.system(size: 11, weight: .bold))
                                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                            }

                                            Spacer()

                                            if !dateAssigns.isEmpty {
                                                Text("\(dateAssigns.count) due")
                                                    .font(.system(size: 10, weight: .bold))
                                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                            }
                                        }
                                        .padding(.leading, 4)

                                        if dateAssigns.isEmpty {
                                            HStack(spacing: 8) {
                                                Image(systemName: "sun.max.fill")
                                                    .font(.system(size: 14))
                                                    .foregroundColor(Color(red: 0.95, green: 0.60, blue: 0.10))
                                                Text("No assignments due on this date — enjoy your break!")
                                                    .font(.system(size: 12.5, weight: .medium))
                                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                            }
                                            .padding(14)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .background(Color.white)
                                            .cornerRadius(16)
                                            .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                                        } else {
                                            ForEach(dateAssigns) { assignment in
                                                AssignmentCardRow(
                                                    assignment: assignment,
                                                    onToggle: {
                                                        toggleAssignment(assignment)
                                                    },
                                                    onEdit: { editingAssignment = assignment },
                                                    onDelete: {
                                                        withAnimation(.easeInOut(duration: 0.25)) {
                                                            assignment.isDeleted = true
                                                            try? modelContext.save()
                                                            DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
                                                        }
                                                    }
                                                )
                                            }
                                        }
                                    }
                                }

                                let undatedAssigns = activeAssignments.filter { $0.dueDate == nil }
                                if !undatedAssigns.isEmpty && !isDateFilterActive {
                                    VStack(alignment: .leading, spacing: 8) {
                                        HStack {
                                            HStack(spacing: 6) {
                                                Image(systemName: "calendar.badge.exclamationmark")
                                                    .font(.system(size: 12, weight: .bold))
                                                    .foregroundColor(Color(red: 0.45, green: 0.50, blue: 0.58))
                                                Text("UNDATED DELIVERABLES")
                                                    .font(.system(size: 11, weight: .bold))
                                                    .foregroundColor(Color(red: 0.45, green: 0.50, blue: 0.58))
                                            }

                                            Spacer()

                                            Text("\(undatedAssigns.count) item\(undatedAssigns.count == 1 ? "" : "s")")
                                                .font(.system(size: 10, weight: .bold))
                                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                        }
                                        .padding(.leading, 4)

                                        ForEach(undatedAssigns) { assignment in
                                            AssignmentCardRow(
                                                assignment: assignment,
                                                onToggle: {
                                                    toggleAssignment(assignment)
                                                },
                                                onEdit: { editingAssignment = assignment },
                                                onDelete: {
                                                    withAnimation(.easeInOut(duration: 0.25)) {
                                                        assignment.isDeleted = true
                                                        try? modelContext.save()
                                                        DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
                                                    }
                                                }
                                            )
                                        }
                                    }
                                }
                            } else if sortMode == "category" {
                                // Category / Task Type Breakdown
                                let groupedByCategory = Dictionary(grouping: activeAssignments, by: { categoryForAssignment($0) })
                                ForEach(groupedByCategory.keys.sorted(), id: \.self) { catName in
                                    let catAssigns = groupedByCategory[catName] ?? []
                                    VStack(alignment: .leading, spacing: 8) {
                                        HStack {
                                            HStack(spacing: 6) {
                                                Image(systemName: "tag.fill")
                                                    .font(.system(size: 11))
                                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                                Text("\(catName.uppercased()) (\(catAssigns.count))")
                                                    .font(.system(size: 11, weight: .bold))
                                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                            }
                                            Spacer()
                                        }
                                        .padding(.leading, 4)

                                        ForEach(catAssigns) { assignment in
                                            AssignmentCardRow(
                                                assignment: assignment,
                                                onToggle: {
                                                    toggleAssignment(assignment)
                                                },
                                                onEdit: { editingAssignment = assignment },
                                                onDelete: {
                                                    withAnimation(.easeInOut(duration: 0.25)) {
                                                        assignment.isDeleted = true
                                                        try? modelContext.save()
                                                        DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
                                                    }
                                                }
                                            )
                                        }
                                    }
                                }
                            } else if sortMode == "courses" || sortMode == "course" {
                                // ── COLLAPSIBLE COURSE ACCORDION ──────────────────────
                                let groupedByCourse = Dictionary(
                                    grouping: activeAssignments,
                                    by: { $0.course?.courseName ?? "Unassigned" }
                                )
                                let courseOrder = courses.map { $0.courseName } + ["Unassigned"]
                                let sortedCourseNames = groupedByCourse.keys.sorted {
                                    let iA = courseOrder.firstIndex(of: $0) ?? 999
                                    let iB = courseOrder.firstIndex(of: $1) ?? 999
                                    return iA < iB
                                }

                                ForEach(sortedCourseNames, id: \.self) { cName in
                                    let courseAssigns = (groupedByCourse[cName] ?? []).sorted {
                                        ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture)
                                    }
                                    let courseObj = courses.first(where: { $0.courseName == cName })
                                    let courseColor = CourseColorHelper.color(for: courseObj?.hexColor ?? "#2563EB")
                                    let isExpanded = expandedCourseCodes.contains(cName)

                                    VStack(alignment: .leading, spacing: 0) {
                                        // ── Course Header (always visible, tap to expand) ──
                                        Button(action: {
                                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                                if expandedCourseCodes.contains(cName) {
                                                    expandedCourseCodes.remove(cName)
                                                } else {
                                                    expandedCourseCodes.insert(cName)
                                                }
                                            }
                                        }) {
                                            HStack(spacing: 12) {
                                                // Colored accent bar
                                                RoundedRectangle(cornerRadius: 3)
                                                    .fill(courseColor)
                                                    .frame(width: 4, height: 36)

                                                Text(cName)
                                                    .font(.system(size: 14, weight: .bold, design: .rounded))
                                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                    .lineLimit(1)

                                                Spacer()

                                                // Expand/collapse chevron
                                                Image(systemName: "chevron.down")
                                                    .font(.system(size: 12, weight: .bold))
                                                    .foregroundColor(Color(red: 0.55, green: 0.62, blue: 0.72))
                                                    .rotationEffect(.degrees(isExpanded ? 0 : -90))
                                                    .animation(.spring(response: 0.3, dampingFraction: 0.75), value: isExpanded)
                                            }
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 12)
                                            .contentShape(Rectangle())
                                        }
                                        .buttonStyle(.plain)

                                        // ── Expanded Course Detail & Outline Dropdown ───────────────────
                                        if isExpanded {
                                            VStack(alignment: .leading, spacing: 14) {
                                                // 1. COURSE ASSIGNMENTS (FIRST)
                                                VStack(alignment: .leading, spacing: 8) {
                                                    HStack(spacing: 6) {
                                                        Image(systemName: "calendar.badge.checkmark")
                                                            .font(.system(size: 11, weight: .bold))
                                                            .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                                        Text("ASSIGNMENTS (\(courseAssigns.count))")
                                                            .font(.system(size: 11, weight: .bold))
                                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                    }

                                                    if courseAssigns.isEmpty {
                                                        Text("No assignments scheduled")
                                                            .font(.system(size: 12, weight: .medium))
                                                            .foregroundColor(Color(red: 0.55, green: 0.62, blue: 0.72))
                                                            .padding(.vertical, 4)
                                                    } else {
                                                        ForEach(courseAssigns) { assignment in
                                                            CourseSectionAssignmentRow(assignment: assignment, courseColor: courseColor)
                                                        }
                                                    }
                                                }

                                                let outlineWeeks = (courseObj?.weeks ?? []).filter { week in
                                                    guard week.weekNumber > 0 else { return false }
                                                    if let theme = week.theme, !theme.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !theme.lowercased().hasPrefix("week ") {
                                                        return true
                                                    }
                                                    return false
                                                }.sorted(by: { $0.weekNumber < $1.weekNumber })

                                                if !outlineWeeks.isEmpty {
                                                    VStack(alignment: .leading, spacing: 6) {
                                                        HStack {
                                                            Text("Course Outline")
                                                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                                .textCase(.uppercase)
                                                            Spacer()
                                                        }

                                                        VStack(alignment: .leading, spacing: 6) {
                                                            ForEach(outlineWeeks) { week in
                                                                HStack(alignment: .center, spacing: 10) {
                                                                    RoundedRectangle(cornerRadius: 3)
                                                                        .fill(courseColor)
                                                                        .frame(width: 4, height: 36)

                                                                    VStack(alignment: .leading, spacing: 3) {
                                                                        Text(week.theme ?? "Core Concepts")
                                                                            .font(.system(size: 13.5, weight: .bold, design: .rounded))
                                                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                                            .lineLimit(2)
                                                                        if week.weekNumber > 0 {
                                                                            Text("Week \(week.weekNumber)")
                                                                                .font(.system(size: 11, weight: .semibold))
                                                                                .foregroundColor(courseColor)
                                                                        }
                                                                    }
                                                                    Spacer()
                                                                }
                                                                .padding(.horizontal, 12)
                                                                .padding(.vertical, 8)
                                                                .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                                                                .cornerRadius(10)
                                                            }
                                                        }
                                                    }
                                                }

                                                // 2. Course Readings
                                                let courseReadings = allReadings.filter { $0.week?.course == courseObj && !$0.isDeleted }
                                                if !courseReadings.isEmpty {
                                                    VStack(alignment: .leading, spacing: 6) {
                                                        HStack {
                                                            Text("Course Readings (\(courseReadings.count))")
                                                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                                .textCase(.uppercase)
                                                            Spacer()
                                                        }

                                                        let sortedReadings = courseReadings.sorted { r1, r2 in
                                                            let d1 = r1.dueDate ?? r1.week?.computedStartDate ?? WeekDateConverter.date(forWeek: r1.week?.weekNumber ?? 0)
                                                            let d2 = r2.dueDate ?? r2.week?.computedStartDate ?? WeekDateConverter.date(forWeek: r2.week?.weekNumber ?? 0)
                                                            if d1 != d2 { return d1 < d2 }
                                                            return (r1.week?.weekNumber ?? 0) < (r2.week?.weekNumber ?? 0)
                                                        }

                                                        ForEach(sortedReadings) { reading in
                                                            let weekNum = reading.week?.weekNumber ?? 0
                                                            HStack(alignment: .center, spacing: 10) {
                                                                RoundedRectangle(cornerRadius: 3)
                                                                    .fill(courseColor)
                                                                    .frame(width: 4, height: 36)

                                                                VStack(alignment: .leading, spacing: 4) {
                                                                    let fullReadingTitleString: String = {
                                                                        if let ch = reading.cleanChapterText, !ch.isEmpty {
                                                                            let lowerTitle = reading.title.lowercased()
                                                                            let lowerCh = ch.lowercased()
                                                                            if lowerTitle.hasPrefix("chapter") || lowerTitle.hasPrefix("ch.") || lowerTitle.hasPrefix("ch ") {
                                                                                let strippedTitle = reading.title.replacingOccurrences(of: #"(?i)^\s*(?:chapters?|chaps?\.?|chs?\.?)\s*[\d\s,&–\-and]+\s*[:\-–·•.]*\s*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                                                                                if !strippedTitle.isEmpty {
                                                                                    return "\(ch) · \(strippedTitle)"
                                                                                }
                                                                                return ch
                                                                            }
                                                                            if !lowerTitle.contains(lowerCh) {
                                                                                return "\(ch) · \(reading.title)"
                                                                            }
                                                                        }
                                                                        return reading.title
                                                                    }()

                                                                    Text(fullReadingTitleString)
                                                                        .font(.system(size: 13.5, weight: .bold, design: .rounded))
                                                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                                        .lineLimit(2)

                                                                    HStack(spacing: 6) {
                                                                        if weekNum > 0 {
                                                                            Text("Week \(weekNum)")
                                                                                .font(.system(size: 10.5, weight: .bold, design: .rounded))
                                                                                .foregroundColor(.white)
                                                                                .padding(.horizontal, 7)
                                                                                .padding(.vertical, 2.5)
                                                                                .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                                                                .clipShape(Capsule())
                                                                        }

                                                                        if let mod = reading.moduleMention, !mod.isEmpty {
                                                                            Text(mod)
                                                                                .font(.system(size: 10.5, weight: .bold, design: .rounded))
                                                                                .foregroundColor(.white)
                                                                                .padding(.horizontal, 7)
                                                                                .padding(.vertical, 2.5)
                                                                                .background(Color(red: 0.45, green: 0.50, blue: 0.58))
                                                                                .clipShape(Capsule())
                                                                        }

                                                                        if let range = reading.dateRangeStr, !range.isEmpty {
                                                                            Text(range)
                                                                                .font(.system(size: 11, weight: .medium))
                                                                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                                        }
                                                                    }
                                                                }
                                                                Spacer()

                                                                Button(action: {
                                                                    withAnimation {
                                                                        reading.isDeleted = true
                                                                        try? modelContext.save()
                                                                    }
                                                                }) {
                                                                    Image(systemName: "trash")
                                                                        .font(.system(size: 15, weight: .regular))
                                                                        .foregroundColor(Color(red: 0.85, green: 0.25, blue: 0.20))
                                                                        .padding(4)
                                                                }
                                                                .buttonStyle(.plain)
                                                            }
                                                            .padding(.horizontal, 12)
                                                            .padding(.vertical, 10)
                                                            .background(Color.white)
                                                            .cornerRadius(14)
                                                            .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                                                            .overlay(
                                                                RoundedRectangle(cornerRadius: 14)
                                                                    .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                             .padding(.horizontal, 10)
                                             .padding(.bottom, 12)
                                             .transition(.asymmetric(
                                                 insertion: .opacity.combined(with: .move(edge: .top)),
                                                 removal: .opacity
                                             ))
                                         }
                                    }
                                    .background(Color.white)
                                    .cornerRadius(16)
                                    .clipped()
                                    .shadow(color: courseColor.opacity(0.08), radius: 6, x: 0, y: 2)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 16)
                                            .stroke(
                                                isExpanded ? courseColor.opacity(0.25) : Color(red: 0.89, green: 0.91, blue: 0.94),
                                                lineWidth: 1
                                            )
                                    )
                                }
                            } else if sortMode == "trash" {
                                // Inline Trash Section (Includes both Deleted Assignments & Deleted Readings)
                                let totalDeleted = deletedAssignments.count + deletedReadings.count
                                VStack(alignment: .leading, spacing: 10) {
                                    if totalDeleted > 0 {
                                        Button(action: {
                                            showingEmptyTrashConfirmation = true
                                        }) {
                                            HStack(spacing: 8) {
                                                Spacer()
                                                Image(systemName: "trash.fill")
                                                    .font(.system(size: 13, weight: .bold))
                                                Text("Empty Trash (\(totalDeleted))")
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
                                            Text("Deleted assignments and readings will be stored here for easy recovery.")
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
                                        // Deleted Assignments
                                        ForEach(deletedAssignments) { assignment in
                                            HStack {
                                                VStack(alignment: .leading, spacing: 3) {
                                                    Text(assignment.title)
                                                        .font(.system(size: 14, weight: .bold))
                                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                    let assignWeekSuffix = assignment.weekNumber > 0 ? " · Week \(assignment.weekNumber)" : ""
                                                    Text("Assignment · \(assignment.course?.courseName ?? "Course")\(assignWeekSuffix)")
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
                                                .padding(.vertical, 6)
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
                                                        .padding(6)
                                                }
                                                .buttonStyle(.plain)
                                            }
                                            .padding(12)
                                            .background(Color.white)
                                            .cornerRadius(14)
                                            .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                                        }

                                        // Deleted Readings
                                        ForEach(deletedReadings) { reading in
                                            HStack {
                                                VStack(alignment: .leading, spacing: 3) {
                                                    Text(reading.title)
                                                        .font(.system(size: 14, weight: .bold))
                                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                    let readWeekNum = reading.week?.weekNumber ?? 0
                                                    let readWeekSuffix = readWeekNum > 0 ? " · Week \(readWeekNum)" : ""
                                                    Text("Reading · \(reading.week?.course?.courseName ?? "Course")\(readWeekSuffix)")
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
                                                .padding(.vertical, 6)
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
                                                        .padding(6)
                                                }
                                                .buttonStyle(.plain)
                                            }
                                            .padding(12)
                                            .background(Color.white)
                                            .cornerRadius(14)
                                            .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                                        }
                                    }
                                }
                            } else {
                                // Chronological Due Date Sort
                                ForEach(activeAssignments.sorted(by: { ($0.dueDate ?? Date.distantFuture) < ($1.dueDate ?? Date.distantFuture) })) { assignment in
                                    AssignmentCardRow(
                                        assignment: assignment,
                                        onToggle: {
                                            toggleAssignment(assignment)
                                        },
                                        onEdit: { editingAssignment = assignment },
                                        onDelete: {
                                            withAnimation(.easeInOut(duration: 0.25)) {
                                                assignment.isDeleted = true
                                                try? modelContext.save()
                                                DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
                                            }
                                        }
                                    )
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
            .background(Color(red: 0.95, green: 0.96, blue: 0.98))
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .sheet(item: $editingAssignment) { assignment in
                EditAssignmentSheet(assignment: assignment)
            }
            .sheet(isPresented: $showingTrashSheet) {
                UnifiedTrashFolderSheet()
            }
            .sheet(isPresented: $showingCourseFilterSheet) {
                CourseFilterPickerSheet(courses: courses, selectedCourse: $selectedCourseFilter)
            }
            .sheet(isPresented: $showingInfoSheet) {
                InfoCreditsSheetView()
            }
            .alert("Empty Trash?", isPresented: $showingEmptyTrashConfirmation) {
                Button("Empty Trash", role: .destructive) {
                    withAnimation {
                        for a in deletedAssignments { modelContext.delete(a) }
                        for r in deletedReadings { modelContext.delete(r) }
                        try? modelContext.save()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                let total = deletedAssignments.count + deletedReadings.count
                Text("Are you sure you want to permanently delete all \(total) items in the trash? This action cannot be undone.")
            }
            .onAppear {
                sortMode = "assignments"
            }
            .overlay {
                if showingConfetti {
                    ConfettiCelebrationView(isPresented: $showingConfetti, title: confettiTitle)
                }
            }
            .dismissKeyboardOnTap()
        }
    }

    private func triggerConfetti(title: String) {
        confettiTitle = title
        withAnimation {
            showingConfetti = true
        }
    }

    private func toggleAssignment(_ assignment: Assignment) {
        let willBeCompleted = !assignment.isCompleted
        withAnimation {
            assignment.isCompleted = willBeCompleted
            try? modelContext.save()
            DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
        }
        
        if willBeCompleted {
            // 1. Check if this course's assignments are now 100% complete
            if let course = assignment.course {
                let courseAssigns = dbAssignments.filter { !$0.isDeleted && $0.course?.persistentModelID == course.persistentModelID }
                let remaining = courseAssigns.filter { !$0.isCompleted }.count
                if remaining == 0 && !courseAssigns.isEmpty {
                    triggerConfetti(title: "🎉 \(course.courseCode ?? course.courseName) Assignments 100% Done!")
                    return
                }
            }
            
            // 2. Check if all active assignments across all courses are now 100% complete
            let allActive = activeAssignments
            let remainingAll = allActive.filter { !$0.isCompleted }.count
            if remainingAll == 0 && !allActive.isEmpty {
                triggerConfetti(title: "🎉 All Assignments 100% Complete!")
            }
        }
    }

    private func dueDateForAssignment(_ assign: Assignment) -> Date? {
        return assign.dueDate
    }

    // Group active assignments by week number
    private var assignmentsByWeek: [Int: [Assignment]] {
        var grouped: [Int: [Assignment]] = [:]
        for assign in activeAssignments {
            grouped[assign.weekNumber, default: []].append(assign)
        }
        return grouped
    }

    private var activeWeekNumbersForAssignments: [Int] {
        let weeksWithAssigns = Set(assignmentsByWeek.filter({ !$0.value.isEmpty }).map({ $0.key }))
        let positive = weeksWithAssigns.filter({ $0 > 0 }).sorted()
        var result = positive
        if weeksWithAssigns.contains(where: { $0 <= 0 }) {
            result.append(0)
        }
        return result
    }

    private func weekModuleMentionForAssignment(for weekNum: Int) -> String? {
        if let selectedCourseFilter {
            guard selectedCourseFilter.hasDocumentModules else { return nil }
            return selectedCourseFilter.cachedModuleForWeek(weekNum)
                ?? selectedCourseFilter.weeks.first(where: { $0.weekNumber == weekNum })?.moduleMention
        }
        let assigns = assignmentsByWeek[weekNum] ?? []
        for a in assigns {
            if let course = a.course, course.hasDocumentModules {
                if let mod = a.moduleMention ?? course.cachedModuleForWeek(weekNum) {
                    return mod
                }
            }
        }
        return nil
    }

    private func weekDateRangeForAssignment(for weekNum: Int) -> String? {
        let assigns = assignmentsByWeek[weekNum] ?? []
        for a in assigns {
            if let course = a.course {
                if let w = course.weeks.first(where: { $0.weekNumber == weekNum }),
                   let range = w.dateRangeStr, !range.isEmpty, range.lowercased() != "unknown" {
                    return range
                }
            }
        }
        if let w = allWeeks.first(where: { $0.weekNumber == weekNum }),
           let range = w.dateRangeStr, !range.isEmpty, range.lowercased() != "unknown" {
            return range
        }
        return nil
    }

    private func dayNumber(for date: Date) -> Int {
        Calendar.current.component(.day, from: date)
    }

    private func dayNameString(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE"
        return formatter.string(from: date)
    }

    private func monthYearString(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: date)
    }

    private func fullDateHeaderString(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d, yyyy"
        return formatter.string(from: date).uppercased()
    }

    private func categoryForAssignment(_ assign: Assignment) -> String {
        let t = assign.title.lowercased()
        if t.contains("exam") || t.contains("test") || t.contains("midterm") || t.contains("final") { return "Exams & Tests" }
        if t.contains("quiz") || t.contains("assessment") { return "Quizzes & Assessments" }
        if t.contains("project") || t.contains("essay") || t.contains("paper") || t.contains("report") { return "Projects & Papers" }
        if t.contains("attendance") || t.contains("participation") { return "Attendance & Participation" }
        return "Homework & Coursework"
    }

    private var assignmentsByDay: [Date: [Assignment]] {
        var dict: [Date: [Assignment]] = [:]
        let cal = Calendar.current
        for assign in activeAssignments {
            guard let due = assign.dueDate else { continue }
            let start = cal.startOfDay(for: due)
            dict[start, default: []].append(assign)
        }
        return dict
    }

    private func hasAssignmentOnDate(_ date: Date) -> Bool {
        let dayKey = Calendar.current.startOfDay(for: date)
        return !(assignmentsByDay[dayKey]?.isEmpty ?? true)
    }

    private func courseColorsForDate(_ date: Date) -> [Color] {
        let dayKey = Calendar.current.startOfDay(for: date)
        let matching = assignmentsByDay[dayKey] ?? []
        let colors = Array(Set(matching.map { CourseColorHelper.color(for: $0.course?.hexColor ?? "#2563EB") }))
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
}

// MARK: - Assignment Card Row Component with Matching Checkmark, Info, and Trash Action Icons

public struct AssignmentCardRow: View {
    public let assignment: Assignment
    public let onToggle: () -> Void
    public let onEdit: () -> Void
    public let onDelete: () -> Void

    private var courseCode: String {
        assignment.course?.courseCode ?? ""
    }

    private var courseName: String {
        assignment.course?.courseName ?? ""
    }

    private var courseColor: Color {
        CourseColorHelper.color(for: assignment.course?.hexColor ?? "#2563EB")
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

    public var body: some View {
        HStack(spacing: 8) {
            // Single Vertical Course Color Line Indicator
            RoundedRectangle(cornerRadius: 3)
                .fill(courseColor)
                .frame(width: 4, height: 36)

            // Content Area (Tapping opens Assignment Details)
            VStack(alignment: .leading, spacing: 4) {
                // Top Line: Course Title Pill with white letters
                let pillTitle: String = {
                    if let cName = assignment.course?.courseName, !cName.isEmpty {
                        return cName
                    }
                    if let cCode = assignment.courseCode, !cCode.isEmpty {
                        return cCode
                    }
                    return "Assignment"
                }()

                HStack(spacing: 6) {
                    Text(pillTitle)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2.5)
                        .background(courseColor)
                        .cornerRadius(5)


                    Spacer(minLength: 0)
                }

                // Card Title: assignment title
                Text(displayTitle)
                    .font(.cpItemTitle)
                    .foregroundColor(assignment.isCompleted ? Color(red: 0.35, green: 0.42, blue: 0.52) : Color(red: 0.22, green: 0.28, blue: 0.38))
                    .strikethrough(assignment.isCompleted)
                    .multilineTextAlignment(.leading)
                    .lineLimit(3)

                // Date Display (Formatted identically to Readings: "Due [Day], [Month] [Date] · Week [WeekNumber]")
                let assignDateText = WeekDateConverter.formattedDueDate(for: assignment.dueDate, weekNumber: assignment.weekNumber)
                HStack(spacing: 8) {
                    Text(assignDateText)
                        .font(.cpDescription)
                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                    if let weight = assignment.weightPercentage, !weight.isEmpty {
                        Text("• \(weight)")
                            .font(.cpDescriptionMedium)
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                    }
                }
                .padding(.top, 1)

                // Real Clickable Resource Link (Only displayed if a valid URL exists)
                if let media = assignment.mediaUrl, URLHelper.isValidURL(media), let url = URLHelper.formatURL(media) {
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

            // Right-side Action Buttons: Completion Ring & Trashcan
            HStack(spacing: 8) {
                // Completion Checkmark Ring Button (Expanded 36x36 touch target for instant 1-tap completion)
                Button(action: {
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.75)) {
                        onToggle()
                    }
                }) {
                    ZStack {
                        Circle()
                            .fill(assignment.isCompleted ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color.clear)
                            .frame(width: 22, height: 22)
                            .overlay(
                                Circle()
                                    .stroke(assignment.isCompleted ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.75, green: 0.80, blue: 0.86), lineWidth: 1.8)
                            )

                        if assignment.isCompleted {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }
                    .frame(width: 32, height: 36)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                // Trashcan Button (Clean standard button with no gesture hijacking)
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
        .padding(.vertical, 12)
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
        .contentShape(Rectangle())
        .onTapGesture {
            onEdit()
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash.fill")
            }
        }
    }

    private func formattedDueDate(_ date: Date?) -> String {
        WeekDateConverter.formattedDueDate(for: date, weekNumber: assignment.weekNumber)
    }
}

public struct SortTabTile: View {
    public let title: String
    public let icon: String
    public let iconColor: Color
    public let isSelected: Bool
    public let action: () -> Void

    public var body: some View {
        Button(action: action) {
            VStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 16.5, weight: .bold))
                    .foregroundColor(iconColor)

                Text(title)
                    .font(isSelected ? .cpItemTitle : .cpDescriptionMedium)
                    .foregroundColor(isSelected ? Color(red: 0.08, green: 0.12, blue: 0.22) : Color(red: 0.35, green: 0.42, blue: 0.52))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10.5)
            .padding(.horizontal, 4)
            .background(isSelected ? Color(red: 0.93, green: 0.94, blue: 0.96) : Color(red: 0.97, green: 0.98, blue: 0.99))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color(red: 0.82, green: 0.85, blue: 0.90) : Color(red: 0.92, green: 0.94, blue: 0.96), lineWidth: 1)
            )
            .shadow(color: isSelected ? Color.black.opacity(0.04) : Color.clear, radius: 3, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Editable Rubric Model
public struct EditableRubricItem: Identifiable, Hashable {
    public let id: UUID
    public var title: String
    public var points: String
    public var percentage: String

    public init(id: UUID = UUID(), title: String, points: String, percentage: String = "") {
        self.id = id
        self.title = title
        self.points = points
        self.percentage = percentage
    }
}

// MARK: - Edit Assignment Sheet

public struct EditAssignmentSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Bindable var assignment: Assignment

    @State private var weekNumberState: Int = 1
    @State private var weekStringState: String = "1"
    @State private var selectedModuleNumState: Int = 0
    @State private var moduleInputState: String = ""
    @State private var hasDueDateState: Bool = false
    @State private var dueDateState: Date = Date()
    @State private var pointsValueState: Int = 100
    @State private var gradeWeightPercentState: Int = 10
    @State private var pointsBreakdownTextState: String = ""
    @State private var videoUrlTextState: String = ""
    @State private var courseNameTextState: String = ""
    @State private var customNotesState: String = ""
    @State private var noteInputsState: [String] = []
    @State private var topicInputsState: [String] = []
    @State private var rubricItemsState: [EditableRubricItem] = []
    @State private var cachedCourseStartDate: Date? = nil

    private static let rubricDelimiterRegex = try? NSRegularExpression(pattern: #"(?:\r?\n|\||;|\s*,\s*(?=[A-Za-z0-9\s]+[:\-–]|\d+\s*(?:pts|points|%)))"#)

    private var parsedRubricItems: [EditableRubricItem] {
        let structured = assignment.rubricCriteria
        if !structured.isEmpty {
            return structured.map { criterion in
                let ptsStr: String = {
                    if let pts = criterion.points {
                        return pts.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(pts))" : "\(pts)"
                    }
                    return ""
                }()
                let pctStr: String = {
                    if let pct = criterion.percentage {
                        return pct.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(pct))" : "\(pct)"
                    } else if let desc = criterion.description, let match = desc.range(of: #"\b\d+(?:\.\d+)?\s*%"#, options: .regularExpression) {
                        let digits = desc[match].components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
                        return digits
                    }
                    return ""
                }()
                return EditableRubricItem(title: criterion.criterionName, points: ptsStr, percentage: pctStr)
            }
        }

        let rawText = pointsBreakdownTextState
        guard !rawText.isEmpty else { return [] }
        
        let rawSegments: [String]
        if let regex = Self.rubricDelimiterRegex {
            let nsString = rawText as NSString
            let matches = regex.matches(in: rawText, range: NSRange(location: 0, length: nsString.length))
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
            rawSegments = segments.isEmpty ? [rawText] : segments
        } else {
            rawSegments = rawText.components(separatedBy: CharacterSet(charactersIn: "\n|;,")).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        }

        var result: [EditableRubricItem] = []
        for segment in rawSegments {
            let trimmed = segment.replacingOccurrences(of: #"^[•\-\*▪●]\s*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }
            
            var working = trimmed
            var pctStr = ""
            if let pctMatch = working.range(of: #"\b\d+(?:\.\d+)?\s*%"#, options: .regularExpression) {
                let raw = String(working[pctMatch])
                pctStr = raw.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
                working.removeSubrange(pctMatch)
            }
            
            var ptsStr = ""
            if let ptsMatch = working.range(of: #"\b\d+(?:\.\d+)?\s*(?:pts|points|pt)\b"#, options: [.regularExpression, .caseInsensitive]) {
                let raw = String(working[ptsMatch])
                ptsStr = raw.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
                working.removeSubrange(ptsMatch)
            }
            
            if ptsStr.isEmpty && pctStr.isEmpty {
                if let numMatch = working.range(of: #"\b\d+(?:\.\d+)?\b"#, options: .regularExpression) {
                    let raw = String(working[numMatch])
                    ptsStr = raw
                    working.removeSubrange(numMatch)
                }
            }
            
            var cleanTitle = working
                .replacingOccurrences(of: #"^[\d\s\-\:\.\)]+"#, with: "", options: .regularExpression)
                .replacingOccurrences(of: #"[\:\-\–\(\)]+"#, with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
                
            if cleanTitle.isEmpty {
                cleanTitle = "Criterion"
            }
            
            result.append(EditableRubricItem(title: cleanTitle, points: ptsStr, percentage: pctStr))
        }
        return result
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.95, green: 0.96, blue: 0.98)
                    .ignoresSafeArea()

                Form {
                    // Section 1: Title & Course Name
                    Section("Assignment Information") {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Title")
                                .font(.caption)
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            TextField("Assignment Title", text: $assignment.title)
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                        }
                        .padding(.vertical, 1)

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Course Name")
                                .font(.caption)
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            TextField("Enter course name...", text: $courseNameTextState)
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .onChange(of: courseNameTextState) { _, newValue in
                                    if let course = assignment.course {
                                        course.courseName = newValue
                                    }
                                }
                        }
                        .padding(.vertical, 1)
                    }

                    // Section 2: Schedule & Due Date (Week, Module, and Due Date - No Made-up Date Ranges)
                    Section("Schedule") {
                        HStack(spacing: 8) {
                            Text("Week")
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            TextField("1", text: $weekStringState)
                                .keyboardType(.numberPad)
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                .frame(width: 80)
                                .onChange(of: weekStringState) { _, newVal in
                                    let digits = newVal.filter { $0.isNumber }
                                    if digits != newVal { weekStringState = digits }
                                    if let w = Int(digits), w > 0 {
                                        weekNumberState = w
                                    }
                                }
                            Spacer()
                        }

                        HStack(spacing: 8) {
                            TextField("Module", text: $moduleInputState)
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        }

                        Toggle("Due Date & Time", isOn: $hasDueDateState)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))

                        if hasDueDateState {
                            DatePicker("Select Date & Time", selection: $dueDateState, displayedComponents: [.date, .hourAndMinute])
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .onChange(of: dueDateState) { _, newDate in
                                    let derivedW: Int
                                    if let firstDate = cachedCourseStartDate {
                                        derivedW = WeekDateConverter.deriveWeekNumber(for: newDate, courseStartDate: firstDate)
                                    } else {
                                        derivedW = WeekDateConverter.weekNumber(for: newDate)
                                    }
                                    if weekNumberState != derivedW {
                                        weekNumberState = derivedW
                                        weekStringState = "\(derivedW)"
                                    }
                                    // Module is untouched
                                }
                        }
                    }

                    // Section 3: Points Breakdown
                    Section("Points Breakdown") {
                        Picker("Grade Weight", selection: $gradeWeightPercentState) {
                            ForEach(0...100, id: \.self) { pct in
                                Text("\(pct)%").tag(pct)
                            }
                        }
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .pickerStyle(.menu)
                        .onChange(of: gradeWeightPercentState) { _, newPct in
                            assignment.weightPercentage = "\(newPct)%"
                        }

                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Image(systemName: "list.bullet.clipboard.fill")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                Text("Rubric Criteria")
                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                Spacer()
                            }

                            if !rubricItemsState.isEmpty {
                                VStack(spacing: 8) {
                                    ForEach(0..<rubricItemsState.count, id: \.self) { idx in
                                        VStack(alignment: .leading, spacing: 8) {
                                            // Row 1: Index + Criterion Title + Delete Button
                                            HStack(spacing: 8) {
                                                Text("\(idx + 1) -")
                                                    .font(.system(size: 14, weight: .bold, design: .rounded))
                                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                                                TextField("Criterion title (e.g. Analysis)...", text: Binding(
                                                    get: { idx < rubricItemsState.count ? rubricItemsState[idx].title : "" },
                                                    set: { newVal in
                                                        if idx < rubricItemsState.count {
                                                            rubricItemsState[idx].title = newVal
                                                        }
                                                    }
                                                ))
                                                .font(.system(size: 14, weight: .semibold, design: .rounded))
                                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                                                Spacer()

                                                Button {
                                                    if idx < rubricItemsState.count {
                                                        rubricItemsState.remove(at: idx)
                                                    }
                                                } label: {
                                                    Image(systemName: "xmark.circle.fill")
                                                        .font(.system(size: 16))
                                                        .foregroundColor(Color(red: 0.70, green: 0.75, blue: 0.82))
                                                }
                                                .buttonStyle(.plain)
                                            }

                                            // Row 2: Points & Percentage Inputs (No description/instructions)
                                            HStack(spacing: 10) {
                                                // Points Pill
                                                HStack(spacing: 4) {
                                                    TextField("Pts", text: Binding(
                                                        get: {
                                                            guard idx < rubricItemsState.count else { return "" }
                                                            let val = rubricItemsState[idx].points
                                                            return val.replacingOccurrences(of: "pts", with: "", options: .caseInsensitive)
                                                                .replacingOccurrences(of: "pt", with: "", options: .caseInsensitive)
                                                                .trimmingCharacters(in: .whitespaces)
                                                        },
                                                        set: { newVal in
                                                            if idx < rubricItemsState.count {
                                                                rubricItemsState[idx].points = newVal.replacingOccurrences(of: "pts", with: "", options: .caseInsensitive)
                                                                    .replacingOccurrences(of: "pt", with: "", options: .caseInsensitive)
                                                                    .trimmingCharacters(in: .whitespaces)
                                                            }
                                                        }
                                                    ))
                                                    .keyboardType(.numbersAndPunctuation)
                                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                                                    Text("pts")
                                                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                                }
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 6)
                                                .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                                                .cornerRadius(8)
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 8)
                                                        .stroke(Color(red: 0.88, green: 0.90, blue: 0.93), lineWidth: 1)
                                                )
                                                .frame(maxWidth: .infinity)

                                                // Percentage Pill
                                                HStack(spacing: 4) {
                                                    TextField("Weight", text: Binding(
                                                        get: {
                                                            guard idx < rubricItemsState.count else { return "" }
                                                            return rubricItemsState[idx].percentage.replacingOccurrences(of: "%", with: "").trimmingCharacters(in: .whitespaces)
                                                        },
                                                        set: { newVal in
                                                            if idx < rubricItemsState.count {
                                                                rubricItemsState[idx].percentage = newVal.replacingOccurrences(of: "%", with: "").trimmingCharacters(in: .whitespaces)
                                                            }
                                                        }
                                                    ))
                                                    .keyboardType(.numbersAndPunctuation)
                                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                                                    Text("%")
                                                        .font(.system(size: 11, weight: .bold, design: .rounded))
                                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                                }
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 6)
                                                .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                                                .cornerRadius(8)
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 8)
                                                        .stroke(Color(red: 0.88, green: 0.90, blue: 0.93), lineWidth: 1)
                                                )
                                                .frame(maxWidth: .infinity)
                                            }
                                            .padding(.leading, 24)
                                        }
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 10)
                                        .background(Color.white)
                                        .cornerRadius(12)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12)
                                                .stroke(Color(red: 0.90, green: 0.92, blue: 0.95), lineWidth: 1)
                                        )
                                    }
                                }
                            }

                            Button {
                                rubricItemsState.append(EditableRubricItem(title: "", points: "", percentage: ""))
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 13, weight: .semibold))
                                    Text("Add Criterion")
                                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                                }
                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                .padding(.top, 2)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.vertical, 4)
                    }

                    // Section 4: Dedicated Topics Section (Clean numbered list: 1 - Topic, editable like rest of sections)
                    Section("Topics") {
                        if topicInputsState.isEmpty {
                            Button {
                                topicInputsState.append("")
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
                            ForEach(0..<topicInputsState.count, id: \.self) { idx in
                                HStack(spacing: 8) {
                                    Text("\(idx + 1) -")
                                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                                    TextField("Topic description...", text: Binding(
                                        get: { idx < topicInputsState.count ? topicInputsState[idx] : "" },
                                        set: { newVal in
                                            if idx < topicInputsState.count {
                                                topicInputsState[idx] = newVal
                                                let nonEmpty = topicInputsState.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
                                                assignment.relevantTopics = nonEmpty.isEmpty ? nil : nonEmpty.joined(separator: ", ")
                                            }
                                        }
                                    ))
                                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                }
                            }

                            Button {
                                topicInputsState.append("")
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

                    // Section 5: Resource Link
                    Section("Resource Link") {
                        TextField("Paste video or article URL...", text: $videoUrlTextState)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .onChange(of: videoUrlTextState) { _, newValue in
                                assignment.mediaUrl = newValue
                            }

                        if URLHelper.isValidURL(videoUrlTextState), let url = URLHelper.formatURL(videoUrlTextState) {
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

                    // Section 6: Notes
                    Section("Notes") {
                        if noteInputsState.isEmpty {
                            Button {
                                noteInputsState.append("")
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
                            VStack(spacing: 14) { // Space between each note
                                ForEach(0..<noteInputsState.count, id: \.self) { idx in
                                    HStack(alignment: .top, spacing: 12) {
                                        Text("\(idx + 1) -")
                                            .font(.system(size: 15, weight: .bold, design: .rounded))
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                            .padding(.top, 2)

                                        TextField("Add note or instruction...", text: Binding(
                                            get: { idx < noteInputsState.count ? noteInputsState[idx] : "" },
                                            set: { newVal in
                                                if idx < noteInputsState.count {
                                                    noteInputsState[idx] = newVal
                                                }
                                            }
                                        ), axis: .vertical)
                                        .font(.system(size: 15, weight: .regular, design: .rounded))
                                        .lineSpacing(6) // Separate text lines more inside the note
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                        .lineLimit(3...16)

                                        Spacer(minLength: 4)

                                        Button {
                                            if idx < noteInputsState.count {
                                                noteInputsState.remove(at: idx)
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
                                noteInputsState.append("")
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
                weekNumberState = assignment.weekNumber > 0 ? assignment.weekNumber : 1
                weekStringState = "\(weekNumberState)"
                if let d = assignment.dueDate {
                    hasDueDateState = true
                    dueDateState = d
                } else {
                    hasDueDateState = false
                    dueDateState = Date()
                }
                if let mod = assignment.moduleMention {
                    moduleInputState = mod
                    if let match = mod.range(of: #"\d+"#, options: .regularExpression), let num = Int(mod[match]) {
                        selectedModuleNumState = num
                    } else {
                        selectedModuleNumState = 0
                    }
                } else {
                    moduleInputState = ""
                    selectedModuleNumState = 0
                }
                videoUrlTextState = assignment.mediaUrl ?? ""
                let rawNotes = assignment.noteText ?? assignment.fullInstructions ?? ""
                customNotesState = rawNotes
                noteInputsState = rawNotes.components(separatedBy: .newlines)
                    .map { $0.replacingOccurrences(of: #"^[•\-\*▪●]\s*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                courseNameTextState = assignment.course?.courseName ?? ""
                
                let rawPts = assignment.pointsPossible ?? "100 Points"
                let ptsDigits = rawPts.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                pointsValueState = Int(ptsDigits) ?? 100

                let rawWeight = assignment.weightPercentage ?? "\(pointsValueState / 5)%"
                let weightDigits = rawWeight.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                gradeWeightPercentState = Int(weightDigits) ?? (pointsValueState / 5)

                if let bd = assignment.pointsBreakdown, !bd.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    pointsBreakdownTextState = bd
                } else {
                    pointsBreakdownTextState = ""
                }

                rubricItemsState = parsedRubricItems

                let currentTopics = assignment.computedTopics.filter { !$0.lowercased().hasPrefix("module") && !$0.lowercased().hasPrefix("mod ") }
                if !currentTopics.isEmpty {
                    topicInputsState = currentTopics
                } else if let rel = assignment.relevantTopics, !rel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    topicInputsState = [rel.trimmingCharacters(in: .whitespacesAndNewlines)]
                } else {
                    topicInputsState = []
                }
                cachedCourseStartDate = assignment.course?.weeks.compactMap({ $0.startDate }).min() ?? assignment.course?.earliestItemDate
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
                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        // Save Week
                        assignment.weekNumber = weekNumberState

                        // Save Due Date
                        assignment.dueDate = hasDueDateState ? dueDateState : nil

                        // Save Points & Weight
                        assignment.pointsPossible = pointsValueState > 0 ? "\(pointsValueState) Points" : nil
                        assignment.weightPercentage = "\(gradeWeightPercentState)%"

                        // Save Topics & Module
                        let trimmedMod = moduleInputState.trimmingCharacters(in: .whitespacesAndNewlines)
                        if let course = assignment.course, !trimmedMod.isEmpty {
                            course.cacheModule(trimmedMod, forWeek: weekNumberState)
                        }
                        let nonEmptyTopics = topicInputsState.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
                        if !nonEmptyTopics.isEmpty {
                            assignment.relevantTopics = nonEmptyTopics.joined(separator: ", ")
                        } else if !trimmedMod.isEmpty {
                            assignment.relevantTopics = trimmedMod
                        } else if selectedModuleNumState > 0 {
                            assignment.relevantTopics = "Module \(selectedModuleNumState)"
                        } else {
                            assignment.relevantTopics = nil
                        }

                        // Save Rubric Criteria
                        let validRubrics = rubricItemsState
                            .map { EditableRubricItem(
                                title: $0.title.trimmingCharacters(in: .whitespacesAndNewlines),
                                points: $0.points.trimmingCharacters(in: .whitespacesAndNewlines),
                                percentage: $0.percentage.trimmingCharacters(in: .whitespacesAndNewlines)
                            ) }
                            .filter { !$0.title.isEmpty || !$0.points.isEmpty || !$0.percentage.isEmpty }

                        if !validRubrics.isEmpty {
                            let dtoArray = validRubrics.map { item -> RubricCriterionDTO in
                                let ptsDigits = item.points.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
                                let doubleVal = Double(ptsDigits)
                                let pctDigits = item.percentage.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
                                let doublePct = Double(pctDigits)
                                let titleStr = item.title.isEmpty ? "Criterion" : item.title
                                return RubricCriterionDTO(criterionName: titleStr, points: doubleVal, percentage: doublePct, description: nil)
                            }
                            if let data = try? JSONEncoder().encode(dtoArray), let jsonStr = String(data: data, encoding: .utf8) {
                                assignment.rubricJSON = jsonStr
                            }
                            assignment.pointsBreakdown = validRubrics.map { item in
                                let titleStr = item.title.isEmpty ? "Criterion" : item.title
                                var parts: [String] = []
                                let cleanPts = item.points.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
                                if !cleanPts.isEmpty {
                                    parts.append("\(cleanPts) pts")
                                }
                                let cleanPct = item.percentage.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
                                if !cleanPct.isEmpty {
                                    parts.append("\(cleanPct)%")
                                }
                                if parts.isEmpty {
                                    return titleStr
                                } else {
                                    return "\(titleStr): \(parts.joined(separator: ", "))"
                                }
                            }.joined(separator: "\n")
                        } else {
                            assignment.rubricJSON = nil
                            assignment.pointsBreakdown = nil
                        }

                        // Save Notes & Instructions
                        let nonEmptyNotes = noteInputsState.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
                        let mergedNotes = nonEmptyNotes.isEmpty ? nil : nonEmptyNotes.joined(separator: "\n")
                        assignment.noteText = mergedNotes
                        assignment.fullInstructions = mergedNotes

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

// MARK: - Course Filter Picker Sheet
public struct CourseFilterPickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    public let courses: [Course]
    @Binding var selectedCourse: Course?

    public init(courses: [Course], selectedCourse: Binding<Course?>) {
        self.courses = courses
        self._selectedCourse = selectedCourse
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.95, green: 0.96, blue: 0.98).ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 10) {
                        // "All Courses" Reset Option
                        Button(action: {
                            withAnimation(.spring(response: 0.25)) {
                                selectedCourse = nil
                            }
                            dismiss()
                        }) {
                            HStack(spacing: 12) {
                                Image(systemName: "square.grid.2x2.fill")
                                    .font(.system(size: 15))
                                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                    .frame(width: 16, height: 16)

                                Text("All Courses")
                                    .font(.system(size: 15, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                                Spacer()

                                if selectedCourse == nil {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 18, weight: .bold))
                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                }
                            }
                            .padding(14)
                            .background(Color.white)
                            .cornerRadius(16)
                            .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                        }
                        .buttonStyle(.plain)

                        // Course Specific Selection Tiles
                        ForEach(courses) { course in
                            let courseColor = CourseColorHelper.color(for: course.hexColor)
                            let isSelected = selectedCourse?.persistentModelID == course.persistentModelID

                            Button(action: {
                                withAnimation(.spring(response: 0.25)) {
                                    selectedCourse = course
                                }
                                dismiss()
                            }) {
                                HStack(spacing: 12) {
                                    Circle()
                                        .fill(courseColor)
                                        .frame(width: 16, height: 16)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(course.courseCode ?? "CRS")
                                            .font(.system(size: 15, weight: .bold, design: .rounded))
                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                        Text(course.courseName)
                                            .font(.system(size: 12.5))
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    }

                                    Spacer()

                                    if isSelected {
                                        Image(systemName: "checkmark.circle.fill")
                                            .font(.system(size: 18, weight: .bold))
                                            .foregroundColor(courseColor)
                                    }
                                }
                                .padding(14)
                                .background(Color.white)
                                .cornerRadius(16)
                                .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 14)
                }
            }
            .navigationTitle("Filter by Course")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color(red: 0.95, green: 0.96, blue: 0.98), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
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

public struct CourseSectionAssignmentRow: View {
    @Environment(\.modelContext) private var modelContext
    public let assignment: Assignment
    public let courseColor: Color

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

    public var body: some View {
        HStack(alignment: .center, spacing: 10) {
            // Single Vertical Course Color Line Indicator
            RoundedRectangle(cornerRadius: 3)
                .fill(courseColor)
                .frame(width: 4, height: 36)

            VStack(alignment: .leading, spacing: 3) {
                Text(displayTitle)
                    .font(.system(size: 14.5, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 0.22, green: 0.28, blue: 0.38))
                    .lineLimit(2)

                HStack(spacing: 8) {
                    if let badge = assignment.contextBadgeText {
                        Text(badge)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(courseColor)
                    }

                    if let due = assignment.dueDate {
                        let formattedDue = WeekDateConverter.formattedDueDate(for: due, weekNumber: assignment.weekNumber)
                        Text(assignment.contextBadgeText != nil ? "• \(formattedDue)" : formattedDue)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    }
                }
            }
            Spacer()

            Button(action: {
                withAnimation {
                    assignment.isDeleted = true
                    try? modelContext.save()
                    DataPersistenceBackupManager.shared.scheduleAutoBackup(modelContext: modelContext)
                }
            }) {
                Image(systemName: "trash")
                    .font(.system(size: 15, weight: .regular))
                    .foregroundColor(Color(red: 0.85, green: 0.25, blue: 0.20))
                    .padding(4)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.white)
        .cornerRadius(14)
        .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
        )
    }
}
