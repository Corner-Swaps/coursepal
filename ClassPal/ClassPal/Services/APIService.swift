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
        dateRangeStr: String? = nil
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
    }

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
        relevantTopics: String? = nil
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
    }
}

public struct CourseDTO: Codable, Identifiable {
    public var id: String
    public var creatorId: String?
    public var courseName: String
    public var courseCode: String?
    public var termWeeks: Int?
    public var sharingCode: String
    public var weeks: [WeekDTO]?
    public var assignments: [AssignmentDTO]?
    public var items: [ItemDTO]?

    enum CodingKeys: String, CodingKey {
        case id
        case creatorId = "creator_id"
        case courseName = "course_name"
        case courseTitle = "course_title"
        case courseCode = "course_code"
        case termWeeks = "term_weeks"
        case sharingCode = "sharing_code"
        case weeks, assignments, items
    }

    public init(
        id: String = UUID().uuidString,
        creatorId: String? = nil,
        courseName: String,
        courseCode: String? = nil,
        termWeeks: Int? = nil,
        sharingCode: String,
        weeks: [WeekDTO]? = nil,
        assignments: [AssignmentDTO]? = nil,
        items: [ItemDTO]? = nil
    ) {
        self.id = id
        self.creatorId = creatorId
        self.courseName = courseName
        self.courseCode = courseCode
        self.termWeeks = termWeeks
        self.sharingCode = sharingCode
        self.weeks = weeks
        self.assignments = assignments
        self.items = items
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try container.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        self.creatorId = try container.decodeIfPresent(String.self, forKey: .creatorId) ?? "local-user"
        let nameInSchema = try container.decodeIfPresent(String.self, forKey: .courseName)
        let titleInSchema = try container.decodeIfPresent(String.self, forKey: .courseTitle)
        self.courseName = nameInSchema ?? titleInSchema ?? "Academic Course"
        self.courseCode = try container.decodeIfPresent(String.self, forKey: .courseCode)
        self.termWeeks = try container.decodeIfPresent(Int.self, forKey: .termWeeks) ?? 16
        self.sharingCode = (try container.decodeIfPresent(String.self, forKey: .sharingCode)) ?? String(format: "%06d", Int.random(in: 100000...999999))
        self.weeks = try container.decodeIfPresent([WeekDTO].self, forKey: .weeks)
        self.assignments = try container.decodeIfPresent([AssignmentDTO].self, forKey: .assignments)
        self.items = try container.decodeIfPresent([ItemDTO].self, forKey: .items)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(creatorId, forKey: .creatorId)
        try container.encode(courseName, forKey: .courseName)
        try container.encodeIfPresent(courseCode, forKey: .courseCode)
        try container.encodeIfPresent(termWeeks, forKey: .termWeeks)
        try container.encode(sharingCode, forKey: .sharingCode)
        try container.encodeIfPresent(weeks, forKey: .weeks)
        try container.encodeIfPresent(assignments, forKey: .assignments)
        try container.encodeIfPresent(items, forKey: .items)
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
    
    @Published public var baseURL: String = "http://127.0.0.1:3088"
    public let currentUserId: UUID = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!

    public static var bundledAPIKey: String {
        let encoded = "QVEuQWI4Uk42STZyUHVpbE9FeHZyb29rSFVPaTZiR0JaTTFMVlJJckd2TDRSOWVnTG9yLXc="
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
        if let stored = UserDefaults.standard.string(forKey: "gemini_api_key")?.trimmingCharacters(in: .whitespacesAndNewlines), !stored.isEmpty {
            return stored
        }
        if let localFile = try? String(contentsOfFile: "/Users/slava/Downloads/Projects/ClassPal/ClassPal/gemini_api_key.txt", encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines), !localFile.isEmpty {
            return localFile
        }
        if let env = ProcessInfo.processInfo.environment["GEMINI_API_KEY"]?.trimmingCharacters(in: .whitespacesAndNewlines), !env.isEmpty {
            return env
        }
        if let info = Bundle.main.infoDictionary?["GeminiAPIKey"] as? String, !info.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return info.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return Self.bundledAPIKey
    }

    private init() {
        let stored = UserDefaults.standard.string(forKey: "gemini_api_key") ?? ""
        if !stored.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            self.geminiAPIKey = stored
        } else if let localFile = try? String(contentsOfFile: "/Users/slava/Downloads/Projects/ClassPal/ClassPal/gemini_api_key.txt", encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines), !localFile.isEmpty {
            self.geminiAPIKey = localFile
            UserDefaults.standard.set(localFile, forKey: "gemini_api_key")
        } else {
            self.geminiAPIKey = Self.bundledAPIKey
            UserDefaults.standard.set(Self.bundledAPIKey, forKey: "gemini_api_key")
        }
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

        let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"
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
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(keyToUse, forHTTPHeaderField: "x-goog-api-key")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (_, response) = try await URLSession.shared.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode == 200
    }

    public func parsePDFDocumentData(_ pdfData: Data) async throws -> CourseDTO {
        let startTime = Date()
        guard NetworkMonitor.shared.isOnline else {
            throw NSError(
                domain: "APIService",
                code: 1009,
                userInfo: [NSLocalizedDescriptionKey: "API Error [1009]: Internet Connection Required. Please connect to the internet to process course documents."]
            )
        }
        let keyToUse = activeAPIKey
        print("[APIService] Processing Multimodal Base64 PDF with Gemini API...")
        let dto = try await parsePDFDataWithGemini(pdfData, apiKey: keyToUse)
        let elapsed = Date().timeIntervalSince(startTime)
        if elapsed < 5.0 {
            let remaining = 5.0 - elapsed
            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
        }
        return dto
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
        let modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite"]

        let prompt = """
        You are Course Pal's Senior AI Syllabus Processor. Thoroughly analyze the provided PDF file and extract all structured course data with 100% precision.

        AIRTIGHT EXTRACTION RULES FOR ALL FUTURE DOCUMENTS:
        1. "course_code": Official course catalog code (e.g. "CPC 514", "BIO 412", "LAW 702", "CS 501").
        2. "course_title": Full official course name (3 to 5 words maximum).
        3. "items": Array of ALL assignments, papers, exams, projects, presentations, labs, and readings found anywhere in the PDF.

           FIELD-BY-FIELD INSTRUCTIONS:
           - "title": Strictly 3 to 5 words maximum. Preserve official assignment titles verbatim from the PDF headers (e.g. "Peer Review Group Report", "Research Study Design", "Presentation Feedback").
           - "category": Strictly "Assignment" for tasks to be graded/submitted, or "Reading" for materials to review.
           - "sub_type":
             * "PAPER" for essays, reports, research papers, proposals, written reflections, case studies.
             * "PRESENTATION" for speeches, slide decks, group presentations, video recordings of presentations.
             * "IN_CLASS" for exams, quizzes, midterm, final exam, participation, in-class activities, peer review activities.
             * "TEXTBOOK" for textbook chapters, books, required reading assignments.
             * "ARTICLE" for research papers, journal articles, web readings.
             * "VIDEO" for video links, recorded lectures, or video requirements.
             * "PODCAST" for audio recordings or podcasts.
             * "OTHER" for miscellaneous items.
           - "description": Comprehensive extraction of task instructions, requirements, questions to answer, submission format, length, and guidelines directly from the PDF text. Do not truncate important details!
           - "points": Exact total points possible for the task as stated in the PDF (e.g. '100 Points', '50 Points', '25 Points'); null if missing.
           - "points_breakdown": STRICT ASSIGNMENT-TO-TABLE BINDING:
             Each assignment in a syllabus often has its OWN specific "Grading Criteria" / "Grade Points" table placed immediately under its description.
             You MUST attach each grading table ONLY to the EXACT assignment header it belongs to in the PDF text.
             Transcribe 100% of the rows of the matching table VERBATIM into 'points_breakdown', formatted as 'Criteria Title: XX Points', separated by '|'.
             DO NOT skip any row (e.g. do not omit Participation), nor alter point numbers.
             If no grading table/rubric exists in the PDF for an assignment, set strictly to null.
           - "percentage": Weight percentage of final grade (e.g. '20% of Final Grade' or '10%'); null if missing.
           - "week_number": Integer week number (1, 2, 3, ...) when the item is assigned or scheduled in the syllabus schedule.
           - "due_date_iso": ISO8601 timestamp string (YYYY-MM-DD) if an explicit due date is specified in the text (e.g. "Sunday, Sep. 13, 2026" -> '2026-09-13'); null if missing.
           - "media_url": Direct URL string if ANY link (http/https, YouTube link like https://youtube.com/... or https://youtu.be/..., or website link) is present in the document or item description; null if missing.

        Return ONLY valid JSON matching this schema.
        """

        let responseSchema: [String: Any] = [
            "type": "OBJECT",
            "properties": [
                "course_code": ["type": "STRING"],
                "course_title": ["type": "STRING"],
                "items": [
                    "type": "ARRAY",
                    "items": [
                        "type": "OBJECT",
                        "properties": [
                            "title": ["type": "STRING", "description": "Strictly 3 to 5 words maximum"],
                            "category": ["type": "STRING", "enum": ["Assignment", "Reading"]],
                            "sub_type": [
                                "type": "STRING",
                                "enum": ["TEXTBOOK", "ARTICLE", "VIDEO", "PODCAST", "IN_CLASS", "PAPER", "PRESENTATION", "OTHER"]
                            ],
                            "description": ["type": "STRING", "nullable": true],
                            "points": ["type": "STRING", "nullable": true],
                            "points_breakdown": ["type": "STRING", "nullable": true],
                            "percentage": ["type": "STRING", "nullable": true],
                            "week_number": ["type": "INTEGER"],
                            "due_date_iso": ["type": "STRING", "nullable": true],
                            "media_url": ["type": "STRING", "nullable": true]
                        ],
                        "required": ["title", "category", "sub_type", "week_number"]
                    ]
                ]
            ],
            "required": ["course_code", "course_title", "items"]
        ]

        var lastErrorMsg = ""
        var lastStatusCode = 500

        for modelName in modelsToTry {
            let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/\(modelName):generateContent"
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
                            ],
                            [
                                "text": prompt
                            ]
                        ]
                    ]
                ],
                "generationConfig": [
                    "temperature": 0.0,
                    "topK": 1,
                    "topP": 0.1,
                    "responseMimeType": "application/json",
                    "responseSchema": responseSchema
                ]
            ]

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 120
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(apiKey, forHTTPHeaderField: "x-goog-api-key")
            request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

            print("📦 [NETWORK] Outgoing Payload Size: \(base64String.count) bytes targeting \(modelName)")

            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                let httpStatus = (response as? HTTPURLResponse)?.statusCode ?? 0
                lastStatusCode = httpStatus
                let rawJSONString = String(data: data, encoding: .utf8) ?? ""
                print("📥 [API RESPONSE] Model \(modelName) HTTP Status \(httpStatus). Length: \(rawJSONString.count)")

                if httpStatus == 200 {
                    struct GeminiPart: Decodable { let text: String }
                    struct GeminiContent: Decodable { let parts: [GeminiPart] }
                    struct GeminiCandidate: Decodable { let content: GeminiContent }
                    struct GeminiResponse: Decodable { let candidates: [GeminiCandidate] }

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
                            let courseDTO = try Self.decodeCourseDTO(from: jsonBodyData)
                            print("✅ [APIService SUCCESS] Multimodal Base64 parsed strictly via Gemini model '\(modelName)'!")
                            return courseDTO
                        }
                    }
                } else {
                    lastErrorMsg = "API Error [\(httpStatus)]: Model '\(modelName)' returned HTTP status \(httpStatus)."
                    print("❌ [NETWORK WARNING] \(lastErrorMsg)")
                    continue
                }
            } catch {
                let nsErr = error as NSError
                lastStatusCode = nsErr.code
                lastErrorMsg = "API Error [\(nsErr.code)]: \(nsErr.localizedDescription)"
                print("❌ [NETWORK ERROR] \(lastErrorMsg)")
                continue
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
        let modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite"]
        var lastError: Error = URLError(.badServerResponse)

        print("📦 [NETWORK] Outgoing Payload Size: \(rawText.count) bytes")

        for modelName in modelsToTry {
            let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/\(modelName):generateContent"
            guard let url = URL(string: endpoint) else { continue }

            let prompt = """
            You are an elite academic syllabus AI engine. Thoroughly analyze the provided syllabus text or document and extract 100% of all courses, weeks, readings, textbooks, media, and assignments into a clean JSON structure.

            STRICT EXTRACTION RULES ("TRAINED AI PIPELINE"):
            1. COURSE DETAILS:
               - "course_name": Full title of the course (e.g. "Research Methods and Statistics").
               - "course_code": Catalog code (e.g. "CPC 514" or "CPC 523").
               - "term_weeks": Total number of weeks in term (integer, e.g. 16 or 12).
               - "sharing_code": Pure 6-digit numeric string (e.g. "849204").

            2. ASSIGNMENTS & GRADING CRITERIA:
               - Extract EVERY assignment listed under "Assignments", "Grading", or "Evaluation".
               - "title": Clean assignment title.
               - "due_date": ISO date format "YYYY-MM-DD" (e.g. "2026-07-23" or "2026-09-13"). Infer exact date from week schedule or course dates.
               - "points_possible": Total points or rubrics (e.g. "100 Points" or "50 Points").
               - "weight_percentage": Percentage of final grade (e.g. "20%" or "40%").
               - "full_instructions": Detailed description, grading criteria rubrics, submission instructions, and guidelines.
               - "points_breakdown": STRICT ASSIGNMENT-TO-TABLE BINDING:
                 Transcribe 100% of the rows of any grading criteria table for this assignment verbatim into 'points_breakdown', formatted as 'Criteria Title: XX Points', separated by '|' (e.g., "Analysis: 40 Points | Evidence: 30 Points | Formatting: 30 Points"). If no explicit rubric table is listed in the document for this assignment, set strictly to null.

            3. WEEKS & READINGS (EVERY SINGLE CHAPTER / ARTICLE / MEDIA):
               - Group into weeks (week_number 1, 2, ... 16).
               - Extract all required textbooks (e.g. "Creswell & Creswell: Research Design"), articles, and video links.
               - "title": Clean human-readable title (3 to 8 words).
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
                  "full_instructions": "Collaborate on a 45-60 minute presentation analyzing an approved article.",
                  "points_breakdown": "Analysis: 40 Points | Evidence: 30 Points | Formatting: 30 Points"
                }
              ]
            }

            SYLLABUS TEXT:
            \(rawText)
            """

            let payload: [String: Any] = [
                "contents": [
                    [
                        "parts": [
                            ["text": prompt]
                        ]
                    ]
                ],
                "generationConfig": [
                    "responseMimeType": "application/json",
                    "temperature": 0.1
                ]
            ]

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 90
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
                                    print("✅ [APIService SUCCESS] Successfully parsed syllabus via Gemini AI model (\(modelName))!")
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
        let modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite"]
        var lastError: Error = URLError(.badServerResponse)

        print("📦 [NETWORK] Outgoing Payload Size: \(base64String.count) bytes")

        for modelName in modelsToTry {
            let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/\(modelName):generateContent"
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
               - "title": Clean assignment title.
               - "due_date": ISO date format "YYYY-MM-DD" (e.g. "2026-07-23" or "2026-09-13"). Infer exact date from week schedule or course dates.
               - "points_possible": Total points or rubrics (e.g. "100 Points" or "50 Points").
               - "weight_percentage": Percentage of final grade (e.g. "20%" or "40%").
               - "full_instructions": Detailed description, grading criteria rubrics, submission instructions, and guidelines.

            3. WEEKS & READINGS (EVERY SINGLE CHAPTER / ARTICLE / MEDIA):
               - Group into weeks (week_number 1, 2, ... 16).
               - Extract all required textbooks (e.g. "Creswell & Creswell: Research Design"), articles, and video links.
               - "title": Clean human-readable title (3 to 8 words).
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
                    "temperature": 0.1
                ]
            ]

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 90
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




