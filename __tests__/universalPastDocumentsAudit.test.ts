import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { healCanonicalCPC512 } from '../src/context/CoursePalContext';

function extractTextFromPdf(filePath: string): string {
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

describe('Universal Past Documents Audit Suite', () => {
  const userUploadedDir = '/Users/slava/.gemini/antigravity/brain/4c112012-49ab-441f-be67-4845c016c820/.user_uploaded';
  const syllabiDir = path.resolve(__dirname, '../src/assets/syllabi');

  describe('1. User-Uploaded Past Documents Audit', () => {
    it('Audits media_1790105675747.pdf (PRJ-SEX-2026-X: 5-Page Human Sexuality Dossier)', () => {
      const pdfPath = path.join(userUploadedDir, 'media_1790105675747.pdf');
      const text = extractTextFromPdf(pdfPath);
      expect(text.length).toBeGreaterThan(1000);

      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseName).toBe('Critical Perspectives on Human Sexuality & Society');
      expect(dto.courseCode).toBe('PRJ-SEX-2026-X');
      expect(dto.weeks?.length).toBe(10);
      expect(dto.assignments?.length).toBe(10);
      expect(dto.moduleReadings?.length).toBe(10);

      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

      expect(cleanAssignments.length).toBe(10);
      expect(cleanReadings.length).toBe(20);

      // Verify Zero Cross-Bleed
      const weekReadings = cleanReadings.filter(r => r.weekNumber != null && r.weekNumber > 0);
      const moduleReadings = cleanReadings.filter(r => r.moduleNumber != null && r.moduleNumber > 0 && (r.weekNumber == null || r.weekNumber === 0));
      expect(weekReadings.length).toBe(10);
      expect(moduleReadings.length).toBe(10);

      // Verify no fabricated points on assignments
      cleanAssignments.forEach(a => {
        expect(a.title).toBeTruthy();
        expect(a.weekNumber).toBeGreaterThan(0);
        expect(a.noteText).toBeTruthy();
      });
    });

    it('Audits media_1790097604894.pdf (PRJ-SEX-2026-X Secondary Copy)', () => {
      const pdfPath = path.join(userUploadedDir, 'media_1790097604894.pdf');
      const text = extractTextFromPdf(pdfPath);
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toBe('PRJ-SEX-2026-X');
      expect(dto.weeks?.length).toBe(10);
      expect(dto.assignments?.length).toBe(10);
    });

    it('Audits media_1790050464127.pdf (CPC 514: 12-Page Research Methods and Statistics)', () => {
      const pdfPath = path.join(userUploadedDir, 'media_1790050464127.pdf');
      const text = extractTextFromPdf(pdfPath);
      expect(text.length).toBeGreaterThan(1000);

      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toBe('CPC 514');
      expect(dto.courseName).toContain('Research Methods');
      expect(dto.instructorName).toContain('Alireza');
      expect(dto.instructorEmail).toBe('sedghitaromialireza@cityu.edu');

      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

      expect(cleanAssignments.length).toBeGreaterThanOrEqual(4);

      // Verify key assignments and rubric points
      const articleAnalysis = cleanAssignments.find(a => a.title.toLowerCase().includes('article analysis'));
      expect(articleAnalysis).toBeDefined();
      expect(articleAnalysis?.weightPercentage).toBe('20%');

      const discussionBoard = cleanAssignments.find(a => a.title.toLowerCase().includes('discussion board'));
      expect(discussionBoard).toBeDefined();
      expect(discussionBoard?.weightPercentage).toBe('20%');

      const groupReport = cleanAssignments.find(a => a.title.toLowerCase().includes('group report'));
      expect(groupReport).toBeDefined();
      expect(groupReport?.weightPercentage).toBe('10%');

      const studyDesign = cleanAssignments.find(a => a.title.toLowerCase().includes('study design'));
      expect(studyDesign).toBeDefined();
    });
  });

  describe('2. Bundled Core Course Syllabi Audit', () => {
    it('Audits CPC 511 (Intro to Counselling Psychology)', () => {
      const text = extractTextFromPdf(path.join(syllabiDir, 'CPC511_Syllabus.pdf'));
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toContain('CPC 511');

      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      expect(cleanAssignments.length).toBeGreaterThanOrEqual(4);
    });

    it('Audits CPC 512 (Family Systems: End-to-End Dual Table Modules vs Weeks with Zero Cross-Bleed)', () => {
      const text = extractTextFromPdf(path.join(syllabiDir, 'CPC512_Syllabus.pdf'));
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toContain('CPC 512');
      expect(dto.assignments?.length).toBeGreaterThanOrEqual(3);

      // Verify canonical dual-table healing
      const mockCourse: any = {
        id: 'c-cpc512-audit',
        courseCode: 'CPC 512',
        courseName: 'Family Systems Therapy',
        termWeeks: 12
      };
      const healed = healCanonicalCPC512([mockCourse], [], []);
      const pureModules = healed.readings.filter(r => r.moduleNumber && (!r.weekNumber || r.weekNumber === 0));
      const weeklyReadings = healed.readings.filter(r => (r.weekNumber || 0) > 0);

      expect(pureModules.length).toBe(10);
      expect(weeklyReadings.length).toBe(12);

      pureModules.forEach(m => {
        expect(m.weekNumber).toBeUndefined();
        expect(m.dueDate).toBeNull();
      });
    });

    it('Audits CPC 514 (Research Methods and Statistics)', () => {
      const text = extractTextFromPdf(path.join(syllabiDir, 'CPC514_Syllabus.pdf'));
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toBe('CPC 514');
      expect(dto.assignments?.length).toBeGreaterThanOrEqual(4);
    });

    it('Audits CPC 523 (Psychopathology & Psychopharmacology)', () => {
      const text = extractTextFromPdf(path.join(syllabiDir, 'CPC523_Syllabus.pdf'));
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toBe('CPC 523');

      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      expect(cleanAssignments.length).toBeGreaterThanOrEqual(3);
    });

    it('Audits CPC 527 (Group Counselling & Multi-Author Citations)', () => {
      const text = extractTextFromPdf(path.join(syllabiDir, 'CPC527_Syllabus.pdf'));
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toBe('CPC 527');

      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

      // Semicolon/comma author splitting: no mangled authors
      cleanReadings.forEach(r => {
        if (r.authorName) {
          expect(r.authorName).not.toContain(';');
        }
      });
    });

    it('Audits PSYC 612 (Advanced CBT Interventions)', () => {
      const text = extractTextFromPdf(path.join(syllabiDir, 'PSYC612_Syllabus.pdf'));
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toContain('PSYC 612');

      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      expect(cleanAssignments.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('3. Multi-Disciplinary Sample Syllabi Audit (CS, BIO, LAW, ECON, PHYS, HIST, ART, PSYCH)', () => {
    const multiDisciplinary = [
      { file: 'Syllabus_1_CS501.pdf', expectedCode: 'CS 501' },
      { file: 'Syllabus_2_BIO412.pdf', expectedCode: 'BIO 412' },
      { file: 'Syllabus_3_LAW702.pdf', expectedCode: 'LAW 702' },
      { file: 'Syllabus_6_ECON305.pdf', expectedCode: 'ECON 305' },
      { file: 'Syllabus_7_PHYS601.pdf', expectedCode: 'PHYS 601' },
      { file: 'Syllabus_8_HIST210.pdf', expectedCode: 'HIST 210' },
      { file: 'Syllabus_9_ART150.pdf', expectedCode: 'ART 150' },
      { file: 'Syllabus_10_PSYCH800.pdf', expectedCode: 'PSYCH 800' }
    ];

    multiDisciplinary.forEach(({ file, expectedCode }) => {
      it(`Audits ${file} (${expectedCode})`, () => {
        const text = extractTextFromPdf(path.join(syllabiDir, file));
        const dto = LocalSyllabusParser.shared.parseText(text);
        expect(dto.courseCode).toBe(expectedCode);

        const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
        const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
        const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

        expect(cleanAssignments.length).toBeGreaterThanOrEqual(1);
        expect(cleanAssignments.length + cleanReadings.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('4. Microsoft Word Ingestion Audit (.docx)', () => {
    const realDocxPath = '/Users/slava/Downloads/CPC 512 Reading and Assignment Schedule Summer 26.docx';

    it('Audits CPC 512 Reading and Assignment Schedule Summer 26.docx', () => {
      if (!fs.existsSync(realDocxPath)) {
        return;
      }
      const buffer = fs.readFileSync(realDocxPath);
      const { extractTextFromDocxBytes } = require('../src/services/DocxTextExtractor');
      const text = extractTextFromDocxBytes(new Uint8Array(buffer));

      expect(text.length).toBeGreaterThan(1000);
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toContain('CPC 512');
      expect(dto.weeks?.length).toBeGreaterThanOrEqual(10);
      expect(dto.moduleReadings?.length).toBe(10);

      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

      // Verify Zero Cross-Bleed
      const weekReadings = cleanReadings.filter(r => r.weekNumber != null && r.weekNumber > 0);
      const moduleReadings = cleanReadings.filter(r => r.moduleNumber != null && r.moduleNumber > 0 && (r.weekNumber == null || r.weekNumber === 0));

      expect(weekReadings.length).toBeGreaterThanOrEqual(10);
      expect(moduleReadings.length).toBe(10);
    });
  });

  describe('5. Downloads Directory Past Documents Audit', () => {
    const downloadsDir = '/Users/slava/Downloads';

    it('Audits DATA_630_Scalable_ML_Systems_Syllabus.pdf', () => {
      const p = path.join(downloadsDir, 'DATA_630_Scalable_ML_Systems_Syllabus.pdf');
      if (!fs.existsSync(p)) return;
      const text = extractTextFromPdf(p);
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toBe('DATA 630');
      expect(dto.courseName).toMatch(/Scalable Machine Learning Systems/i);
      expect(dto.instructorName).toContain('Marcus Vance');

      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

      expect(cleanAssignments.length).toBe(4);
      expect(cleanReadings.length).toBe(21);
      // Zero fabricated points
      cleanAssignments.forEach(a => {
        expect(a.pointsPossible).toBeNull();
      });
    });

    it('Audits NEUR_740_Neuropsych_Assessment_Syllabus.pdf', () => {
      const p = path.join(downloadsDir, 'NEUR_740_Neuropsych_Assessment_Syllabus.pdf');
      if (!fs.existsSync(p)) return;
      const text = extractTextFromPdf(p);
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toBe('NEUR 740');
      expect(dto.courseName).toBe('Neuropsychological Assessment & Cognitive Rehabilitation');
      expect(dto.instructorName).toContain('Elena Vance');
      expect(dto.instructorEmail).toBe('evance@neuroclinic.edu');

      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
      expect(cleanAssignments.length).toBe(4);
      expect(cleanReadings.length).toBe(20);
      cleanAssignments.forEach(a => {
        expect(a.pointsPossible).toBeNull();
      });
    });

    it('Audits PSYC_612_Advanced_CBT_Syllabus.pdf', () => {
      const p = path.join(downloadsDir, 'PSYC_612_Advanced_CBT_Syllabus.pdf');
      if (!fs.existsSync(p)) return;
      const text = extractTextFromPdf(p);
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toBe('PSYC 612');
      expect(dto.courseName).toBe('Advanced Cognitive Behavioural Interventions');
      expect(dto.instructorName).toContain('Aris Thorne');

      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

      expect(cleanAssignments.length).toBe(4);
      expect(cleanReadings.length).toBe(15);
      cleanAssignments.forEach(a => {
        expect(a.pointsPossible).toBeNull();
      });
    });

    it('Audits research_syllabus.pdf (CPC 514 in Downloads)', () => {
      const p = path.join(downloadsDir, 'research_syllabus.pdf');
      if (!fs.existsSync(p)) return;
      const text = extractTextFromPdf(p);
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toBe('CPC 514');
      expect(dto.courseName).toContain('Research Methods');

      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      expect(cleanAssignments.length).toBeGreaterThanOrEqual(4);
    });

    it('Audits Curriculum & Research Dossier_ Sexuality, Culture, and Society.pdf', () => {
      const p = path.join(downloadsDir, 'Curriculum & Research Dossier_ Sexuality, Culture, and Society.pdf');
      if (!fs.existsSync(p)) return;
      const text = extractTextFromPdf(p);
      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto.courseCode).toBe('PRJ-SEX-2026-X');
      expect(dto.courseName).toBe('Critical Perspectives on Human Sexuality & Society');

      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

      expect(cleanAssignments.length).toBe(10);
      expect(cleanReadings.length).toBe(20);
    });
  });
});

