import SwiftUI

public struct LegalDocumentView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab: String = "terms" // "terms", "privacy", or "version"

    public init(initialTab: String = "terms") {
        self._selectedTab = State(initialValue: initialTab)
    }

    private var navigationTitleText: String {
        switch selectedTab {
        case "terms": return "Terms of Service"
        case "privacy": return "Privacy Policy"
        case "version": return "Version 1.0 (Build 3)"
        default: return "Terms of Service"
        }
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Segmented Picker with 3 tabs
                Picker("Document", selection: $selectedTab) {
                    Text("Terms").tag("terms")
                    Text("Privacy").tag("privacy")
                    Text("Version 1.0").tag("version")
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color(red: 0.96, green: 0.97, blue: 0.99))

                Divider()

                ScrollView(.vertical, showsIndicators: true) {
                    VStack(alignment: .leading, spacing: 18) {
                        switch selectedTab {
                        case "terms":
                            termsOfServiceContent
                        case "privacy":
                            privacyPolicyContent
                        case "version":
                            versionReleaseContent
                        default:
                            termsOfServiceContent
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 16)
                }
                .background(Color.white)
            }
            .navigationTitle(navigationTitleText)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(Color(red: 0.14, green: 0.44, blue: 0.96))
                }
            }
        }
    }

    // MARK: - Terms of Service Content
    private var termsOfServiceContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Group {
                Text("Terms of Service & Academic Disclaimer")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                Text("Last Updated: August 2026 • Please read carefully before using CoursePal.")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))

                Divider()
            }

            // Section 1: Academic Disclaimer
            LegalCard(
                icon: "exclamationmark.triangle.fill",
                iconColor: .orange,
                title: "1. ACADEMIC DISCLAIMER & VERIFICATION DUTY",
                bodyText: """
                CoursePal is an auxiliary organizational aid.

                CRITICAL NOTICE:
                • The official syllabus provided by your institution, official instructor announcements, and your school's Learning Management System (Canvas, Blackboard, Brightspace, Moodle) remain the sole authoritative and binding sources for all course deadlines, exam dates, and grading policies.
                • You are solely responsible for cross-verifying all dates, times, assignment specs, and milestone schedules generated or imported by CoursePal against your official syllabus.
                • Optical character recognition (OCR) and artificial intelligence (AI) parsing may occasionally misread or misinterpret text due to document scan quality, complex layouts, or instructor revisions. CoursePal makes no warranty of 100% automated parsing precision.
                """
            )

            // Section 2: Limitation of Liability
            LegalCard(
                icon: "shield.slash.fill",
                iconColor: .red,
                title: "2. LIMITATION OF LIABILITY & WAIVER OF CLAIMS",
                bodyText: """
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
                • In no event shall CoursePal, its developers, or affiliates be liable for any direct, indirect, incidental, consequential, or exemplary damages arising from your use of the app.
                • This includes, without limitation, missed exams, missed assignment deadlines, late submission penalties, grade reductions, academic probation, or any other academic or professional consequences.
                • Your sole remedy for dissatisfaction with the application is to stop using and uninstall CoursePal.
                """
            )

            // Section 3: AS-IS Warranty Disclaimer
            LegalCard(
                icon: "wrench.and.screwdriver.fill",
                iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                title: "3. AS-IS & AS-AVAILABLE DISCLAIMER",
                bodyText: """
                CoursePal is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express, statutory, or implied, including the implied warranties of merchantability, fitness for a particular academic purpose, and error-free operation.
                """
            )

            // Section 4: Fair Use
            LegalCard(
                icon: "book.fill",
                iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                title: "4. INTELLECTUAL PROPERTY & FAIR USE",
                bodyText: """
                CoursePal is designed solely for your personal, non-commercial academic study and organization. Uploading course documents for personal schedule organization constitutes Fair Dealing under Canadian copyright law and Fair Use under U.S. copyright law (17 U.S.C. § 107).
                """
            )

            // Section 5: Governing Law
            LegalCard(
                icon: "building.columns.fill",
                iconColor: Color(red: 0.35, green: 0.42, blue: 0.52),
                title: "5. GOVERNING LAW",
                bodyText: """
                These Terms are governed by and construed in accordance with the laws of the Province of British Columbia and the federal laws of Canada applicable therein.
                """
            )
        }
    }

    // MARK: - Privacy Policy Content
    private var privacyPolicyContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Group {
                Text("Privacy Policy & Data Governance")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))

                Text("Last Updated: August 2026 • Compliant with BC PIPA, PIPEDA, CCPA/CPRA & GDPR")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))

                Divider()
            }

            // Privacy Section 1: Local-First
            LegalCard(
                icon: "internaldrive.fill",
                iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                title: "1. LOCAL-FIRST ON-DEVICE STORAGE",
                bodyText: """
                CoursePal operates on a Local-First Privacy Model. Your syllabus files, reading schedules, point breakdowns, and homework items are saved directly on your personal device within Apple's hardware-encrypted application sandbox using SwiftData. We do not operate a central server database storing your private student records.
                """
            )

            // Privacy Section 2: AI Processing
            LegalCard(
                icon: "cpu.fill",
                iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                title: "2. AI PROCESSING & ZERO MODEL TRAINING",
                bodyText: """
                When you choose to parse a syllabus document:
                • Transient Transmission: Document text or images are transmitted securely via encrypted HTTPS (TLS 1.3) solely for real-time extraction into structured calendar items.
                • Zero Model Training: Your private course syllabi, documents, and student schedules are NEVER used to train public or foundation AI models.
                • Voluntary: Automated AI parsing is completely optional. You can enter and manage all courses manually offline at any time.
                """
            )

            // Privacy Section 3: Zero Data Selling
            LegalCard(
                icon: "hand.raised.fill",
                iconColor: .green,
                title: "3. ZERO DATA SELLING & NO TRACKING",
                bodyText: """
                CoursePal maintains a strict zero-data-monetization policy:
                • We do not sell, rent, license, or disclose your personal data to data brokers or third parties.
                • We do not use third-party advertising SDKs or web tracking cookies.
                """
            )

            // Privacy Section 4: Right to Erasure
            LegalCard(
                icon: "trash.fill",
                iconColor: .red,
                title: "4. RIGHT TO ERASURE & DATA PURGE",
                bodyText: """
                You have full ownership of your data under GDPR, CCPA, and Canadian privacy law.
                • Deleting any course, assignment, or syllabus permanently removes it from your local storage and cache.
                • Deleting the application removes 100% of stored data instantly from your device.
                """
            )

            // Privacy Section 5: Support Contact
            LegalCard(
                icon: "envelope.fill",
                iconColor: Color(red: 0.35, green: 0.42, blue: 0.52),
                title: "5. SUPPORT & CONTACT",
                bodyText: """
                For any privacy questions or data protection inquiries, contact our team at support@coursepal.app.
                """
            )
        }
    }

    // MARK: - Version 1.0 (Build 3) Release Content
    private var versionReleaseContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Group {
                HStack(spacing: 10) {
                    ZStack {
                        Circle()
                            .fill(Color(red: 0.55, green: 0.27, blue: 0.96).opacity(0.12))
                            .frame(width: 42, height: 42)
                        Image(systemName: "sparkles")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(Color(red: 0.55, green: 0.27, blue: 0.96))
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("CoursePal v1.0 (Build 3)")
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 0.08, green: 0.12, blue: 0.22))
                        Text("Official Production Release • August 2026")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Color(red: 0.45, green: 0.52, blue: 0.62))
                    }
                }

                Divider()
            }

            // Version Section 1: Core Innovations
            LegalCard(
                icon: "doc.text.viewfinder",
                iconColor: Color(red: 0.14, green: 0.44, blue: 0.96),
                title: "1. SMART SYLLABUS OCR & AI EXTRACTION",
                bodyText: """
                • Hybrid Extraction Engine: Converts PDF syllabi, scanned handouts, and course outlines directly into structured weekly agendas.
                • Detailed Metadata Extraction: Automatically identifies weekly reading chapters, page ranges, assignment point weights, rubrics, and professor contact details.
                • Background Processing: Uploads continue processing uninterrupted even if you switch apps or lock your device.
                """
            )

            // Version Section 2: Apple Ecosystem Integration
            LegalCard(
                icon: "calendar.badge.clock",
                iconColor: Color(red: 0.55, green: 0.27, blue: 0.96),
                title: "2. APPLE CALENDAR & REMINDERS SYNC",
                bodyText: """
                • Two-Way Timeline Export: Export assignment milestones and exam schedules directly to your native iOS Calendar.
                • Automated Due Date Notifications: Custom local reminders before upcoming academic deliverables.
                """
            )

            // Version Section 3: Peer Course Sharing
            LegalCard(
                icon: "qrcode",
                iconColor: Color(red: 0.95, green: 0.55, blue: 0.10),
                title: "3. PEER SCHEDULE SHARING",
                bodyText: """
                • 6-Digit Sync Codes: Share semester readings and assignment breakdowns with classmates in one tap.
                • Instant Schedule Import: Import shared courses without needing to re-scan or upload syllabus files.
                """
            )

            // Version Section 4: Privacy & Security
            LegalCard(
                icon: "lock.shield.fill",
                iconColor: Color(red: 0.06, green: 0.73, blue: 0.50),
                title: "4. LOCAL SANDBOX SECURITY",
                bodyText: """
                • 100% On-Device Persistence: Built on SwiftData and local file sandboxing.
                • Zero Ads & Zero Data Selling: No trackers, analytics telemetry, or commercial monetization of student records.
                """
            )

            // Version Section 5: Support & Contact
            LegalCard(
                icon: "envelope.fill",
                iconColor: Color(red: 0.35, green: 0.42, blue: 0.52),
                title: "5. DEVELOPER & SUPPORT CONTACT",
                bodyText: """
                Have questions, feature requests, or need help? Contact us anytime at support@coursepal.app.
                """
            )
        }
    }
}

// MARK: - Reusable Legal Card
private struct LegalCard: View {
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
