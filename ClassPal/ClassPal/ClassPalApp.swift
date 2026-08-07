import SwiftUI
import SwiftData

#if os(iOS)
import UIKit
#endif

#if os(iOS)
extension View {
    public func dismissKeyboardOnTap() -> some View {
        self
            .scrollDismissesKeyboard(.immediately)
            .onAppear {
                KeyboardDismissHelper.setupGlobalDismissGesture()
            }
    }
}

public enum KeyboardDismissHelper {
    public static func setupGlobalDismissGesture() {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene else { return }
        for window in windowScene.windows {
            let hasRecognizer = window.gestureRecognizers?.contains(where: { $0 is GlobalKeyboardDismissGestureRecognizer }) ?? false
            if !hasRecognizer {
                let tap = GlobalKeyboardDismissGestureRecognizer(target: window, action: #selector(UIView.endEditing(_:)))
                tap.cancelsTouchesInView = false
                window.addGestureRecognizer(tap)
            }
        }
    }
}

private class GlobalKeyboardDismissGestureRecognizer: UITapGestureRecognizer, UIGestureRecognizerDelegate {
    override init(target: Any?, action: Selector?) {
        super.init(target: target, action: action)
        self.cancelsTouchesInView = false
        self.delegate = self
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        return true
    }
}
#else
extension View {
    public func dismissKeyboardOnTap() -> some View {
        self
    }
}
#endif

@main
struct CoursePalApp: App {
    init() {
        #if DEBUG
        // Automatically clear previous data on Xcode build & launch for a fresh state
        let storeURL = URL.applicationSupportDirectory.appendingPathComponent("default.store")
        let shmURL = storeURL.appendingPathExtension("shm")
        let walURL = storeURL.appendingPathExtension("wal")
        for url in [storeURL, shmURL, walURL] {
            try? FileManager.default.removeItem(at: url)
        }
        print("🧹 [Xcode Launch] Auto-cleared previous data for a fresh start.")
        #endif

        if CommandLine.arguments.contains("--test") {
            print("==================================================")
            print("RUNNING 20-TEST QA PROTOCOL BATTERY...")
            print("==================================================")
            let results = SyllabusParserTestSuite.shared.run20QATestSuite()
            var passed = 0
            for r in results {
                let status = r.passed ? "✅ PASS" : "❌ FAIL"
                if r.passed { passed += 1 }
                print("Test \(r.testId) [\(status)]: \(r.testName)")
                print("   Details: \(r.details)")
            }
            print("--------------------------------------------------")
            print("RESULTS: \(passed)/\(results.count) Tests Passed (\(Int(Double(passed)/Double(results.count)*100))%)")
            print("==================================================")
            if passed < results.count {
                exit(1)
            } else {
                exit(0)
            }
        }
    }

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Course.self,
            Week.self,
            Reading.self,
            Assignment.self,
            SyllabusDocument.self,
            VaultDocument.self,
        ])

        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        // Try to open the existing persistent store
        if let container = try? ModelContainer(for: schema, configurations: [config]) {
            return container
        }

        // Schema changed (migration needed) — delete the old store and start fresh
        // This is safe for development: the user re-imports their syllabi after an update.
        let storeURL = URL.applicationSupportDirectory
            .appendingPathComponent("default.store")
        let shmURL = storeURL.appendingPathExtension("shm")
        let walURL = storeURL.appendingPathExtension("wal")
        for url in [storeURL, shmURL, walURL] {
            try? FileManager.default.removeItem(at: url)
        }

        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Could not create ModelContainer even after store reset: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .preferredColorScheme(.light)
        }
        .modelContainer(sharedModelContainer)
    }
}
