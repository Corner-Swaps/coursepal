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
        self.hexColor = hexColor
        self.termWeeks = termWeeks
        self.sharingCode = sharingCode.isEmpty ? "\(courseCode?.prefix(3).uppercased() ?? "CRS")-\(Int.random(in: 100...999))" : sharingCode
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
}

public enum MediaType: String, Codable, CaseIterable {
    case textbook = "textbook"
    case article = "article"
    case video = "video"
    case podcast = "podcast"
    case other = "other"
    
    public var iconName: String {
        switch self {
        case .textbook: return "book.fill"
        case .article: return "doc.text.fill"
        case .video: return "play.tv.fill"
        case .podcast: return "waveform.path.ecg"
        case .other: return "link"
        }
    }
    
    public var displayName: String {
        self.rawValue.capitalized
    }
}

@Model
public final class Reading {
    @Attribute(.unique) public var id: UUID
    public var title: String
    public var mediaTypeRaw: String
    public var isCompleted: Bool
    public var isDeleted: Bool
    public var summaryText: String?
    public var keyTakeawaysText: String?
    public var estimatedTimeText: String?
    public var videoUrl: String?
    public var sourcePageNumber: Int?
    public var dueDate: Date?
    public var dateRangeStr: String?
    public var chapterText: String?
    public var courseCode: String?
    public var semanticCategoryRaw: String?
    
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
        summaryText: String? = nil,
        keyTakeawaysText: String? = nil,
        estimatedTimeText: String? = nil,
        videoUrl: String? = nil,
        sourcePageNumber: Int? = 1,
        dueDate: Date? = nil,
        dateRangeStr: String? = nil,
        chapterText: String? = nil,
        courseCode: String? = nil,
        semanticCategoryRaw: String? = "reading"
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
        self.courseCode = courseCode
        self.semanticCategoryRaw = semanticCategoryRaw
    }
}

@Model
public final class Assignment {
    @Attribute(.unique) public var id: UUID
    public var title: String
    public var weekNumber: Int
    public var dueDate: Date?
    public var fullInstructions: String?
    public var pointsPossible: String?
    public var weightPercentage: String?
    public var noteText: String?
    public var isCompleted: Bool
    public var isDeleted: Bool
    public var attachmentNames: [String]
    public var sourcePageNumber: Int?
    public var courseCode: String?
    public var semanticCategoryRaw: String?
    
    public var course: Course?

    public init(
        id: UUID = UUID(),
        title: String,
        weekNumber: Int = 1,
        dueDate: Date? = nil,
        fullInstructions: String? = nil,
        pointsPossible: String? = nil,
        noteText: String? = nil,
        isCompleted: Bool = false,
        isDeleted: Bool = false,
        attachmentNames: [String] = [],
        sourcePageNumber: Int? = 1,
        courseCode: String? = nil,
        semanticCategoryRaw: String? = "assignment",
        weightPercentage: String? = nil
    ) {
        self.id = id
        self.title = title
        self.weekNumber = weekNumber
        self.dueDate = dueDate
        self.fullInstructions = fullInstructions
        self.pointsPossible = pointsPossible
        self.weightPercentage = weightPercentage
        self.noteText = noteText
        self.isCompleted = isCompleted
        self.isDeleted = isDeleted
        self.attachmentNames = attachmentNames
        self.sourcePageNumber = sourcePageNumber
        self.courseCode = courseCode
        self.semanticCategoryRaw = semanticCategoryRaw
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
        courseCode: String? = nil
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
        self.rawFileData = rawFileData
        self.uploadedAt = uploadedAt
    }
}

public struct CourseImporter {
    public static func importDTO(_ dto: CourseDTO, into modelContext: ModelContext) {
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

        let palette = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#EC4899", "#0284C7", "#4F46E5"]
        var existingCount = 0
        if let count = try? modelContext.fetchCount(FetchDescriptor<Course>()) {
            existingCount = count
        }
        let assignedColor = palette[existingCount % palette.count]

        let newCourse = Course(
            id: stableId,
            creatorId: UUID(uuidString: dto.creatorId ?? "") ?? UUID(),
            courseName: dto.courseName,
            courseCode: dto.courseCode,
            hexColor: assignedColor,
            termWeeks: dto.termWeeks ?? 16,
            sharingCode: dto.sharingCode
        )

        let weeksToImport = dto.weeks ?? (1...16).map { w in
            WeekDTO(id: "week-\(w)", weekNumber: w, startDate: nil, theme: "Week \(w) Schedule", readings: [])
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

            let week = Week(id: weekId, weekNumber: wDTO.weekNumber, theme: wDTO.theme, dateRangeStr: wDTO.dateRangeStr)
            week.course = newCourse

            if let readings = wDTO.readings, !readings.isEmpty {
                for rDTO in readings {
                    // Map parser strings ("reading", "media") → MediaType enum
                    let mediaType: MediaType = {
                        switch (rDTO.mediaType ?? "textbook").lowercased() {
                        case "media", "video":   return .video
                        case "podcast":           return .podcast
                        case "article":           return .article
                        case "reading", "textbook": return .textbook
                        default:                  return .textbook
                        }
                    }()
                    let summary = rDTO.summaryText ?? "Required reading: \(rDTO.title)."
                    let takeaways = rDTO.keyTakeawaysText ?? "• Review \(rDTO.title)"
                    let estTime = rDTO.estimatedTimeText ?? (mediaType == .video || mediaType == .podcast ? "~20–30 min" : "~40–60 min")
                    let videoUrl: String? = {
                        if let cand = rDTO.videoUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = rDTO.summaryText, URLHelper.isValidURL(cand) { return cand }
                        return nil
                    }()

                    let parsedDueDate = LocalSyllabusParser.parseISO8601Date(from: rDTO.dueDate ?? "", fallbackYear: 2026).date
                    let reading = Reading(
                        id: UUID(),
                        title: rDTO.title,
                        mediaType: mediaType,
                        isCompleted: rDTO.isCompleted ?? false,
                        summaryText: summary,
                        keyTakeawaysText: takeaways,
                        estimatedTimeText: estTime,
                        videoUrl: videoUrl,
                        dueDate: parsedDueDate,
                        dateRangeStr: rDTO.dateRangeStr,
                        courseCode: newCourse.courseCode
                    )
                    reading.week = week
                    week.readings.append(reading)
                    modelContext.insert(reading)
                }
            }
            newCourse.weeks.append(week)
            modelContext.insert(week)
        }

        if let assignments = dto.assignments {
            let isoFmt = ISO8601DateFormatter()
            let dfShort = DateFormatter()
            dfShort.dateFormat = "yyyy-MM-dd"

            var courseStartDate: Date = {
                var comp = DateComponents()
                comp.year = 2026; comp.month = 7; comp.day = 1
                return Calendar.current.date(from: comp) ?? Date()
            }()

            for aDTO in dto.assignments ?? [] {
                if let dueStr = aDTO.dueDate, !dueStr.isEmpty {
                    let d = isoFmt.date(from: dueStr) ?? dfShort.date(from: dueStr)
                    if let d = d, d < courseStartDate { courseStartDate = d }
                }
            }

            for aDTO in assignments {
                var parsedDueDate: Date? = nil
                if let dueStr = aDTO.dueDate, !dueStr.isEmpty {
                    parsedDueDate = isoFmt.date(from: dueStr) ?? dfShort.date(from: dueStr)
                }

                let finalDueDate: Date
                let weekNumber: Int
                if let pd = parsedDueDate {
                    finalDueDate = pd
                    let days = Calendar.current.dateComponents([.day], from: courseStartDate, to: pd).day ?? 0
                    weekNumber = max(1, min(16, (days / 7) + 1))
                } else {
                    let assignIdx = assignments.firstIndex(where: { $0.id == aDTO.id }) ?? 0
                    let spreadWeek = max(1, ((assignIdx + 1) * max(1, (dto.termWeeks ?? 12) / max(1, assignments.count))))
                    weekNumber = min(16, spreadWeek)
                    var comp = DateComponents()
                    comp.year = 2026; comp.month = 7 + weekNumber / 4; comp.day = 1 + (weekNumber % 4) * 7
                    finalDueDate = Calendar.current.date(from: comp) ?? Date()
                }

                let assignment = Assignment(
                    id: UUID(),
                    title: aDTO.title,
                    weekNumber: weekNumber,
                    dueDate: finalDueDate,
                    fullInstructions: aDTO.fullInstructions,
                    pointsPossible: aDTO.pointsPossible ?? "100 Points",
                    noteText: aDTO.noteText,
                    courseCode: newCourse.courseCode,
                    weightPercentage: aDTO.weightPercentage
                )
                assignment.course = newCourse
                newCourse.assignments.append(assignment)
                modelContext.insert(assignment)
            }
        }

        // Create linked SyllabusDocument
        let docTitle = "\(newCourse.courseCode ?? newCourse.courseName) Syllabus"
        let syllabusDoc = SyllabusDocument(
            id: UUID(),
            docTitle: docTitle,
            officeHoursText: "By appointment",
            instructorContact: "Instructor",
            courseCode: newCourse.courseCode
        )
        syllabusDoc.course = newCourse
        newCourse.syllabusDocs.append(syllabusDoc)
        modelContext.insert(syllabusDoc)

        modelContext.insert(newCourse)
        try? modelContext.save()
    }
}

// MARK: - Week <-> Date Bidirectional Converter
public enum WeekDateConverter {
    public static var baseTermStartDate: Date {
        var comp = DateComponents()
        comp.year = 2026
        comp.month = 9
        comp.day = 4
        comp.hour = 23
        comp.minute = 59
        return Calendar.current.date(from: comp) ?? Date()
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

    public static func formattedDueDate(for date: Date?, weekNumber: Int) -> String {
        let weekNum = max(1, weekNumber)
        let d = date ?? WeekDateConverter.date(forWeek: weekNum)
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"
        return "Due " + formatter.string(from: d) + " · Week \(weekNum)"
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
}
