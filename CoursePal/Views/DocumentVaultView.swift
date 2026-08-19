import SwiftUI
import SwiftData

public struct DocumentVaultView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Course.createdAt, order: .reverse) private var courses: [Course]
    @Query(sort: \VaultDocument.uploadedAt, order: .reverse) private var dbVaultDocs: [VaultDocument]
    @Query(sort: \SyllabusDocument.uploadedAt, order: .reverse) private var dbSyllabi: [SyllabusDocument]
    @Query private var allAssignments: [Assignment]
    @Query private var allReadings: [Reading]

    @State private var selectedFilter: String = "Courses"
    @State private var selectedDocForPreview: VaultDocument? = nil

    private let filterOptions = ["Courses", "Documents"]

    public init() {}

    private func deleteCourse(_ course: Course) {
        withAnimation(.easeInOut(duration: 0.25)) {
            let cCode = (course.courseCode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

            for assign in allAssignments {
                if assign.course?.persistentModelID == course.persistentModelID ||
                   (!cCode.isEmpty && (assign.course?.courseCode ?? "").lowercased() == cCode) {
                    modelContext.delete(assign)
                }
            }

            for reading in allReadings {
                if reading.week?.course?.persistentModelID == course.persistentModelID ||
                   (!cCode.isEmpty && (reading.week?.course?.courseCode ?? "").lowercased() == cCode) {
                    modelContext.delete(reading)
                }
            }

            modelContext.delete(course)
            try? modelContext.save()
        }
    }

    private func deleteVaultDoc(_ doc: VaultDocument) {
        withAnimation(.easeInOut(duration: 0.25)) {
            let codeKey = (doc.courseCode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

            if !codeKey.isEmpty && codeKey != "crs" {
                for assign in allAssignments {
                    if (assign.course?.courseCode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == codeKey {
                        modelContext.delete(assign)
                    }
                }
                for reading in allReadings {
                    if (reading.week?.course?.courseCode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == codeKey {
                        modelContext.delete(reading)
                    }
                }
                for course in courses {
                    if (course.courseCode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == codeKey {
                        modelContext.delete(course)
                    }
                }
            }

            modelContext.delete(doc)
            try? modelContext.save()
        }
    }

    private func deleteSyllabusDoc(_ doc: SyllabusDocument) {
        withAnimation(.easeInOut(duration: 0.25)) {
            if let course = doc.course {
                deleteCourse(course)
            }
            modelContext.delete(doc)
            try? modelContext.save()
        }
    }

    private func syllabusDocColor(doc: SyllabusDocument, index: Int) -> Color {
        let docHex = CourseImporter.getDistinctVaultDocColor(docIndex: index, courseHex: doc.course?.hexColor)
        return CourseColorHelper.color(for: docHex)
    }

    private func vaultDocColor(doc: VaultDocument, index: Int, matchingCourse: Course?) -> Color {
        let docHex = CourseImporter.getDistinctVaultDocColor(docIndex: dbSyllabi.count + index, courseHex: matchingCourse?.hexColor)
        return CourseColorHelper.color(for: docHex)
    }

    public var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                // MARK: - Header
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Syllabus")
                            .font(.system(size: 24, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        Text("Stored course syllabi & study materials")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    }
                    Spacer()
                }
                .padding(.horizontal, 18)
                .padding(.top, 18)

                // MARK: - Interactive Filter Chips (No "All", No "Join Codes")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(filterOptions, id: \.self) { opt in
                            Button(action: {
                                withAnimation(.spring(response: 0.25)) {
                                    selectedFilter = opt
                                }
                            }) {
                                Text(opt)
                                    .font(.system(size: 13, weight: selectedFilter == opt ? .bold : .semibold))
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(selectedFilter == opt ? Color(red: 0.14, green: 0.44, blue: 0.96) : Color.white)
                                    .foregroundColor(selectedFilter == opt ? .white : Color(red: 0.35, green: 0.42, blue: 0.52))
                                    .cornerRadius(16)
                                    .shadow(color: selectedFilter == opt ? Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.25) : Color.black.opacity(0.03), radius: selectedFilter == opt ? 4 : 2, x: 0, y: 2)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 16)
                                            .stroke(selectedFilter == opt ? Color.clear : Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 18)
                }

                // MARK: - Main Vault Content ScrollView
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 16) {
                        // ── SECTION: COURSES ────────────────────────────────────
                        if selectedFilter == "Courses" {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("COURSES (\(courses.count))")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                                if courses.isEmpty {
                                    VStack(spacing: 10) {
                                        ZStack {
                                            Circle()
                                                .fill(Color(red: 0.92, green: 0.95, blue: 1.0))
                                                .frame(width: 48, height: 48)
                                            Image(systemName: "book.closed.fill")
                                                .font(.system(size: 20))
                                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                        }
                                        Text("No course syllabi in vault yet.")
                                            .font(.system(size: 13, weight: .medium))
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    }
                                    .padding(24)
                                    .frame(maxWidth: .infinity)
                                    .background(Color.white)
                                    .cornerRadius(16)
                                    .shadow(color: Color.black.opacity(0.03), radius: 6, x: 0, y: 2)
                                } else {
                                    ForEach(courses) { course in
                                        let courseColor = CourseColorHelper.color(for: course.hexColor)

                                        HStack(spacing: 12) {
                                            RoundedRectangle(cornerRadius: 3)
                                                .fill(courseColor)
                                                .frame(width: 4, height: 36)

                                            VStack(alignment: .leading, spacing: 3) {
                                                Text(course.courseCode ?? "CRS 101")
                                                    .font(.system(size: 14, weight: .bold, design: .rounded))
                                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                Text(course.courseName)
                                                    .font(.system(size: 12))
                                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                            }

                                            Spacer()

                                            // ONLY Trashcan Button (No Copy Code, No Share)
                                            Button(action: {
                                                deleteCourse(course)
                                            }) {
                                                Image(systemName: "trash")
                                                    .font(.system(size: 13, weight: .light))
                                                    .foregroundColor(Color.red.opacity(0.85))
                                                    .frame(width: 32, height: 32)
                                                    .contentShape(Rectangle())
                                            }
                                            .buttonStyle(.plain)
                                        }
                                        .padding(12)
                                        .background(Color.white)
                                        .cornerRadius(16)
                                        .shadow(color: Color.black.opacity(0.03), radius: 6, x: 0, y: 2)
                                    }
                                }
                            }
                        }

                        // ── SECTION 2: CLASS DOCUMENTS & MATERIALS ───────────────
                        if selectedFilter == "Documents" {
                            let totalDocs = dbVaultDocs.count + dbSyllabi.count
                            VStack(alignment: .leading, spacing: 10) {
                                Text("CLASS DOCUMENTS & MATERIALS (\(totalDocs))")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                                if totalDocs == 0 {
                                    VStack(spacing: 10) {
                                        ZStack {
                                            Circle()
                                                .fill(Color(red: 0.92, green: 0.95, blue: 1.0))
                                                .frame(width: 48, height: 48)
                                            Image(systemName: "doc.plaintext.fill")
                                                .font(.system(size: 20))
                                                .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                        }
                                        Text("No documents stored in vault yet.")
                                            .font(.system(size: 13, weight: .medium))
                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    }
                                    .padding(24)
                                    .frame(maxWidth: .infinity)
                                    .background(Color.white)
                                    .cornerRadius(16)
                                } else {
                                    ForEach(Array(dbSyllabi.enumerated()), id: \.element.id) { index, doc in
                                        let previewAction = {
                                            let sizeMB = Double(doc.rawFileData?.count ?? 0) / (1024.0 * 1024.0)
                                            let vDoc = VaultDocument(
                                                title: doc.docTitle,
                                                category: "Syllabi",
                                                fileSize: String(format: "%.1f MB", sizeMB),
                                                fileType: "PDF",
                                                courseCode: doc.course?.courseCode ?? "CRS",
                                                rawFileData: doc.rawFileData
                                            )
                                            selectedDocForPreview = vDoc
                                        }
                                        HStack(spacing: 12) {
                                            Button(action: previewAction) {
                                                HStack(spacing: 12) {
                                                    ZStack {
                                                        RoundedRectangle(cornerRadius: 10)
                                                            .fill(Color(red: 0.49, green: 0.23, blue: 0.93).opacity(0.12))
                                                            .frame(width: 36, height: 36)
                                                        Image(systemName: "doc.fill")
                                                            .font(.system(size: 16))
                                                            .foregroundColor(Color(red: 0.49, green: 0.23, blue: 0.93))
                                                    }

                                                    VStack(alignment: .leading, spacing: 2) {
                                                        Text(doc.docTitle)
                                                            .font(.system(size: 13.5, weight: .bold))
                                                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                            .multilineTextAlignment(.leading)
                                                            .lineLimit(1)
                                                        Text(doc.course?.courseCode ?? doc.course?.courseName ?? "General")
                                                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                                                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                            .lineLimit(1)
                                                    }
                                                }
                                            }
                                            .buttonStyle(.plain)

                                            Spacer()

                                            Button(action: previewAction) {
                                                ZStack {
                                                    RoundedRectangle(cornerRadius: 8)
                                                        .fill(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.10))
                                                        .frame(width: 32, height: 32)
                                                    Image(systemName: "eye.fill")
                                                        .font(.system(size: 13, weight: .semibold))
                                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                                }
                                            }
                                            .buttonStyle(.plain)

                                            Button(action: {
                                                deleteSyllabusDoc(doc)
                                            }) {
                                                Image(systemName: "trash")
                                                    .font(.system(size: 13, weight: .light))
                                                    .foregroundColor(Color.red.opacity(0.85))
                                                    .frame(width: 32, height: 32)
                                                    .contentShape(Rectangle())
                                            }
                                            .buttonStyle(.plain)
                                        }
                                        .padding(12)
                                        .background(Color.white)
                                        .cornerRadius(14)
                                        .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 2)
                                    }

                                    ForEach(Array(dbVaultDocs.enumerated()), id: \.element.id) { index, doc in
                                         let matchingCourse = courses.first(where: { 
                                             if let code = doc.courseCode?.trimmingCharacters(in: .whitespacesAndNewlines), !code.isEmpty {
                                                 return ($0.courseCode ?? "").lowercased() == code.lowercased() || $0.courseName.lowercased().contains(code.lowercased())
                                             }
                                             return false
                                         })

                                         HStack(spacing: 12) {
                                             Button(action: { selectedDocForPreview = doc }) {
                                                 HStack(spacing: 12) {
                                                     ZStack {
                                                         RoundedRectangle(cornerRadius: 10)
                                                             .fill(Color(red: 0.49, green: 0.23, blue: 0.93).opacity(0.12))
                                                             .frame(width: 36, height: 36)
                                                         Image(systemName: "doc.fill")
                                                             .font(.system(size: 16))
                                                             .foregroundColor(Color(red: 0.49, green: 0.23, blue: 0.93))
                                                     }

                                                     VStack(alignment: .leading, spacing: 2) {
                                                         Text(doc.title)
                                                             .font(.system(size: 13.5, weight: .bold))
                                                             .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                             .multilineTextAlignment(.leading)
                                                             .lineLimit(1)
                                                         Text(doc.courseCode ?? matchingCourse?.courseCode ?? "General")
                                                             .font(.system(size: 11, weight: .semibold, design: .rounded))
                                                             .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                             .lineLimit(1)
                                                     }
                                                 }
                                             }
                                             .buttonStyle(.plain)

                                             Spacer()

                                             Button(action: {
                                                 selectedDocForPreview = doc
                                             }) {
                                                 ZStack {
                                                     RoundedRectangle(cornerRadius: 8)
                                                         .fill(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.10))
                                                         .frame(width: 32, height: 32)
                                                     Image(systemName: "eye.fill")
                                                         .font(.system(size: 13, weight: .semibold))
                                                         .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                                 }
                                             }
                                             .buttonStyle(.plain)

                                             Button(action: {
                                                 deleteVaultDoc(doc)
                                             }) {
                                                 Image(systemName: "trash")
                                                     .font(.system(size: 13, weight: .light))
                                                     .foregroundColor(Color.red.opacity(0.85))
                                                     .frame(width: 32, height: 32)
                                                     .contentShape(Rectangle())
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
                        }

                        // Generous bottom spacer so content never gets blocked by floating menu pill
                        Spacer(minLength: 110)
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 110)
                }
            }
            .background(Color(red: 0.95, green: 0.96, blue: 0.98))
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .sheet(item: $selectedDocForPreview) { doc in
                VaultDocPreviewSheet(document: doc)
            }
        }
    }
}
