import SwiftUI
import SwiftData

public struct CourseChatMessage: Identifiable, Equatable {
    public let id: UUID = UUID()
    public let text: String
    public let isUser: Bool
    public let timestamp: Date = Date()
}

public struct CourseAIChatView: View {
    @Bindable public var course: Course
    @Environment(\.dismiss) private var dismiss
    
    @State private var messages: [CourseChatMessage] = []
    @State private var inputText: String = ""
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil

    public init(course: Course) {
        self.course = course
    }

    private var courseColor: Color {
        CourseColorHelper.color(for: course.hexColor)
    }

    private var quickQuestions: [String] {
        [
            "What is the late assignment penalty?",
            "How is attendance and participation graded?",
            "What are the major assignments and their weights?",
            "Summarize the required readings for this course"
        ]
    }

    private var courseContext: String {
        var context = "COURSE CODE: \(course.courseCode ?? "N/A")\n"
        context += "COURSE TITLE: \(course.courseName)\n"
        if let desc = course.courseDescription, !desc.isEmpty {
            context += "DESCRIPTION: \(desc)\n"
        }
        if let instr = course.instructorName, !instr.isEmpty {
            context += "INSTRUCTOR: \(instr) (Email: \(course.instructorEmail ?? "N/A"))\n"
        }
        
        context += "\n--- ASSIGNMENTS ---\n"
        for a in course.assignments where !a.isDeleted {
            let dueStr = a.dueDate != nil ? ISO8601DateFormatter().string(from: a.dueDate!) : "TBD"
            context += "• \(a.title) | Weight: \(a.weightPercentage ?? "N/A") | Points: \(a.pointsPossible ?? "N/A") | Due: \(dueStr)\n"
            if let instr = a.fullInstructions, !instr.isEmpty {
                context += "  Instructions: \(instr)\n"
            }
            if !a.rubricCriteria.isEmpty {
                let rubrics = a.rubricCriteria.map { "\($0.criterionName): \($0.description ?? "")" }.joined(separator: ", ")
                context += "  Rubric: \(rubrics)\n"
            }
        }

        context += "\n--- WEEKLY SCHEDULE & READINGS ---\n"
        for w in course.weeks.sorted(by: { $0.weekNumber < $1.weekNumber }) {
            let readingsStr = w.readings.filter { !$0.isDeleted }.map { "• \($0.title) [\($0.mediaType.displayName)]" }.joined(separator: "\n    ")
            context += "Week \(w.weekNumber) (\(w.theme ?? "Schedule")): \n    \(readingsStr.isEmpty ? "No formal readings listed" : readingsStr)\n"
        }

        return context
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header bar
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(courseColor)
                                .frame(width: 10, height: 10)
                            Text(course.courseCode ?? "Course AI")
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.1, green: 0.14, blue: 0.24))
                        }
                        Text("Syllabus AI Assistant")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                    }
                    Spacer()
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 24))
                            .foregroundColor(Color(red: 0.7, green: 0.75, blue: 0.82))
                    }
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 14)
                .background(Color.white)
                .overlay(
                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(Color.black.opacity(0.06)),
                    alignment: .bottom
                )

                // Message List
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            if messages.isEmpty {
                                // Welcome Banner
                                VStack(alignment: .leading, spacing: 12) {
                                    HStack(spacing: 10) {
                                        Image(systemName: "sparkles")
                                            .font(.system(size: 20, weight: .semibold))
                                            .foregroundColor(courseColor)
                                        Text("Ask anything about \(course.courseCode ?? "this course")")
                                            .font(.system(size: 16, weight: .bold, design: .rounded))
                                            .foregroundColor(Color(red: 0.1, green: 0.14, blue: 0.24))
                                    }
                                    Text("I have analyzed the full syllabus, assignment rubrics, policies, and schedule. Tap a question below or type your own:")
                                        .font(.system(size: 13.5))
                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))

                                    // Quick prompt chips
                                    VStack(alignment: .leading, spacing: 8) {
                                        ForEach(quickQuestions, id: \.self) { q in
                                            Button(action: { sendQuestion(q) }) {
                                                HStack {
                                                    Image(systemName: "bubble.left.and.bubble.right.fill")
                                                        .font(.system(size: 11))
                                                        .foregroundColor(courseColor)
                                                    Text(q)
                                                        .font(.system(size: 13, weight: .medium))
                                                        .foregroundColor(Color(red: 0.15, green: 0.2, blue: 0.3))
                                                    Spacer()
                                                    Image(systemName: "arrow.up.right")
                                                        .font(.system(size: 11, weight: .bold))
                                                        .foregroundColor(Color.gray.opacity(0.6))
                                                }
                                                .padding(.horizontal, 12)
                                                .padding(.vertical, 9)
                                                .background(Color.white)
                                                .cornerRadius(10)
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 10)
                                                        .stroke(Color.black.opacity(0.08), lineWidth: 1)
                                                )
                                            }
                                        }
                                    }
                                    .padding(.top, 4)
                                }
                                .padding(16)
                                .background(courseColor.opacity(0.06))
                                .cornerRadius(16)
                                .padding(.horizontal, 16)
                                .padding(.top, 14)
                            }

                            ForEach(messages) { msg in
                                HStack {
                                    if msg.isUser {
                                        Spacer(minLength: 40)
                                        Text(msg.text)
                                            .font(.system(size: 14.5, weight: .regular))
                                            .foregroundColor(.white)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 10)
                                            .background(courseColor)
                                            .cornerRadius(18)
                                    } else {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(LocalizedStringKey(msg.text))
                                                .font(.system(size: 14.5, weight: .regular))
                                                .foregroundColor(Color(red: 0.1, green: 0.14, blue: 0.24))
                                                .padding(.horizontal, 14)
                                                .padding(.vertical, 10)
                                                .background(Color.white)
                                                .cornerRadius(18)
                                                .shadow(color: Color.black.opacity(0.04), radius: 3, x: 0, y: 1)
                                        }
                                        Spacer(minLength: 40)
                                    }
                                }
                                .id(msg.id)
                                .padding(.horizontal, 16)
                            }

                            if isLoading {
                                HStack(spacing: 6) {
                                    ProgressView()
                                        .scaleEffect(0.8)
                                    Text("Consulting syllabus AI...")
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(Color.white.opacity(0.8))
                                .cornerRadius(14)
                                .padding(.horizontal, 16)
                            }
                        }
                        .padding(.vertical, 14)
                    }
                    .onChange(of: messages) { _, _ in
                        if let lastId = messages.last?.id {
                            withAnimation(.easeOut(duration: 0.2)) {
                                proxy.scrollTo(lastId, anchor: .bottom)
                            }
                        }
                    }
                }

                // Input Bar
                HStack(spacing: 10) {
                    TextField("Ask a question about the course...", text: $inputText)
                        .font(.system(size: 14))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.white)
                        .cornerRadius(20)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(Color.black.opacity(0.1), lineWidth: 1)
                        )
                        .onSubmit {
                            if !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                sendQuestion(inputText)
                            }
                        }

                    Button(action: {
                        if !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            sendQuestion(inputText)
                        }
                    }) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundColor(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Color.gray.opacity(0.3) : courseColor)
                    }
                    .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color(red: 0.96, green: 0.97, blue: 0.98))
            }
            .background(Color(red: 0.95, green: 0.96, blue: 0.98).ignoresSafeArea())
            .navigationBarHidden(true)
        }
    }

    private func sendQuestion(_ question: String) {
        let trimmed = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        inputText = ""
        let userMsg = CourseChatMessage(text: trimmed, isUser: true)
        messages.append(userMsg)
        isLoading = true

        Task {
            do {
                let answer = try await APIService.shared.askCourseSyllabus(courseContext: self.courseContext, question: trimmed)
                await MainActor.run {
                    self.messages.append(CourseChatMessage(text: answer, isUser: false))
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.messages.append(CourseChatMessage(text: "⚠️ \(error.localizedDescription)", isUser: false))
                    self.isLoading = false
                }
            }
        }
    }
}
