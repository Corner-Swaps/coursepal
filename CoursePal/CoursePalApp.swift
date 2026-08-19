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

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        guard let touchView = touch.view else { return true }

        if touchView is UITextField || touchView is UITextView || NSStringFromClass(type(of: touchView)).contains("Text") {
            return false
        }

        var curr: UIView? = touchView
        while let v = curr {
            let cls = NSStringFromClass(type(of: v))
            if cls.contains("Sheet") || cls.contains("Presentation") || cls.contains("Modal") || cls.contains("Popover") {
                return false
            }
            if let nextResponder = v.next as? UIViewController, nextResponder.presentingViewController != nil {
                return false
            }
            curr = v.superview
        }

        return true
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
        if CommandLine.arguments.contains("--qa") {
            print("==================================================")
            print("RUNNING 25-TEST COMPREHENSIVE QA PROTOCOL...")
            print("==================================================")
            let results = SyllabusParserTestSuite.shared.run25QATestSuite()
            let passed = results.filter { $0.passed }.count
            print("RESULTS: \(passed)/\(results.count) Tests Passed (\(Int(Double(passed)/Double(results.count)*100))%)")
            print("==================================================")
            exit(passed < results.count ? 1 : 0)
        }

        if CommandLine.arguments.contains("--test") {
            print("==================================================")
            print("RUNNING 10-ROUND LIVE GEMINI QA PROTOCOL BATTERY...")
            print("==================================================")
            let sema = DispatchSemaphore(value: 0)
            Task { @MainActor in
                let results = await SyllabusParserTestSuite.shared.run10RoundLiveGeminiQABattery()
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
                sema.signal()
                exit(passed < results.count ? 1 : 0)
            }
            sema.wait()
        }

        // Run database history cleanup to purge placeholder faculty & clean prior chapter titles
        Task { @MainActor in
            let container = CoursePalApp.sharedModelContainer
            let context = container.mainContext
            let coursesDesc = FetchDescriptor<Course>()
            if let courses = try? context.fetch(coursesDesc) {
                for course in courses {
                    var modified = false
                    
                    // Purge default instructor fallback if present in DB
                    if let name = course.instructorName,
                       name == "Dr. Alireza Sedghi Taromi, PhD, RCC-ACS" {
                        course.instructorName = nil
                        modified = true
                    }
                    if let email = course.instructorEmail,
                       email == "sedghitaromialireza@cityu.edu" {
                        course.instructorEmail = nil
                        modified = true
                    }
                    
                    // Purge placeholder faculty info from syllabusDocs
                    for doc in course.syllabusDocs {
                        if doc.instructorContact == "Instructor details in original syllabus document" ||
                           doc.instructorContact == "Instructor" {
                            doc.instructorContact = nil
                            modified = true
                        }
                        if doc.officeHoursText == "Refer to original syllabus document" ||
                           doc.officeHoursText == "By appointment" {
                            doc.officeHoursText = nil
                            modified = true
                        }
                    }

                    // Clean existing reading titles (strip chapters/pages from title field)
                    for week in course.weeks {
                        for reading in week.readings {
                            let oldTitle = reading.title
                            let newTitle = CourseImporter.cleanAndSummarizeTitle(oldTitle, isReading: true)
                            if oldTitle != newTitle {
                                reading.title = newTitle
                                modified = true
                            }
                            // Clear default summaryNotes fallbacks if they contain generic placeholder text
                            let summary = reading.summaryText
                            if summary.contains("Required reading:") || summary.contains("Required reading for") {
                                reading.summaryText = ""
                                modified = true
                            }
                        }
                    }

                    // Clean existing assignment titles & remove placeholder noteText instructions
                    for assignment in course.assignments {
                        let oldTitle = assignment.title
                        let newTitle = CourseImporter.cleanAndSummarizeTitle(oldTitle, isReading: false)
                        if oldTitle != newTitle {
                            assignment.title = newTitle
                            modified = true
                        }
                        // Clear notes if they contain instructions or fallbacks
                        if let notes = assignment.noteText,
                           (notes == assignment.fullInstructions || notes.contains("Parsed from syllabus")) {
                            assignment.noteText = nil
                            modified = true
                        }
                    }

                    if modified {
                        try? context.save()
                        print("🧹 [DATABASE PURGE] Successfully cleaned details & history for course: \(course.courseName)")
                    }
                }
            }
        }
    }

    static var sharedModelContainer: ModelContainer = {
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

    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .preferredColorScheme(.light)
        }
        .modelContainer(CoursePalApp.sharedModelContainer)
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .background || newPhase == .inactive {
                if SyllabusUploadManager.shared.isUploading {
                    SyllabusUploadManager.shared.ensureBackgroundTask()
                }
            }
        }
    }
}
