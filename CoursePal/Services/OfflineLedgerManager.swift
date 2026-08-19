import Foundation
import Network

public struct PendingMutation: Codable, Identifiable {
    public let id: UUID
    public let type: MutationType
    public let readingId: String?
    public let isCompleted: Bool?
    public let assignmentId: String?
    public let noteText: String?
    public let timestamp: Date

    public enum MutationType: String, Codable {
        case toggleReading
        case saveNote
    }

    public init(id: UUID = UUID(), type: MutationType, readingId: String? = nil, isCompleted: Bool? = nil, assignmentId: String? = nil, noteText: String? = nil, timestamp: Date = Date()) {
        self.id = id
        self.type = type
        self.readingId = readingId
        self.isCompleted = isCompleted
        self.assignmentId = assignmentId
        self.noteText = noteText
        self.timestamp = timestamp
    }
}

@MainActor
public final class OfflineLedgerManager: ObservableObject {
    public static let shared = OfflineLedgerManager()

    @Published public private(set) var isOnline: Bool = true
    @Published public private(set) var pendingMutations: [PendingMutation] = []

    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.classpal.networkmonitor")
    private let storageKey = "CoursePal_PendingMutations_Ledger"

    private init() {
        loadPendingMutations()
        startNetworkMonitoring()
    }

    private func startNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                let nowOnline = (path.status == .satisfied)
                let statusChanged = (self?.isOnline != nowOnline)
                self?.isOnline = nowOnline

                if nowOnline && statusChanged {
                    print("[Offline Ledger] Network restored. Flushing pending mutations queue...")
                    await self?.flushPendingMutations()
                }
            }
        }
        monitor.start(queue: monitorQueue)
    }

    public func enqueueToggleReading(readingId: String, isCompleted: Bool) async {
        let mutation = PendingMutation(
            type: .toggleReading,
            readingId: readingId,
            isCompleted: isCompleted
        )
        pendingMutations.append(mutation)
        savePendingMutations()

        if isOnline {
            await flushPendingMutations()
        }
    }

    public func enqueueSaveNote(assignmentId: String, noteText: String) async {
        let mutation = PendingMutation(
            type: .saveNote,
            assignmentId: assignmentId,
            noteText: noteText
        )
        pendingMutations.append(mutation)
        savePendingMutations()

        if isOnline {
            await flushPendingMutations()
        }
    }

    public func flushPendingMutations() async {
        guard isOnline, !pendingMutations.isEmpty else { return }

        var remainingMutations: [PendingMutation] = []

        for mutation in pendingMutations {
            do {
                switch mutation.type {
                case .toggleReading:
                    if let rId = mutation.readingId, let status = mutation.isCompleted {
                        try await APIService.shared.toggleReading(readingId: rId, isCompleted: status)
                        print("[Offline Ledger] Flushed toggleReading for \(rId)")
                    }
                case .saveNote:
                    if let aId = mutation.assignmentId, let text = mutation.noteText {
                        try await APIService.shared.saveNote(assignmentId: aId, noteText: text)
                        print("[Offline Ledger] Flushed saveNote for \(aId)")
                    }
                }
            } catch {
                print("[Offline Ledger] Failed to flush mutation \(mutation.id): \(error.localizedDescription)")
                remainingMutations.append(mutation)
            }
        }

        pendingMutations = remainingMutations
        savePendingMutations()
    }

    private func savePendingMutations() {
        if let data = try? JSONEncoder().encode(pendingMutations) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    private func loadPendingMutations() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let list = try? JSONDecoder().decode([PendingMutation].self, from: data) {
            pendingMutations = list
        }
    }
}
