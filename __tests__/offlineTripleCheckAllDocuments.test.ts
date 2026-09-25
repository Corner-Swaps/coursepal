import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { extractTextFromDocxBytes } from '../src/services/DocxTextExtractor';

function extractTextFromPdf(filePath: string): string {
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

describe('Master 100% Offline Triple Check Across All Reference Syllabi', () => {
  const syllabiDir = path.resolve(__dirname, '../src/assets/syllabi');
  const userUploadedDir = '/Users/slava/.gemini/antigravity/brain/4c112012-49ab-441f-be67-4845c016c820/.user_uploaded';

  // 1. PRJ-SEX-2026-X
  describe('Document 1: PRJ-SEX-2026-X (Critical Perspectives on Human Sexuality & Society)', () => {
    const pdfPath = path.join(syllabiDir, 'PRJ_SEX_2026_Human_Sexuality_Syllabus.pdf');
    let text: string;
    let dto: any;
    let norm: any;

    beforeAll(() => {
      text = extractTextFromPdf(pdfPath);
      dto = LocalSyllabusParser.shared.parseText(text);
      norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    });

    it('extracts course identity and reconstructed archival code with -X suffix', () => {
      expect(dto.courseCode).toBe('PRJ-SEX-2026-X');
      expect(dto.courseName).toBe('Critical Perspectives on Human Sexuality & Society');
    });

    it('extracts all 10 weekly readings with genuine authors and chapters/essays', () => {
      expect(dto.weeks?.length).toBe(10);
      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
      const weeklyReadings = cleanReadings.filter(r => r.weekNumber != null && r.weekNumber > 0);
      expect(weeklyReadings.length).toBe(10);

      // Check author diversity
      expect(weeklyReadings.some(r => r.authorName?.includes('Foucault'))).toBe(true);
      expect(weeklyReadings.some(r => r.authorName?.includes('Vance'))).toBe(true);
      expect(weeklyReadings.some(r => r.authorName?.includes('Butler'))).toBe(true);
      expect(weeklyReadings.some(r => r.authorName?.includes('Lorde'))).toBe(true);
      expect(weeklyReadings.some(r => r.authorName?.includes('Crimp'))).toBe(true);
    });

    it('extracts all 10 assignments with clean titles and deliverable notes', () => {
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      expect(cleanAssignments.length).toBe(10);
      expect(cleanAssignments[0].title).toBe('Discursive Field Mapping');
      expect(cleanAssignments[0].weekNumber).toBe(1);
      expect(cleanAssignments[0].noteText).toBe('1,500-word Critical Memo & Textual Deconstruction');
      expect(cleanAssignments[9].title).toBe('Culminating Capstone Research Proposal');
      expect(cleanAssignments[9].weekNumber).toBe(10);
      expect(cleanAssignments[9].noteText).toBe('3,000-word Integrated Research Thesis & Ethics Protocol');
    });

    it('preserves Zero Cross-Bleed on Page 5 Module Table', () => {
      expect(dto.moduleReadings?.length).toBe(10);
      dto.moduleReadings.forEach((mr: any) => {
        expect(mr.moduleNumber).toBeGreaterThanOrEqual(1);
        expect(mr.moduleNumber).toBeLessThanOrEqual(10);
        expect(mr.weekNumber).toBeUndefined();
        expect(mr.dueDate).toBeUndefined();
      });
    });
  });

  // 2. GSP 401
  describe('Document 2: GSP 401 (Gender, Sexuality, and Power: Critical Frameworks)', () => {
    const pdfPath = path.join(syllabiDir, 'GSP_401_Gender_Sexuality_Power_Syllabus.pdf');
    let text: string;
    let dto: any;
    let norm: any;

    beforeAll(() => {
      text = extractTextFromPdf(pdfPath);
      dto = LocalSyllabusParser.shared.parseText(text);
      norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    });

    it('extracts course code GSP 401 and 10 modules', () => {
      expect(dto.courseCode).toBe('GSP 401');
      expect(dto.courseName).toBe('Gender, Sexuality, and Power: Critical Frameworks');
      expect(dto.weeks?.length).toBe(10);
    });

    it('extracts 10 pure module readings', () => {
      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
      const modReadings = cleanReadings.filter(r => r.moduleNumber != null && r.moduleNumber > 0 && (r.weekNumber == null || r.weekNumber === 0));
      expect(modReadings.length).toBe(10);
    });

    it('extracts 10 assignments with honest weights and zero fabricated points (Rule 3)', () => {
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      expect(cleanAssignments.length).toBe(10);
      cleanAssignments.forEach((a: any) => {
        expect(a.pointsPossible).toBeNull();
        expect(a.weightPercentage).toBeTruthy();
      });
      expect(cleanAssignments[0].weightPercentage).toBe('5%');
      expect(cleanAssignments[9].weightPercentage).toBe('40%');
    });
  });

  // 3. DATA 630
  describe('Document 3: DATA 630 (Scalable Machine Learning Systems & Cloud AI Architectures)', () => {
    const pdfPath = path.join(syllabiDir, 'DATA_630_Scalable_ML_Systems_Syllabus.pdf');
    let text: string;
    let dto: any;
    let norm: any;

    beforeAll(() => {
      text = extractTextFromPdf(pdfPath);
      dto = LocalSyllabusParser.shared.parseText(text);
      norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    });

    it('extracts course code and title with compound ampersands', () => {
      expect(dto.courseCode).toBe('DATA 630');
      expect(dto.courseName).toContain('Scalable Machine Learning Systems');
    });

    it('extracts 11 weeks and 4 honest deliverables', () => {
      expect(norm.weeks.length).toBe(11);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      expect(cleanAssignments.length).toBe(4);
      expect(cleanAssignments.some((a: any) => a.title.includes('Architecture Seminar'))).toBe(true);
      expect(cleanAssignments.some((a: any) => a.title.includes('Distributed Training'))).toBe(true);
    });

    it('preserves engineering docs and whitepapers as readings', () => {
      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
      expect(cleanReadings.length).toBeGreaterThanOrEqual(15);
      expect(cleanReadings.some((r: any) => r.title.includes('Feast') || (r.resourceTitle || '').includes('Feast'))).toBe(true);
    });
  });

  // 4. NEUR 740
  describe('Document 4: NEUR 740 (Neuropsychological Assessment & Cognitive Rehabilitation)', () => {
    const pdfPath = path.join(syllabiDir, 'NEUR_740_Neuropsych_Assessment_Syllabus.pdf');
    let text: string;
    let dto: any;
    let norm: any;

    beforeAll(() => {
      text = extractTextFromPdf(pdfPath);
      dto = LocalSyllabusParser.shared.parseText(text);
      norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    });

    it('isolates course code and title without absorbing institutional department labels', () => {
      expect(dto.courseCode).toBe('NEUR 740');
      expect(dto.courseName).toBe('Neuropsychological Assessment & Cognitive Rehabilitation');
    });

    it('extracts clinical deliverables and multi-author readings cleanly', () => {
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      expect(cleanAssignments.length).toBe(4);

      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
      expect(cleanReadings.length).toBeGreaterThanOrEqual(10);
    });
  });

  // 5. PSYC 612
  describe('Document 5: PSYC 612 (Advanced Cognitive Behavioural Interventions)', () => {
    const pdfPath = path.join(syllabiDir, 'PSYC612_Syllabus.pdf');
    let text: string;
    let dto: any;
    let norm: any;

    beforeAll(() => {
      text = extractTextFromPdf(pdfPath);
      dto = LocalSyllabusParser.shared.parseText(text);
      norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    });

    it('extracts course code PSYC 612 and preserves parenthesized modality topics', () => {
      expect(dto.courseCode).toBe('PSYC 612');
      expect(dto.courseName).toContain('Advanced Cognitive Behavioural Interventions');
    });

    it('extracts weekly schedule and assignments', () => {
      expect(norm.weeks.length).toBeGreaterThanOrEqual(10);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      expect(cleanAssignments.length).toBeGreaterThanOrEqual(3);
    });
  });

  // 6. CPC 511
  describe('Document 6: CPC 511 (Psychology of Loss and Grief)', () => {
    const pdfPath = path.join(syllabiDir, 'CPC511_Syllabus.pdf');
    let text: string;
    let dto: any;
    let norm: any;

    beforeAll(() => {
      text = extractTextFromPdf(pdfPath);
      dto = LocalSyllabusParser.shared.parseText(text);
      norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    });

    it('extracts course code CPC 511 and 5 honest assignments', () => {
      expect(dto.courseCode).toBe('CPC 511');
      expect(dto.courseName).toBe('Psychology of Loss and Grief');
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      expect(cleanAssignments.length).toBe(5);
      cleanAssignments.forEach((a: any) => {
        expect(a.weightPercentage).toBeTruthy();
      });
    });
  });

  // 7. CPC 512 (Family Systems Approaches to Counselling)
  describe('Document 7: CPC 512 (Family Systems Approaches to Counselling - Dual Table)', () => {
    it('Audits CPC 512 administrative outline from PDF', () => {
      const pdfPath = path.join(syllabiDir, 'CPC512_Syllabus.pdf');
      const text = extractTextFromPdf(pdfPath);
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toBe('CPC 512');
      expect(dto.courseName).toBe('Family Systems Therapy');
      expect(dto.assignments?.length).toBeGreaterThan(0);
    });

    it('Audits CPC 512 Dual Table schedule from DOCX with pure on-device extraction', () => {
      const docxPath = path.join(userUploadedDir, 'media_1790265468641.docx');
      const bytes = fs.readFileSync(docxPath);
      const text = extractTextFromDocxBytes(bytes);
      expect(text.length).toBeGreaterThan(500);

      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toBe('CPC 512');
      expect(dto.courseName).toBe('Family Systems Approaches to Counselling');
      expect(dto.weeks?.length).toBe(12);
      expect(dto.moduleReadings?.length).toBe(10);

      // Verify Week 6 is reading week with 0 readings
      expect(dto.weeks![5].readings?.length || 0).toBe(0);
      // Verify Week 12 is flex week with 0 readings
      expect(dto.weeks![11].readings?.length || 0).toBe(0);
      // Zero cross bleed: module readings have no weekNumber
      dto.moduleReadings!.forEach((mr: any) => {
        expect(mr.weekNumber).toBeUndefined();
        expect(mr.moduleNumber).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // 8. CPC 514
  describe('Document 8: CPC 514 (Research Methods and Statistics)', () => {
    const pdfPath = path.join(syllabiDir, 'CPC514_Syllabus.pdf');
    let text: string;
    let dto: any;
    let norm: any;

    beforeAll(() => {
      text = extractTextFromPdf(pdfPath);
      dto = LocalSyllabusParser.shared.parseText(text);
      norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    });

    it('isolates course code CPC 514 from administrative section codes', () => {
      expect(dto.courseCode).toBe('CPC 514');
      expect(dto.courseName).toBe('Research Methods and Statistics');
    });

    it('maps genuine rubric points without arbitrary point fabrication', () => {
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      expect(cleanAssignments.length).toBeGreaterThanOrEqual(4);
      cleanAssignments.forEach((a: any) => {
        expect(a.title).toBeTruthy();
        expect(a.weightPercentage).toBeTruthy();
      });
    });
  });

  // 9. CPC 524
  describe('Document 9: CPC 524 (Psychopathology and Psychopharmacology)', () => {
    const pdfPath = path.join(userUploadedDir, 'media_1790266914971.pdf');
    let text: string;
    let dto: any;
    let norm: any;

    beforeAll(() => {
      text = extractTextFromPdf(pdfPath);
      dto = LocalSyllabusParser.shared.parseText(text);
      norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    });

    it('extracts course code CPC 524 and 12-week schedule with bundled modules kept together', () => {
      expect(dto.courseCode).toBe('CPC 524');
      expect(norm.weeks.length).toBe(12);
      // Week 7 bundles modules 7 & 8
      expect(norm.weeks[6].theme).toMatch(/Module\s*7\s*&\s*8/i);
      // Week 10 bundles modules 9 & 10
      expect(norm.weeks[9].theme).toMatch(/Module\s*9\s*&\s*10/i);
    });

    it('has zero fragmented readings', () => {
      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
      cleanReadings.forEach((r: any) => {
        expect(r.title).not.toMatch(/^Maddux\s*&$/i);
        expect(r.title).not.toMatch(/^Section\s*\d+$/i);
      });
    });
  });

  // 10. CPC 527
  describe('Document 10: CPC 527 (Group Counselling Psychology)', () => {
    const pdfPath = path.join(syllabiDir, 'CPC527_Syllabus.pdf');
    let text: string;
    let dto: any;
    let norm: any;

    beforeAll(() => {
      text = extractTextFromPdf(pdfPath);
      dto = LocalSyllabusParser.shared.parseText(text);
      norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    });

    it('resolves Corey and Yalom to full author names and maps 12 weeks', () => {
      expect(dto.courseCode).toBe('CPC 527');
      expect(norm.weeks.length).toBe(12);

      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
      expect(cleanReadings.some((r: any) => r.authorName === 'Gerald Corey')).toBe(true);
      expect(cleanReadings.some((r: any) => r.authorName === 'Irvin D. Yalom')).toBe(true);
    });

    it('identifies Week 8 as Reading Week with 0 readings', () => {
      expect(dto.weeks![7].readings?.length || 0).toBe(0);
      expect(norm.weeks[7].theme).toMatch(/Reading\s*Week/i);
    });
  });

  // 11. Reference Syllabi 1-10
  describe('Document Group 11: Eight Short Benchmark Syllabi (CS 501, BIO 412, etc.)', () => {
    const shortSyllabi = [
      { file: 'Syllabus_1_CS501.pdf', expectedCode: 'CS 501' },
      { file: 'Syllabus_2_BIO412.pdf', expectedCode: 'BIO 412' },
      { file: 'Syllabus_3_LAW702.pdf', expectedCode: 'LAW 702' },
      { file: 'Syllabus_6_ECON305.pdf', expectedCode: 'ECON 305' },
      { file: 'Syllabus_7_PHYS601.pdf', expectedCode: 'PHYS 601' },
      { file: 'Syllabus_8_HIST210.pdf', expectedCode: 'HIST 210' },
      { file: 'Syllabus_9_ART150.pdf', expectedCode: 'ART 150' },
      { file: 'Syllabus_10_PSYCH800.pdf', expectedCode: 'PSYCH 800' }
    ];

    shortSyllabi.forEach(({ file, expectedCode }) => {
      it(`Audits ${expectedCode} (${file}) cleanly offline`, () => {
        const filePath = path.join(syllabiDir, file);
        const text = extractTextFromPdf(filePath);
        const dto = LocalSyllabusParser.shared.parseText(text);
        expect(dto.courseCode).toBe(expectedCode);
        expect(dto.courseName).toBeTruthy();
        expect(dto.assignments?.length).toBeGreaterThan(0);
        expect(dto.weeks?.length).toBeGreaterThan(0);

        const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
        const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
        const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
        expect(cleanAssignments.length).toBeGreaterThan(0);
        expect(cleanReadings.length).toBeGreaterThan(0);
      });
    });
  });
});
