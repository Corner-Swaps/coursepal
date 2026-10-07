import { reconstructPage, validatePageLayout } from '../src/services/LayoutReconstructor';
import { extractLayoutFromPDF } from '../src/services/PDFTextExtractor';
import { classifyBlock, classifyDocument } from '../src/services/DocumentClassifier';
import { scoreParse, LOW_CONFIDENCE_THRESHOLD } from '../src/services/ParseConfidence';
import { runAIExtractionIfNeeded } from '../src/services/AIExtractionService';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

const W = (text: string, x: number, y: number, w = 0.1, h = 0.02, confidence = 0.99) =>
  ({ text, confidence, x, y, w, h });

describe('Bulletproof Game Plan Suite (Red -> Green)', () => {
  // ==========================================
  // T1: LayoutReconstructor Unit Tests
  // ==========================================
  describe('T1: LayoutReconstructor (synthetic geometry)', () => {
    it('reconstructs lines from y-overlapping words in x order', () => {
      const words = [W('World', 0.20, 0.10), W('Hello', 0.08, 0.101)];
      const page = reconstructPage(words, 1);
      expect(page.lines.length).toBe(1);
      expect(page.lines[0].text).toBe('Hello World');
    });

    it('orders two columns left-then-right, top-to-bottom', () => {
      const words = [
        W('R1', 0.60, 0.10), W('R2', 0.60, 0.20), W('R3', 0.60, 0.30), W('R4', 0.60, 0.40),
        W('L1', 0.08, 0.10), W('L2', 0.08, 0.20), W('L3', 0.08, 0.30), W('L4', 0.08, 0.40),
      ];
      const page = reconstructPage(words, 1);
      expect(page.columnCount).toBe(2);
      expect(page.lines.map((l: any) => l.text)).toEqual(['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4']);
    });

    it('detects a 3x3 table grid with correct rows and cols', () => {
      const words: any[] = [];
      const cellTexts = [
        ['Week 1', 'Jul 2/3', 'Gehart ch 1-3'],
        ['Week 2', 'Jul 9/10', 'Gehart ch 5'],
        ['Week 3', 'Jul 16/17', 'Gehart ch 5 & 7']
      ];
      cellTexts.forEach((row, r) => row.forEach((t, c) => words.push(W(t, 0.05 + c * 0.3, 0.10 + r * 0.05, 0.25, 0.03))));
      const page = reconstructPage(words, 1);
      expect(page.tables.length).toBe(1);
      const t = page.tables[0];
      expect(t.rows).toBe(3);
      expect(t.cols).toBe(3);
      expect(t.cells.find((c: any) => c.row === 1 && c.col === 2)?.text).toBe('Gehart ch 5');
    });

    it('detects a vertically merged cell as rowSpan 2', () => {
      // one word spanning two row bands, no internal gap
      const words = [W('Merged', 0.05, 0.10, 0.25, 0.08), W('A', 0.40, 0.10), W('B', 0.40, 0.15)];
      const page = reconstructPage(words, 1);
      const t = page.tables[0];
      const merged = t.cells.find((c: any) => c.text === 'Merged');
      expect(merged?.rowSpan).toBe(2);
    });

    it('keeps empty cells as empty (never drops them)', () => {
      const words = [W('Week 6', 0.05, 0.10), /* col 2 empty */ W('No classes', 0.65, 0.10)];
      const page = reconstructPage(words, 1);
      const t = page.tables[0];
      expect(t.cells.find((c: any) => c.row === 0 && c.col === 1)?.text).toBe('');
    });
  });

  // ==========================================
  // T2: Native Contract Tests
  // ==========================================
  describe('T2: Native Contract (extractLayoutFromPDF)', () => {
    it('returns [] when the native module is unavailable (never throws)', async () => {
      const pages = await extractLayoutFromPDF('file:///nonexistent.pdf');
      expect(Array.isArray(pages)).toBe(true);
    });

    it('recorded sample matches the PageLayout shape', () => {
      const sample = [{
        pageNumber: 1,
        width: 1800,
        height: 2338,
        observations: [
          { text: 'Week 1', confidence: 0.98, box: { x: 0.08, y: 0.12, w: 0.10, h: 0.02 } }
        ]
      }];
      expect(validatePageLayout(sample)).toBe(true);
      expect(validatePageLayout([{ pageNumber: 1 }])).toBe(false); // missing observations
    });
  });

  // ==========================================
  // T3: Classification Tests
  // ==========================================
  describe('T3: DocumentClassifier', () => {
    it('CPC 512 page-1 modules table is topical, never a schedule', () => {
      const block = {
        headers: ['Modules', 'Topics', 'Related Readings'],
        rows: [
          ['Module 1', 'Systems Theory', 'Gehart (Chapters 1-3)'],
          ['Module 2', 'Genograms', 'Gehart (Chapter 2)']
        ]
      };
      expect(classifyBlock(block)).toBe('topical-table');
    });

    it('CPC 522 schedule table is a schedule-table', () => {
      const block = {
        headers: ['SESSION/DATE', 'MODULE(S), TOPICS AND ASSIGNMENTS', 'READINGS'],
        rows: [['Session 1 Oct 2', 'Introduction', 'Chapters 8, 9, 12']]
      };
      expect(classifyBlock(block)).toBe('schedule-table');
    });

    it('week numbers without dates are still a schedule-table (sequential fallback)', () => {
      const block = {
        headers: ['Week', 'Readings'],
        rows: [['Week 1', 'Ch 1-3'], ['Week 2', 'Ch 5']]
      };
      expect(classifyBlock(block)).toBe('schedule-table');
    });

    it('safety-record PDF classifies as not-a-syllabus', () => {
      const safetyRecordText = 'DAILY SAFETY AUDIT DISPATCH REPORT\nJobsite Incident Notification Milestone 1\nOSHA WorkSafeBC compliance';
      expect(classifyDocument(safetyRecordText)).toBe('not-a-syllabus');
    });

    it('routing rule: topical-table readings NEVER appear in week pipeline output', () => {
      const block = {
        headers: ['Modules', 'Topics', 'Related Readings'],
        rows: [
          ['Module 1', 'Systems Theory', 'Gehart (Chapters 1-3)'],
          ['Module 2', 'Genograms', 'Gehart (Chapter 2)']
        ]
      };
      const routed = SyllabusImportManager.shared.classifyAndRouteTable(block);
      expect(routed.classification).toBe('topical-table');
      expect(routed.topics).toBeDefined();
      expect(routed.topics?.length).toBeGreaterThan(0);

      const payload = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload({
        courseCode: 'CPC 512',
        courseName: 'Family Systems Approaches to Counselling',
        topicalTables: [block]
      });

      // Assert that topical-table readings NEVER appear in week pipeline output
      expect(payload.weeks.length).toBe(0);
      expect(payload.candidateReadings.length).toBe(0);
      expect(payload.topics).toBeDefined();
      expect(payload.topics?.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // T4: Confidence Tests
  // ==========================================
  describe('T4: ParseConfidence', () => {
    it('threshold constant is 60', () => {
      expect(LOW_CONFIDENCE_THRESHOLD).toBe(60);
    });

    it('perfect parse scores >= 90', () => {
      expect(scoreParse({ weightTotal: 100, rowsParsedRatio: 1, junkRate: 0, dateCoverage: 1, gateFired: false })).toBeGreaterThanOrEqual(90);
    });

    it('140% weights score below 60', () => {
      expect(scoreParse({ weightTotal: 140, rowsParsedRatio: 1, junkRate: 0, dateCoverage: 1, gateFired: false })).toBeLessThan(60);
    });

    it('junk-heavy parse scores below 60', () => {
      expect(scoreParse({ weightTotal: 100, rowsParsedRatio: 0.4, junkRate: 0.6, dateCoverage: 0.8, gateFired: false })).toBeLessThan(60);
    });

    it('safety record scores ~0', () => {
      expect(scoreParse({ weightTotal: 0, rowsParsedRatio: 0, junkRate: 1, dateCoverage: 0, gateFired: true })).toBeLessThanOrEqual(10);
    });

    it('one medium defect stays above threshold (75-ish)', () => {
      expect(scoreParse({ weightTotal: 100, rowsParsedRatio: 0.6, junkRate: 0.4, dateCoverage: 0.9, gateFired: false })).toBeGreaterThanOrEqual(60);
    });
  });

  // ==========================================
  // T5: AI Gating Tests (Mocked Network Boundary)
  // ==========================================
  describe('T5: AI Layer Gating (Layer 4)', () => {
    const mockFetch = jest.fn();
    const fivePages = Array.from({ length: 5 }, (_, i) => ({ pageNumber: i + 1, text: `page ${i + 1} text` }));

    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('never fires when confidence >= 60', async () => {
      const res = await runAIExtractionIfNeeded({ score: 75, apiKey: 'test-key', consent: true, pages: fivePages }, mockFetch);
      expect(res).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('never fires without an API key or consent', async () => {
      const resNoKey = await runAIExtractionIfNeeded({ score: 30, apiKey: null, consent: true, pages: fivePages }, mockFetch);
      expect(resNoKey).toBeNull();

      const resNoConsent = await runAIExtractionIfNeeded({ score: 30, apiKey: 'test-key', consent: false, pages: fivePages }, mockFetch);
      expect(resNoConsent).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('chunks by max 5 pages and merges deterministically', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          weeks: [{ weekNumber: 1, theme: 'Chunk Week' }],
          readings: [{ title: 'Chunk Reading', weekNumber: 1 }],
          assignments: [{ title: 'Chunk Assignment', weightPercentage: '20%' }]
        })
      });

      const twelvePages = Array.from({ length: 12 }, (_, i) => ({ pageNumber: i + 1, text: `page ${i + 1} text` }));
      const result = await runAIExtractionIfNeeded({ score: 30, apiKey: 'test-key', consent: true, pages: twelvePages }, mockFetch);

      expect(mockFetch).toHaveBeenCalledTimes(3); // 12 pages / 5 = 3 chunks
      expect(result).not.toBeNull();
      expect(result?.readings.length).toBeGreaterThan(0);
    });

    it('a failed chunk degrades to on-device result, never blocks import', async () => {
      mockFetch.mockRejectedValueOnce(new Error('timeout'));
      const result = await runAIExtractionIfNeeded({
        score: 30,
        apiKey: 'test-key',
        consent: true,
        pages: fivePages,
        onDeviceFallback: { weeks: [], readings: [], assignments: [] }
      }, mockFetch);

      expect(result).not.toBeNull();
      expect(result?.usedFallbackForFailedChunks).toBe(true);
    });

    it('structured output: rejects non-conforming JSON (retryable error, not silent garbage)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ prose: 'here is your schedule...' })
      });

      await expect(runAIExtractionIfNeeded({
        score: 30,
        apiKey: 'test-key',
        consent: true,
        pages: fivePages
      }, mockFetch)).rejects.toThrow(/schema/i);
    });
  });
});
