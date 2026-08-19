import Foundation
import EventKit
import SwiftUI

/// Feature 1: Native iOS Calendar & Reminders Sync Engine (EventKit)
@MainActor
public final class CalendarSyncService: ObservableObject {
    public static let shared = CalendarSyncService()
    private let eventStore = EKEventStore()

    @Published public var isAuthorized: Bool = false
    @Published public var syncMessage: String? = nil

    private init() {
        checkAuthorizationStatus()
    }

    public func checkAuthorizationStatus() {
        let status = EKEventStore.authorizationStatus(for: .event)
        self.isAuthorized = (status == .authorized || status == .fullAccess)
    }

    public func requestAccess() async -> Bool {
        do {
            if #available(iOS 17.0, *) {
                let granted = try await eventStore.requestFullAccessToEvents()
                self.isAuthorized = granted
                return granted
            } else {
                let granted = try await eventStore.requestAccess(to: .event)
                self.isAuthorized = granted
                return granted
            }
        } catch {
            self.syncMessage = "Calendar access error: \(error.localizedDescription)"
            return false
        }
    }

    public func syncAssignmentToCalendar(title: String, dueDate: Date, courseCode: String, points: String?) async -> Bool {
        if !isAuthorized {
            let granted = await requestAccess()
            if !granted { return false }
        }

        let event = EKEvent(eventStore: eventStore)
        event.title = "[\(courseCode)] Due: \(title)"
        event.startDate = dueDate.addingTimeInterval(-3600) // 1 hr duration
        event.endDate = dueDate
        event.notes = "Course: \(courseCode)\nPoints/Weight: \(points ?? "N/A")\nManaged by CoursePal"
        event.calendar = eventStore.defaultCalendarForNewEvents

        // Add 2 Alarms: 1 Day Before & 2 Hours Before
        event.addAlarm(EKAlarm(relativeOffset: -86400)) // 24 hours
        event.addAlarm(EKAlarm(relativeOffset: -7200))  // 2 hours

        do {
            try eventStore.save(event, span: .thisEvent)
            self.syncMessage = "Successfully synced to iOS Calendar!"
            return true
        } catch {
            self.syncMessage = "Failed to save event: \(error.localizedDescription)"
            return false
        }
    }
}
