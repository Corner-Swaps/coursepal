import SwiftUI
import SwiftData

public struct ShareCenterView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Course.createdAt, order: .reverse) private var courses: [Course]

    @State private var inputCode: String = ""
    @State private var noticeMessage: String? = nil
    @State private var isSuccessNotice: Bool = true
    @State private var copiedCode: String? = nil
    @State private var selectedInviteCategory: String = "share" // "share" or "join"
    @State private var foundCourseForPopup: Course? = nil
    @State private var showingInfoSheet: Bool = false

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 16) {

                    // MARK: - Header (Invite - Matching Syllabus Header 1:1)
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Invite")
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("Share your courses or join someone else's")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 18)

                    // Toast notice
                    if let notice = noticeMessage {
                        HStack {
                            Image(systemName: isSuccessNotice ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                                .foregroundColor(isSuccessNotice ? .green : .orange)
                            Text(notice)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(isSuccessNotice ? Color.green.opacity(0.12) : Color.orange.opacity(0.12))
                        .cornerRadius(12)
                        .padding(.horizontal, 18)
                        .transition(.opacity)
                    }

                    // MARK: - Category Filter Bar (Share Codes First, Join Course Second - Matching Syllabus View 1:1)
                    HStack(spacing: 10) {
                        SortTabTile(
                            title: "Share Codes (\(courses.count))",
                            icon: "qrcode",
                            iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                            isSelected: selectedInviteCategory == "share"
                        ) {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                selectedInviteCategory = "share"
                            }
                        }

                        SortTabTile(
                            title: "Join Course",
                            icon: "square.and.arrow.down.fill",
                            iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                            isSelected: selectedInviteCategory == "join"
                        ) {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                selectedInviteCategory = "join"
                            }
                        }
                    }
                    .padding(6)
                    .background(Color.white)
                    .cornerRadius(18)
                    .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
                    .padding(.horizontal, 18)

                    if selectedInviteCategory == "share" {
                        // MARK: - YOUR COURSE CODES (Header title deleted per user request)
                        VStack(alignment: .leading, spacing: 14) {

                            if courses.isEmpty {
                                HStack(spacing: 10) {
                                    Image(systemName: "tray")
                                        .font(.system(size: 18))
                                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                    Text("Upload a syllabus to get started — your course codes will appear here.")
                                        .font(.system(size: 13))
                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                }
                                .padding(18)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.white)
                                .cornerRadius(16)
                                .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
                            } else {
                                VStack(alignment: .leading, spacing: 10) {
                                    ForEach(courses) { course in
                                        let codeColor = CourseColorHelper.color(for: course.hexColor)
                                        HStack(spacing: 10) {
                                            // Left Accent Color Line (Matching Syllabus Card height 42 1:1)
                                            RoundedRectangle(cornerRadius: 3)
                                                .fill(codeColor)
                                                .frame(width: 4, height: 36)

                                            VStack(alignment: .leading, spacing: 3) {
                                                Text(course.courseCode ?? course.courseName)
                                                    .font(.system(size: 15, weight: .bold, design: .rounded))
                                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                                    .lineLimit(1)
                                                Text(course.courseName)
                                                    .font(.system(size: 10.5, weight: .semibold, design: .rounded))
                                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                                    .lineLimit(1)
                                            }

                                            Spacer(minLength: 4)

                                            // Sharing code pill + copy + native share button (Matching pill styling & heights)
                                            HStack(spacing: 6) {
                                                HStack(spacing: 5) {
                                                    Text(course.sharingCode.isEmpty ? "—" : course.sharingCode)
                                                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                                                        .foregroundColor(codeColor)

                                                    Button(action: {
                                                        #if canImport(UIKit)
                                                        UIPasteboard.general.string = course.sharingCode
                                                        #endif
                                                        withAnimation { copiedCode = course.sharingCode }
                                                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
                                                            withAnimation { copiedCode = nil }
                                                        }
                                                    }) {
                                                        let isCopied = (copiedCode == course.sharingCode)
                                                        Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
                                                            .font(.system(size: 11.5, weight: .bold))
                                                            .foregroundColor(isCopied ? .green : codeColor)
                                                    }
                                                    .buttonStyle(.plain)
                                                }
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 6)
                                                .background(codeColor.opacity(0.10))
                                                .cornerRadius(8)

                                                Button(action: {
                                                    let code = course.sharingCode.isEmpty ? (course.courseCode ?? "CRS") : course.sharingCode
                                                    let shareMsg = "Join my course '\(course.courseName)' on CoursePal!\n\nCourse Code: \(code)\nTap to Join: https://classpal.app/join?code=\(code)"
                                                    #if canImport(UIKit)
                                                    let avc = UIActivityViewController(activityItems: [shareMsg], applicationActivities: nil)
                                                    if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                                                       let root = scene.windows.first?.rootViewController {
                                                        root.present(avc, animated: true)
                                                    }
                                                    #endif
                                                }) {
                                                    Image(systemName: "square.and.arrow.up")
                                                        .font(.system(size: 12, weight: .bold))
                                                        .foregroundColor(codeColor)
                                                        .padding(.horizontal, 8)
                                                        .padding(.vertical, 6)
                                                        .background(codeColor.opacity(0.12))
                                                        .cornerRadius(8)
                                                }
                                                .buttonStyle(.plain)
                                            }
                                        }
                                        .padding(14)
                                        .background(Color.white)
                                        .cornerRadius(16)
                                        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 18)
                    } else if selectedInviteCategory == "join" {
                        // MARK: - JOIN WITH A CODE OR LINK
                        VStack(alignment: .leading, spacing: 14) {
                            HStack(spacing: 8) {
                                Image(systemName: "square.and.arrow.down.fill")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(Color(red: 0.55, green: 0.27, blue: 0.96))
                                Text("JOIN A COURSE")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }
                            .padding(.leading, 4)

                            VStack(alignment: .leading, spacing: 14) {
                                Text("Got a code or link from a classmate?")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                                Text("Paste the link or enter the course code shared with you. CoursePal will load their course schedule, readings, and assignments.")
                                    .font(.system(size: 14, weight: .medium, design: .rounded))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                    .fixedSize(horizontal: false, vertical: true)

                                VStack(spacing: 12) {
                                    HStack {
                                        Image(systemName: "key.fill")
                                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                                        TextField("Enter course code or paste link...", text: $inputCode)
                                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                                            .autocorrectionDisabled()
                                            #if os(iOS)
                                            .textInputAutocapitalization(.never)
                                            #endif
                                    }
                                    .padding(14)
                                    .background(Color(red: 0.95, green: 0.96, blue: 0.98))
                                    .cornerRadius(12)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color(red: 0.88, green: 0.90, blue: 0.94), lineWidth: 1)
                                    )

                                    Button(action: { importSharedCourse() }) {
                                        HStack(spacing: 6) {
                                            Image(systemName: "arrow.down.circle.fill")
                                                .font(.system(size: 15, weight: .bold))
                                            Text("Join Course")
                                                .font(.system(size: 14.5, weight: .bold, design: .rounded))
                                        }
                                        .foregroundColor(.white)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 14)
                                        .background(Color(red: 0.55, green: 0.27, blue: 0.96))
                                        .cornerRadius(12)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(16)
                            .background(Color.white)
                            .cornerRadius(16)
                            .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
                        }
                        .padding(.horizontal, 18)
                    }

                    // MARK: - About & Legal Card
                    VStack(alignment: .leading, spacing: 10) {
                        Button(action: { showingInfoSheet = true }) {
                            HStack(spacing: 12) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 10)
                                        .fill(Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.12))
                                        .frame(width: 36, height: 36)
                                    Image(systemName: "shield.lefthalf.filled")
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                                }

                                VStack(alignment: .leading, spacing: 2) {
                                    Text("About & Legal")
                                        .font(.system(size: 14, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                    Text("Privacy policy, terms of service & support")
                                        .font(.system(size: 11.5, weight: .medium))
                                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                                }

                                Spacer()

                                Image(systemName: "chevron.right")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }
                            .padding(14)
                            .background(Color.white)
                            .cornerRadius(16)
                            .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 18)

                    Spacer(minLength: 120)
                }
            }
            .background(Color(red: 0.95, green: 0.96, blue: 0.98))
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .sheet(isPresented: $showingInfoSheet) {
                InfoCreditsSheetView()
            }
        }
        .dismissKeyboardOnTap()
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("CoursePalOpenJoinCode"))) { notif in
            if let codeStr = notif.object as? String, !codeStr.isEmpty {
                inputCode = codeStr
                importSharedCourse()
            }
        }
        .sheet(item: $foundCourseForPopup) { course in
            NavigationStack {
                VStack(spacing: 20) {
                    ZStack {
                        Circle()
                            .fill(Color(red: 0.06, green: 0.73, blue: 0.50).opacity(0.12))
                            .frame(width: 72, height: 72)
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 38))
                            .foregroundColor(Color(red: 0.06, green: 0.73, blue: 0.50))
                    }
                    .padding(.top, 10)

                    VStack(spacing: 6) {
                        Text("Course Found!")
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                        Text(course.courseName)
                            .font(.system(size: 17, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))

                        Text("Code: \(course.courseCode ?? "CRS") • Share Code: \(course.sharingCode)")
                            .font(.system(size: 13, weight: .semibold, design: .monospaced))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                    }

                    VStack(spacing: 10) {
                        HStack {
                            Text("Duration")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Spacer()
                            Text("\(course.termWeeks) Weeks")
                                .font(.subheadline)
                                .bold()
                        }
                        Divider()
                        HStack {
                            Text("Materials / Readings")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Spacer()
                            let totalReadings = course.weeks.reduce(0) { $0 + $1.readings.count }
                            Text("\(totalReadings) Items")
                                .font(.subheadline)
                                .bold()
                        }
                    }
                    .padding()
                    .background(Color(red: 0.96, green: 0.97, blue: 0.99))
                    .cornerRadius(14)

                    Button(action: {
                        foundCourseForPopup = nil
                        showNotice("Enrolled in \(course.courseName) successfully!", success: true)
                    }) {
                        HStack {
                            Image(systemName: "folder.badge.plus")
                            Text("Enroll & Open Course")
                                .font(.system(size: 15, weight: .bold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(red: 0.06, green: 0.73, blue: 0.50))
                        .foregroundColor(.white)
                        .cornerRadius(14)
                    }

                    Spacer()
                }
                .padding(24)
                .navigationTitle("Join Course Preview")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { foundCourseForPopup = nil }
                    }
                }
            }
        }
    }

    public static func extractCourseCode(from input: String) -> String {
        let raw = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return "" }

        // 1. URL with query parameter e.g. https://classpal.app/join?code=849204
        if raw.lowercased().contains("code=") {
            let components = raw.components(separatedBy: CharacterSet(charactersIn: "?&"))
            for comp in components {
                if comp.lowercased().hasPrefix("code=") {
                    let val = String(comp.dropFirst(5)).trimmingCharacters(in: .whitespacesAndNewlines)
                    if !val.isEmpty { return val.uppercased() }
                }
            }
        }

        // 2. URL path e.g. https://classpal.app/join/849204
        if raw.lowercased().contains("/join/") {
            let parts = raw.components(separatedBy: "/join/")
            if let last = parts.last {
                let cleanSegment = last.components(separatedBy: CharacterSet(charactersIn: "?&/#")).first ?? last
                let res = cleanSegment.trimmingCharacters(in: .whitespacesAndNewlines)
                if !res.isEmpty { return res.uppercased() }
            }
        }

        let clean = raw.replacingOccurrences(of: "https://", with: "", options: .caseInsensitive)
                       .replacingOccurrences(of: "http://", with: "", options: .caseInsensitive)
                       .replacingOccurrences(of: "classpal://", with: "", options: .caseInsensitive)
                       .trimmingCharacters(in: .whitespacesAndNewlines)
                       .uppercased()
        return clean
    }

    private func importSharedCourse() {
        let clean = Self.extractCourseCode(from: inputCode)
        let digitsOnly = clean.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()

        guard !clean.isEmpty else {
            showNotice("Please enter a valid course code or 6-digit share code.", success: false)
            return
        }

        let existingCourse = courses.first(where: {
            let scDigits = $0.sharingCode.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
            let ccDigits = ($0.courseCode ?? "").components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
            return ($0.courseCode?.uppercased() ?? "") == clean ||
                   $0.sharingCode.uppercased() == clean ||
                   (!digitsOnly.isEmpty && (scDigits == digitsOnly || ccDigits == digitsOnly))
        })

        let targetCourse: Course
        if let existing = existingCourse {
            targetCourse = existing
        } else {
            let newCourse = Course(
                courseName: "Shared Course (\(clean))",
                courseCode: clean,
                hexColor: "#7C3AED",
                termWeeks: 12,
                sharingCode: digitsOnly.isEmpty ? String(format: "%06d", Int.random(in: 100000...999999)) : digitsOnly
            )

            for w in 1...12 {
                let wk = Week(weekNumber: w, theme: "Week \(w) Schedule")
                wk.course = newCourse
                newCourse.weeks.append(wk)
            }

            modelContext.insert(newCourse)
            try? modelContext.save()
            targetCourse = newCourse
        }

        foundCourseForPopup = targetCourse
        inputCode = ""
    }

    private func showNotice(_ text: String, success: Bool) {
        withAnimation {
            isSuccessNotice = success
            noticeMessage = text
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            withAnimation { noticeMessage = nil }
        }
    }
}
