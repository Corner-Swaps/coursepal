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
                        .font(.cpPageTitle)
                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                    Text("Enter the course sharing code provided by your classmate or instructor.")
                        .font(.cpDescription)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding(.top, 20)

                VStack(alignment: .leading, spacing: 8) {
                    Text("SHARING CODE")
                        .font(.cpItemTitle)
                        .foregroundColor(.secondary)

                    TextField("e.g. 849204", text: $sharingCode)
                        .font(.cpDescriptionBold)
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
                        .font(.cpDescription)
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
                                .font(.cpItemTitle)
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

        // 1. Try decoding embedded course payload directly (Works 100% offline & for any App Store user)
        if let decodedDTO = CourseSharingService.shared.decodeCourse(from: code) {
            _ = CourseImporter.importDTO(decodedDTO, into: modelContext, forceNewCourse: true)
            try? modelContext.save()
            isJoining = false
            presentationMode.wrappedValue.dismiss()
            return
        }

        // 2. Check if matches existing course or create with 12 weeks
        let clean = ShareCenterView.extractCourseCode(from: code)
        let digitsOnly = clean.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()

        let descriptor = FetchDescriptor<Course>()
        let existingCourses = (try? modelContext.fetch(descriptor)) ?? []
        if let existing = existingCourses.first(where: {
            $0.courseCode?.uppercased() == clean || $0.sharingCode.uppercased() == clean || (!digitsOnly.isEmpty && $0.sharingCode == digitsOnly)
        }) {
            isJoining = false
            errorMessage = "You are already enrolled in '\(existing.courseName)'!"
            return
        }

        let newCourse = Course(
            courseName: clean.isEmpty ? "Joined Course" : "Course \(clean)",
            courseCode: clean.isEmpty ? "CRS" : clean,
            hexColor: "#7C3AED",
            termWeeks: 12,
            sharingCode: digitsOnly.isEmpty ? String(format: "%06d", Int.random(in: 100000...999999)) : digitsOnly
        )

        for w in 1...12 {
            let wk = Week(weekNumber: w, theme: "Week \(w) Schedule")
            wk.course = newCourse
            newCourse.weeks.append(wk)
            modelContext.insert(wk)
        }

        modelContext.insert(newCourse)
        try? modelContext.save()
        isJoining = false
        presentationMode.wrappedValue.dismiss()
    }
}
