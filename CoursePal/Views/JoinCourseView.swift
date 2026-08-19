import SwiftUI
import SwiftData
#if canImport(UIKit)
import UIKit
#endif

public struct JoinCourseView: View {
    @Environment(\.presentationMode) private var presentationMode
    @Environment(\.modelContext) private var modelContext
    
    @State private var sharingCode: String = ""
    @State private var isJoining: Bool = false
    @State private var errorMessage: String? = nil

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                VStack(spacing: 12) {
                    Image(systemName: "person.2.badge.key.fill")
                        .font(.system(size: 56))
                        .foregroundColor(.blue)

                    Text("Join Shared Course")
                        .font(.title)
                        .fontWeight(.bold)

                    Text("Enter the course sharing code provided by your classmate or instructor.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding(.top, 20)

                VStack(alignment: .leading, spacing: 8) {
                    Text("SHARING CODE")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.secondary)

                    TextField("e.g. A1B2C3D4E5F6", text: $sharingCode)
                        .font(.title3.monospaced())
                        #if os(iOS)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        #endif
                        .padding()
                        #if canImport(UIKit)
                        .background(Color(uiColor: .secondarySystemBackground))
                        #else
                        .background(Color.gray.opacity(0.15))
                        #endif
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.blue.opacity(0.4), lineWidth: 1)
                        )
                }

                if let err = errorMessage {
                    Text(err)
                        .font(.footnote)
                        .foregroundColor(.red)
                }

                Button(action: joinCourseAction) {
                    HStack {
                        if isJoining {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "arrow.right.circle.fill")
                            Text("Enroll in Course")
                                .fontWeight(.bold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(sharingCode.trimmingCharacters(in: .whitespaces).isEmpty ? Color.gray : Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(14)
                }
                .disabled(sharingCode.trimmingCharacters(in: .whitespaces).isEmpty || isJoining)

                Spacer()
            }
            .padding(24)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
        }
    }

    private func joinCourseAction() {
        let code = sharingCode.trimmingCharacters(in: .whitespaces)
        guard !code.isEmpty else { return }

        isJoining = true
        errorMessage = nil

        Task {
            do {
                let courseDTO = try await APIService.shared.joinCourse(sharingCode: code)
                
                // Convert DTO into SwiftData objects
                let courseId = UUID(uuidString: courseDTO.id) ?? UUID()
                let newCourse = Course(
                    id: courseId,
                    creatorId: UUID(uuidString: courseDTO.creatorId ?? "") ?? UUID(),
                    courseName: courseDTO.courseName,
                    courseCode: courseDTO.courseCode,
                    termWeeks: courseDTO.termWeeks ?? 16,
                    sharingCode: courseDTO.sharingCode
                )

                if let weeksDTO = courseDTO.weeks {
                    for wDTO in weeksDTO {
                        let weekId = UUID(uuidString: wDTO.id) ?? UUID()
                        let week = Week(
                            id: weekId,
                            weekNumber: wDTO.weekNumber,
                            theme: wDTO.theme
                        )
                        week.course = newCourse

                        if let readingsDTO = wDTO.readings {
                            for rDTO in readingsDTO {
                                let reading = Reading(
                                    id: UUID(uuidString: rDTO.id) ?? UUID(),
                                    title: rDTO.title,
                                    mediaType: MediaType(rawValue: rDTO.mediaType ?? "textbook") ?? .textbook,
                                    isCompleted: rDTO.isCompleted ?? false
                                )
                                reading.week = week
                                week.readings.append(reading)
                            }
                        }
                        newCourse.weeks.append(week)
                    }
                }

                if let assignDTO = courseDTO.assignments {
                    for aDTO in assignDTO {
                        let assign = Assignment(
                            id: UUID(uuidString: aDTO.id) ?? UUID(),
                            title: aDTO.title,
                            fullInstructions: aDTO.fullInstructions,
                            pointsPossible: aDTO.pointsPossible,
                            noteText: aDTO.noteText,
                            weightPercentage: aDTO.weightPercentage
                        )
                        assign.course = newCourse
                        newCourse.assignments.append(assign)
                    }
                }

                modelContext.insert(newCourse)
                try? modelContext.save()

                isJoining = false
                presentationMode.wrappedValue.dismiss()

            } catch {
                isJoining = false
                errorMessage = "Failed to join course. Check sharing code and network connection."
            }
        }
    }
}
