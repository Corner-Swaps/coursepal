import Foundation
import SwiftUI
import SwiftData
import CoreImage.CIFilterBuiltins
import Compression

#if canImport(UIKit)
import UIKit
import AVFoundation
#endif

// MARK: - Course Sharing Service (Universal App Store Ready)

@MainActor
public final class CourseSharingService {
    public static let shared = CourseSharingService()

    private init() {}

    // MARK: - Encode Course to Compact URL-Safe Payload

    public func encodeCourseToPayload(_ course: Course) -> String? {
        let dto = course.toDTO()
        guard let jsonData = try? JSONEncoder().encode(dto) else { return nil }

        // Compress using Apple Compression (ZLIB)
        if let compressedData = compress(data: jsonData) {
            return compressedData.base64EncodedString()
                .replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")
        }

        // Fallback to plain base64url
        return jsonData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    // MARK: - Decode Course from Input String (URL, Data Token, or JSON)

    public func decodeCourse(from input: String) -> CourseDTO? {
        let raw = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return nil }

        // 1. Direct JSON String
        if raw.starts(with: "{") && raw.contains("courseName") {
            if let data = raw.data(using: .utf8),
               let dto = try? JSONDecoder().decode(CourseDTO.self, from: data) {
                return dto
            }
        }

        // 2. Extract 'data=' parameter from URL if present
        var payloadToDecode = raw
        if raw.lowercased().contains("data=") {
            let components = raw.components(separatedBy: CharacterSet(charactersIn: "?&#"))
            for comp in components {
                if comp.lowercased().hasPrefix("data=") {
                    payloadToDecode = String(comp.dropFirst(5))
                    break
                }
            }
        }

        // Clean base64url padding
        var base64 = payloadToDecode
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 {
            base64.append("=")
        }

        guard let data = Data(base64Encoded: base64) else { return nil }

        // Try Decompressing (ZLIB)
        if let decompressed = decompress(data: data),
           let dto = try? JSONDecoder().decode(CourseDTO.self, from: decompressed) {
            return dto
        }

        // Try Direct JSON Decode
        if let dto = try? JSONDecoder().decode(CourseDTO.self, from: data) {
            return dto
        }

        return nil
    }

    // MARK: - Generate Share Link and Formatted Invite

    public func generateShareLink(for course: Course) -> URL {
        let code = course.sharingCode.isEmpty ? (course.courseCode ?? "CRS") : course.sharingCode
        if let payload = encodeCourseToPayload(course) {
            return URL(string: "https://classpal.app/join?code=\(code)&data=\(payload)") ?? URL(string: "https://classpal.app/join?code=\(code)")!
        }
        return URL(string: "https://classpal.app/join?code=\(code)")!
    }

    public func generateShareMessage(for course: Course) -> String {
        let code = course.sharingCode.isEmpty ? (course.courseCode ?? "CRS") : course.sharingCode
        let link = generateShareLink(for: course).absoluteString
        let readingsCount = course.weeks.reduce(0) { $0 + $1.readings.count }
        let assignmentsCount = course.assignments.count

        return """
        Join '\(course.courseName)' on CoursePal!

        📋 Course Code: \(code)
        📖 \(readingsCount) Readings • 📝 \(assignmentsCount) Assignments

        Tap the link to enroll in one click:
        \(link)
        """
    }

    // MARK: - Generate QR Code Image

    #if canImport(UIKit)
    public func generateQRCode(for text: String) -> UIImage? {
        guard let data = text.data(using: .utf8) else { return nil }
        guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")

        guard let ciImage = filter.outputImage else { return nil }
        let transform = CGAffineTransform(scaleX: 12, y: 12)
        let scaledCIImage = ciImage.transformed(by: transform)

        let context = CIContext(options: [CIContextOption.useSoftwareRenderer: false])
        guard let cgImage = context.createCGImage(scaledCIImage, from: scaledCIImage.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }

    public func generateCourseQRCode(for course: Course) -> UIImage? {
        let code = course.sharingCode.isEmpty ? (course.courseCode ?? "CRS") : course.sharingCode
        let cleanCode = code.trimmingCharacters(in: .whitespacesAndNewlines)
        if let payload = encodeCourseToPayload(course), payload.count <= 1200 {
            let fullUrl = "https://classpal.app/join?code=\(cleanCode)&data=\(payload)"
            if let qr = generateQRCode(for: fullUrl) {
                return qr
            }
        }
        let shortUrl = "https://classpal.app/join?code=\(cleanCode)"
        return generateQRCode(for: shortUrl)
    }
    #endif

    // MARK: - Compression Helpers (Apple native Compression framework)

    private func compress(data: Data) -> Data? {
        let destinationBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: data.count)
        defer { destinationBuffer.deallocate() }

        let compressedSize = data.withUnsafeBytes { (sourceBuffer: UnsafeRawBufferPointer) -> Int in
            guard let sourceAddress = sourceBuffer.bindMemory(to: UInt8.self).baseAddress else { return 0 }
            return compression_encode_buffer(
                destinationBuffer, data.count,
                sourceAddress, data.count,
                nil,
                COMPRESSION_ZLIB
            )
        }

        guard compressedSize > 0 else { return nil }
        return Data(bytes: destinationBuffer, count: compressedSize)
    }

    private func decompress(data: Data) -> Data? {
        let maxDecompressedSize = 1024 * 1024 * 5 // 5MB limit
        let destinationBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: maxDecompressedSize)
        defer { destinationBuffer.deallocate() }

        let decompressedSize = data.withUnsafeBytes { (sourceBuffer: UnsafeRawBufferPointer) -> Int in
            guard let sourceAddress = sourceBuffer.bindMemory(to: UInt8.self).baseAddress else { return 0 }
            return compression_decode_buffer(
                destinationBuffer, maxDecompressedSize,
                sourceAddress, data.count,
                nil,
                COMPRESSION_ZLIB
            )
        }

        guard decompressedSize > 0 else { return nil }
        return Data(bytes: destinationBuffer, count: decompressedSize)
    }
}
