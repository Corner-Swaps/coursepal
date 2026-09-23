import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractTextFromPdf(filePath: string): string {
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

describe('Archetypal Syllabi Calibration & Training Verification Suite', () => {
  const parser = LocalSyllabusParser.shared;
  const importer = SyllabusImportManager.shared;
  const syllabiDir = path.resolve(__dirname, '../src/assets/syllabi');
  const userUploadedDir = '/Users/slava/.gemini/antigravity/brain/4c112012-49ab-441f-be67-4845c016c820/.user_uploaded';

  // =========================================================================
  // ARCHETYPE 1: Technical & Engineering MLOps/AI Architecture (DATA 630)
  // =========================================================================
  describe('Archetype 1: Technical & Engineering MLOps/AI Architecture (DATA 630)', () => {
    let rawText: string;

    beforeAll(() => {
      const p = path.join(syllabiDir, 'DATA_630_Scalable_ML_Systems_Syllabus.pdf');
      rawText = extractTextFromPdf(p);
    });

    it('extracts exact course identity and faculty info', () => {
      const dto = parser.parseText(rawText);
      expect(dto.courseCode).toBe('DATA 630');
      expect(dto.courseName).toBe('Scalable Machine Learning Systems & Cloud AI Architectures');
      expect(dto.instructorName).toBe('Marcus Vance, Ph.D.');
      expect(dto.instructorEmail).toBe('mvance@eng.cloudtech.edu');
    });

    it('extracts all 4 assignments with honest weights and clean deliverable format notes', () => {
      const dto = parser.parseText(rawText);
      expect(dto.assignments).toHaveLength(4);

      const a1 = dto.assignments?.find(a => a.title.includes('Distributed Training Benchmark'));
      expect(a1).toBeDefined();
      expect(a1?.weightPercentage).toBe('30%');
      expect(a1?.pointsPossible).toBeUndefined(); // Honest null points
      expect(a1?.noteText).toContain('Module 05');
      expect(a1?.noteText).toContain('8-Page Whitepaper');

      const a2 = dto.assignments?.find(a => a.title.includes('Production Inference Microservice'));
      expect(a2).toBeDefined();
      expect(a2?.weightPercentage).toBe('25%');
      expect(a2?.noteText).toContain('Module 08');
      expect(a2?.noteText).toContain('Containerized Service');

      const a3 = dto.assignments?.find(a => a.title.includes('Automated End-to-End MLOps Pipeline'));
      expect(a3).toBeDefined();
      expect(a3?.weightPercentage).toBe('30%');
      expect(a3?.noteText).toContain('Module 11');
      expect(a3?.noteText).toContain('Live Production Deployment');

      const a4 = dto.assignments?.find(a => a.title.includes('Architecture Seminar & Code Reviews'));
      expect(a4).toBeDefined();
      expect(a4?.weightPercentage).toBe('15%');
      expect(a4?.noteText).toContain('Continuous');
      expect(a4?.noteText).toContain('Bi-Weekly Lab Code Reviews');
    });

    it('extracts 21 technical readings across 11 weeks without losing specs or papers', () => {
      const dto = parser.parseText(rawText);
      expect(dto.weeks).toHaveLength(11);

      const norm = importer.normalizeAndValidateSyllabusPayload(dto, rawText);
      const cleanReadings = importer.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

      expect(cleanReadings).toHaveLength(21);

      // Verify specific technical papers and specs
      const feast = cleanReadings.find(r => r.title.includes('Feast Architecture Specs'));
      expect(feast).toBeDefined();
      expect(feast?.weekNumber).toBe(2);

      const pytorch = cleanReadings.find(r => r.title.includes('PyTorch Distributed Docs'));
      expect(pytorch).toBeDefined();
      expect(pytorch?.weekNumber).toBe(3);

      const vllm = cleanReadings.find(r => r.title.includes('vLLM Technical Paper'));
      expect(vllm).toBeDefined();
      expect(vllm?.weekNumber).toBe(6);

      const burns = cleanReadings.find(r => r.authorName?.includes('Burns') || r.title.includes('Burns'));
      expect(burns).toBeDefined();
      expect(burns?.weekNumber).toBe(7);
      expect(burns?.chapterText).toMatch(/4[–-]6/);
    });
  });

  // =========================================================================
  // ARCHETYPE 2: Clinical Neurosciences & Practicum Syllabi (NEUR 740)
  // =========================================================================
  describe('Archetype 2: Clinical Neurosciences & Practicum Syllabi (NEUR 740)', () => {
    let rawText: string;

    beforeAll(() => {
      const p = path.join(syllabiDir, 'NEUR_740_Neuropsych_Assessment_Syllabus.pdf');
      rawText = extractTextFromPdf(p);
    });

    it('isolates course title cleanly from institutional department header', () => {
      const dto = parser.parseText(rawText);
      expect(dto.courseCode).toBe('NEUR 740');
      expect(dto.courseName).toBe('Neuropsychological Assessment & Cognitive Rehabilitation');
      expect(dto.instructorName).toBe('Elena Vance, Ph.D., ABPP-CN');
      expect(dto.instructorEmail).toBe('evance@neuroclinic.edu');
    });

    it('extracts all 4 clinical deliverables with complete blueprint and table notes', () => {
      const dto = parser.parseText(rawText);
      expect(dto.assignments).toHaveLength(4);

      const a1 = dto.assignments?.find(a => a.title.includes('Diagnostic Battery Report') || a.title.includes('Comprehensive Neuropsychological Battery Report'));
      expect(a1).toBeDefined();
      expect(a1?.weightPercentage).toBe('35%');
      expect(a1?.noteText).toContain('Module 06');
      expect(a1?.noteText).toContain('Report & Table');

      const a2 = dto.assignments?.find(a => a.title.includes('Simulated Standardized Battery Administration'));
      expect(a2).toBeDefined();
      expect(a2?.weightPercentage).toBe('25%');
      expect(a2?.noteText).toContain('Module 08');
      expect(a2?.noteText).toContain('60-Minute Live Practical Exam');

      const a3 = dto.assignments?.find(a => a.title.includes('Cognitive Rehabilitation Protocol Design'));
      expect(a3).toBeDefined();
      expect(a3?.weightPercentage).toBe('20%');
      expect(a3?.noteText).toContain('Module 10');
      expect(a3?.noteText).toContain('8-Page Compensatory Strategy Blueprint');

      const a4 = dto.assignments?.find(a => a.title.includes('Case Conference Seminar & Grand Rounds'));
      expect(a4).toBeDefined();
      expect(a4?.weightPercentage).toBe('20%');
      expect(a4?.noteText).toContain('Continuous');
    });

    it('extracts 20 clinical readings with multi-author semicolon parsing and test manuals', () => {
      const dto = parser.parseText(rawText);
      expect(dto.weeks).toHaveLength(11);

      const norm = importer.normalizeAndValidateSyllabusPayload(dto, rawText);
      const cleanReadings = importer.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

      expect(cleanReadings).toHaveLength(20);

      // Verify Lezak et al. and Luria
      const lezak = cleanReadings.find(r => r.authorName?.includes('Lezak') || r.title.includes('Lezak'));
      expect(lezak).toBeDefined();
      expect(lezak?.weekNumber).toBe(1);

      const luria = cleanReadings.find(r => r.authorName?.includes('Luria') || r.title.includes('Luria'));
      expect(luria).toBeDefined();
      expect(luria?.weekNumber).toBe(1);

      // Verify test manuals in Week 8 and ethics guidelines in Week 11
      const labManual = cleanReadings.find(r => r.title.includes('Lab Testing Manual'));
      expect(labManual).toBeDefined();
      expect(labManual?.weekNumber).toBe(8);

      const ethics = cleanReadings.find(r => r.title.includes('APA Division 40 Ethics'));
      expect(ethics).toBeDefined();
      expect(ethics?.weekNumber).toBe(11);
    });
  });

  // =========================================================================
  // ARCHETYPE 3: Applied Psychology & Experiential Seminars (PSYC 612)
  // =========================================================================
  describe('Archetype 3: Applied Psychology & Experiential Seminars (PSYC 612)', () => {
    let rawText: string;

    beforeAll(() => {
      const p = path.join(syllabiDir, 'PSYC612_Syllabus.pdf');
      rawText = extractTextFromPdf(p);
    });

    it('extracts course identity and faculty info accurately', () => {
      const dto = parser.parseText(rawText);
      expect(dto.courseCode).toBe('PSYC 612');
      expect(dto.courseName).toBe('Advanced Cognitive Behavioural Interventions');
      expect(dto.instructorName).toBe('Aris Thorne, Ph.D., R.Psych.');
      expect(dto.instructorEmail).toBe('athorne@appliedpsych.edu');
    });

    it('extracts all 4 seminar deliverables including span targets (Modules 07-08)', () => {
      const dto = parser.parseText(rawText);
      expect(dto.assignments).toHaveLength(4);

      const a1 = dto.assignments?.find(a => a.title.includes('Case Formulation'));
      expect(a1).toBeDefined();
      expect(a1?.weightPercentage).toBe('35%');

      const a2 = dto.assignments?.find(a => a.title.includes('Simulated Dyadic Clinical Demonstration'));
      expect(a2).toBeDefined();
      expect(a2?.weightPercentage).toBe('30%');
      expect(a2?.noteText).toContain('Modules 07–08');

      const a3 = dto.assignments?.find(a => a.title.includes('Critical Peer Supervision & Consultation'));
      expect(a3).toBeDefined();
      expect(a3?.weightPercentage).toBe('15%');
      expect(a3?.noteText).toContain('Module 09');

      const a4 = dto.assignments?.find(a => a.title.includes('Seminar Engagement & Clinical Reflexivity'));
      expect(a4).toBeDefined();
      expect(a4?.weightPercentage).toBe('20%');
      expect(a4?.noteText).toContain('Continuous');
    });

    it('preserves parenthesized topic modalities and clinical assessment rating sheets', () => {
      const dto = parser.parseText(rawText);
      const week4 = dto.weeks?.find(w => w.weekNumber === 4);
      expect(week4?.theme).toContain('Acceptance & Mindfulness Architecture (ACT)');

      const norm = importer.normalizeAndValidateSyllabusPayload(dto, rawText);
      const cleanReadings = importer.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

      expect(cleanReadings).toHaveLength(15);

      const ctrs = cleanReadings.find(r => r.title.includes('CTRS Manual'));
      expect(ctrs).toBeDefined();

      const protocolSheets = cleanReadings.find(r => r.title.includes('Peer Consultation Protocol Sheets'));
      expect(protocolSheets).toBeDefined();
      expect(protocolSheets?.weekNumber).toBe(9);
    });
  });

  // =========================================================================
  // ARCHETYPE 4: Multi-Page Administrative Syllabi with Detailed Rubrics (CPC 514)
  // =========================================================================
  describe('Archetype 4: Multi-Page Administrative Syllabi with Rubrics (CPC 514)', () => {
    let rawText: string;

    beforeAll(() => {
      const p = path.join(userUploadedDir, 'media_1790050464127.pdf');
      rawText = extractTextFromPdf(p);
    });

    it('extracts course identity and faculty info cleanly', () => {
      const dto = parser.parseText(rawText);
      expect(dto.courseCode).toBe('CPC 514');
      expect(dto.courseName).toBe('Research Methods and Statistics');
      expect(dto.instructorName).toBe('Dr. Alireza Sedghi Taromi, PhD, RCC-ACS');
      expect(dto.instructorEmail).toBe('sedghitaromialireza@cityu.edu');
    });

    it('extracts all 5 assignments and reconciles detailed rubrics with exact criteria points', () => {
      const dto = parser.parseText(rawText);
      expect(dto.assignments).toHaveLength(5);

      // Assignment 1: 6 criteria, sum = 100
      const a1 = dto.assignments?.find(a => a.title.toLowerCase().includes('article analysis'));
      expect(a1).toBeDefined();
      expect(a1?.weightPercentage).toBe('20%');
      expect(a1?.rubricCriteria).toHaveLength(6);
      const a1Sum = a1?.rubricCriteria?.reduce((s, c) => s + (c.points || 0), 0);
      expect(a1Sum).toBe(100);

      // Assignment 2: 4 criteria (25 pts each), sum = 100, media URL preserved
      const a2 = dto.assignments?.find(a => a.title.toLowerCase().includes('discussion board'));
      expect(a2).toBeDefined();
      expect(a2?.weightPercentage).toBe('20%');
      expect(a2?.rubricCriteria).toHaveLength(4);
      expect(a2?.mediaUrl).toBe('https://presentationgeeks.com/blog/importance-of-presentation-feedback/');

      // Assignment 3: 5 criteria, sum = 100, due date Sep 13
      const a3 = dto.assignments?.find(a => a.title.toLowerCase().includes('group report'));
      expect(a3).toBeDefined();
      expect(a3?.weightPercentage).toBe('10%');
      expect(a3?.rubricCriteria).toHaveLength(5);
      expect(a3?.dueDate).toContain('2026-09-13');

      // Assignment 4: 6 criteria, sum = 100, due date Sep 6
      const a4 = dto.assignments?.find(a => a.title.toLowerCase().includes('study design'));
      expect(a4).toBeDefined();
      expect(a4?.weightPercentage).toBe('40%');
      expect(a4?.rubricCriteria).toHaveLength(6);
      expect(a4?.dueDate).toContain('2026-09-06');

      // Assignment 5: 2 criteria (50 pts each), sum = 100
      const a5 = dto.assignments?.find(a => a.title.toLowerCase().includes('participation'));
      expect(a5).toBeDefined();
      expect(a5?.weightPercentage).toBe('10%');
      expect(a5?.rubricCriteria).toHaveLength(2);
    });

    it('extracts Creswell required textbook without converting to weekly tasks', () => {
      const dto = parser.parseText(rawText);
      const norm = importer.normalizeAndValidateSyllabusPayload(dto, rawText);

      expect(norm.textbooks.length).toBeGreaterThanOrEqual(1);
      const creswell = norm.textbooks.find(t => t.title.toLowerCase().includes('research design'));
      expect(creswell).toBeDefined();
      expect(creswell?.authorName).toContain('Creswell');

      // Zero readings in weekly schedule because external schedule notice is detected
      const cleanReadings = importer.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
      expect(cleanReadings).toHaveLength(0);
    });
  });
});
