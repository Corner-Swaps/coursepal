import Foundation
import PDFKit
import UniformTypeIdentifiers
#if canImport(UIKit)
import UIKit
#endif
#if canImport(AppKit)
import AppKit
#endif

public struct DocumentExtractor {

    public static var supportedContentTypes: [UTType] {
        var types: [UTType] = [.pdf, .plainText, .item]
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
            // Primary: Parse DOCX Zip XML text nodes (<w:t>)
            if let data = try? Data(contentsOf: url), let xmlText = extractTextFromDocxData(data) {
                return xmlText
            }

            // Secondary: Generic NSAttributedString document loading if available
            let options: [NSAttributedString.DocumentReadingOptionKey: Any] = [.documentType: NSAttributedString.DocumentType.plain]
            if let attrStr = try? NSAttributedString(url: url, options: options, documentAttributes: nil) {
                let cleanStr = attrStr.string.trimmingCharacters(in: .whitespacesAndNewlines)
                if !cleanStr.isEmpty {
                    return cleanStr
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

    public static func extractTextFromDocxData(_ data: Data) -> String? {
        // Ensure we find the XML body in the zip archive before parsing strings
        guard let startRange = data.range(of: Data("<w:body".utf8)) ?? data.range(of: Data("<w:document".utf8)) else {
            return nil
        }
        let bodyData = data.subdata(in: startRange.lowerBound..<data.count)
        guard let xmlString = String(data: bodyData, encoding: .utf8) else {
            return nil
        }

        // Regex to extract text inside Microsoft Word <w:t> XML tags
        let pattern = #"<w:t[^>]*>(.*?)</w:t>"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators]) else {
            return nil
        }

        let nsString = xmlString as NSString
        let maxLen = min(nsString.length, 500000)
        let matches = regex.matches(in: xmlString, options: [], range: NSRange(location: 0, length: maxLen))

        var words: [String] = []
        for match in matches {
            if match.numberOfRanges > 1 {
                let matchedText = nsString.substring(with: match.range(at: 1))
                let clean = sanitizeText(matchedText)
                if !clean.isEmpty && isReadableEnglishText(clean) {
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
