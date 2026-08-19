import Foundation
import SwiftUI
import SwiftData
import UniformTypeIdentifiers

// MARK: - 1. Document Security & MIME/Size Validator (10MB Limit)
public struct DocumentSecurityValidator {
    public static let maxFileSizeBytes: Int64 = 10 * 1024 * 1024 // 10 MB limit
    public static let allowedMimeTypes: [String] = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/heic",
        "image/webp"
    ]

    public static func validate(data: Data, utType: UTType?) throws {
        // 1. Size Validation (10MB Max)
        if Int64(data.count) > maxFileSizeBytes {
            let sizeMB = Double(data.count) / (1024.0 * 1024.0)
            throw DocumentValidationError.fileTooLarge(sizeMB: sizeMB)
        }

        // 2. MIME / UTType Validation
        if let utType = utType {
            let isPdf = utType.conforms(to: .pdf)
            let isImage = utType.conforms(to: .image)
            if !isPdf && !isImage {
                throw DocumentValidationError.unsupportedMimeType(mime: utType.preferredMIMEType ?? utType.identifier)
            }
        }
    }
}

public enum DocumentValidationError: LocalizedError {
    case fileTooLarge(sizeMB: Double)
    case unsupportedMimeType(mime: String)

    public var errorDescription: String? {
        switch self {
        case .fileTooLarge(let sizeMB):
            return String(format: "File exceeds 10MB limit (%.1f MB). Please upload a smaller document.", sizeMB)
        case .unsupportedMimeType(let mime):
            return "Unsupported file type (\(mime)). Only PDF, JPEG, PNG, and HEIC files are accepted."
        }
    }
}

// MARK: - 2. On-Device Data Purge Engine
public struct DataPurgeManager {
    @MainActor
    public static func purgeAllUserData(context: ModelContext) {
        // 1. Delete SwiftData persistent entities
        do {
            try context.delete(model: Reading.self)
            try context.delete(model: Assignment.self)
            try context.delete(model: Week.self)
            try context.delete(model: Course.self)
            try context.delete(model: VaultDocument.self)
            try context.save()
        } catch {
            print("DataPurgeManager error: \(error.localizedDescription)")
        }

        // 2. Clear Document Directory Caches
        let fileManager = FileManager.default
        if let docsUrl = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first {
            if let files = try? fileManager.contentsOfDirectory(at: docsUrl, includingPropertiesForKeys: nil) {
                for file in files {
                    try? fileManager.removeItem(at: file)
                }
            }
        }

        // 3. Clear Caches Directory
        if let cachesUrl = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first {
            if let files = try? fileManager.contentsOfDirectory(at: cachesUrl, includingPropertiesForKeys: nil) {
                for file in files {
                    try? fileManager.removeItem(at: file)
                }
            }
        }
    }
}
