import { NeuralDocumentService } from '../src/services/NeuralDocumentService';

describe('NeuralDocumentService Semantic Search', () => {
  let service: NeuralDocumentService;

  beforeEach(() => {
    service = new NeuralDocumentService();
  });

  it('tokenizes text into clean lowercase words without punctuation', () => {
    const tokens = service.tokenize('Research Methods & Statistics: Qualitative, Quantitative Approaches!');
    expect(tokens).toContain('research');
    expect(tokens).toContain('methods');
    expect(tokens).toContain('statistics');
    expect(tokens).toContain('qualitative');
    expect(tokens).toContain('quantitative');
    expect(tokens).toContain('approaches');
    // Words <= 2 characters are filtered out
    expect(tokens).not.toContain('&');
  });

  it('generates a normalized 64-dimensional embedding vector', () => {
    const vector = service.generateEmbedding('Creswell Research Design qualitative and quantitative methods');
    expect(vector).toHaveLength(64);

    // L2 norm of normalized vector should be approximately 1.0
    const norm = Math.sqrt(vector.reduce((acc, val) => acc + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 5);
  });

  it('returns all zeros for empty text embedding', () => {
    const vector = service.generateEmbedding('   ');
    expect(vector).toHaveLength(64);
    expect(vector.every(v => v === 0)).toBe(true);
  });

  it('indexes multiple documents and performs top-K semantic search', () => {
    service.trainOnDocument(
      'doc-1',
      'Research Methods in Psychology',
      'This course introduces qualitative and quantitative research methods, hypothesis testing, and statistical analyses.'
    );
    service.trainOnDocument(
      'doc-2',
      'Human Sexuality & Relationships',
      'Explore sexual development, attachment styles, relational intimacy, and psychological well-being.'
    );
    service.trainOnDocument(
      'doc-3',
      'Group Therapy & Counseling',
      'Theory and practice of group counseling, facilitation dynamics, initial stages, and termination.'
    );

    expect(service.indexedDocumentCount).toBe(3);

    // Query relevant to doc-1
    const results1 = service.search('statistical methods and quantitative research', 2);
    expect(results1).toHaveLength(2);
    expect(results1[0].docId).toBe('doc-1');
    expect(results1[0].similarityScore).toBeGreaterThan(0.5);

    // Query relevant to doc-2
    const results2 = service.search('intimacy and attachment styles in relationships', 2);
    expect(results2).toHaveLength(2);
    expect(results2[0].docId).toBe('doc-2');
    expect(results2[0].similarityScore).toBeGreaterThan(0.5);

    // Query relevant to doc-3
    const results3 = service.search('group dynamics and facilitation stages', 2);
    expect(results3).toHaveLength(2);
    expect(results3[0].docId).toBe('doc-3');
    expect(results3[0].similarityScore).toBeGreaterThan(0.5);
  });

  it('clears index successfully', () => {
    service.trainOnDocument('doc-1', 'Test', 'Content here');
    expect(service.indexedDocumentCount).toBe(1);
    service.clearIndex();
    expect(service.indexedDocumentCount).toBe(0);
  });
});
