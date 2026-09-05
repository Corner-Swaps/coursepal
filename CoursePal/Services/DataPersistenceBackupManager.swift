import Foundation
import SwiftData

/// Complete backup snapshot data model representing the entire user state.
public struct AppDataSnapshot: Codable {
    public var version: Int = 1
    public var exportDate: Date = Date()
    public var courses: [CourseBackupRecord]
    public var vaultDocuments: [VaultDocBackupRecord]
    
    public init(courses: [CourseBackupRecord], vaultDocuments: [VaultDocBackupRecord]) {
        self.courses = courses
        self.vaultDocuments = vaultDocuments
    }
}

public struct CourseBackupRecord: Codable {
    public var id: String
    public var creatorId: String
    public var courseName: String
    public var courseCode: String?
    public var courseDescription: String?
    public var instructorName: String?
    public var instructorEmail: String?
    public var hexColor: String
    public var termWeeks: Int
    public var sharingCode: String
    public var isDeleted: Bool
    public var isFavorite: Bool
    public var chatHistoryJSON: String?
    public var createdAt: Date
    public var weeks: [WeekBackupRecord]
    public var assignments: [AssignmentBackupRecord]
    public var syllabusDocs: [SyllabusDocBackupRecord]
}

public struct WeekBackupRecord: Codable {
    public var id: String
    public var weekNumber: Int
    public var startDate: Date?
    public var theme: String?
    public var dateRangeStr: String?
    public var readings: [ReadingBackupRecord]
}

public struct ReadingBackupRecord: Codable {
    public var id: String
    public var title: String
    public var authorName: String?
    public var resourceTitle: String?
    public var mediaTypeRaw: String
    public var isCompleted: Bool
    public var isDeleted: Bool
    public var isFavorite: Bool
    public var summaryText: String
    public var keyTakeawaysText: String
    public var estimatedTimeText: String
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
}

public struct AssignmentBackupRecord: Codable {
    public var id: String
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
    public var isFavorite: Bool
    public var courseCode: String?
    public var weightPercentage: String?
    public var subTypeRaw: String?
    public var mediaUrl: String?
    public var relevantTopics: String?
    public var sourceDocumentName: String?
    public var docColorHex: String?
}

public struct SyllabusDocBackupRecord: Codable {
    public var id: String
    public var docTitle: String
    public var officeHoursText: String?
    public var instructorContact: String?
    public var gradingPolicyText: String?
    public var fileName: String?
    public var uploadedAt: Date
    public var courseCode: String?
    public var docColorHex: String?
}

public struct VaultDocBackupRecord: Codable {
    public var id: String
    public var title: String
    public var category: String
    public var fileSize: String
    public var fileType: String
    public var courseCode: String?
    public var fileContent: String?
    public var docColorHex: String?
    public var uploadedAt: Date
}

@MainActor
public final class DataPersistenceBackupManager {
    public static let shared = DataPersistenceBackupManager()

    private let backupFileName = "CoursePal_AutoBackup.json"
    private let previousBackupFileName = "CoursePal_AutoBackup_Previous.json"

    private var backupDirectory: URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        if !FileManager.default.fileExists(atPath: appSupport.path) {
            try? FileManager.default.createDirectory(at: appSupport, withIntermediateDirectories: true)
        }
        return appSupport
    }

    private var backupURL: URL {
        backupDirectory.appendingPathComponent(backupFileName)
    }

    private var previousBackupURL: URL {
        backupDirectory.appendingPathComponent(previousBackupFileName)
    }

    private init() {}

    // MARK: - Pre-Migration SQLite Physical Snapshot
    public static func createPreMigrationStoreSnapshot() {
        let fileManager = FileManager.default
        guard let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return }

        let storeURL = appSupport.appendingPathComponent("default.store")
        guard fileManager.fileExists(atPath: storeURL.path) else { return }

        let snapshotURL = appSupport.appendingPathComponent("default.store.pre_update_bak")
        try? fileManager.removeItem(at: snapshotURL)
        try? fileManager.copyItem(at: storeURL, to: snapshotURL)

        for ext in ["shm", "wal"] {
            let src = storeURL.appendingPathExtension(ext)
            let dst = snapshotURL.appendingPathExtension(ext)
            if fileManager.fileExists(atPath: src.path) {
                try? fileManager.removeItem(at: dst)
                try? fileManager.copyItem(at: src, to: dst)
            }
        }
        print("🛡️ [Persistence Manager] Successfully created pre-migration SQLite backup snapshot.")
    }

    // MARK: - Safe Disaster Recovery Store Reset
    public static func archiveCorruptedStoreFiles() {
        let fileManager = FileManager.default
        guard let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return }

        let storeURL = appSupport.appendingPathComponent("default.store")
        let timestamp = Int(Date().timeIntervalSince1970)
        let archiveURL = appSupport.appendingPathComponent("default.store.corrupted_\(timestamp)")

        if fileManager.fileExists(atPath: storeURL.path) {
            try? fileManager.moveItem(at: storeURL, to: archiveURL)
        }

        for ext in ["shm", "wal"] {
            let src = storeURL.appendingPathExtension(ext)
            let dst = archiveURL.appendingPathExtension(ext)
            if fileManager.fileExists(atPath: src.path) {
                try? fileManager.moveItem(at: src, to: dst)
            }
        }
        print("⚠️ [Persistence Manager] Corrupted store moved to archive: \(archiveURL.lastPathComponent)")
    }

    // MARK: - Schedule Auto-Backup
    public func scheduleAutoBackup(modelContext: ModelContext) {
        performAutoBackup(modelContext: modelContext)
    }

    // MARK: - Perform Auto-Backup
    public func performAutoBackup(modelContext: ModelContext) {
        do {
            let coursesDesc = FetchDescriptor<Course>()
            let courses = (try? modelContext.fetch(coursesDesc)) ?? []

            let vaultDesc = FetchDescriptor<VaultDocument>()
            let vaultDocs = (try? modelContext.fetch(vaultDesc)) ?? []

            // Avoid overwriting a valid populated backup with an empty snapshot
            if courses.isEmpty && vaultDocs.isEmpty && hasValidBackup() {
                print("ℹ️ [Persistence Manager] Skip auto-backup: database is currently empty and existing backup is preserved.")
                return
            }

            var courseRecords: [CourseBackupRecord] = []
            for c in courses {
                var weekRecords: [WeekBackupRecord] = []
                for w in c.weeks {
                    var readingRecords: [ReadingBackupRecord] = []
                    for r in w.readings {
                        readingRecords.append(ReadingBackupRecord(
                            id: r.id.uuidString,
                            title: r.title,
                            authorName: r.authorName,
                            resourceTitle: r.resourceTitle,
                            mediaTypeRaw: r.mediaTypeRaw,
                            isCompleted: r.isCompleted,
                            isDeleted: r.isDeleted,
                            isFavorite: r.isFavorite,
                            summaryText: r.summaryText,
                            keyTakeawaysText: r.keyTakeawaysText,
                            estimatedTimeText: r.estimatedTimeText,
                            videoUrl: r.videoUrl,
                            sourcePageNumber: r.sourcePageNumber,
                            dueDate: r.dueDate,
                            dateRangeStr: r.dateRangeStr,
                            chapterText: r.chapterText,
                            pagesText: r.pagesText,
                            courseCode: r.courseCode,
                            semanticCategoryRaw: r.semanticCategoryRaw,
                            relevantTopics: r.relevantTopics,
                            sourceDocumentName: r.sourceDocumentName,
                            docColorHex: r.docColorHex
                        ))
                    }
                    weekRecords.append(WeekBackupRecord(
                        id: w.id.uuidString,
                        weekNumber: w.weekNumber,
                        startDate: w.startDate,
                        theme: w.theme,
                        dateRangeStr: w.dateRangeStr,
                        readings: readingRecords
                    ))
                }

                var assignmentRecords: [AssignmentBackupRecord] = []
                for a in c.assignments {
                    assignmentRecords.append(AssignmentBackupRecord(
                        id: a.id.uuidString,
                        title: a.title,
                        weekNumber: a.weekNumber,
                        dueDate: a.dueDate,
                        fullInstructions: a.fullInstructions,
                        pointsPossible: a.pointsPossible,
                        pointsBreakdown: a.pointsBreakdown,
                        rubricJSON: a.rubricJSON,
                        noteText: a.noteText,
                        isCompleted: a.isCompleted,
                        isDeleted: a.isDeleted,
                        isFavorite: a.isFavorite,
                        courseCode: a.courseCode,
                        weightPercentage: a.weightPercentage,
                        subTypeRaw: a.subTypeRaw,
                        mediaUrl: a.mediaUrl,
                        relevantTopics: a.relevantTopics,
                        sourceDocumentName: a.sourceDocumentName,
                        docColorHex: a.docColorHex
                    ))
                }

                var syllabusRecords: [SyllabusDocBackupRecord] = []
                for s in c.syllabusDocs {
                    syllabusRecords.append(SyllabusDocBackupRecord(
                        id: s.id.uuidString,
                        docTitle: s.docTitle,
                        officeHoursText: s.officeHoursText,
                        instructorContact: s.instructorContact,
                        gradingPolicyText: s.gradingPolicyText,
                        fileName: s.fileName,
                        uploadedAt: s.uploadedAt,
                        courseCode: s.courseCode,
                        docColorHex: s.docColorHex
                    ))
                }

                courseRecords.append(CourseBackupRecord(
                    id: c.id.uuidString,
                    creatorId: c.creatorId.uuidString,
                    courseName: c.courseName,
                    courseCode: c.courseCode,
                    courseDescription: c.courseDescription,
                    instructorName: c.instructorName,
                    instructorEmail: c.instructorEmail,
                    hexColor: c.hexColor,
                    termWeeks: c.termWeeks,
                    sharingCode: c.sharingCode,
                    isDeleted: c.isDeleted,
                    isFavorite: c.isFavorite,
                    chatHistoryJSON: c.chatHistoryJSON,
                    createdAt: c.createdAt,
                    weeks: weekRecords,
                    assignments: assignmentRecords,
                    syllabusDocs: syllabusRecords
                ))
            }

            var vaultRecords: [VaultDocBackupRecord] = []
            for v in vaultDocs {
                vaultRecords.append(VaultDocBackupRecord(
                    id: v.id.uuidString,
                    title: v.title,
                    category: v.category,
                    fileSize: v.fileSize,
                    fileType: v.fileType,
                    courseCode: v.courseCode,
                    fileContent: v.fileContent,
                    docColorHex: v.docColorHex,
                    uploadedAt: v.uploadedAt
                ))
            }

            let snapshot = AppDataSnapshot(courses: courseRecords, vaultDocuments: vaultRecords)
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(snapshot)

            // Rotate existing backup to previousBackupURL
            if FileManager.default.fileExists(atPath: backupURL.path) {
                try? FileManager.default.removeItem(at: previousBackupURL)
                try? FileManager.default.copyItem(at: backupURL, to: previousBackupURL)
            }

            try data.write(to: backupURL, options: .atomic)
            print("💾 [Persistence Manager] Auto-backup completed successfully (\(courseRecords.count) courses, \(vaultRecords.count) documents saved).")
        } catch {
            print("❌ [Persistence Manager] Auto-backup failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Check if Valid Backup Exists
    public func hasValidBackup() -> Bool {
        if FileManager.default.fileExists(atPath: backupURL.path) {
            return true
        }
        return FileManager.default.fileExists(atPath: previousBackupURL.path)
    }

    // MARK: - Restore from Backup
    @discardableResult
    public func restoreFromLatestBackup(into modelContext: ModelContext) -> Bool {
        let targetURL = FileManager.default.fileExists(atPath: backupURL.path) ? backupURL : previousBackupURL
        guard FileManager.default.fileExists(atPath: targetURL.path) else {
            print("⚠️ [Persistence Manager] No backup file available to restore from.")
            return false
        }

        do {
            let data = try Data(contentsOf: targetURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let snapshot = try decoder.decode(AppDataSnapshot.self, from: data)

            print("🔄 [Persistence Manager] Restoring \(snapshot.courses.count) courses and \(snapshot.vaultDocuments.count) documents from backup snapshot...")

            // Fetch existing courses to avoid duplicates
            let existingCoursesDesc = FetchDescriptor<Course>()
            let existingCourses = (try? modelContext.fetch(existingCoursesDesc)) ?? []
            let existingCourseIDs = Set(existingCourses.map { $0.id })

            for cRecord in snapshot.courses {
                let courseUUID = UUID(uuidString: cRecord.id) ?? UUID()
                if existingCourseIDs.contains(courseUUID) {
                    continue
                }

                let course = Course(
                    id: courseUUID,
                    creatorId: UUID(uuidString: cRecord.creatorId) ?? UUID(),
                    courseName: cRecord.courseName,
                    courseCode: cRecord.courseCode,
                    courseDescription: cRecord.courseDescription,
                    instructorName: cRecord.instructorName,
                    instructorEmail: cRecord.instructorEmail,
                    hexColor: cRecord.hexColor,
                    termWeeks: cRecord.termWeeks,
                    sharingCode: cRecord.sharingCode,
                    isDeleted: cRecord.isDeleted,
                    createdAt: cRecord.createdAt,
                    isFavorite: cRecord.isFavorite,
                    chatHistoryJSON: cRecord.chatHistoryJSON
                )
                modelContext.insert(course)

                for wRecord in cRecord.weeks {
                    let week = Week(
                        id: UUID(uuidString: wRecord.id) ?? UUID(),
                        weekNumber: wRecord.weekNumber,
                        startDate: wRecord.startDate,
                        theme: wRecord.theme,
                        dateRangeStr: wRecord.dateRangeStr
                    )
                    week.course = course
                    course.weeks.append(week)
                    modelContext.insert(week)

                    for rRecord in wRecord.readings {
                        let reading = Reading(
                            id: UUID(uuidString: rRecord.id) ?? UUID(),
                            title: rRecord.title,
                            authorName: rRecord.authorName,
                            resourceTitle: rRecord.resourceTitle,
                            mediaType: MediaType(rawValue: rRecord.mediaTypeRaw) ?? .textbook,
                            isCompleted: rRecord.isCompleted,
                            isDeleted: rRecord.isDeleted,
                            summaryText: rRecord.summaryText,
                            keyTakeawaysText: rRecord.keyTakeawaysText,
                            estimatedTimeText: rRecord.estimatedTimeText,
                            videoUrl: rRecord.videoUrl,
                            sourcePageNumber: rRecord.sourcePageNumber,
                            dueDate: rRecord.dueDate,
                            dateRangeStr: rRecord.dateRangeStr,
                            chapterText: rRecord.chapterText,
                            pagesText: rRecord.pagesText,
                            courseCode: rRecord.courseCode,
                            semanticCategoryRaw: rRecord.semanticCategoryRaw,
                            relevantTopics: rRecord.relevantTopics,
                            sourceDocumentName: rRecord.sourceDocumentName,
                            docColorHex: rRecord.docColorHex,
                            isFavorite: rRecord.isFavorite
                        )
                        reading.week = week
                        week.readings.append(reading)
                        modelContext.insert(reading)
                    }
                }

                for aRecord in cRecord.assignments {
                    let assignment = Assignment(
                        id: UUID(uuidString: aRecord.id) ?? UUID(),
                        title: aRecord.title,
                        weekNumber: aRecord.weekNumber,
                        dueDate: aRecord.dueDate,
                        fullInstructions: aRecord.fullInstructions,
                        pointsPossible: aRecord.pointsPossible,
                        pointsBreakdown: aRecord.pointsBreakdown,
                        rubricJSON: aRecord.rubricJSON,
                        noteText: aRecord.noteText,
                        isCompleted: aRecord.isCompleted,
                        isDeleted: aRecord.isDeleted,
                        courseCode: aRecord.courseCode,
                        weightPercentage: aRecord.weightPercentage,
                        subTypeRaw: aRecord.subTypeRaw,
                        mediaUrl: aRecord.mediaUrl,
                        relevantTopics: aRecord.relevantTopics,
                        sourceDocumentName: aRecord.sourceDocumentName,
                        docColorHex: aRecord.docColorHex,
                        isFavorite: aRecord.isFavorite
                    )
                    assignment.course = course
                    course.assignments.append(assignment)
                    modelContext.insert(assignment)
                }

                for sRecord in cRecord.syllabusDocs {
                    let sDoc = SyllabusDocument(
                        id: UUID(uuidString: sRecord.id) ?? UUID(),
                        docTitle: sRecord.docTitle,
                        officeHoursText: sRecord.officeHoursText,
                        instructorContact: sRecord.instructorContact,
                        gradingPolicyText: sRecord.gradingPolicyText,
                        fileName: sRecord.fileName,
                        uploadedAt: sRecord.uploadedAt,
                        courseCode: sRecord.courseCode,
                        docColorHex: sRecord.docColorHex
                    )
                    sDoc.course = course
                    course.syllabusDocs.append(sDoc)
                    modelContext.insert(sDoc)
                }
            }

            // Restore Vault Documents
            let existingVaultDesc = FetchDescriptor<VaultDocument>()
            let existingVault = (try? modelContext.fetch(existingVaultDesc)) ?? []
            let existingVaultIDs = Set(existingVault.map { $0.id })

            for vRecord in snapshot.vaultDocuments {
                let vUUID = UUID(uuidString: vRecord.id) ?? UUID()
                if existingVaultIDs.contains(vUUID) {
                    continue
                }

                let vDoc = VaultDocument(
                    id: vUUID,
                    title: vRecord.title,
                    category: vRecord.category,
                    fileSize: vRecord.fileSize,
                    fileType: vRecord.fileType,
                    courseCode: vRecord.courseCode,
                    fileContent: vRecord.fileContent,
                    docColorHex: vRecord.docColorHex,
                    uploadedAt: vRecord.uploadedAt
                )
                modelContext.insert(vDoc)
            }

            try modelContext.save()
            print("✅ [Persistence Manager] Disaster recovery restore completed successfully!")
            return true
        } catch {
            print("❌ [Persistence Manager] Restore failed: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Auto-Recover on Startup if Empty
    public func autoRecoverIfDatabaseEmpty(modelContext: ModelContext) {
        let coursesDesc = FetchDescriptor<Course>()
        let count = (try? modelContext.fetchCount(coursesDesc)) ?? 0
        if count == 0 && hasValidBackup() {
            print("🔍 [Persistence Manager] Database is empty but a valid backup exists. Restoring user data...")
            restoreFromLatestBackup(into: modelContext)
        }
    }
}
