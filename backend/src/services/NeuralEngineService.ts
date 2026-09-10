import crypto from 'crypto';

export interface DocumentChunk {
  id: string;
  docId: string;
  title: string;
  content: string;
  vector: number[];
  topicKeywords: string[];
}

export interface NeuralSearchResult {
  chunk: DocumentChunk;
  similarityScore: number;
}

export class NeuralDocumentEngine {
  private static instance: NeuralDocumentEngine;
  private vectorDimensions: number = 64;
  private documentChunks: Map<string, DocumentChunk> = new Map();
  private vocabulary: Map<string, number> = new Map();
  private weights: number[][] = [];

  private constructor() {
    this.initializeWeights();
  }

  public static getInstance(): NeuralDocumentEngine {
    if (!NeuralDocumentEngine.instance) {
      NeuralDocumentEngine.instance = new NeuralDocumentEngine();
    }
    return NeuralDocumentEngine.instance;
  }

  /**
   * Initializes neural random projection matrix for document text embedding.
   */
  private initializeWeights() {
    this.weights = [];
    for (let i = 0; i < 500; i++) {
      const row: number[] = [];
      for (let j = 0; j < this.vectorDimensions; j++) {
        row.push((Math.random() - 0.5) * 2);
      }
      this.weights.push(row);
    }
  }

  /**
   * Tokenize text into normalized word tokens.
   */
  public tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  /**
   * Generates a 64-dimensional neural embedding vector for input text.
   */
  public generateEmbedding(text: string): number[] {
    const tokens = this.tokenize(text);
    const vector = new Array(this.vectorDimensions).fill(0);

    if (tokens.length === 0) return vector;

    tokens.forEach(token => {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const weightIdx = Math.abs(hash) % this.weights.length;
      const proj = this.weights[weightIdx];

      for (let d = 0; d < this.vectorDimensions; d++) {
        vector[d] += proj[d];
      }
    });

    // L2 Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let d = 0; d < this.vectorDimensions; d++) {
        vector[d] /= magnitude;
      }
    }

    return vector;
  }

  /**
   * Trains the neural engine on a document, slicing it into semantic chunks and indexing embeddings.
   */
  public trainDocument(docId: string, title: string, fullContent: string): { chunksCreated: number; totalIndexed: number } {
    const paragraphs = fullContent
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 20);

    let chunksCreated = 0;

    paragraphs.forEach((para, idx) => {
      const chunkId = `${docId}-chunk-${idx}`;
      const vector = this.generateEmbedding(para);
      const tokens = this.tokenize(para);
      const uniqueKeywords = Array.from(new Set(tokens)).slice(0, 8);

      tokens.forEach(t => {
        this.vocabulary.set(t, (this.vocabulary.get(t) || 0) + 1);
      });

      const chunk: DocumentChunk = {
        id: chunkId,
        docId,
        title,
        content: para,
        vector,
        topicKeywords: uniqueKeywords
      };

      this.documentChunks.set(chunkId, chunk);
      chunksCreated++;
    });

    return {
      chunksCreated,
      totalIndexed: this.documentChunks.size
    };
  }

  /**
   * Computes Cosine Similarity between two feature vectors.
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Performs semantic neural search across all learned document chunks.
   */
  public search(queryText: string, topK: number = 5): NeuralSearchResult[] {
    const queryVector = this.generateEmbedding(queryText);
    const results: NeuralSearchResult[] = [];

    this.documentChunks.forEach(chunk => {
      const similarityScore = this.cosineSimilarity(queryVector, chunk.vector);
      results.push({ chunk, similarityScore });
    });

    results.sort((a, b) => b.similarityScore - a.similarityScore);
    return results.slice(0, topK);
  }

  /**
   * Clears learned index.
   */
  public resetIndex() {
    this.documentChunks.clear();
    this.vocabulary.clear();
  }

  /**
   * Returns current statistics of the neural net document store.
   */
  public getStats() {
    return {
      totalIndexedChunks: this.documentChunks.size,
      vocabularySize: this.vocabulary.size,
      vectorDimensions: this.vectorDimensions
    };
  }
}
