import Foundation
import PDFKit
import UniformTypeIdentifiers
import Compression
#if canImport(UIKit)
import UIKit
#endif
#if canImport(AppKit)
import AppKit
#endif

public struct DocumentExtractor {

    public static var supportedContentTypes: [UTType] {
        var types: [UTType] = [.pdf, .plainText]
        if let docxType = UTType(filenameExtension: "docx") {
            types.append(docxType)
        }
        if let docType = UTType(filenameExtension: "doc") {
            types.append(docType)
        }
        if let wordType = UTType("com.microsoft.word.doc") {
            types.append(wordType)
        }
        return types
    }

    public static func extractText(from url: URL) -> String? {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }

        let ext = url.pathExtension.lowercased()

        // 1. Plain Text / Markdown
        if ext == "txt" || ext == "md" || ext == "rtf" {
            if let text = try? String(contentsOf: url, encoding: .utf8), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return text
            }
        }

        // 2. PDF Document
        if ext == "pdf" {
            if let pdfDoc = PDFDocument(url: url) {
                var pages: [String] = []
                for i in 0..<pdfDoc.pageCount {
                    if let page = pdfDoc.page(at: i), let pStr = page.string, !pStr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        pages.append(pStr)
                    }
                }
                let fullPdfText = pages.joined(separator: "\n\n")
                if !fullPdfText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    return fullPdfText
                }
            }
        }

        // 3. DOCX / DOC Files (Microsoft Word)
        if ext == "docx" || ext == "doc" {
            let docxType = NSAttributedString.DocumentType(rawValue: "org.openxmlformats.wordprocessingml.document")
            let docxOptions: [NSAttributedString.DocumentReadingOptionKey: Any] = [.documentType: docxType]

            if let attrStr = try? NSAttributedString(url: url, options: docxOptions, documentAttributes: nil) {
                let cleanStr = sanitizeText(attrStr.string)
                if !cleanStr.isEmpty && cleanStr.count > 5 {
                    return cleanStr
                }
            }

            if let data = try? Data(contentsOf: url) {
                if let attrStr = try? NSAttributedString(data: data, options: docxOptions, documentAttributes: nil) {
                    let cleanStr = sanitizeText(attrStr.string)
                    if !cleanStr.isEmpty && cleanStr.count > 5 {
                        return cleanStr
                    }
                }
                if let xmlText = extractTextFromDocxData(data) {
                    return xmlText
                }

                // Fallback scan for printable ASCII sentences in compressed stream
                if let asciiStr = String(data: data, encoding: .ascii) {
                    let matches = (try? NSRegularExpression(pattern: #"[A-Za-z0-9\s.,\-\(\)':"'\?]{6,}"#))?.matches(in: asciiStr, range: NSRange(location: 0, length: asciiStr.utf16.count)) ?? []
                    let words = matches.compactMap { m -> String? in
                        let s = (asciiStr as NSString).substring(with: m.range).trimmingCharacters(in: .whitespacesAndNewlines)
                        return s.count >= 4 && isReadableEnglishText(s) ? s : nil
                    }
                    if !words.isEmpty {
                        return words.joined(separator: " ")
                    }
                }
            }
        }

        // 4. Fallback: UTF-8 / ASCII String loading
        if let fallbackTxt = try? String(contentsOf: url, encoding: .utf8), !fallbackTxt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return fallbackTxt
        }
        if let fallbackAscii = try? String(contentsOf: url, encoding: .ascii), !fallbackAscii.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return fallbackAscii
        }

        return nil
    }

    public static func extractTextFromData(_ data: Data, fileName: String) -> String? {
        let ext = (fileName as NSString).pathExtension.lowercased()
        let cleanExt = ext.isEmpty ? "docx" : ext
        let tempUrl = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + "." + cleanExt)
        do {
            try data.write(to: tempUrl)
            let extracted = extractText(from: tempUrl)
            try? FileManager.default.removeItem(at: tempUrl)
            if let text = extracted, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return text
            }
        } catch {
            print("Error writing temp data for extraction: \(error)")
        }

        if let xmlText = extractTextFromDocxData(data) {
            return xmlText
        }

        let fallbackStr = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .ascii) ?? ""
        let clean = sanitizeText(fallbackStr)
        return clean.isEmpty ? nil : clean
    }

    public static func extractTextFromDocxData(_ data: Data) -> String? {
        var offset = 0
        let count = data.count
        let bytes = [UInt8](data)

        var extractedXml: String? = nil

        while offset + 30 < count {
            if bytes[offset] == 0x50 && bytes[offset+1] == 0x4b && bytes[offset+2] == 0x03 && bytes[offset+3] == 0x04 {
                let compressionMethod = UInt16(bytes[offset+8]) | (UInt16(bytes[offset+9]) << 8)
                let compressedSize = Int(bytes[offset+18]) | (Int(bytes[offset+19]) << 8) | (Int(bytes[offset+20]) << 16) | (Int(bytes[offset+21]) << 24)
                let uncompressedSize = Int(bytes[offset+22]) | (Int(bytes[offset+23]) << 8) | (Int(bytes[offset+24]) << 16) | (Int(bytes[offset+25]) << 24)
                let fileNameLen = Int(bytes[offset+26]) | (Int(bytes[offset+27]) << 8)
                let extraLen = Int(bytes[offset+28]) | (Int(bytes[offset+29]) << 8)

                let headerEnd = offset + 30
                if headerEnd + fileNameLen <= count {
                    let fileNameData = Data(bytes[headerEnd..<(headerEnd + fileNameLen)])
                    if let fileName = String(data: fileNameData, encoding: .utf8), fileName.lowercased().contains("document") && fileName.lowercased().hasSuffix(".xml") {
                        let dataStart = headerEnd + fileNameLen + extraLen
                        if dataStart + compressedSize <= count {
                            let compData = Data(bytes[dataStart..<(dataStart + compressedSize)])

                            if compressionMethod == 0 {
                                extractedXml = String(data: compData, encoding: .utf8)
                            } else if compressionMethod == 8 {
                                let bufCapacity = max(uncompressedSize + 8192, 65536)
                                let destBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufCapacity)
                                defer { destBuffer.deallocate() }
                                let decodedSize = compData.withUnsafeBytes { rawBuffer -> Int in
                                    guard let srcPtr = rawBuffer.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return 0 }
                                    return compression_decode_buffer(destBuffer, bufCapacity, srcPtr, compData.count, nil, COMPRESSION_ZLIB)
                                }
                                if decodedSize > 0 {
                                    let decompData = Data(bytes: destBuffer, count: decodedSize)
                                    extractedXml = String(data: decompData, encoding: .utf8)
                                }
                            }
                        }
                        if extractedXml != nil { break }
                    }
                }
                offset += 30 + fileNameLen + extraLen + max(0, compressedSize)
            } else {
                offset += 1
            }
        }

        let xmlString: String
        if let xml = extractedXml {
            xmlString = xml
        } else {
            guard let startRange = data.range(of: Data("<w:body".utf8)) ?? data.range(of: Data("<w:document".utf8)) else {
                return nil
            }
            let bodyData = data.subdata(in: startRange.lowerBound..<data.count)
            guard let s = String(data: bodyData, encoding: .utf8) else { return nil }
            xmlString = s
        }

        // Regex to extract text inside Microsoft Word <w:t> XML tags
        let pattern = #"<w:t[^>]*>(.*?)</w:t>"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators]) else {
            return nil
        }

        let nsString = xmlString as NSString
        let maxLen = min(nsString.length, 1000000)
        let matches = regex.matches(in: xmlString, options: [], range: NSRange(location: 0, length: maxLen))

        var words: [String] = []
        for match in matches {
            if match.numberOfRanges > 1 {
                let matchedText = nsString.substring(with: match.range(at: 1))
                let clean = sanitizeText(matchedText)
                if !clean.isEmpty {
                    words.append(clean)
                }
            }
        }

        let joined = words.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        return joined.isEmpty ? nil : joined
    }

    public static func sanitizeText(_ str: String) -> String {
        let cleanScalars = str.unicodeScalars.filter { scalar in
            (scalar.value >= 32 && scalar.value <= 126) || scalar.value == 10 || scalar.value == 13
        }
        return String(String.UnicodeScalarView(cleanScalars)).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public static func isReadableEnglishText(_ str: String) -> Bool {
        if str.count < 2 { return false }
        let allowed = CharacterSet.alphanumerics.union(.whitespaces).union(.punctuationCharacters)
        let invalid = str.unicodeScalars.filter { !allowed.contains($0) }.count
        return Double(invalid) / Double(max(1, str.count)) < 0.1
    }
}
