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

    private var activeAssignments: [Assignment] {
        var list = dbAssignments.filter { !$0.isDeleted }
        if let selectedCourseFilter {
            list = list.filter { $0.course?.persistentModelID == selectedCourseFilter.persistentModelID }
        }
        if !searchQuery.isEmpty {
            let q = searchQuery.lowercased()
            list = list.filter { assignment in
                assignment.title.lowercased().contains(q) ||
                (assignment.course?.courseCode?.lowercased().contains(q) ?? false) ||
                (assignment.course?.courseName.lowercased().contains(q) ?? false)
            }
        }
        return list
    }

    private var completedAssignments: [Assignment] {
        dbAssignments.filter { !$0.isDeleted && $0.isCompleted }
    }

    private var assignmentsForSelectedDate: [Assignment] {
        dbAssignments.filter { assign in
            !assign.isDeleted && Calendar.current.isDate(dueDateForAssignment(assign), inSameDayAs: selectedDate)
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
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("\(activeAssignments.count) assignments this term")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }
                        Spacer()

                        // Top Right Corner Action Icons: Filter (Left of checkmark), Done (Green Count) & Trash (Red Count)
                        HStack(spacing: 8) {
                            Button(action: {
                                showingCourseFilterSheet = true
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "line.3.horizontal.decrease.circle.fill")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(selectedCourseFilter != nil ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color(red: 0.35, green: 0.42, blue: 0.52))
                                    Text(selectedCourseFilter?.courseCode ?? "Filter")
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

                            Button(action: {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    sortMode = (sortMode == "completed") ? "assignments" : "completed"
                                }
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 15, weight: .bold))
                                        .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                                    Text("\(completedAssignments.count)")
                                        .font(.system(size: 13, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(sortMode == "completed" ? Color(red: 0.05, green: 0.65, blue: 0.40).opacity(0.15) : Color.white)
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
                                    Image(systemName: "trash.fill")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(Color(red: 0.85, green: 0.25, blue: 0.20))
                                    Text("\(deletedAssignments.count + deletedReadings.count)")
                                        .font(.system(size: 13, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.85, green: 0.25, blue: 0.20))
                                }
                                .padding(.horizontal, 10)
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
                                .font(.system(size: 18, weight: .bold, design: .rounded))
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
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text(searchQuery.isEmpty ? "Add assignments manually or parse a syllabus to populate them automatically." : "Nothing matches \"\(searchQuery)\".")
                                .font(.system(size: 12.5))
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
                                let sortedAssignments = activeAssignments.sorted(by: { ($0.dueDate ?? Date.distantFuture) < ($1.dueDate ?? Date.distantFuture) })

                                VStack(alignment: .leading, spacing: 10) {
                                    ForEach(sortedAssignments) { assignment in
                                        AssignmentCardRow(
                                            assignment: assignment,
                                            onToggle: {
                                                withAnimation {
                                                    assignment.isCompleted.toggle()
                                                    try? modelContext.save()
                                                }
                                            },
                                            onEdit: { editingAssignment = assignment },
                                            onDelete: {
                                                withAnimation(.easeInOut(duration: 0.25)) {
                                                    assignment.isDeleted = true
                                                    try? modelContext.save()
                                                }
                                            }
                                        )
                                    }
                                }
                            } else if sortMode == "completed" {
                                let completedList = activeAssignments.filter { $0.isCompleted }
                                if completedList.isEmpty {
                                    VStack(spacing: 8) {
                                        Text("No completed assignments yet")
                                            .font(.system(size: 13.5, weight: .medium))
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
                                                withAnimation {
                                                    assignment.isCompleted.toggle()
                                                    try? modelContext.save()
                                                }
                                            },
                                            onEdit: { editingAssignment = assignment },
                                            onDelete: {
                                                withAnimation(.easeInOut(duration: 0.25)) {
                                                    assignment.isDeleted = true
                                                    try? modelContext.save()
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
                                                        withAnimation {
                                                            assignment.isCompleted.toggle()
                                                            try? modelContext.save()
                                                        }
                                                    },
                                                    onEdit: { editingAssignment = assignment },
                                                    onDelete: {
                                                        withAnimation(.easeInOut(duration: 0.25)) {
                                                            assignment.isDeleted = true
                                                            try? modelContext.save()
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
                                let groupedByDate = Dictionary(grouping: activeAssignments, by: { Calendar.current.startOfDay(for: dueDateForAssignment($0)) })
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
                                                        withAnimation {
                                                            assignment.isCompleted.toggle()
                                                            try? modelContext.save()
                                                        }
                                                    },
                                                    onEdit: { editingAssignment = assignment },
                                                    onDelete: {
                                                        withAnimation(.easeInOut(duration: 0.25)) {
                                                            assignment.isDeleted = true
                                                            try? modelContext.save()
                                                        }
                                                    }
                                                )
                                            }
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
                                                    withAnimation {
                                                        assignment.isCompleted.toggle()
                                                        try? modelContext.save()
                                                    }
                                                },
                                                onEdit: { editingAssignment = assignment },
                                                onDelete: {
                                                    withAnimation(.easeInOut(duration: 0.25)) {
                                                        assignment.isDeleted = true
                                                        try? modelContext.save()
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
                                    by: { $0.course?.courseCode ?? "Unassigned" }
                                )
                                let courseOrder = courses.map { $0.courseCode ?? "" } + ["Unassigned"]
                                let sortedCourseCodes = groupedByCourse.keys.sorted {
                                    let iA = courseOrder.firstIndex(of: $0) ?? 999
                                    let iB = courseOrder.firstIndex(of: $1) ?? 999
                                    return iA < iB
                                }

                                ForEach(sortedCourseCodes, id: \.self) { courseCode in
                                    let courseAssigns = (groupedByCourse[courseCode] ?? []).sorted {
                                        ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture)
                                    }
                                    let courseObj = courses.first(where: { ($0.courseCode ?? "") == courseCode })
                                    let courseColor = CourseColorHelper.color(for: courseObj?.hexColor ?? "#2563EB")
                                    let isExpanded = expandedCourseCodes.contains(courseCode)

                                    VStack(alignment: .leading, spacing: 0) {
                                        // ── Course Header (always visible, tap to expand) ──
                                        Button(action: {
                                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                                if expandedCourseCodes.contains(courseCode) {
                                                    expandedCourseCodes.remove(courseCode)
                                                } else {
                                                    expandedCourseCodes.insert(courseCode)
                                                }
                                            }
                                        }) {
                                            HStack(spacing: 12) {
                                                // Colored accent bar
                                                RoundedRectangle(cornerRadius: 3)
                                                    .fill(courseColor)
                                                    .frame(width: 4, height: 26)

                                                // Course identity (Guaranteed no duplicates: e.g. "Human Sexuality" or "BIO 110 · Cellular Biology")
                                                let fullTitle: String = {
                                                    guard let c = courseObj else { return courseCode }
                                                    let cleanCode = (c.courseCode ?? "").trimmingCharacters(in: .whitespaces)
                                                    let cleanName = c.courseName.trimmingCharacters(in: .whitespaces)
                                                    if cleanCode.isEmpty || cleanCode.lowercased() == cleanName.lowercased() || cleanName.lowercased().hasPrefix(cleanCode.lowercased()) {
                                                        return cleanName.isEmpty ? courseCode : cleanName
                                                    }
                                                    return "\(cleanCode) · \(cleanName)"
                                                }()

                                                Text(fullTitle)
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
                                                            HStack(alignment: .center, spacing: 10) {
                                                                RoundedRectangle(cornerRadius: 3)
                                                                    .fill(courseColor)
                                                                    .frame(width: 4, height: 28)

                                                                VStack(alignment: .leading, spacing: 3) {
                                                                    Text(assignment.title)
                                                                        .font(.system(size: 13.5, weight: .bold, design: .rounded))
                                                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                                        .lineLimit(2)

                                                                    HStack(spacing: 8) {
                                                                        Text("Week \(assignment.weekNumber)")
                                                                            .font(.system(size: 11, weight: .semibold))
                                                                            .foregroundColor(courseColor)

                                                                        if let due = assignment.dueDate {
                                                                            let fmt = DateFormatter()
                                                                            let _ = { fmt.dateFormat = "MMM d" }()
                                                                            Text("• Due \(fmt.string(from: due))")
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
                                                                    }
                                                                }) {
                                                                    Image(systemName: "trash")
                                                                        .font(.system(size: 13))
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

                                                // 2. COURSE OUTLINE (SECOND - ONLY IF RELEVANT WITH CUSTOM THEMES)
                                                let outlineWeeks = (courseObj?.weeks ?? []).filter { week in
                                                    if let theme = week.theme, !theme.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !theme.lowercased().hasPrefix("week ") {
                                                        return true
                                                    }
                                                    return false
                                                }.sorted(by: { $0.weekNumber < $1.weekNumber })

                                                if !outlineWeeks.isEmpty {
                                                    VStack(alignment: .leading, spacing: 8) {
                                                        HStack(spacing: 6) {
                                                            Image(systemName: "list.bullet.rectangle.portrait.fill")
                                                                .font(.system(size: 11, weight: .bold))
                                                                .foregroundColor(courseColor)
                                                            Text("COURSE OUTLINE")
                                                                .font(.system(size: 11, weight: .bold))
                                                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                        }

                                                        VStack(alignment: .leading, spacing: 6) {
                                                            ForEach(outlineWeeks) { week in
                                                                HStack(alignment: .center, spacing: 10) {
                                                                    RoundedRectangle(cornerRadius: 3)
                                                                        .fill(courseColor)
                                                                        .frame(width: 4, height: 28)

                                                                    VStack(alignment: .leading, spacing: 3) {
                                                                        Text(week.theme ?? "Core Concepts")
                                                                            .font(.system(size: 13.5, weight: .bold, design: .rounded))
                                                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                                            .lineLimit(2)
                                                                        Text("Week \(week.weekNumber)")
                                                                            .font(.system(size: 11, weight: .semibold))
                                                                            .foregroundColor(courseColor)
                                                                    }
                                                                    Spacer()
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

                                                // 3. COURSE READINGS (THIRD - ORGANIZED AND SEPARATED BY WEEK: WEEK 1 TO END)
                                                let courseReadings = allReadings.filter { $0.week?.course == courseObj && !$0.isDeleted }
                                                if !courseReadings.isEmpty {
                                                    VStack(alignment: .leading, spacing: 10) {
                                                        HStack(spacing: 6) {
                                                            Image(systemName: "book.closed.fill")
                                                                .font(.system(size: 11, weight: .bold))
                                                                .foregroundColor(Color(red: 0.55, green: 0.27, blue: 0.96))
                                                            Text("COURSE READINGS (\(courseReadings.count))")
                                                                .font(.system(size: 11, weight: .bold))
                                                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                        }

                                                        let sortedReadings = courseReadings.sorted(by: { ($0.week?.weekNumber ?? 1) < ($1.week?.weekNumber ?? 1) })

                                                        ForEach(sortedReadings) { reading in
                                                            let weekNum = reading.week?.weekNumber ?? 1
                                                            HStack(alignment: .center, spacing: 10) {
                                                                RoundedRectangle(cornerRadius: 3)
                                                                    .fill(courseColor)
                                                                    .frame(width: 4, height: 28)

                                                                VStack(alignment: .leading, spacing: 3) {
                                                                    Text(ReadingTitleCleaner.cleanTitle(reading.title))
                                                                        .font(.system(size: 13.5, weight: .bold, design: .rounded))
                                                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                                        .lineLimit(2)

                                                                    HStack(spacing: 8) {
                                                                        Text("Week \(weekNum)")
                                                                            .font(.system(size: 11, weight: .semibold))
                                                                            .foregroundColor(courseColor)

                                                                        if let range = reading.dateRangeStr, !range.isEmpty {
                                                                            Text("• \(range)")
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
                                                                        .font(.system(size: 13))
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
                                            withAnimation {
                                                for a in deletedAssignments { modelContext.delete(a) }
                                                for r in deletedReadings { modelContext.delete(r) }
                                                try? modelContext.save()
                                            }
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
                                                    Text("Assignment · \(assignment.course?.courseCode ?? "CRS") · Week \(assignment.weekNumber)")
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
                                                    Text(ReadingTitleCleaner.cleanTitle(reading.title))
                                                        .font(.system(size: 14, weight: .bold))
                                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                    Text("Reading · \(reading.week?.course?.courseCode ?? "CRS") · Week \(reading.week?.weekNumber ?? 1)")
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
                                ForEach(activeAssignments.sorted(by: { dueDateForAssignment($0) < dueDateForAssignment($1) })) { assignment in
                                    AssignmentCardRow(
                                        assignment: assignment,
                                        onToggle: {
                                            withAnimation {
                                                assignment.isCompleted.toggle()
                                                try? modelContext.save()
                                            }
                                        },
                                        onEdit: { editingAssignment = assignment },
                                        onDelete: {
                                            withAnimation(.easeInOut(duration: 0.25)) {
                                                assignment.isDeleted = true
                                                try? modelContext.save()
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
            .onAppear {
                sortMode = "assignments"
            }
            .dismissKeyboardOnTap()
        }
    }

    private func dueDateForAssignment(_ assign: Assignment) -> Date {
        if let due = assign.dueDate {
            return due
        }
        let calendar = Calendar.current
        var comp = DateComponents()
        comp.year = 2026
        comp.month = 9
        comp.day = 4
        comp.hour = 23
        comp.minute = 59
        let startDate = calendar.date(from: comp) ?? Date()
        return calendar.date(byAdding: .day, value: (assign.weekNumber - 1) * 7, to: startDate) ?? Date()
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

    private func hasAssignmentOnDate(_ date: Date) -> Bool {
        activeAssignments.contains { assign in
            let due = dueDateForAssignment(assign)
            return Calendar.current.isDate(due, inSameDayAs: date)
        }
    }

    private func courseColorsForDate(_ date: Date) -> [Color] {
        let matching = activeAssignments.filter { assign in
            let due = dueDateForAssignment(assign)
            return Calendar.current.isDate(due, inSameDayAs: date)
        }
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

    public var body: some View {
        HStack(spacing: 8) {
            // Little Vertical Course Color Line Indicator
            RoundedRectangle(cornerRadius: 3)
                .fill(courseColor)
                .frame(width: 4, height: 52)

            // Content Area (Tapping opens Assignment Details)
            Button(action: onEdit) {
                VStack(alignment: .leading, spacing: 4) {
                    let displayCourseTitle: String = {
                        if let course = assignment.course {
                            let code = (course.courseCode ?? "").trimmingCharacters(in: .whitespaces)
                            let name = course.courseName.trimmingCharacters(in: .whitespaces)
                            if !code.isEmpty && code.lowercased() != "crs" && code.lowercased() != "course" {
                                if !name.isEmpty {
                                    let cleanCode = code.trimmingCharacters(in: .whitespaces)
                                    let cleanName = name.trimmingCharacters(in: .whitespaces)
                                    if cleanName.lowercased().hasPrefix(cleanCode.lowercased()) {
                                        return cleanName
                                    }
                                    return "\(cleanCode) · \(cleanName)"
                                }
                                return code
                            }
                            return name.isEmpty ? "COURSE" : name
                        }
                        return "COURSE"
                    }()

                    Text(displayCourseTitle)
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(courseColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(courseColor.opacity(0.15))
                        .cornerRadius(8)
                        .lineLimit(1)

                    Text(assignment.title)
                        .font(.system(size: 13.5, weight: .semibold, design: .rounded))
                        .foregroundColor(assignment.isCompleted ? Color(red: 0.35, green: 0.42, blue: 0.52) : Color(red: 0.08, green: 0.12, blue: 0.22))
                        .strikethrough(assignment.isCompleted)
                        .multilineTextAlignment(.leading)
                        .lineLimit(3)

                    // Date Display (Formatted identically to Readings: "Due [Day], [Month] [Date] · Week [WeekNumber]")
                    let assignDateText = WeekDateConverter.formattedDueDate(for: assignment.dueDate, weekNumber: assignment.weekNumber)
                    Text(assignDateText)
                        .font(.system(size: 10.5, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        .padding(.top, 1)
                }
            }
            .buttonStyle(.plain)

            Spacer(minLength: 4)

            // Right-side Clean Action Buttons: Checkmark Ring & Trashcan
            HStack(spacing: 12) {
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
                    .frame(width: 36, height: 36)
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
                        .font(.system(size: 16))
                        .foregroundColor(Color.red.opacity(0.85))
                        .frame(width: 32, height: 32)
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
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash.fill")
            }
        }
    }

    private func formattedDueDate(_ date: Date?) -> String {
        let d: Date
        if let explicitDate = date {
            d = explicitDate
        } else {
            let calendar = Calendar.current
            var comp = DateComponents()
            comp.year = 2026
            comp.month = 9
            comp.day = 4
            comp.hour = 23
            comp.minute = 59
            let startDate = calendar.date(from: comp) ?? Date()
            d = calendar.date(byAdding: .day, value: (assignment.weekNumber - 1) * 7, to: startDate) ?? Date()
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"
        return "Due " + formatter.string(from: d) + " · Week \(assignment.weekNumber)"
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
                    .font(.system(size: 12, weight: isSelected ? .bold : .semibold, design: .rounded))
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

// MARK: - Edit Assignment Sheet

public struct EditAssignmentSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Bindable var assignment: Assignment

    @State private var weekNumberState: Int = 1
    @State private var dueDateState: Date = Date()
    @State private var pointsValueState: Int = 100
    @State private var gradeWeightPercentState: Int = 10
    @State private var videoUrlTextState: String = ""
    @State private var courseNameTextState: String = ""
    @State private var customNotesState: String = ""
    @State private var isSyncing: Bool = false

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

                    // Section 2: Combined Week & Date Range Section with Bidirectional Sync
                    Section("Week & Date Range") {
                        Picker("Week", selection: $weekNumberState) {
                            ForEach(1...20, id: \.self) { w in
                                Text("Week \(w)").tag(w)
                            }
                        }
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .pickerStyle(.menu)
                        .onChange(of: weekNumberState) { _, newW in
                            guard !isSyncing else { return }
                            isSyncing = true
                            assignment.weekNumber = newW
                            let calculatedDate = WeekDateConverter.date(forWeek: newW)
                            dueDateState = calculatedDate
                            assignment.dueDate = calculatedDate
                            isSyncing = false
                        }

                        DatePicker("Due Date", selection: $dueDateState, displayedComponents: [.date, .hourAndMinute])
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .onChange(of: dueDateState) { _, newDate in
                                guard !isSyncing else { return }
                                isSyncing = true
                                assignment.dueDate = newDate
                                let calculatedWeek = WeekDateConverter.weekNumber(for: newDate)
                                weekNumberState = calculatedWeek
                                assignment.weekNumber = calculatedWeek
                                isSyncing = false
                            }
                    }

                    // Section 3: Points & Grade Weight (Independently Decoupled)
                    Section("Points & Grade Weight") {
                        Picker("Points Possible", selection: $pointsValueState) {
                            let defaultOpts = Array(stride(from: 0, through: 500, by: 5))
                            let opts = defaultOpts.contains(pointsValueState) ? defaultOpts : (defaultOpts + [pointsValueState]).sorted()
                            ForEach(opts, id: \.self) { pts in
                                Text("\(pts) Points").tag(pts)
                            }
                        }
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .pickerStyle(.menu)
                        .onChange(of: pointsValueState) { _, newPts in
                            assignment.pointsPossible = "\(newPts) Points"
                        }

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
                    }

                    // Section 4: Resource Link
                    Section("Resource Link") {
                        TextField("Paste video or article URL...", text: $videoUrlTextState)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))

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

                    // Section 5: Notes Section (Double size input pill)
                    Section("Notes") {
                        TextField("Enter notes...", text: $customNotesState, axis: .vertical)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .lineLimit(6...14)
                            .onChange(of: customNotesState) { _, newValue in
                                assignment.noteText = newValue
                            }
                    }
                }
                .scrollContentBackground(.hidden)
                .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                .scrollDismissesKeyboard(.immediately)
            }
            .onAppear {
                weekNumberState = assignment.weekNumber
                dueDateState = assignment.dueDate ?? WeekDateConverter.date(forWeek: assignment.weekNumber)
                videoUrlTextState = ""
                customNotesState = assignment.noteText ?? ""
                courseNameTextState = assignment.course?.courseName ?? ""
                
                let rawPts = assignment.pointsPossible ?? "100 Points"
                let ptsDigits = rawPts.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                pointsValueState = Int(ptsDigits) ?? 100

                let rawWeight = assignment.weightPercentage ?? "\(pointsValueState / 5)%"
                let weightDigits = rawWeight.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                gradeWeightPercentState = Int(weightDigits) ?? (pointsValueState / 5)
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
