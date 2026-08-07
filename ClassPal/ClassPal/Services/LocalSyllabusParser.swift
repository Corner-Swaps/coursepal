import Foundation
import Vision
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Semantic Classification Types

public enum SemanticItemType: String, Codable {
    case media      = "media"
    case reading    = "reading"
    case assignment = "assignment"
    case inClass    = "in_class"

    public var uiColorHex: String {
        switch self {
        case .media:      return "#8B5CF6"
        case .reading:    return "#3B82F6"
        case .assignment: return "#EF4444"
        case .inClass:    return "#10B981"
        }
    }

    public var sfSymbolName: String {
        switch self {
        case .media:      return "play.tv.fill"
        case .reading:    return "book.fill"
        case .assignment: return "doc.text.fill"
        case .inClass:    return "person.3.fill"
        }
    }
}

// MARK: - LocalSyllabusParser (Deterministic Multi-Pass Lexer & Parser Engine)

public final class LocalSyllabusParser {
    public static let shared = LocalSyllabusParser()
    private init() {}

    // MARK: - Vision OCR with Spatial Column Clustering
    #if canImport(UIKit)
    public func extractTextFromImage(_ image: UIImage) async throws -> String {
        guard let cgImage = image.cgImage else {
            throw NSError(domain: "LocalSyllabusParser", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Invalid image format."])
        }
        return try await withCheckedThrowingContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                if let error = error { continuation.resume(throwing: error); return }
                guard let obs = request.results as? [VNRecognizedTextObservation], !obs.isEmpty else {
                    continuation.resume(returning: ""); return
                }

                struct SpatialText {
                    let text: String
                    let boundingBox: CGRect
                    var midY: CGFloat { boundingBox.midY }
                    var minX: CGFloat { boundingBox.minX }
                }

                let items: [SpatialText] = obs.compactMap { ob in
                    guard let top = ob.topCandidates(1).first else { return nil }
                    return SpatialText(text: top.string, boundingBox: ob.boundingBox)
                }

                var rows: [[SpatialText]] = []
                let sortedByY = items.sorted(by: { $0.midY > $1.midY })

                for item in sortedByY {
                    if let rowIndex = rows.firstIndex(where: { row in
                        if let first = row.first {
                            return abs(first.midY - item.midY) < 0.018
                        }
                        return false
                    }) {
                        rows[rowIndex].append(item)
                    } else {
                        rows.append([item])
                    }
                }

                let formattedLines = rows.map { row in
                    let sortedRow = row.sorted(by: { $0.minX < $1.minX })
                    return sortedRow.map { $0.text }.joined(separator: " ")
                }

                let result = formattedLines.joined(separator: "\n")
                continuation.resume(returning: result)
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do { try handler.perform([request]) } catch { continuation.resume(throwing: error) }
        }
    }
    #endif

    // MARK: - Noise Boilerplate Markers
    private static let sectionBoilerplateMarkers: [String] = [
        "vision, mission, and values",
        "territorial acknowledgement",
        "course policies",
        "late assignments",
        "professional writing",
        "university policies",
        "non-discrimination",
        "sexual harassment",
        "religious accommodations",
        "academic integrity",
        "ai use policy",
        "support services",
        "disability services accommodations",
        "library services",
        "sensitive content notice",
        "grading scale",
        "grading rubrics",
        "emergency evacuation procedures",
        "campus safety info"
    ]

    private static let lineNoisePatterns: [String] = [
        "total 100%",
        "total 100 points",
        "grading criteria",
        "grade points",
        "exceeds standard",
        "at standard",
        "approaching standard",
        "below standard",
        "all written assignments must",
        "access to the internet",
        "apa style guide",
        "3 credits",
        "isbn:",
        "organization and coherence",
        "evidence and support",
        "critical analysis",
        "professional ethics",
        "cultural competence",
        "quality of presentation",
        "feedback on the strength",
        "feedback on the improvement",
        "analysis and use of course",
        "evaluating information",
        "self-reflection",
        "self reflection",
        "apa 10 points",
        "attendance 50 points",
        "participation 50 points",
        "submitted within",
        "if submitted within",
        "deducted if submitted",
        "late policy",
        "late submission",
        "deductions"
    ]

    // MARK: - Main Parsing Entry Point
    public func parseText(_ rawText: String) -> CourseDTO {
        let termYear = extractYear(from: rawText) ?? 2026

        // Pass 0: Multi-Pass Lexer - Reconstruct sentences split by PDF newline injection
        let reconstitutedLines = lexerReconstituteLines(rawText)

        // Pass 1: Extract Course Identity
        let (courseCode, courseName) = extractCourseIdentity(from: reconstitutedLines)

        // Pass 2: Points Heuristic Anchor & Assignment Parsing (Pass A)
        var assignments = extractAssignmentsWithPointsHeuristic(
            lines: reconstitutedLines,
            termYear: termYear,
            courseCode: courseCode
        )
        // print("Pass A Assignments: \(assignments.map { "\($0.title): date=\($0.dueDate ?? "nil")" })")

        // Pass 3: Weekly Schedule & Readings Parsing (Pass B)
        let (weeks, scheduleAssignments) = extractWeeklyScheduleAndReadings(
            lines: reconstitutedLines,
            termYear: termYear,
            courseName: courseName,
            courseCode: courseCode
        )

        // Merge schedule assignments deduplicated & enrich due dates / weights
        for sa in scheduleAssignments {
            if let idx = assignments.firstIndex(where: { fuzzyMatch($0.title, sa.title) }) {
                let existing = assignments[idx]
                let mergedDate = existing.dueDate ?? sa.dueDate
                let mergedWeight = existing.weightPercentage ?? sa.weightPercentage
                let mergedPts = (existing.pointsPossible != nil && existing.pointsPossible != "100 Points") ? existing.pointsPossible : sa.pointsPossible
                assignments[idx] = AssignmentDTO(
                    id: existing.id,
                    title: existing.title.count >= sa.title.count ? existing.title : sa.title,
                    dueDate: mergedDate,
                    fullInstructions: existing.fullInstructions,
                    pointsPossible: mergedPts,
                    weightPercentage: mergedWeight,
                    noteText: existing.noteText ?? sa.noteText
                )
            } else {
                assignments.append(sa)
            }
        }

        let paddedWeeks = padWeeks(weeks, courseName: courseName, courseCode: courseCode)
        let sharingCode = "\(courseCode.prefix(3).uppercased())-\(Int.random(in: 100...999))"

        // print("Final CourseDTO Assignments: \(assignments.map { "[\($0.title): date=\($0.dueDate ?? "nil"), weight=\($0.weightPercentage ?? "nil")]" })")

        return CourseDTO(
            id: "course-\(UUID().uuidString.prefix(8))",
            creatorId: "local-user",
            courseName: courseName,
            courseCode: courseCode,
            termWeeks: paddedWeeks.count,
            sharingCode: sharingCode,
            weeks: paddedWeeks,
            assignments: assignments
        )
    }

    // MARK: - PASS 0: Multi-Pass Lexer / Line Reconstitution
    public func lexerReconstituteLines(_ rawText: String) -> [String] {
        let rawLines = rawText.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        var reconstituted: [String] = []
        var buffer = ""

        for rawLine in rawLines {
            let line = rawLine
            // Strip total points noise prefix if followed by an assignment title
            if let range = line.range(of: #"(?i)^total\s*100\s*(points|pts|%)?\s*"#, options: .regularExpression) {
                let prefix = String(line[range])
                let remainder = String(line[range.upperBound...]).trimmingCharacters(in: .whitespaces)
                if !remainder.isEmpty {
                    if !buffer.isEmpty { reconstituted.append(buffer) }
                    reconstituted.append(prefix.trimmingCharacters(in: .whitespaces))
                    buffer = remainder
                    continue
                }
            }

            let lower = line.lowercased()
            let isHeader = lower.hasPrefix("week ") || lower.hasPrefix("chapter ") ||
                           lower.hasPrefix("ch. ") || lower.contains("syllabus") ||
                           lower.contains("course") || lower.contains("policy") ||
                           lower.contains("grading") || (line.contains(":") && line.count < 40) ||
                           line.contains("%") || line.contains("points") || lower.contains("due") ||
                           lower.contains("assignment") || lower.contains("report") || lower.contains("presentation") ||
                           line.hasPrefix("•") || line.hasPrefix("*") || line.hasPrefix("-")

            if buffer.isEmpty {
                buffer = line
            } else if isHeader {
                reconstituted.append(buffer)
                buffer = line
            } else {
                let lastChar = buffer.last
                if lastChar == "." || lastChar == ":" || lastChar == "!" || lastChar == "?" || lastChar == "%" {
                    reconstituted.append(buffer)
                    buffer = line
                } else {
                    buffer += " " + line
                }
            }
        }
        if !buffer.isEmpty {
            reconstituted.append(buffer)
        }

        return reconstituted
    }

    // MARK: - PASS 1: Points Heuristic Anchor & Assignment Extractor
    public func extractAssignmentsWithPointsHeuristic(
        lines: [String],
        termYear: Int,
        courseCode: String
    ) -> [AssignmentDTO] {
        var results: [AssignmentDTO] = []
        var lastMatchedIndex: Int? = nil

        let pointsRegex = try? NSRegularExpression(
            pattern: #"\b(\d{1,4})\s*(pts|points|pt|%|percent)"#,
            options: [.caseInsensitive]
        )

        let instructionPrefixes = ["this paper", "the video", "the deadline", "each week", "in small groups", "beginning in", "prepare an", "write an", "following our", "by the end", "in response", "guided by", "students will"]

        for (idx, line) in lines.enumerated() {
            let lower = line.trimmingCharacters(in: .whitespaces).lowercased()
            if isBoilerplatePolicyLine(lower) { continue }

            let isInstruction = instructionPrefixes.contains(where: { lower.hasPrefix($0) })
            let extractedDates = extractAllDates(from: line, fallbackYear: termYear)
            let primaryIsoDate = extractedDates.first?.isoString

            if isInstruction {
                if let date = primaryIsoDate, let targetIdx = lastMatchedIndex ?? (results.isEmpty ? nil : results.count - 1) {
                    if results[targetIdx].dueDate == nil {
                        let prev = results[targetIdx]
                        results[targetIdx] = AssignmentDTO(
                            id: prev.id,
                            title: prev.title,
                            dueDate: date,
                            fullInstructions: prev.fullInstructions,
                            pointsPossible: prev.pointsPossible,
                            weightPercentage: prev.weightPercentage,
                            noteText: prev.noteText
                        )
                    }
                }
                continue
            }

            let nsLine = line as NSString
            let range = NSRange(location: 0, length: nsLine.length)
            let matches = pointsRegex?.matches(in: line, options: [], range: range) ?? []
            let isAssignKeyword = lower.contains("assignment") || lower.contains("paper") || lower.contains("report") || lower.contains("presentation") || lower.contains("project")

            if !matches.isEmpty || isAssignKeyword {
                var weightStr: String? = nil
                var pointsStr = "100 Points"

                let percentMatches = (try? NSRegularExpression(pattern: #"\b(\d{1,3})%"#, options: []))?.matches(in: line, options: [], range: range) ?? []
                let ptsMatches = (try? NSRegularExpression(pattern: #"\b(\d{1,4})\s*(pts|points|pt\b)"#, options: [.caseInsensitive]))?.matches(in: line, options: [], range: range) ?? []

                if !percentMatches.isEmpty {
                    weightStr = nsLine.substring(with: percentMatches.first!.range)
                }
                if !ptsMatches.isEmpty {
                    pointsStr = nsLine.substring(with: ptsMatches.first!.range)
                }

                var finalDate = primaryIsoDate
                if finalDate == nil && idx + 1 < lines.count {
                    let nextL = lines[idx + 1]
                    let nextLower = nextL.trimmingCharacters(in: .whitespaces).lowercased()
                    let isNextHeader = nextLower.hasPrefix("week ") || nextLower.hasPrefix("chapter ") || nextLower.contains("policy") || nextLower.contains("rubric")
                    if !isNextHeader {
                        finalDate = extractAllDates(from: nextL, fallbackYear: termYear).first?.isoString
                    }
                }

                let videoUrl = extractVideoUrl(from: line)
                let cleanTitle = buildStrict3To5WordTitle(from: line, removePoints: true, removeDates: true)
                let tag = classifySemanticCategory(title: line, points: weightStr ?? pointsStr, url: videoUrl)

                if (tag == .assignment || tag == .inClass) && cleanTitle.count >= 3 {
                    let instructions = videoUrl != nil ? "Link: \(videoUrl!)" : "Parsed from syllabus."

                    // Check explicit assignment number tag e.g. (assignment 4) or (4)
                    var matchedIdx: Int? = nil
                    let numPattern = #"(?i)\(?assignment\s*(\d{1,2})\)?"#
                    if let regex = try? NSRegularExpression(pattern: numPattern),
                       let match = regex.firstMatch(in: line, options: [], range: range),
                       let numRange = Range(match.range(at: 1), in: line),
                       let num = Int(line[numRange]), num >= 1 && num <= results.count {
                        matchedIdx = num - 1
                    }

                    if matchedIdx == nil {
                        matchedIdx = results.firstIndex(where: { fuzzyMatch($0.title, cleanTitle) })
                    }

                    if let existingIdx = matchedIdx {
                        lastMatchedIndex = existingIdx
                        let existing = results[existingIdx]
                        let mergedDate = finalDate ?? existing.dueDate
                        let mergedWeight = existing.weightPercentage ?? weightStr
                        let mergedPts = (existing.pointsPossible != nil && existing.pointsPossible != "100 Points") ? existing.pointsPossible : pointsStr
                        results[existingIdx] = AssignmentDTO(
                            id: existing.id,
                            title: existing.title.count >= cleanTitle.count ? existing.title : cleanTitle,
                            dueDate: mergedDate,
                            fullInstructions: existing.fullInstructions,
                            pointsPossible: mergedPts,
                            weightPercentage: mergedWeight,
                            noteText: existing.noteText ?? videoUrl
                        )
                    } else {
                        let dto = AssignmentDTO(
                            id: "assign-\(UUID().uuidString.prefix(8))",
                            title: cleanTitle,
                            dueDate: finalDate,
                            fullInstructions: instructions,
                            pointsPossible: pointsStr,
                            weightPercentage: weightStr,
                            noteText: videoUrl
                        )
                        results.append(dto)
                        lastMatchedIndex = results.count - 1
                    }
                }
            }
        }

        // print("Pass A Return: \(results.map { "\($0.title): date=\($0.dueDate ?? "nil")" })")
        return results
    }

    // MARK: - PASS 3: Weekly Schedule & Readings Extractor
    public func extractWeeklyScheduleAndReadings(
        lines: [String],
        termYear: Int,
        courseName: String,
        courseCode: String
    ) -> (weeks: [WeekDTO], scheduleAssignments: [AssignmentDTO]) {
        var weeks: [WeekDTO] = []
        var scheduleAssignments: [AssignmentDTO] = []

        var currentWeekNum = 1
        var currentReadings: [ReadingDTO] = []
        var currentWeekTheme = "Week 1 Schedule"
        var currentWeekDateRange: String? = nil

        let weekHeaderPatterns = [
            #"(?i)^\s*week\s*(\d{1,2})\b"#,
            #"(?i)^\s*(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b"#
        ]

        for line in lines {
            let lower = line.trimmingCharacters(in: .whitespaces).lowercased()
            if isBoilerplatePolicyLine(lower) { continue }
            let instructionPrefixes = ["this paper", "the video", "the deadline", "each week", "in small groups", "beginning in", "prepare an", "write an", "following our", "by the end", "in response", "guided by", "students will"]
            if instructionPrefixes.contains(where: { lower.hasPrefix($0) }) { continue }

            let nsLine = line as NSString
            let range = NSRange(location: 0, length: nsLine.length)

            var foundWeekNum: Int? = nil
            for pattern in weekHeaderPatterns {
                if let regex = try? NSRegularExpression(pattern: pattern, options: []),
                   let match = regex.firstMatch(in: line, options: [], range: range) {
                    if let wRange = Range(match.range(at: 1), in: line), let wNum = Int(line[wRange]) {
                        foundWeekNum = wNum
                        break
                    }
                }
            }

            if let wNum = foundWeekNum {
                if !currentReadings.isEmpty || currentWeekNum != wNum {
                    let weekDTO = WeekDTO(
                        id: "week-\(currentWeekNum)",
                        weekNumber: currentWeekNum,
                        startDate: nil,
                        theme: currentWeekTheme,
                        dateRangeStr: currentWeekDateRange,
                        readings: currentReadings
                    )
                    weeks.append(weekDTO)
                    currentReadings = []
                }

                currentWeekNum = wNum
                currentWeekTheme = "Week \(wNum)"
                let dates = extractAllDates(from: line, fallbackYear: termYear)
                if let d = dates.first { currentWeekDateRange = d.displayString }
                continue
            }

            let videoUrl = extractVideoUrl(from: line)
            let pointsMatches = (try? NSRegularExpression(pattern: #"\b(\d{1,4})\s*(pts|points|pt|%)"#, options: [.caseInsensitive]))?.matches(in: line, options: [], range: range) ?? []
            let hasPoints = !pointsMatches.isEmpty

            let tag = classifySemanticCategory(title: line, points: hasPoints ? "Points" : nil, url: videoUrl)
            let dates = extractAllDates(from: line, fallbackYear: termYear)
            let defaultWeekDateIso: String = {
                let weekDate = WeekDateConverter.date(forWeek: currentWeekNum)
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withFullDate]
                return formatter.string(from: weekDate)
            }()
            let isoDate = dates.first?.isoString ?? defaultWeekDateIso

            let cleanTitle = buildStrict5To6WordTitle(from: line, removePoints: true, removeDates: true)

            switch tag {
            case .reading, .media:
                let validUrl = URLHelper.isValidURL(videoUrl) ? videoUrl : nil
                let mediaTypeStr = (validUrl != nil) ? "video" : "textbook"
                let summary = "Required reading for \(cleanTitle)."
                let readingDTO = ReadingDTO(
                    id: "read-\(UUID().uuidString.prefix(8))",
                    title: cleanTitle,
                    mediaType: mediaTypeStr,
                    isCompleted: false,
                    summaryText: summary,
                    keyTakeawaysText: "• Review \(cleanTitle)",
                    estimatedTimeText: tag == .media ? "~20–30 min" : "~40–60 min",
                    videoUrl: validUrl,
                    dueDate: isoDate,
                    dateRangeStr: currentWeekDateRange
                )
                if !currentReadings.contains(where: { $0.title.lowercased() == cleanTitle.lowercased() }) {
                    currentReadings.append(readingDTO)
                }

            case .assignment, .inClass:
                let percentMatches = (try? NSRegularExpression(pattern: #"\b(\d{1,3})%"#, options: []))?.matches(in: line, options: [], range: range) ?? []
                let ptsMatches = (try? NSRegularExpression(pattern: #"\b(\d{1,4})\s*(pts|points|pt\b)"#, options: [.caseInsensitive]))?.matches(in: line, options: [], range: range) ?? []

                let pointsStr = !ptsMatches.isEmpty ? nsLine.substring(with: ptsMatches.first!.range) : "100 Points"
                let weightStr = !percentMatches.isEmpty ? nsLine.substring(with: percentMatches.first!.range) : nil

                let assignDTO = AssignmentDTO(
                    id: "assign-\(UUID().uuidString.prefix(8))",
                    title: cleanTitle,
                    dueDate: isoDate,
                    fullInstructions: videoUrl != nil ? "Link: \(videoUrl!)" : "Week \(currentWeekNum) Task",
                    pointsPossible: pointsStr,
                    weightPercentage: weightStr,
                    noteText: videoUrl
                )
                scheduleAssignments.append(assignDTO)

            case .noise:
                break
            }
        }

        if !currentReadings.isEmpty || weeks.isEmpty {
            let weekDTO = WeekDTO(
                id: "week-\(currentWeekNum)",
                weekNumber: currentWeekNum,
                startDate: nil,
                theme: currentWeekTheme,
                dateRangeStr: currentWeekDateRange,
                readings: currentReadings
            )
            weeks.append(weekDTO)
        }

        return (weeks, scheduleAssignments)
    }

    // MARK: - MODULE 2: SEMANTIC CLASSIFICATION (The Tagger)
    public enum SemanticItemType {
        case assignment
        case reading
        case media
        case inClass
        case noise
    }

    public func classifySemanticCategory(title: String, points: String?, url: String?) -> SemanticItemType {
        let t = title.lowercased()

        // 0. Noise / Policy Filter Check (Overrides accidental points/date matches)
        let noiseKeywords = [
            "territorial", "coast salish", "late submission", "late assignments", "deduction",
            "traffic-light", "ai use policy", "sensitive content", "apa style", "academic integrity",
            "disability services", "non-discrimination", "title ix", "total 100%", "total 100 points",
            "overview of required", "grading scale", "creswell", "course resources", "isbn:",
            "school of", "social sciences", "vision", "mission", "values", "faculty", "email:",
            "access to the internet", "microsoft-word", "library's", "effective date", "course dates",
            "primary faculty", "counselling program", "psychological practitioners", "vanwdy", "credits"
        ]
        for noise in noiseKeywords {
            if t.contains(noise) { return .noise }
        }

        // 1. Points Anchor or Percentage
        if points != nil || t.contains("pts") || t.contains("points") || t.contains("%") {
            return .assignment
        }

        // 2. In-Class
        let isInClassKeyword = t.contains("guest speaker") || t.contains("in class") || t.contains("activity")
        if isInClassKeyword {
            return .inClass
        }

        // 3. Explicit Assignment Title (Paper 1, Research Proposal, Midterm, Final Exam, Quiz 1, Assignment 1)
        let isExplicitAssignment = t.contains("assignment 1") || t.contains("assignment 2") || t.contains("assignment 3") ||
                                   t.contains("assignment 4") || t.contains("assignment 5") || t.contains("midterm") ||
                                   t.contains("final exam") || t.contains("research proposal") || t.contains("ethics paper") ||
                                   t.contains("final presentation") || t.contains("quiz")
        if isExplicitAssignment {
            return .assignment
        }

        // 4. Media / Watching (Watch, TED, YouTube, Podcast, Video, or URL present)
        let isMediaKeyword = t.contains("watch") || t.contains("ted") || t.contains("youtube") ||
                             t.contains("podcast") || t.contains("vimeo") || url != nil
        if isMediaKeyword {
            return .media
        }

        // 5. Reading Keywords (Chapter, Ch., Read, Textbook, Pages, Article)
        let isReadingKeyword = t.contains("chapter") || t.contains("ch.") || t.contains("read ") ||
                               t.contains("reading") || t.contains("textbook") || t.contains("pages") ||
                               t.contains("pp.") || t.contains("article") || t.contains("book") ||
                               t.contains("journal") || t.contains("isbn:")
        if isReadingKeyword {
            return .reading
        }

        // 6. Non-essential fluff / policy text -> Noise
        return .noise
    }

    // MARK: - TITLE SUMMARIZATION ENGINE (Strict 5–6 Words Format)
    public func buildStrict3To5WordTitle(from text: String, removePoints: Bool = true, removeDates: Bool = true) -> String {
        return buildStrict5To6WordTitle(from: text, removePoints: removePoints, removeDates: removeDates)
    }

    public func buildStrict5To6WordTitle(from text: String, removePoints: Bool = true, removeDates: Bool = true) -> String {
        var clean = text

        // Strip dates
        clean = clean.replacingOccurrences(of: #"(?i)\bdue\s+.*$"#, with: "", options: .regularExpression)
        clean = clean.replacingOccurrences(of: #"(?i)\bsubmitted\s+by\s+.*$"#, with: "", options: .regularExpression)
        clean = clean.replacingOccurrences(of: #"(?i)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(st|nd|rd|th)?(,\s*\d{4})?"#, with: "", options: .regularExpression)
        clean = clean.replacingOccurrences(of: #"\b\d{1,2}/\d{1,2}(/\d{2,4})?\b"#, with: "", options: .regularExpression)

        // Strip points & weights
        if removePoints {
            clean = clean.replacingOccurrences(of: #"\b\d{1,4}\s*(pts|points|pt|%|percent)"#, with: "", options: [.regularExpression, .caseInsensitive])
        }

        // Strip prefixes and suffixes: "Chapter 1 —", "Ch. 1:", "Assignment 1:", "(assignment 1)", "Week 1"
        clean = clean.replacingOccurrences(of: #"(?i)^chapter\s*\d+([\s&,\-–]+\d+)?\s*[\:\—\-]?\s*"#, with: "", options: .regularExpression)
        clean = clean.replacingOccurrences(of: #"(?i)^ch\.\s*\d+([\s&,\-–]+\d+)?\s*[\:\—\-]?\s*"#, with: "", options: .regularExpression)
        clean = clean.replacingOccurrences(of: #"(?i)\(?assignment\s*\d+\)?"#, with: "", options: .regularExpression)
        clean = clean.replacingOccurrences(of: #"(?i)^week\s*\d+\s*[\:\—\-]?\s*"#, with: "", options: .regularExpression)

        // Strip trailing numbers like " 1", " 2", " 3"
        clean = clean.replacingOccurrences(of: #"\s+\d+$"#, with: "", options: .regularExpression)

        // Strip punctuation symbols
        clean = clean.replacingOccurrences(of: #"[^\w\s]"#, with: " ", options: .regularExpression)
        let words = clean.components(separatedBy: .whitespacesAndNewlines)
            .map { $0.trimmingCharacters(in: .punctuationCharacters) }
            .filter { !$0.isEmpty }

        let stopWords: Set<String> = ["a", "an", "the", "on", "by", "for", "of", "and", "in", "to", "with", "at", "is", "are", "or"]
        var meaningfulWords = words.filter { !stopWords.contains($0.lowercased()) && Int($0) == nil }
        if meaningfulWords.isEmpty { meaningfulWords = words }

        if meaningfulWords.count > 5 {
            meaningfulWords = Array(meaningfulWords.prefix(5))
        }

        let result = meaningfulWords.map { $0.capitalized }.joined(separator: " ")
        return result.isEmpty ? "Assignment" : result
    }

    // MARK: - VIDEO URL EXTRACTOR
    public func extractVideoUrl(from text: String) -> String? {
        let pattern = #"(https?://[^\s]+|www\.[^\s]+|(youtube\.com|youtu\.be|ted\.com|vimeo\.com|podcasts\.apple\.com)[^\s]*)"#
        if let range = text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) {
            var url = String(text[range])
            if !url.lowercased().hasPrefix("http") {
                url = "https://" + url
            }
            return url
        }
        return nil
    }

    // MARK: - MULTI-DATE EXTRACTION & ISO8601 NORMALIZATION
    public struct ExtractedDateInfo {
        public let displayString: String
        public let isoString: String
        public let date: Date
    }

    public func extractAllDates(from text: String, fallbackYear: Int = 2026) -> [ExtractedDateInfo] {
        var results: [ExtractedDateInfo] = []

        let patterns = [
            #"(?i)\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b"#,
            #"\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b"#,
            #"\b(\d{1,2})[-/](\d{1,2})\b"#
        ]

        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { continue }
            let nsText = text as NSString
            let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: nsText.length))

            for match in matches {
                let endLoc = match.range.location + match.range.length
                let remainingLen = min(15, nsText.length - endLoc)
                if remainingLen > 0 {
                    let trailingStr = nsText.substring(with: NSRange(location: endLoc, length: remainingLen)).lowercased()
                    if trailingStr.hasPrefix(" page") || trailingStr.hasPrefix("page") ||
                        trailingStr.hasPrefix(" pg") || trailingStr.hasPrefix(" word") ||
                        trailingStr.hasPrefix(" pt") || trailingStr.hasPrefix(" point") {
                        continue
                    }
                }
                let matchStr = nsText.substring(with: match.range)
                let parsed = LocalSyllabusParser.parseISO8601Date(from: matchStr, fallbackYear: fallbackYear)
                if !results.contains(where: { $0.isoString == parsed.isoString }) {
                    results.append(parsed)
                }
            }
        }

        return results
    }

    public static func parseISO8601Date(from dateStr: String, fallbackYear: Int = 2026) -> ExtractedDateInfo {
        let calendar = Calendar.current
        var components = DateComponents()
        components.year = fallbackYear
        components.hour = 23
        components.minute = 59
        components.second = 59

        // 1. First check for MM/DD/YYYY or MM/DD format explicitly (e.g., "03/15/2026", "11/05")
        let numericPattern = #"^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$"#
        if let regex = try? NSRegularExpression(pattern: numericPattern),
           let match = regex.firstMatch(in: dateStr.trimmingCharacters(in: .whitespaces), options: [], range: NSRange(location: 0, length: dateStr.utf16.count)) {
            let nsStr = dateStr as NSString
            if let m = Int(nsStr.substring(with: match.range(at: 1))),
               let d = Int(nsStr.substring(with: match.range(at: 2))) {
                components.month = m
                components.day = d
                if match.range(at: 3).location != NSNotFound, let y = Int(nsStr.substring(with: match.range(at: 3))) {
                    components.year = y < 100 ? 2000 + y : y
                }
            }
        } else {
            // 2. Parse text months (e.g., "Oct 24, 2026", "Sep. 6, 2026")
            let monthsMap = [
                "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
                "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
                "aug": 8, "august": 8, "sep": 9, "september": 9, "oct": 10, "october": 10,
                "nov": 11, "november": 11, "dec": 12, "december": 12
            ]

            var cleanStr = dateStr.lowercased().replacingOccurrences(of: ",", with: "")
            cleanStr = cleanStr.replacingOccurrences(of: #"(\d{1,2})(st|nd|rd|th)\b"#, with: "$1", options: .regularExpression)
            cleanStr = cleanStr.replacingOccurrences(of: #"\b\d{1,2}(:\d{2})?\s*(am|pm)\b"#, with: "", options: .regularExpression)

            let tokens = cleanStr.components(separatedBy: CharacterSet.whitespacesAndNewlines.union(.punctuationCharacters)).filter { !$0.isEmpty }

            for token in tokens {
                if let monthNum = monthsMap[token] {
                    components.month = monthNum
                } else if let num = Int(token) {
                    if num > 1000 {
                        components.year = num
                    } else if num >= 1 && num <= 31 && components.day == nil {
                        components.day = num
                    }
                }
            }
        }

        if components.month == nil { components.month = 7 }
        if components.day == nil { components.day = 15 }

        let date = calendar.date(from: components) ?? Date()

        // Standardized ISO8601 Formatter (YYYY-MM-DD)
        let dfShort = DateFormatter()
        dfShort.dateFormat = "yyyy-MM-dd"
        dfShort.timeZone = TimeZone.current
        let isoStr = dfShort.string(from: date)

        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "MMM d, yyyy"
        let displayStr = displayFormatter.string(from: date)

        return ExtractedDateInfo(displayString: displayStr, isoString: isoStr, date: date)
    }

    // MARK: - Helper Methods
    private func extractYear(from text: String) -> Int? {
        let pattern = #"\b(202[4-9]|203[0-5])\b"#
        if let range = text.range(of: pattern, options: .regularExpression), let year = Int(text[range]) {
            return year
        }
        return nil
    }

    private func extractCourseIdentity(from lines: [String]) -> (code: String, name: String) {
        let cleanLines = lines.prefix(40).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }

        let standaloneCodeRegex = try? NSRegularExpression(pattern: #"\b([A-Z]{2,6}\s*\d{3,4}[A-Z]?)\b"#, options: [])
        let codeWithTitleRegex = try? NSRegularExpression(pattern: #"([A-Z]{2,6}\s*\d{3,4}[A-Z]?)\s*[:\-–—]?\s*(.+)"#, options: [])

        var foundCode: String? = nil
        var foundName: String? = nil

        for (idx, line) in cleanLines.enumerated() {
            let nsLine = line as NSString
            let range = NSRange(location: 0, length: nsLine.length)

            // Stage 1: Line with Code + Title e.g. "CPC 514: Research Methods and Statistics"
            if let match = codeWithTitleRegex?.firstMatch(in: line, options: [], range: range) {
                if let cRange = Range(match.range(at: 1), in: line) {
                    let rawCode = String(line[cRange]).trimmingCharacters(in: .whitespaces).uppercased()
                    let normalizedCode = rawCode.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
                    if let nRange = Range(match.range(at: 2), in: line) {
                        let rawName = String(line[nRange]).trimmingCharacters(in: .whitespaces)
                        let cleanName = rawName.replacingOccurrences(of: #"(?i)^\s*(syllabus|course|class|outline|fall|spring|summer|winter|202[0-9])\s*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespaces)
                        let formattedName = buildStrict3To5WordTitle(from: cleanName.isEmpty ? rawName : cleanName, removePoints: true, removeDates: true)
                        if !normalizedCode.isEmpty && !formattedName.isEmpty && formattedName.lowercased() != "syllabus" {
                            return (normalizedCode, formattedName)
                        }
                    }
                    foundCode = normalizedCode
                }
            }

            // Stage 2: Standalone Code e.g. "CPC 514" on line by itself
            if foundCode == nil, let match = standaloneCodeRegex?.firstMatch(in: line, options: [], range: range) {
                let rawCode = nsLine.substring(with: match.range).trimmingCharacters(in: .whitespaces).uppercased()
                let normalizedCode = rawCode.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
                foundCode = normalizedCode

                // Check next line for title
                if idx + 1 < cleanLines.count {
                    let nextLine = cleanLines[idx + 1]
                    let cleanNext = nextLine.replacingOccurrences(of: #"(?i)^\s*(syllabus|course|class|outline|fall|spring|summer|winter|202[0-9])\s*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespaces)
                    if !cleanNext.isEmpty && cleanNext.count >= 3 && !cleanNext.contains("School") && !cleanNext.contains("Credits") {
                        foundName = buildStrict3To5WordTitle(from: cleanNext, removePoints: true, removeDates: true)
                    }
                }
            }

            if let code = foundCode, let name = foundName, !name.isEmpty {
                return (code, name)
            }
        }

        if let code = foundCode {
            // Check lines 1..15 for candidate course title
            for line in cleanLines.prefix(15) {
                if line.uppercased().contains(code) { continue }
                let lower = line.lowercased()
                if lower.contains("syllabus") || lower.contains("credits") || lower.contains("school") || lower.contains("faculty") || lower.contains("email") { continue }
                let candidate = buildStrict3To5WordTitle(from: line, removePoints: true, removeDates: true)
                if candidate.count >= 4 {
                    return (code, candidate)
                }
            }
            return (code, "Course Syllabus")
        }

        return ("CRS-101", "Academic Course")
    }

    private func isBoilerplatePolicyLine(_ lowerLine: String) -> Bool {
        for marker in Self.sectionBoilerplateMarkers {
            if lowerLine.contains(marker) { return true }
        }
        for pattern in Self.lineNoisePatterns {
            if lowerLine.contains(pattern) { return true }
        }
        return false
    }

    private func padWeeks(_ weeks: [WeekDTO], courseName: String, courseCode: String) -> [WeekDTO] {
        var existingMap: [Int: WeekDTO] = [:]
        for w in weeks { existingMap[w.weekNumber] = w }
        var result: [WeekDTO] = []
        let total = max(16, weeks.map { $0.weekNumber }.max() ?? 16)

        for w in 1...total {
            if let existing = existingMap[w] {
                result.append(existing)
            } else {
                result.append(WeekDTO(
                    id: "week-\(w)",
                    weekNumber: w,
                    startDate: nil,
                    theme: "Week \(w) Schedule",
                    dateRangeStr: nil,
                    readings: []
                ))
            }
        }
        return result
    }

    private func fuzzyMatch(_ s1: String, _ s2: String) -> Bool {
        let clean1 = s1.lowercased().replacingOccurrences(of: "[^a-z]", with: "", options: .regularExpression)
        let clean2 = s2.lowercased().replacingOccurrences(of: "[^a-z]", with: "", options: .regularExpression)
        if clean1.isEmpty || clean2.isEmpty { return false }
        if clean1 == clean2 { return true }
        if clean1.count >= 6 && clean2.contains(clean1) { return true }
        if clean2.count >= 6 && clean1.contains(clean2) { return true }

        let words1 = s1.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { $0.count >= 3 }
        let words2 = s2.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { $0.count >= 3 }
        if words1.count >= 2 && words2.count >= 2 {
            let set1 = Set(words1)
            let set2 = Set(words2)
            let intersection = set1.intersection(set2)
            let union = set1.union(set2)
            if !union.isEmpty {
                let jaccard = Double(intersection.count) / Double(union.count)
                if jaccard >= 0.70 { return true }
            }
        }
        return false
    }
}
