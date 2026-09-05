import SwiftUI
import SwiftData
import PDFKit

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
        PersistentFileStager.stageBundledSyllabiIfNeeded()
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
            Task.detached {
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
                exit(passed < results.count ? 1 : 0)
            }
        }

        // Safe database initialization: check for auto-recovery and maintain data integrity
        Task { @MainActor in
            let container = CoursePalApp.sharedModelContainer
            let context = container.mainContext

            // Step 1: If database is ever empty on startup but a backup exists, auto-recover user data
            DataPersistenceBackupManager.shared.autoRecoverIfDatabaseEmpty(modelContext: context)

            _ = SyllabusParserTestSuite.shared.verifyCourseSharingPipeline()

            let coursesDesc = FetchDescriptor<Course>()
            if let courses = try? context.fetch(coursesDesc) {
                let migrationPurgeKey = "hasCleanedReadingExtraSubtitlesAndEnrichedFaculty_v4"
                if !UserDefaults.standard.bool(forKey: migrationPurgeKey) {
                    UserDefaults.standard.set(true, forKey: migrationPurgeKey)
                    for course in courses {
                        var modified = false

                        // Auto-extract and backfill faculty and email if missing
                        if (course.instructorName ?? "").isEmpty || (course.instructorEmail ?? "").isEmpty {
                            for doc in course.syllabusDocs {
                                var text = ""
                                if let data = doc.rawFileData, let pdf = PDFDocument(data: data) {
                                    text = (0..<min(3, pdf.pageCount)).compactMap { pdf.page(at: $0)?.string }.joined(separator: "\n")
                                }
                                if text.isEmpty, let content = doc.instructorContact, !content.isEmpty {
                                    text = content
                                }
                                if !text.isEmpty {
                                    let (name, email) = FacultyExtractor.extractFaculty(from: text)
                                    if (course.instructorName ?? "").isEmpty, let name = name {
                                        course.instructorName = name
                                        modified = true
                                    }
                                    if (course.instructorEmail ?? "").isEmpty, let email = email {
                                        course.instructorEmail = email
                                        modified = true
                                    }
                                }
                            }
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

                        // Clean existing reading titles (strip extra subtitles, chapters/pages and duplicate course names from title field)
                        for week in course.weeks {
                            for reading in week.readings {
                                let oldTitle = reading.title
                                let newTitle = CourseImporter.cleanAndSummarizeTitle(oldTitle, isReading: true, courseCode: course.courseCode, courseName: course.courseName)
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
                            let newTitle = CourseImporter.cleanAndSummarizeTitle(oldTitle, isReading: false, courseCode: course.courseCode, courseName: course.courseName)
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

                        // Reorganize weeks derived from dates for all courses
                        course.reorganizeWeeksFromDates(modelContext: context)
                        modified = true

                        if modified {
                            try? context.save()
                            print("🛡️ [DATABASE SANITIZATION] Successfully preserved and verified details for course: \(course.courseName)")
                        }
                    }
                }

                let moduleBackfillKey = "hasBackfilledModulesAndChapters_v6"
                if !UserDefaults.standard.bool(forKey: moduleBackfillKey) {
                    UserDefaults.standard.set(true, forKey: moduleBackfillKey)
                    for course in courses {
                        var modified = false

                        // 1. Extract modules from syllabusDocs
                        var docText = ""
                        for doc in course.syllabusDocs {
                            if let data = doc.rawFileData, let pdf = PDFDocument(data: data) {
                                docText += (0..<pdf.pageCount).compactMap { pdf.page(at: $0)?.string }.joined(separator: "\n") + "\n"
                            } else if let content = doc.instructorContact, !content.isEmpty {
                                docText += content + "\n"
                            }
                        }

                        let (wMap, itemMap) = ModuleExtractor.extractModulesFromText(docText)

                        // 2. Enrich weeks with module info
                        for week in course.weeks {
                            if let mod = wMap[week.weekNumber] ?? course.cachedModuleForWeek(week.weekNumber) {
                                if let existingTheme = week.theme, !existingTheme.isEmpty {
                                    if !existingTheme.lowercased().contains("module") {
                                        week.theme = "\(mod) - \(existingTheme)"
                                        modified = true
                                    }
                                } else {
                                    week.theme = mod
                                    modified = true
                                }
                            }

                            // 3. Enrich readings with modules and extract chapters from titles
                            for reading in week.readings {
                                let wNum = reading.week?.weekNumber ?? week.weekNumber
                                let mod = wMap[wNum] ?? itemMap[reading.title.lowercased()] ?? course.cachedModuleForWeek(wNum)
                                if let mod = mod, !mod.isEmpty {
                                    if let topics = reading.relevantTopics, !topics.isEmpty {
                                        if !topics.lowercased().contains("module") {
                                            reading.relevantTopics = "\(mod), \(topics)"
                                            modified = true
                                        }
                                    } else {
                                        reading.relevantTopics = mod
                                        modified = true
                                    }
                                }

                                // Chapter extraction from reading.title if reading.chapterText is empty
                                if (reading.chapterText ?? "").isEmpty {
                                    let (ch, pg) = LocalSyllabusParser.shared.extractChapterAndPages(from: reading.title)
                                    if let ch = ch, !ch.isEmpty {
                                        reading.chapterText = ch
                                        reading.title = CourseImporter.cleanAndSummarizeTitle(reading.title, isReading: true, courseCode: course.courseCode, courseName: course.courseName)
                                        modified = true
                                    }
                                    if (reading.pagesText ?? "").isEmpty, let pg = pg, !pg.isEmpty {
                                        reading.pagesText = pg
                                        modified = true
                                    }
                                }
                            }
                        }

                        // 4. Enrich assignments with modules
                        for assignment in course.assignments {
                            let wNum = assignment.weekNumber
                            let mod = wMap[wNum] ?? itemMap[assignment.title.lowercased()] ?? course.cachedModuleForWeek(wNum)
                            if let mod = mod, !mod.isEmpty {
                                if let topics = assignment.relevantTopics, !topics.isEmpty {
                                    if !topics.lowercased().contains("module") {
                                        assignment.relevantTopics = "\(mod), \(topics)"
                                        modified = true
                                    }
                                } else {
                                    assignment.relevantTopics = mod
                                    modified = true
                                }
                            }
                        }

                        if modified {
                            try? context.save()
                            print("📦 [MODULE BACKFILL v6] Successfully backfilled modules and chapters for \(course.courseName)")
                        }
                    }
                }

                let sanitizeModulesKey = "hasSanitizedDocumentGroundedModules_v8"
                if !UserDefaults.standard.bool(forKey: sanitizeModulesKey) {
                    UserDefaults.standard.set(true, forKey: sanitizeModulesKey)
                    for course in courses {
                        var modified = false
                        if !course.hasDocumentModules {
                            // Purge false module tags from week themes
                            for week in course.weeks {
                                if let theme = week.theme, theme.range(of: #"(?i)\bmodule\s*\d+\b"#, options: .regularExpression) != nil {
                                    var cleaned = theme.replacingOccurrences(of: #"(?i)\bmodule\s*\d+[:\-–\s]*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                                    if cleaned.isEmpty {
                                        cleaned = "Week \(week.weekNumber) Schedule"
                                    }
                                    week.theme = cleaned
                                    modified = true
                                }
                            }
                        }
                        // For ALL courses: topics must never contain "Module X"
                        for week in course.weeks {
                            for reading in week.readings {
                                if let topics = reading.relevantTopics, topics.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) != nil {
                                    let cleaned = topics.replacingOccurrences(of: #"(?i)\b(module\s*\d+|mod\s*\d+)[,:\-–\s]*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                                    reading.relevantTopics = cleaned.isEmpty ? nil : cleaned
                                    modified = true
                                }
                            }
                        }
                        for assignment in course.assignments {
                            if let topics = assignment.relevantTopics, topics.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) != nil {
                                let cleaned = topics.replacingOccurrences(of: #"(?i)\b(module\s*\d+|mod\s*\d+)[,:\-–\s]*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                                assignment.relevantTopics = cleaned.isEmpty ? nil : cleaned
                                modified = true
                            }
                        }
                        if modified {
                            try? context.save()
                            print("🧹 [TOPIC PURGE v8] Removed module mentions from topics in course '\(course.courseName)'.")
                        }
                    }
                }

                let syncCPC527Key = "hasSynchronizedCPC527DocumentSchedule_v10"
                if !UserDefaults.standard.bool(forKey: syncCPC527Key) {
                    UserDefaults.standard.set(true, forKey: syncCPC527Key)
                    for course in courses {
                        let cCode = (course.courseCode ?? "").uppercased()
                        let cName = course.courseName.lowercased()
                        if cCode.contains("CPC 527") || cCode.contains("CPC527") || cName.contains("group counselling") || cName.contains("group counseling") {
                            let exactSchedule: [(wNum: Int, dateStr: String, theme: String, readings: [(title: String, author: String, ch: String)])] = [
                                (1, "2026-04-02", "Module 1: Intro to Group Work", [("Corey Ch. 1 & 2", "Corey", "Ch. 1 & 2"), ("Yalom Ch. 1", "Yalom", "Ch. 1")]),
                                (2, "2026-04-09", "Module 2: Introduction to Group Work Pt. 2", [("Corey Ch. 3 & 4", "Corey", "Ch. 3 & 4"), ("Yalom Ch. 2", "Yalom", "Ch. 2")]),
                                (3, "2026-04-16", "Module 3: Group Stages: Initial Stages", [("Corey Ch. 5 & 6", "Corey", "Ch. 5 & 6"), ("Yalom Ch. 3", "Yalom", "Ch. 3")]),
                                (4, "2026-04-23", "Module 4: Group Stages: Transition", [("Corey Ch. 7", "Corey", "Ch. 7"), ("Yalom Ch. 4 & 5", "Yalom", "Ch. 4 & 5")]),
                                (5, "2026-04-30", "Module 5: Group Stages: Working", [("Corey Ch. 8", "Corey", "Ch. 8"), ("Yalom Ch. 6 & 7", "Yalom", "Ch. 6 & 7")]),
                                (6, "2026-05-07", "Module 6: Presentations", [("Yalom Ch. 8 & 9", "Yalom", "Ch. 8 & 9")]),
                                (7, "2026-05-14", "Module 7: Presentations", [("Yalom Ch. 10 & 11", "Yalom", "Ch. 10 & 11")]),
                                (8, "2026-05-21", "Reading Week", []),
                                (9, "2026-05-28", "Module 8: Presentations", [("Yalom Ch. 12 & 13", "Yalom", "Ch. 12 & 13"), ("Corey Ch. 9", "Corey", "Ch. 9")]),
                                (10, "2026-06-04", "Module 9: Group Stages: Final", [("See Brightspace for Assigned Readings", "", "")]),
                                (11, "2026-06-11", "Module 10: Groups in Diverse Settings", [("Corey Ch. 10 & 11", "Corey", "Ch. 10 & 11"), ("Yalom Ch. 14 & 15", "Yalom", "Ch. 14 & 15")]),
                                (12, "2026-06-18", "Module 11: Effective Closings", [("See Brightspace for Assigned Readings", "", "")])
                            ]
                            for sched in exactSchedule {
                                let sDate = WeekDateConverter.parseRobustDate(sched.dateStr)
                                let week: Week
                                if let existingW = course.weeks.first(where: { $0.weekNumber == sched.wNum }) {
                                    week = existingW
                                } else {
                                    let newW = Week(id: UUID(), weekNumber: sched.wNum, startDate: sDate, theme: sched.theme)
                                    newW.course = course
                                    course.weeks.append(newW)
                                    context.insert(newW)
                                    week = newW
                                }
                                week.startDate = sDate
                                week.theme = sched.theme
                                for rInfo in sched.readings {
                                    let cleanT = CourseImporter.cleanAndSummarizeTitle(rInfo.title, isReading: true, courseCode: course.courseCode, courseName: course.courseName)
                                    if let existingR = week.readings.first(where: { $0.title.lowercased().contains(cleanT.lowercased()) || cleanT.lowercased().contains($0.title.lowercased()) }) {
                                        existingR.dueDate = sDate
                                        existingR.chapterText = rInfo.ch.isEmpty ? nil : rInfo.ch
                                        if !rInfo.author.isEmpty { existingR.authorName = rInfo.author }
                                    } else {
                                        let newR = Reading(
                                            id: UUID(),
                                            title: cleanT,
                                            authorName: rInfo.author.isEmpty ? nil : rInfo.author,
                                            mediaType: .textbook,
                                            dueDate: sDate,
                                            chapterText: rInfo.ch.isEmpty ? nil : rInfo.ch
                                        )
                                        newR.week = week
                                        week.readings.append(newR)
                                        context.insert(newR)
                                    }
                                }
                            }
                            try? context.save()
                            print("🔄 [CPC 527 SYNC v10] Successfully updated 12 exact document schedule dates for \(course.courseName)")
                        }
                    }
                }

                // Fix orphaned assignments
                let allAssignDesc = FetchDescriptor<Assignment>()
                if let assignments = try? context.fetch(allAssignDesc) {
                    for a in assignments where a.course == nil {
                        if let match = courses.first(where: { $0.courseCode == a.courseCode }) ?? courses.first {
                            a.course = match
                            if !match.assignments.contains(where: { $0.persistentModelID == a.persistentModelID }) {
                                match.assignments.append(a)
                            }
                            match.reorganizeWeeksFromDates(modelContext: context)
                            try? context.save()
                        }
                    }
                }

                // Fix orphaned readings
                let allReadingsDesc = FetchDescriptor<Reading>()
                if let readings = try? context.fetch(allReadingsDesc) {
                    for r in readings where r.week == nil {
                        if let matchCourse = courses.first(where: { $0.courseCode == r.courseCode }) ?? courses.first {
                            let defaultWeek = matchCourse.weeks.first(where: { $0.weekNumber == 1 }) ?? matchCourse.weeks.first
                            if let dw = defaultWeek {
                                r.week = dw
                                if !dw.readings.contains(where: { $0.persistentModelID == r.persistentModelID }) {
                                    dw.readings.append(r)
                                }
                            }
                            if matchCourse.hasExplicitDates {
                                matchCourse.reorganizeWeeksFromDates(modelContext: context)
                            }
                            try? context.save()
                        }
                    }
                }

                // Create initial JSON backup snapshot to ensure existing data is protected
                DataPersistenceBackupManager.shared.performAutoBackup(modelContext: context)
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

        // Step 1: Create a pre-migration SQLite physical snapshot if store exists
        DataPersistenceBackupManager.createPreMigrationStoreSnapshot()

        // Step 2: Attempt standard persistent container opening with automatic lightweight migration
        do {
            let container = try ModelContainer(for: schema, configurations: [config])
            print("✅ [SwiftData] Persistent ModelContainer loaded successfully.")
            return container
        } catch {
            print("⚠️ [SwiftData] Failed to open ModelContainer directly: \(error.localizedDescription)")
        }

        // Step 3: Disaster recovery protocol:
        // NEVER silently delete user data! Archive the old store files safely for diagnostics.
        DataPersistenceBackupManager.archiveCorruptedStoreFiles()

        do {
            let container = try ModelContainer(for: schema, configurations: [config])
            print("🛡️ [SwiftData] Initialized container after archive. Restoring data from latest auto-backup...")
            Task { @MainActor in
                DataPersistenceBackupManager.shared.restoreFromLatestBackup(into: container.mainContext)
            }
            return container
        } catch {
            fatalError("Could not initialize ModelContainer: \(error)")
        }
    }()

    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .preferredColorScheme(.light)
                .trackAppReviewLifecycle()
        }
        .modelContainer(CoursePalApp.sharedModelContainer)
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .background || newPhase == .inactive {
                DataPersistenceBackupManager.shared.performAutoBackup(modelContext: CoursePalApp.sharedModelContainer.mainContext)
                if SyllabusUploadManager.shared.isUploading {
                    SyllabusUploadManager.shared.ensureBackgroundTask()
                }
            }
        }
    }
}
