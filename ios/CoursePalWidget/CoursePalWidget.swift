import WidgetKit
import SwiftUI

// MARK: - Data Models matching TypeScript WidgetSnapshot
struct WidgetUpcomingItemData: Codable, Identifiable {
    let id: String
    let title: String
    let courseCode: String
    let hexColor: String
    let type: String
    let dueText: String
    let isCompleted: Bool
    let priorityScore: Double?
    let urgencyLevel: String?
    let dueCountdown: String?
    let deepLinkUrl: String?
}

struct CourseSummaryData: Codable {
    let courseCode: String
    let courseName: String
    let hexColor: String
    let completedCount: Int
    let totalCount: Int
    let percentage: Int
}

struct WidgetSnapshotData: Codable {
    let updatedAt: String?
    let termWeek: Int?
    let totalActiveItems: Int?
    let completedItemsCount: Int?
    let overallCompletionPct: Int?
    let pendingDeliverablesCount: Int?
    let smartGreeting: String?
    let upcomingItems: [WidgetUpcomingItemData]?
    let coursesSummary: [CourseSummaryData]?
}

// MARK: - Timeline Entry
struct CoursePalWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshotData?
}

// MARK: - Timeline Provider
struct CoursePalWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> CoursePalWidgetEntry {
        CoursePalWidgetEntry(date: Date(), snapshot: sampleSnapshot())
    }

    func getSnapshot(in context: Context, completion: @escaping (CoursePalWidgetEntry) -> Void) {
        let entry = CoursePalWidgetEntry(date: Date(), snapshot: loadSnapshotFromDisk() ?? sampleSnapshot())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CoursePalWidgetEntry>) -> Void) {
        let currentDate = Date()
        let snapshot = loadSnapshotFromDisk() ?? sampleSnapshot()
        let entry = CoursePalWidgetEntry(date: currentDate, snapshot: snapshot)

        // Refresh every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate) ?? currentDate.addingTimeInterval(900)
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadSnapshotFromDisk() -> WidgetSnapshotData? {
        let fileManager = FileManager.default

        // 1. Try Shared App Group Container
        if let containerURL = fileManager.containerURL(forSecurityApplicationGroupIdentifier: "group.com.coursepal.app") {
            let fileURL = containerURL.appendingPathComponent("CoursePal_WidgetSnapshot.json")
            if let data = try? Data(contentsOf: fileURL),
               let decoded = try? JSONDecoder().decode(WidgetSnapshotData.self, from: data) {
                return decoded
            }
        }

        // 2. Try App Documents Sandbox
        if let docsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first {
            let fileURL = docsURL.appendingPathComponent("CoursePal_WidgetSnapshot.json")
            if let data = try? Data(contentsOf: fileURL),
               let decoded = try? JSONDecoder().decode(WidgetSnapshotData.self, from: data) {
                return decoded
            }
        }

        return nil
    }

    private func sampleSnapshot() -> WidgetSnapshotData {
        WidgetSnapshotData(
            updatedAt: nil,
            termWeek: 1,
            totalActiveItems: 4,
            completedItemsCount: 2,
            overallCompletionPct: 50,
            pendingDeliverablesCount: 2,
            smartGreeting: "Upcoming Deadlines",
            upcomingItems: [
                WidgetUpcomingItemData(
                    id: "sample-1",
                    title: "Family Systems Case Formulation",
                    courseCode: "CPC 512",
                    hexColor: "#2470F5",
                    type: "assignment",
                    dueText: "Today",
                    isCompleted: false,
                    priorityScore: 1,
                    urgencyLevel: "today",
                    dueCountdown: "Today",
                    deepLinkUrl: "coursepal://tab/assignments"
                ),
                WidgetUpcomingItemData(
                    id: "sample-2",
                    title: "Genograms in Clinical Assessment",
                    courseCode: "CPC 512",
                    hexColor: "#2470F5",
                    type: "reading",
                    dueText: "Tomorrow",
                    isCompleted: false,
                    priorityScore: 2,
                    urgencyLevel: "tomorrow",
                    dueCountdown: "Tomorrow",
                    deepLinkUrl: "coursepal://tab/readings"
                )
            ],
            coursesSummary: [
                CourseSummaryData(
                    courseCode: "CPC 512",
                    courseName: "Family Systems Approaches",
                    hexColor: "#2470F5",
                    completedCount: 2,
                    totalCount: 4,
                    percentage: 50
                )
            ]
        )
    }
}

// MARK: - Color Hex Helper
extension Color {
    init(hex: String) {
        let cleanHex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleanHex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch cleanHex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 36, 112, 245)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - iOS 17+ Widget Background & Margin Compatibility Helpers
extension View {
    func widgetBackground(_ backgroundView: some View) -> some View {
        if #available(iOS 17.0, *) {
            return containerBackground(for: .widget) { backgroundView }
        } else {
            return background(backgroundView)
        }
    }
}

extension WidgetConfiguration {
    func contentMarginsDisabledIfAvailable() -> some WidgetConfiguration {
        if #available(iOS 17.0, *) {
            return self.contentMarginsDisabled()
        } else {
            return self
        }
    }
}

// MARK: - Small Widget View
struct SmallWidgetView: View {
    let entry: CoursePalWidgetEntry

    var body: some View {
        let upcoming = entry.snapshot?.upcomingItems?.first(where: { !$0.isCompleted })
        let courseCode = (upcoming?.courseCode ?? "CLASSPAL").uppercased()
        let courseColor = Color(hex: upcoming?.hexColor ?? "#2470F5")
        let title = upcoming?.title ?? "All tasks completed!"
        let dueText = upcoming?.dueText ?? "All Caught Up"
        let isOverdue = upcoming?.urgencyLevel == "overdue"
        let isToday = upcoming?.urgencyLevel == "today"
        let pct = entry.snapshot?.overallCompletionPct ?? 0

        VStack(alignment: .leading, spacing: 5) {
            // Course code pill + percentage
            HStack(spacing: 4) {
                Text(courseCode)
                    .font(.system(size: 9.5, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 5.5)
                    .padding(.vertical, 2.5)
                    .background(courseColor)
                    .cornerRadius(5)

                Spacer()

                Text("\(pct)%")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color(hex: "#596B85"))
            }

            Spacer()

            // Due Status (Today, Tomorrow, Overdue)
            Text(dueText.uppercased())
                .font(.system(size: 10.5, weight: .heavy))
                .foregroundColor(isOverdue ? Color(hex: "#D94033") : (isToday ? Color(hex: "#2470F5") : Color(hex: "#596B85")))

            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color(hex: "#141F38"))
                .lineLimit(2)
                .lineSpacing(2)

            Spacer()

            // Deliverable category: Reading vs Assignment
            if let type = upcoming?.type {
                HStack(spacing: 4) {
                    Image(systemName: type == "reading" ? "book.closed.fill" : "doc.text.fill")
                        .font(.system(size: 9))
                        .foregroundColor(courseColor)

                    Text(type.capitalized)
                        .font(.system(size: 9.5, weight: .semibold))
                        .foregroundColor(Color(hex: "#7A8A9E"))
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white)
        .widgetURL(URL(string: upcoming?.deepLinkUrl ?? "coursepal://tab/assignments"))
    }
}

// MARK: - Medium Widget View
struct MediumWidgetView: View {
    let entry: CoursePalWidgetEntry

    var body: some View {
        let upcoming = entry.snapshot?.upcomingItems?.filter({ !$0.isCompleted }) ?? []
        let pct = entry.snapshot?.overallCompletionPct ?? 0
        let totalActive = entry.snapshot?.totalActiveItems ?? 0
        let completed = entry.snapshot?.completedItemsCount ?? 0
        let smartGreeting = entry.snapshot?.smartGreeting ?? "Upcoming Deadlines"

        HStack(spacing: 14) {
            // Left Column: Progress Ring + Status
            VStack(alignment: .leading, spacing: 3) {
                Text("PROGRESS")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(Color(hex: "#7A8A9E"))

                Spacer()

                ZStack {
                    Circle()
                        .stroke(Color(hex: "#E2E8F0"), lineWidth: 6)
                        .frame(width: 56, height: 56)

                    Circle()
                        .trim(from: 0, to: CGFloat(max(0.04, Double(pct) / 100.0)))
                        .stroke(Color(hex: "#2470F5"), style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .frame(width: 56, height: 56)

                    Text("\(pct)%")
                        .font(.system(size: 13.5, weight: .heavy))
                        .foregroundColor(Color(hex: "#141F38"))
                }
                .frame(maxWidth: .infinity, alignment: .center)

                Spacer()

                Text("\(completed) of \(totalActive) done")
                    .font(.system(size: 9.5, weight: .semibold))
                    .foregroundColor(Color(hex: "#596B85"))
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            .frame(width: 86)

            Divider()

            // Right Column: Upcoming Tasks with Direct Links
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(smartGreeting.uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(Color(hex: "#7A8A9E"))
                        .lineLimit(1)

                    Spacer()
                }

                if upcoming.isEmpty {
                    Spacer()
                    VStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 22))
                            .foregroundColor(Color(hex: "#2EB866"))
                        Text("All Caught Up")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color(hex: "#141F38"))
                        Text("No pending deadlines.")
                            .font(.system(size: 10.5, weight: .medium))
                            .foregroundColor(Color(hex: "#596B85"))
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    Spacer()
                } else {
                    ForEach(upcoming.prefix(2)) { item in
                        Link(destination: URL(string: item.deepLinkUrl ?? "coursepal://tab/assignments")!) {
                            HStack(alignment: .center, spacing: 8) {
                                RoundedRectangle(cornerRadius: 2.5)
                                    .fill(Color(hex: item.hexColor))
                                    .frame(width: 3.5, height: 32)

                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 4) {
                                        Text(item.courseCode.uppercased())
                                            .font(.system(size: 9, weight: .bold))
                                            .foregroundColor(Color(hex: item.hexColor))

                                        Image(systemName: item.type == "reading" ? "book.fill" : "doc.text.fill")
                                            .font(.system(size: 8))
                                            .foregroundColor(Color(hex: "#7A8A9E"))

                                        Spacer()

                                        Text(item.dueText)
                                            .font(.system(size: 9.5, weight: .bold))
                                            .foregroundColor(item.urgencyLevel == "overdue" ? Color(hex: "#D94033") : (item.urgencyLevel == "today" ? Color(hex: "#2470F5") : Color(hex: "#596B85")))
                                    }

                                    Text(item.title)
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundColor(Color(hex: "#141F38"))
                                        .lineLimit(1)
                                }
                            }
                        }
                    }
                    Spacer()
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white)
    }
}

// MARK: - Root Entry View
struct CoursePalWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: CoursePalWidgetEntry

    var body: some View {
        Group {
            switch family {
            case .systemSmall:
                SmallWidgetView(entry: entry)
            case .systemMedium:
                MediumWidgetView(entry: entry)
            default:
                MediumWidgetView(entry: entry)
            }
        }
        .widgetBackground(Color.white)
    }
}

// MARK: - Widget Declaration
@main
struct CoursePalWidget: Widget {
    let kind: String = "CoursePalWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CoursePalWidgetProvider()) { entry in
            CoursePalWidgetEntryView(entry: entry)
        }
        .contentMarginsDisabledIfAvailable()
        .configurationDisplayName("ClassPal Deadlines")
        .description("Track your upcoming assignments, chapters, and weekly completion progress.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
