import Foundation
import CryptoKit

/// Thread-safe persistent on-disk and in-memory cache for parsed `CourseDTO` objects.
/// Allows re-uploading documents or importing existing vault documents to resolve instantaneously (< 0.1s)
/// without redundant Gemini multimodal network roundtrips.
public final class ParsedSyllabusCache: @unchecked Sendable {
    public static let shared = ParsedSyllabusCache()

    private let cacheDirectory: URL
    private let fileManager = FileManager.default
    private let memoryCache = NSCache<NSString, NSData>()
    private let queue = DispatchQueue(label: "com.coursepal.ParsedSyllabusCache", attributes: .concurrent)

    private init() {
        let urls = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)
        let baseDir = urls.first ?? URL(fileURLWithPath: NSTemporaryDirectory())
        let cacheDir = baseDir.appendingPathComponent("ParsedSyllabiCache", isDirectory: true)
        try? fileManager.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        self.cacheDirectory = cacheDir
    }

    /// Computes a deterministic SHA-256 hash for raw file data, text, or filename.
    public func hashKey(forData data: Data?, text: String?, fileName: String?) -> String? {
        let versionPrefix = "v6_"
        if let data = data, !data.isEmpty {
            let digest = SHA256.hash(data: data)
            return versionPrefix + digest.map { String(format: "%02x", $0) }.joined()
        }
        if let text = text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let textData = Data(text.utf8)
            let digest = SHA256.hash(data: textData)
            return versionPrefix + digest.map { String(format: "%02x", $0) }.joined()
        }
        if let fileName = fileName, !fileName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let norm = fileName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let digest = SHA256.hash(data: Data(norm.utf8))
            return versionPrefix + "fn_" + digest.map { String(format: "%02x", $0) }.joined()
        }
        return nil
    }

    /// Retrieves a cached `CourseDTO` if available. Checks in-memory cache first, then disk cache.
    public func get(forData data: Data? = nil, text: String? = nil, fileName: String? = nil) -> CourseDTO? {
        // 1. Try raw data / content text hash first (highest fidelity)
        if let primaryKey = hashKey(forData: data, text: text, fileName: nil) {
            if let dto = load(key: primaryKey) {
                print("⚡️ [ParsedSyllabusCache] Cache HIT for content hash: \(primaryKey.prefix(10))...")
                return dto
            }
        }

        // 2. Try normalized filename hash fallback
        if let fileName = fileName, let fnKey = hashKey(forData: nil, text: nil, fileName: fileName) {
            if let dto = load(key: fnKey) {
                print("⚡️ [ParsedSyllabusCache] Cache HIT for filename hash: \(fnKey.prefix(10))... (\(fileName))")
                return dto
            }
        }

        return nil
    }

    /// Saves a `CourseDTO` into both memory and persistent disk caches under content and filename keys.
    public func save(dto: CourseDTO, forData data: Data? = nil, text: String? = nil, fileName: String? = nil) {
        guard let encodedData = try? JSONEncoder().encode(dto) else { return }

        // Save under primary content key
        if let primaryKey = hashKey(forData: data, text: text, fileName: nil) {
            store(key: primaryKey, data: encodedData)
        }

        // Save under filename key
        if let fileName = fileName, let fnKey = hashKey(forData: nil, text: nil, fileName: fileName) {
            store(key: fnKey, data: encodedData)
        }
    }

    private func store(key: String, data: Data) {
        let nsData = data as NSData
        let nsKey = key as NSString
        memoryCache.setObject(nsData, forKey: nsKey)

        queue.async(flags: .barrier) { [weak self] in
            guard let self = self else { return }
            let fileURL = self.cacheDirectory.appendingPathComponent(key + ".json")
            try? data.write(to: fileURL, options: .atomic)
        }
    }

    private func load(key: String) -> CourseDTO? {
        let nsKey = key as NSString
        if let cachedData = memoryCache.object(forKey: nsKey) as Data? {
            if let dto = try? JSONDecoder().decode(CourseDTO.self, from: cachedData) {
                return dto
            }
        }

        var diskData: Data? = nil
        queue.sync {
            let fileURL = self.cacheDirectory.appendingPathComponent(key + ".json")
            diskData = try? Data(contentsOf: fileURL)
        }

        if let data = diskData, let dto = try? JSONDecoder().decode(CourseDTO.self, from: data) {
            memoryCache.setObject(data as NSData, forKey: nsKey)
            return dto
        }

        return nil
    }

    /// Clears all cached parsed syllabi from disk and memory.
    public func clear() {
        memoryCache.removeAllObjects()
        queue.async(flags: .barrier) { [weak self] in
            guard let self = self else { return }
            try? self.fileManager.removeItem(at: self.cacheDirectory)
            try? self.fileManager.createDirectory(at: self.cacheDirectory, withIntermediateDirectories: true)
        }
    }
}
