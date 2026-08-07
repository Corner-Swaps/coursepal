import SwiftUI
import SwiftData

public struct AssignmentDetailView: View {
    @Bindable public var assignment: Assignment
    @Environment(\.modelContext) private var modelContext
    @State private var scratchpadText: String = ""
    @State private var isSavingNote: Bool = false
    @State private var debounceTask: Task<Void, Never>? = nil

    public init(assignment: Assignment) {
        self.assignment = assignment
        _scratchpadText = State(initialValue: assignment.noteText ?? "")
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header Card
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "square.and.pencil")
                            .font(.title2)
                            .foregroundColor(.blue)
                        Text(assignment.title)
                            .font(.title2)
                            .fontWeight(.bold)
                    }

                    if let points = assignment.pointsPossible {
                        HStack {
                            Image(systemName: "star.fill")
                                .foregroundColor(.orange)
                            Text(points)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundColor(.secondary)
                        }
                    }

                    if let dueDate = assignment.dueDate {
                        HStack {
                            Image(systemName: "clock.fill")
                                .foregroundColor(.red)
                            Text("Due: \(dueDate.formatted(date: .complete, time: .shortened))")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                #if canImport(UIKit)
                .background(Color(.secondarySystemBackground))
                #else
                .background(Color.gray.opacity(0.15))
                #endif
                .cornerRadius(16)

                // Instructions Section
                if let instructions = assignment.fullInstructions, !instructions.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Full Instructions")
                            .font(.headline)
                        Text(instructions)
                            .font(.body)
                            .foregroundColor(.secondary)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            #if canImport(UIKit)
                            .background(Color(.tertiarySystemBackground))
                            #else
                            .background(Color.gray.opacity(0.1))
                            #endif
                            .cornerRadius(12)
                    }
                }

                // Personal Scratchpad Section
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "note.text")
                            .foregroundColor(.purple)
                        Text("Personal Scratchpad & Notes")
                            .font(.headline)
                        Spacer()
                        if isSavingNote {
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                    }

                    TextEditor(text: $scratchpadText)
                        .frame(minHeight: 150)
                        .padding(8)
                        #if canImport(UIKit)
                        .background(Color(.tertiarySystemBackground))
                        #else
                        .background(Color.gray.opacity(0.1))
                        #endif
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.purple.opacity(0.3), lineWidth: 1)
                        )
                        .onChange(of: scratchpadText) { _, newValue in
                            assignment.noteText = newValue
                            // Debounce: cancel previous pending save, wait 1s after last keystroke
                            debounceTask?.cancel()
                            debounceTask = Task {
                                try? await Task.sleep(nanoseconds: 1_000_000_000)
                                guard !Task.isCancelled else { return }
                                isSavingNote = true
                                await OfflineLedgerManager.shared.enqueueSaveNote(
                                    assignmentId: assignment.id.uuidString,
                                    noteText: newValue
                                )
                                isSavingNote = false
                            }
                        }
                }

                Spacer()
            }
            .padding()
        }
        .navigationTitle("Assignment Detail")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}
