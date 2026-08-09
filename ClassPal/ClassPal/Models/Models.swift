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

    public var computedEndDate: Date? {
        if let str = dateRangeStr, !str.isEmpty {
            let dates = LocalSyllabusParser.shared.extractAllDates(from: str, fallbackYear: 2026)
            if dates.count >= 2 {
                return dates.last?.date
            } else if let first = dates.first {
                return Calendar.current.date(byAdding: .day, value: 6, to: first.date)
            }
        }
        if let start = startDate {
            return Calendar.current.date(byAdding: .day, value: 6, to: start)
        }
        return nil
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
    public var relevantTopics: String?
    
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
        semanticCategoryRaw: String? = "reading",
        relevantTopics: String? = nil
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
        self.relevantTopics = relevantTopics
    }

    public var computedTopics: [String] {
        if let explicit = relevantTopics, !explicit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return explicit.components(separatedBy: CharacterSet(charactersIn: ",|;\n"))
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        }
        if let takeaways = keyTakeawaysText, !takeaways.isEmpty {
            let lines = takeaways.components(separatedBy: .newlines)
                .map { $0.replacingOccurrences(of: "•", with: "").trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            if !lines.isEmpty {
                return lines
            }
        }
        if let summary = summaryText, !summary.isEmpty {
            let sentences = summary.components(separatedBy: ".")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty && $0.count < 60 }
            if !sentences.isEmpty {
                return Array(sentences.prefix(3))
            }
        }
        return ["\(mediaType.displayName) Core Concepts", "Required Module Material"]
    }

    public var associatedAssignments: [Assignment] {
        guard let weekNum = week?.weekNumber, let course = week?.course else { return [] }
        return course.assignments.filter { $0.weekNumber == weekNum && !$0.isDeleted }
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
    public var pointsBreakdown: String?
    public var weightPercentage: String?
    public var noteText: String?
    public var isCompleted: Bool
    public var isDeleted: Bool
    public var attachmentNames: [String]
    public var sourcePageNumber: Int?
    public var courseCode: String?
    public var semanticCategoryRaw: String?
    public var subTypeRaw: String?
    public var mediaUrl: String?
    public var relevantTopics: String?
    
    public var course: Course?

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
        attachmentNames: [String] = [],
        sourcePageNumber: Int? = 1,
        courseCode: String? = nil,
        semanticCategoryRaw: String? = "assignment",
        weightPercentage: String? = nil,
        subTypeRaw: String? = "PAPER",
        mediaUrl: String? = nil,
        relevantTopics: String? = nil
    ) {
        self.id = id
        self.title = title
        self.weekNumber = weekNumber
        self.dueDate = dueDate
        self.fullInstructions = fullInstructions
        self.pointsPossible = pointsPossible
        self.pointsBreakdown = pointsBreakdown
        self.weightPercentage = weightPercentage
        self.noteText = noteText
        self.isCompleted = isCompleted
        self.isDeleted = isDeleted
        self.attachmentNames = attachmentNames
        self.sourcePageNumber = sourcePageNumber
        self.courseCode = courseCode
        self.semanticCategoryRaw = semanticCategoryRaw
        self.subTypeRaw = subTypeRaw
        self.mediaUrl = mediaUrl
        self.relevantTopics = relevantTopics
    }

    public var computedTopics: [String] {
        if let explicit = relevantTopics, !explicit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return explicit.components(separatedBy: CharacterSet(charactersIn: ",|;\n"))
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        }
        var topics: [String] = []
        if let inst = fullInstructions, !inst.isEmpty {
            let lines = inst.components(separatedBy: .newlines)
            for line in lines {
                let lower = line.lowercased()
                if lower.contains("topic") || lower.contains("focus") || lower.contains("concept") || lower.contains("module") {
                    let cleaned = line.replacingOccurrences(of: "•", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
                    if !cleaned.isEmpty && cleaned.count < 60 {
                        topics.append(cleaned)
                    }
                }
            }
        }
        if topics.isEmpty {
            let titleWords = title.components(separatedBy: .whitespaces)
            if titleWords.count >= 2 {
                topics.append(titleWords.prefix(4).joined(separator: " "))
            }
            topics.append("\(displaySubType.capitalized) Objectives & Evaluation")
        }
        return Array(Set(topics))
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
    public static func normalizeKey(_ str: String) -> String {
        return str.lowercased()
            .replacingOccurrences(of: "syllabus", with: "")
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .joined()
    }

    public static func normalizeTitle(_ str: String) -> String {
        return str.lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .joined()
    }

    public static func importDTO(_ dto: CourseDTO, into modelContext: ModelContext) {
        let descriptor = FetchDescriptor<Course>()
        if let existingCourses = try? modelContext.fetch(descriptor) {
            let targetCodeKey = normalizeKey(dto.courseCode ?? "")
            let targetNameKey = normalizeKey(dto.courseName)

            if let existing = existingCourses.first(where: { course in
                let cCodeKey = normalizeKey(course.courseCode ?? "")
                let cNameKey = normalizeKey(course.courseName)
                if !targetCodeKey.isEmpty && !cCodeKey.isEmpty && targetCodeKey == cCodeKey {
                    return true
                }
                if !targetNameKey.isEmpty && !cNameKey.isEmpty && targetNameKey == cNameKey {
                    return true
                }
                return false
            }) {
                importDTO(dto, into: existing, modelContext: modelContext)
                return
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

        if let items = dto.items, !items.isEmpty {
            importItemDTOs(items, into: newCourse, modelContext: modelContext)
        }

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
                    let summary = rDTO.summaryText ?? "Required reading: \(rDTO.title)."
                    let takeaways = rDTO.keyTakeawaysText ?? "• Review \(rDTO.title)"
                    let estTime = rDTO.estimatedTimeText ?? (mediaType == .video || mediaType == .podcast ? "~20–30 min" : "~40–60 min")
                    let videoUrl: String? = {
                        if let cand = rDTO.videoUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = rDTO.summaryText, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                        if let extracted = URLHelper.extractFirstURL(from: rDTO.title) { return extracted }
                        return nil
                    }()

                    let parsedDueDate: Date? = {
                        guard let dStr = rDTO.dueDate, !dStr.isEmpty else { return nil }
                        return LocalSyllabusParser.parseISO8601Date(from: dStr, fallbackYear: 2026).date
                    }()

                    let reading = Reading(
                        id: UUID(),
                        title: rDTO.title,
                        mediaType: mediaType,
                        isCompleted: rDTO.isCompleted ?? false,
                        summaryText: summary,
                        keyTakeawaysText: takeaways,
                        estimatedTimeText: estTime,
                        videoUrl: videoUrl,
                        dueDate: parsedDueDate ?? week.computedEndDate,
                        dateRangeStr: rDTO.dateRangeStr ?? week.dateRangeStr,
                        courseCode: newCourse.courseCode
                    )
                    reading.week = week
                    week.readings.append(reading)
                    modelContext.insert(reading)
                }
            }
        }

        if let assignments = dto.assignments {
            let isoFmt = ISO8601DateFormatter()
            let dfShort = DateFormatter()
            dfShort.dateFormat = "yyyy-MM-dd"

            for aDTO in assignments {
                if newCourse.assignments.contains(where: { $0.title.lowercased() == aDTO.title.lowercased() }) { continue }

                var parsedDueDate: Date? = nil
                if let dueStr = aDTO.dueDate, !dueStr.isEmpty {
                    parsedDueDate = isoFmt.date(from: dueStr) ?? dfShort.date(from: dueStr)
                }

                let finalDueDate: Date = parsedDueDate ?? Date()
                let days = Calendar.current.dateComponents([.day], from: WeekDateConverter.baseTermStartDate, to: finalDueDate).day ?? 0
                let weekNumber = max(1, min(16, (days / 7) + 1))

                    let mediaUrl: String? = {
                        if let cand = aDTO.mediaUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = aDTO.fullInstructions, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                        if let extracted = URLHelper.extractFirstURL(from: aDTO.title) { return extracted }
                        return nil
                    }()

                    let assignment = Assignment(
                        id: UUID(),
                        title: aDTO.title,
                        weekNumber: weekNumber,
                        dueDate: finalDueDate,
                        fullInstructions: aDTO.fullInstructions ?? "Complete \(aDTO.title)",
                        pointsPossible: aDTO.pointsPossible ?? "100 Points",
                        pointsBreakdown: aDTO.pointsBreakdown,
                        noteText: aDTO.noteText,
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
        do {
            try modelContext.save()
            let totalItems = newCourse.assignments.count + newCourse.weeks.reduce(0) { $0 + $1.readings.count }
            let courseCode = newCourse.courseCode ?? newCourse.courseName
            print("💾 [DATABASE] Successfully saved \(totalItems) items to Course: \(courseCode)")
        } catch {
            print("⚠️ [DATABASE ERROR] Failed to persist data: \(error)")
        }
    }

    public static func importDTO(_ dto: CourseDTO, into existingCourse: Course, modelContext: ModelContext) {
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
                    let summary = rDTO.summaryText ?? "Required reading: \(rDTO.title)."
                    let takeaways = rDTO.keyTakeawaysText ?? "• Review \(rDTO.title)"
                    let estTime = rDTO.estimatedTimeText ?? (mediaType == .video || mediaType == .podcast ? "~20–30 min" : "~40–60 min")
                    let videoUrl: String? = {
                        if let cand = rDTO.videoUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = rDTO.summaryText, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                        if let extracted = URLHelper.extractFirstURL(from: rDTO.title) { return extracted }
                        return nil
                    }()

                    let parsedDueDate: Date? = {
                        guard let dStr = rDTO.dueDate, !dStr.isEmpty else { return nil }
                        return LocalSyllabusParser.parseISO8601Date(from: dStr, fallbackYear: 2026).date
                    }()

                    if let existingReading = allExistingReadings.first(where: { $0.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normTitle }) {
                        existingReading.summaryText = summary
                        existingReading.keyTakeawaysText = takeaways
                        existingReading.estimatedTimeText = estTime
                        if let pDate = parsedDueDate { existingReading.dueDate = pDate }
                    } else {
                        let reading = Reading(
                            id: UUID(),
                            title: rDTO.title,
                            mediaType: mediaType,
                            isCompleted: rDTO.isCompleted ?? false,
                            summaryText: summary,
                            keyTakeawaysText: takeaways,
                            estimatedTimeText: estTime,
                            videoUrl: videoUrl,
                            dueDate: parsedDueDate ?? week.computedEndDate,
                            dateRangeStr: rDTO.dateRangeStr ?? week.dateRangeStr,
                            courseCode: existingCourse.courseCode
                        )
                        reading.week = week
                        week.readings.append(reading)
                        modelContext.insert(reading)
                    }
                }
            }
        }

        if let assignments = dto.assignments {
            let isoFmt = ISO8601DateFormatter()
            let dfShort = DateFormatter()
            dfShort.dateFormat = "yyyy-MM-dd"

            for aDTO in assignments {
                let normTitle = aDTO.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                var parsedDueDate: Date? = nil
                if let dueStr = aDTO.dueDate, !dueStr.isEmpty {
                    parsedDueDate = isoFmt.date(from: dueStr) ?? dfShort.date(from: dueStr)
                }

                let finalDueDate: Date = parsedDueDate ?? Date()
                let days = Calendar.current.dateComponents([.day], from: WeekDateConverter.baseTermStartDate, to: finalDueDate).day ?? 0
                let weekNumber = max(1, min(16, (days / 7) + 1))

                if let existingAssignment = existingCourse.assignments.first(where: { $0.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normTitle }) {
                    if let inst = aDTO.fullInstructions, !inst.isEmpty { existingAssignment.fullInstructions = inst }
                    if let pts = aDTO.pointsPossible, !pts.isEmpty { existingAssignment.pointsPossible = pts }
                    if let weight = aDTO.weightPercentage, !weight.isEmpty { existingAssignment.weightPercentage = weight }
                    if let bd = aDTO.pointsBreakdown, !bd.isEmpty { existingAssignment.pointsBreakdown = bd }
                    if parsedDueDate != nil { existingAssignment.dueDate = finalDueDate }
                } else {
                    let mediaUrl: String? = {
                        if let cand = aDTO.mediaUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = aDTO.fullInstructions, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                        if let extracted = URLHelper.extractFirstURL(from: aDTO.title) { return extracted }
                        return nil
                    }()

                    let assignment = Assignment(
                        id: UUID(),
                        title: aDTO.title,
                        weekNumber: weekNumber,
                        dueDate: finalDueDate,
                        fullInstructions: aDTO.fullInstructions ?? "Complete \(aDTO.title)",
                        pointsPossible: aDTO.pointsPossible ?? "100 Points",
                        pointsBreakdown: aDTO.pointsBreakdown,
                        noteText: nil,
                        isCompleted: false,
                        isDeleted: false,
                        courseCode: existingCourse.courseCode,
                        weightPercentage: aDTO.weightPercentage,
                        subTypeRaw: "PAPER",
                        mediaUrl: mediaUrl
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
                guard let dStr = item.dueDateIso, !dStr.isEmpty else { return nil }
                return LocalSyllabusParser.parseISO8601Date(from: dStr, fallbackYear: 2026).date
            }()
            let isAssignment = item.category.lowercased() == "assignment" || item.category.lowercased().contains("assignment") || item.category.lowercased().contains("exam") || item.category.lowercased().contains("project")
            if isAssignment {
                let existingAssign = course.assignments.first(where: { normalizeTitle($0.title) == normTitle }) ??
                                     courseAssignments.first(where: { normalizeTitle($0.title) == normTitle })
                if let existing = existingAssign {
                    print("ℹ️ [RE-UPLOAD CLAUSE] Assignment '\(item.title)' already exists. Updating in place.")
                    if let desc = item.description, !desc.isEmpty { existing.fullInstructions = desc }
                    if let pts = item.points, !pts.isEmpty { existing.pointsPossible = pts }
                    if let bd = item.pointsBreakdown, !bd.isEmpty { existing.pointsBreakdown = bd }
                    if let weight = item.percentage, !weight.isEmpty { existing.weightPercentage = weight }
                    if let sub = item.subType, !sub.isEmpty { existing.subTypeRaw = sub }
                    if let media = item.mediaUrl, !media.isEmpty { existing.mediaUrl = media }
                    if let pDate = parsedDueDate { existing.dueDate = pDate }
                } else {
                    let realBreakdown: String? = {
                        if let bd = item.pointsBreakdown, !bd.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            return bd
                        }
                        return nil
                    }()

                    let assignment = Assignment(
                        id: UUID(),
                        title: item.title,
                        weekNumber: weekNum,
                        dueDate: parsedDueDate ?? Date(),
                        fullInstructions: item.description ?? "Complete \(item.title)",
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

                let existingReading = course.weeks.flatMap({ $0.readings }).first(where: { normalizeTitle($0.title) == normTitle }) ??
                                      courseReadings.first(where: { normalizeTitle($0.title) == normTitle })
                if let existing = existingReading {
                    print("ℹ️ [RE-UPLOAD CLAUSE] Reading '\(item.title)' already exists. Updating in place.")
                    if let desc = item.description, !desc.isEmpty { existing.summaryText = desc }
                    if let media = item.mediaUrl, !media.isEmpty { existing.videoUrl = media }
                    if let pDate = parsedDueDate { existing.dueDate = pDate }
                } else {
                    let videoUrl: String? = {
                        if let cand = item.mediaUrl, URLHelper.isValidURL(cand) { return cand }
                        if let cand = item.description, let extracted = URLHelper.extractFirstURL(from: cand) { return extracted }
                        if let extracted = URLHelper.extractFirstURL(from: item.title) { return extracted }
                        return nil
                    }()

                    let reading = Reading(
                        id: UUID(),
                        title: item.title,
                        mediaType: mediaType,
                        isCompleted: false,
                        isDeleted: false,
                        summaryText: item.description ?? "Required reading for \(item.title).",
                        keyTakeawaysText: nil,
                        estimatedTimeText: item.subType == "VIDEO" ? "~20 min video" : "~45 min read",
                        videoUrl: videoUrl,
                        dueDate: parsedDueDate ?? week.computedEndDate,
                        dateRangeStr: week.dateRangeStr,
                        courseCode: course.courseCode
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

    public static func formattedDueDate(for date: Date?, week: Week? = nil, weekNumber: Int = 1) -> String {
        let weekNum = max(1, weekNumber)
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"

        let targetDate: Date = {
            let weekEndDate = week?.computedEndDate

            if let explicitDate = date {
                if let wEnd = weekEndDate {
                    if explicitDate > wEnd {
                        return wEnd
                    }
                    if let dates = week?.dateRangeStr.flatMap({ LocalSyllabusParser.shared.extractAllDates(from: $0, fallbackYear: 2026) }),
                       let wStart = dates.first?.date, explicitDate < wStart {
                        return wEnd
                    }
                }
                return explicitDate
            }

            if let wEnd = weekEndDate {
                return wEnd
            }

            return WeekDateConverter.date(forWeek: weekNum)
        }()

        return "Due " + formatter.string(from: targetDate) + " · Week \(weekNum)"
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
