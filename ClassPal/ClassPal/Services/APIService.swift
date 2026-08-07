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
    public let dueDate: String?
    public let dateRangeStr: String?

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
}

public struct WeekDTO: Codable, Identifiable {
    public let id: String
    public let weekNumber: Int
    public let startDate: String?
    public let theme: String?
    public let dateRangeStr: String?
    public let readings: [ReadingDTO]?

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
}

public struct AssignmentDTO: Codable, Identifiable {
    public let id: String
    public let title: String
    public let dueDate: String?
    public let fullInstructions: String?
    public let pointsPossible: String?
    public let weightPercentage: String?
    public let noteText: String?

    enum CodingKeys: String, CodingKey {
        case id, title
        case dueDate = "due_date"
        case fullInstructions = "full_instructions"
        case pointsPossible = "points_possible"
        case weightPercentage = "weight_percentage"
        case noteText = "note_text"
    }

    public init(
        id: String,
        title: String,
        dueDate: String? = nil,
        fullInstructions: String? = nil,
        pointsPossible: String? = nil,
        weightPercentage: String? = nil,
        noteText: String? = nil
    ) {
        self.id = id
        self.title = title
        self.dueDate = dueDate
        self.fullInstructions = fullInstructions
        self.pointsPossible = pointsPossible
        self.weightPercentage = weightPercentage
        self.noteText = noteText
    }
}

public struct CourseDTO: Codable, Identifiable {
    public var id: String
    public var creatorId: String?
    public var courseName: String
    public var courseCode: String?
    public var termWeeks: Int?
    public let sharingCode: String
    public let weeks: [WeekDTO]?
    public let assignments: [AssignmentDTO]?

    enum CodingKeys: String, CodingKey {
        case id
        case creatorId = "creator_id"
        case courseName = "course_name"
        case courseCode = "course_code"
        case termWeeks = "term_weeks"
        case sharingCode = "sharing_code"
        case weeks, assignments
    }
}

@MainActor
public final class APIService: ObservableObject {
    public static let shared = APIService()
    
    @Published public var baseURL: String = "http://127.0.0.1:3088"
    public let currentUserId: UUID = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!

    private init() {}

    @Published public var geminiAPIKey: String = "AIzaSyD1RwSh5O9bp8q2Ch2Vi52l05r4ImQOPiE"
    @Published public var useLocalOnlyMode: Bool = false

    public func parseSyllabusText(_ rawText: String) async throws -> CourseDTO {
        if !useLocalOnlyMode, !geminiAPIKey.isEmpty {
            do {
                return try await parseSyllabusWithGemini(rawText)
            } catch {
                print("[APIService] Gemini Cloud AI failed or offline: \(error). Falling back to LocalSyllabusParser.")
            }
        }
        return LocalSyllabusParser.shared.parseText(rawText)
    }

    public func parseSyllabusWithGemini(_ rawText: String) async throws -> CourseDTO {
        let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=\(geminiAPIKey)"
        guard let url = URL(string: endpoint) else {
            throw URLError(.badURL)
        }

        let prompt = """
        You are an expert academic syllabus parser. Extract structured course data from the following syllabus.
        CRITICAL RULES:
        1. Reading titles MUST be short, clean titles between 5 to 6 words that are strictly appropriate to the topic of the reading/chapter.
        2. Point system and percentage system MUST be separate:
           - points_possible e.g. "100 Points"
           - weight_percentage e.g. "20%"
        3. Include exact course_name, course_code (e.g. "CPC 514"), term_weeks (integer), sharing_code.
        4. Group readings and assignments into weeks (week_number 1, 2, ...).
        5. Due dates must be in formatted strings like "Due Monday, July 6 · Week 1".

        Return ONLY valid JSON matching this exact structure:
        {
          "id": "\(UUID().uuidString)",
          "course_name": "Full Course Name",
          "course_code": "CPC 514",
          "term_weeks": 16,
          "sharing_code": "CPC514",
          "weeks": [
            {
              "id": "\(UUID().uuidString)",
              "week_number": 1,
              "date_range_str": "Jul 1 - Jul 7",
              "readings": [
                {
                  "id": "\(UUID().uuidString)",
                  "title": "Short title between 5 to 6 words",
                  "media_type": "textbook",
                  "due_date": "Due Monday, July 6 · Week 1"
                }
              ]
            }
          ],
          "assignments": [
            {
              "id": "\(UUID().uuidString)",
              "title": "Assignment Name",
              "due_date": "Due Sunday, July 12 · Week 2",
              "points_possible": "100 Points",
              "weight_percentage": "20%",
              "full_instructions": "Full assignment instructions"
            }
          ]
        }

        SYLLABUS CONTENT:
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
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        struct GeminiPart: Decodable {
            let text: String
        }
        struct GeminiContent: Decodable {
            let parts: [GeminiPart]
        }
        struct GeminiCandidate: Decodable {
            let content: GeminiContent
        }
        struct GeminiResponse: Decodable {
            let candidates: [GeminiCandidate]
        }

        let geminiResp = try JSONDecoder().decode(GeminiResponse.self, from: data)
        guard let jsonText = geminiResp.candidates.first?.content.parts.first?.text,
              let jsonBodyData = jsonText.data(using: .utf8) else {
            throw URLError(.cannotParseResponse)
        }

        return try JSONDecoder().decode(CourseDTO.self, from: jsonBodyData)
    }

    public func parseSyllabusImageData(_ imageData: Data) async throws -> CourseDTO {
        #if canImport(UIKit)
        if useLocalOnlyMode, let image = UIImage(data: imageData) {
            let extractedText = try await LocalSyllabusParser.shared.extractTextFromImage(image)
            return LocalSyllabusParser.shared.parseText(extractedText)
        }
        #endif

        guard let url = URL(string: "\(baseURL)/api/syllabi/parse") else {
            #if canImport(UIKit)
            if let image = UIImage(data: imageData) {
                let text = try await LocalSyllabusParser.shared.extractTextFromImage(image)
                return LocalSyllabusParser.shared.parseText(text)
            }
            #endif
            throw URLError(.badURL)
        }

        do {
            let boundary = "Boundary-\(UUID().uuidString)"
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 5
            request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

            var body = Data()

            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"userId\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(currentUserId.uuidString)\r\n".data(using: .utf8)!)

            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"syllabus\"; filename=\"scan.jpg\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
            body.append(imageData)
            body.append("\r\n".data(using: .utf8)!)
            body.append("--\(boundary)--\r\n".data(using: .utf8)!)

            request.httpBody = body

            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                #if canImport(UIKit)
                if let image = UIImage(data: imageData) {
                    let text = try await LocalSyllabusParser.shared.extractTextFromImage(image)
                    return LocalSyllabusParser.shared.parseText(text)
                }
                #endif
                throw URLError(.badServerResponse)
            }

            return try JSONDecoder().decode(CourseDTO.self, from: data)
        } catch {
            print("[APIService] Remote vision endpoint unreachable. Running 100% On-Device Apple Vision OCR.")
            #if canImport(UIKit)
            if let image = UIImage(data: imageData) {
                let text = try await LocalSyllabusParser.shared.extractTextFromImage(image)
                return LocalSyllabusParser.shared.parseText(text)
            }
            #endif
            throw error
        }
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




