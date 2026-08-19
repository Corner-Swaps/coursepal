import SwiftUI

// MARK: - About & Legal Root Sheet
public struct InfoCreditsSheetView: View {
    @Environment(\.dismiss) private var dismiss

    // Dedicated sheet states for each item
    @State private var showingTermsSheet: Bool = false
    @State private var showingPrivacySheet: Bool = false
    @State private var showingVersionSheet: Bool = false
    @State private var showingUserGuideFAQ: Bool = false

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 20) {
                    // App Logo & Header
                    VStack(spacing: 8) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 22)
                                .fill(
                                    LinearGradient(
                                        colors: [Color(red: 0.14, green: 0.44, blue: 0.96), Color(red: 0.10, green: 0.30, blue: 0.85)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
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

                        Text("Version 1.1")
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

                    // MARK: - Legal Review Section (3 Standalone Pills)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("LEGAL REVIEW")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                            .padding(.leading, 6)

                        VStack(spacing: 1) {
                            // Pill 1: Terms of Service
                            Button(action: {
                                showingTermsSheet = true
                            }) {
                                InfoRow(
                                    icon: "doc.text.fill",
                                    iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                                    title: "Terms of Service",
                                    subtitle: "Academic disclaimer & liability limitations",
                                    isExternal: false
                                )
                            }
                            .buttonStyle(.plain)

                            Divider().padding(.leading, 52)

                            // Pill 2: Privacy Policy
                            Button(action: {
                                showingPrivacySheet = true
                            }) {
                                InfoRow(
                                    icon: "hand.raised.fill",
                                    iconColor: Color(red: 0.06, green: 0.73, blue: 0.50),
                                    title: "Privacy Policy",
                                    subtitle: "On-device storage, zero tracking & data rights",
                                    isExternal: false
                                )
                            }
                            .buttonStyle(.plain)

                            Divider().padding(.leading, 52)

                            // Pill 3: Version 1.1
                            Button(action: {
                                showingVersionSheet = true
                            }) {
                                InfoRow(
                                    icon: "sparkles",
                                    iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                                    title: "Version 1.1",
                                    subtitle: "Release highlights & system capabilities",
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

                    // MARK: - Help & Guides Section
                    VStack(alignment: .leading, spacing: 10) {
                        Text("HELP & GUIDES")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                            .padding(.leading, 6)

                        VStack(spacing: 1) {
                            Button(action: {
                                showingUserGuideFAQ = true
                            }) {
                                InfoRow(
                                    icon: "questionmark.circle.fill",
                                    iconColor: Color(red: 0.95, green: 0.55, blue: 0.10),
                                    title: "User Guide & FAQ",
                                    subtitle: "Step-by-step guidance & common questions",
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

                    // MARK: - Contact Support Section (No links, plain email)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("CONTACT SUPPORT")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                            .padding(.leading, 6)

                        HStack(spacing: 14) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(Color(red: 0.35, green: 0.42, blue: 0.52).opacity(0.12))
                                    .frame(width: 36, height: 36)

                                Image(systemName: "envelope.fill")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Email Support")
                                    .font(.system(size: 14.5, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                                Text("goloubov@gmail.com")
                                    .font(.system(size: 13, weight: .medium, design: .monospaced))
                                    .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.52))
                            }

                            Spacer()
                        }
                        .padding(14)
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
            // Standalone Dedicated Sheet Modals
            .sheet(isPresented: $showingTermsSheet) {
                TermsOfServiceSheetView()
            }
            .sheet(isPresented: $showingPrivacySheet) {
                PrivacyPolicySheetView()
            }
            .sheet(isPresented: $showingVersionSheet) {
                VersionReleaseSheetView()
            }
            .sheet(isPresented: $showingUserGuideFAQ) {
                UserGuideFAQSheetView()
            }
        }
    }
}

// MARK: - Standalone Page 1: Terms of Service
public struct TermsOfServiceSheetView: View {
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: true) {
                VStack(alignment: .leading, spacing: 16) {
                    Group {
                        Text("Terms of Service & Academic Disclaimer")
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                        Text("Last Updated: August 2026 • Please read carefully before using CoursePal.")
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))

                        Divider()
                    }

                    // Section 1: Academic Disclaimer
                    LegalSectionCard(
                        icon: "exclamationmark.triangle.fill",
                        iconColor: .orange,
                        title: "1. ACADEMIC DISCLAIMER & VERIFICATION DUTY",
                        bodyText: """
                        CoursePal is an auxiliary academic organizational aid.

                        CRITICAL NOTICE:
                        • The official syllabus provided by your institution, official instructor announcements, and your school's Learning Management System (Canvas, Blackboard, Brightspace, Moodle) remain the sole authoritative and binding sources for all course deadlines, exam dates, syllabus requirements, and grading policies.
                        • You are solely responsible for verifying all dates, times, assignment specs, and milestone schedules generated or imported by CoursePal against your official course syllabus.
                        • Optical character recognition (OCR) and artificial intelligence (AI) parsing may occasionally misread or misinterpret text due to document scan quality, complex table layouts, or instructor revisions. CoursePal makes no warranty of 100% automated parsing precision.
                        """
                    )

                    // Section 2: Limitation of Liability
                    LegalSectionCard(
                        icon: "shield.slash.fill",
                        iconColor: .red,
                        title: "2. LIMITATION OF LIABILITY & WAIVER OF CLAIMS",
                        bodyText: """
                        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
                        • In no event shall CoursePal, its developers, or affiliates be liable for any direct, indirect, incidental, consequential, or exemplary damages arising from your use of the app.
                        • This includes, without limitation, missed exams, missed assignment deadlines, late submission penalties, grade reductions, academic probation, loss of scholarships, or any other academic or professional consequences.
                        • Your sole remedy for dissatisfaction with the application is to stop using and uninstall CoursePal.
                        """
                    )

                    // Section 3: AS-IS Warranty Disclaimer
                    LegalSectionCard(
                        icon: "wrench.and.screwdriver.fill",
                        iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                        title: "3. AS-IS & AS-AVAILABLE DISCLAIMER",
                        bodyText: """
                        CoursePal is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express, statutory, or implied, including the implied warranties of merchantability, fitness for a particular academic purpose, non-infringement, and error-free operation.
                        """
                    )

                    // Section 4: Fair Use & Intellectual Property
                    LegalSectionCard(
                        icon: "book.fill",
                        iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                        title: "4. INTELLECTUAL PROPERTY & FAIR USE",
                        bodyText: """
                        CoursePal is designed solely for your personal, non-commercial academic study and organization. Uploading course documents for personal schedule organization constitutes Fair Dealing under Canadian copyright law and Fair Use under U.S. copyright law (17 U.S.C. § 107).
                        """
                    )

                    // Section 5: Governing Law
                    LegalSectionCard(
                        icon: "building.columns.fill",
                        iconColor: Color(red: 0.35, green: 0.42, blue: 0.52),
                        title: "5. GOVERNING LAW & JURISDICTION",
                        bodyText: """
                        These Terms are governed by and construed in accordance with the laws of the Province of British Columbia and the federal laws of Canada applicable therein, without giving effect to any principles of conflicts of law.
                        """
                    )
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .background(Color.white)
            .navigationTitle("Terms of Service")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                }
            }
        }
    }
}

// MARK: - Standalone Page 2: Privacy Policy
public struct PrivacyPolicySheetView: View {
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: true) {
                VStack(alignment: .leading, spacing: 16) {
                    Group {
                        Text("Privacy Policy & Data Governance")
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                        Text("Last Updated: August 2026 • Compliant with BC PIPA, PIPEDA, CCPA/CPRA & GDPR")
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))

                        Divider()
                    }

                    // Privacy Section 1: Local-First Storage
                    LegalSectionCard(
                        icon: "internaldrive.fill",
                        iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                        title: "1. LOCAL-FIRST ON-DEVICE STORAGE",
                        bodyText: """
                        CoursePal operates on a strict Local-First Privacy Model. Your uploaded syllabi, reading items, point allocations, and homework notes are stored directly on your personal device within Apple's hardware-encrypted application sandbox using SwiftData. We do not store or mirror your private student records on remote backend servers.
                        """
                    )

                    // Privacy Section 2: AI Processing & Zero Training
                    LegalSectionCard(
                        icon: "cpu.fill",
                        iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                        title: "2. AI PROCESSING & ZERO MODEL TRAINING",
                        bodyText: """
                        When you choose to parse a syllabus document:
                        • Transient Transmission: Document text or images are transmitted securely via encrypted HTTPS (TLS 1.3) solely for real-time extraction into structured schedule data.
                        • Zero Model Training: Your private course syllabi, documents, and student schedules are NEVER retained or used to train public or foundation AI models.
                        • Voluntary: Automated AI parsing is completely optional. You can enter and manage all courses manually offline at any time.
                        """
                    )

                    // Privacy Section 3: Zero Data Monetization
                    LegalSectionCard(
                        icon: "hand.raised.fill",
                        iconColor: Color(red: 0.06, green: 0.73, blue: 0.50),
                        title: "3. ZERO DATA SELLING & NO TRACKING",
                        bodyText: """
                        CoursePal maintains a strict zero-data-monetization policy:
                        • We do not sell, rent, license, or disclose your personal data to data brokers or third parties.
                        • We do not embed third-party advertising SDKs, behavioural trackers, or tracking cookies.
                        """
                    )

                    // Privacy Section 4: Right to Erasure
                    LegalSectionCard(
                        icon: "trash.fill",
                        iconColor: .red,
                        title: "4. RIGHT TO ERASURE & DATA PURGE",
                        bodyText: """
                        You retain full ownership of your data under GDPR, CCPA, and Canadian privacy law.
                        • Deleting any course, assignment, or syllabus permanently removes it from your local storage and cache.
                        • Deleting the application removes 100% of stored data instantly from your device.
                        """
                    )

                    // Privacy Section 5: Support Contact
                    LegalSectionCard(
                        icon: "envelope.fill",
                        iconColor: Color(red: 0.35, green: 0.42, blue: 0.52),
                        title: "5. PRIVACY INQUIRIES & CONTACT",
                        bodyText: """
                        For any privacy questions, data protection inquiries, or regulatory compliance requests, contact our team at support@coursepal.app or goloubov@gmail.com.
                        """
                    )
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .background(Color.white)
            .navigationTitle("Privacy Policy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                }
            }
        }
    }
}

// MARK: - Standalone Page 3: Version 1.0 (Build 3) Release Details
public struct VersionReleaseSheetView: View {
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: true) {
                VStack(alignment: .leading, spacing: 16) {
                    Group {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 0.55, green: 0.27, blue: 0.96).opacity(0.12))
                                    .frame(width: 44, height: 44)
                                Image(systemName: "sparkles")
                                    .font(.system(size: 22, weight: .bold))
                                    .foregroundColor(Color(red: 0.55, green: 0.27, blue: 0.96))
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text("CoursePal v1.1")
                                    .font(.system(size: 20, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                                Text("Official Production Release • August 2026")
                                    .font(.system(size: 11.5, weight: .medium))
                                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                            }
                        }

                        Divider()
                    }

                    // Feature 1: Syllabus AI
                    LegalSectionCard(
                        icon: "doc.text.viewfinder",
                        iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                        title: "1. SMART SYLLABUS OCR & AI EXTRACTION",
                        bodyText: """
                        • Hybrid Extraction Engine: Converts PDF syllabi, scanned handouts, and course outlines directly into structured weekly agendas.
                        • Detailed Metadata Extraction: Automatically identifies weekly reading chapters, page ranges, assignment point weights, rubrics, and professor contact details.
                        • Background Processing: Uploads continue processing uninterrupted even if you switch apps or lock your device.
                        """
                    )

                    // Feature 2: Apple Ecosystem
                    LegalSectionCard(
                        icon: "calendar.badge.clock",
                        iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                        title: "2. APPLE CALENDAR & REMINDERS SYNC",
                        bodyText: """
                        • Two-Way Timeline Export: Export assignment milestones and exam schedules directly to your native iOS Calendar.
                        • Automated Due Date Notifications: Custom local reminders before upcoming academic deliverables.
                        """
                    )

                    // Feature 3: Sharing
                    LegalSectionCard(
                        icon: "qrcode",
                        iconColor: Color(red: 0.95, green: 0.55, blue: 0.10),
                        title: "3. PEER SCHEDULE SHARING",
                        bodyText: """
                        • 6-Digit Sync Codes: Share semester readings and assignment breakdowns with classmates in one tap.
                        • Instant Schedule Import: Import shared courses without needing to re-scan or upload syllabus files.
                        """
                    )

                    // Feature 4: Security
                    LegalSectionCard(
                        icon: "lock.shield.fill",
                        iconColor: Color(red: 0.06, green: 0.73, blue: 0.50),
                        title: "4. LOCAL SANDBOX SECURITY",
                        bodyText: """
                        • 100% On-Device Persistence: Built on SwiftData and local file sandboxing.
                        • Zero Ads & Zero Data Selling: No trackers, analytics telemetry, or commercial monetization of student records.
                        """
                    )

                    // Feature 5: Support
                    LegalSectionCard(
                        icon: "envelope.fill",
                        iconColor: Color(red: 0.35, green: 0.42, blue: 0.52),
                        title: "5. DEVELOPER & SUPPORT CONTACT",
                        bodyText: """
                        Have questions, feature requests, or need help? Contact us anytime at support@coursepal.app or goloubov@gmail.com.
                        """
                    )
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .background(Color.white)
            .navigationTitle("Release Notes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                }
            }
        }
    }
}

// MARK: - Reusable Legal Section Card
private struct LegalSectionCard: View {
    let icon: String
    let iconColor: Color
    let title: String
    let bodyText: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(iconColor)
                Text(title)
                    .font(.system(size: 12.5, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
            }

            Text(bodyText)
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(Color(red: 0.25, green: 0.32, blue: 0.42))
                .lineSpacing(3)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.98, green: 0.98, blue: 0.99))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(red: 0.90, green: 0.92, blue: 0.95), lineWidth: 1)
        )
    }
}

// MARK: - Standalone Page 4: User Guide & FAQ
public struct UserGuideFAQSheetView: View {
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: true) {
                VStack(alignment: .leading, spacing: 18) {
                    // Header
                    VStack(alignment: .leading, spacing: 4) {
                        Text("User Guide & FAQ")
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                        Text("Everything you need to know about using CoursePal.")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                    }
                    .padding(.top, 4)

                    Divider()

                    // FAQ Item 1: Syllabus Upload
                    FAQCard(
                        icon: "doc.text.viewfinder",
                        iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                        question: "How does Syllabus Upload & AI Parsing work?",
                        answer: "You can upload syllabus PDF files, scanned documents, or photos. CoursePal uses Apple Vision OCR and Google Gemini AI to automatically parse weekly schedules, reading chapters, homework deadlines, point weights, and exams into an organized planner."
                    )

                    // FAQ Item 2: Apple Calendar Sync
                    FAQCard(
                        icon: "calendar.badge.clock",
                        iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                        question: "How do I sync assignments to Apple Calendar?",
                        answer: "Open any course or assignment and tap the Calendar export action. You can grant calendar permissions to automatically add due dates, exam milestones, and alert notifications to your native iOS Calendar."
                    )

                    // FAQ Item 3: Share & Join Codes
                    FAQCard(
                        icon: "qrcode",
                        iconColor: Color(red: 0.95, green: 0.55, blue: 0.10),
                        question: "How do I share course schedules with classmates?",
                        answer: "Go to the Invite tab to find your unique 6-digit sharing code for each course. Tap 'Share' to send a link or code to friends. Classmates can tap 'Join Course' and enter the code to import the full semester schedule instantly."
                    )

                    // FAQ Item 4: Data Privacy
                    FAQCard(
                        icon: "lock.shield.fill",
                        iconColor: Color(red: 0.06, green: 0.73, blue: 0.50),
                        question: "Where is my data stored?",
                        answer: "CoursePal is 100% Local-First. All your course schedules, notes, and readings are saved securely on your personal device using Apple's encrypted SwiftData sandbox. We never sell, track, or share student data."
                    )

                    // FAQ Item 5: Offline & Manual Entry
                    FAQCard(
                        icon: "pencil.and.list.clipboard",
                        iconColor: Color(red: 0.35, green: 0.42, blue: 0.52),
                        question: "Can I use CoursePal offline and edit manually?",
                        answer: "Yes! You can manually add new courses, weekly topics, readings, and assignments at any time without an internet connection. All edits sync seamlessly locally."
                    )
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .background(Color.white)
            .navigationTitle("User Guide & FAQ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                }
            }
        }
    }
}

// MARK: - Reusable FAQ Card
private struct FAQCard: View {
    let icon: String
    let iconColor: Color
    let question: String
    let answer: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(iconColor.opacity(0.12))
                        .frame(width: 30, height: 30)

                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(iconColor)
                }

                Text(question)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text(answer)
                .font(.system(size: 12.5, weight: .regular))
                .foregroundColor(Color(red: 0.30, green: 0.38, blue: 0.48))
                .lineSpacing(3)
                .padding(.leading, 40)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.98, green: 0.98, blue: 0.99))
        .cornerRadius(14)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color(red: 0.90, green: 0.92, blue: 0.95), lineWidth: 1)
        )
    }
}

// MARK: - Reusable Info Row Pill
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
                    .foregroundColor(Color(red: 0.42, green: 0.48, blue: 0.58))
            }

            Spacer()

            Image(systemName: isExternal ? "arrow.up.right" : "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color(red: 0.65, green: 0.70, blue: 0.78))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}
