import Foundation
#if canImport(UIKit)
import UIKit
#endif

// MARK: - DTO Contracts matching Backend API

public struct ReadingDTO: Codable, Identifiable {
    public let id: String
    public let title: String
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

    enum CodingKeys: String, CodingKey {
        case id, title
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
    }

    public init(
        id: String,
        title: String,
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
        pagesText: String? = nil
    ) {
        self.id = id
        self.title = title
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
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try container.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        self.title = (try container.decodeIfPresent(String.self, forKey: .title)) ?? "Reading"
        self.mediaType = try container.decodeIfPresent(String.self, forKey: .mediaType) ?? "textbook"
        self.isCompleted = try container.decodeIfPresent(Bool.self, forKey: .isCompleted) ?? false
        self.summaryText = try container.decodeIfPresent(String.self, forKey: .summaryText)
        self.keyTakeawaysText = try container.decodeIfPresent(String.self, forKey: .keyTakeawaysText)
        self.estimatedTimeText = try container.decodeIfPresent(String.self, forKey: .estimatedTimeText)
        self.videoUrl = try container.decodeIfPresent(String.self, forKey: .videoUrl)
        self.dueDate = try container.decodeIfPresent(String.self, forKey: .dueDate)
        self.dateRangeStr = try container.decodeIfPresent(String.self, forKey: .dateRangeStr)
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
        mediaUrl: String? = nil
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
    }
}

import Network
import CoreGraphics

public struct ItemDTO: Codable, Identifiable {
    public var id: String { title + "\(weekNumber ?? 1)" }
    public let title: String
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

    enum CodingKeys: String, CodingKey {
        case title, category, description, points, percentage
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
        estimatedTime: String? = nil
    ) {
        self.title = title
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
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.title = (try container.decodeIfPresent(String.self, forKey: .title)) ?? "Untitled Item"
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
            self.weekNumber = 1
        }

        self.dueDateIso = try container.decodeIfPresent(String.self, forKey: .dueDateIso)
        self.mediaUrl = try container.decodeIfPresent(String.self, forKey: .mediaUrl)
        self.relevantTopics = try container.decodeIfPresent(String.self, forKey: .relevantTopics)
        self.chapterText = try container.decodeIfPresent(String.self, forKey: .chapterText)
        self.pagesText = try container.decodeIfPresent(String.self, forKey: .pagesText)
        self.summaryText = try container.decodeIfPresent(String.self, forKey: .summaryText)
        self.keyTakeaways = try container.decodeIfPresent(String.self, forKey: .keyTakeaways)
        self.estimatedTime = try container.decodeIfPresent(String.self, forKey: .estimatedTime)
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
        dataExtractionStats: ExtractionStatsDTO? = nil
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
        if let single = try? decoder.decode(CourseDTO.self, from: jsonBodyData) {
            return single
        }
        if let array = try? decoder.decode([CourseDTO].self, from: jsonBodyData), let first = array.first {
            return first
        }
        return try decoder.decode(CourseDTO.self, from: jsonBodyData)
    }

    public func testGeminiConnection(apiKey: String) async throws -> Bool {
        let keyToUse = apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Self.bundledAPIKey : apiKey.trimmingCharacters(in: .whitespacesAndNewlines)

        let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=\(keyToUse)"
        guard let url = URL(string: endpoint) else { return false }

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

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(keyToUse, forHTTPHeaderField: "x-goog-api-key")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (_, response) = try await URLSession.shared.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode == 200
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
            guard let page = pdfDoc.page(at: i) else { continue }
            var pageBox = page.getBoxRect(.mediaBox)
            pdfContext.beginPage(mediaBox: &pageBox)
            pdfContext.drawPDFPage(page)
            pdfContext.endPage()
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

        let compressedData = Self.compressPDFDataIfNeeded(pdfData)
        let base64String = compressedData.base64EncodedString()
        let modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]

        let systemInstructions = """
        You are the senior academic extraction engine for CoursePal. Analyze the provided syllabus document and extract 100% of all structured course details, faculty contacts, office hours, reading lists, and assignments into JSON.

        EXTRACTION GUIDELINES:
        1. COURSE & FACULTY METADATA:
           - course_code: Catalog code (e.g. "CPC 514" or "BIO 110").
           - course_title: Full formal course name (e.g. "Research Methods and Statistics").
           - course_description: 1-2 sentence course description or overview if present.
           - instructor_name: Faculty/Professor primary name (e.g. "Dr. Sarah Johnson").
           - instructor_email: Faculty email address.
           - office_hours: Office hours schedule, room, or virtual meeting link.
           - term_weeks: Total number of weeks in term (e.g. 16 or 12).

        2. READINGS (category = "Reading"):
           - title: Clean, complete title of the book, article, or resource (e.g. "Creswell & Creswell: Research Design" or "Family Systems Theory in Practice"). DO NOT reduce to just a single author surname if a book or article title is provided.
           - chapter_text: Chapter designation if present (e.g. "Chapters 1-3", "Chapter 5").
           - pages_text: Page range if present (e.g. "pp. 45-80").
           - relevant_topics: Main module topic or theme for the week.
           - summary_text: 1-2 concise sentences summarizing the reading content.
           - key_takeaways: 1-2 bullet points with core concepts ("• Concept 1\n• Concept 2").
           - estimated_time: Time estimate (e.g. "~45 min read", "~20 min video").
           - media_url: Direct link to article, video, or podcast if found in document.
           - due_date_iso: Scheduled date in YYYY-MM-DD format.
           - week_number: Chronological week number (1..16). If weeks are not explicitly labeled, map dates chronologically.

        3. ASSIGNMENTS (category = "Assignment"):
           - title: Clean, meaningful deliverable name (e.g. "Research Study Design: Individual Paper", "Midterm Exam", "Ethics Presentation").
           - description: Full instructions, prompt requirements, guidelines, and submission details.
           - points: Exact points possible (e.g. "100 Points").
           - points_breakdown: Rubric breakdown by criterion if present (e.g. "Analysis: 40 pts, Methodology: 40 pts, Style: 20 pts").
           - percentage: Grade weight percentage (e.g. "20%" or "40%").
           - due_date_iso: Exact due date in YYYY-MM-DD format verbatim from schedule.
           - week_number: Chronological week number (1..16) when the assignment is due.
        """

        let responseSchema: [String: Any] = [
            "type": "OBJECT",
            "propertyOrdering": ["data_extraction_stats", "course_code", "course_title", "course_description", "instructor_name", "instructor_email", "office_hours", "term_weeks", "items"],
            "properties": [
                "data_extraction_stats": [
                    "type": "OBJECT",
                    "description": "Metadata about the extraction process to ensure data quality.",
                    "properties": [
                        "status": [
                            "type": "STRING",
                            "enum": ["success", "partial_data", "failed_unreadable"],
                            "description": "Success if all data found. Partial if dates/titles are missing."
                        ],
                        "confidence_score": [
                            "type": "INTEGER",
                            "description": "Scale of 1 to 10 rating how clearly the source document was formatted."
                        ],
                        "missing_fields": [
                            "type": "ARRAY",
                            "items": ["type": "STRING"],
                            "description": "List any expected data (e.g. 'assignment due dates', 'reading authors') that were missing."
                        ]
                    ],
                    "required": ["status", "confidence_score", "missing_fields"]
                ],
                "course_code": ["type": "STRING", "description": "Catalog course code, e.g. 'CPC 514'."],
                "course_title": ["type": "STRING", "description": "Full formal name of the course."],
                "course_description": ["type": "STRING", "nullable": true, "description": "Brief course overview or summary."],
                "instructor_name": ["type": "STRING", "nullable": true, "description": "Faculty/Professor primary name."],
                "instructor_email": ["type": "STRING", "nullable": true, "description": "Faculty email address."],
                "office_hours": ["type": "STRING", "nullable": true, "description": "Office hours schedule, room, or link."],
                "term_weeks": ["type": "INTEGER", "description": "Total number of weeks in the term (default 16)."],
                "items": [
                    "type": "ARRAY",
                    "items": [
                        "type": "OBJECT",
                        "properties": [
                            "title": ["type": "STRING", "description": "Clean, descriptive title for the assignment or reading (e.g. 'Research Study Design: Individual Paper' or 'Creswell & Creswell: Research Design')."],
                            "category": ["type": "STRING", "enum": ["Assignment", "Reading"]],
                            "sub_type": [
                                "type": "STRING",
                                "enum": ["TEXTBOOK", "ARTICLE", "VIDEO", "PODCAST", "IN_CLASS", "PAPER", "PRESENTATION", "OTHER"]
                            ],
                            "description": ["type": "STRING", "nullable": true, "description": "Instructions, requirements, or chapter focus."],
                            "points": ["type": "STRING", "nullable": true, "description": "Total points possible, e.g. '100 Points'."],
                            "points_breakdown": ["type": "STRING", "nullable": true, "description": "Rubric criteria breakdown, e.g. 'Methodology: 50 pts, Analysis: 50 pts'."],
                            "percentage": ["type": "STRING", "nullable": true, "description": "Grade weight percentage, e.g. '20%'."],
                            "week_number": ["type": "INTEGER", "description": "Chronological week number (1..16)."],
                            "due_date_iso": ["type": "STRING", "nullable": true, "description": "Due date in YYYY-MM-DD format."],
                            "chapter_text": ["type": "STRING", "nullable": true, "description": "Chapter designation, e.g. 'Chapter 5'."],
                            "pages_text": ["type": "STRING", "nullable": true, "description": "Page range, e.g. 'pp. 45-80'."],
                            "relevant_topics": ["type": "STRING", "nullable": true, "description": "Module topic or theme."],
                            "summary_text": ["type": "STRING", "nullable": true, "description": "1-2 sentence summary of content."],
                            "key_takeaways": ["type": "STRING", "nullable": true, "description": "1-2 bullet points of core concepts."],
                            "estimated_time": ["type": "STRING", "nullable": true, "description": "Time estimate, e.g. '~45 min read'."],
                            "media_url": ["type": "STRING", "nullable": true, "description": "Direct URL if present."]
                        ],
                        "required": ["title", "category", "sub_type", "week_number"]
                    ]
                ]
            ],
            "required": ["data_extraction_stats", "course_code", "course_title", "items"]
        ]

        var lastErrorMsg = ""
        var lastStatusCode = 500

        for modelName in modelsToTry {
            let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/\(modelName):generateContent?key=\(apiKey)"
            guard let url = URL(string: endpoint) else { continue }

            let payload: [String: Any] = [
                "contents": [
                    [
                        "parts": [
                            [
                                "inlineData": [
                                    "mimeType": "application/pdf",
                                    "data": base64String
                                ]
                            ]
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
            request.timeoutInterval = 90
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(apiKey, forHTTPHeaderField: "x-goog-api-key")
            request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

            for attempt in 0..<3 {
                print("📦 [NETWORK] Outgoing Payload Size: \(base64String.count) bytes targeting \(modelName) (Attempt \(attempt + 1)/3)")

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
                                print("✅ [APIService SUCCESS] Multimodal Base64 parsed strictly via Gemini model '\(modelName)'!")
                                return courseDTO
                            }
                        }
                    } else if httpStatus == 429 || httpStatus == 503 {
                        print("⚠️ [RATE LIMIT / BUSY] HTTP \(httpStatus) on '\(modelName)'. Retrying in 3.0s (Attempt \(attempt + 1)/3)...")
                        try? await Task.sleep(nanoseconds: 3_000_000_000)
                        continue
                    } else {
                        lastErrorMsg = "API Error [\(httpStatus)]: Model '\(modelName)' returned HTTP status \(httpStatus)."
                        print("❌ [NETWORK WARNING] \(lastErrorMsg)")
                        break
                    }
                } catch {
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
            throw NSError(domain: "APIService", code: 401, userInfo: [NSLocalizedDescriptionKey: "API Key Missing: Please enter your Gemini API key in settings."])
        }
        print("[APIService] Calling Gemini Cloud AI with active API key (\(keyToUse.prefix(6))...)")
        return try await parseSyllabusWithGemini(rawText, apiKey: keyToUse)
    }

    public func parseSyllabusWithGemini(_ rawText: String, apiKey: String) async throws -> CourseDTO {
        let modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]
        var lastError: Error = URLError(.badServerResponse)

        print("📦 [NETWORK] Text payload size: \(rawText.count) chars")

        let systemInstructions = """
        You are the senior academic extraction engine for CoursePal. Analyze the provided syllabus text and extract 100% of all structured course details, faculty contacts, office hours, reading lists, and assignments into JSON.

        EXTRACTION GUIDELINES:
        1. COURSE & FACULTY METADATA:
           - course_code: Catalog code (e.g. "CPC 514" or "BIO 110").
           - course_title: Full formal course name (e.g. "Research Methods and Statistics").
           - course_description: 1-2 sentence course description or overview if present.
           - instructor_name: Faculty/Professor primary name (e.g. "Dr. Sarah Johnson").
           - instructor_email: Faculty email address.
           - office_hours: Office hours schedule, room, or virtual meeting link.
           - term_weeks: Total number of weeks in term (e.g. 16 or 12).

        2. READINGS (category = "Reading"):
           - title: Clean, complete title of the book, article, or resource (e.g. "Creswell & Creswell: Research Design" or "Family Systems Theory in Practice"). DO NOT reduce to just a single author surname if a book or article title is provided.
           - chapter_text: Chapter designation if present (e.g. "Chapters 1-3", "Chapter 5").
           - pages_text: Page range if present (e.g. "pp. 45-80").
           - relevant_topics: Main module topic or theme for the week.
           - summary_text: 1-2 concise sentences summarizing the reading content.
           - key_takeaways: 1-2 bullet points with core concepts ("• Concept 1\n• Concept 2").
           - estimated_time: Time estimate (e.g. "~45 min read", "~20 min video").
           - media_url: Direct link to article, video, or podcast if found in document.
           - due_date_iso: Scheduled date in YYYY-MM-DD format.
           - week_number: Chronological week number (1..16). If weeks are not explicitly labeled, map dates chronologically.

        3. ASSIGNMENTS (category = "Assignment"):
           - title: Clean, meaningful deliverable name (e.g. "Research Study Design: Individual Paper", "Midterm Exam", "Ethics Presentation").
           - description: Full instructions, prompt requirements, guidelines, and submission details.
           - points: Exact points possible (e.g. "100 Points").
           - points_breakdown: Rubric breakdown by criterion if present (e.g. "Analysis: 40 pts, Methodology: 40 pts, Style: 20 pts").
           - percentage: Grade weight percentage (e.g. "20%" or "40%").
           - due_date_iso: Exact due date in YYYY-MM-DD format verbatim from schedule.
           - week_number: Chronological week number (1..16) when the assignment is due.
        """

        let responseSchema: [String: Any] = [
            "type": "OBJECT",
            "propertyOrdering": ["data_extraction_stats", "course_code", "course_title", "course_description", "instructor_name", "instructor_email", "office_hours", "term_weeks", "items"],
            "properties": [
                "data_extraction_stats": [
                    "type": "OBJECT",
                    "description": "Metadata about the extraction process to ensure data quality.",
                    "properties": [
                        "status": [
                            "type": "STRING",
                            "enum": ["success", "partial_data", "failed_unreadable"],
                            "description": "Success if all data found. Partial if dates/titles are missing."
                        ],
                        "confidence_score": [
                            "type": "INTEGER",
                            "description": "Scale of 1 to 10 rating how clearly the source document was formatted."
                        ],
                        "missing_fields": [
                            "type": "ARRAY",
                            "items": ["type": "STRING"],
                            "description": "List any expected data (e.g. 'assignment due dates', 'reading authors') that were missing."
                        ]
                    ],
                    "required": ["status", "confidence_score", "missing_fields"]
                ],
                "course_code": ["type": "STRING", "description": "Catalog course code, e.g. 'CPC 514'."],
                "course_title": ["type": "STRING", "description": "Full formal name of the course."],
                "course_description": ["type": "STRING", "nullable": true, "description": "Brief course overview or summary."],
                "instructor_name": ["type": "STRING", "nullable": true, "description": "Faculty/Professor primary name."],
                "instructor_email": ["type": "STRING", "nullable": true, "description": "Faculty email address."],
                "office_hours": ["type": "STRING", "nullable": true, "description": "Office hours schedule, room, or link."],
                "term_weeks": ["type": "INTEGER", "description": "Total number of weeks in the term (default 16)."],
                "items": [
                    "type": "ARRAY",
                    "items": [
                        "type": "OBJECT",
                        "properties": [
                            "title": ["type": "STRING", "description": "Clean, descriptive title for the assignment or reading (e.g. 'Research Study Design: Individual Paper' or 'Creswell & Creswell: Research Design')."],
                            "category": ["type": "STRING", "enum": ["Assignment", "Reading"]],
                            "sub_type": ["type": "STRING", "enum": ["TEXTBOOK", "ARTICLE", "VIDEO", "PODCAST", "IN_CLASS", "PAPER", "PRESENTATION", "OTHER"]],
                            "description": ["type": "STRING", "nullable": true, "description": "Instructions, requirements, or chapter focus."],
                            "points": ["type": "STRING", "nullable": true, "description": "Total points possible, e.g. '100 Points'."],
                            "points_breakdown": ["type": "STRING", "nullable": true, "description": "Rubric criteria breakdown, e.g. 'Methodology: 50 pts, Analysis: 50 pts'."],
                            "percentage": ["type": "STRING", "nullable": true, "description": "Grade weight percentage, e.g. '20%'."],
                            "week_number": ["type": "INTEGER", "description": "Chronological week number (1..16)."],
                            "due_date_iso": ["type": "STRING", "nullable": true, "description": "Due date in YYYY-MM-DD format."],
                            "chapter_text": ["type": "STRING", "nullable": true, "description": "Chapter designation, e.g. 'Chapter 5'."],
                            "pages_text": ["type": "STRING", "nullable": true, "description": "Page range, e.g. 'pp. 45-80'."],
                            "relevant_topics": ["type": "STRING", "nullable": true, "description": "Module topic or theme."],
                            "summary_text": ["type": "STRING", "nullable": true, "description": "1-2 sentence summary of content."],
                            "key_takeaways": ["type": "STRING", "nullable": true, "description": "1-2 bullet points of core concepts."],
                            "estimated_time": ["type": "STRING", "nullable": true, "description": "Time estimate, e.g. '~45 min read'."],
                            "media_url": ["type": "STRING", "nullable": true, "description": "Direct URL if present."]
                        ],
                        "required": ["title", "category", "sub_type", "week_number"]
                    ]
                ]
            ],
            "required": ["data_extraction_stats", "course_code", "course_title", "items"]
        ]

        for modelName in modelsToTry {
            let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/\(modelName):generateContent?key=\(apiKey)"
            guard let url = URL(string: endpoint) else { continue }

            let payload: [String: Any] = [
                "contents": [
                    [
                        "parts": [
                            ["text": rawText]
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
            request.timeoutInterval = 90
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(apiKey, forHTTPHeaderField: "x-goog-api-key")
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)

            print("📡 [NETWORK] Sending text to Gemini model: \(modelName)")

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
                print("❌ [NETWORK ERROR] \(modelName): \(error.localizedDescription)")
                lastError = error
            }
        }
        throw lastError
    }


    public func parseSyllabusImageData(_ imageData: Data) async throws -> CourseDTO {
        let keyToUse = activeAPIKey
        guard !keyToUse.isEmpty else {
            throw NSError(domain: "APIService", code: 401, userInfo: [NSLocalizedDescriptionKey: "API Key Missing: Please enter your Gemini API key in settings."])
        }
        print("[APIService] Calling Gemini Cloud Vision AI with active API key...")
        return try await parseSyllabusImageWithGemini(imageData, mimeType: "image/jpeg", apiKey: keyToUse)
    }

    public func parseSyllabusImageWithGemini(_ imageData: Data, mimeType: String = "image/jpeg", apiKey: String) async throws -> CourseDTO {
        let base64String = imageData.base64EncodedString()
        let modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]
        var lastError: Error = URLError(.badServerResponse)

        print("📦 [NETWORK] Outgoing Payload Size: \(base64String.count) bytes")

        for modelName in modelsToTry {
            let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/\(modelName):generateContent?key=\(apiKey)"
            guard let url = URL(string: endpoint) else { continue }

            let prompt = """
            You are an elite academic syllabus AI engine. Thoroughly analyze the provided syllabus image or document scan and extract 100% of all courses, weeks, readings, textbooks, media, and assignments into a clean JSON structure.

            STRICT EXTRACTION RULES ("TRAINED AI PIPELINE"):
            1. COURSE DETAILS:
               - "course_name": Full title of the course (e.g. "Research Methods and Statistics").
               - "course_code": Catalog code (e.g. "CPC 514" or "CPC 523").
               - "term_weeks": Total number of weeks in term (integer, e.g. 16 or 12).
               - "sharing_code": Pure 6-digit numeric string (e.g. "849204").

            2. ASSIGNMENTS & GRADING CRITERIA:
               - Extract EVERY assignment listed under "Assignments", "Grading", or "Evaluation".
               - "title": FULL OFFICIAL EXACT TITLE verbatim as written in the syllabus (e.g. "Group Sexuality Research Paper (40%)"). Do NOT shorten or alter.
               - "due_date": ISO date format "YYYY-MM-DD" (e.g. "2026-07-23" or "2026-09-13"). Extract exact due date or infer from week schedule date ranges. Default year is 2026.
               - "points_possible": Total points or rubrics (e.g. "100 Points" or "50 Points").
               - "weight_percentage": Percentage of final grade (e.g. "20%" or "40%").
               - "full_instructions": Detailed description, grading criteria rubrics, submission instructions, and guidelines.

            3. WEEKS & READINGS (EVERY SINGLE CHAPTER / ARTICLE / MEDIA):
               - Group into weeks (week_number 1, 2, ... 16).
               - Extract all required textbooks (e.g. "Creswell & Creswell: Research Design"), articles, and video links.
               - "title": Full official exact title verbatim as written in the syllabus document without shortening or truncating.
               - "media_type": "textbook", "article", "video", or "podcast".
               - "summary_text": 2-sentence summary of the chapter/reading topic.
               - "key_takeaways_text": 2-3 bullet points ("• Concept 1\n• Concept 2").
               - "estimated_time_text": Estimated duration (e.g. "~45 min read").
               - "due_date": ISO date "YYYY-MM-DD" for that week.

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
                      "media_type": "textbook",
                      "summary_text": "Overview of research methodologies.",
                      "key_takeaways_text": "• Qualitative vs Quantitative\n• Ethical Considerations",
                      "estimated_time_text": "~45 min read",
                      "video_url": null,
                      "due_date": "2026-07-07"
                    }
                  ]
                }
              ],
              "assignments": [
                {
                  "id": "\(UUID().uuidString)",
                  "title": "Research Article Analysis",
                  "due_date": "2026-07-23",
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
}




