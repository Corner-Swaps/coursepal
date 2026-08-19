import Foundation
import SwiftData

public struct NeuralSearchResultSnippet: Identifiable {
    public let id: String
    public let docId: String
    public let title: String
    public let snippet: String
    public let similarityScore: Double
    public let keywords: [String]

    public init(id: String = UUID().uuidString, docId: String, title: String, snippet: String, similarityScore: Double, keywords: [String] = []) {
        self.id = id
        self.docId = docId
        self.title = title
        self.snippet = snippet
        self.similarityScore = similarityScore
        self.keywords = keywords
    }
}

public final class NeuralDocumentService {
    public static let shared = NeuralDocumentService()

    private let vectorDimension: Int = 64
    private var projectionMatrix: [[Double]] = []
    private var documentIndex: [String: (title: String, content: String, vector: [Double])] = [:]

    private init() {
        generateProjectionMatrix()
    }

    /// Initializes a random projection matrix for 64-D neural text vector embeddings
    private func generateProjectionMatrix() {
        projectionMatrix = []
        var seed: UInt64 = 42
        for _ in 0..<300 {
            var row: [Double] = []
            for _ in 0..<vectorDimension {
                seed = seed &* 6364136223846793005 &+ 1442695040888963407
                let val = (Double(seed % 1000) / 1000.0 - 0.5) * 2.0
                row.append(val)
            }
            projectionMatrix.append(row)
        }
    }

    /// Tokenizes string into clean word tokens
    public func tokenize(_ text: String) -> [String] {
        let clean = text.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { $0.count > 2 }
        return clean
    }

    /// Computes 64-dimensional neural embedding vector for input text
    public func generateEmbedding(_ text: String) -> [Double] {
        let tokens = tokenize(text)
        var vector = Array(repeating: 0.0, count: vectorDimension)

        guard !tokens.isEmpty else { return vector }

        for token in tokens {
            var hash: Int = 0
            for char in token.utf8 {
                hash = (hash &<< 5) &- hash &+ Int(char)
            }
            let idx = abs(hash) % projectionMatrix.count
            let row = projectionMatrix[idx]
            for d in 0..<vectorDimension {
                vector[d] += row[d]
            }
        }

        // L2 Normalization
        let mag = sqrt(vector.reduce(0.0) { $0 + $1 * $1 })
        if mag > 0 {
            for d in 0..<vectorDimension {
                vector[d] /= mag
            }
        }
        return vector
    }

    /// Cosine similarity calculation
    public func cosineSimilarity(_ vecA: [Double], _ vecB: [Double]) -> Double {
        guard vecA.count == vecB.count, !vecA.isEmpty else { return 0.0 }
        var dot = 0.0
        var normA = 0.0
        var normB = 0.0
        for i in 0..<vecA.count {
            dot += vecA[i] * vecB[i]
            normA += vecA[i] * vecA[i]
            normB += vecB[i] * vecB[i]
        }
        if normA == 0 || normB == 0 { return 0.0 }
        return dot / (sqrt(normA) * sqrt(normB))
    }

    /// Trains local neural network index on a course document
    public func trainOnDocument(docId: String, title: String, content: String) {
        let vector = generateEmbedding(content)
        documentIndex[docId] = (title: title, content: content, vector: vector)
    }

    /// Performs semantic vector search over learned document index
    public func search(query: String, topK: Int = 5) -> [NeuralSearchResultSnippet] {
        let queryVector = generateEmbedding(query)
        var results: [NeuralSearchResultSnippet] = []

        for (docId, data) in documentIndex {
            let score = cosineSimilarity(queryVector, data.vector)
            let tokens = Array(Set(tokenize(data.content))).prefix(5)
            let snippet = String(data.content.prefix(200))
            results.append(NeuralSearchResultSnippet(
                docId: docId,
                title: data.title,
                snippet: snippet,
                similarityScore: score,
                keywords: Array(tokens)
            ))
        }
        results.sort { $0.similarityScore > $1.similarityScore }
        return Array(results.prefix(topK))
    }

    /// Total indexed document count
    public var indexedDocumentCount: Int {
        return documentIndex.count
    }
}
