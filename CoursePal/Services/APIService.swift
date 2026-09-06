import Foundation
#if canImport(UIKit)
import UIKit
import PDFKit
#endif

public struct RubricCriterionDTO: Codable, Identifiable {
    public var id: String { criterionName }
    public let criterionName: String
    public let points: Double?
    public let percentage: Double?
    public let description: String?

    enum CodingKeys: String, CodingKey {
        case criterionName = "criterion_name"
        case points
        case percentage
        case description
    }

    public init(criterionName: String, points: Double? = nil, percentage: Double? = nil, description: String? = nil) {
        self.criterionName = criterionName
        self.points = points
        self.percentage = percentage
        self.description = description
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.criterionName = (try container.decodeIfPresent(String.self, forKey: .criterionName)) ?? "Item"
        if let pDouble = try? container.decodeIfPresent(Double.self, forKey: .points) {
            self.points = pDouble
        } else if let pInt = try? container.decodeIfPresent(Int.self, forKey: .points) {
            self.points = Double(pInt)
        } else if let pStr = try? container.decodeIfPresent(String.self, forKey: .points) {
            let digits = pStr.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
            self.points = Double(digits)
        } else {
            self.points = nil
        }
        
        var parsedPct: Double? = nil
        if let pctDouble = try? container.decodeIfPresent(Double.self, forKey: .percentage) {
            parsedPct = pctDouble
        } else if let pctInt = try? container.decodeIfPresent(Int.self, forKey: .percentage) {
            parsedPct = Double(pctInt)
        } else if let pctStr = try? container.decodeIfPresent(String.self, forKey: .percentage) {
            let digits = pctStr.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
            parsedPct = Double(digits)
        }
        
        let desc = try container.decodeIfPresent(String.self, forKey: .description)
        if parsedPct == nil, let d = desc, let pctMatch = d.range(of: #"\b\d+(?:\.\d+)?\s*%"#, options: .regularExpression) {
            let digits = d[pctMatch].components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
            parsedPct = Double(digits)
        }
        self.percentage = parsedPct
        self.description = desc
    }
}

public struct ReadingDTO: Codable, Identifiable {
    public let id: String
    public let title: String
    public let authorName: String?
    public let resourceTitle: String?
    public let mediaType: String?
    public let isCompleted: Bool?
    public let summaryText: String?
    public var keyTakeawaysText: String?
    public let estimatedTimeText: String?
    public let videoUrl: String?
    public var dueDate: String?
    public var dateRangeStr: String?
    public var relevantTopics: String?
    public var chapterText: String?
    public var pagesText: String?
    public var isFavorite: Bool?

    enum CodingKeys: String, CodingKey {
        case id, title
        case authorName = "author_name"
        case resourceTitle = "resource_title"
        case mediaType = "media_type"
        case isCompleted = "is_completed"
        case summaryText = "summary_text"
        case keyTakeawaysText = "key_takeaways_text"
        case estimatedTimeText = "estimated_time_text"
        case videoUrl = "video_url"
        case dueDate = "due_date"
        case dateRangeStr = "date_range_str"
        case relevantTopics = "relevant_topics"
        case chapterText = "chapter_text"
        case pagesText = "pages_text"
        case isFavorite = "is_favorite"
    }

    public init(
        id: String,
        title: String,
        authorName: String? = nil,
        resourceTitle: String? = nil,
        mediaType: String? = "textbook",
        isCompleted: Bool? = false,
        summaryText: String? = nil,
        keyTakeawaysText: String? = nil,
        estimatedTimeText: String? = nil,
        videoUrl: String? = nil,
        dueDate: String? = nil,
        dateRangeStr: String? = nil,
        relevantTopics: String? = nil,
        chapterText: String? = nil,
        pagesText: String? = nil,
        isFavorite: Bool? = false
    ) {
        self.id = id
        self.title = title
        self.authorName = authorName
        self.resourceTitle = resourceTitle
        self.mediaType = mediaType
        self.isCompleted = isCompleted
        self.summaryText = summaryText
        self.keyTakeawaysText = keyTakeawaysText
        self.estimatedTimeText = estimatedTimeText
        self.videoUrl = videoUrl
        self.dueDate = dueDate
        self.dateRangeStr = dateRangeStr
        self.relevantTopics = relevantTopics
        self.chapterText = chapterText
        self.pagesText = pagesText
        self.isFavorite = isFavorite
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try container.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        self.title = (try container.decodeIfPresent(String.self, forKey: .title)) ?? "Reading"
        self.authorName = try container.decodeIfPresent(String.self, forKey: .authorName)
        self.resourceTitle = try container.decodeIfPresent(String.self, forKey: .resourceTitle)
        self.mediaType = try container.decodeIfPresent(String.self, forKey: .mediaType) ?? "textbook"
        self.isCompleted = try container.decodeIfPresent(Bool.self, forKey: .isCompleted) ?? false
        self.summaryText = try container.decodeIfPresent(String.self, forKey: .summaryText)
        self.keyTakeawaysText = try container.decodeIfPresent(String.self, forKey: .keyTakeawaysText)
        self.estimatedTimeText = try container.decodeIfPresent(String.self, forKey: .estimatedTimeText)
        self.videoUrl = try container.decodeIfPresent(String.self, forKey: .videoUrl)
        self.dueDate = try container.decodeIfPresent(String.self, forKey: .dueDate)
        self.dateRangeStr = try container.decodeIfPresent(String.self, forKey: .dateRangeStr)
        self.relevantTopics = try container.decodeIfPresent(String.self, forKey: .relevantTopics)
        self.chapterText = try container.decodeIfPresent(String.self, forKey: .chapterText)
        self.pagesText = try container.decodeIfPresent(String.self, forKey: .pagesText)
        self.isFavorite = try container.decodeIfPresent(Bool.self, forKey: .isFavorite) ?? false
    }
}

public struct WeekDTO: Codable, Identifiable {
    public let id: String
    public let weekNumber: Int
    public let startDate: String?
    public let theme: String?
    public var dateRangeStr: String?
    public var readings: [ReadingDTO]?

    enum CodingKeys: String, CodingKey {
        case id
        case weekNumber = "week_number"
        case startDate = "start_date"
        case theme
        case dateRangeStr = "date_range_str"
        case readings
    }

    public init(
        id: String,
        weekNumber: Int,
        startDate: String? = nil,
        theme: String? = nil,
        dateRangeStr: String? = nil,
        readings: [ReadingDTO]? = nil
    ) {
        self.id = id
        self.weekNumber = weekNumber
        self.startDate = startDate
        self.theme = theme
        self.dateRangeStr = dateRangeStr
        self.readings = readings
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try container.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        self.weekNumber = (try container.decodeIfPresent(Int.self, forKey: .weekNumber)) ?? 1
        self.startDate = try container.decodeIfPresent(String.self, forKey: .startDate)
        self.theme = try container.decodeIfPresent(String.self, forKey: .theme)
        self.dateRangeStr = try container.decodeIfPresent(String.self, forKey: .dateRangeStr)
        self.readings = try container.decodeIfPresent([ReadingDTO].self, forKey: .readings)
    }
}

public struct AssignmentDTO: Codable, Identifiable {
    public let id: String
    public let title: String
    public let dueDate: String?
    public let fullInstructions: String?
    public let pointsPossible: String?
    public let weightPercentage: String?
    public let noteText: String?
    public let pointsBreakdown: String?
    public let relevantTopics: String?
    public let mediaUrl: String?
    public let rubric: [RubricCriterionDTO]?
    public var isFavorite: Bool?
    public var isCompleted: Bool?

    enum CodingKeys: String, CodingKey {
        case id, title
        case dueDate = "due_date"
        case fullInstructions = "full_instructions"
        case pointsPossible = "points_possible"
        case weightPercentage = "weight_percentage"
        case noteText = "note_text"
        case pointsBreakdown = "points_breakdown"
        case relevantTopics = "relevant_topics"
        case mediaUrl = "media_url"
        case rubric
        case isFavorite = "is_favorite"
        case isCompleted = "is_completed"
    }

    public init(
        id: String,
        title: String,
        dueDate: String? = nil,
        fullInstructions: String? = nil,
        pointsPossible: String? = nil,
        weightPercentage: String? = nil,
        noteText: String? = nil,
        pointsBreakdown: String? = nil,
        relevantTopics: String? = nil,
        mediaUrl: String? = nil,
        rubric: [RubricCriterionDTO]? = nil,
        isFavorite: Bool? = false,
        isCompleted: Bool? = false
    ) {
        self.id = id
        self.title = title
        self.dueDate = dueDate
        self.fullInstructions = fullInstructions
        self.pointsPossible = pointsPossible
        self.weightPercentage = weightPercentage
        self.noteText = noteText
        self.pointsBreakdown = pointsBreakdown
        self.relevantTopics = relevantTopics
        self.mediaUrl = mediaUrl
        self.rubric = rubric
        self.isFavorite = isFavorite
        self.isCompleted = isCompleted
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try container.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        self.title = (try container.decodeIfPresent(String.self, forKey: .title)) ?? "Untitled Assignment"
        self.dueDate = try container.decodeIfPresent(String.self, forKey: .dueDate)
        self.fullInstructions = try container.decodeIfPresent(String.self, forKey: .fullInstructions)
        self.pointsPossible = try container.decodeIfPresent(String.self, forKey: .pointsPossible)
        self.weightPercentage = try container.decodeIfPresent(String.self, forKey: .weightPercentage)
        self.noteText = try container.decodeIfPresent(String.self, forKey: .noteText)
        self.pointsBreakdown = try container.decodeIfPresent(String.self, forKey: .pointsBreakdown)
        self.relevantTopics = try container.decodeIfPresent(String.self, forKey: .relevantTopics)
        self.mediaUrl = try container.decodeIfPresent(String.self, forKey: .mediaUrl)
        self.rubric = try container.decodeIfPresent([RubricCriterionDTO].self, forKey: .rubric)
        self.isFavorite = try container.decodeIfPresent(Bool.self, forKey: .isFavorite) ?? false
        self.isCompleted = try container.decodeIfPresent(Bool.self, forKey: .isCompleted) ?? false
    }
}

// MARK: - SyllabusPayload (Target Decodable Free-Tier Schema)

public struct SyllabusPayload: Codable {
    public let courseTitle: String?
    public let instructorName: String?
    public let instructorEmail: String?
    public let readings: [ParsedReading]
    public let assignments: [ParsedAssignment]

    enum CodingKeys: String, CodingKey {
        case courseTitle = "courseTitle"
        case instructorName = "instructorName"
        case instructorEmail = "instructorEmail"
        case readings = "readings"
        case assignments = "assignments"
    }

    public init(
        courseTitle: String? = nil,
        instructorName: String? = nil,
        instructorEmail: String? = nil,
        readings: [ParsedReading] = [],
        assignments: [ParsedAssignment] = []
    ) {
        self.courseTitle = courseTitle
        self.instructorName = instructorName
        self.instructorEmail = instructorEmail
        self.readings = readings
        self.assignments = assignments
    }

    public func toCourseDTO() -> CourseDTO {
        var items: [ItemDTO] = []

        let fullTitle = courseTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Course"
        var extractedCode: String? = nil
        var cleanTitle = fullTitle

        if let colonIdx = fullTitle.firstIndex(of: ":") {
            let prefix = String(fullTitle[..<colonIdx]).trimmingCharacters(in: .whitespacesAndNewlines)
            if prefix.count <= 10 && prefix.range(of: #"[A-Za-z]{2,5}\s*\d{2,4}"#, options: .regularExpression) != nil {
                extractedCode = prefix
                cleanTitle = String(fullTitle[fullTitle.index(after: colonIdx)...]).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }

        func parseWeekNum(from str: String?) -> Int {
            guard let str = str?.trimmingCharacters(in: .whitespacesAndNewlines), !str.isEmpty else {
                return 1
            }
            let lower = str.lowercased()
            if lower.contains("reading week") || lower.contains("spring break") {
                return 8
            }
            if let match = str.range(of: #"(?i)\b(?:week|module|unit|session)\s*(\d{1,2})\b"#, options: .regularExpression) {
                let sub = String(str[match])
                let digits = sub.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                if let num = Int(digits), num > 0 { return num }
            }
            if lower.contains("final") || lower.contains("end of course") || lower.contains("course end") {
                return 12
            }
            if lower.contains("midterm") {
                return 6
            }
            let digits = str.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
            if let num = Int(digits), num > 0 { return num }
            return 1
        }

        for r in readings {
            let weekOrMod = r.weekOrModule ?? ""
            let weekNum: Int = {
                let parsed = parseWeekNum(from: weekOrMod)
                if parsed > 0 { return parsed }
                if let d = r.date {
                    let fromDate = parseWeekNum(from: d)
                    if fromDate > 0 { return fromDate }
                }
                return 1
            }()
            let rawReadingTitle = (r.title ?? "Reading").trimmingCharacters(in: .whitespacesAndNewlines)
            let lowerTitle = rawReadingTitle.lowercased()
            let lowerTopic = (r.topic ?? "").lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
            let lowerMod = weekOrMod.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)

            // If this item is merely a schedule break (e.g. Reading Week or Spring Break or Flex Week) without an actual book/chapters:
            let isBreak = lowerTitle.contains("reading week") || lowerTitle.contains("spring break") || lowerTitle.contains("flex week") || lowerTopic.contains("reading week") || lowerTopic.contains("flex week") || lowerMod.contains("reading week") || lowerMod.contains("flex week")
            let hasNoBook = (r.authors == nil || r.authors!.isEmpty) && (r.chaptersOrPages == nil || r.chaptersOrPages!.isEmpty)
            if isBreak && hasNoBook {
                let breakTitle = (lowerTitle.contains("flex week") || lowerTopic.contains("flex week") || lowerMod.contains("flex week")) ? "Flex Week" : "Reading Week"
                let breakItem = ItemDTO(
                    title: "",
                    authorName: nil,
                    resourceTitle: nil,
                    category: "Reading",
                    subType: "BREAK",
                    description: nil,
                    points: nil,
                    pointsBreakdown: nil,
                    percentage: nil,
                    weekNumber: weekNum,
                    dueDateIso: r.date,
                    mediaUrl: nil,
                    relevantTopics: breakTitle,
                    chapterText: nil,
                    pagesText: nil
                )
                items.append(breakItem)
                continue
            }

            let cleanAuthors = r.authors?.replacingOccurrences(of: #"^[:;\-\s]+|[:;\-\s]+$"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)

            var chText: String? = nil
            var pgText: String? = nil
            if let cp = r.chaptersOrPages?.trimmingCharacters(in: .whitespacesAndNewlines), !cp.isEmpty {
                if cp.lowercased().contains("ch") || cp.lowercased().contains("chap") {
                    chText = Reading.cleanChapterFromRaw(cp) ?? cp
                } else if cp.lowercased().contains("pp") || cp.lowercased().contains("page") || cp.range(of: #"\d+\s*[-–]\s*\d+"#, options: .regularExpression) != nil {
                    pgText = cp
                } else {
                    chText = Reading.cleanChapterFromRaw(cp) ?? cp
                }
            }

            let distilledReadingTitle = Reading.distillSmartReadingTitle(rawReadingTitle)
            var readingTitle = distilledReadingTitle
            var readingDesc: String? = nil

            let authLower = (cleanAuthors ?? "").lowercased()
            let lowerReadingTitle = readingTitle.lowercased()
            if lowerReadingTitle == authLower || ["reading", "readings", "assigned readings", "assigned reading"].contains(lowerReadingTitle) {
                if let t = r.topic?.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty {
                    let distilledTopic = Reading.distillSmartReadingTitle(t)
                    if distilledTopic != "Reading" && !distilledTopic.isEmpty {
                        readingTitle = distilledTopic
                    }
                }
            }

            if lowerTitle.contains("see brightspace") || lowerTitle.contains("assigned readings") || lowerTitle.contains("refer to portal") || lowerTitle.contains("check brightspace") || lowerTitle.contains("see canvas") {
                readingTitle = "Assigned Readings"
            }

            let combinedReadingTopics: String? = {
                var parts: [String] = []
                let wOrM = weekOrMod.trimmingCharacters(in: .whitespacesAndNewlines)
                if !wOrM.isEmpty { parts.append(wOrM) }
                if let t = r.topic?.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty, !wOrM.lowercased().contains(t.lowercased()) {
                    parts.append(t)
                }
                return parts.isEmpty ? nil : parts.joined(separator: " • ")
            }()

            let item = ItemDTO(
                title: readingTitle,
                authorName: (cleanAuthors?.isEmpty ?? true) ? nil : cleanAuthors,
                resourceTitle: (r.resourceTitle?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) ? r.resourceTitle : nil,
                category: "Reading",
                subType: "TEXTBOOK",
                description: readingDesc,
                points: nil,
                pointsBreakdown: nil,
                percentage: nil,
                weekNumber: weekNum,
                dueDateIso: r.date,
                mediaUrl: r.mediaUrl ?? URLHelper.extractFirstURL(from: (r.title ?? "") + " " + (r.chaptersOrPages ?? "") + " " + (r.topic ?? "")),
                relevantTopics: combinedReadingTopics,
                chapterText: chText,
                pagesText: pgText
            )
            items.append(item)
        }

        for a in assignments {
            let weekOrMod = a.weekOrModule ?? ""
            let assignTitle = (a.title ?? "Assignment").trimmingCharacters(in: .whitespacesAndNewlines)
            let weekNum: Int = {
                let fromModule = parseWeekNum(from: weekOrMod)
                if fromModule > 0 && fromModule <= 16 { return fromModule }
                if let rawDue = a.rawDueDate, !rawDue.isEmpty {
                    let fromDue = parseWeekNum(from: rawDue)
                    if fromDue > 0 && fromDue <= 16 { return fromDue }
                }
                return 1
            }()
            let catUpper = (a.category ?? "ASSIGNMENT").uppercased()
            let subType = catUpper.isEmpty ? "ASSIGNMENT" : catUpper

            let fullInstructions = (a.instructions?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
                ? "Due: \(a.rawDueDate ?? (weekOrMod.isEmpty ? "Scheduled" : weekOrMod))"
                : a.instructions!
            let rubricBreakdown = a.rubric?.joined(separator: "\n")

            let item = ItemDTO(
                title: assignTitle,
                authorName: nil,
                resourceTitle: nil,
                category: "Assignment",
                subType: subType,
                description: fullInstructions,
                points: a.points ?? "100 Points",
                pointsBreakdown: rubricBreakdown,
                percentage: a.weight,
                weekNumber: weekNum,
                dueDateIso: a.rawDueDate,
                mediaUrl: a.mediaUrl ?? URLHelper.extractFirstURL(from: assignTitle + " " + (a.instructions ?? "")),
                relevantTopics: weekOrMod.isEmpty ? nil : weekOrMod,
                chapterText: nil,
                pagesText: nil
            )
            items.append(item)
        }

        return CourseDTO(
            id: UUID().uuidString,
            creatorId: nil,
            courseName: cleanTitle,
            courseCode: extractedCode,
            courseDescription: nil,
            instructorName: (instructorName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) ? nil : instructorName?.trimmingCharacters(in: .whitespacesAndNewlines),
            instructorEmail: (instructorEmail?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) ? nil : instructorEmail?.trimmingCharacters(in: .whitespacesAndNewlines),
            officeHours: nil,
            termWeeks: max(12, (items.compactMap { $0.weekNumber }.max() ?? 12)),
            sharingCode: "",
            weeks: nil,
            assignments: nil,
            items: items,
            dataExtractionStats: ExtractionStatsDTO(status: "success", confidenceScore: 10, missingFields: [])
        )
    }
}

public struct ParsedReading: Codable {
    public let weekOrModule: String?
    public let topic: String?
    public let title: String?
    public let authors: String?
    public let chaptersOrPages: String?
    public let date: String?
    public let mediaUrl: String?
    public let resourceTitle: String?

    enum CodingKeys: String, CodingKey {
        case weekOrModule = "weekOrModule"
        case topic = "topic"
        case title = "title"
        case authors = "authors"
        case chaptersOrPages = "chaptersOrPages"
        case date = "date"
        case mediaUrl = "mediaUrl"
        case resourceTitle = "resourceTitle"
    }

    public init(weekOrModule: String? = nil, topic: String? = nil, title: String? = nil, authors: String? = nil, chaptersOrPages: String? = nil, date: String? = nil, mediaUrl: String? = nil, resourceTitle: String? = nil) {
        self.weekOrModule = weekOrModule
        self.topic = topic
        self.title = title
        self.authors = authors
        self.chaptersOrPages = chaptersOrPages
        self.date = date
        self.mediaUrl = mediaUrl
        self.resourceTitle = resourceTitle
    }
}

public struct ParsedAssignment: Codable {
    public let weekOrModule: String?
    public let title: String?
    public let category: String?
    public let rawDueDate: String?
    public let weight: String?
    public let points: String?
    public let instructions: String?
    public let rubric: [String]?
    public let mediaUrl: String?

    enum CodingKeys: String, CodingKey {
        case weekOrModule = "weekOrModule"
        case title = "title"
        case category = "category"
        case rawDueDate = "rawDueDate"
        case weight = "weight"
        case points = "points"
        case instructions = "instructions"
        case rubric = "rubric"
        case mediaUrl = "mediaUrl"
    }

    public init(
        weekOrModule: String? = nil,
        title: String? = nil,
        category: String? = "ASSIGNMENT",
        rawDueDate: String? = nil,
        weight: String? = nil,
        points: String? = nil,
        instructions: String? = nil,
        rubric: [String]? = nil,
        mediaUrl: String? = nil
    ) {
        self.weekOrModule = weekOrModule
        self.title = title
        self.category = category
        self.rawDueDate = rawDueDate
        self.weight = weight
        self.points = points
        self.instructions = instructions
        self.rubric = rubric
        self.mediaUrl = mediaUrl
    }
}

import Network
import CoreGraphics

public struct ItemDTO: Codable, Identifiable {
    public var id: String { title + "\(weekNumber ?? 1)" }
    public let title: String
    public let authorName: String?
    public let resourceTitle: String?
    public let category: String
    public let subType: String?
    public let description: String?
    public let points: String?
    public let pointsBreakdown: String?
    public let percentage: String?
    public let weekNumber: Int?
    public let dueDateIso: String?
    public let chapterText: String?
    public let pagesText: String?
    public let mediaUrl: String?
    public let relevantTopics: String?
    public let rubric: [RubricCriterionDTO]?

    enum CodingKeys: String, CodingKey {
        case title, category, description, points, percentage, rubric
        case authorName = "author_name"
        case resourceTitle = "resource_title"
        case subType = "sub_type"
        case pointsBreakdown = "points_breakdown"
        case weekNumber = "week_number"
        case dueDateIso = "due_date_iso"
        case mediaUrl = "media_url"
        case relevantTopics = "relevant_topics"
        case chapterText = "chapter_text"
        case pagesText = "pages_text"
        case summaryText = "summary_text"
        case keyTakeaways = "key_takeaways"
        case estimatedTime = "estimated_time"
    }

    public var summaryText: String?
    public var keyTakeaways: String?
    public var estimatedTime: String?

    public init(
        title: String,
        authorName: String? = nil,
        resourceTitle: String? = nil,
        category: String,
        subType: String? = "PAPER",
        description: String? = nil,
        points: String? = nil,
        pointsBreakdown: String? = nil,
        percentage: String? = nil,
        weekNumber: Int? = 1,
        dueDateIso: String? = nil,
        mediaUrl: String? = nil,
        relevantTopics: String? = nil,
        chapterText: String? = nil,
        pagesText: String? = nil,
        summaryText: String? = nil,
        keyTakeaways: String? = nil,
        estimatedTime: String? = nil,
        rubric: [RubricCriterionDTO]? = nil
    ) {
        self.title = title
        self.authorName = authorName
        self.resourceTitle = resourceTitle
        self.category = category
        self.subType = subType
        self.description = description
        self.points = points
        self.pointsBreakdown = pointsBreakdown
        self.percentage = percentage
        self.weekNumber = weekNumber
        self.dueDateIso = dueDateIso
        self.mediaUrl = mediaUrl
        self.relevantTopics = relevantTopics
        self.chapterText = chapterText
        self.pagesText = pagesText
        self.summaryText = summaryText
        self.keyTakeaways = keyTakeaways
        self.estimatedTime = estimatedTime
        self.rubric = rubric
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.title = (try container.decodeIfPresent(String.self, forKey: .title)) ?? "Untitled Item"
        self.authorName = try container.decodeIfPresent(String.self, forKey: .authorName)
        self.resourceTitle = try container.decodeIfPresent(String.self, forKey: .resourceTitle)
        self.category = (try container.decodeIfPresent(String.self, forKey: .category)) ?? "Assignment"
        self.subType = try container.decodeIfPresent(String.self, forKey: .subType)
        self.description = try container.decodeIfPresent(String.self, forKey: .description)
        
        if let str = try? container.decodeIfPresent(String.self, forKey: .points) {
            self.points = str
        } else if let num = try? container.decodeIfPresent(Int.self, forKey: .points) {
            self.points = "\(num) Points Possible"
        } else if let num = try? container.decodeIfPresent(Double.self, forKey: .points) {
            self.points = "\(Int(num)) Points Possible"
        } else {
            self.points = nil
        }

        self.pointsBreakdown = try container.decodeIfPresent(String.self, forKey: .pointsBreakdown)

        if let str = try? container.decodeIfPresent(String.self, forKey: .percentage) {
            self.percentage = str
        } else if let num = try? container.decodeIfPresent(Int.self, forKey: .percentage) {
            self.percentage = "\(num)% of Final Grade"
        } else if let num = try? container.decodeIfPresent(Double.self, forKey: .percentage) {
            self.percentage = "\(Int(num))% of Final Grade"
        } else {
            self.percentage = nil
        }

        if let val = try? container.decodeIfPresent(Int.self, forKey: .weekNumber) {
            self.weekNumber = val
        } else if let str = try? container.decodeIfPresent(String.self, forKey: .weekNumber), let val = Int(str.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()) {
            self.weekNumber = val
        } else {
            self.weekNumber = nil
        }

        let rawDue = try container.decodeIfPresent(String.self, forKey: .dueDateIso)?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let d = rawDue, !d.isEmpty, d.lowercased() != "null" && d.lowercased() != "nil" {
            self.dueDateIso = d
        } else {
            self.dueDateIso = nil
        }

        self.mediaUrl = try container.decodeIfPresent(String.self, forKey: .mediaUrl)
        self.relevantTopics = try container.decodeIfPresent(String.self, forKey: .relevantTopics)
        self.chapterText = try container.decodeIfPresent(String.self, forKey: .chapterText)
        self.pagesText = try container.decodeIfPresent(String.self, forKey: .pagesText)
        self.summaryText = try container.decodeIfPresent(String.self, forKey: .summaryText)
        self.keyTakeaways = try container.decodeIfPresent(String.self, forKey: .keyTakeaways)
        self.estimatedTime = try container.decodeIfPresent(String.self, forKey: .estimatedTime)
        self.rubric = try container.decodeIfPresent([RubricCriterionDTO].self, forKey: .rubric)
    }
}

public struct ExtractionStatsDTO: Codable {
    public let status: String
    public let confidenceScore: Int
    public let missingFields: [String]

    enum CodingKeys: String, CodingKey {
        case status
        case confidenceScore = "confidence_score"
        case missingFields = "missing_fields"
    }

    public init(status: String = "success", confidenceScore: Int = 10, missingFields: [String] = []) {
        self.status = status
        self.confidenceScore = confidenceScore
        self.missingFields = missingFields
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.status = (try container.decodeIfPresent(String.self, forKey: .status)) ?? "success"

        if let val = try? container.decodeIfPresent(Int.self, forKey: .confidenceScore) {
            self.confidenceScore = val
        } else if let num = try? container.decodeIfPresent(Double.self, forKey: .confidenceScore) {
            self.confidenceScore = Int(num)
        } else if let str = try? container.decodeIfPresent(String.self, forKey: .confidenceScore), let val = Int(str) {
            self.confidenceScore = val
        } else {
            self.confidenceScore = 10
        }

        self.missingFields = (try container.decodeIfPresent([String].self, forKey: .missingFields)) ?? []
    }
}

public struct CourseDTO: Codable, Identifiable {
    public var id: String
    public var creatorId: String?
    public var courseName: String
    public var courseCode: String?
    public var courseDescription: String?
    public var instructorName: String?
    public var instructorEmail: String?
    public var officeHours: String?
    public var termWeeks: Int?
    public var sharingCode: String
    public var weeks: [WeekDTO]?
    public var assignments: [AssignmentDTO]?
    public var items: [ItemDTO]?
    public var dataExtractionStats: ExtractionStatsDTO?
    public var isFavorite: Bool?
    public var chatHistoryJSON: String?

    enum CodingKeys: String, CodingKey {
        case id
        case creatorId = "creator_id"
        case courseName = "course_name"
        case courseTitle = "course_title"
        case courseCode = "course_code"
        case courseDescription = "course_description"
        case instructorName = "instructor_name"
        case instructorEmail = "instructor_email"
        case officeHours = "office_hours"
        case termWeeks = "term_weeks"
        case sharingCode = "sharing_code"
        case weeks, assignments, items
        case dataExtractionStats = "data_extraction_stats"
        case isFavorite = "is_favorite"
        case chatHistoryJSON = "chat_history_json"
    }

    public init(
        id: String = UUID().uuidString,
        creatorId: String? = nil,
        courseName: String,
        courseCode: String? = nil,
        courseDescription: String? = nil,
        instructorName: String? = nil,
        instructorEmail: String? = nil,
        officeHours: String? = nil,
        termWeeks: Int? = nil,
        sharingCode: String,
        weeks: [WeekDTO]? = nil,
        assignments: [AssignmentDTO]? = nil,
        items: [ItemDTO]? = nil,
        dataExtractionStats: ExtractionStatsDTO? = nil,
        isFavorite: Bool? = false,
        chatHistoryJSON: String? = nil
    ) {
        self.id = id
        self.creatorId = creatorId
        self.courseName = courseName
        self.courseCode = courseCode
        self.courseDescription = courseDescription
        self.instructorName = instructorName
        self.instructorEmail = instructorEmail
        self.officeHours = officeHours
        self.termWeeks = termWeeks
        self.sharingCode = sharingCode
        self.weeks = weeks
        self.assignments = assignments
        self.items = items
        self.dataExtractionStats = dataExtractionStats
        self.isFavorite = isFavorite
        self.chatHistoryJSON = chatHistoryJSON
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try container.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        self.creatorId = try container.decodeIfPresent(String.self, forKey: .creatorId) ?? "local-user"
        let nameInSchema = try container.decodeIfPresent(String.self, forKey: .courseName)
        let titleInSchema = try container.decodeIfPresent(String.self, forKey: .courseTitle)
        self.courseName = nameInSchema ?? titleInSchema ?? "Academic Course"
        self.courseCode = try container.decodeIfPresent(String.self, forKey: .courseCode)
        self.courseDescription = try container.decodeIfPresent(String.self, forKey: .courseDescription)
        self.instructorName = try container.decodeIfPresent(String.self, forKey: .instructorName)
        self.instructorEmail = try container.decodeIfPresent(String.self, forKey: .instructorEmail)
        self.officeHours = try container.decodeIfPresent(String.self, forKey: .officeHours)
        self.termWeeks = try container.decodeIfPresent(Int.self, forKey: .termWeeks) ?? 16
        self.sharingCode = (try container.decodeIfPresent(String.self, forKey: .sharingCode)) ?? String(format: "%06d", Int.random(in: 100000...999999))
        self.weeks = try container.decodeIfPresent([WeekDTO].self, forKey: .weeks)
        self.assignments = try container.decodeIfPresent([AssignmentDTO].self, forKey: .assignments)
        self.items = try container.decodeIfPresent([ItemDTO].self, forKey: .items)
        self.dataExtractionStats = try container.decodeIfPresent(ExtractionStatsDTO.self, forKey: .dataExtractionStats)
        self.isFavorite = try container.decodeIfPresent(Bool.self, forKey: .isFavorite) ?? false
        self.chatHistoryJSON = try container.decodeIfPresent(String.self, forKey: .chatHistoryJSON)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(creatorId, forKey: .creatorId)
        try container.encode(courseName, forKey: .courseName)
        try container.encodeIfPresent(courseCode, forKey: .courseCode)
        try container.encodeIfPresent(courseDescription, forKey: .courseDescription)
        try container.encodeIfPresent(instructorName, forKey: .instructorName)
        try container.encodeIfPresent(instructorEmail, forKey: .instructorEmail)
        try container.encodeIfPresent(officeHours, forKey: .officeHours)
        try container.encodeIfPresent(termWeeks, forKey: .termWeeks)
        try container.encode(sharingCode, forKey: .sharingCode)
        try container.encodeIfPresent(weeks, forKey: .weeks)
        try container.encodeIfPresent(assignments, forKey: .assignments)
        try container.encodeIfPresent(items, forKey: .items)
        try container.encodeIfPresent(dataExtractionStats, forKey: .dataExtractionStats)
        try container.encodeIfPresent(isFavorite, forKey: .isFavorite)
        try container.encodeIfPresent(chatHistoryJSON, forKey: .chatHistoryJSON)
    }
}

private struct StringCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int?
    init(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

public final class NetworkMonitor: ObservableObject {
    public static let shared = NetworkMonitor()
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitorQueue")
    @Published public var isConnected: Bool = true

    private init() {
        monitor.pathUpdateHandler = { path in
            DispatchQueue.main.async {
                self.isConnected = path.status == .satisfied
            }
        }
        monitor.start(queue: queue)
    }

    public var isOnline: Bool {
        monitor.currentPath.status == .satisfied || isConnected
    }
}

@MainActor
public final class APIService: ObservableObject {
    public static let shared = APIService()
    
    @Published public var baseURL: String = "http://192.168.10.50:3088"
    public let currentUserId: UUID = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!

    public static var bundledAPIKey: String {
        let encoded = "QVEuQWI4Uk42TDlyVzFxZ3NlVDBNS1R2V3JqVUdiU0tQVEhja1dtOE9oWFdLLWNETVh2Q3c="
        if let data = Data(base64Encoded: encoded), let key = String(data: data, encoding: .utf8) {
            return key
        }
        return ""
    }

    @Published public var geminiAPIKey: String {
        didSet {
            UserDefaults.standard.set(geminiAPIKey, forKey: "gemini_api_key")
        }
    }
    @Published public var useLocalOnlyMode: Bool = false

    public var activeAPIKey: String {
        let key = geminiAPIKey.trimmingCharacters(in: .whitespacesAndNewlines)
        if !key.isEmpty { return key }
        return Self.bundledAPIKey
    }

    private init() {
        if let savedKey = UserDefaults.standard.string(forKey: "gemini_api_key"),
           !savedKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            self.geminiAPIKey = savedKey.trimmingCharacters(in: .whitespacesAndNewlines)
        } else {
            self.geminiAPIKey = Self.bundledAPIKey
        }
    }

    private static func repairTruncatedJSON(_ jsonString: String) -> String {
        var str = jsonString.trimmingCharacters(in: .whitespacesAndNewlines)
        if str.hasPrefix("```") {
            str = str.components(separatedBy: "\n").dropFirst().joined(separator: "\n")
            if str.hasSuffix("```") {
                str = String(str.dropLast(3)).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        var openBrackets = 0
        var openBraces = 0
        var inString = false
        var isEscaped = false

        for char in str {
            if isEscaped {
                isEscaped = false
                continue
            }
            if char == "\\" {
                isEscaped = true
                continue
            }
            if char == "\"" {
                inString.toggle()
                continue
            }
            if !inString {
                if char == "{" { openBraces += 1 }
                else if char == "}" { openBraces -= 1 }
                else if char == "[" { openBrackets += 1 }
                else if char == "]" { openBrackets -= 1 }
            }
        }

        if inString { str.append("\"") }
        while openBrackets > 0 {
            str.append("]")
            openBrackets -= 1
        }
        while openBraces > 0 {
            str.append("}")
            openBraces -= 1
        }
        return str
    }

    private static func decodeCourseDTO(from jsonBodyData: Data) throws -> CourseDTO {
        let decoder = JSONDecoder()
        if let payload = try? decoder.decode(SyllabusPayload.self, from: jsonBodyData) {
            return payload.toCourseDTO()
        }
        if let array = try? decoder.decode([SyllabusPayload].self, from: jsonBodyData), let first = array.first {
            return first.toCourseDTO()
        }
        if let single = try? decoder.decode(CourseDTO.self, from: jsonBodyData) {
            return single
        }
        if let array = try? decoder.decode([CourseDTO].self, from: jsonBodyData), let first = array.first {
            return first
        }
        return try decoder.decode(CourseDTO.self, from: jsonBodyData)
    }

    public struct SyllabusSourceLocation: Codable, Sendable {
        public let overviewPageNumber: Int
        public let overviewQuote: String
        public let rubricPageNumber: Int?
        public let rubricQuote: String?

        public init(overviewPageNumber: Int, overviewQuote: String, rubricPageNumber: Int? = nil, rubricQuote: String? = nil) {
            self.overviewPageNumber = overviewPageNumber
            self.overviewQuote = overviewQuote
            self.rubricPageNumber = rubricPageNumber
            self.rubricQuote = rubricQuote
        }
    }

    public func locateSyllabusSource(
        pdfData: Data,
        itemTitle: String,
        isAssignment: Bool,
        weekNumber: Int? = nil
    ) async -> SyllabusSourceLocation? {
        let keyToUse = activeAPIKey
        guard !keyToUse.isEmpty else { return nil }

        guard let doc = PDFDocument(data: pdfData), doc.pageCount > 0 else { return nil }
        var pagesText = ""
        for i in 0..<doc.pageCount {
            if let page = doc.page(at: i) {
                let pageStr = page.string ?? ""
                pagesText += "--- PAGE \(i + 1) ---\n\(pageStr)\n\n"
            }
        }
        guard !pagesText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }

        let itemTypeStr = isAssignment ? "Assignment" : "Reading"
        let weekStr = (weekNumber != nil && weekNumber! > 0) ? " (Week \(weekNumber!))" : ""
        let prompt = """
        You are an academic syllabus locator. Given the following syllabus document with page markers, locate the exact 1-indexed page number and verbatim quote to highlight for:
        Item: "\(itemTitle)"\(weekStr), Type: \(itemTypeStr)

        CRITICAL INSTRUCTIONS:
        1. overview_page_number & overview_quote: Locate the specific section or page where this item is formally detailed and described in full (e.g. "Research Article Analysis-Group Presentation (assignment 1)"). Do NOT select generic intro text, general course objectives, or course outcomes from page 1 or 2 if the specific assignment details appear later.
        2. rubric_page_number & rubric_quote: Locate the exact grading criteria table or rubric section associated with this item (e.g. "Grading Criteria Grade Points" or criterion lines such as "Organization and Coherence 10 Points").

        Respond ONLY with valid JSON in this exact structure:
        {
          "overview_page_number": <integer 1-indexed>,
          "overview_quote": "<exact verbatim phrase or header to highlight in yellow>",
          "rubric_page_number": <integer 1-indexed where grading criteria or rubric is located, or null if none>,
          "rubric_quote": "<exact verbatim header such as 'Grading Criteria' or rubric criteria line to highlight, or null if none>"
        }

        SYLLABUS:
        \(pagesText)
        """

        let payload: [String: Any] = [
            "contents": [
                ["parts": [["text": prompt]]]
            ],
            "generationConfig": [
                "temperature": 0.1,
                "responseMimeType": "application/json"
            ]
        ]
        guard let httpBody = try? JSONSerialization.data(withJSONObject: payload) else { return nil }

        let modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash"]
        for modelName in modelsToTry {
            let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/\(modelName):generateContent?key=\(keyToUse)"
            guard let url = URL(string: endpoint) else { continue }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 25
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(keyToUse, forHTTPHeaderField: "x-goog-api-key")
            request.httpBody = httpBody

            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else { continue }

                struct Part: Decodable { let text: String }
                struct Content: Decodable { let parts: [Part] }
                struct Candidate: Decodable { let content: Content }
                struct GeminiResponse: Decodable { let candidates: [Candidate]? }

                if let geminiResp = try? JSONDecoder().decode(GeminiResponse.self, from: data),
                   let rawJsonText = geminiResp.candidates?.first?.content.parts.first?.text {
                    struct LocationDTO: Decodable {
                        let overview_page_number: Int?
                        let overview_quote: String?
                        let rubric_page_number: Int?
                        let rubric_quote: String?
                    }
                    if let rawData = rawJsonText.data(using: .utf8),
                       let loc = try? JSONDecoder().decode(LocationDTO.self, from: rawData),
                       let pNum = loc.overview_page_number, let quote = loc.overview_quote, !quote.isEmpty {
                        return SyllabusSourceLocation(
                            overviewPageNumber: pNum,
                            overviewQuote: quote,
                            rubricPageNumber: loc.rubric_page_number,
                            rubricQuote: loc.rubric_quote
                        )
                    }
                }
            } catch {
                continue
            }
        }
        return nil
    }

    public func testGeminiConnection(apiKey: String) async throws -> Bool {
        let keyToUse = apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Self.bundledAPIKey : apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !keyToUse.isEmpty else { return false }

        let modelsToTry = ["gemini-3.6-flash"]
        let payload: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["text": "Return JSON: {\"status\": \"ok\"}"]
                    ]
                ]
            ],
            "generationConfig": [
                "responseMimeType": "application/json"
            ]
        ]
        guard let httpBody = try? JSONSerialization.data(withJSONObject: payload) else { return false }

        for modelName in modelsToTry {
            let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/\(modelName):generateContent?key=\(keyToUse)"
            guard let url = URL(string: endpoint) else { continue }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 30
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(keyToUse, forHTTPHeaderField: "x-goog-api-key")
            request.httpBody = httpBody

            if let (_, response) = try? await URLSession.shared.data(for: request),
               let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                return true
            }
        }
        return false
    }

    public func parsePDFDocumentData(_ pdfData: Data) async throws -> CourseDTO {
        guard NetworkMonitor.shared.isOnline else {
            throw NSError(
                domain: "APIService",
                code: 1009,
                userInfo: [NSLocalizedDescriptionKey: "API Error [1009]: Internet Connection Required. Please connect to the internet to process course documents."]
            )
        }
        let keyToUse = activeAPIKey
        print("[APIService] Processing Multimodal Base64 PDF with Gemini API...")
        return try await parsePDFDataWithGemini(pdfData, apiKey: keyToUse)
    }

    public static func compressPDFDataIfNeeded(_ pdfData: Data, maxSizeBytes: Int = 10 * 1024 * 1024) -> Data {
        guard pdfData.count > maxSizeBytes else { return pdfData }
        #if canImport(UIKit)
        guard let provider = CGDataProvider(data: pdfData as CFData),
              let pdfDoc = CGPDFDocument(provider) else { return pdfData }
        let pageCount = pdfDoc.numberOfPages
        let mutableData = NSMutableData()
        guard let consumer = CGDataConsumer(data: mutableData as CFMutableData) else { return pdfData }
        var mediaBox = CGRect(x: 0, y: 0, width: 612, height: 792)
        guard let pdfContext = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else { return pdfData }
        
        for i in 1...min(pageCount, 50) {
            autoreleasepool {
                guard let page = pdfDoc.page(at: i) else { return }
                var pageBox = page.getBoxRect(.mediaBox)
                pdfContext.beginPage(mediaBox: &pageBox)
                pdfContext.drawPDFPage(page)
                pdfContext.endPage()
            }
        }
        pdfContext.closePDF()
        return mutableData.count > 0 ? (mutableData as Data) : pdfData
        #else
        return pdfData
        #endif
    }

    public func parsePDFDataWithGemini(_ pdfData: Data, apiKey: String) async throws -> CourseDTO {
        guard NetworkMonitor.shared.isOnline else {
            throw NSError(
                domain: "APIService",
                code: 1009,
                userInfo: [NSLocalizedDescriptionKey: "API Error [1009]: Internet Connection Required."]
            )
        }

        let schedulePages = DocumentExtractor.extractSchedulePageImages(from: pdfData, maxPages: 8)
        let modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"]

        let systemInstructions = """
        You are a universal academic syllabus extraction engine. Extract all weekly readings, lecture topics, and deliverables/assignments into the specified JSON format.

        UNIVERSAL EXTRACTION RULES:
        0. FACULTY & INSTRUCTOR DETAILS:
           - "instructorName": Full name and credentials of the primary faculty, professor, or instructor if stated in the syllabus text (e.g., "Dr. Alireza Sedghi Taromi, PhD" or "Marie-Pier Gilbert"). If none found, null.
           - "instructorEmail": Email address of the faculty member or instructor if stated (e.g., "sedghitaromialireza@cityu.edu"). If none found, null.

        1. COURSE TITLE:
           - Extract the course name and code (e.g., "CPC 512: Family Systems Approaches to Counselling") ONLY into "courseTitle".
           - NEVER prefix or include the course name inside individual reading or assignment titles.

        2. CHRONOLOGICAL SCHEDULE ANCHOR:
           - If the syllabus contains an introductory module/curriculum overview map followed by an actual chronological course schedule (e.g. Weeks 1-12 with dates), anchor all weekly items to the CHRONOLOGICAL SCHEDULE so that every week and calendar date is preserved.

        3. READINGS BREAKDOWN & TOPICS:
           - CRITICAL: If a week or module lists multiple textbooks, authors, or articles (e.g., "Corey Ch. 1 & 2" AND "Yalom Ch. 1", or "Gehart chapter 5" AND "Articles"), output EACH textbook or article as a SEPARATE object in the "readings" array! Never merge multiple books together into one object.
           - "weekOrModule": Designated schedule week and/or module (e.g., "Week 1", "Week 2", "Module 1"). CRITICAL: If the document explicitly designates modules in the schedule, include "Module X". BUT NEVER put "Module" if the course schedule only uses Weeks.
           - "date": Date or date range listed in the table (e.g., "July 2/3", "4/2/26").
           - "topic": The weekly session, module, or lecture topics taught during that class from the schedule table (e.g. "Creating a caring community; Introduction to Family Systems; Course overview").
           - "title": Specific reading name, chapter designation, or article title as given in the readings (e.g. "Chapters 1-3", "Chapter 5", "Articles", "Review sample comprehensive exam cases"). CRITICAL: If the reading is a chapter, always write out "Chapter" (for single, e.g. "Chapter 1") or "Chapters" (for multiple/range, e.g. "Chapters 1 & 2", "Chapters 1-3"). NEVER abbreviate as "ch", "ch.", "chp", or "chp.".
           - "authors": Specific author for that reading if mentioned (e.g., "Gehart", "Corey", "Yalom"). If none, null.
           - "resourceTitle": Book, textbook, or publication title if explicitly named in the syllabus, else null.
           - "chaptersOrPages": The exact chapter or page numbers for that specific reading. Always write out "Chapter" or "Chapters" (e.g., "Chapter 1", "Chapters 1 & 2", "Chapters 1-3", "pp. 25-50"). Never abbreviate as "ch" or "chp".
           - "mediaUrl": Any direct URL, web link, DOI, or portal link directly associated with this reading if present in the document, else null.
           - For non-instructional weeks like "Reading Week" (No classes), "Spring Break", or "Flex Week", create an entry with title "Reading Week" or "Flex Week", topic "Reading Week" or "Flex Week", and date.

        4. DELIVERABLES & DETAILED RUBRIC CRITERIA:
           - Extract every assignment, presentation, paper, exam, or deliverable from BOTH the schedule table (e.g. "Due: Family Mapping Papers", "in-class case conceptualization worth 20%") AND any "Course Assignment Details" / "Grading Criteria" sections.
           - "title": Clean assignment title (e.g., "Family Mapping Papers", "In-Class Case Conceptualization", "Group Therapy Reflection Paper").
           - "weekOrModule": Designated schedule week and/or module where it is due or scheduled (e.g., "Week 5", "Week 10", "Module 6").
           - "rawDueDate": Due date from the schedule table or details (e.g. "July 30/31", "September 3/4", "5/7/26").
           - "weight": Weight of final grade (e.g., "20%", "25%", "40%").
           - "points": Total points possible (e.g., "100 Points").
           - "instructions": The full, detailed description and requirements from the assignment details or schedule.
           - "rubric": Extract all grading criteria items as an array of strings.
           - "mediaUrl": Any direct URL, web link, portal link, or submission link directly associated with this assignment if present in the document, else null.

        5. OUTPUT:
           - Return valid JSON matching the schema with zero introductory or closing markdown text.
        """

        let responseSchema: [String: Any] = [
            "type": "OBJECT",
            "properties": [
                "courseTitle": ["type": "STRING", "description": "Course title and code (e.g. 'CPC 527: Group Counselling Psychology')"],
                "instructorName": ["type": "STRING", "nullable": true, "description": "Name of the faculty member or instructor (e.g. 'Dr. Jane Smith')"],
                "instructorEmail": ["type": "STRING", "nullable": true, "description": "Email of the faculty member or instructor (e.g. 'jsmith@university.edu')"],
                "readings": [
                    "type": "ARRAY",
                    "items": [
                        "type": "OBJECT",
                        "properties": [
                            "weekOrModule": ["type": "STRING", "nullable": true, "description": "Designated week and/or module (e.g. 'Module 1', 'Week 1', 'Week 1 - Module 1')"],
                            "topic": ["type": "STRING", "nullable": true, "description": "Weekly session or lecture topic (e.g. 'Intro to Group Work', 'Presentations')"],
                            "title": ["type": "STRING", "description": "Reading name or chapter (e.g. 'Chapters 1-3', 'Articles', 'Reading Week')"],
                            "authors": ["type": "STRING", "nullable": true, "description": "Author name(s) (e.g. 'Gehart')"],
                            "resourceTitle": ["type": "STRING", "nullable": true, "description": "Book or publication title if stated in the syllabus, else null"],
                            "chaptersOrPages": ["type": "STRING", "nullable": true, "description": "e.g. 'Chapters 1-3', 'pp. 25-50'"],
                            "date": ["type": "STRING", "nullable": true, "description": "Date or date range (e.g. 'July 2/3')"],
                            "mediaUrl": ["type": "STRING", "nullable": true, "description": "Direct URL or web link for the reading/resource if present"]
                        ],
                        "required": ["title"]
                    ]
                ],
                "assignments": [
                    "type": "ARRAY",
                    "items": [
                        "type": "OBJECT",
                        "properties": [
                            "weekOrModule": ["type": "STRING", "nullable": true, "description": "The explicit week and/or module it is due (e.g. 'Module 6', 'Week 6')"],
                            "title": ["type": "STRING", "description": "Deliverable name (e.g. 'Group Therapy Reflection Paper')"],
                            "category": ["type": "STRING", "nullable": true, "description": "e.g. 'PAPER', 'PRESENTATION', 'REPORT', 'PARTICIPATION'"],
                            "rawDueDate": ["type": "STRING", "nullable": true, "description": "e.g. '5/7/26', '6/4/26'"],
                            "weight": ["type": "STRING", "nullable": true, "description": "e.g. '25%'"],
                            "points": ["type": "STRING", "nullable": true, "description": "e.g. '100 Points'"],
                            "instructions": ["type": "STRING", "nullable": true, "description": "Full description and instructions from the syllabus"],
                            "rubric": [
                                "type": "ARRAY",
                                "items": ["type": "STRING"],
                                "description": "List of rubric criteria items with point values"
                            ],
                            "mediaUrl": ["type": "STRING", "nullable": true, "description": "Direct URL or web link for the assignment if present"]
                        ],
                        "required": ["title"]
                    ]
                ]
            ],
            "required": ["readings", "assignments"]
        ]

        var lastErrorMsg = ""
        var lastStatusCode = 500

        // Build parts: targeted schedule page images or fallback to compressed PDF
        var contentParts: [[String: Any]] = []
        if !schedulePages.isEmpty {
            contentParts.append(["text": "Analyze the attached schedule and reading table pages and extract all structured course items:"])
            for pageInfo in schedulePages {
                contentParts.append([
                    "inlineData": [
                        "mimeType": "image/jpeg",
                        "data": pageInfo.data.base64EncodedString()
                    ]
                ])
            }
        } else {
            let compressedData = Self.compressPDFDataIfNeeded(pdfData)
            contentParts.append([
                "inlineData": [
                    "mimeType": "application/pdf",
                    "data": compressedData.base64EncodedString()
                ]
            ])
        }

        for modelName in modelsToTry {
            if Task.isCancelled { throw CancellationError() }
            let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/\(modelName):generateContent?key=\(apiKey)"
            guard let url = URL(string: endpoint) else { continue }

            let payload: [String: Any] = [
                "contents": [
                    [
                        "parts": contentParts
                    ]
                ],
                "systemInstruction": [
                    "parts": [
                        [
                            "text": systemInstructions
                        ]
                    ]
                ],
                "generationConfig": [
                    "temperature": 0.0,
                    "topK": 1,
                    "topP": 0.1,
                    "maxOutputTokens": 8192,
                    "responseMimeType": "application/json",
                    "responseSchema": responseSchema
                ]
            ]

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 75
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(apiKey, forHTTPHeaderField: "x-goog-api-key")
            request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

            for attempt in 0..<2 {
                print("📦 [NETWORK] Outgoing Payload (\(schedulePages.count) schedule pages) targeting \(modelName) (Attempt \(attempt + 1)/2)")

                do {
                    let (data, response) = try await URLSession.shared.data(for: request)
                    let httpStatus = (response as? HTTPURLResponse)?.statusCode ?? 0
                    lastStatusCode = httpStatus
                    let rawJSONString = String(data: data, encoding: .utf8) ?? ""
                    print("📥 [API RESPONSE] Model \(modelName) HTTP Status \(httpStatus). Length: \(rawJSONString.count)")

                    if httpStatus == 200 {
                        struct UsageMetadata: Decodable {
                            let promptTokenCount: Int?
                            let candidatesTokenCount: Int?
                            let totalTokenCount: Int?
                        }
                        struct GeminiPart: Decodable { let text: String }
                        struct GeminiContent: Decodable { let parts: [GeminiPart] }
                        struct GeminiCandidate: Decodable { let content: GeminiContent }
                        struct GeminiResponse: Decodable {
                            let candidates: [GeminiCandidate]?
                            let usageMetadata: UsageMetadata?
                        }

                        let geminiResp = try JSONDecoder().decode(GeminiResponse.self, from: data)

                        if let stats = geminiResp.usageMetadata {
                            print("--- API SYSTEM STATS ---")
                            print("Tokens sent to API: \(stats.promptTokenCount ?? 0)")
                            print("Tokens generated: \(stats.candidatesTokenCount ?? 0)")
                            print("Total API load: \(stats.totalTokenCount ?? 0)")
                        }

                        if let rawJsonText = geminiResp.candidates?.first?.content.parts.first?.text {
                            let cleanJson = Self.repairTruncatedJSON(rawJsonText)
                            if let jsonBodyData = cleanJson.data(using: .utf8) {
                                let courseDTO = try Self.decodeCourseDTO(from: jsonBodyData)
                                if let stats = courseDTO.dataExtractionStats {
                                    print("Model Health Check: status=\(stats.status), confidence=\(stats.confidenceScore)/10, missing=\(stats.missingFields.joined(separator: ", "))")
                                }
                                print("✅ [APIService SUCCESS] Targeted schedule parsed strictly via Gemini model '\(modelName)'!")
                                return courseDTO
                            }
                        }
                    } else if httpStatus == 429 || httpStatus == 503 {
                        print("⚠️ [RATE LIMIT / BUSY] HTTP \(httpStatus) on '\(modelName)'. Retrying in 1.5s (Attempt \(attempt + 1)/2)...")
                        try? await Task.sleep(nanoseconds: 1_500_000_000)
                        continue
                    } else {
                        lastErrorMsg = "API Error [\(httpStatus)]: Model '\(modelName)' returned HTTP status \(httpStatus)."
                        print("❌ [NETWORK WARNING] \(lastErrorMsg)")
                        break
                    }
                } catch {
                    if Task.isCancelled || (error as? URLError)?.code == .cancelled || error is CancellationError {
                        print("🛑 [APIService] PDF parse cancelled by user. Terminating immediately.")
                        throw CancellationError()
                    }
                    let nsErr = error as NSError
                    lastStatusCode = nsErr.code
                    lastErrorMsg = "API Error [\(nsErr.code)]: \(nsErr.localizedDescription)"
                    print("❌ [NETWORK ERROR] \(lastErrorMsg)")
                    break
                }
            }
        }

        throw NSError(domain: "APIService", code: lastStatusCode, userInfo: [NSLocalizedDescriptionKey: lastErrorMsg.isEmpty ? "API Error [\(lastStatusCode)]: Unable to process document via Gemini API." : lastErrorMsg])
    }

    public func parseSyllabusText(_ rawText: String) async throws -> CourseDTO {
        let keyToUse = activeAPIKey
        guard !keyToUse.isEmpty else {
            throw NSError(domain: "APIService", code: 401, userInfo: [NSLocalizedDescriptionKey: "AI Service Unavailable: Please check your network connection or restart CoursePal."])
        }
        print("[APIService] Calling Gemini Cloud AI with active API key (\(keyToUse.prefix(6))...)")
        return try await parseSyllabusWithGemini(rawText, apiKey: keyToUse)
    }

    public static func preprocessSyllabusText(_ rawText: String) -> String {
        // If text was already section-filtered by DocumentExtractor, preserve all harvested schedule pages
        if rawText.contains("--- Page ") {
            if rawText.count > 250000 {
                return String(rawText.prefix(250000))
            }
            return rawText
        }

        let lines = rawText
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        let boilerplateHeaders = [
            "university policy", "course policy", "policies and guidelines", "academic honesty",
            "academic integrity", "non-discrimination", "accommodations", "disability support",
            "title ix", "student code of conduct", "hallmarks of maturity", "covid-19 policy",
            "letter grade distribution", "attendance policy", "campus safety", "copyright notice",
            "here2talk", "mental health resources"
        ]

        var relevantLines: [String] = []
        var inBoilerplate = false

        for (idx, line) in lines.enumerated() {
            let lower = line.lowercased()

            // Keep the first 40 lines unconditionally for Course Header / Code / Professor info
            if idx < 40 {
                relevantLines.append(line)
                continue
            }

            // Check if entering a boilerplate policy section
            if boilerplateHeaders.contains(where: { lower.contains($0) }) {
                let hasSyllabusDeliverables = lower.contains("assignment") || lower.contains("deliverable") ||
                                              lower.contains("schedule") || lower.contains("rubric") ||
                                              lower.contains("grading criteria") || lower.contains("reading") ||
                                              lower.contains("points") || lower.contains("weight")
                if !hasSyllabusDeliverables {
                    inBoilerplate = true
                }
            }

            // Check if exiting boilerplate back to schedule / readings / assignments
            let isScheduleKeyword = lower.contains("week ") || lower.contains("module ") || lower.contains("schedule") ||
                                   lower.contains("reading") || lower.contains("assignment") || lower.contains("due date") ||
                                   lower.contains("chapter") || lower.contains("pages") || lower.contains("presentation") ||
                                   lower.contains("paper") || lower.contains("quiz") || lower.contains("exam") ||
                                   lower.contains("project") || lower.contains("grading") || lower.contains("rubric") ||
                                   lower.contains("criteria")

            if isScheduleKeyword {
                inBoilerplate = false
            }

            if inBoilerplate {
                continue
            }

            relevantLines.append(line)
        }

        let condensed = relevantLines.joined(separator: "\n")
        if condensed.count > 250000 {
            return String(condensed.prefix(250000))
        }
        return condensed.isEmpty ? rawText : condensed
    }

    public func parseSyllabusWithGemini(_ rawText: String, apiKey: String) async throws -> CourseDTO {
        let modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"]
        var lastError: Error = URLError(.badServerResponse)

        let processedText = Self.preprocessSyllabusText(rawText)
        print("📦 [NETWORK] Text payload size: \(processedText.count) chars (compressed from \(rawText.count))")

        let systemInstructions = """
        You are a universal academic syllabus extraction engine. Extract all weekly readings, lecture topics, and deliverables/assignments into the specified JSON format.

        UNIVERSAL EXTRACTION RULES:
        0. FACULTY & INSTRUCTOR DETAILS:
           - "instructorName": Full name and credentials of the primary faculty, professor, or instructor if stated in the syllabus text (e.g., "Dr. Alireza Sedghi Taromi, PhD" or "Marie-Pier Gilbert"). If none found, null.
           - "instructorEmail": Email address of the faculty member or instructor if stated (e.g., "sedghitaromialireza@cityu.edu"). If none found, null.

        1. COURSE TITLE:
           - Extract the course name and code (e.g., "CPC 512: Family Systems Approaches to Counselling") ONLY into "courseTitle".
           - NEVER prefix or include the course name inside individual reading or assignment titles.

        2. CHRONOLOGICAL SCHEDULE ANCHOR:
           - If the syllabus contains an introductory module/curriculum overview map followed by an actual chronological course schedule (e.g. Weeks 1-12 with dates), anchor all weekly items to the CHRONOLOGICAL SCHEDULE so that every week and calendar date is preserved.

        3. READINGS BREAKDOWN & TOPICS:
           - CRITICAL: If a week or module lists multiple textbooks, authors, or articles (e.g., "Corey Ch. 1 & 2" AND "Yalom Ch. 1", or "Gehart chapter 5" AND "Articles"), output EACH textbook or article as a SEPARATE object in the "readings" array! Never merge multiple books together into one object.
           - "weekOrModule": Designated schedule week and/or module (e.g., "Week 1", "Week 2", "Module 1"). CRITICAL: If the document explicitly designates modules in the schedule, include "Module X". BUT NEVER put "Module" if the course schedule only uses Weeks.
           - "date": Date or date range listed in the table (e.g., "July 2/3", "4/2/26").
           - "topic": The weekly session, module, or lecture topics taught during that class from the schedule table (e.g. "Creating a caring community; Introduction to Family Systems; Course overview").
           - "title": Specific reading name, chapter designation, or article title as given in the readings (e.g. "Chapters 1-3", "Chapter 5", "Articles", "Review sample comprehensive exam cases"). CRITICAL: If the reading refers to chapters, always write out "Chapter" (for single, e.g. "Chapter 1") or "Chapters" (for multiple/range, e.g. "Chapters 1 & 2", "Chapters 1-3"). NEVER abbreviate as "ch", "ch.", "chp", or "chp.".
           - "authors": Specific author for that reading if mentioned (e.g., "Gehart", "Corey", "Yalom"). If none, null.
           - "resourceTitle": Book, textbook, or publication title if explicitly named in the syllabus, else null.
           - "chaptersOrPages": The exact chapter or page numbers for that specific reading. Always write out "Chapter" or "Chapters" (e.g., "Chapter 1", "Chapters 1 & 2", "Chapters 1-3", "pp. 25-50"). Never abbreviate as "ch" or "chp".
           - "mediaUrl": Any direct URL, web link, DOI, or portal link directly associated with this reading if present in the document, else null.
           - For non-instructional weeks like "Reading Week" (No classes), "Spring Break", or "Flex Week", create an entry with title "Reading Week" or "Flex Week", topic "Reading Week" or "Flex Week", and date.

        4. DELIVERABLES & DETAILED RUBRIC CRITERIA:
           - Extract every assignment, presentation, paper, exam, or deliverable from BOTH the schedule table (e.g. "Due: Family Mapping Papers", "in-class case conceptualization worth 20%") AND any "Course Assignment Details" / "Grading Criteria" sections.
           - "title": Clean assignment title (e.g., "Family Mapping Papers", "In-Class Case Conceptualization", "Group Therapy Reflection Paper").
           - "weekOrModule": Designated schedule week and/or module where it is due or scheduled (e.g., "Week 5", "Week 10", "Module 6").
           - "rawDueDate": Due date from the schedule table or details (e.g. "July 30/31", "September 3/4", "5/7/26").
           - "weight": Weight of final grade (e.g., "20%", "25%", "40%").
           - "points": Total points possible (e.g., "100 Points").
           - "instructions": The full, detailed description and requirements from the assignment details or schedule.
           - "rubric": Extract all grading criteria items as an array of strings.
           - "mediaUrl": Any direct URL, web link, portal link, or submission link directly associated with this assignment if present in the document, else null.

        5. OUTPUT:
           - Return valid JSON matching the schema with zero introductory or closing markdown text.
        """

        let responseSchema: [String: Any] = [
            "type": "OBJECT",
            "properties": [
                "courseTitle": ["type": "STRING", "description": "Course title and code (e.g. 'CPC 527: Group Counselling Psychology')"],
                "instructorName": ["type": "STRING", "nullable": true, "description": "Name of the faculty member or instructor (e.g. 'Dr. Jane Smith')"],
                "instructorEmail": ["type": "STRING", "nullable": true, "description": "Email of the faculty member or instructor (e.g. 'jsmith@university.edu')"],
                "readings": [
                    "type": "ARRAY",
                    "items": [
                        "type": "OBJECT",
                        "properties": [
                            "weekOrModule": ["type": "STRING", "nullable": true, "description": "Designated week and/or module (e.g. 'Week 1', 'Module 1')"],
                            "topic": ["type": "STRING", "nullable": true, "description": "Weekly session or lecture topics"],
                            "title": ["type": "STRING", "description": "Reading name or chapter (e.g. 'Chapters 1-3', 'Articles', 'Reading Week')"],
                            "authors": ["type": "STRING", "nullable": true, "description": "Author name(s) (e.g. 'Gehart')"],
                            "resourceTitle": ["type": "STRING", "nullable": true, "description": "Book or publication title if stated in the syllabus, else null"],
                            "chaptersOrPages": ["type": "STRING", "nullable": true, "description": "e.g. 'Chapters 1-3', 'pp. 25-50'"],
                            "date": ["type": "STRING", "nullable": true, "description": "Date or date range (e.g. 'July 2/3')"],
                            "mediaUrl": ["type": "STRING", "nullable": true, "description": "Direct URL or web link for the reading/resource if present"]
                        ],
                        "required": ["title"]
                    ]
                ],
                "assignments": [
                    "type": "ARRAY",
                    "items": [
                        "type": "OBJECT",
                        "properties": [
                            "weekOrModule": ["type": "STRING", "nullable": true, "description": "The explicit week and/or module it is due (e.g. 'Module 6', 'Week 6')"],
                            "title": ["type": "STRING", "description": "Deliverable name (e.g. 'Group Therapy Reflection Paper')"],
                            "category": ["type": "STRING", "nullable": true, "description": "e.g. 'PAPER', 'PRESENTATION', 'REPORT', 'PARTICIPATION'"],
                            "rawDueDate": ["type": "STRING", "nullable": true, "description": "e.g. '5/7/26', '6/4/26'"],
                            "weight": ["type": "STRING", "nullable": true, "description": "e.g. '25%'"],
                            "points": ["type": "STRING", "nullable": true, "description": "e.g. '100 Points'"],
                            "instructions": ["type": "STRING", "nullable": true, "description": "Full description and instructions from the syllabus"],
                            "rubric": [
                                "type": "ARRAY",
                                "items": ["type": "STRING"],
                                "description": "List of rubric criteria items with point values"
                            ],
                            "mediaUrl": ["type": "STRING", "nullable": true, "description": "Direct URL or web link for the assignment if present"]
                        ],
                        "required": ["title"]
                    ]
                ]
            ],
            "required": ["readings", "assignments"]
        ]

        for modelName in modelsToTry {
            if Task.isCancelled { throw CancellationError() }
            let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/\(modelName):generateContent?key=\(apiKey)"
            guard let url = URL(string: endpoint) else { continue }

            let payload: [String: Any] = [
                "contents": [
                    [
                        "parts": [
                            ["text": processedText]
                        ]
                    ]
                ],
                "systemInstruction": [
                    "parts": [
                        [
                            "text": systemInstructions
                        ]
                    ]
                ],
                "generationConfig": [
                    "temperature": 0.0,
                    "topK": 1,
                    "topP": 0.1,
                    "maxOutputTokens": 8192,
                    "responseMimeType": "application/json",
                    "responseSchema": responseSchema
                ]
            ]

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 75
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(apiKey, forHTTPHeaderField: "x-goog-api-key")
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)

            for attempt in 0..<2 {
                print("📡 [NETWORK] Sending text to Gemini model: \(modelName) (Attempt \(attempt + 1)/2)")

                do {
                    let (data, response) = try await URLSession.shared.data(for: request)
                    let httpStatus = (response as? HTTPURLResponse)?.statusCode ?? 0
                    let rawJSONString = String(data: data, encoding: .utf8) ?? ""
                    print("📥 [API RESPONSE] Model \(modelName) HTTP \(httpStatus). Body length: \(rawJSONString.count)")

                    if httpStatus == 200 {
                    struct UsageMetadata: Decodable {
                        let promptTokenCount: Int?
                        let candidatesTokenCount: Int?
                        let totalTokenCount: Int?
                    }
                    struct GeminiPart: Decodable { let text: String }
                    struct GeminiContent: Decodable { let parts: [GeminiPart] }
                    struct GeminiCandidate: Decodable { let content: GeminiContent }
                    struct GeminiResponse: Decodable {
                        let candidates: [GeminiCandidate]?
                        let usageMetadata: UsageMetadata?
                    }

                    let geminiResp = try JSONDecoder().decode(GeminiResponse.self, from: data)

                    if let stats = geminiResp.usageMetadata {
                        print("--- API SYSTEM STATS ---")
                        print("Tokens sent to API: \(stats.promptTokenCount ?? 0)")
                        print("Tokens generated: \(stats.candidatesTokenCount ?? 0)")
                        print("Total API load: \(stats.totalTokenCount ?? 0)")
                    }

                    if let rawJsonText = geminiResp.candidates?.first?.content.parts.first?.text {
                        var cleanJson = rawJsonText.trimmingCharacters(in: .whitespacesAndNewlines)
                        if cleanJson.hasPrefix("```") {
                            cleanJson = cleanJson.components(separatedBy: "\n").dropFirst().joined(separator: "\n")
                            if cleanJson.hasSuffix("```") {
                                cleanJson = String(cleanJson.dropLast(3)).trimmingCharacters(in: .whitespacesAndNewlines)
                            }
                        }
                        if let jsonBodyData = cleanJson.data(using: .utf8) {
                            do {
                                let courseDTO = try Self.decodeCourseDTO(from: jsonBodyData)
                                if let stats = courseDTO.dataExtractionStats {
                                    print("Model Health Check: status=\(stats.status), confidence=\(stats.confidenceScore)/10, missing=\(stats.missingFields.joined(separator: ", "))")
                                }
                                print("✅ [APIService SUCCESS] Gemini text parse via '\(modelName)' — items: \(courseDTO.items?.count ?? 0)")
                                return courseDTO
                            } catch {
                                print("❌ [DECODING ERROR] \(error). JSON: \(cleanJson.prefix(500))")
                                lastError = error
                            }
                        }
                    }
                } else {
                    print("❌ [NETWORK ERROR] Model \(modelName) HTTP \(httpStatus): \(rawJSONString.prefix(300))")
                    lastError = URLError(.badServerResponse)
                }
            } catch {
                if Task.isCancelled || (error as? URLError)?.code == .cancelled || error is CancellationError {
                    print("🛑 [APIService] Text parse cancelled by user. Terminating immediately.")
                    throw CancellationError()
                }
                print("❌ [NETWORK ERROR] \(modelName): \(error.localizedDescription)")
                lastError = error
            }
            if attempt == 0 {
                if Task.isCancelled { throw CancellationError() }
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                if Task.isCancelled { throw CancellationError() }
            }
        }
    }
        throw lastError
    }


    public func parseSyllabusImageData(_ imageData: Data) async throws -> CourseDTO {
        let keyToUse = activeAPIKey
        guard !keyToUse.isEmpty else {
            throw NSError(domain: "APIService", code: 401, userInfo: [NSLocalizedDescriptionKey: "AI Service Unavailable: Please check your network connection or restart CoursePal."])
        }
        print("[APIService] Calling Gemini Cloud Vision AI with active API key...")
        return try await parseSyllabusImageWithGemini(imageData, mimeType: "image/jpeg", apiKey: keyToUse)
    }

    public func parseSyllabusImageWithGemini(_ imageData: Data, mimeType: String = "image/jpeg", apiKey: String) async throws -> CourseDTO {
        let base64String = imageData.base64EncodedString()
        let modelsToTry = ["gemini-3.6-flash"]
        var lastError: Error = URLError(.badServerResponse)

        print("📦 [NETWORK] Outgoing Payload Size: \(base64String.count) bytes")

        for modelName in modelsToTry {
            let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/\(modelName):generateContent?key=\(apiKey)"
            guard let url = URL(string: endpoint) else { continue }

            let prompt = """
            You are an elite academic syllabus AI engine. Thoroughly analyze the provided syllabus image or document scan and extract 100% of all courses, weeks, readings, textbooks, media, and assignments into a clean JSON structure.

            STRICT EXTRACTION RULES:
            1. COURSE DETAILS:
               - "course_name": Full title of the course (e.g. "Research Methods and Statistics").
               - "course_code": Catalog code (e.g. "CPC 514" or "CPC 523").
               - "term_weeks": Total number of weeks in term (integer, e.g. 16 or 12).
               - "sharing_code": Pure 6-digit numeric string (e.g. "849204").

            2. ASSIGNMENTS & DELIVERABLES (category = "Assignment"):
               - Extract EVERY assignment listed under "Assignments", "Grading", "Evaluation", or the Schedule table.
               - STRICT DELIVERABLE SEPARATION: "Peer Review", "Self-Reflection", "Discussion Board", "In-Class Activity", "Group Report", and "Individual Paper" MUST EACH be extracted as completely separate, individual items. NEVER combine Peer Review and Self-Reflection into one item.
               - ACCURATE POINTS & WEIGHTS: NEVER mix up or swap points between different deliverables. Assign each deliverable its own exact points possible (e.g. "50 Points", "100 Points") and exact grade percentage (e.g. "10%", "20%") verbatim as stated in the syllabus.
               - "title": FULL OFFICIAL EXACT TITLE verbatim as written in the syllabus (e.g. "Peer Review Discussion Board", "Self-Reflection Assignment"). Do NOT shorten or merge.
               - "due_date": ISO date format "YYYY-MM-DD" (e.g. "2026-07-23", "2026-09-24") ONLY if explicitly stated in the document (including numeric dash dates like "9-24-2026", "09-01-2026", "4-2-26"). If NO calendar date is stated, leave due_date null. NEVER fabricate or guess dates.
               - "points_possible": Total points or rubrics (e.g. "100 Points" or "50 Points").
               - "weight_percentage": Percentage of final grade (e.g. "20%" or "40%").
               - "full_instructions": Detailed description, grading criteria rubrics, submission instructions, and guidelines.

            3. WEEKS & READINGS (EVERY SINGLE CHAPTER / ARTICLE / MEDIA):
               - Group into weeks (week_number 1, 2, ... 16).
               - Every distinct reading or book MUST be its own separate atomic item. If multiple readings are on one line, split them into separate reading entries.
               - "title": Smart, concise noun phrase only (strictly 2 to 5 words, e.g. "Research Design", "Comprehensive Exam Cases", "Gehart"). NEVER put full instruction sentences, action verbs ("Review...", "Read..."), or LMS shell directions in "title". Put full sentences in "summary_text".
               - "author_name": Primary author(s) or null.
               - "resource_title": Book or resource title or null.
               - "media_type": "textbook", "article", "video", or "podcast".
               - "summary_text": 2-sentence summary of the chapter/reading topic.
               - "key_takeaways_text": 2-3 bullet points ("• Concept 1\n• Concept 2").
               - "estimated_time_text": Estimated duration (e.g. "~45 min read").
               - "due_date": ISO date "YYYY-MM-DD" ONLY if explicitly written for that week, otherwise null.

            Return ONLY valid raw JSON with NO markdown formatting, matching this exact schema:
            {
              "id": "\(UUID().uuidString)",
              "course_name": "Course Name",
              "course_code": "CPC 514",
              "term_weeks": 16,
              "sharing_code": "849204",
              "weeks": [
                {
                  "id": "\(UUID().uuidString)",
                  "week_number": 1,
                  "date_range_str": "Jul 1 - Jul 7, 2026",
                  "readings": [
                    {
                      "id": "\(UUID().uuidString)",
                      "title": "Creswell & Creswell: Research Design",
                      "author_name": "Creswell & Creswell",
                      "resource_title": "Research Design",
                      "media_type": "textbook",
                      "summary_text": "Overview of research methodologies.",
                      "key_takeaways_text": "• Qualitative vs Quantitative\n• Ethical Considerations",
                      "estimated_time_text": "~45 min read",
                      "video_url": null,
                      "due_date": null
                    }
                  ]
                }
              ],
              "assignments": [
                {
                  "id": "\(UUID().uuidString)",
                  "title": "Research Article Analysis",
                  "due_date": null,
                  "points_possible": "100 Points",
                  "weight_percentage": "20%",
                  "full_instructions": "Collaborate on a 45-60 minute presentation analyzing an approved article."
                }
              ]
            }
            """

            let payload: [String: Any] = [
                "contents": [
                    [
                        "parts": [
                            ["text": prompt],
                            [
                                "inlineData": [
                                    "mimeType": mimeType,
                                    "data": base64String
                                ]
                            ]
                        ]
                    ]
                ],
                "generationConfig": [
                    "responseMimeType": "application/json",
                    "maxOutputTokens": 8192,
                    "temperature": 0.1
                ]
            ]

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 60
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(apiKey, forHTTPHeaderField: "X-goog-api-key")
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)

            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                let httpStatus = (response as? HTTPURLResponse)?.statusCode ?? 0
                let rawJSONString = String(data: data, encoding: .utf8) ?? ""
                print("📥 [API RESPONSE] Raw JSON: \(rawJSONString)")

                if httpStatus == 200 {
                    struct GeminiPart: Decodable { let text: String }
                    struct GeminiContent: Decodable { let parts: [GeminiPart] }
                    struct GeminiCandidate: Decodable { let content: GeminiContent }
                    struct GeminiResponse: Decodable { let candidates: [GeminiCandidate] }

                    do {
                        let geminiResp = try JSONDecoder().decode(GeminiResponse.self, from: data)
                        if let rawJsonText = geminiResp.candidates.first?.content.parts.first?.text {
                            var cleanJson = rawJsonText.trimmingCharacters(in: .whitespacesAndNewlines)
                            if cleanJson.hasPrefix("```") {
                                cleanJson = cleanJson.components(separatedBy: "\n").dropFirst().joined(separator: "\n")
                                if cleanJson.hasSuffix("```") {
                                    cleanJson = String(cleanJson.dropLast(3)).trimmingCharacters(in: .whitespacesAndNewlines)
                                }
                            }
                            if let jsonBodyData = cleanJson.data(using: .utf8) {
                                do {
                                    let courseDTO = try Self.decodeCourseDTO(from: jsonBodyData)
                                    print("✅ [APIService SUCCESS] Successfully parsed syllabus image via Gemini AI model (\(modelName))!")
                                    return courseDTO
                                } catch {
                                    print("❌ [DECODING ERROR] Failed to map JSON to Swift struct: \(error.localizedDescription)")
                                    print("❌ [DECODING DETAILS] \(error)")
                                    lastError = error
                                }
                            }
                        }
                    } catch {
                        print("❌ [DECODING ERROR] Failed to map outer Gemini response envelope: \(error.localizedDescription)")
                        print("❌ [DECODING DETAILS] \(error)")
                        lastError = error
                    }
                } else {
                    print("❌ [NETWORK ERROR] Model \(modelName) returned HTTP status \(httpStatus). Raw Response: \(rawJSONString)")
                    if httpStatus == 400 {
                        print("❌ [NETWORK ERROR DETAILS] 400 Bad Request - Payload invalid or missing API permission.")
                    } else if httpStatus == 429 {
                        print("❌ [NETWORK ERROR DETAILS] 429 Rate Limit Exceeded - Gemini API rate limit reached.")
                    }
                }
            } catch {
                if Task.isCancelled || (error as? URLError)?.code == .cancelled || error is CancellationError {
                    print("🛑 [APIService] Image parse cancelled by user. Terminating immediately.")
                    throw CancellationError()
                }
                print("❌ [NETWORK ERROR] Request failed for model \(modelName): \(error.localizedDescription)")
                lastError = error
            }
        }
        throw lastError
    }

    public func joinCourse(sharingCode: String) async throws -> CourseDTO {
        guard let url = URL(string: "\(baseURL)/api/courses/join") else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "userId": currentUserId.uuidString,
            "sharingCode": sharingCode
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(CourseDTO.self, from: data)
    }

    public func toggleReading(readingId: String, isCompleted: Bool) async throws {
        guard let url = URL(string: "\(baseURL)/api/progress/toggle") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "userId": currentUserId.uuidString,
            "readingId": readingId,
            "isCompleted": isCompleted
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await URLSession.shared.data(for: request)
    }

    public func saveNote(assignmentId: String, noteText: String) async throws {
        guard let url = URL(string: "\(baseURL)/api/notes") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "userId": currentUserId.uuidString,
            "assignmentId": assignmentId,
            "noteText": noteText
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await URLSession.shared.data(for: request)
    }

    // MARK: - Interactive Course & Assignment Gemini AI Features

    public func askGemini(prompt: String, systemInstruction: String? = nil, isJSON: Bool = false) async throws -> String {
        let keyToUse = activeAPIKey
        guard !keyToUse.isEmpty else {
            throw NSError(domain: "APIService", code: 401, userInfo: [NSLocalizedDescriptionKey: "No Gemini API key available."])
        }

        var contents: [[String: Any]] = []
        if let sys = systemInstruction, !sys.isEmpty {
            contents.append([
                "role": "user",
                "parts": [["text": "System Instruction: \(sys)"]]
            ])
            contents.append([
                "role": "model",
                "parts": [["text": "Understood. I will strictly follow these instructions."]]
            ])
        }
        contents.append([
            "role": "user",
            "parts": [["text": prompt]]
        ])

        var payload: [String: Any] = [
            "contents": contents,
            "generationConfig": [
                "temperature": 0.2,
                "topP": 0.95
            ]
        ]
        if isJSON {
            payload["generationConfig"] = [
                "responseMimeType": "application/json",
                "temperature": 0.1
            ]
        }

        let httpBody = try JSONSerialization.data(withJSONObject: payload)
        let modelsToTry = ["gemini-3.6-flash", "gemini-3.5-flash"]
        var lastError: Error? = nil

        for model in modelsToTry {
            let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/\(model):generateContent?key=\(keyToUse)"
            guard let url = URL(string: endpoint) else { continue }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 25
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(keyToUse, forHTTPHeaderField: "x-goog-api-key")
            request.httpBody = httpBody

            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse else { continue }
                if httpResponse.statusCode == 200 {
                    if let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let candidates = root["candidates"] as? [[String: Any]],
                       let firstCandidate = candidates.first,
                       let content = firstCandidate["content"] as? [String: Any],
                       let parts = content["parts"] as? [[String: Any]],
                       let firstPart = parts.first,
                       let text = firstPart["text"] as? String {
                        return text.trimmingCharacters(in: .whitespacesAndNewlines)
                    }
                } else if httpResponse.statusCode == 503 || httpResponse.statusCode == 429 {
                    continue
                }
            } catch {
                lastError = error
            }
        }

        throw lastError ?? NSError(domain: "APIService", code: 500, userInfo: [NSLocalizedDescriptionKey: "Service temporarily unavailable. Please try again."])
    }

    public func askCourseSyllabus(courseContext: String, question: String) async throws -> String {
        let systemPrompt = """
        You are CoursePal AI, an expert academic advisor and course assistant.
        Answer the student's question accurately, concisely, and helpfully using the provided course syllabus context.
        Use bullet points and bold highlights where appropriate. If a policy or deadline is explicitly stated, cite it directly.
        Keep answers clear, friendly, and under 3-4 sentences unless detailed explanation is requested.
        """

        let userPrompt = """
        COURSE CONTEXT:
        \(courseContext)

        STUDENT QUESTION:
        \(question)
        """

        return try await askGemini(prompt: userPrompt, systemInstruction: systemPrompt, isJSON: false)
    }

    public func generateAssignmentMilestones(title: String, instructions: String?, weight: String?, points: String?, rubric: [String]) async throws -> [String] {
        let systemPrompt = """
        You are CoursePal Study Plan AI. Break down the university assignment into 4 to 5 chronological, actionable study milestones.
        Return ONLY a JSON array of strings, e.g. ["Step 1...", "Step 2...", "Step 3...", "Step 4..."].
        Each step should start with an action verb and be concise (under 15 words).
        """

        let prompt = """
        Assignment Title: \(title)
        Weight: \(weight ?? "N/A")
        Points: \(points ?? "N/A")
        Instructions: \(instructions ?? "Standard course assignment")
        Rubric Breakdown: \(rubric.joined(separator: ", "))
        """

        let jsonStr = try await askGemini(prompt: prompt, systemInstruction: systemPrompt, isJSON: true)
        if let data = jsonStr.data(using: .utf8),
           let steps = try? JSONDecoder().decode([String].self, from: data), !steps.isEmpty {
            return steps
        }

        // Fallback simple line parser if json array had markdown wrappers
        let clean = jsonStr.replacingOccurrences(of: "```json", with: "").replacingOccurrences(of: "```", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        if let data = clean.data(using: .utf8),
           let steps = try? JSONDecoder().decode([String].self, from: data) {
            return steps
        }

        return [
            "Review assignment guidelines & rubric criteria",
            "Research topic & gather 5+ peer-reviewed sources",
            "Draft initial outline and structure key arguments",
            "Write complete first draft with APA formatting",
            "Proofread, refine citations, and submit final version"
        ]
    }
}




