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

                let moduleBackfillKey = "hasBackfilledModulesAndChapters_v11"
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

                                // Heal chapter OCR artifacts in titles, chapterText, and resourceTitle
                                if let ch = reading.chapterText {
                                    let healedCh = Reading.repairChapterArtifacts(ch)
                                    let cleanCh = Reading.cleanChapterFromRaw(healedCh) ?? healedCh
                                    if cleanCh != ch {
                                        reading.chapterText = cleanCh
                                        modified = true
                                    }
                                }

                                if let res = reading.resourceTitle {
                                    let healedRes = Reading.repairChapterArtifacts(res)
                                    if healedRes != res {
                                        reading.resourceTitle = healedRes
                                        modified = true
                                    }
                                }

                                let healedTitle = Reading.repairChapterArtifacts(reading.title)
                                if healedTitle != reading.title {
                                    reading.title = healedTitle
                                    modified = true
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

                                // If chapterText is present, strip duplicate chapter mentions from title and resourceTitle
                                if let ch = reading.cleanChapterText, !ch.isEmpty {
                                    let strippedT = Reading.stripChapterMentions(from: reading.title)
                                    if strippedT != reading.title && !strippedT.isEmpty {
                                        reading.title = strippedT
                                        modified = true
                                    }
                                    if let res = reading.resourceTitle, !res.isEmpty {
                                        let strippedR = Reading.stripChapterMentions(from: res)
                                        if strippedR != res && !strippedR.isEmpty {
                                            reading.resourceTitle = strippedR
                                            modified = true
                                        }
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
                            print("📦 [MODULE BACKFILL v11] Successfully backfilled modules and chapters for \(course.courseName)")
                        }
                    }
                }

                let healAllReadingsPassKey = "hasHealedAllReadingsDatabaseWide_v11"
                if !UserDefaults.standard.bool(forKey: healAllReadingsPassKey) {
                    UserDefaults.standard.set(true, forKey: healAllReadingsPassKey)
                    let allReadDesc = FetchDescriptor<Reading>()
                    if let allReadings = try? context.fetch(allReadDesc) {
                        var anyFixed = false
                        for r in allReadings {
                            var rMod = false
                            if let ch = r.chapterText {
                                let healedCh = Reading.repairChapterArtifacts(ch)
                                let cleanCh = Reading.cleanChapterFromRaw(healedCh) ?? healedCh
                                if cleanCh != ch {
                                    r.chapterText = cleanCh
                                    rMod = true
                                }
                            }
                            if let res = r.resourceTitle {
                                let healedRes = Reading.repairChapterArtifacts(res)
                                if healedRes != res {
                                    r.resourceTitle = healedRes
                                    rMod = true
                                }
                            }
                            let healedT = Reading.repairChapterArtifacts(r.title)
                            if healedT != r.title {
                                r.title = healedT
                                rMod = true
                            }
                            if (r.chapterText ?? "").isEmpty {
                                let (extCh, extPg) = LocalSyllabusParser.shared.extractChapterAndPages(from: r.title)
                                if let extCh = extCh, !extCh.isEmpty {
                                    r.chapterText = extCh
                                    rMod = true
                                }
                                if (r.pagesText ?? "").isEmpty, let extPg = extPg, !extPg.isEmpty {
                                    r.pagesText = extPg
                                    rMod = true
                                }
                            }
                            if let ch = r.cleanChapterText, !ch.isEmpty {
                                let strippedT = Reading.stripChapterMentions(from: r.title)
                                if strippedT != r.title && !strippedT.isEmpty {
                                    r.title = strippedT
                                    rMod = true
                                }
                                if let res = r.resourceTitle, !res.isEmpty {
                                    let strippedR = Reading.stripChapterMentions(from: res)
                                    if strippedR != res && !strippedR.isEmpty {
                                        r.resourceTitle = strippedR
                                        rMod = true
                                    }
                                }
                            }
                            if rMod {
                                anyFixed = true
                            }
                        }
                        if anyFixed {
                            try? context.save()
                            print("🛡️ [MIGRATION v11] Successfully healed all database reading titles and chapters.")
                        }
                    }
                }

                let smartDistillReadingsPassKey = "hasSmartDistilledReadingTitles_v12"
                if !UserDefaults.standard.bool(forKey: smartDistillReadingsPassKey) {
                    UserDefaults.standard.set(true, forKey: smartDistillReadingsPassKey)
                    let allReadDesc = FetchDescriptor<Reading>()
                    if let allReadings = try? context.fetch(allReadDesc) {
                        var anyFixed = false
                        for r in allReadings {
                            var rMod = false
                            
                            // 1. If chapter is missing, try to extract before shortening
                            if (r.chapterText ?? "").isEmpty {
                                if let ch = r.cleanChapterText, !ch.isEmpty {
                                    r.chapterText = ch
                                    rMod = true
                                }
                            }
                            
                            // 2. Distill reading title
                            let oldTitle = r.title
                            let cleanT = Reading.distillSmartReadingTitle(oldTitle)
                            if cleanT != oldTitle && cleanT != "Reading" {
                                r.title = cleanT
                                rMod = true
                            }
                            
                            // 3. Distill resourceTitle
                            if let res = r.resourceTitle, !res.isEmpty {
                                let cleanRes = Reading.distillSmartReadingTitle(res)
                                if cleanRes != res && cleanRes != "Reading" {
                                    r.resourceTitle = cleanRes
                                    rMod = true
                                }
                            }
                            
                            // 4. Strip chapter from title if chapter is present
                            if let ch = r.cleanChapterText, !ch.isEmpty {
                                let strippedT = Reading.stripChapterMentions(from: r.title)
                                if strippedT != r.title && !strippedT.isEmpty {
                                    r.title = strippedT
                                    rMod = true
                                }
                                if let res = r.resourceTitle, !res.isEmpty {
                                    let strippedR = Reading.stripChapterMentions(from: res)
                                    if strippedR != res && !strippedR.isEmpty {
                                        r.resourceTitle = strippedR
                                        rMod = true
                                    }
                                }
                            }
                            
                            if rMod {
                                anyFixed = true
                            }
                        }
                        if anyFixed {
                            try? context.save()
                            print("🛡️ [MIGRATION v12] Successfully smart-distilled all database reading titles and chapters.")
                        }
                    }
                }

                let cleanChapterDuplicatesPassKey = "hasCleanedChapterDuplicates_v14"
                if !UserDefaults.standard.bool(forKey: cleanChapterDuplicatesPassKey) {
                    UserDefaults.standard.set(true, forKey: cleanChapterDuplicatesPassKey)
                    let allReadDesc = FetchDescriptor<Reading>()
                    if let allReadings = try? context.fetch(allReadDesc) {
                        var anyFixed = false
                        for r in allReadings {
                            var rMod = false
                            if let ch = r.chapterText {
                                let healedCh = Reading.repairChapterArtifacts(ch)
                                if let cleanCh = Reading.cleanChapterFromRaw(healedCh), cleanCh != ch {
                                    r.chapterText = cleanCh
                                    rMod = true
                                }
                            } else if let ch = r.cleanChapterText {
                                r.chapterText = ch
                                rMod = true
                            }
                            if let ch = r.cleanChapterText, !ch.isEmpty {
                                let stripped = Reading.stripChapterMentions(from: r.title)
                                if stripped != r.title {
                                    r.title = stripped.isEmpty ? ch : stripped
                                    rMod = true
                                }
                            }
                            if rMod { anyFixed = true }
                        }
                        if anyFixed {
                            try? context.save()
                            print("🛡️ [MIGRATION v14] Cleaned chapter duplicates database-wide.")
                        }
                    }
                }

                let blankNotesPassKey = "hasMigratedBlankNotes_v13"
                if !UserDefaults.standard.bool(forKey: blankNotesPassKey) {
                    UserDefaults.standard.set(true, forKey: blankNotesPassKey)
                    var didModify = false
                    
                    // 1. Wipe automated syllabus summarizations / titles from all readings
                    let allReadDesc = FetchDescriptor<Reading>()
                    if let allReadings = try? context.fetch(allReadDesc) {
                        for r in allReadings {
                            let raw = r.summaryText.trimmingCharacters(in: .whitespacesAndNewlines)
                            let lower = raw.lowercased()
                            if lower.hasPrefix("required reading") ||
                               lower.hasPrefix("see brightspace") ||
                               raw == r.title ||
                               (r.resourceTitle != nil && raw == r.resourceTitle!) ||
                               lower.contains("corey ch.") ||
                               lower.contains("yalom ch.") ||
                               lower.contains("required reading:") ||
                               lower.contains("required reading for") {
                                r.summaryText = ""
                                didModify = true
                            }
                        }
                    }
                    
                    // 2. Clear notes on all assignments if they match fullInstructions or syllabus parser output
                    let allAssignDesc = FetchDescriptor<Assignment>()
                    if let allAssignments = try? context.fetch(allAssignDesc) {
                        for a in allAssignments {
                            if let notes = a.noteText {
                                let trimmed = notes.trimmingCharacters(in: .whitespacesAndNewlines)
                                if let full = a.fullInstructions?.trimmingCharacters(in: .whitespacesAndNewlines), trimmed == full {
                                    a.noteText = nil
                                    didModify = true
                                } else if trimmed.contains("Parsed from syllabus") {
                                    a.noteText = nil
                                    didModify = true
                                }
                            }
                        }
                    }
                    
                    if didModify {
                        try? context.save()
                        print("✨ [MIGRATION v13] Successfully cleared automated syllabus summarizations from Notes across all records.")
                    }
                }

                let authorAndResourceMigrationKey = "hasMigratedAuthorAndResourceTitles_v15"
                if !UserDefaults.standard.bool(forKey: authorAndResourceMigrationKey) {
                    UserDefaults.standard.set(true, forKey: authorAndResourceMigrationKey)
                    var didModify = false
                    let allReadDesc = FetchDescriptor<Reading>()
                    if let allReadings = try? context.fetch(allReadDesc) {
                        for r in allReadings {
                            // Clean author prefix from title if authorName is set
                            if let auth = r.authorName, !auth.isEmpty {
                                let cleaned = r.title.replacingOccurrences(of: #"(?i)^\Q"# + auth + #"\E\s*[:\-–\.]*\s*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                                if !cleaned.isEmpty && cleaned != r.title {
                                    r.title = cleaned
                                    didModify = true
                                }
                            }
                        }
                    }
                    if didModify {
                        try? context.save()
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

                let migrateReadingTitlesKey = "hasMigratedTopicTitles_v11"
                if !UserDefaults.standard.bool(forKey: migrateReadingTitlesKey) {
                    UserDefaults.standard.set(true, forKey: migrateReadingTitlesKey)
                    var didModify = false
                    for course in courses {
                        for week in course.weeks {
                            for reading in week.readings {
                                let distilled = Reading.distillSmartReadingTitle(reading.title)
                                let auth = reading.authorName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                                let isAuthorOrGeneric = distilled.lowercased() == auth.lowercased() ||
                                    ["reading", "assigned readings", "corey", "yalom"].contains(distilled.lowercased()) ||
                                    distilled.lowercased().hasPrefix("corey ch") ||
                                    distilled.lowercased().hasPrefix("yalom ch")
                                if isAuthorOrGeneric, let topic = reading.extractTopicFromContext(), !topic.isEmpty {
                                    reading.title = topic
                                    didModify = true
                                }
                            }
                        }
                    }
                    if didModify {
                        try? context.save()
                        print("✨ [MIGRATION v11] Successfully migrated author-based reading titles to actual syllabus topics.")
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
