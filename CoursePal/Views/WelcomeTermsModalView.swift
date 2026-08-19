import SwiftUI

public struct WelcomeTermsModalView: View {
    @AppStorage("hasAcceptedTerms_v1") private var hasAcceptedTerms: Bool = false
    @State private var showingLegalSheet: Bool = false
    @State private var selectedLegalTab: String = "terms"
    
    // Feature Detail Modal State
    @State private var selectedFeatureDetail: FeatureDetailItem? = nil

    public init() {}

    public var body: some View {
        ZStack {
            // Dimmed & Blurred Backdrop
            Color.black.opacity(0.45)
                .ignoresSafeArea()

            // Centered Modal Card
            VStack(spacing: 14) {
                // App Logo Badge
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color(red: 0.23, green: 0.51, blue: 0.96), Color(red: 0.11, green: 0.32, blue: 0.86)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 62, height: 62)
                        .shadow(color: Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.35), radius: 10, x: 0, y: 5)

                    Image(systemName: "graduationcap.fill")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.white)
                }
                .padding(.top, 2)

                // Title & Subtitle
                VStack(spacing: 3) {
                    Text("Welcome to CoursePal")
                        .font(.system(size: 21, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                    Text("Your smart syllabus & course schedule companion")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 10)
                }

                // Core 4 Interactive Pills
                VStack(spacing: 8) {
                    // Pill 1: Smart Syllabus Parser
                    FeatureCardButton(
                        item: FeatureDetailItem(
                            icon: "doc.text.viewfinder",
                            iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                            title: "Smart Syllabus Parser",
                            shortDescription: "Auto-extract readings, deadlines & exams from PDF",
                            fullDescription: "Upload or scan any course syllabus PDF or image. CoursePal automatically analyzes the document using OCR and Google Gemini AI to identify weekly readings, assignments, point weights, and exam schedules."
                        ),
                        onTap: { item in
                            selectedFeatureDetail = item
                        }
                    )

                    // Pill 2: Apple Calendar Sync
                    FeatureCardButton(
                        item: FeatureDetailItem(
                            icon: "calendar.badge.clock",
                            iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                            title: "Apple Calendar Sync",
                            shortDescription: "Sync assignment due dates directly to iOS Calendar",
                            fullDescription: "Seamlessly export and synchronize all course milestones with your native iOS Calendar and Reminders. Never miss an assignment with automated timeline reminders."
                        ),
                        onTap: { item in
                            selectedFeatureDetail = item
                        }
                    )

                    // Pill 3: Private & Local-First
                    FeatureCardButton(
                        item: FeatureDetailItem(
                            icon: "lock.shield.fill",
                            iconColor: Color(red: 0.06, green: 0.73, blue: 0.50),
                            title: "Private & Local-First",
                            shortDescription: "100% on-device storage with zero data selling",
                            fullDescription: "Your academic documents and schedules are stored securely on your personal device in Apple's hardware-encrypted sandbox. Zero data tracking, zero ads, and zero selling of student data."
                        ),
                        onTap: { item in
                            selectedFeatureDetail = item
                        }
                    )

                    // Pill 4: Terms of Service, Privacy Policy & Version Info
                    Button(action: {
                        selectedLegalTab = "terms"
                        showingLegalSheet = true
                    }) {
                        HStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(Color(red: 0.35, green: 0.42, blue: 0.52).opacity(0.12))
                                    .frame(width: 36, height: 36)

                                Image(systemName: "doc.text.fill")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Terms of Service & Privacy Policy")
                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                                Text("By continuing you agree to our policies")
                                    .font(.system(size: 11, weight: .regular))
                                    .foregroundColor(Color(red: 0.42, green: 0.48, blue: 0.58))
                                    .lineLimit(1)
                            }

                            Spacer(minLength: 4)

                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(Color(red: 0.70, green: 0.75, blue: 0.82))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(red: 0.97, green: 0.98, blue: 0.99))
                        .cornerRadius(14)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(Color(red: 0.90, green: 0.92, blue: 0.96), lineWidth: 1)
                        )
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.vertical, 2)

                // Extra breathing room underneath the 4th pill before Agree & Continue
                Spacer().frame(height: 8)

                // Big Agree & Continue Button
                Button(action: {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        hasAcceptedTerms = true
                    }
                }) {
                    HStack(spacing: 8) {
                        Text("Agree & Continue")
                            .font(.system(size: 15.5, weight: .bold, design: .rounded))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 13, weight: .bold))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(
                        LinearGradient(
                            colors: [Color(red: 0.14, green: 0.44, blue: 0.96), Color(red: 0.09, green: 0.36, blue: 0.88)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .cornerRadius(14)
                    .shadow(color: Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.3), radius: 8, x: 0, y: 4)
                }
                .buttonStyle(.plain)
                .padding(.bottom, 2)
            }
            .padding(20)
            .background(Color.white)
            .cornerRadius(24)
            .shadow(color: Color.black.opacity(0.18), radius: 24, x: 0, y: 10)
            .padding(.horizontal, 22)
            .sheet(isPresented: $showingLegalSheet) {
                LegalDocumentView(initialTab: selectedLegalTab)
            }
            .sheet(item: $selectedFeatureDetail) { detail in
                FeatureDetailSheet(item: detail)
            }
        }
    }
}

// MARK: - Feature Detail Item
public struct FeatureDetailItem: Identifiable {
    public var id: String { title }
    public let icon: String
    public let iconColor: Color
    public let title: String
    public let shortDescription: String
    public let fullDescription: String
}

// MARK: - Feature Card Button (Clickable Row)
private struct FeatureCardButton: View {
    let item: FeatureDetailItem
    let onTap: (FeatureDetailItem) -> Void

    var body: some View {
        Button(action: {
            onTap(item)
        }) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(item.iconColor.opacity(0.12))
                        .frame(width: 36, height: 36)

                    Image(systemName: item.icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(item.iconColor)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                    Text(item.shortDescription)
                        .font(.system(size: 11, weight: .regular))
                        .foregroundColor(Color(red: 0.42, green: 0.48, blue: 0.58))
                        .lineLimit(1)
                }

                Spacer(minLength: 4)

                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Color(red: 0.70, green: 0.75, blue: 0.82))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(red: 0.97, green: 0.98, blue: 0.99))
            .cornerRadius(14)
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color(red: 0.90, green: 0.92, blue: 0.96), lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Feature Detail Sheet Modal
private struct FeatureDetailSheet: View {
    let item: FeatureDetailItem
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                ZStack {
                    Circle()
                        .fill(item.iconColor.opacity(0.15))
                        .frame(width: 80, height: 80)

                    Image(systemName: item.icon)
                        .font(.system(size: 36, weight: .bold))
                        .foregroundColor(item.iconColor)
                }

                VStack(spacing: 8) {
                    Text(item.title)
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                    Text(item.fullDescription)
                        .font(.system(size: 14, weight: .regular))
                        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                        .padding(.horizontal, 24)
                }

                Spacer()

                Button(action: {
                    dismiss()
                }) {
                    Text("Got It")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(item.iconColor)
                        .cornerRadius(14)
                        .shadow(color: item.iconColor.opacity(0.3), radius: 8, x: 0, y: 4)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                }
            }
        }
        .presentationDetents([.medium])
    }
}
