import SwiftUI

public struct InfoCreditsSheetView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var showingInAppLegal: Bool = false
    @State private var initialLegalTab: String = "terms"

    public init() {}

    private let privacyURL = URL(string: "https://corner-swaps.github.io/coursepal/support.html#privacy") ?? URL(string: "https://github.com/Corner-Swaps/coursepal")!
    private let termsURL = URL(string: "https://corner-swaps.github.io/coursepal/support.html#terms") ?? URL(string: "https://github.com/Corner-Swaps/coursepal")!
    private let supportWebURL = URL(string: "https://corner-swaps.github.io/coursepal/") ?? URL(string: "https://github.com/Corner-Swaps/coursepal")!
    private let supportEmailURL = URL(string: "mailto:goloubov@gmail.com")!

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 20) {
                    // App Logo & Header
                    VStack(spacing: 8) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 22)
                                .fill(LinearGradient(colors: [Color(red: 0.14, green: 0.44, blue: 0.96), Color(red: 0.10, green: 0.30, blue: 0.85)], startPoint: .topLeading, endPoint: .bottomTrailing))
                                .frame(width: 80, height: 80)
                                .shadow(color: Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.35), radius: 12, x: 0, y: 6)

                            Image(systemName: "graduationcap.fill")
                                .font(.system(size: 38, weight: .bold))
                                .foregroundColor(.white)
                        }
                        .padding(.top, 10)

                        Text("CoursePal")
                            .font(.system(size: 24, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                        Text("Version 1.0 (Build 3)")
                            .font(.system(size: 13, weight: .semibold, design: .monospaced))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))

                        Text("Intelligent Academic Planner & Syllabus Assistant")
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            .multilineTextAlignment(.center)
                    }
                    .padding(.horizontal, 20)

                    // Privacy & Trust Banner
                    HStack(spacing: 12) {
                        Image(systemName: "lock.shield.fill")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundColor(Color(red: 0.05, green: 0.65, blue: 0.40))

                        VStack(alignment: .leading, spacing: 2) {
                            Text("100% Local-First Privacy")
                                .font(.system(size: 13.5, weight: .bold, design: .rounded))
                                .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                            Text("No tracking, zero ads, and no selling of student data.")
                                .font(.system(size: 12, weight: .regular))
                                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                        }
                        Spacer()
                    }
                    .padding(14)
                    .background(Color(red: 0.05, green: 0.65, blue: 0.40).opacity(0.08))
                    .cornerRadius(14)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(Color(red: 0.05, green: 0.65, blue: 0.40).opacity(0.25), lineWidth: 1)
                    )
                    .padding(.horizontal, 20)

                    // Legal & Hosted Links Group
                    VStack(alignment: .leading, spacing: 10) {
                        Text("LEGAL & DOCUMENTATION")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                            .padding(.leading, 6)

                        VStack(spacing: 1) {
                            // Privacy Policy Link (Hosted)
                            Link(destination: privacyURL) {
                                InfoRow(
                                    icon: "hand.raised.fill",
                                    iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                                    title: "Privacy Policy",
                                    subtitle: "Read hosted privacy governance",
                                    isExternal: true
                                )
                            }
                            .buttonStyle(.plain)

                            Divider().padding(.leading, 52)

                            // Terms of Service Link (Hosted)
                            Link(destination: termsURL) {
                                InfoRow(
                                    icon: "doc.text.fill",
                                    iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                                    title: "Terms of Service",
                                    subtitle: "Academic disclaimer & conditions",
                                    isExternal: true
                                )
                            }
                            .buttonStyle(.plain)

                            Divider().padding(.leading, 52)

                            // In-App Legal Viewer Button
                            Button(action: {
                                initialLegalTab = "terms"
                                showingInAppLegal = true
                            }) {
                                InfoRow(
                                    icon: "newspaper.fill",
                                    iconColor: Color(red: 0.08, green: 0.70, blue: 0.55),
                                    title: "In-App Legal Viewer",
                                    subtitle: "Browse terms, privacy & release notes",
                                    isExternal: false
                                )
                            }
                            .buttonStyle(.plain)
                        }
                        .background(Color.white)
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                        )
                    }
                    .padding(.horizontal, 20)

                    // Support & Contact Group
                    VStack(alignment: .leading, spacing: 10) {
                        Text("SUPPORT & CREDITS")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                            .padding(.leading, 6)

                        VStack(spacing: 1) {
                            // Email Support
                            Link(destination: supportEmailURL) {
                                InfoRow(
                                    icon: "envelope.fill",
                                    iconColor: Color(red: 0.95, green: 0.55, blue: 0.10),
                                    title: "Contact Support",
                                    subtitle: "goloubov@gmail.com",
                                    isExternal: true
                                )
                            }
                            .buttonStyle(.plain)

                            Divider().padding(.leading, 52)

                            // Help & FAQ Web Page
                            Link(destination: supportWebURL) {
                                InfoRow(
                                    icon: "questionmark.circle.fill",
                                    iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                                    title: "User Guide & FAQ",
                                    subtitle: "Online documentation & guides",
                                    isExternal: true
                                )
                            }
                            .buttonStyle(.plain)

                            Divider().padding(.leading, 52)

                            // Source / Credits
                            Link(destination: URL(string: "https://github.com/Corner-Swaps/coursepal")!) {
                                InfoRow(
                                    icon: "sparkles",
                                    iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                                    title: "CoursePal Project",
                                    subtitle: "GitHub Open Repository",
                                    isExternal: true
                                )
                            }
                            .buttonStyle(.plain)
                        }
                        .background(Color.white)
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                        )
                    }
                    .padding(.horizontal, 20)

                    // Footer
                    VStack(spacing: 4) {
                        Text("CoursePal is built for students, educators & lifelong learners.")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                            .multilineTextAlignment(.center)

                        Text("© 2026 CoursePal. All rights reserved.")
                            .font(.system(size: 11, weight: .regular))
                            .foregroundColor(Color(red: 0.55, green: 0.62, blue: 0.72))
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 4)
                    .padding(.bottom, 24)
                }
                .padding(.top, 12)
            }
            .background(Color(red: 0.95, green: 0.96, blue: 0.98))
            .navigationTitle("About CoursePal")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .bold()
                }
            }
            .sheet(isPresented: $showingInAppLegal) {
                LegalDocumentView(initialTab: initialLegalTab)
            }
        }
    }
}

private struct InfoRow: View {
    let icon: String
    let iconColor: Color
    let title: String
    let subtitle: String
    let isExternal: Bool

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(iconColor.opacity(0.12))
                    .frame(width: 36, height: 36)

                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(iconColor)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14.5, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                Text(subtitle)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
            }

            Spacer()

            Image(systemName: isExternal ? "arrow.up.forward.square" : "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Color(red: 0.55, green: 0.62, blue: 0.72))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}
