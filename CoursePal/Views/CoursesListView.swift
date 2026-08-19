import SwiftUI
import SwiftData

public struct CoursesListView: View {
    @Query(sort: \Course.createdAt, order: .reverse) private var courses: [Course]
    @Environment(\.modelContext) private var modelContext
    @State private var isShowingJoinModal: Bool = false

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                if courses.isEmpty {
                    ContentUnavailableView(
                        "No Courses Enrolled",
                        systemImage: "book.closed",
                        description: Text("Scan a new syllabus or enter a sharing code to get started.")
                    )
                } else {
                    Section("Enrolled Courses (\(courses.count))") {
                        ForEach(courses) { course in
                            NavigationLink(destination: CourseDetailView(course: course)) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(course.courseCode ?? "COURSE")
                                            .font(.caption)
                                            .fontWeight(.bold)
                                            .foregroundColor(.blue)

                                        Text(course.courseName)
                                            .font(.headline)

                                        Text("Sharing Code: \(course.sharingCode)")
                                            .font(.caption2)
                                            .fontDesign(.monospaced)
                                            .foregroundColor(.secondary)
                                    }
                                    Spacer()

                                    Text("\(course.weeks.count) Weeks")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                .padding(.vertical, 4)
                            }
                        }
                        .onDelete(perform: deleteCourses)
                    }
                }
            }
            .navigationTitle("Courses")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: { isShowingJoinModal = true }) {
                        Label("Join Course", systemImage: "person.2.badge.key.fill")
                    }
                }
            }
            .sheet(isPresented: $isShowingJoinModal) {
                JoinCourseView()
            }
        }
    }

    private func deleteCourses(at offsets: IndexSet) {
        for index in offsets {
            let course = courses[index]
            modelContext.delete(course)
        }
        try? modelContext.save()
    }
}
