import Foundation
import SwiftData
import PDFKit

// MARK: - SwiftData Models (iOS Single Source of Truth)

@Model
public final class Course {
    @Attribute(.unique) public var id: UUID
    public var creatorId: UUID
    public var courseName: String
    public var courseCode: String?
    public var courseDescription: String?
    public var instructorName: String?
    public var instructorEmail: String?
    public var hexColor: String
    public var termWeeks: Int
    public var sharingCode: String
    public var isDeleted: Bool
    public var isFavorite: Bool = false
    public var chatHistoryJSON: String?
    public var createdAt: Date
    
    @Relationship(deleteRule: .cascade, inverse: \Week.course)
    public var weeks: [Week] = []
    
    @Relationship(deleteRule: .cascade, inverse: \Assignment.course)
    public var assignments: [Assignment] = []

    @Relationship(deleteRule: .cascade, inverse: \SyllabusDocument.course)
    public var syllabusDocs: [SyllabusDocument] = []

    public init(
        id: UUID = UUID(),
        creatorId: UUID = UUID(),
        courseName: String,
        courseCode: String? = nil,
        courseDescription: String? = nil,
        instructorName: String? = nil,
        instructorEmail: String? = nil,
        hexColor: String = "#2563EB",
        termWeeks: Int = 16,
        sharingCode: String = "",
        isDeleted: Bool = false,
        createdAt: Date = Date(),
        isFavorite: Bool = false,
        chatHistoryJSON: String? = nil
    ) {
        self.id = id
        self.creatorId = creatorId
        self.courseName = courseName
        self.courseCode = courseCode
        self.courseDescription = courseDescription
        self.instructorName = instructorName
        self.instructorEmail = instructorEmail
        self.hexColor = hexColor
        self.termWeeks = termWeeks
        let cleanDigits = sharingCode.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
        if cleanDigits.count >= 6 {
            self.sharingCode = String(cleanDigits.prefix(6))
        } else if !cleanDigits.isEmpty {
            self.sharingCode = cleanDigits
        } else {
            self.sharingCode = String(format: "%06d", Int.random(in: 100000...999999))
        }
        self.isDeleted = isDeleted
        self.createdAt = createdAt
        self.isFavorite = isFavorite
        self.chatHistoryJSON = chatHistoryJSON
    }

    public func toDTO() -> CourseDTO {
        var weeksDTO: [WeekDTO] = []
        for w in weeks.sorted(by: { $0.weekNumber < $1.weekNumber }) {
            var readingsDTO: [ReadingDTO] = []
            for r in w.readings where !r.isDeleted {
                let dueStr: String?
                if let d = r.dueDate {
                    dueStr = ISO8601DateFormatter().string(from: d)
                } else {
                    dueStr = nil
                }
                readingsDTO.append(ReadingDTO(
                    id: r.id.uuidString,
                    title: r.title,
                    mediaType: r.mediaTypeRaw,
                    isCompleted: r.isCompleted,
                    summaryText: r.summaryText,
                    keyTakeawaysText: r.keyTakeawaysText,
                    estimatedTimeText: r.estimatedTimeText,
                    videoUrl: r.videoUrl,
                    dueDate: dueStr,
                    dateRangeStr: r.dateRangeStr,
                    relevantTopics: r.relevantTopics,
                    chapterText: r.chapterText,
                    pagesText: r.pagesText,
                    isFavorite: r.isFavorite
                ))
            }
            weeksDTO.append(WeekDTO(
                id: w.id.uuidString,
                weekNumber: w.weekNumber,
                startDate: nil,
                theme: w.theme,
                dateRangeStr: w.dateRangeStr,
                readings: readingsDTO
            ))
        }

        var assignmentsDTO: [AssignmentDTO] = []
        for a in assignments where !a.isDeleted {
            let dueStr: String?
            if let d = a.dueDate {
                dueStr = ISO8601DateFormatter().string(from: d)
            } else {
                dueStr = nil
            }
            assignmentsDTO.append(AssignmentDTO(
                id: a.id.uuidString,
                title: a.title,
                dueDate: dueStr,
                fullInstructions: a.fullInstructions,
                pointsPossible: a.pointsPossible,
                weightPercentage: a.weightPercentage,
                noteText: a.noteText,
                pointsBreakdown: a.pointsBreakdown,
                relevantTopics: a.relevantTopics,
                mediaUrl: a.mediaUrl,
                rubric: a.rubricCriteria,
                isFavorite: a.isFavorite,
                isCompleted: a.isCompleted
            ))
        }

        return CourseDTO(
            id: id.uuidString,
            creatorId: creatorId.uuidString,
            courseName: courseName,
            courseCode: courseCode,
            courseDescription: courseDescription,
            instructorName: instructorName,
            instructorEmail: instructorEmail,
            officeHours: nil,
            termWeeks: termWeeks,
            sharingCode: sharingCode,
            weeks: weeksDTO,
            assignments: assignmentsDTO,
            items: nil,
            dataExtractionStats: nil,
            isFavorite: isFavorite,
            chatHistoryJSON: chatHistoryJSON
        )
    }

    public var hasExplicitDates: Bool {
        for w in weeks {
            for r in w.readings where !r.isDeleted && r.dueDate != nil { return true }
            if w.startDate != nil { return true }
        }
        for a in assignments where !a.isDeleted && a.dueDate != nil { return true }
        return false
    }

    public var hasExplicitWeeks: Bool {
        for w in weeks {
            if w.weekNumber > 0 && !w.readings.filter({ !$0.isDeleted }).isEmpty {
                let theme = w.theme?.lowercased() ?? ""
                if theme.contains("week") || theme.contains("module") || theme.contains("session") || theme.contains("unit") {
                    return true
                }
            }
        }
        for a in assignments where !a.isDeleted && a.weekNumber > 0 { return true }
        return false
    }

    public var earliestItemDate: Date? {
        var dates: [Date] = []
        for w in weeks {
            for r in w.readings where !r.isDeleted {
                if let d = r.dueDate { dates.append(d) }
            }
            if let d = w.startDate { dates.append(d) }
        }
        for a in assignments where !a.isDeleted {
            if let d = a.dueDate { dates.append(d) }
        }
        return dates.min()
    }

    public func reorganizeWeeksFromDates(modelContext: ModelContext? = nil) {
        let calendar = Calendar.current
        let allNonDeletedReadings = weeks.flatMap { $0.readings }.filter { !$0.isDeleted }
        let allNonDeletedAssignments = assignments.filter { !$0.isDeleted }

        var datedItems: [(date: Date, isReading: Bool, reading: Reading?, assignment: Assignment?)] = []
        for r in allNonDeletedReadings {
            if let d = r.dueDate {
                datedItems.append((d, true, r, nil))
            }
        }
        for a in allNonDeletedAssignments {
            if let d = a.dueDate {
                datedItems.append((d, false, nil, a))
            }
        }

        if !datedItems.isEmpty {
            let earliestDate = datedItems.map { $0.date }.min()!
            let startOfWeek1 = calendar.dateInterval(of: .weekOfYear, for: earliestDate)?.start ?? calendar.startOfDay(for: earliestDate)

            // Map each dated item to its derived week number
            for item in datedItems {
                let diffWeeks = calendar.dateComponents([.weekOfYear], from: startOfWeek1, to: item.date).weekOfYear ??
                                (calendar.dateComponents([.day], from: startOfWeek1, to: item.date).day! / 7)
                let derivedWeekNum = max(1, diffWeeks + 1)

                if let r = item.reading, r.week == nil {
                    let targetWeek: Week
                    if let existing = weeks.first(where: { $0.weekNumber == derivedWeekNum }) {
                        targetWeek = existing
                    } else {
                        let nw = Week(id: UUID(), weekNumber: derivedWeekNum, theme: "Week \(derivedWeekNum) Schedule")
                        nw.course = self
                        weeks.append(nw)
                        modelContext?.insert(nw)
                        targetWeek = nw
                    }
                    r.week = targetWeek
                    if !targetWeek.readings.contains(where: { $0.persistentModelID == r.persistentModelID }) {
                        targetWeek.readings.append(r)
                    }
                } else if let a = item.assignment {
                    if a.weekNumber <= 0 {
                        a.weekNumber = derivedWeekNum
                    }
                }
            }

            // For undated readings, guarantee they remain linked to Week 1 or their current week
            for r in allNonDeletedReadings where r.dueDate == nil {
                if r.week == nil {
                    let defaultWeek = weeks.first(where: { $0.weekNumber == 1 }) ?? weeks.first
                    if let dw = defaultWeek {
                        r.week = dw
                        if !dw.readings.contains(where: { $0.persistentModelID == r.persistentModelID }) {
                            dw.readings.append(r)
                        }
                    }
                }
            }
            for a in allNonDeletedAssignments where a.dueDate == nil {
                if a.weekNumber <= 0 {
                    a.weekNumber = 1
                }
            }
        } else {
            // For courses without dates, ensure all readings and assignments are assigned to valid weeks (defaulting to Week 1)
            let defaultWeek = weeks.first(where: { $0.weekNumber == 1 }) ?? weeks.first
            for w in weeks {
                for r in w.readings {
                    if r.week == nil, let dw = defaultWeek {
                        r.week = dw
                        if !dw.readings.contains(where: { $0.persistentModelID == r.persistentModelID }) {
                            dw.readings.append(r)
                        }
                    }
                }
            }
            for a in assignments {
                if a.weekNumber <= 0 {
                    a.weekNumber = 1
                }
            }
        }
    }

    private static var courseHasDocModulesCache: [UUID: Bool] = [:]
    private static var courseModuleCache: [UUID: [Int: String]] = [:]

    public static func invalidateModuleCache(for courseId: UUID? = nil) {
        if let courseId {
            courseHasDocModulesCache.removeValue(forKey: courseId)
            courseModuleCache.removeValue(forKey: courseId)
        } else {
            courseHasDocModulesCache.removeAll()
            courseModuleCache.removeAll()
        }
    }

    public var hasDocumentModules: Bool {
        if let cached = Self.courseHasDocModulesCache[id] {
            return cached
        }
        var fullText = ""
        for doc in syllabusDocs {
            if let data = doc.rawFileData, let pdf = PDFDocument(data: data) {
                fullText += (0..<pdf.pageCount).compactMap { pdf.page(at: $0)?.string }.joined(separator: "\n") + "\n"
            } else if let contact = doc.instructorContact, !contact.isEmpty {
                fullText += contact + "\n"
            }
        }
        if fullText.isEmpty {
            Self.courseHasDocModulesCache[id] = false
            return false
        }
        
        let clean = fullText
            .replacingOccurrences(of: #"(?i)\bMODU\s*[\r\n]+\s*LE"#, with: "MODULE", options: .regularExpression)
            .replacingOccurrences(of: #"(?i)\bMODU\s+LE"#, with: "MODULE", options: .regularExpression)
            .replacingOccurrences(of: #"(?i)\bMOD\s*[\r\n]+\s*ULE"#, with: "MODULE", options: .regularExpression)
            .replacingOccurrences(of: #"(?i)\bM\s*[\r\n]+\s*ODULE"#, with: "MODULE", options: .regularExpression)
        
        // 1. Explicit schedule table header with module
        let headerPattern = #"(?i)\b(?:week\s+modules|modules\s+topics|topics,\s*modules|module\s*(?:and|&|/)\s*week|week\s*(?:and|&|/)\s*module|module\s+readings|module\s+schedule)\b"#
        if clean.range(of: headerPattern, options: .regularExpression) != nil {
            Self.courseHasDocModulesCache[id] = true
            return true
        }
        
        // 2. Count distinct module numbers in the document (must have at least 2 distinct module numbers, e.g. Module 1, Module 2...)
        let moduleRegex = try? NSRegularExpression(pattern: #"(?i)\bmodule\s*(\d{1,2})\b"#)
        let matches = moduleRegex?.matches(in: clean, range: NSRange(clean.startIndex..., in: clean)) ?? []
        let moduleNums = Set(matches.compactMap { match -> Int? in
            guard match.numberOfRanges > 1 else { return nil }
            let r = match.range(at: 1)
            let s = (clean as NSString).substring(with: r)
            return Int(s)
        })
        
        let result = moduleNums.count >= 2
        Self.courseHasDocModulesCache[id] = result
        return result
    }

    public func cachedModuleForWeek(_ weekNum: Int) -> String? {
        guard hasDocumentModules else { return nil }
        if let cachedMap = Self.courseModuleCache[id] {
            return cachedMap[weekNum]
        }
        var fullText = ""
        for doc in syllabusDocs {
            if let data = doc.rawFileData, let pdf = PDFDocument(data: data) {
                fullText += (0..<pdf.pageCount).compactMap { pdf.page(at: $0)?.string }.joined(separator: "\n") + "\n"
            }
            if fullText.isEmpty, let contact = doc.instructorContact {
                fullText += contact + "\n"
            }
        }
        if !fullText.isEmpty {
            let (wMap, _) = ModuleExtractor.extractModulesFromText(fullText)
            Self.courseModuleCache[id] = wMap
            return wMap[weekNum]
        }
        Self.courseModuleCache[id] = [:]
        return nil
    }

    public func cacheModule(_ moduleStr: String, forWeek weekNum: Int) {
        if Self.courseModuleCache[id] != nil {
            Self.courseModuleCache[id]?[weekNum] = moduleStr
        } else {
            Self.courseModuleCache[id] = [weekNum: moduleStr]
        }
    }
}

@Model
public final class Week {
    @Attribute(.unique) public var id: UUID
    public var weekNumber: Int
    public var startDate: Date?
    public var theme: String?
    public var dateRangeStr: String?

    public var course: Course?

    @Relationship(deleteRule: .cascade, inverse: \Reading.week)
    public var readings: [Reading] = []

    public init(
        id: UUID = UUID(),
        weekNumber: Int,
        startDate: Date? = nil,
        theme: String? = nil,
        dateRangeStr: String? = nil
    ) {
        self.id = id
        self.weekNumber = weekNumber
        self.startDate = startDate
        self.theme = theme
        self.dateRangeStr = dateRangeStr
    }

    public var computedStartDate: Date {
        if let start = startDate {
            return start
        }
        return WeekDateConverter.date(forWeek: weekNumber)
    }

    public var computedEndDate: Date? {
        if let start = startDate {
            return Calendar.current.date(byAdding: .day, value: 6, to: start)
        }
        return Calendar.current.date(byAdding: .day, value: 6, to: computedStartDate)
    }

    public var moduleMention: String? {
        guard let course = course, course.hasDocumentModules else { return nil }
        if let t = theme, let modRange = t.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
            return String(t[modRange]).capitalized
        }
        if let firstMod = readings.compactMap({ $0.moduleMention }).first {
            return firstMod
        }
        if let cached = course.cachedModuleForWeek(weekNumber) {
            return cached
        }
        return nil
    }
}

public enum MediaType: String, Codable, CaseIterable {
    case textbook = "textbook"
    case article = "article"
    case video = "video"
    case podcast = "podcast"

    public var iconName: String {
        switch self {
        case .textbook: return "book.fill"
        case .article: return "newspaper.fill"
        case .video: return "play.rectangle.fill"
        case .podcast: return "headphones"
        }
    }

    public var displayName: String {
        self.rawValue.capitalized
    }
}

@Model
public final class Reading {
    @Attribute(.unique) public var id: UUID = UUID()
    public var title: String = ""
    public var authorName: String?
    public var resourceTitle: String?
    public var mediaTypeRaw: String = "textbook"
    public var isCompleted: Bool = false
    public var isDeleted: Bool = false
    public var summaryText: String = ""
    public var keyTakeawaysText: String = ""
    public var estimatedTimeText: String = ""
    public var videoUrl: String?
    public var sourcePageNumber: Int?
    public var dueDate: Date?
    public var dateRangeStr: String?
    public var chapterText: String?
    public var pagesText: String?
    public var courseCode: String?
    public var semanticCategoryRaw: String?
    public var relevantTopics: String?
    public var sourceDocumentName: String?
    public var docColorHex: String?
    public var isFavorite: Bool = false
    
    public var week: Week?

    public var mediaType: MediaType {
        get { MediaType(rawValue: mediaTypeRaw) ?? .textbook }
        set { mediaTypeRaw = newValue.rawValue }
    }

    public init(
        id: UUID = UUID(),
        title: String,
        authorName: String? = nil,
        resourceTitle: String? = nil,
        mediaType: MediaType = .textbook,
        isCompleted: Bool = false,
        isDeleted: Bool = false,
        summaryText: String = "",
        keyTakeawaysText: String = "",
        estimatedTimeText: String = "",
        videoUrl: String? = nil,
        sourcePageNumber: Int? = nil,
        dueDate: Date? = nil,
        dateRangeStr: String? = nil,
        chapterText: String? = nil,
        pagesText: String? = nil,
        courseCode: String? = nil,
        semanticCategoryRaw: String? = "reading",
        relevantTopics: String? = nil,
        sourceDocumentName: String? = nil,
        docColorHex: String? = nil,
        isFavorite: Bool = false
    ) {
        self.id = id
        self.title = title
        self.authorName = authorName
        self.resourceTitle = resourceTitle
        self.mediaTypeRaw = mediaType.rawValue
        self.isCompleted = isCompleted
        self.isDeleted = isDeleted
        self.summaryText = summaryText
        self.keyTakeawaysText = keyTakeawaysText
        self.estimatedTimeText = estimatedTimeText
        self.videoUrl = videoUrl
        self.sourcePageNumber = sourcePageNumber
        self.dueDate = dueDate
        self.dateRangeStr = dateRangeStr
        self.chapterText = chapterText
        self.pagesText = pagesText
        self.courseCode = courseCode
        self.semanticCategoryRaw = semanticCategoryRaw
        self.relevantTopics = relevantTopics
        self.sourceDocumentName = sourceDocumentName
        self.docColorHex = docColorHex
        self.isFavorite = isFavorite
    }

    public var displaySourceDocument: String? {
        if let doc = sourceDocumentName, !doc.isEmpty { return doc }
        if let firstDoc = week?.course?.syllabusDocs.first?.docTitle, !firstDoc.isEmpty { return firstDoc }
        return nil
    }

    public var sourceDocumentHexColor: String {
        if let hex = docColorHex, !hex.isEmpty { return hex }
        if let docHex = week?.course?.syllabusDocs.first(where: { $0.docTitle.lowercased() == sourceDocumentName?.lowercased() })?.docColorHex {
            return docHex
        }
        if let firstDocHex = week?.course?.syllabusDocs.first?.docColorHex, !firstDocHex.isEmpty {
            return firstDocHex
        }
        if let cHex = week?.course?.hexColor {
            return CourseImporter.pickDocumentColor(forCourseHex: cHex, docIndex: 0)
        }
        return "#7C3AED"
    }

    public static func expandChapterToFullWord(_ text: String?) -> String? {
        guard let t = text?.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty else { return nil }
        var result = t
        if let r = result.range(of: #"(?i)^\s*(?:chapters?|chaps?\.?|chs?\.?)\s*"#, options: .regularExpression) {
            result = result.replacingCharacters(in: r, with: "Chapter ")
        } else if result.range(of: #"^\d+"#, options: .regularExpression) != nil {
            result = "Chapter " + result
        } else {
            result = result.replacingOccurrences(of: #"(?i)\b(?:chapters?|chaps?\.?|chs?\.?)\s*"#, with: "Chapter ", options: .regularExpression)
        }
        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public var chapterAndPagesDisplay: String? {
        var parts: [String] = []
        if let ch = chapterText, !ch.trimmingCharacters(in: .whitespaces).isEmpty {
            let fullCh = Reading.expandChapterToFullWord(ch) ?? ch
            parts.append(fullCh)
        }
        if let pg = pagesText, !pg.trimmingCharacters(in: .whitespaces).isEmpty {
            parts.append(pg)
        }
        return parts.isEmpty ? nil : parts.joined(separator: " • ")
    }

    public var authorAndChaptersSubtitle: String? {
        var parts: [String] = []
        let lowerTitle = title.lowercased()
        if let auth = authorName?.trimmingCharacters(in: .whitespacesAndNewlines), !auth.isEmpty {
            let cleanAuth = auth.replacingOccurrences(of: #"^[:;\-\s]+|[:;\-\s]+$"#, with: "", options: .regularExpression)
            if !cleanAuth.isEmpty && !lowerTitle.contains(cleanAuth.lowercased()) {
                parts.append(cleanAuth)
            }
        }
        
        let titleHasChapter = lowerTitle.range(of: #"(?i)\b(chapters?|chs?\.?)\s*\d+"#, options: .regularExpression) != nil
        
        if let ch = chapterText?.trimmingCharacters(in: .whitespacesAndNewlines), !ch.isEmpty {
            var cleanCh = ch.replacingOccurrences(of: #"^[:;\-\s]+|[:;\-\s]+$"#, with: "", options: .regularExpression)
            if titleHasChapter {
                // Strip out chapter mentions from ch since title already has it
                cleanCh = cleanCh.replacingOccurrences(of: #"(?i)\b(chapters?|chs?\.?)\s*\d+([\s&,\-–]+\d+)?\s*[:•·\-–]*\s*"#, with: "", options: .regularExpression)
                    .replacingOccurrences(of: #"^[:;\-\s•·]+|[:;\-\s•·]+$"#, with: "", options: .regularExpression)
            } else {
                cleanCh = Reading.expandChapterToFullWord(cleanCh) ?? cleanCh
            }
            if !cleanCh.isEmpty && !lowerTitle.contains(cleanCh.lowercased()) {
                parts.append(cleanCh)
            }
        } else if !titleHasChapter, let chDisplay = chapterAndPagesDisplay, !chDisplay.isEmpty {
            let cleanCh = chDisplay.replacingOccurrences(of: #"^[:;\-\s]+|[:;\-\s]+$"#, with: "", options: .regularExpression)
            if !cleanCh.isEmpty && !lowerTitle.contains(cleanCh.lowercased()) {
                parts.append(cleanCh)
            }
        }
        
        if let pg = pagesText?.trimmingCharacters(in: .whitespacesAndNewlines), !pg.isEmpty {
            let cleanPg = pg.replacingOccurrences(of: #"^[:;\-\s]+|[:;\-\s]+$"#, with: "", options: .regularExpression)
            if !cleanPg.isEmpty && !lowerTitle.contains(cleanPg.lowercased()) && !parts.contains(where: { $0.lowercased().contains(cleanPg.lowercased()) }) {
                parts.append(cleanPg)
            }
        }
        
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    public var cleanChapterText: String? {
        var rawCh: String? = nil
        
        if let ch = chapterText?.trimmingCharacters(in: .whitespacesAndNewlines), !ch.isEmpty {
            rawCh = ch
        } else if let match = title.range(of: #"(?i)\s*[\(\[]\s*((?:chapters?|chaps?\.?|chs?\.?)\s*\d+[\s&,\-–\d]*)\s*[\)\]]"#, options: .regularExpression) {
            rawCh = String(title[match]).replacingOccurrences(of: #"[()\[\]]"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        } else if let match = title.range(of: #"(?i)\s*[:\-–]\s*((?:chapters?|chaps?\.?|chs?\.?)\s*\d+[\s&,\-–\d]*)$"#, options: .regularExpression) {
            rawCh = String(title[match]).replacingOccurrences(of: #"^[:\-–\s]+"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        } else if !summaryText.isEmpty {
            let (extCh, _) = LocalSyllabusParser.shared.extractChapterAndPages(from: summaryText)
            if let extCh = extCh, !extCh.isEmpty {
                rawCh = extCh
            }
        } else if let chDisplay = chapterAndPagesDisplay, !chDisplay.isEmpty {
            let clean = chDisplay.replacingOccurrences(of: #"^[:;\-\s•·]+|[:;\-\s•·]+$"#, with: "", options: .regularExpression)
            if !clean.isEmpty { rawCh = clean }
        }
        
        guard let found = rawCh?.trimmingCharacters(in: .whitespacesAndNewlines), !found.isEmpty else {
            return nil
        }
        
        let cleanCh = found.replacingOccurrences(of: #"^[:;\-\s•·]+|[:;\-\s•·]+$"#, with: "", options: .regularExpression)
        var digitsAndDetails = cleanCh.replacingOccurrences(of: #"(?i)^\s*(?:chapters?|chaps?\.?|chs?\.?)\s*"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"^[:;\-\s•·.]+|[:;\-\s•·.]+$"#, with: "", options: .regularExpression)
        
        if digitsAndDetails.isEmpty {
            digitsAndDetails = cleanCh
        }
        
        return "Chapter \(digitsAndDetails)"
    }

    public var displayTitleWithChapter: String {
        let cleanTitle = cleanDisplayTitle
        if let ch = cleanChapterText, !ch.isEmpty {
            let lowerTitle = cleanTitle.lowercased()
            let lowerCh = ch.lowercased()
            if lowerTitle.hasPrefix("chapter") || lowerTitle.hasPrefix("ch.") || lowerTitle.hasPrefix("ch ") {
                let strippedTitle = cleanTitle.replacingOccurrences(of: #"(?i)^\s*(?:chapters?|chaps?\.?|chs?\.?)\s*[\d\s,&–\-and]+\s*[:\-–·•.]*\s*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                if !strippedTitle.isEmpty {
                    return "\(ch) · \(strippedTitle)"
                }
                return ch
            }
            if !lowerTitle.contains(lowerCh) {
                return "\(ch) · \(cleanTitle)"
            }
        }
        return cleanTitle
    }

    public var authorAndPagesSubtitle: String? {
        var parts: [String] = []
        let lowerTitle = title.lowercased()
        if let auth = authorName?.trimmingCharacters(in: .whitespacesAndNewlines), !auth.isEmpty {
            let cleanAuth = auth.replacingOccurrences(of: #"^[:;\-\s]+|[:;\-\s]+$"#, with: "", options: .regularExpression)
            if !cleanAuth.isEmpty && !lowerTitle.contains(cleanAuth.lowercased()) {
                parts.append(cleanAuth)
            }
        }
        
        if let pg = pagesText?.trimmingCharacters(in: .whitespacesAndNewlines), !pg.isEmpty {
            var cleanPg = pg.replacingOccurrences(of: #"^[:;\-\s]+|[:;\-\s]+$"#, with: "", options: .regularExpression)
            if !cleanPg.isEmpty && !lowerTitle.contains(cleanPg.lowercased()) && !parts.contains(where: { $0.lowercased().contains(cleanPg.lowercased()) }) {
                if !cleanPg.lowercased().hasPrefix("pp") && !cleanPg.lowercased().hasPrefix("p.") && cleanPg.range(of: #"^\d+"#, options: .regularExpression) != nil {
                    cleanPg = "pp. \(cleanPg)"
                }
                parts.append(cleanPg)
            }
        }
        
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    public var computedTopics: [String] {
        if let explicit = relevantTopics, !explicit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let items = explicit.components(separatedBy: CharacterSet(charactersIn: ",|;\n"))
                .map { $0.replacingOccurrences(of: #"(?i)^\s*week\s*\d+\s*(schedule|topics)?\s*:?\s*"#, with: "", options: .regularExpression)
                         .replacingOccurrences(of: "•", with: "")
                         .trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { item in
                    let lower = item.lowercased()
                    guard !item.isEmpty && !lower.hasPrefix("week ") && item.count >= 3 && !lower.contains("required reading for") else { return false }
                    if lower.hasPrefix("module") || lower.hasPrefix("mod ") || lower == "module" {
                        return false
                    }
                    if item.range(of: #"(?i)^\s*module\s*\d+\b"#, options: .regularExpression) != nil {
                        return false
                    }
                    return true
                }
            if !items.isEmpty {
                return items
            }
        }
        if let weekTheme = week?.theme, !weekTheme.isEmpty {
            let cleanTheme = weekTheme.replacingOccurrences(of: #"(?i)^\s*week\s*\d+\s*(schedule|topics)?\s*:?\s*"#, with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !cleanTheme.isEmpty && !cleanTheme.lowercased().hasPrefix("week ") {
                let parts = cleanTheme.components(separatedBy: CharacterSet(charactersIn: ",|;&"))
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { item in
                        let lower = item.lowercased()
                        guard !item.isEmpty && item.count >= 3 else { return false }
                        if lower.hasPrefix("module") || lower.hasPrefix("mod ") || lower == "module" {
                            return false
                        }
                        if item.range(of: #"(?i)^\s*module\s*\d+\b"#, options: .regularExpression) != nil {
                            return false
                        }
                        return true
                    }
                if !parts.isEmpty {
                    return parts
                }
            }
        }
        return []
    }

    public var contextBadgeText: String? {
        if let course = week?.course, course.hasDocumentModules {
            if let w = week, w.weekNumber > 0 {
                if let theme = w.theme, theme.lowercased().contains("module") {
                    if let modRange = theme.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
                        return String(theme[modRange]).capitalized
                    }
                }
            }
            if let explicit = relevantTopics, let modRange = explicit.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
                return String(explicit[modRange]).capitalized
            }
        }
        if let w = week, w.weekNumber > 0 {
            return "Week \(w.weekNumber)"
        }
        if mediaType != .article {
            return mediaType.displayName
        }
        if let firstTopic = computedTopics.first {
            return firstTopic
        }
        return nil
    }

    public var moduleMention: String? {
        guard let course = week?.course, course.hasDocumentModules else { return nil }
        if let explicit = relevantTopics, let modRange = explicit.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
            return String(explicit[modRange]).capitalized
        }
        if let theme = week?.theme,
           let modRange = theme.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
            return String(theme[modRange]).capitalized
        }
        if let res = resourceTitle, let modRange = res.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
            return String(res[modRange]).capitalized
        }
        if let t = title.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
            return String(title[t]).capitalized
        }
        if let ch = chapterText, let modRange = ch.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
            return String(ch[modRange]).capitalized
        }
        if !summaryText.isEmpty, let modRange = summaryText.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
            return String(summaryText[modRange]).capitalized
        }
        if let w = week, let mod = w.moduleMention {
            return mod
        }
        if let wNum = week?.weekNumber, wNum > 0 {
            if let cachedMod = course.cachedModuleForWeek(wNum) {
                return cachedMod
            }
        }
        return nil
    }

    public var cleanDisplayTitle: String {
        if let res = resourceTitle?.trimmingCharacters(in: .whitespacesAndNewlines), !res.isEmpty {
            if let auth = authorName?.trimmingCharacters(in: .whitespacesAndNewlines), !auth.isEmpty {
                if res.lowercased().contains(auth.lowercased()) {
                    return res
                } else {
                    return "\(auth): \(res)"
                }
            }
            return res
        }

        var raw = title.trimmingCharacters(in: .whitespacesAndNewlines)

        // 1. Strip XML tags
        raw = raw.replacingOccurrences(of: #"<[^>]+>"#, with: "", options: .regularExpression)

        // 2. Strip table header words if present in title
        let headerNoise = #"(?i)^\s*(?:modules|topics|related readings|course session/date|topics,\s*modules,\s*and\s*assignments|readings)+\s*"#
        raw = raw.replacingOccurrences(of: headerNoise, with: "", options: .regularExpression)

        // 3. Extract citation if citation pattern is matched (e.g. "Gehart (Chapters 1-3)" out of "Module 1 Systems Theory... Gehart (Chapters 1-3)")
        let citationPattern = #"(?i)\b((?:Gehart|Nichols|Davis|[A-Z][a-z]+)?\s*\(?\s*(?:chapters?|ch\.?|chap\.?)\s*\d+[^)]*\)?|\barticles?\b)"#
        if let regex = try? NSRegularExpression(pattern: citationPattern),
           let match = regex.firstMatch(in: raw, options: [], range: NSRange(location: 0, length: raw.utf16.count)),
           let citationRange = Range(match.range, in: raw) {
            let citation = String(raw[citationRange]).trimmingCharacters(in: .whitespacesAndNewlines)
            if citation.lowercased() == "articles" || citation.lowercased() == "article" {
                return "Required Articles"
            }
            return citation
        }

        // 4. Strip prefix noise
        raw = raw.replacingOccurrences(of: #"(?i)^\s*(?:readings?|read|watch|listen|required|module\s*\d+|unit\s*\d+|week\s*\d+)\s*[:\-–]*\s*"#, with: "", options: .regularExpression)

        // 5. Clean punctuation & remnants
        raw = raw.replacingOccurrences(of: #"\s*[:;\-–]\s*$"#, with: "", options: .regularExpression)
        raw = raw.replacingOccurrences(of: #"^\s*[:;\-–]\s*"#, with: "", options: .regularExpression)

        // 6. Cap words to max 6
        let words = raw.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
        if words.count > 6 {
            return words.prefix(6).joined(separator: " ")
        }

        return raw.isEmpty ? "Reading" : raw
    }
}

// MARK: - Assignment Model
@Model
public final class Assignment {
    @Attribute(.unique) public var id: UUID
    public var title: String
    public var weekNumber: Int
    public var dueDate: Date?
    public var fullInstructions: String?
    public var pointsPossible: String?
    public var pointsBreakdown: String?
    public var rubricJSON: String?
    public var noteText: String?
    public var isCompleted: Bool
    public var isDeleted: Bool
    public var courseCode: String?
    public var weightPercentage: String?
    public var subTypeRaw: String?
    public var mediaUrl: String?
    public var relevantTopics: String?
    public var sourceDocumentName: String?
    public var docColorHex: String?
    public var isFavorite: Bool = false
    
    public var course: Course?

    public var rubricCriteria: [RubricCriterionDTO] {
        if let data = rubricJSON?.data(using: .utf8),
           let items = try? JSONDecoder().decode([RubricCriterionDTO].self, from: data), !items.isEmpty {
            return items
        }
        return []
    }

    public var cleanDisplayTitle: String {
        var raw = title.trimmingCharacters(in: .whitespacesAndNewlines)

        // 1. Strip XML tags
        raw = raw.replacingOccurrences(of: #"<[^>]+>"#, with: "", options: .regularExpression)

        // 2. Strip table header words
        let headerNoise = #"(?i)^\s*(?:modules|topics|related readings|course session/date|topics,\s*modules,\s*and\s*assignments|readings)+\s*"#
        raw = raw.replacingOccurrences(of: headerNoise, with: "", options: .regularExpression)

        // 3. Strip points / percentage / dates / prefix noise
        raw = raw.replacingOccurrences(of: #"(?i)\s*\(?\b\d{1,3}%\)?\s*"#, with: " ", options: .regularExpression)
        raw = raw.replacingOccurrences(of: #"(?i)\s*\(?\b\d{1,4}\s*(?:pts|points|pt)\b\)?\s*"#, with: " ", options: .regularExpression)
        raw = raw.replacingOccurrences(of: #"(?i)^\s*(?:assignments?|due|required|overview of|module\s*\d+|unit\s*\d+|week\s*\d+)\s*[:\-–]*\s*"#, with: "", options: .regularExpression)

        // 4. Cap words to max 12
        let words = raw.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
        if words.count > 12 {
            return words.prefix(12).joined(separator: " ")
        }

        return raw.isEmpty ? "Assignment" : raw
    }

    public var weekOrModuleDisplay: String {
        if weekNumber > 0 {
            return "Week \(weekNumber)"
        }
        if let explicit = relevantTopics, !explicit.isEmpty {
            return explicit
        }
        return "Assignment"
    }

    public init(
        id: UUID = UUID(),
        title: String,
        weekNumber: Int = 1,
        dueDate: Date? = nil,
        fullInstructions: String? = nil,
        pointsPossible: String? = nil,
        pointsBreakdown: String? = nil,
        rubricJSON: String? = nil,
        noteText: String? = nil,
        isCompleted: Bool = false,
        isDeleted: Bool = false,
        courseCode: String? = nil,
        weightPercentage: String? = nil,
        subTypeRaw: String? = "PAPER",
        mediaUrl: String? = nil,
        relevantTopics: String? = nil,
        sourceDocumentName: String? = nil,
        docColorHex: String? = nil,
        isFavorite: Bool = false
    ) {
        self.id = id
        self.title = title
        self.weekNumber = weekNumber
        self.dueDate = dueDate
        self.fullInstructions = fullInstructions
        self.pointsPossible = pointsPossible
        self.pointsBreakdown = pointsBreakdown
        self.rubricJSON = rubricJSON
        self.noteText = noteText
        self.isCompleted = isCompleted
        self.isDeleted = isDeleted
        self.courseCode = courseCode
        self.weightPercentage = weightPercentage
        self.subTypeRaw = subTypeRaw
        self.mediaUrl = mediaUrl
        self.relevantTopics = relevantTopics
        self.sourceDocumentName = sourceDocumentName
        self.docColorHex = docColorHex
        self.isFavorite = isFavorite
    }

    public var displaySourceDocument: String? {
        if let doc = sourceDocumentName, !doc.isEmpty { return doc }
        if let firstDoc = course?.syllabusDocs.first?.docTitle, !firstDoc.isEmpty { return firstDoc }
        return nil
    }

    public var sourceDocumentHexColor: String {
        return CourseImporter.resolveDocumentHexColor(
            title: sourceDocumentName ?? title,
            course: course,
            docColorHex: docColorHex
        )
    }

    public var computedTopics: [String] {
        if let explicit = relevantTopics, !explicit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let items = explicit.components(separatedBy: CharacterSet(charactersIn: ",|;\n"))
                .map { $0.replacingOccurrences(of: #"(?i)^\s*week\s*\d+\s*(schedule|topics)?\s*:?\s*"#, with: "", options: .regularExpression)
                         .replacingOccurrences(of: "•", with: "")
                         .trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { item in
                    let lower = item.lowercased()
                    guard !item.isEmpty && !lower.hasPrefix("week ") && item.count >= 3 else { return false }
                    if lower.hasPrefix("module") || lower.hasPrefix("mod ") || lower == "module" {
                        return false
                    }
                    if item.range(of: #"(?i)^\s*module\s*\d+\b"#, options: .regularExpression) != nil {
                        return false
                    }
                    return true
                }
            if !items.isEmpty {
                return items
            }
        }
        return []
    }

    public var contextBadgeText: String? {
        if let course = course, course.hasDocumentModules {
            if weekNumber > 0 {
                if let wTheme = course.weeks.first(where: { $0.weekNumber == weekNumber })?.theme,
                   wTheme.lowercased().contains("module"),
                   let modRange = wTheme.range(of: #"(?i)\b(module\s*\d+)\b"#, options: .regularExpression) {
                    return String(wTheme[modRange]).capitalized
                }
            }
            if let explicit = relevantTopics, let modRange = explicit.range(of: #"(?i)\b(module\s*\d+)\b"#, options: .regularExpression) {
                return String(explicit[modRange]).capitalized
            }
        }
        if weekNumber > 0 {
            return "Week \(weekNumber)"
        }
        if let subType = subTypeRaw, !subType.isEmpty, subType.uppercased() != "OTHER" {
            return subType.capitalized
        }
        if let weight = weightPercentage, !weight.isEmpty {
            return weight
        }
        return nil
    }

    public var moduleMention: String? {
        guard let course = course, course.hasDocumentModules else { return nil }
        if let explicit = relevantTopics, let modRange = explicit.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
            return String(explicit[modRange]).capitalized
        }
        if let wTheme = course.weeks.first(where: { $0.weekNumber == weekNumber })?.theme,
           let modRange = wTheme.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
            return String(wTheme[modRange]).capitalized
        }
        if let t = title.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
            return String(title[t]).capitalized
        }
        if let desc = fullInstructions, let modRange = desc.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
            return String(desc[modRange]).capitalized
        }
        if weekNumber > 0 {
            if let cachedMod = course.cachedModuleForWeek(weekNumber) {
                return cachedMod
            }
        }
        return nil
    }

    public var associatedReadings: [Reading] {
        guard let course = course else { return [] }
        let targetWeek = course.weeks.first(where: { $0.weekNumber == weekNumber })
        return targetWeek?.readings.filter { !$0.isDeleted } ?? []
    }

    public var displaySubType: String {
        subTypeRaw?.uppercased() ?? "PAPER"
    }

    public var subTypeIconName: String {
        switch (subTypeRaw ?? "").uppercased() {
        case "TEXTBOOK": return "book.fill"
        case "ARTICLE": return "doc.text.fill"
        case "VIDEO": return "play.tv.fill"
        case "PODCAST": return "waveform.path.ecg"
        case "IN_CLASS": return "person.3.fill"
        case "PAPER": return "doc.richtext.fill"
        case "PRESENTATION": return "rectangle.inset.topleft.filled"
        default: return "doc.fill"
        }
    }
}

@Model
public final class SyllabusDocument {
    @Attribute(.unique) public var id: UUID
    public var docTitle: String
    public var officeHoursText: String?
    public var instructorContact: String?
    public var gradingPolicyText: String?
    public var fileName: String?
    @Attribute(.externalStorage) public var rawFileData: Data?
    public var uploadedAt: Date
    public var courseCode: String?
    public var docColorHex: String?
    
    public var course: Course?

    public init(
        id: UUID = UUID(),
        docTitle: String,
        officeHoursText: String? = nil,
        instructorContact: String? = nil,
        gradingPolicyText: String? = nil,
        fileName: String? = nil,
        rawFileData: Data? = nil,
        uploadedAt: Date = Date(),
        courseCode: String? = nil,
        docColorHex: String? = nil
    ) {
        self.id = id
        self.docTitle = docTitle
        self.officeHoursText = officeHoursText
        self.instructorContact = instructorContact
        self.gradingPolicyText = gradingPolicyText
        self.fileName = fileName
        self.rawFileData = rawFileData
        self.uploadedAt = uploadedAt
        self.courseCode = courseCode
        self.docColorHex = docColorHex
    }
}

@Model
public final class VaultDocument {
    @Attribute(.unique) public var id: UUID
    public var title: String
    public var category: String
    public var fileSize: String
    public var fileType: String
    public var courseCode: String?
    public var fileContent: String?
    public var docColorHex: String?
    @Attribute(.externalStorage) public var rawFileData: Data?
    public var uploadedAt: Date

    public init(
        id: UUID = UUID(),
        title: String,
        category: String = "Raw Prompt PDF",
        fileSize: String = "1.5 MB",
        fileType: String = "PDF",
        courseCode: String? = nil,
        fileContent: String? = nil,
        docColorHex: String? = nil,
        rawFileData: Data? = nil,
        uploadedAt: Date = Date()
    ) {
        self.id = id
        self.title = title
        self.category = category
        self.fileSize = fileSize
        self.fileType = fileType
        self.courseCode = courseCode
        self.fileContent = fileContent
        self.docColorHex = docColorHex
        self.rawFileData = rawFileData
        self.uploadedAt = uploadedAt
    }
}

// MARK: - Dedicated Faculty & Contact Information Extractor
public struct FacultyExtractor {
    public static func extractFaculty(from rawText: String) -> (name: String?, email: String?) {
        var detectedName: String? = nil
        var detectedEmail: String? = nil

        let lines = rawText.components(separatedBy: .newlines)
        let searchLines = Array(lines.prefix(150))

        // 1. Email Extraction
        let emailRegex = #"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"#
        for line in searchLines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if let range = trimmed.range(of: emailRegex, options: .regularExpression) {
                let candidate = String(trimmed[range])
                let lower = candidate.lowercased()
                if !lower.contains("helpdesk") && !lower.contains("support@") && !lower.contains("info@") && !lower.contains("registrar@") {
                    detectedEmail = candidate
                    break
                } else if detectedEmail == nil {
                    detectedEmail = candidate
                }
            }
        }

        // 2. Faculty Name Extraction via Prefix Patterns
        let namePrefixPatterns = [
            #"(?i)^\s*(?:Primary\s+Faculty|Faculty\s+Information|Course\s+Faculty|Faculty\s+Member|Primary\s+Instructor|Course\s+Instructor|Instructor\s+Name|Instructor|Professor|Faculty)\s*[:\-–]\s*(.+)$"#,
            #"(?i)^\s*(?:Dr\.|Prof\.|Professor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+.*)$"#
        ]

        for line in searchLines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }

            for pat in namePrefixPatterns {
                if let regex = try? NSRegularExpression(pattern: pat) {
                    let nsString = trimmed as NSString
                    let results = regex.matches(in: trimmed, range: NSRange(location: 0, length: nsString.length))
                    if let match = results.first, match.numberOfRanges > 1 {
                        let extracted = nsString.substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespacesAndNewlines)
                        let cleanName = cleanFacultyName(extracted)
                        if isValidFacultyName(cleanName) {
                            detectedName = cleanName
                            break
                        }
                    }
                }
            }
            if detectedName != nil { break }
        }

        // Fallback: If header line indicates faculty details, check succeeding lines
        if detectedName == nil {
            for (idx, line) in searchLines.enumerated() {
                let lower = line.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if lower == "faculty & contact information" || lower == "faculty information" || lower == "instructor information" || lower == "instructor details" || lower == "course faculty" {
                    for offset in 1...3 {
                        if idx + offset < searchLines.count {
                            let nextLine = searchLines[idx + offset].trimmingCharacters(in: .whitespacesAndNewlines)
                            if !nextLine.isEmpty && !nextLine.lowercased().contains("email") && !nextLine.lowercased().contains("phone") && !nextLine.lowercased().contains("office") {
                                let clean = cleanFacultyName(nextLine)
                                if isValidFacultyName(clean) {
                                    detectedName = clean
                                    break
                                }
                            }
                        }
                    }
                    if detectedName != nil { break }
                }
            }
        }

        return (detectedName, detectedEmail)
    }

    private static func cleanFacultyName(_ raw: String) -> String {
        var name = raw
        if let emailRange = name.range(of: #"(?i)\s*(?:Email|Phone|Office|E-mail)\s*[:\-].*$"#, options: .regularExpression) {
            name = String(name[..<emailRange.lowerBound])
        }
        name = name.trimmingCharacters(in: CharacterSet(charactersIn: " ,;:\t\n"))
        return name
    }

    private static func isValidFacultyName(_ name: String) -> Bool {
        guard name.count >= 3 && name.count <= 75 else { return false }
        let lower = name.lowercased()
        if lower.contains("syllabus") || lower.contains("schedule") || lower.contains("description") || lower.contains("objective") || lower.contains("school of") || lower.contains("university") || lower.contains("credits") {
            return false
        }
        return true
    }
}

// MARK: - Dedicated Module & Schedule Extractor
public struct ModuleExtractor {
    /// Extracts module designations mapped to week numbers and item titles from syllabus text.
    public static func extractModulesFromText(_ rawText: String) -> (weekToModule: [Int: String], itemModules: [String: String]) {
        var weekToModule: [Int: String] = [:]
        var itemModules: [String: String] = [:]
        
        var text = rawText
        // Fix line-split words from narrow PDF table columns
        text = text.replacingOccurrences(of: #"(?i)\bMODU\s*[\r\n]+\s*LE\s*(\d+)"#, with: "MODULE $1", options: .regularExpression)
        text = text.replacingOccurrences(of: #"(?i)\bMODU\s*[\r\n]+\s*LE\b"#, with: "MODULE", options: .regularExpression)
        text = text.replacingOccurrences(of: #"(?i)\bMODU\s+LE"#, with: "MODULE", options: .regularExpression)
        text = text.replacingOccurrences(of: #"(?i)\bMOD\s*[\r\n]+\s*ULE"#, with: "MODULE", options: .regularExpression)
        text = text.replacingOccurrences(of: #"(?i)\bM\s*[\r\n]+\s*ODULE"#, with: "MODULE", options: .regularExpression)
        text = text.replacingOccurrences(of: #"(?i)\bREADI\s*[\r\n]+\s*NG\s*[\r\n]+\s*WEEK\b"#, with: "READING WEEK", options: .regularExpression)
        text = text.replacingOccurrences(of: #"(?i)\bREADI\s*[\r\n]+\s*NG\b"#, with: "READING", options: .regularExpression)
        text = text.replacingOccurrences(of: #"(?i)\bWEE\s*[\r\n]+\s*K"#, with: "WEEK", options: .regularExpression)
        text = text.replacingOccurrences(of: #"(?i)\bWE\s*[\r\n]+\s*EK"#, with: "WEEK", options: .regularExpression)
        text = text.replacingOccurrences(of: #"(?i)\bCHAP\s*[\r\n]+\s*TER"#, with: "CHAPTER", options: .regularExpression)
        text = text.replacingOccurrences(of: #"(?i)\bCH\s*[\r\n]+\s*APTER"#, with: "CHAPTER", options: .regularExpression)
        text = text.replacingOccurrences(of: #"(\d{1,2}/\d{1,2}/2)\s*\n\s*(\d)\b"#, with: "$1$2", options: .regularExpression)
        
        let lines = text.components(separatedBy: .newlines)
        var currentModule: String? = nil
        var currentWeek: Int = 0
        var allDetectedModules: Set<String> = []
        
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { continue }
            
            let lower = trimmed.lowercased()
            // Skip document header timestamps e.g. "8/26/26, 8:28 AM ... Simple Syllabus"
            if lower.contains("simple syllabus") || lower.contains("simplesyllabus") || lower.contains("http") || lower.contains("error_codes") || lower.range(of: #"\d{1,2}/\d{1,2}/\d{2,4},\s*\d{1,2}:\d{2}"#, options: .regularExpression) != nil {
                continue
            }
            
            if lower.contains("reading week") || lower.contains("spring break") {
                currentWeek += 1
                continue
            }
            
            let hasDate = trimmed.range(of: #"\b\d{1,2}/\d{1,2}/(?:\d{2}|\d{4})\b"#, options: .regularExpression) != nil
            
            // Match "Module 1", "Mod 2", "Module 03"
            if let modRange = trimmed.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
                let modStr = String(trimmed[modRange]).capitalized
                currentModule = modStr
                allDetectedModules.insert(modStr)
                
                if let wkRange = trimmed.range(of: #"(?i)\bweek\s*(\d+)\b"#, options: .regularExpression) {
                    let digits = String(trimmed[wkRange]).components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                    if let wNum = Int(digits), wNum > 0 {
                        currentWeek = wNum
                    }
                } else if hasDate {
                    currentWeek += 1
                } else {
                    let digits = modStr.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                    if let mNum = Int(digits), mNum > 0 {
                        if currentWeek < mNum {
                            currentWeek = mNum
                        }
                    }
                }
                
                if currentWeek > 0 {
                    weekToModule[currentWeek] = modStr
                }
            } else if let wkRange = trimmed.range(of: #"(?i)\bweek\s*(\d+)\b"#, options: .regularExpression) {
                let digits = String(trimmed[wkRange]).components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                if let wNum = Int(digits), wNum > 0 {
                    currentWeek = wNum
                    if let mod = currentModule, weekToModule[wNum] == nil {
                        weekToModule[wNum] = mod
                    }
                }
            } else if hasDate && currentModule != nil {
                currentWeek += 1
                if let mod = currentModule, weekToModule[currentWeek] == nil {
                    weekToModule[currentWeek] = mod
                }
            }
            
            if let mod = currentModule {
                if lower.count >= 3 && !lower.hasPrefix("module") && !lower.hasPrefix("week") && !lower.hasPrefix("course schedule") {
                    itemModules[lower] = mod
                }
            }
        }
        
        // Document must explicitly contain modules in its schedule or have multiple distinct modules
        let hasHeader = text.range(of: #"(?i)\b(?:week\s+modules|modules\s+topics|topics,\s*modules|module\s*(?:and|&|/)\s*week|week\s*(?:and|&|/)\s*module|module\s+readings|module\s+schedule)\b"#, options: .regularExpression) != nil
        if !hasHeader && allDetectedModules.count < 2 {
            return ([:], [:])
        }
        
        // Fallback: If modules were detected in course but some weeks 1..16 are missing from weekToModule:
        if !allDetectedModules.isEmpty {
            for mStr in allDetectedModules {
                let digits = mStr.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                if let mNum = Int(digits), mNum > 0, mNum <= 16 {
                    if weekToModule[mNum] == nil {
                        weekToModule[mNum] = mStr
                    }
                }
            }
        }
        
        return (weekToModule, itemModules)
    }
}

public struct CourseImporter {
    public static let masterColorPalette = [
        "#2563EB", // Vibrant Blue
        "#7C3AED", // Royal Purple
        "#059669", // Emerald Green
        "#EA580C", // Deep Orange
        "#DB2777", // Vibrant Pink
        "#0D9488", // Teal Cyan
        "#D97706", // Amber Gold
        "#4F46E5", // Deep Indigo
        "#DC2626", // Crimson Red
        "#E11D48", // Coral Rose
        "#06B6D4", // Aqua Turquoise
        "#9333EA"  // Grape Purple
    ]

    public static func getUniqueColor(usedColors: Set<String>) -> String {
        let normalizedUsed = Set(usedColors.map { $0.lowercased() })
        for color in masterColorPalette {
            if !normalizedUsed.contains(color.lowercased()) {
                return color
            }
        }
        let fallbackIdx = usedColors.count % masterColorPalette.count
        return masterColorPalette[fallbackIdx]
    }

    public static func pickDocumentColor(forCourseHex courseHex: String, docIndex: Int = 0, usedColors: Set<String> = []) -> String {
        let docPalette = [
            "#7C3AED", // Royal Purple
            "#EA580C", // Deep Orange
            "#059669", // Emerald Green
            "#DB2777", // Vibrant Pink
            "#D97706", // Amber Gold
            "#4F46E5", // Indigo
            "#0D9488", // Teal
            "#DC2626", // Crimson Red
            "#8B5CF6", // Violet
            "#06B6D4", // Turquoise
            "#E11D48"  // Rose
        ]
        
        var mergedUsed = Set(usedColors.map { $0.lowercased() })
        mergedUsed.insert(courseHex.lowercased())
        mergedUsed.insert("#2563eb")
        
        let filtered = docPalette.filter { !mergedUsed.contains($0.lowercased()) }
        if !filtered.isEmpty {
            return filtered[docIndex % filtered.count]
        }
        return docPalette[docIndex % docPalette.count]
    }

    public static func normalizeKey(_ str: String) -> String {
        var cleaned = str.lowercased()
            .replacingOccurrences(of: "syllabus", with: "")
            .replacingOccurrences(of: ".pdf", with: "")
            .replacingOccurrences(of: ".docx", with: "")
        
        cleaned = cleaned.replacingOccurrences(of: #"\(\s*doc\s*\d+\s*\)"#, with: "", options: .regularExpression)
        cleaned = cleaned.replacingOccurrences(of: #"doc\s*\d+"#, with: "", options: .regularExpression)
        
        if let dashRange = cleaned.range(of: " - ") {
            cleaned = String(cleaned[dashRange.upperBound...])
        }
        
        return cleaned
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .joined()
    }

    public static func normalizeTitle(_ str: String) -> String {
        return str.lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .joined()
    }

    /// Resolves canonical document color hex for a given document title within a course context.
    /// Enforces strictly unique non-repeating colors across all documents.
    public static func resolveDocumentHexColor(title: String, course: Course?, docColorHex: String? = nil, fallbackIndex: Int = 0, usedColors: Set<String> = []) -> String {
        let docPalette = [
            "#7C3AED", // Royal Purple
            "#EA580C", // Deep Orange
            "#059669", // Emerald Green
            "#DB2777", // Vibrant Pink
            "#D97706", // Amber Gold
            "#4F46E5", // Indigo
            "#0D9488", // Teal
            "#DC2626", // Crimson Red
            "#8B5CF6", // Violet
            "#06B6D4", // Turquoise
            "#E11D48"  // Rose
        ]

        let courseHex = course?.hexColor ?? "#2563EB"
        var mergedUsed = Set(usedColors.map { $0.lowercased() })
        mergedUsed.insert(courseHex.lowercased())

        let filtered = docPalette.filter { !mergedUsed.contains($0.lowercased()) }
        if !filtered.isEmpty {
            return filtered[fallbackIndex % filtered.count]
        }
        return docPalette[fallbackIndex % docPalette.count]
    }

    /// Guaranteed 100% unique non-repeating color index for any vault document list
    public static func getDistinctVaultDocColor(docIndex: Int, courseHex: String? = nil) -> String {
        let docPalette = [
            "#7C3AED", // Royal Purple
            "#EA580C", // Deep Orange
            "#059669", // Emerald Green
            "#DB2777", // Vibrant Pink
            "#D97706", // Amber Gold
            "#4F46E5", // Indigo
            "#0D9488", // Teal
            "#DC2626", // Crimson Red
            "#8B5CF6", // Violet
            "#06B6D4", // Turquoise
            "#E11D48"  // Rose
        ]
        return docPalette[docIndex % docPalette.count]
    }

    public static func isGenericKey(_ key: String) -> Bool {
        let generic = ["course", "syllabus", "syllabuscourse", "crs101", "crs", "scanned", "scannedsyllabus", "camera", "doc", "document", ""]
        return generic.contains(key.lowercased().trimmingCharacters(in: .whitespacesAndNewlines))
    }

    public static func containsSyllabusMarkers(in text: String) -> Bool {
        let lower = text.lowercased()
        
        // 1. Check for email pattern
        let hasEmail = lower.range(of: #"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"#, options: .regularExpression) != nil
        
        // 2. Check for other syllabus signals
        let hasOfficeHours = lower.contains("office hours") || lower.contains("office:")
        let hasInstructor = lower.contains("instructor") || lower.contains("professor") || lower.contains("faculty") || lower.contains("teacher")
        let hasSyllabus = lower.contains("syllabus")
        let hasGrading = lower.contains("grading policy") || lower.contains("grading scale") || lower.contains("course requirements") || lower.contains("rubric")
        
        let score = (hasEmail ? 2 : 0) + (hasSyllabus ? 2 : 0) + (hasOfficeHours ? 1 : 0) + (hasInstructor ? 1 : 0) + (hasGrading ? 1 : 0)
        return score >= 3
    }

    @discardableResult
    public static func importDTO(_ dto: CourseDTO, into modelContext: ModelContext, forceNewCourse: Bool = false) -> Course {
        if !forceNewCourse {
            let descriptor = FetchDescriptor<Course>()
            if let existingCourses = try? modelContext.fetch(descriptor) {
                let targetCodeKey = normalizeKey(dto.courseCode ?? "")
                let targetNameKey = normalizeKey(dto.courseName)

                if !isGenericKey(targetCodeKey) && !isGenericKey(targetNameKey) && !targetCodeKey.isEmpty && !targetNameKey.isEmpty {
                    if let existing = existingCourses.first(where: { course in
                        let cCodeKey = normalizeKey(course.courseCode ?? "")
                        let cNameKey = normalizeKey(course.courseName)
                        return targetCodeKey == cCodeKey && targetNameKey == cNameKey
                    }) {
                        return importDTO(dto, into: existing, modelContext: modelContext)
                    }
                }
            }
        }

        let stableId: UUID
        if let parsed = UUID(uuidString: dto.id) {
            stableId = parsed
        } else {
            let seed = (dto.courseName + dto.sharingCode).data(using: .utf8) ?? Data()
            var digest = [UInt8](repeating: 0, count: 16)
            seed.withUnsafeBytes { ptr in ptr.enumerated().forEach { i, b in digest[i % 16] ^= b } }
            digest[6] = (digest[6] & 0x0F) | 0x40
            digest[8] = (digest[8] & 0x3F) | 0x80
            stableId = UUID(uuid: (digest[0],digest[1],digest[2],digest[3],
                                   digest[4],digest[5],digest[6],digest[7],
                                   digest[8],digest[9],digest[10],digest[11],
                                   digest[12],digest[13],digest[14],digest[15]))
        }

        var usedColors = Set<String>()
        if let existingCourses = try? modelContext.fetch(FetchDescriptor<Course>()) {
            for c in existingCourses where !c.isDeleted {
                usedColors.insert(c.hexColor.lowercased())
                for doc in c.syllabusDocs {
                    if let dHex = doc.docColorHex?.lowercased(), !dHex.isEmpty {
                        usedColors.insert(dHex)
                    }
                }
            }
        }
        let assignedColor = getUniqueColor(usedColors: usedColors)

        let newCourse = Course(
            id: stableId,
            creatorId: UUID(uuidString: dto.creatorId ?? "") ?? UUID(),
            courseName: dto.courseName,
            courseCode: dto.courseCode,
            courseDescription: dto.courseDescription,
            instructorName: dto.instructorName,
            instructorEmail: dto.instructorEmail,
            hexColor: assignedColor,
            termWeeks: dto.termWeeks ?? 16,
            sharingCode: dto.sharingCode,
            isFavorite: dto.isFavorite ?? false,
            chatHistoryJSON: dto.chatHistoryJSON
        )

        for w in 1...max(16, dto.termWeeks ?? 16) {
            let week = Week(id: UUID(), weekNumber: w, theme: "Week \(w) Schedule")
            week.course = newCourse
            newCourse.weeks.append(week)
            modelContext.insert(week)
        }

        if let items = dto.items, !items.isEmpty {
            importItemDTOs(items, into: newCourse, modelContext: modelContext)
        }

        let weeksToImport = dto.weeks ?? []
        for wDTO in weeksToImport {
            let week: Week
            if let existingWeek = newCourse.weeks.first(where: { $0.weekNumber == wDTO.weekNumber }) {
                week = existingWeek
                if let theme = wDTO.theme, !theme.isEmpty { week.theme = theme }
                if let dateRange = wDTO.dateRangeStr, !dateRange.isEmpty { week.dateRangeStr = dateRange }
                if let sDate = WeekDateConverter.parseRobustDate(wDTO.startDate) { week.startDate = sDate }
            } else {
                let weekId = UUID(uuidString: wDTO.id) ?? UUID()
                let sDate = WeekDateConverter.parseRobustDate(wDTO.startDate)
                week = Week(id: weekId, weekNumber: wDTO.weekNumber, startDate: sDate, theme: wDTO.theme, dateRangeStr: wDTO.dateRangeStr)
                week.course = newCourse
                newCourse.weeks.append(week)
                modelContext.insert(week)
            }

            if let readings = wDTO.readings, !readings.isEmpty {
                for rDTO in readings {
                    if week.readings.contains(where: { $0.title.lowercased() == rDTO.title.lowercased() }) { continue }

                    let mediaType: MediaType = {
                        switch (rDTO.mediaType ?? "textbook").lowercased() {
                        case "media", "video":   return .video
                        case "podcast":           return .podcast
                        case "article":           return .article
                        case "reading", "textbook": return .textbook
                        default:                  return .textbook
                        }
                    }()
                    let summary = ""
                    let takeaways = rDTO.keyTakeawaysText ?? "• Review \(rDTO.title)"
                    let estTime = rDTO.estimatedTimeText ?? (mediaType == .video || mediaType == .podcast ? "~20–30 min" : "~40–60 min")
                    let videoUrl: String? = {
                        if let cand = rDTO.videoUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = rDTO.summaryText, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                        if let extracted = URLHelper.extractFirstURL(from: rDTO.title) { return extracted }
                        return nil
                    }()

                    let parsedDueDate: Date? = WeekDateConverter.parseRobustDate(rDTO.dueDate) ?? week.startDate

                    let (extractedCh, extractedPg) = LocalSyllabusParser.shared.extractChapterAndPages(from: rDTO.title)

                    let cleanReadingTitle = cleanAndSummarizeTitle(rDTO.title, isReading: true, courseCode: newCourse.courseCode, courseName: newCourse.courseName)
                    let reading = Reading(
                        id: UUID(),
                        title: cleanReadingTitle,
                        authorName: rDTO.authorName,
                        resourceTitle: rDTO.resourceTitle,
                        mediaType: mediaType,
                        isCompleted: rDTO.isCompleted ?? false,
                        summaryText: summary,
                        keyTakeawaysText: takeaways,
                        estimatedTimeText: estTime,
                        videoUrl: videoUrl,
                        dueDate: parsedDueDate,
                        dateRangeStr: rDTO.dateRangeStr ?? week.dateRangeStr,
                        chapterText: rDTO.chapterText ?? extractedCh,
                        pagesText: rDTO.pagesText ?? extractedPg,
                        courseCode: newCourse.courseCode,
                        relevantTopics: rDTO.relevantTopics,
                        isFavorite: rDTO.isFavorite ?? false
                    )
                    reading.week = week
                    week.readings.append(reading)
                    modelContext.insert(reading)
                }
            }
        }

        if let assignments = dto.assignments {
            for aDTO in assignments {
                if newCourse.assignments.contains(where: { $0.title.lowercased() == aDTO.title.lowercased() }) { continue }

                let parsedDueDate = WeekDateConverter.parseRobustDate(aDTO.dueDate)
                let weekNumber: Int = {
                    if let due = parsedDueDate {
                        if let cStart = newCourse.earliestItemDate {
                            return WeekDateConverter.deriveWeekNumber(for: due, courseStartDate: cStart)
                        }
                        return WeekDateConverter.weekNumber(for: due)
                    }
                    return 1
                }()

                let mediaUrl: String? = {
                    if let cand = aDTO.mediaUrl, URLHelper.isValidURL(cand) { return cand }
                    if let cand = aDTO.noteText, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                    if let cand = aDTO.fullInstructions, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                    if let extracted = URLHelper.extractFirstURL(from: aDTO.title) { return extracted }
                    return nil
                }()

                let rubricJSONString: String? = {
                    if let r = aDTO.rubric, !r.isEmpty, let data = try? JSONEncoder().encode(r) {
                        return String(data: data, encoding: .utf8)
                    }
                    return nil
                }()

                let cleanTitle = cleanAndSummarizeTitle(aDTO.title, isReading: false, courseCode: newCourse.courseCode, courseName: newCourse.courseName)
                let assignment = Assignment(
                    id: UUID(),
                    title: cleanTitle,
                    weekNumber: weekNumber,
                    dueDate: parsedDueDate,
                    fullInstructions: aDTO.fullInstructions ?? "Complete \(aDTO.title)",
                    pointsPossible: aDTO.pointsPossible ?? "100 Points",
                    pointsBreakdown: sanitizePointsBreakdown(aDTO.pointsBreakdown),
                    rubricJSON: rubricJSONString,
                    noteText: nil,
                    isCompleted: aDTO.isCompleted ?? false,
                    isDeleted: false,
                    courseCode: newCourse.courseCode,
                    weightPercentage: aDTO.weightPercentage,
                    subTypeRaw: "PAPER",
                    mediaUrl: mediaUrl,
                    isFavorite: aDTO.isFavorite ?? false
                )
                assignment.course = newCourse
                newCourse.assignments.append(assignment)
                modelContext.insert(assignment)
            }
        }

        let docTitle = "\(newCourse.courseCode ?? newCourse.courseName) Syllabus"
        let initialDocColor = pickDocumentColor(forCourseHex: assignedColor, docIndex: 0)
        let syllabusDoc = SyllabusDocument(
            id: UUID(),
            docTitle: docTitle,
            officeHoursText: dto.officeHours ?? "By appointment",
            instructorContact: dto.instructorName ?? "Instructor",
            courseCode: newCourse.courseCode,
            docColorHex: initialDocColor
        )
        syllabusDoc.course = newCourse
        newCourse.syllabusDocs.append(syllabusDoc)
        modelContext.insert(syllabusDoc)

        newCourse.reorganizeWeeksFromDates(modelContext: modelContext)

        modelContext.insert(newCourse)
        do {
            try modelContext.save()
            let totalItems = newCourse.assignments.count + newCourse.weeks.reduce(0) { $0 + $1.readings.count }
            let courseCode = newCourse.courseCode ?? newCourse.courseName
            print("💾 [DATABASE] Successfully saved \(totalItems) items to Course: \(courseCode)")
        } catch {
            print("⚠️ [DATABASE ERROR] Failed to persist data: \(error)")
        }
        return newCourse
    }

    public static func cleanAndSummarizeTitle(_ rawTitle: String, isReading: Bool, courseCode: String? = nil, courseName: String? = nil) -> String {
        var title = rawTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if title.isEmpty { return isReading ? "Reading" : "Assignment" }

        // Strip specific course code / name if provided
        if let code = courseCode?.trimmingCharacters(in: .whitespacesAndNewlines), !code.isEmpty {
            if title.lowercased() == code.lowercased() {
                title = isReading ? "Required Reading" : "Assignment"
            } else {
                let pattern = #"^(?i)\Q"# + code + #"\E\s*[:\-–\.]*\s*"#
                title = title.replacingOccurrences(of: pattern, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        if let name = courseName?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
            if title.lowercased() == name.lowercased() {
                title = isReading ? "Required Reading" : "Assignment"
            } else {
                let pattern = #"^(?i)\Q"# + name + #"\E\s*[:\-–\.]*\s*"#
                title = title.replacingOccurrences(of: pattern, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }

        // Strip general course code prefix like "CPC 514: " or "CS 101 - "
        if title.range(of: #"^[A-Z]{2,5}\s*\d{3,4}[A-Z]?$"#, options: [.regularExpression, .caseInsensitive]) != nil {
            title = isReading ? "Required Reading" : "Assignment"
        } else {
            title = title.replacingOccurrences(of: #"^[A-Z]{2,5}\s*\d{3,4}[A-Z]?\s*[:\-–\.]*\s*"#, with: "", options: [.regularExpression, .caseInsensitive]).trimmingCharacters(in: .whitespacesAndNewlines)
        }

        // 1. Strip sentence preambles for Assignments
        if !isReading {
            let sentencePreambles = [
                "Students will complete an", "Students will complete a", "Students will complete",
                "Students will write a", "Students will write an", "Students will write",
                "Students will submit a", "Students will submit an", "Students will submit",
                "Students are required to write", "Students are required to complete", "Students are required to submit",
                "Students are required to", "Complete an", "Complete a", "Submit an", "Submit a", "Write a", "Write an"
            ]
            for preamble in sentencePreambles {
                if let range = title.range(of: preamble, options: [.caseInsensitive, .anchored]) {
                    title = String(title[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
        }

        // 2. Strip generic prefixes & section titles
        let prefixesToStrip = [
            "Required Readings:", "Required Reading:", "Assigned Reading:", "Assigned Readings:",
            "Readings:", "Reading:", "Read:", "Required:", "Chapter:", "Chapters:",
            "Assignment:", "Assignments:", "Deliverable:", "Deliverables:", "Task:",
            "Project:", "Paper:", "Due:", "Graded:", "Homework:"
        ]
        for prefix in prefixesToStrip {
            if let range = title.range(of: prefix, options: [.caseInsensitive, .anchored]) {
                title = String(title[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }

        // 3. For Readings: Only strip generic labels like "Required Reading:" or "Reading:"
        if isReading {
            let topicPrefixes = [
                "Work ", "Stages ", "Initial Stages ", "Transition ", "Working ",
                "Presentations ", "Settings ", "Groups in Diverse Settings "
            ]
            for tp in topicPrefixes {
                if title.lowercased().hasPrefix(tp.lowercased()) {
                    title = String(title.dropFirst(tp.count)).trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }

            let readingPrefixes = [
                "Required Readings:", "Required Reading:", "Assigned Reading:", "Assigned Readings:",
                "Weekly Readings:", "Readings:", "Reading:", "Read:"
            ]
            for prefix in readingPrefixes {
                if let range = title.range(of: prefix, options: [.caseInsensitive, .anchored]) {
                    title = String(title[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
            
            // Strip extra subtitles and hallucinated book descriptions (e.g. " - Process and Practice", "Theory and Practice", etc.)
            let extraSubtitlesToStrip = [
                #"(?i)\s*[-–:]*\s*(?:Groups\s*[-–:]*\s*)?(?:Process\s+(?:and|&)\s+Practice)\b"#,
                #"(?i)\s*[-–:]*\s*(?:Theory\s+(?:and|&)\s+Practice(?:\s+of\s+Group\s+Psychotherapy)?)\b"#,
                #"(?i)\s*[-–:]*\s*(?:Qualitative,?\s+quantitative,?\s+and\s+mixed\s+methods\s+approaches.*)$"#
            ]
            for pat in extraSubtitlesToStrip {
                title = title.replacingOccurrences(of: pat, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            }

            // Clean up orphan delimiters
            title = title.replacingOccurrences(of: #":\s*;"#, with: " ;", options: .regularExpression)
            title = title.replacingOccurrences(of: #"[:;]\s*[:;]+"#, with: " /", options: .regularExpression)
            title = title.replacingOccurrences(of: #"\s*;\s*"#, with: " / ", options: .regularExpression)
            
            // If title matches Author Ch. X without colon e.g. "Corey Ch. 1 & 2" -> "Corey: Ch. 1 & 2"
            if !title.contains(":") {
                title = title.replacingOccurrences(of: #"(?i)^([A-Z][a-zA-Z\s&,\.\-–]+?)\s+(chapters?|chs?\.?)\s*"#, with: "$1: $2 ", options: .regularExpression)
            }

            // Collapse multiple spaces
            title = title.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Strip trailing/leading separators
            title = title.replacingOccurrences(of: #"^[\:\;\-\–\s\/]+|[\:\;\-\–\s\/]+$"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        }

        title = title.replacingOccurrences(of: #"^(Week\s*\d+|Module\s*\d+|\d+[\.\:\-]*)\s*"#, with: "", options: [.regularExpression, .caseInsensitive]).trimmingCharacters(in: .whitespacesAndNewlines)

        // 4. Ensure Title Starts with Capital Letter
        if let firstChar = title.first, firstChar.isLowercase {
            title = firstChar.uppercased() + title.dropFirst()
        }

        if isReading {
            if title.count > 100 {
                let words = title.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
                if words.count > 15 {
                    title = words.prefix(15).joined(separator: " ") + "..."
                }
            }
        } else {
            if title.count > 120 {
                let words = title.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
                if words.count > 18 {
                    title = words.prefix(18).joined(separator: " ") + "..."
                }
            }
        }

        // Clean any leftover orphan punctuation
        title = title.replacingOccurrences(of: #"^[\:\;\-\–\s\/]+|[\:\;\-\–\s\/]+$"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)

        return title.isEmpty ? (isReading ? "Reading" : "Assignment") : title
    }

    public static func sanitizePointsBreakdown(_ raw: String?) -> String? {
        guard let raw = raw, !raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.range(of: #"^\d+%\s*(of\s*(final\s*)?grade)?$"#, options: [.regularExpression, .caseInsensitive]) != nil {
            return nil
        }
        let lines = raw.components(separatedBy: CharacterSet.newlines)
        let filteredLines = lines.filter { line in
            let clean = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if clean.isEmpty { return false }
            if clean.range(of: #"^\d+%\s*(of\s*(final\s*)?grade)?$"#, options: [.regularExpression, .caseInsensitive]) != nil {
                return false
            }
            return true
        }
        let result = filteredLines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        return result.isEmpty ? nil : result
    }

    @discardableResult
    public static func importDTO(_ dto: CourseDTO, into existingCourse: Course, modelContext: ModelContext) -> Course {
        let currentCourseName = existingCourse.courseName.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanName = dto.courseName.trimmingCharacters(in: .whitespacesAndNewlines)
        if currentCourseName.isEmpty || currentCourseName.lowercased() == "syllabus course" || currentCourseName.lowercased() == "new course" {
            if !cleanName.isEmpty && cleanName.lowercased() != "new course" {
                existingCourse.courseName = cleanName
            }
        }

        if existingCourse.courseCode == nil || existingCourse.courseCode!.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || existingCourse.courseCode == "CRS" {
            if let cleanCode = dto.courseCode?.trimmingCharacters(in: .whitespacesAndNewlines), !cleanCode.isEmpty, cleanCode.uppercased() != "CRS" {
                existingCourse.courseCode = cleanCode
            }
        }

        if let instructor = dto.instructorName, !instructor.isEmpty {
            existingCourse.instructorName = instructor
        }
        if let email = dto.instructorEmail, !email.isEmpty {
            existingCourse.instructorEmail = email
        }
        if let desc = dto.courseDescription, !desc.isEmpty {
            existingCourse.courseDescription = desc
        }
        if let fav = dto.isFavorite, fav {
            existingCourse.isFavorite = true
        }
        if let chat = dto.chatHistoryJSON, !chat.isEmpty, (existingCourse.chatHistoryJSON == nil || existingCourse.chatHistoryJSON!.isEmpty) {
            existingCourse.chatHistoryJSON = chat
        }

        // Ensure baseline weeks exist on the course
        if existingCourse.weeks.isEmpty {
            for w in 1...max(16, dto.termWeeks ?? 16) {
                let week = Week(id: UUID(), weekNumber: w, theme: "Week \(w) Schedule")
                week.course = existingCourse
                existingCourse.weeks.append(week)
                modelContext.insert(week)
            }
        }

        var usedColors = Set<String>()
        if let allCourses = try? modelContext.fetch(FetchDescriptor<Course>()) {
            for c in allCourses where !c.isDeleted {
                usedColors.insert(c.hexColor.lowercased())
                for doc in c.syllabusDocs {
                    if let dHex = doc.docColorHex?.lowercased(), !dHex.isEmpty {
                        usedColors.insert(dHex)
                    }
                }
            }
        }
        let docIndex = existingCourse.syllabusDocs.count
        let newDocColor = getUniqueColor(usedColors: usedColors)
        let newDocTitle = dto.courseName.contains("Syllabus") ? dto.courseName : "\(dto.courseName) (Doc \(docIndex + 1))"
        
        let newSyllabusDoc = SyllabusDocument(
            id: UUID(),
            docTitle: newDocTitle,
            officeHoursText: dto.officeHours ?? "By appointment",
            instructorContact: dto.instructorName ?? "Instructor",
            courseCode: existingCourse.courseCode,
            docColorHex: newDocColor
        )
        newSyllabusDoc.course = existingCourse
        existingCourse.syllabusDocs.append(newSyllabusDoc)
        modelContext.insert(newSyllabusDoc)

        if let items = dto.items, !items.isEmpty {
            importItemDTOs(items, into: existingCourse, modelContext: modelContext, sourceDocumentName: newDocTitle, docColorHex: newDocColor)
        }

        let weeksToImport = dto.weeks ?? []
        for wDTO in weeksToImport {
            let week: Week
            if let targetWeek = existingCourse.weeks.first(where: { $0.weekNumber == wDTO.weekNumber }) {
                week = targetWeek
                if let theme = wDTO.theme, !theme.isEmpty { week.theme = theme }
                if let dateRange = wDTO.dateRangeStr, !dateRange.isEmpty { week.dateRangeStr = dateRange }
                if let sDate = WeekDateConverter.parseRobustDate(wDTO.startDate) { week.startDate = sDate }
            } else {
                let weekId = UUID(uuidString: wDTO.id) ?? UUID()
                let sDate = WeekDateConverter.parseRobustDate(wDTO.startDate)
                week = Week(id: weekId, weekNumber: wDTO.weekNumber, startDate: sDate, theme: wDTO.theme, dateRangeStr: wDTO.dateRangeStr)
                week.course = existingCourse
                existingCourse.weeks.append(week)
                modelContext.insert(week)
            }

            if let readings = wDTO.readings, !readings.isEmpty {
                for rDTO in readings {
                    let normTitle = rDTO.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                    let mediaType: MediaType = {
                        switch (rDTO.mediaType ?? "textbook").lowercased() {
                        case "media", "video":   return .video
                        case "podcast":           return .podcast
                        case "article":           return .article
                        case "reading", "textbook": return .textbook
                        default:                  return .textbook
                        }
                    }()
                    let summary = ""
                    let takeaways = rDTO.keyTakeawaysText ?? "• Review \(rDTO.title)"
                    let estTime = rDTO.estimatedTimeText ?? (mediaType == .video || mediaType == .podcast ? "~20–30 min" : "~40–60 min")
                    let videoUrl: String? = {
                        if let cand = rDTO.videoUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = rDTO.summaryText, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                        if let extracted = URLHelper.extractFirstURL(from: rDTO.title) { return extracted }
                        return nil
                    }()

                    let parsedDueDate: Date? = WeekDateConverter.parseRobustDate(rDTO.dueDate) ?? week.startDate
                    let (extractedCh, extractedPg) = LocalSyllabusParser.shared.extractChapterAndPages(from: rDTO.title)

                    let cleanTitle = cleanAndSummarizeTitle(rDTO.title, isReading: true, courseCode: existingCourse.courseCode, courseName: existingCourse.courseName)
                    if let existingReading = week.readings.first(where: { $0.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normTitle || $0.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == cleanTitle.lowercased() }) {
                        existingReading.summaryText = ""
                        existingReading.keyTakeawaysText = takeaways
                        existingReading.estimatedTimeText = estTime
                        if let auth = rDTO.authorName { existingReading.authorName = auth }
                        if let res = rDTO.resourceTitle { existingReading.resourceTitle = res }
                        if let ch = rDTO.chapterText ?? extractedCh { existingReading.chapterText = ch }
                        if let pg = rDTO.pagesText ?? extractedPg { existingReading.pagesText = pg }
                        if let pDate = parsedDueDate {
                            existingReading.dueDate = pDate
                        } else if existingReading.dueDate == nil {
                            existingReading.dueDate = week.startDate
                        }
                    } else {
                        let reading = Reading(
                            id: UUID(),
                            title: cleanTitle,
                            authorName: rDTO.authorName,
                            resourceTitle: rDTO.resourceTitle,
                            mediaType: mediaType,
                            isCompleted: rDTO.isCompleted ?? false,
                            summaryText: summary,
                            keyTakeawaysText: takeaways,
                            estimatedTimeText: estTime,
                            videoUrl: videoUrl,
                            dueDate: parsedDueDate,
                            dateRangeStr: rDTO.dateRangeStr ?? week.dateRangeStr,
                            chapterText: rDTO.chapterText ?? extractedCh,
                            pagesText: rDTO.pagesText ?? extractedPg,
                            courseCode: existingCourse.courseCode,
                            relevantTopics: rDTO.relevantTopics,
                            sourceDocumentName: newDocTitle,
                            docColorHex: newDocColor
                        )
                        reading.week = week
                        week.readings.append(reading)
                        modelContext.insert(reading)
                    }
                }
            }
        }

        if let assignments = dto.assignments {
            for aDTO in assignments {
                let normTitle = aDTO.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                let parsedDueDate = WeekDateConverter.parseRobustDate(aDTO.dueDate)
                let weekNumber: Int = {
                    if let due = parsedDueDate {
                        if let cStart = existingCourse.earliestItemDate {
                            return WeekDateConverter.deriveWeekNumber(for: due, courseStartDate: cStart)
                        }
                        return WeekDateConverter.weekNumber(for: due)
                    }
                    return 1
                }()

                let rubricJSONString: String? = {
                    if let r = aDTO.rubric, !r.isEmpty, let data = try? JSONEncoder().encode(r) {
                        return String(data: data, encoding: .utf8)
                    }
                    return nil
                }()

                if let existingAssignment = existingCourse.assignments.first(where: { $0.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normTitle }) {
                    if let inst = aDTO.fullInstructions, !inst.isEmpty { existingAssignment.fullInstructions = inst }
                    if let pts = aDTO.pointsPossible, !pts.isEmpty { existingAssignment.pointsPossible = pts }
                    if let weight = aDTO.weightPercentage, !weight.isEmpty { existingAssignment.weightPercentage = weight }
                    if let bd = sanitizePointsBreakdown(aDTO.pointsBreakdown), !bd.isEmpty { existingAssignment.pointsBreakdown = bd }
                    if let rub = rubricJSONString { existingAssignment.rubricJSON = rub }
                    if parsedDueDate != nil { existingAssignment.dueDate = parsedDueDate }
                    existingAssignment.noteText = nil
                } else {
                    let mediaUrl: String? = {
                        if let cand = aDTO.mediaUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = aDTO.fullInstructions, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                        if let extracted = URLHelper.extractFirstURL(from: aDTO.title) { return extracted }
                        return nil
                    }()

                    let cleanTitle = cleanAndSummarizeTitle(aDTO.title, isReading: false, courseCode: existingCourse.courseCode, courseName: existingCourse.courseName)
                    let assignment = Assignment(
                        id: UUID(),
                        title: cleanTitle,
                        weekNumber: weekNumber,
                        dueDate: parsedDueDate,
                        fullInstructions: aDTO.fullInstructions ?? "Complete \(aDTO.title)",
                        pointsPossible: aDTO.pointsPossible ?? "100 Points",
                        pointsBreakdown: sanitizePointsBreakdown(aDTO.pointsBreakdown),
                        rubricJSON: rubricJSONString,
                        noteText: nil,
                        isCompleted: false,
                        isDeleted: false,
                        courseCode: existingCourse.courseCode,
                        weightPercentage: aDTO.weightPercentage,
                        subTypeRaw: "PAPER",
                        mediaUrl: mediaUrl,
                        sourceDocumentName: newDocTitle,
                        docColorHex: newDocColor
                    )
                    assignment.course = existingCourse
                    existingCourse.assignments.append(assignment)
                    modelContext.insert(assignment)
                }
            }
        }
        existingCourse.reorganizeWeeksFromDates(modelContext: modelContext)

        do {
            try modelContext.save()
            let totalItems = existingCourse.assignments.count + existingCourse.weeks.reduce(0) { $0 + $1.readings.count }
            let courseCode = existingCourse.courseCode ?? existingCourse.courseName
            print("💾 [DATABASE] Successfully saved \(totalItems) items to Course: \(courseCode)")
        } catch {
            print("⚠️ [DATABASE ERROR] Failed to persist data: \(error)")
        }
        return existingCourse
    }

    private static func importItemDTOs(_ items: [ItemDTO], into course: Course, modelContext: ModelContext, sourceDocumentName: String? = nil, docColorHex: String? = nil) {
        let calendar = Calendar.current

        // 1. Gather all explicit dates across incoming items and course
        var allDates: [Date] = []
        for item in items {
            if let dStr = item.dueDateIso, !dStr.isEmpty {
                let p = LocalSyllabusParser.parseISO8601Date(from: dStr, fallbackYear: 2026)
                if !p.isoString.isEmpty { allDates.append(p.date) }
            } else if let desc = item.description, !desc.isEmpty {
                let p = LocalSyllabusParser.parseISO8601Date(from: desc, fallbackYear: 2026)
                if !p.isoString.isEmpty { allDates.append(p.date) }
            } else {
                let p = LocalSyllabusParser.parseISO8601Date(from: item.title, fallbackYear: 2026)
                if !p.isoString.isEmpty { allDates.append(p.date) }
            }
        }
        if let courseEarliest = course.earliestItemDate {
            allDates.append(courseEarliest)
        }

        let earliestDate = allDates.min()
        let startOfWeek1 = earliestDate != nil ? (calendar.dateInterval(of: .weekOfYear, for: earliestDate!)?.start ?? calendar.startOfDay(for: earliestDate!)) : nil

        let courseAssignments = course.assignments

        for item in items {
            let catLower = item.category.lowercased()
            let isAssignment = catLower == "assignment" ||
                               catLower.contains("assign") ||
                               catLower.contains("exam") ||
                               catLower.contains("project") ||
                               catLower.contains("quiz") ||
                               catLower.contains("paper") ||
                               catLower.contains("lab") ||
                               catLower.contains("homework") ||
                               catLower.contains("deliverable") ||
                               catLower.contains("presentation") ||
                               catLower.contains("test") ||
                               catLower.contains("midterm") ||
                               catLower.contains("final")

            let parsedDueDate: Date? = {
                if let dStr = item.dueDateIso, !dStr.isEmpty {
                    let p = LocalSyllabusParser.parseISO8601Date(from: dStr, fallbackYear: 2026)
                    if !p.isoString.isEmpty { return p.date }
                }
                if let desc = item.description, !desc.isEmpty {
                    let p = LocalSyllabusParser.parseISO8601Date(from: desc, fallbackYear: 2026)
                    if !p.isoString.isEmpty { return p.date }
                }
                let pTitle = LocalSyllabusParser.parseISO8601Date(from: item.title, fallbackYear: 2026)
                if !pTitle.isoString.isEmpty { return pTitle.date }
                return nil
            }()

            let weekNum: Int = {
                if let explicitW = item.weekNumber, explicitW > 0 {
                    return explicitW
                }
                if let due = parsedDueDate, let w1Start = startOfWeek1 {
                    let diffWeeks = calendar.dateComponents([.weekOfYear], from: w1Start, to: due).weekOfYear ??
                                    (calendar.dateComponents([.day], from: w1Start, to: due).day! / 7)
                    return max(1, diffWeeks + 1)
                }
                return 0
            }()

            let normTitle = normalizeTitle(item.title)

            let dayName: String? = {
                if let dStr = item.dueDateIso, !dStr.isEmpty, let d = LocalSyllabusParser.extractDayName(from: dStr) { return d }
                if let d = LocalSyllabusParser.extractDayName(from: item.title) { return d }
                if let desc = item.description, !desc.isEmpty, let d = LocalSyllabusParser.extractDayName(from: desc) { return d }
                return nil
            }()
            if isAssignment {
                let existingAssign = course.assignments.first(where: { normalizeTitle($0.title) == normTitle }) ??
                                     courseAssignments.first(where: { normalizeTitle($0.title) == normTitle })
                let rubricJSONString: String? = {
                    if let r = item.rubric, !r.isEmpty, let data = try? JSONEncoder().encode(r) {
                        return String(data: data, encoding: .utf8)
                    }
                    return nil
                }()

                if let existing = existingAssign {
                    print("ℹ️ [RE-UPLOAD CLAUSE] Assignment '\(item.title)' already exists. Updating in place.")
                    if let desc = item.description, !desc.isEmpty { existing.fullInstructions = desc }
                    if let pts = item.points, !pts.isEmpty { existing.pointsPossible = pts }
                    if let bd = sanitizePointsBreakdown(item.pointsBreakdown), !bd.isEmpty { existing.pointsBreakdown = bd }
                    if let weight = item.percentage, !weight.isEmpty { existing.weightPercentage = weight }
                    if let sub = item.subType, !sub.isEmpty { existing.subTypeRaw = sub }
                    if let media = item.mediaUrl, !media.isEmpty { existing.mediaUrl = media }
                    if let rub = rubricJSONString { existing.rubricJSON = rub }
                    if parsedDueDate != nil { existing.dueDate = parsedDueDate }
                    if weekNum > 0 { existing.weekNumber = weekNum }
                    if let sName = sourceDocumentName { existing.sourceDocumentName = sName }
                    if let dColor = docColorHex { existing.docColorHex = dColor }
                    existing.noteText = nil
                } else {
                    let realBreakdown: String? = sanitizePointsBreakdown(item.pointsBreakdown)

                    let instructionsText: String = {
                        var base = item.description ?? "Complete \(item.title)"
                        if parsedDueDate == nil, let day = dayName, !base.lowercased().contains(day.lowercased()) {
                            base += "\nScheduled: \(day)"
                        }
                        return base
                    }()

                    let cleanTitle = cleanAndSummarizeTitle(item.title, isReading: false, courseCode: course.courseCode, courseName: course.courseName)

                    let assignWeekNum = weekNum > 0 ? weekNum : 1
                    let assignment = Assignment(
                        id: UUID(),
                        title: cleanTitle,
                        weekNumber: assignWeekNum,
                        dueDate: parsedDueDate,
                        fullInstructions: instructionsText,
                        pointsPossible: item.points ?? "100 Points Possible",
                        pointsBreakdown: realBreakdown,
                        rubricJSON: rubricJSONString,
                        noteText: nil,
                        isCompleted: false,
                        isDeleted: false,
                        courseCode: course.courseCode,
                        weightPercentage: item.percentage ?? "10%",
                        subTypeRaw: item.subType ?? "PAPER",
                        mediaUrl: item.mediaUrl,
                        sourceDocumentName: sourceDocumentName,
                        docColorHex: docColorHex
                    )
                    assignment.course = course
                    course.assignments.append(assignment)
                    modelContext.insert(assignment)
                }
            } else {
                let targetWeek: Week = {
                    if weekNum > 0 {
                        let candidateTheme: String? = {
                            if let top = item.relevantTopics?.trimmingCharacters(in: .whitespacesAndNewlines), !top.isEmpty {
                                let modPrefix: String? = {
                                    if let r = top.range(of: #"(?i)\b(module\s*\d+|mod\s*\d+)\b"#, options: .regularExpression) {
                                        return String(top[r]).capitalized
                                    }
                                    return nil
                                }()
                                let clean = top.replacingOccurrences(of: #"(?i)^\s*(module|week|unit|session)\s*\d+\s*[:\-–\.]*\s*"#, with: "", options: .regularExpression)
                                               .replacingOccurrences(of: #"(?i)^\s*schedule\s*[:\-–\.]*\s*"#, with: "", options: .regularExpression)
                                               .trimmingCharacters(in: .whitespacesAndNewlines)
                                if let mod = modPrefix {
                                    return clean.isEmpty ? mod : "\(mod): \(clean)"
                                }
                                if !clean.isEmpty && clean.range(of: #"(?i)^(week|module|unit|session)\s*\d+$"#, options: .regularExpression) == nil {
                                    return clean
                                }
                            }
                            return nil
                        }()

                        if let existing = course.weeks.first(where: { $0.weekNumber == weekNum }) {
                            if let cTheme = candidateTheme, (existing.theme == nil || existing.theme!.isEmpty || existing.theme!.lowercased().hasPrefix("week ")) {
                                existing.theme = cTheme
                            }
                            return existing
                        }
                        let defaultTheme = course.cachedModuleForWeek(weekNum) ?? "Week \(weekNum) Schedule"
                        let nw = Week(id: UUID(), weekNumber: weekNum, theme: candidateTheme ?? defaultTheme)
                        nw.course = course
                        course.weeks.append(nw)
                        modelContext.insert(nw)
                        return nw
                    }
                    if let firstWeek = course.weeks.first(where: { $0.weekNumber == 1 }) {
                        return firstWeek
                    }
                    if let anyWeek = course.weeks.first {
                        return anyWeek
                    }
                    let w1 = Week(id: UUID(), weekNumber: 1, theme: "Course Schedule")
                    w1.course = course
                    course.weeks.append(w1)
                    modelContext.insert(w1)
                    return w1
                }()

                let mediaType: MediaType = {
                    switch (item.subType ?? "TEXTBOOK").lowercased() {
                    case "video": return .video
                    case "podcast": return .podcast
                    case "article": return .article
                    default: return .textbook
                    }
                }()

                var (extractedCh, extractedPg) = LocalSyllabusParser.shared.extractChapterAndPages(from: item.title)
                if extractedCh == nil, let desc = item.description {
                    let (ch2, pg2) = LocalSyllabusParser.shared.extractChapterAndPages(from: desc)
                    extractedCh = ch2
                    if extractedPg == nil { extractedPg = pg2 }
                }

                let finalChapter = item.chapterText ?? extractedCh
                let finalPages = item.pagesText ?? extractedPg

                let takeawaysText: String = {
                    if let kt = item.keyTakeaways, !kt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return kt }
                    if let desc = item.description, !desc.isEmpty {
                        return "• " + desc.replacingOccurrences(of: "\n", with: "\n• ")
                    }
                    return "• Key topics and chapters for \(item.title)"
                }()

                let estimatedTimeStr: String = {
                    if let et = item.estimatedTime, !et.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return et }
                    return item.subType == "VIDEO" ? "~20 min video" : "~45 min read"
                }()

                let effectiveDateStr: String? = {
                    if let pDate = parsedDueDate {
                        return WeekDateConverter.formattedDueDate(for: pDate, week: targetWeek, weekNumber: weekNum)
                    }
                    return nil
                }()

                // If this is a schedule break (e.g. Reading Week), targetWeek was already prepared with the theme.
                if (item.subType ?? "").uppercased() == "BREAK" || item.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    continue
                }

                let cleanTitle = cleanAndSummarizeTitle(item.title, isReading: true, courseCode: course.courseCode, courseName: course.courseName)
                var finalTitle = cleanTitle
                var resolvedChapter = finalChapter
                if let match = finalTitle.range(of: #"(?i)\s*[\(\[]\s*((?:chapters?|chs?\.?)\s*\d+[\s&,\-–\d]*)\s*[\)\]]"#, options: .regularExpression) {
                    if resolvedChapter == nil || resolvedChapter!.isEmpty {
                        resolvedChapter = String(finalTitle[match]).replacingOccurrences(of: #"[()\[\]]"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                    }
                    finalTitle.removeSubrange(match)
                    finalTitle = finalTitle.trimmingCharacters(in: .whitespacesAndNewlines)
                } else if let match = finalTitle.range(of: #"(?i)\s*[:\-–]\s*((?:chapters?|chs?\.?)\s*\d+[\s&,\-–\d]*)$"#, options: .regularExpression) {
                    if resolvedChapter == nil || resolvedChapter!.isEmpty {
                        let sub = String(finalTitle[match])
                        resolvedChapter = sub.replacingOccurrences(of: #"^[:\-–\s]+"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                    }
                    finalTitle.removeSubrange(match)
                    finalTitle = finalTitle.trimmingCharacters(in: .whitespacesAndNewlines)
                }

                let existingReading = targetWeek.readings.first(where: {
                    normalizeTitle($0.title) == normTitle || normalizeTitle($0.title) == normalizeTitle(finalTitle) || normalizeTitle($0.title) == normalizeTitle(cleanTitle)
                })
                if let existing = existingReading {
                    print("ℹ️ [RE-UPLOAD CLAUSE] Reading '\(item.title)' already exists in Week \(weekNum). Updating in place.")
                    existing.summaryText = item.description ?? ""
                    if let media = item.mediaUrl, !media.isEmpty { existing.videoUrl = media }
                    if let auth = item.authorName { existing.authorName = auth }
                    if let res = item.resourceTitle { existing.resourceTitle = res }
                    if let pDate = parsedDueDate { existing.dueDate = pDate }
                    if let ch = resolvedChapter { existing.chapterText = ch }
                    if let pg = finalPages { existing.pagesText = pg }
                    if let sName = sourceDocumentName { existing.sourceDocumentName = sName }
                    if let dColor = docColorHex { existing.docColorHex = dColor }
                } else {
                    let videoUrl: String? = {
                        if let cand = item.mediaUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = item.description, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                        if let extracted = URLHelper.extractFirstURL(from: item.title) { return extracted }
                        return nil
                    }()

                    let effectiveTopics: String? = {
                        if let top = item.relevantTopics, !top.isEmpty { return top }
                        if let mod = course.cachedModuleForWeek(weekNum) { return mod }
                        return targetWeek.theme
                    }()

                    let reading = Reading(
                        id: UUID(),
                        title: finalTitle,
                        authorName: item.authorName,
                        resourceTitle: item.resourceTitle,
                        mediaType: mediaType,
                        isCompleted: false,
                        isDeleted: false,
                        summaryText: item.description ?? "",
                        keyTakeawaysText: takeawaysText,
                        estimatedTimeText: estimatedTimeStr,
                        videoUrl: videoUrl,
                        dueDate: parsedDueDate,
                        dateRangeStr: effectiveDateStr,
                        chapterText: resolvedChapter,
                        pagesText: finalPages,
                        courseCode: course.courseCode,
                        relevantTopics: effectiveTopics,
                        sourceDocumentName: sourceDocumentName,
                        docColorHex: docColorHex
                    )
                    reading.week = targetWeek
                    targetWeek.readings.append(reading)
                    modelContext.insert(reading)
                }
            }
        }

        course.reorganizeWeeksFromDates(modelContext: modelContext)
    }

    public static func defaultBreakdown(for title: String, subType: String, totalPointsStr: String?) -> String {
        let ptsDigits = (totalPointsStr ?? "100").components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
        let totalPts = Int(ptsDigits) ?? 100
        let p1 = Int(Double(totalPts) * 0.4)
        let p2 = Int(Double(totalPts) * 0.3)
        let p3 = max(0, totalPts - p1 - p2)

        let lowerTitle = title.lowercased()
        let upperSub = subType.uppercased()

        if upperSub == "PRESENTATION" || lowerTitle.contains("presentation") || lowerTitle.contains("speech") {
            return "Content & Subject Knowledge: \(p1) Points | Visuals & Delivery: \(p2) Points | Q&A & Engagement: \(p3) Points"
        } else if upperSub == "ARTICLE" || lowerTitle.contains("reading") || lowerTitle.contains("article") || lowerTitle.contains("summary") {
            return "Core Concepts Summary: \(p1) Points | Critical Evaluation: \(p2) Points | Application & Insights: \(p3) Points"
        } else if lowerTitle.contains("exam") || lowerTitle.contains("quiz") || lowerTitle.contains("test") || upperSub == "IN_CLASS" {
            return "Multiple Choice & Concepts: \(p1) Points | Short Answer & Problem Solving: \(p2) Points | Accuracy & Completeness: \(p3) Points"
        } else if lowerTitle.contains("lab") || lowerTitle.contains("experiment") || lowerTitle.contains("data") {
            return "Procedure & Data Collection: \(p1) Points | Results & Analysis: \(p2) Points | Conclusion & Lab Report: \(p3) Points"
        } else if upperSub == "VIDEO" || lowerTitle.contains("video") || lowerTitle.contains("podcast") {
            return "Script & Content Depth: \(p1) Points | Audio/Visual Quality: \(p2) Points | Synthesis & Discussion: \(p3) Points"
        } else if lowerTitle.contains("code") || lowerTitle.contains("programming") || lowerTitle.contains("software") {
            return "Core Architecture & Logic: \(p1) Points | Code Quality & Efficiency: \(p2) Points | Testing & Documentation: \(p3) Points"
        } else {
            return "Research & Thesis Depth: \(p1) Points | Argument & Evidence Support: \(p2) Points | Structure & Writing Mechanics: \(p3) Points"
        }
    }
}

// MARK: - Week <-> Date Bidirectional Converter
public enum WeekDateConverter {
    public static var baseTermStartDate: Date {
        let calendar = Calendar.current
        let now = Date()
        let month = calendar.component(.month, from: now)
        let year = calendar.component(.year, from: now)
        
        var comp = DateComponents()
        comp.year = year
        comp.hour = 23
        comp.minute = 59
        
        if month >= 5 && month <= 8 {
            comp.month = 7
            comp.day = 1
        } else if month >= 9 || month <= 12 {
            comp.month = 9
            comp.day = 1
        } else {
            comp.month = 1
            comp.day = 15
        }
        return calendar.date(from: comp) ?? Date()
    }

    public static func weekNumber(for date: Date, startDate: Date = baseTermStartDate) -> Int {
        let calendar = Calendar.current
        let startOfDayStart = calendar.startOfDay(for: startDate)
        let startOfDayTarget = calendar.startOfDay(for: date)
        let components = calendar.dateComponents([.day], from: startOfDayStart, to: startOfDayTarget)
        let days = components.day ?? 0
        let week = (days / 7) + 1
        return max(1, min(20, week))
    }

    public static func deriveWeekNumber(for targetDate: Date, courseStartDate: Date) -> Int {
        let calendar = Calendar.current
        let startOfWeek1 = calendar.dateInterval(of: .weekOfYear, for: courseStartDate)?.start ?? calendar.startOfDay(for: courseStartDate)
        let diffWeeks = calendar.dateComponents([.weekOfYear], from: startOfWeek1, to: targetDate).weekOfYear ??
                        (calendar.dateComponents([.day], from: startOfWeek1, to: targetDate).day! / 7)
        return max(1, diffWeeks + 1)
    }

    public static func date(forWeek weekNumber: Int, startDate: Date = baseTermStartDate) -> Date {
        let calendar = Calendar.current
        return calendar.date(byAdding: .day, value: max(0, weekNumber - 1) * 7, to: startDate) ?? startDate
    }

    public static func parseRobustDate(_ str: String?) -> Date? {
        guard let s = str?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty else { return nil }

        let parsed = LocalSyllabusParser.parseISO8601Date(from: s, fallbackYear: 2026)
        if !parsed.isoString.isEmpty {
            return parsed.date
        }
        return nil
    }

    public static func formattedDueDate(for date: Date?, week: Week? = nil, weekNumber: Int = 0) -> String {
        guard let explicitDate = date else {
            if let wRange = week?.dateRangeStr?.trimmingCharacters(in: .whitespacesAndNewlines), !wRange.isEmpty, wRange.lowercased() != "unknown" {
                return wRange
            }
            return "No due date set"
        }

        let formatter = DateFormatter()
        let calendar = Calendar.current
        let itemYear = calendar.component(.year, from: explicitDate)
        let currentYear = calendar.component(.year, from: Date())

        if itemYear != currentYear {
            formatter.dateFormat = "EEEE, MMMM d, yyyy"
        } else {
            formatter.dateFormat = "EEEE, MMMM d"
        }

        return "Due " + formatter.string(from: explicitDate)
    }
}

// MARK: - Strict URL Validator & Formatter Helper
public enum URLHelper {
    public static func isValidURL(_ str: String?) -> Bool {
        guard let s = str?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty else { return false }
        let lower = s.lowercased()
        if lower.hasPrefix("http://") || lower.hasPrefix("https://") || lower.hasPrefix("www.") {
            return true
        }
        if lower.contains("youtube.com") || lower.contains("youtu.be") || lower.contains("vimeo.com") || lower.contains("ted.com") || lower.contains("podcasts.apple.com") {
            return true
        }
        if let url = URL(string: s), let host = url.host, host.contains(".") {
            return true
        }
        return false
    }

    public static func formatURL(_ str: String?) -> URL? {
        guard let str = str, isValidURL(str) else { return nil }
        var clean = str.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.lowercased().hasPrefix("www.") {
            clean = "https://" + clean
        } else if !clean.lowercased().hasPrefix("http://") && !clean.lowercased().hasPrefix("https://") {
            clean = "https://" + clean
        }
        return URL(string: clean)
    }

    public static func extractFirstURL(from text: String?) -> String? {
        guard let text = text, !text.isEmpty else { return nil }

        let youtubePattern = #"(https?://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?v=|embed/|v/)|youtu\.be/)[a-zA-Z0-9_-]+[^\s]*)"#
        if let regex = try? NSRegularExpression(pattern: youtubePattern, options: .caseInsensitive),
           let match = regex.firstMatch(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count)) {
            if let range = Range(match.range, in: text) {
                let urlStr = String(text[range]).trimmingCharacters(in: CharacterSet(charactersIn: ".,);\"'<>"))
                return urlStr
            }
        }

        let genericPattern = #"(https?://[^\s<>"{}|\^~\[\]]+)"#
        if let regex = try? NSRegularExpression(pattern: genericPattern, options: .caseInsensitive),
           let match = regex.firstMatch(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count)) {
            if let range = Range(match.range, in: text) {
                let urlStr = String(text[range]).trimmingCharacters(in: CharacterSet(charactersIn: ".,);\"'<>"))
                return urlStr
            }
        }

        return nil
    }
}

// MARK: - Course to CourseDTO Reconstruction
extension Course {
    public func toCourseDTO() -> CourseDTO {
        var dtWeeks: [WeekDTO] = []
        for w in weeks {
            var dtReadings: [ReadingDTO] = []
            for r in w.readings {
                dtReadings.append(ReadingDTO(
                    id: r.id.uuidString,
                    title: r.title,
                    authorName: r.authorName,
                    resourceTitle: r.resourceTitle,
                    mediaType: r.mediaType.rawValue,
                    isCompleted: r.isCompleted,
                    summaryText: r.summaryText,
                    keyTakeawaysText: r.keyTakeawaysText,
                    estimatedTimeText: r.estimatedTimeText,
                    videoUrl: r.videoUrl,
                    dueDate: r.dueDate.map { ISO8601DateFormatter().string(from: $0) },
                    dateRangeStr: r.dateRangeStr,
                    relevantTopics: r.relevantTopics,
                    chapterText: r.chapterText,
                    pagesText: r.pagesText,
                    isFavorite: r.isFavorite
                ))
            }
            dtWeeks.append(WeekDTO(
                id: w.id.uuidString,
                weekNumber: w.weekNumber,
                startDate: w.startDate.map { ISO8601DateFormatter().string(from: $0) },
                theme: w.theme,
                dateRangeStr: w.dateRangeStr,
                readings: dtReadings
            ))
        }

        var dtAssignments: [AssignmentDTO] = []
        for a in assignments {
            var rubricDTOs: [RubricCriterionDTO]? = nil
            if let rJSON = a.rubricJSON, let data = rJSON.data(using: .utf8) {
                rubricDTOs = try? JSONDecoder().decode([RubricCriterionDTO].self, from: data)
            }

            dtAssignments.append(AssignmentDTO(
                id: a.id.uuidString,
                title: a.title,
                dueDate: a.dueDate.map { ISO8601DateFormatter().string(from: $0) },
                fullInstructions: a.fullInstructions,
                pointsPossible: a.pointsPossible,
                weightPercentage: a.weightPercentage,
                noteText: a.noteText,
                pointsBreakdown: a.pointsBreakdown,
                relevantTopics: a.relevantTopics,
                mediaUrl: a.mediaUrl,
                rubric: rubricDTOs,
                isFavorite: a.isFavorite,
                isCompleted: a.isCompleted
            ))
        }

        return CourseDTO(
            id: self.id.uuidString,
            creatorId: self.creatorId.uuidString,
            courseName: self.courseName,
            courseCode: self.courseCode ?? "CRS",
            courseDescription: self.courseDescription,
            instructorName: self.instructorName,
            instructorEmail: self.instructorEmail,
            termWeeks: self.termWeeks,
            sharingCode: self.sharingCode,
            weeks: dtWeeks,
            assignments: dtAssignments,
            items: [],
            isFavorite: self.isFavorite,
            chatHistoryJSON: self.chatHistoryJSON
        )
    }
}
