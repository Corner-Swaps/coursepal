/**
 * NeuralDocumentService
 * On-device 64-dimensional semantic text search and document indexer.
 * 1:1 match with Swift NeuralDocumentService
 */

import { generateNeuralProjectionMatrix, cosineSimilarity } from '../utils/mathPhysics';
import { NeuralProjectionConstants } from '../constants/physics';

export interface NeuralSearchResultSnippet {
  id: string;
  docId: string;
  title: string;
  snippet: string;
  similarityScore: number;
  keywords: string[];
}

export interface IndexedDocument {
  title: string;
  content: string;
  vector: number[];
}

export class NeuralDocumentService {
  private static _instance: NeuralDocumentService;
  public static get shared(): NeuralDocumentService {
    if (!this._instance) {
      this._instance = new NeuralDocumentService();
    }
    return this._instance;
  }

  private readonly vectorDimension: number = NeuralProjectionConstants.vectorDimension;
  private projectionMatrix: number[][];
  private documentIndex: Map<string, IndexedDocument> = new Map();

  public constructor() {
    this.projectionMatrix = generateNeuralProjectionMatrix();
  }

  /**
   * Tokenizes text into clean lowercase alphanumeric words (length > 2)
   */
  public tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 2);
  }

  /**
   * Computes 64-dimensional neural embedding vector for input text
   */
  public generateEmbedding(text: string): number[] {
    const tokens = this.tokenize(text);
    const vector = new Array(this.vectorDimension).fill(0.0);

    if (tokens.length === 0) {
      return vector;
    }

    const rowCount = BigInt(this.projectionMatrix.length);

    for (const token of tokens) {
      let hash = 0n;
      for (let i = 0; i < token.length; i++) {
        const code = BigInt(token.charCodeAt(i));
        hash = ((hash << 5n) - hash + code) & 0x7FFFFFFFFFFFFFFFn;
      }
      const idx = Number(hash % rowCount);
      const row = this.projectionMatrix[idx];
      for (let d = 0; d < this.vectorDimension; d++) {
        vector[d] += row[d];
      }
    }

    // L2 Normalization
    let sumSq = 0.0;
    for (let d = 0; d < this.vectorDimension; d++) {
      sumSq += vector[d] * vector[d];
    }
    const mag = Math.sqrt(sumSq);
    if (mag > 0) {
      for (let d = 0; d < this.vectorDimension; d++) {
        vector[d] /= mag;
      }
    }

    return vector;
  }

  /**
   * Calculates cosine similarity between two 64-D vectors
   */
  public cosineSimilarity(vecA: number[], vecB: number[]): number {
    return cosineSimilarity(vecA, vecB);
  }

  /**
   * Trains/indexes a document in memory
   */
  public trainOnDocument(docId: string, title: string, content: string): void {
    const vector = this.generateEmbedding(content);
    this.documentIndex.set(docId, { title, content, vector });
  }

  /**
   * Semantic vector search across indexed documents
   */
  public search(query: string, topK: number = 5): NeuralSearchResultSnippet[] {
    const queryVector = this.generateEmbedding(query);
    const results: NeuralSearchResultSnippet[] = [];

    for (const [docId, data] of this.documentIndex.entries()) {
      const score = this.cosineSimilarity(queryVector, data.vector);
      const uniqueTokens = Array.from(new Set(this.tokenize(data.content))).slice(0, 5);
      const snippet = data.content.substring(0, 200);

      results.push({
        id: `search-${Math.random().toString(36).substring(2, 10)}`,
        docId,
        title: data.title,
        snippet,
        similarityScore: score,
        keywords: uniqueTokens
      });
    }

    results.sort((a, b) => b.similarityScore - a.similarityScore);
    return results.slice(0, topK);
  }

  public clearIndex(): void {
    this.documentIndex.clear();
  }

  public get indexedDocumentCount(): number {
    return this.documentIndex.size;
  }
}
