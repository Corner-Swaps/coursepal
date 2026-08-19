import Foundation
import SwiftData

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
        createdAt: Date = Date()
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
    
    public var week: Week?

    public var mediaType: MediaType {
        get { MediaType(rawValue: mediaTypeRaw) ?? .textbook }
        set { mediaTypeRaw = newValue.rawValue }
    }

    public init(
        id: UUID = UUID(),
        title: String,
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
        docColorHex: String? = nil
    ) {
        self.id = id
        self.title = title
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

    public var chapterAndPagesDisplay: String? {
        var parts: [String] = []
        if let ch = chapterText, !ch.trimmingCharacters(in: .whitespaces).isEmpty {
            parts.append(ch)
        }
        if let pg = pagesText, !pg.trimmingCharacters(in: .whitespaces).isEmpty {
            parts.append(pg)
        }
        return parts.isEmpty ? nil : parts.joined(separator: " • ")
    }

    public var computedTopics: [String] {
        if let explicit = relevantTopics, !explicit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let items = explicit.components(separatedBy: CharacterSet(charactersIn: ",|;\n"))
                .map { $0.replacingOccurrences(of: #"(?i)^\s*week\s*\d+\s*(schedule|topics)?\s*:?\s*"#, with: "", options: .regularExpression)
                         .replacingOccurrences(of: "•", with: "")
                         .trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty && !$0.lowercased().hasPrefix("week ") && $0.count >= 3 && !$0.lowercased().contains("required reading for") }
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
                    .filter { !$0.isEmpty && $0.count >= 3 }
                if !parts.isEmpty {
                    return parts
                }
            }
        }
        return []
    }

    public var cleanDisplayTitle: String {
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

        // 5. Cap words to max 5
        let words = raw.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
        if words.count > 5 {
            return words.prefix(5).joined(separator: " ")
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
    
    public var course: Course?

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

        // 4. Cap words to max 4
        let words = raw.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
        if words.count > 4 {
            return words.prefix(4).joined(separator: " ")
        }

        return raw.isEmpty ? "Assignment" : raw
    }

    public init(
        id: UUID = UUID(),
        title: String,
        weekNumber: Int = 1,
        dueDate: Date? = nil,
        fullInstructions: String? = nil,
        pointsPossible: String? = nil,
        pointsBreakdown: String? = nil,
        noteText: String? = nil,
        isCompleted: Bool = false,
        isDeleted: Bool = false,
        courseCode: String? = nil,
        weightPercentage: String? = nil,
        subTypeRaw: String? = "PAPER",
        mediaUrl: String? = nil,
        relevantTopics: String? = nil,
        sourceDocumentName: String? = nil,
        docColorHex: String? = nil
    ) {
        self.id = id
        self.title = title
        self.weekNumber = weekNumber
        self.dueDate = dueDate
        self.fullInstructions = fullInstructions
        self.pointsPossible = pointsPossible
        self.pointsBreakdown = pointsBreakdown
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
                .filter { !$0.isEmpty && !$0.lowercased().hasPrefix("week ") && $0.count >= 3 }
            if !items.isEmpty {
                return items
            }
        }
        return []
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
            sharingCode: dto.sharingCode
        )

        if let items = dto.items, !items.isEmpty {
            importItemDTOs(items, into: newCourse, modelContext: modelContext)
        }

        var weeksToImport = dto.weeks ?? []
        if weeksToImport.isEmpty {
            weeksToImport = (1...16).map { w in
                WeekDTO(id: "week-\(w)", weekNumber: w, startDate: nil, theme: "Week \(w) Schedule", readings: [])
            }
        }

        for wDTO in weeksToImport {
            let weekId: UUID
            if let parsed = UUID(uuidString: wDTO.id) {
                weekId = parsed
            } else {
                let seed = (stableId.uuidString + "week\(wDTO.weekNumber)").data(using: .utf8) ?? Data()
                var d = [UInt8](repeating: 0, count: 16)
                seed.withUnsafeBytes { ptr in ptr.enumerated().forEach { i, b in d[i % 16] ^= b } }
                d[6] = (d[6] & 0x0F) | 0x40; d[8] = (d[8] & 0x3F) | 0x80
                weekId = UUID(uuid: (d[0],d[1],d[2],d[3],d[4],d[5],d[6],d[7],d[8],d[9],d[10],d[11],d[12],d[13],d[14],d[15]))
            }

            let week: Week
            if let existingWeek = newCourse.weeks.first(where: { $0.weekNumber == wDTO.weekNumber }) {
                week = existingWeek
            } else {
                week = Week(id: weekId, weekNumber: wDTO.weekNumber, theme: wDTO.theme, dateRangeStr: wDTO.dateRangeStr)
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

                    let parsedDueDate: Date? = WeekDateConverter.parseRobustDate(rDTO.dueDate)

                    let (extractedCh, extractedPg) = LocalSyllabusParser.shared.extractChapterAndPages(from: rDTO.title)

                    let cleanReadingTitle = cleanAndSummarizeTitle(rDTO.title, isReading: true)
                    let reading = Reading(
                        id: UUID(),
                        title: cleanReadingTitle,
                        mediaType: mediaType,
                        isCompleted: rDTO.isCompleted ?? false,
                        summaryText: summary,
                        keyTakeawaysText: takeaways,
                        estimatedTimeText: estTime,
                        videoUrl: videoUrl,
                        dueDate: parsedDueDate,
                        dateRangeStr: rDTO.dateRangeStr ?? week.dateRangeStr,
                        chapterText: extractedCh,
                        pagesText: extractedPg,
                        courseCode: newCourse.courseCode,
                        relevantTopics: rDTO.relevantTopics
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
                    if let d = parsedDueDate { return WeekDateConverter.weekNumber(for: d) }
                    return 1
                }()

                    let mediaUrl: String? = {
                        if let cand = aDTO.mediaUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = aDTO.fullInstructions, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                        if let extracted = URLHelper.extractFirstURL(from: aDTO.title) { return extracted }
                        return nil
                    }()

                    let cleanTitle = cleanAndSummarizeTitle(aDTO.title, isReading: false)
                    let assignment = Assignment(
                        id: UUID(),
                        title: cleanTitle,
                        weekNumber: weekNumber,
                        dueDate: parsedDueDate,
                        fullInstructions: aDTO.fullInstructions ?? "Complete \(aDTO.title)",
                        pointsPossible: aDTO.pointsPossible ?? "100 Points",
                        pointsBreakdown: sanitizePointsBreakdown(aDTO.pointsBreakdown),
                        noteText: nil,
                        isCompleted: false,
                        isDeleted: false,
                        courseCode: newCourse.courseCode,
                        weightPercentage: aDTO.weightPercentage,
                        subTypeRaw: "PAPER",
                        mediaUrl: mediaUrl
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

    public static func cleanAndSummarizeTitle(_ rawTitle: String, isReading: Bool) -> String {
        var title = rawTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if title.isEmpty { return isReading ? "Reading" : "Assignment" }

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

        // 3. For Readings: Strip topic header words like "overview", "tools", "systems" before author names (e.g. "overview Gehart")
        if isReading {
            let topicWords = ["overview", "tools", "systems", "introduction to", "intro to", "overview of"]
            for word in topicWords {
                let pattern = "^(?i)" + NSRegularExpression.escapedPattern(for: word) + "\\s+"
                title = title.replacingOccurrences(of: pattern, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            }
            
            // Strip chapter text pattern (e.g. "chapters 1-3", "chapter 5", "ch. 5", "chapters 6 & 7", "chs. 6 & 7")
            let chPattern = #"(?i)\b(?:chapters?|chs?\.?)\s*\d+(?:\s*(?:-|–|&|and|,)\s*\d+)*\b"#
            title = title.replacingOccurrences(of: chPattern, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Strip page range pattern (e.g. "pages 14-80", "pp. 14-80", "p. 5", "pages 12 & 13")
            let pgPattern = #"(?i)\b(?:pages?|pp\b\.?|p\b\.?)\s*\d+(?:\s*(?:-|–|&|and|,)\s*\d+)*\b"#
            title = title.replacingOccurrences(of: pgPattern, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Strip standalone indicator words (e.g. "chapter", "chapters", "pages")
            let standaloneWords = #"(?i)\b(?:readonly|chapters?|ch\b\.?|pages?|pp\b\.?)\b"#
            title = title.replacingOccurrences(of: standaloneWords, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Strip ampersand/conjunction remnants with numbers (e.g. " ( & 7", " & 7", " and 7")
            let remnantPattern = #"(?i)\s*[\(\[\]\)]?\s*(?:&|and|,|\+|\-|\–)\s*\d+\s*[\(\[\]\)]?"#
            title = title.replacingOccurrences(of: remnantPattern, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Strip empty parentheses () or ( )
            title = title.replacingOccurrences(of: #"\(\s*\)"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Collapse multiple spaces
            title = title.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Strip trailing/leading separators or parentheses
            title = title.replacingOccurrences(of: #"^[\:\-\–\s\(\)]+|[\:\-\–\s\(\)]+$"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        }

        title = title.replacingOccurrences(of: #"^(Week\s*\d+|Module\s*\d+|\d+[\.\:\-]*)\s*"#, with: "", options: [.regularExpression, .caseInsensitive]).trimmingCharacters(in: .whitespacesAndNewlines)

        // 4. Ensure Title Starts with Capital Letter
        if let firstChar = title.first, firstChar.isLowercase {
            title = firstChar.uppercased() + title.dropFirst()
        }

        if isReading {
            if title.count > 65 {
                let words = title.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
                if words.count > 10 {
                    title = words.prefix(10).joined(separator: " ") + "..."
                }
            }
        } else {
            if title.count > 60 {
                let words = title.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
                if words.count > 8 {
                    title = words.prefix(8).joined(separator: " ") + "..."
                }
            }
        }

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
        let cleanName = dto.courseName.trimmingCharacters(in: .whitespacesAndNewlines)
        let isPlaceholderName = existingCourse.courseName.isEmpty ||
                                existingCourse.courseName.lowercased() == "new course" ||
                                existingCourse.courseName.lowercased() == "course" ||
                                isGenericKey(normalizeKey(existingCourse.courseName))

        // Preserve user-given course title: Only override if the existing course name is an un-edited placeholder
        if isPlaceholderName && !cleanName.isEmpty {
            existingCourse.courseName = cleanName
        }

        let isPlaceholderCode = (existingCourse.courseCode ?? "").isEmpty ||
                                existingCourse.courseCode?.uppercased() == "CRS" ||
                                isGenericKey(normalizeKey(existingCourse.courseCode ?? ""))
        if isPlaceholderCode, let cleanCode = dto.courseCode?.trimmingCharacters(in: .whitespacesAndNewlines), !cleanCode.isEmpty {
            existingCourse.courseCode = cleanCode
        }

        if let instructor = dto.instructorName, !instructor.isEmpty, (existingCourse.instructorName ?? "").isEmpty {
            existingCourse.instructorName = instructor
        }
        if let email = dto.instructorEmail, !email.isEmpty, (existingCourse.instructorEmail ?? "").isEmpty {
            existingCourse.instructorEmail = email
        }
        if let desc = dto.courseDescription, !desc.isEmpty, (existingCourse.courseDescription ?? "").isEmpty {
            existingCourse.courseDescription = desc
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
            importItemDTOs(items, into: existingCourse, modelContext: modelContext)
        }

        let weeksToImport = dto.weeks ?? []
        for wDTO in weeksToImport {
            let week: Week
            if let targetWeek = existingCourse.weeks.first(where: { $0.weekNumber == wDTO.weekNumber }) {
                week = targetWeek
                if let theme = wDTO.theme, !theme.isEmpty { week.theme = theme }
                if let dateRange = wDTO.dateRangeStr, !dateRange.isEmpty { week.dateRangeStr = dateRange }
            } else {
                let weekId = UUID(uuidString: wDTO.id) ?? UUID()
                week = Week(id: weekId, weekNumber: wDTO.weekNumber, theme: wDTO.theme, dateRangeStr: wDTO.dateRangeStr)
                week.course = existingCourse
                existingCourse.weeks.append(week)
                modelContext.insert(week)
            }

            if let readings = wDTO.readings, !readings.isEmpty {
                let allExistingReadings = existingCourse.weeks.flatMap { $0.readings }
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

                    let parsedDueDate: Date? = WeekDateConverter.parseRobustDate(rDTO.dueDate)

                    if let existingReading = allExistingReadings.first(where: { $0.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normTitle }) {
                        existingReading.summaryText = ""
                        existingReading.keyTakeawaysText = takeaways
                        existingReading.estimatedTimeText = estTime
                        if let pDate = parsedDueDate { existingReading.dueDate = pDate }
                    } else {
                        let cleanTitle = cleanAndSummarizeTitle(rDTO.title, isReading: true)
                        let reading = Reading(
                            id: UUID(),
                            title: cleanTitle,
                            mediaType: mediaType,
                            isCompleted: rDTO.isCompleted ?? false,
                            summaryText: summary,
                            keyTakeawaysText: takeaways,
                            estimatedTimeText: estTime,
                            videoUrl: videoUrl,
                            dueDate: parsedDueDate ?? week.computedEndDate,
                            dateRangeStr: rDTO.dateRangeStr ?? week.dateRangeStr,
                            courseCode: existingCourse.courseCode,
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
                    if let d = parsedDueDate { return WeekDateConverter.weekNumber(for: d) }
                    return 1
                }()
                let finalDueDate: Date = parsedDueDate ?? WeekDateConverter.date(forWeek: weekNumber)

                if let existingAssignment = existingCourse.assignments.first(where: { $0.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normTitle }) {
                    if let inst = aDTO.fullInstructions, !inst.isEmpty { existingAssignment.fullInstructions = inst }
                    if let pts = aDTO.pointsPossible, !pts.isEmpty { existingAssignment.pointsPossible = pts }
                    if let weight = aDTO.weightPercentage, !weight.isEmpty { existingAssignment.weightPercentage = weight }
                    if let bd = sanitizePointsBreakdown(aDTO.pointsBreakdown), !bd.isEmpty { existingAssignment.pointsBreakdown = bd }
                    if parsedDueDate != nil { existingAssignment.dueDate = finalDueDate }
                    existingAssignment.noteText = nil
                } else {
                    let mediaUrl: String? = {
                        if let cand = aDTO.mediaUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = aDTO.fullInstructions, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                        if let extracted = URLHelper.extractFirstURL(from: aDTO.title) { return extracted }
                        return nil
                    }()

                    let cleanTitle = cleanAndSummarizeTitle(aDTO.title, isReading: false)
                    let assignment = Assignment(
                        id: UUID(),
                        title: cleanTitle,
                        weekNumber: weekNumber,
                        dueDate: finalDueDate,
                        fullInstructions: aDTO.fullInstructions ?? "Complete \(aDTO.title)",
                        pointsPossible: aDTO.pointsPossible ?? "100 Points",
                        pointsBreakdown: sanitizePointsBreakdown(aDTO.pointsBreakdown),
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

    private static func importItemDTOs(_ items: [ItemDTO], into course: Course, modelContext: ModelContext) {
        let allAssignmentsInDB = (try? modelContext.fetch(FetchDescriptor<Assignment>())) ?? []
        let courseAssignments = allAssignmentsInDB.filter { assign in
            assign.course?.id == course.id ||
            normalizeKey(assign.courseCode ?? "") == normalizeKey(course.courseCode ?? "") ||
            normalizeKey(assign.course?.courseName ?? "") == normalizeKey(course.courseName)
        }

        let allReadingsInDB = (try? modelContext.fetch(FetchDescriptor<Reading>())) ?? []
        let courseReadings = allReadingsInDB.filter { reading in
            reading.week?.course?.id == course.id ||
            normalizeKey(reading.courseCode ?? "") == normalizeKey(course.courseCode ?? "") ||
            normalizeKey(reading.week?.course?.courseName ?? "") == normalizeKey(course.courseName)
        }

        for item in items {
            let weekNum = item.weekNumber ?? 1
            let normTitle = normalizeTitle(item.title)
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

            let dayName: String? = {
                if let dStr = item.dueDateIso, !dStr.isEmpty, let d = LocalSyllabusParser.extractDayName(from: dStr) { return d }
                if let d = LocalSyllabusParser.extractDayName(from: item.title) { return d }
                if let desc = item.description, !desc.isEmpty, let d = LocalSyllabusParser.extractDayName(from: desc) { return d }
                return nil
            }()

            let isAssignment = item.category.lowercased() == "assignment" || item.category.lowercased().contains("assignment") || item.category.lowercased().contains("exam") || item.category.lowercased().contains("project")
            if isAssignment {
                let existingAssign = course.assignments.first(where: { normalizeTitle($0.title) == normTitle }) ??
                                     courseAssignments.first(where: { normalizeTitle($0.title) == normTitle })
                if let existing = existingAssign {
                    print("ℹ️ [RE-UPLOAD CLAUSE] Assignment '\(item.title)' already exists. Updating in place.")
                    if let desc = item.description, !desc.isEmpty { existing.fullInstructions = desc }
                    if let pts = item.points, !pts.isEmpty { existing.pointsPossible = pts }
                    if let bd = sanitizePointsBreakdown(item.pointsBreakdown), !bd.isEmpty { existing.pointsBreakdown = bd }
                    if let weight = item.percentage, !weight.isEmpty { existing.weightPercentage = weight }
                    if let sub = item.subType, !sub.isEmpty { existing.subTypeRaw = sub }
                    if let media = item.mediaUrl, !media.isEmpty { existing.mediaUrl = media }
                    if parsedDueDate != nil { existing.dueDate = parsedDueDate }
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

                    let cleanTitle = cleanAndSummarizeTitle(item.title, isReading: false)

                    let assignment = Assignment(
                        id: UUID(),
                        title: cleanTitle,
                        weekNumber: weekNum,
                        dueDate: parsedDueDate,
                        fullInstructions: instructionsText,
                        pointsPossible: item.points ?? "100 Points Possible",
                        pointsBreakdown: realBreakdown,
                        noteText: nil,
                        isCompleted: false,
                        isDeleted: false,
                        courseCode: course.courseCode,
                        weightPercentage: item.percentage ?? "10%",
                        subTypeRaw: item.subType ?? "PAPER",
                        mediaUrl: item.mediaUrl
                    )
                    assignment.course = course
                    course.assignments.append(assignment)
                    modelContext.insert(assignment)
                }
            } else {
                let week: Week
                if let targetWeek = course.weeks.first(where: { $0.weekNumber == weekNum }) {
                    week = targetWeek
                } else {
                    week = Week(id: UUID(), weekNumber: weekNum, theme: "Week \(weekNum) Schedule")
                    week.course = course
                    course.weeks.append(week)
                    modelContext.insert(week)
                }

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
                        return WeekDateConverter.formattedDueDate(for: pDate, week: week, weekNumber: weekNum)
                    }
                    return week.dateRangeStr
                }()

                let existingReading = course.weeks.flatMap({ $0.readings }).first(where: { normalizeTitle($0.title) == normTitle }) ??
                                      courseReadings.first(where: { normalizeTitle($0.title) == normTitle })
                if let existing = existingReading {
                    print("ℹ️ [RE-UPLOAD CLAUSE] Reading '\(item.title)' already exists. Updating in place.")
                    existing.summaryText = ""
                    if let media = item.mediaUrl, !media.isEmpty { existing.videoUrl = media }
                    if let pDate = parsedDueDate { existing.dueDate = pDate }
                    if let ch = finalChapter { existing.chapterText = ch }
                    if let pg = finalPages { existing.pagesText = pg }
                } else {
                    let videoUrl: String? = {
                        if let cand = item.mediaUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = item.description, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                        if let extracted = URLHelper.extractFirstURL(from: item.title) { return extracted }
                        return nil
                    }()

                    let cleanTitle = cleanAndSummarizeTitle(item.title, isReading: true)
                    let reading = Reading(
                        id: UUID(),
                        title: cleanTitle,
                        mediaType: mediaType,
                        isCompleted: false,
                        isDeleted: false,
                        summaryText: "",
                        keyTakeawaysText: takeawaysText,
                        estimatedTimeText: estimatedTimeStr,
                        videoUrl: videoUrl,
                        dueDate: parsedDueDate,
                        dateRangeStr: effectiveDateStr,
                        chapterText: finalChapter,
                        pagesText: finalPages,
                        courseCode: course.courseCode,
                        relevantTopics: item.relevantTopics
                    )
                    reading.week = week
                    week.readings.append(reading)
                    modelContext.insert(reading)
                }
            }
        }
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

    public static func formattedDueDate(for date: Date?, week: Week? = nil, weekNumber: Int = 1) -> String {
        let weekNum = max(1, weekNumber)
        guard let explicitDate = date else {
            return "Week \(weekNum)"
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

        return "Due " + formatter.string(from: explicitDate) + " · Week \(weekNum)"
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
