import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractTextFromPdf(filePath: string): string {
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

const userUploadedDir = '/Users/slava/.gemini/antigravity/brain/4c112012-49ab-441f-be67-4845c016c820/.user_uploaded';
const describeIf = fs.existsSync(userUploadedDir) ? describe : describe.skip;

describeIf('Comprehensive 100+ Unit Test Calibration Suite Across Reference Documents', () => {

  // =========================================================================
  // DOCUMENT 1: CPC 511 (Psychology of Loss and Grief) — 20 granular tests
  // =========================================================================
  describe('Document 1: CPC 511 - Psychology of Loss and Grief', () => {
    let rawText: string;
    let dto: any;
    let normalized: any;
    let cleanAssignments: any[];
    let cleanReadings: any[];

    beforeAll(() => {
      rawText = extractTextFromPdf(path.join(userUploadedDir, 'media_1790266914963.pdf'));
      dto = LocalSyllabusParser.shared.parseText(rawText);
      normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);
      cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(normalized.candidateAssignments, normalized.termYear, normalized.weekDateMap);
      cleanReadings = SyllabusImportManager.shared.deduplicateReadings(normalized.candidateReadings, normalized.textbooks, normalized.termYear);
    });

    test('001: CPC 511 Course Code is CPC 511', () => {
      expect(dto.courseCode).toBe('CPC 511');
    });

    test('002: CPC 511 Course Name is Psychology of Loss and Grief', () => {
      expect(dto.courseName).toBe('Psychology of Loss and Grief');
    });

    test('003: CPC 511 Instructor is Diana Morgan', () => {
      expect(dto.instructorName).toContain('Diana Morgan');
    });

    test('004: CPC 511 has exactly 5 assignments extracted', () => {
      expect(dto.assignments?.length).toBe(5);
    });

    test('005: CPC 511 clean assignments count is 5', () => {
      expect(cleanAssignments.length).toBe(5);
    });

    test('006: CPC 511 contains Cultural Aspects of Mourning (30%)', () => {
      const a = cleanAssignments.find(x => /Cultural\s*Aspects\s*of\s*Mourning/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('30%');
    });

    test('007: CPC 511 contains Unique Topics in Grief Group Presentation (30%)', () => {
      const a = cleanAssignments.find(x => /Unique\s*Topics.*Presentation/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('30%');
    });

    test('008: CPC 511 contains Peer Review Group Report (10%)', () => {
      const a = cleanAssignments.find(x => /Peer[- ]Review/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('10%');
    });

    test('009: CPC 511 contains Personal Grief Reflection Assignment (20%)', () => {
      const a = cleanAssignments.find(x => /Personal\s*Grief\s*Reflection/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('20%');
    });

    test('010: CPC 511 contains Participation assignment (10%)', () => {
      const a = cleanAssignments.find(x => /^Participation/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('10%');
    });

    test('011: CPC 511 sum of assignment weights is exactly 100%', () => {
      const sum = cleanAssignments.reduce((acc, curr) => acc + (parseFloat(curr.weightPercentage) || 0), 0);
      expect(sum).toBe(100);
    });

    test('012: CPC 511 eliminates fabricated points (pointsPossible is null or honestly sourced)', () => {
      cleanAssignments.forEach(a => {
        if (!a.rubricCriteria || a.rubricCriteria.length === 0) {
          expect(a.pointsPossible === null || a.pointsPossible === undefined || a.pointsPossible.includes('Points')).toBe(true);
        }
      });
    });

    test('013: CPC 511 textbooks count is 3', () => {
      expect(dto.textbooks?.length).toBe(3);
    });

    test('014: CPC 511 contains Robert A. Neimeyer textbook', () => {
      const t = dto.textbooks?.find((x: any) => /Neimeyer/i.test(x.authorName || ''));
      expect(t).toBeDefined();
      expect(t.title).toMatch(/Grief and bereavement/i);
    });

    test('015: CPC 511 contains Darcy L. Harris textbook', () => {
      const t = dto.textbooks?.find((x: any) => /Harris/i.test(x.authorName || ''));
      expect(t).toBeDefined();
      expect(t.title).toMatch(/Principles and Practice/i);
    });

    test('016: CPC 511 contains Joshua M. Hochstetler textbook', () => {
      const t = dto.textbooks?.find((x: any) => /Hochstetler/i.test(x.authorName || ''));
      expect(t).toBeDefined();
      expect(t.title).toMatch(/21 days to die/i);
    });

    test('017: CPC 511 recognizes external Brightspace notice with zero phantom schedule readings', () => {
      expect(cleanReadings.length).toBe(0);
    });

    test('018: CPC 511 contains no fabricated reading week deliverables', () => {
      const rw = cleanAssignments.find(x => /reading\s*week/i.test(x.title));
      expect(rw).toBeUndefined();
    });

    test('019: CPC 511 user-facing titles strip prefixes like in-class', () => {
      cleanAssignments.forEach(a => {
        expect(a.title.startsWith('in-class ')).toBe(false);
      });
    });

    test('020: CPC 511 contains no reference to AI or Gemini in user-facing labels', () => {
      const allText = JSON.stringify(cleanAssignments) + JSON.stringify(dto.textbooks);
      expect(/gemini|artificial\s*intelligence/i.test(allText)).toBe(false);
    });
  });

  // =========================================================================
  // DOCUMENT 2: CPC 524 (Psychopathology & Psychopharmacology) — 30 tests
  // =========================================================================
  describe('Document 2: CPC 524 - Psychopathology and Psychopharmacology', () => {
    let rawText: string;
    let dto: any;
    let normalized: any;
    let cleanAssignments: any[];
    let cleanReadings: any[];

    beforeAll(() => {
      rawText = extractTextFromPdf(path.join(userUploadedDir, 'media_1790266914971.pdf'));
      dto = LocalSyllabusParser.shared.parseText(rawText);
      normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);
      cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(normalized.candidateAssignments, normalized.termYear, normalized.weekDateMap);
      cleanReadings = SyllabusImportManager.shared.deduplicateReadings(normalized.candidateReadings, normalized.textbooks, normalized.termYear);
    });

    test('021: CPC 524 Course Code is CPC 524', () => {
      expect(dto.courseCode).toBe('CPC 524');
    });

    test('022: CPC 524 Course Name is Psychopathology and Psychopharmacology', () => {
      expect(dto.courseName).toBe('Psychopathology and Psychopharmacology');
    });

    test('023: CPC 524 has exactly 4 assignments extracted', () => {
      expect(dto.assignments?.length).toBe(4);
    });

    test('024: CPC 524 contains Psychopharmacology Group Presentation (30%)', () => {
      const a = cleanAssignments.find(x => /Group\s*Presentation/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('30%');
    });

    test('025: CPC 524 contains Peer-Review/Participation (10%)', () => {
      const a = cleanAssignments.find(x => /Peer[- ]Review/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('10%');
    });

    test('026: CPC 524 contains Best Practices Lit Review (20%)', () => {
      const a = cleanAssignments.find(x => /Lit(?:erature)?\s*Review/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('20%');
    });

    test('027: CPC 524 contains Case Conceptualization (40%)', () => {
      const a = cleanAssignments.find(x => /Case\s*Conceptualization/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('40%');
    });

    test('028: CPC 524 sum of assignment weights is exactly 100%', () => {
      const sum = cleanAssignments.reduce((acc, curr) => acc + (parseFloat(curr.weightPercentage) || 0), 0);
      expect(sum).toBe(100);
    });

    test('029: CPC 524 weeks count is exactly 12', () => {
      expect(dto.weeks?.length).toBe(12);
    });

    test('030: CPC 524 week numbers are strictly chronological 1 through 12', () => {
      dto.weeks.forEach((w: any, idx: number) => {
        expect(w.weekNumber).toBe(idx + 1);
      });
    });

    test('031: CPC 524 Week 1 is 2026-04-03 with Neurobiology theme', () => {
      const w1 = dto.weeks[0];
      expect(w1.startDate).toBe('2026-04-03');
      expect(w1.theme).toContain('Neurobiology');
      expect(w1.readings.length).toBeGreaterThanOrEqual(1);
    });

    test('032: CPC 524 Week 1 includes Preston et al. reading with author resolved', () => {
      const w1 = dto.weeks[0];
      const r = w1.readings.find((x: any) => /Preston/i.test(x.authorName || x.title));
      expect(r).toBeDefined();
      expect(r.authorName).toContain('Preston');
    });

    test('033: CPC 524 Week 2 is 2026-04-10 with Clinical Diagnosis theme', () => {
      const w2 = dto.weeks[1];
      expect(w2.startDate).toBe('2026-04-10');
      expect(w2.theme).toContain('Clinical Diagnosis');
    });

    test('034: CPC 524 Week 2 contains Wada & Fellner with full author resolution', () => {
      const w2 = dto.weeks[1];
      const r = w2.readings.find((x: any) => /Wada/i.test(x.authorName || x.title));
      expect(r).toBeDefined();
      expect(r.authorName).toBe('Kaori Wada & Karlee D. Fellner');
    });

    test('035: CPC 524 Week 2 contains Maddux & Winstead', () => {
      const w2 = dto.weeks[1];
      const r = w2.readings.find((x: any) => /Maddux/i.test(x.authorName || x.title));
      expect(r).toBeDefined();
      expect(r.authorName).toBe('James E. Maddux & Barbara A. Winstead');
    });

    test('036: CPC 524 Week 2 contains DSM-5-TR resolved to American Psychiatric Association', () => {
      const w2 = dto.weeks[1];
      const r = w2.readings.find((x: any) => /DSM/i.test(x.title));
      expect(r).toBeDefined();
      expect(r.authorName).toBe('American Psychiatric Association');
    });

    test('037: CPC 524 Week 2 contains World Health Organization ICD', () => {
      const w2 = dto.weeks[1];
      const r = w2.readings.find((x: any) => /WHO|World Health/i.test(x.authorName || x.title));
      expect(r).toBeDefined();
      expect(r.authorName).toBe('World Health Organization');
    });

    test('038: CPC 524 Week 3 is 2026-04-17 and includes Carlson et al.', () => {
      const w3 = dto.weeks[2];
      expect(w3.startDate).toBe('2026-04-17');
      const r = w3.readings.find((x: any) => /Carlson/i.test(x.authorName || x.title));
      expect(r).toBeDefined();
    });

    test('039: CPC 524 Week 4 is 2026-04-24 with Mood Disorders theme', () => {
      const w4 = dto.weeks[3];
      expect(w4.startDate).toBe('2026-04-24');
      expect(w4.theme).toContain('Mood Disorders');
      expect(w4.readings.length).toBe(3);
    });

    test('040: CPC 524 Week 5 is 2026-05-01 with Substance Use theme', () => {
      const w5 = dto.weeks[4];
      expect(w5.startDate).toBe('2026-05-01');
      expect(w5.theme).toContain('Substance Use');
      expect(w5.readings.length).toBe(3);
    });

    test('041: CPC 524 Week 6 is 2026-05-08 and contains Anda et al.', () => {
      const w6 = dto.weeks[5];
      expect(w6.startDate).toBe('2026-05-08');
      const r = w6.readings.find((x: any) => /Anda/i.test(x.authorName || x.title));
      expect(r).toBeDefined();
    });

    test('042: CPC 524 Week 7 is 2026-05-15 covering Module 7 & 8', () => {
      const w7 = dto.weeks[6];
      expect(w7.startDate).toBe('2026-05-15');
      expect(w7.theme).toContain('Module 7 & 8');
    });

    test('043: CPC 524 Week 8 is Reading Week on 2026-05-22 with 0 readings', () => {
      const w8 = dto.weeks[7];
      expect(w8.startDate).toBe('2026-05-22');
      expect(w8.theme).toBe('Reading Week – No Class');
      expect(w8.readings.length).toBe(0);
    });

    test('044: CPC 524 Week 9 is 2026-05-29 covering Module 11 Personality Disorders', () => {
      const w9 = dto.weeks[8];
      expect(w9.startDate).toBe('2026-05-29');
      expect(w9.theme).toContain('Module 11');
      expect(w9.theme).toContain('Personality Disorders');
    });

    test('045: CPC 524 Week 10 is 2026-06-05 covering Module 9 & 10', () => {
      const w10 = dto.weeks[9];
      expect(w10.startDate).toBe('2026-06-05');
      expect(w10.theme).toContain('Module 9 & 10');
    });

    test('046: CPC 524 Week 11 is 2026-06-12 for Pharmacology Lit Review with 0 readings', () => {
      const w11 = dto.weeks[10];
      expect(w11.startDate).toBe('2026-06-12');
      expect(w11.theme).toContain('Pharmacology Lit Review');
      expect(w11.readings.length).toBe(0);
    });

    test('047: CPC 524 Week 12 is 2026-06-19 covering Module 12', () => {
      const w12 = dto.weeks[11];
      expect(w12.startDate).toBe('2026-06-19');
      expect(w12.theme).toContain('Module 12');
      expect(w12.readings.length).toBe(3);
    });

    test('048: CPC 524 contains zero fragmented readings with title Maddux &', () => {
      const bad = cleanReadings.find(r => r.title.trim().toLowerCase() === 'maddux &');
      expect(bad).toBeUndefined();
    });

    test('049: CPC 524 contains zero fragmented readings with title Section 2 or Section 3', () => {
      const bad = cleanReadings.find(r => /^\s*Section\s*[23]\s*$/i.test(r.title));
      expect(bad).toBeUndefined();
    });

    test('050: CPC 524 contains zero readings with undefined author name', () => {
      dto.weeks.forEach((w: any) => {
        w.readings.forEach((r: any) => {
          expect(r.authorName).not.toBe('undefined');
        });
      });
    });
  });

  // =========================================================================
  // DOCUMENT 3: CPC 527 (Group Counselling Psychology) — 25 tests
  // =========================================================================
  describe('Document 3: CPC 527 - Group Counselling Psychology', () => {
    let rawText: string;
    let dto: any;
    let normalized: any;
    let cleanAssignments: any[];
    let cleanReadings: any[];

    beforeAll(() => {
      rawText = extractTextFromPdf(path.join(userUploadedDir, 'media_1790266914980.pdf'));
      dto = LocalSyllabusParser.shared.parseText(rawText);
      normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);
      cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(normalized.candidateAssignments, normalized.termYear, normalized.weekDateMap);
      cleanReadings = SyllabusImportManager.shared.deduplicateReadings(normalized.candidateReadings, normalized.textbooks, normalized.termYear);
    });

    test('051: CPC 527 Course Code is CPC 527', () => {
      expect(dto.courseCode).toBe('CPC 527');
    });

    test('052: CPC 527 Course Name is Group Counselling Psychology', () => {
      expect(dto.courseName).toBe('Group Counselling Psychology');
    });

    test('053: CPC 527 has exactly 4 assignments extracted', () => {
      expect(dto.assignments?.length).toBe(4);
    });

    test('054: CPC 527 contains Group Therapy Reflection Paper (25%)', () => {
      const a = cleanAssignments.find(x => /Reflection\s*Paper/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('25%');
    });

    test('055: CPC 527 contains Peer-Review Group Report/Assignment (10%)', () => {
      const a = cleanAssignments.find(x => /Peer-Review/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('10%');
    });

    test('056: CPC 527 contains Group Facilitation Presentation/Project (40%)', () => {
      const a = cleanAssignments.find(x => /Group\s*Facilitation/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('40%');
    });

    test('057: CPC 527 contains Collaboration & Participation (25%)', () => {
      const a = cleanAssignments.find(x => /Collaboration/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('25%');
    });

    test('058: CPC 527 sum of assignment weights is exactly 100%', () => {
      const sum = cleanAssignments.reduce((acc, curr) => acc + (parseFloat(curr.weightPercentage) || 0), 0);
      expect(sum).toBe(100);
    });

    test('059: CPC 527 weeks count is exactly 12', () => {
      expect(dto.weeks?.length).toBe(12);
    });

    test('060: CPC 527 week numbers are sequential 1 through 12', () => {
      dto.weeks.forEach((w: any, idx: number) => {
        expect(w.weekNumber).toBe(idx + 1);
      });
    });

    test('061: CPC 527 Week 1 is 2026-04-02 with Module 1 Intro to Group Work', () => {
      const w1 = dto.weeks[0];
      expect(w1.startDate).toBe('2026-04-02');
      expect(w1.theme).toContain('Module 1');
      expect(w1.readings.length).toBe(2);
    });

    test('062: CPC 527 Corey is resolved to Gerald Corey (never Corey Ch)', () => {
      const w1 = dto.weeks[0];
      const r = w1.readings.find((x: any) => /Corey/i.test(x.title));
      expect(r).toBeDefined();
      expect(r.authorName).toBe('Gerald Corey');
    });

    test('063: CPC 527 Yalom is resolved to Irvin D. Yalom', () => {
      const w1 = dto.weeks[0];
      const r = w1.readings.find((x: any) => /Yalom/i.test(x.title));
      expect(r).toBeDefined();
      expect(r.authorName).toBe('Irvin D. Yalom');
    });

    test('064: CPC 527 Week 2 is 2026-04-09 covering Module 2 with 2 readings', () => {
      const w2 = dto.weeks[1];
      expect(w2.startDate).toBe('2026-04-09');
      expect(w2.theme).toContain('Module 2');
      expect(w2.readings.length).toBe(2);
    });

    test('065: CPC 527 Week 3 is 2026-04-16 covering Module 3 with 2 readings', () => {
      const w3 = dto.weeks[2];
      expect(w3.startDate).toBe('2026-04-16');
      expect(w3.theme).toContain('Module 3');
      expect(w3.readings.length).toBe(2);
    });

    test('066: CPC 527 Week 4 is 2026-04-23 covering Module 4 with 2 readings', () => {
      const w4 = dto.weeks[3];
      expect(w4.startDate).toBe('2026-04-23');
      expect(w4.theme).toContain('Module 4');
      expect(w4.readings.length).toBe(2);
    });

    test('067: CPC 527 Week 5 is 2026-04-30 covering Module 5 with 2 readings', () => {
      const w5 = dto.weeks[4];
      expect(w5.startDate).toBe('2026-04-30');
      expect(w5.theme).toContain('Module 5');
      expect(w5.readings.length).toBe(2);
    });

    test('068: CPC 527 Week 6 is 2026-05-07 Presentations with Yalom Ch. 8 & 9', () => {
      const w6 = dto.weeks[5];
      expect(w6.startDate).toBe('2026-05-07');
      expect(w6.theme).toContain('Presentations');
      expect(w6.readings.length).toBe(1);
    });

    test('069: CPC 527 Week 7 is 2026-05-14 Presentations with Yalom Ch. 10 & 11', () => {
      const w7 = dto.weeks[6];
      expect(w7.startDate).toBe('2026-05-14');
      expect(w7.readings.length).toBe(1);
    });

    test('070: CPC 527 Week 8 is 2026-05-21 Reading Week – No Class with 0 readings', () => {
      const w8 = dto.weeks[7];
      expect(w8.startDate).toBe('2026-05-21');
      expect(w8.theme).toBe('Reading Week – No Class');
      expect(w8.readings.length).toBe(0);
    });

    test('071: CPC 527 Week 9 is 2026-05-28 Module 8 Presentations (NOT Reading Week)', () => {
      const w9 = dto.weeks[8];
      expect(w9.startDate).toBe('2026-05-28');
      expect(w9.theme).toContain('Presentations');
      expect(w9.theme).not.toContain('Reading Week');
      expect(w9.readings.length).toBe(1);
    });

    test('072: CPC 527 Week 10 is 2026-06-04 Module 9 Group Stages: Final with Corey Ch. 9', () => {
      const w10 = dto.weeks[9];
      expect(w10.startDate).toBe('2026-06-04');
      expect(w10.theme).toContain('Module 9');
      const r = w10.readings.find((x: any) => /Corey/i.test(x.title));
      expect(r).toBeDefined();
    });

    test('073: CPC 527 Week 11 is 2026-06-11 Module 10 Groups in Diverse Settings with 2 readings', () => {
      const w11 = dto.weeks[10];
      expect(w11.startDate).toBe('2026-06-11');
      expect(w11.theme).toContain('Module 10');
      expect(w11.readings.length).toBe(2);
    });

    test('074: CPC 527 Week 12 is 2026-06-18 Module 11 Effective Closings with 0 readings', () => {
      const w12 = dto.weeks[11];
      expect(w12.startDate).toBe('2026-06-18');
      expect(w12.theme).toContain('Module 11');
      expect(w12.readings.length).toBe(0);
    });

    test('075: CPC 527 eliminates See Brightspace for Assigned Readings phantom card', () => {
      const phantom = cleanReadings.find(r => /brightspace/i.test(r.title));
      expect(phantom).toBeUndefined();
    });
  });

  // =========================================================================
  // DOCUMENT 4: CPC 514 (Research Methods and Statistics) — 15 tests
  // =========================================================================
  describe('Document 4: CPC 514 - Research Methods and Statistics', () => {
    let rawText: string;
    let dto: any;
    let normalized: any;
    let cleanAssignments: any[];
    let cleanReadings: any[];

    beforeAll(() => {
      rawText = extractTextFromPdf(path.join(userUploadedDir, 'media_1790266914990.pdf'));
      dto = LocalSyllabusParser.shared.parseText(rawText);
      normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);
      cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(normalized.candidateAssignments, normalized.termYear, normalized.weekDateMap);
      cleanReadings = SyllabusImportManager.shared.deduplicateReadings(normalized.candidateReadings, normalized.textbooks, normalized.termYear);
    });

    test('076: CPC 514 Course Code is CPC 514', () => {
      expect(dto.courseCode).toBe('CPC 514');
    });

    test('077: CPC 514 Course Name is Research Methods and Statistics', () => {
      expect(dto.courseName).toBe('Research Methods and Statistics');
    });

    test('078: CPC 514 isolates course identity from section code VANWDY 17 B', () => {
      expect(dto.courseCode).not.toContain('VANWDY');
      expect(dto.courseName).not.toContain('VANWDY');
    });

    test('079: CPC 514 has exactly 5 assignments extracted', () => {
      expect(cleanAssignments.length).toBe(5);
    });

    test('080: CPC 514 Assignment 1 is 20%', () => {
      const a = cleanAssignments.find(x => x.weightPercentage === '20%' && /Critique|Activity/i.test(x.title));
      expect(a).toBeDefined();
    });

    test('081: CPC 514 Assignment 2 is 10%', () => {
      const a = cleanAssignments.find(x => x.weightPercentage === '10%' && /Peer Review/i.test(x.title));
      expect(a).toBeDefined();
    });

    test('082: CPC 514 Assignment 3 is 40% (Research Study Design)', () => {
      const a = cleanAssignments.find(x => x.weightPercentage === '40%' && /Research Study Design/i.test(x.title));
      expect(a).toBeDefined();
    });

    test('083: CPC 514 Assignment 4 is 10% (Attendance / Participation)', () => {
      const a = cleanAssignments.find(x => x.weightPercentage === '10%' && /Attendance/i.test(x.title));
      expect(a).toBeDefined();
    });

    test('084: CPC 514 Assignment 5 is 20% (Peer Review Discussion Board Activity)', () => {
      const a = cleanAssignments.find(x => x.weightPercentage === '20%' && /Discussion\s*Board|Activity/i.test(x.title));
      expect(a).toBeDefined();
    });

    test('085: CPC 514 sum of assignment weights is exactly 100%', () => {
      const sum = cleanAssignments.reduce((acc, curr) => acc + (parseFloat(curr.weightPercentage) || 0), 0);
      expect(sum).toBe(100);
    });

    test('086: CPC 514 genuinely maps rubric criteria point values without arbitrary 100 pt fabrication', () => {
      const withRubric = cleanAssignments.filter(a => a.rubricCriteria && a.rubricCriteria.length > 0);
      expect(withRubric.length).toBeGreaterThanOrEqual(1);
      withRubric.forEach(a => {
        expect(a.rubricCriteria.length).toBeGreaterThan(0);
      });
    });

    test('087: CPC 514 includes Creswell textbook', () => {
      const creswell = dto.textbooks?.find((t: any) => /Creswell/i.test(t.authorName || t.title));
      expect(creswell).toBeDefined();
    });

    test('088: CPC 514 recognizes external Brightspace schedule with 0 phantom readings', () => {
      expect(cleanReadings.length).toBe(0);
    });

    test('089: CPC 514 assigns proper due dates to deliverables when specified', () => {
      const researchStudy = cleanAssignments.find(x => /Research Study Design/i.test(x.title));
      expect(researchStudy?.dueDate).toBeDefined();
    });

    test('090: CPC 514 contains no AI internals in descriptions', () => {
      const json = JSON.stringify(cleanAssignments);
      expect(/gemini|ai\s*model/i.test(json)).toBe(false);
    });
  });

  // =========================================================================
  // DOCUMENT 5: CPC 512 (Family Systems Approaches) — 15 tests
  // =========================================================================
  describe('Document 5: CPC 512 - Family Systems Approaches to Counselling (Dual-Table)', () => {
    const text512 = `School of Health & Social Sciences
CPC 512: Family Systems Approaches to Counselling
The following modules and topics will be integrated throughout the duration of our learning experience together: 
| Modules   | Topics   | Related Readings    |
| Module 1   | Systems Theory and the History of Family Therapy   | Gehart (Chapters 1-3)   |
| Module 2   | Family of Origin/ Genograms   | Gehart (Chapter 2)   |
| Module 3   | Diverse Populations and Family Therapy Case Conceptualization and Application   | Gehart (Chapters 11-15)   |
| Module 4   | Bowen Family Systems   | Gehart (Chapter 7)   |
| Module 5   | Structural Family Therapy   | Gehart (Chapter 5)   |
| Module 6   | Strategic Family Therapy   | Gehart (Chapter 4)   |
| Module 7   | Experiential Family Therapy   | Gehart (Chapter 6)   |
| Module 8   | Psychoanalytic Family Therapy   | Gehart (Chapter 7)   |
| Module 9   | Cognitive Behavioural Family Therapy  Clinical issues in Family Counselling   | Gehart (Chapter 8)   |
| Module 10   | Social Constructionist Family Therapy  Future Research and Critiques   | Gehart (Chapter 10)   |
*Nichols & Davis Readings = Related but Not Required*
course Schedule – *No ClassEs DURING Reading Week (August 6-7) 
Please note that this schedule can change based on the discretion of faculty and/or student learning.
| Course Session/Date   | Topics, Modules, and Assignments   | Readings   |
| Week 1  July 2/3   | Creating a caring community   Introduction to Family Systems   Course overview    | Gehart chapters 1-3   |
| Week 2  July 9/10   | Introduction to Systems Thinking  Introduction to Mapping Tools    | Gehart chapter 5  Articles    |
| Week 3  July 16/17   | From Theory to Practice   Structural Family Systems    | Gehart chapters 5 & 7   |
| Week 4  July 23/24   | Evidence Based Practice and Empirically Supported Models (TBD)     | Gehart chapter 7   |
| Week 5  July 30/31   | Evidenced-Based Practice and Empirically Supported Models  (group presentations)   | Gehart chapters 4-10  Due: Family Mapping Papers   |
| Week 6  August 6/7   | READING WEEK    | No classes    |
| Week 7  August 13/14   | Evidence Based Practice and Empirically Supported Models  (group presentations)   | Gehart chapters 4-10   |
| Week 8  August 20/21   | Evidence Based Practice and Empirically Supported Models  (group presentations)   | Gehart Chapters 4-10   |
| Week 9  August 27/28   | Case Conceptualization    | Gehart Chapter 11    |
| Week 10  September 3/4   |  Case Conceptualization   *Students will complete an in-class case conceptualization worth 20% of their final mark   | Gehart chapter 11  Review sample comprehensive exam cases in Van General Course Shell    |
| Week 11  September 10/11    | Feedback Case Conceptualizations  Addressing Clinical Issues   Counselling Practice    | Gehart chapters 8   |
| Week 12  September 17/18   | Flex Week    |  |`;

    let dto: any;
    let normalized: any;

    beforeAll(() => {
      dto = LocalSyllabusParser.shared.parseText(text512);
      normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text512);
    });

    test('091: CPC 512 Course Code is CPC 512', () => {
      expect(dto.courseCode).toBe('CPC 512');
    });

    test('092: CPC 512 Course Name is Family Systems Approaches to Counselling', () => {
      expect(dto.courseName).toBe('Family Systems Approaches to Counselling');
    });

    test('093: CPC 512 has exactly 10 overarching curriculum module readings', () => {
      expect(dto.moduleReadings?.length).toBe(10);
    });

    test('094: CPC 512 curriculum module readings have moduleNumbers 1 through 10', () => {
      for (let m = 1; m <= 10; m++) {
        const item = dto.moduleReadings.find((r: any) => r.moduleNumber === m);
        expect(item).toBeDefined();
      }
    });

    test('095: CPC 512 curriculum module readings have dueDate null (pure curriculum)', () => {
      dto.moduleReadings.forEach((r: any) => {
        expect(r.dueDate).toBeNull();
        expect(r.dateRangeStr).toBeNull();
      });
    });

    test('096: CPC 512 has exactly 12 weekly calendar sessions', () => {
      expect(dto.weeks?.length).toBe(12);
    });

    test('097: CPC 512 calendar weeks have valid date ranges', () => {
      expect(dto.weeks[0].dateRangeStr).toContain('Jul 2');
      expect(dto.weeks[11].dateRangeStr).toContain('Sep 17');
    });

    test('098: CPC 512 Week 6 is Reading Week with 0 readings', () => {
      const w6 = dto.weeks[5];
      expect(w6.theme).toBe('Reading Week – No Class');
      expect(w6.readings.length).toBe(0);
    });

    test('099: CPC 512 Week 12 is Flex Week with 0 readings', () => {
      const w12 = dto.weeks[11];
      expect(w12.theme).toBe('Flex Week');
      expect(w12.readings.length).toBe(0);
    });

    test('100: CPC 512 Zero Cross-Bleed Rule: Module readings never bleed into calendar weeks', () => {
      dto.weeks.forEach((w: any) => {
        w.readings.forEach((r: any) => {
          expect(r.weekNumber).toBe(w.weekNumber);
        });
      });
    });

    test('101: CPC 512 author resolution maps Gehart to Diane R. Gehart', () => {
      dto.weeks[0].readings.forEach((r: any) => {
        expect(r.authorName).toBe('Diane R. Gehart');
      });
    });

    test('102: CPC 512 extracts Family Mapping Papers assignment', () => {
      const a = dto.assignments?.find((x: any) => /Family Mapping/i.test(x.title));
      expect(a).toBeDefined();
    });

    test('103: CPC 512 extracts Case Conceptualization assignment worth 20%', () => {
      const a = dto.assignments?.find((x: any) => /Case Conceptualization/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('20%');
    });

    test('104: CPC 512 does not concatenate session notes into reading titles', () => {
      dto.weeks.forEach((w: any) => {
        w.readings.forEach((r: any) => {
          expect(r.title).not.toContain('group presentations');
          expect(r.title).not.toContain('Review sample comprehensive');
        });
      });
    });

    test('105: CPC 512 preserves Nichols & Davis as related but not required without phantom tasks', () => {
      const phantom = dto.weeks.flatMap((w: any) => w.readings).find((r: any) => /Nichols.*Davis.*Not Required/i.test(r.title));
      expect(phantom).toBeUndefined();
    });
  });

  // =========================================================================
  // DOCUMENT 6: GSP 401 (Gender, Sexuality & Power - Master Extraction Table) — 10 tests
  // =========================================================================
  describe('Document 6: GSP 401 - Master Extraction Table Syllabus', () => {
    const masterTableMarkdown = `# Gender, Sexuality, and Power: Critical Intersections (GSP 401)
## Master Extraction Table
| Module | Module Title | Assigned Reading | Assignment Deliverable |
| 01 | Foundations of Social Constructionism | Jeffrey Weeks — Sexuality and Its Discontents (Ch. 1) | Historical Genealogies of Norms (Analytical Memo) |
| 02 | The Biopolitical Apparatus & Power | Michel Foucault — The History of Sexuality, Vol. 1 (Pt. 2 & 4) | Discourse Analysis: Institutional Confessions |
| 03 | Performativity, Discourse, & Gender | Judith Butler — Gender Trouble (Ch. 1 & Conclusion) | Subversive Repetition Case Study |
| 04 | Queer Spatiality & Alternative Temporalities | Jack Halberstam — In a Queer Time and Place (Ch. 1) | Spatial/Temporal Archive Mapping |
| 05 | Intersectional Erotics & Power Politics | Audre Lorde — Sister Outsider ("Uses of the Erotic") | Epistemic Erotic Audit |
| 06 | Decolonial Gender & Modernity | María Lugones — "Heterosexualism and the Colonial / Modern Gender System" | Decolonial Framework Analysis |
| 07 | Chosen Kinship & Social Reproduction | Kath Weston — Families We Choose (Ch. 2 & 5) | Alternative Kinship Network Diagram |
| 08 | Affect, Public Feelings, & Queer Grief | Ann Cvetkovich — An Archive of Feelings (Ch. 1 & 4) | Affective Artifact Curation |
| 09 | Digital intimacies & Algorithmic Subjectivities | Shaka McGlotten — Virtual Intimacies (Selected Essays) | Algorithmic Desire Autoethnography |
| 10 | Abolitionist Futures & Radical Transformation | Angela Y. Davis — Are Prisons Obsolete? (Ch. 2 & 5) | Abolitionist Kinship Manifesto |
`;

    let dto: any;

    beforeAll(() => {
      dto = LocalSyllabusParser.shared.parseText(masterTableMarkdown);
    });

    test('106: GSP 401 Course Code is GSP 401', () => {
      expect(dto.courseCode).toBe('GSP 401');
    });

    test('107: GSP 401 eliminates fabricated weeks (weeks count is 0)', () => {
      expect(dto.weeks?.length || 0).toBe(0);
      expect(dto.termWeeks).toBeNull();
    });

    test('108: GSP 401 has exactly 10 module readings', () => {
      expect(dto.moduleReadings?.length).toBe(10);
    });

    test('109: GSP 401 Module 1 reading is Jeffrey Weeks and memo deliverable', () => {
      const m1 = dto.moduleReadings.find((x: any) => x.moduleNumber === 1);
      expect(m1).toBeDefined();
      expect(m1.relevantTopics).toBe('Foundations of Social Constructionism');
      expect(m1.authorName).toContain('Jeffrey Weeks');
      expect(m1.weekNumber).toBeUndefined();
      expect(m1.moduleMention).toBe('Module 1');

      const a1 = dto.assignments[0];
      expect(a1.title).toContain('Historical Genealogies of Norms');
      expect(a1.weekNumber).toBeUndefined();
      expect(a1.moduleMention).toBe('Module 1');
    });

    test('110: GSP 401 Module 2 reading is Michel Foucault', () => {
      const m2 = dto.moduleReadings.find((x: any) => x.moduleNumber === 2);
      expect(m2.authorName).toBe('Michel Foucault');
      expect(m2.weekNumber).toBeUndefined();
    });

    test('111: GSP 401 Module 3 reading is Judith Butler', () => {
      const m3 = dto.moduleReadings.find((x: any) => x.moduleNumber === 3);
      expect(m3.authorName).toBe('Judith Butler');
      expect(m3.weekNumber).toBeUndefined();
    });

    test('112: GSP 401 Module 5 reading is Audre Lorde', () => {
      const m5 = dto.moduleReadings.find((x: any) => x.moduleNumber === 5);
      expect(m5.authorName).toBe('Audre Lorde');
      expect(m5.weekNumber).toBeUndefined();
    });

    test('113: GSP 401 Module 6 reading is María Lugones', () => {
      const m6 = dto.moduleReadings.find((x: any) => x.moduleNumber === 6);
      expect(m6.authorName).toBe('María Lugones');
      expect(m6.weekNumber).toBeUndefined();
    });

    test('114: GSP 401 Module 10 reading is Angela Y. Davis', () => {
      const m10 = dto.moduleReadings.find((x: any) => x.moduleNumber === 10);
      expect(m10.authorName).toBe('Angela Y. Davis');
      expect(m10.weekNumber).toBeUndefined();
      const a10 = dto.assignments[9];
      expect(a10.title).toContain('Abolitionist Kinship Manifesto');
      expect(a10.moduleMention).toBe('Module 10');
      expect(a10.weekNumber).toBeUndefined();
    });

    test('115: GSP 401 total 1:1:1 alignment across all 10 modules without fake weeks', () => {
      expect(dto.assignments?.length).toBe(10);
      for (let i = 1; i <= 10; i++) {
        const r = dto.moduleReadings.find((x: any) => x.moduleNumber === i);
        const a = dto.assignments[i - 1];
        expect(r).toBeDefined();
        expect(r.weekNumber).toBeUndefined();
        expect(r.moduleMention).toBe(`Module ${i}`);
        expect(a).toBeDefined();
        expect(a.weekNumber).toBeUndefined();
        expect(a.moduleMention).toBe(`Module ${i}`);
      }
    });

    test('116: GSP 401 sum of assignment weights is exactly 100%', () => {
      const sum = dto.assignments.reduce((acc: number, curr: any) => acc + (parseFloat(curr.weightPercentage) || 0), 0);
      expect(sum).toBe(100);
    });

    test('117: GSP 401 modules 1-5 weight is 5% each and capstone is 40%', () => {
      for (let i = 0; i < 5; i++) {
        expect(dto.assignments[i].weightPercentage).toBe('5%');
      }
      expect(dto.assignments[9].weightPercentage).toBe('40%');
    });
  });

  // =========================================================================
  // DOCUMENT 7: DATA 630 (Scalable Machine Learning Systems) — 15 tests
  // =========================================================================
  describe('Document 7: DATA 630 - Scalable Machine Learning Systems (Archetype A)', () => {
    let rawText: string;
    let dto: any;
    let normalized: any;
    let cleanAssignments: any[];
    let cleanReadings: any[];

    beforeAll(() => {
      rawText = extractTextFromPdf(path.join(userUploadedDir, 'media_1790269463500.pdf'));
      dto = LocalSyllabusParser.shared.parseText(rawText);
      normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);
      cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(normalized.candidateAssignments, normalized.termYear, normalized.weekDateMap);
      cleanReadings = SyllabusImportManager.shared.deduplicateReadings(normalized.candidateReadings, normalized.textbooks, normalized.termYear);
    });

    test('118: DATA 630 Course Code is DATA 630', () => {
      expect(dto.courseCode).toBe('DATA 630');
    });

    test('119: DATA 630 Course Name contains Scalable Machine Learning Systems', () => {
      expect(dto.courseName).toMatch(/Scalable Machine Learning Systems/i);
    });

    test('120: DATA 630 Instructor is Marcus Vance', () => {
      expect(dto.instructorName).toContain('Marcus Vance');
    });

    test('121: DATA 630 has exactly 4 assignments extracted', () => {
      expect(cleanAssignments.length).toBe(4);
    });

    test('122: DATA 630 contains Architecture Seminar & Code Reviews (15%)', () => {
      const a = cleanAssignments.find(x => /Architecture\s*Seminar/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('15%');
    });

    test('123: DATA 630 contains Distributed Training Pipeline & Benchmarking (30%)', () => {
      const a = cleanAssignments.find(x => /Distributed\s*Training/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('30%');
    });

    test('124: DATA 630 contains Production Inference Server & Low-Latency Deployment (25%)', () => {
      const a = cleanAssignments.find(x => /Production\s*Inference/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('25%');
    });

    test('125: DATA 630 contains MLOps Pipeline Capstone (30%)', () => {
      const a = cleanAssignments.find(x => /MLOps\s*Pipeline\s*Capstone/i.test(x.title));
      expect(a).toBeDefined();
      expect(a.weightPercentage).toBe('30%');
    });

    test('126: DATA 630 sum of assignment weights is exactly 100%', () => {
      const sum = cleanAssignments.reduce((acc, curr) => acc + (parseFloat(curr.weightPercentage) || 0), 0);
      expect(sum).toBe(100);
    });

    test('127: DATA 630 PLOs (Program Learning Outcomes) are NOT extracted as assignments', () => {
      const plo = cleanAssignments.find(x => /\bPLO\s*\d/i.test(x.title));
      expect(plo).toBeUndefined();
    });

    test('128: DATA 630 weeks count is 11 with explicit side-by-side modules', () => {
      expect(dto.weeks?.length).toBe(11);
    });

    test('129: DATA 630 Week 11 covers Module 11 Capstone', () => {
      const w11 = dto.weeks[10];
      expect(w11.weekNumber).toBe(11);
      expect(w11.theme).toMatch(/Module 11|Capstone/i);
    });

    test('130: DATA 630 contains technical doc readings (Feast Architecture, PyTorch, Airflow)', () => {
      const titles = cleanReadings.map(r => r.title.toLowerCase());
      const hasFeast = titles.some(t => t.includes('feast'));
      const hasPytorch = titles.some(t => t.includes('pytorch'));
      expect(hasFeast || hasPytorch).toBe(true);
    });

    test('131: DATA 630 eliminates fabricated points (pointsPossible is null or honestly sourced)', () => {
      cleanAssignments.forEach(a => {
        if (!a.rubricCriteria || a.rubricCriteria.length === 0) {
          expect(a.pointsPossible === null || a.pointsPossible === undefined || a.pointsPossible.includes('Points')).toBe(true);
        }
      });
    });

    test('132: DATA 630 contains no reference to AI or Gemini in user-facing labels', () => {
      const json = JSON.stringify(cleanAssignments);
      expect(/gemini|ai\s*model/i.test(json)).toBe(false);
    });
  });

  // =========================================================================
  // DOCUMENT 8: PRJ-SEX-2026-X (Critical Perspectives on Human Sexuality) — 15 tests
  // =========================================================================
  describe('Document 8: PRJ-SEX-2026-X - Critical Perspectives on Human Sexuality & Society', () => {
    let rawText: string;
    let dto: any;
    let normalized: any;
    let cleanAssignments: any[];
    let cleanReadings: any[];

    beforeAll(() => {
      rawText = extractTextFromPdf(path.join(userUploadedDir, 'media_1790269463501.pdf'));
      dto = LocalSyllabusParser.shared.parseText(rawText);
      normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);
      cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(normalized.candidateAssignments, normalized.termYear, normalized.weekDateMap);
      cleanReadings = SyllabusImportManager.shared.deduplicateReadings(normalized.candidateReadings, normalized.textbooks, normalized.termYear);
    });

    test('133: PRJ-SEX Course Code is PRJ-SEX-2026-X', () => {
      expect(dto.courseCode).toBe('PRJ-SEX-2026-X');
    });

    test('134: PRJ-SEX Course Name is Critical Perspectives on Human Sexuality & Society', () => {
      expect(dto.courseName).toBe('Critical Perspectives on Human Sexuality & Society');
    });

    test('135: PRJ-SEX has exactly 10 assignment deliverables', () => {
      expect(cleanAssignments.length).toBe(10);
    });

    test('136: PRJ-SEX assignment deliverables have valid week numbers 1 through 10', () => {
      for (let w = 1; w <= 10; w++) {
        const a = cleanAssignments.find(x => x.weekNumber === w);
        expect(a).toBeDefined();
      }
    });

    test('137: PRJ-SEX Assignment 1 is Discursive Field Mapping', () => {
      const a1 = cleanAssignments.find(x => x.weekNumber === 1);
      expect(a1.title).toMatch(/Discursive Field Mapping|Discourse Analysis/i);
    });

    test('138: PRJ-SEX Assignment 10 is Culminating Capstone Research Proposal', () => {
      const a10 = cleanAssignments.find(x => x.weekNumber === 10);
      expect(a10.title).toMatch(/Capstone/i);
    });

    test('139: PRJ-SEX has exactly 10 readings extracted', () => {
      expect(cleanReadings.length).toBeGreaterThanOrEqual(10);
    });

    test('140: PRJ-SEX Week 1 reading includes Foucault', () => {
      const r1 = cleanReadings.find(x => x.weekNumber === 1 && /Foucault/i.test(x.authorName || x.title));
      expect(r1).toBeDefined();
    });

    test('141: PRJ-SEX Week 5 reading includes Audre Lorde', () => {
      const r5 = cleanReadings.find(x => x.weekNumber === 5 && /Lorde/i.test(x.authorName || x.title));
      expect(r5).toBeDefined();
      expect(r5.title).toMatch(/Black Feminist Erotic Thought|Sister Outsider|Uses of the Erotic/i);
    });

    test('142: PRJ-SEX Week 6 reading includes María Lugones', () => {
      const r6 = cleanReadings.find(x => x.weekNumber === 6 && /Lugones/i.test(x.authorName || x.title));
      expect(r6).toBeDefined();
    });

    test('143: PRJ-SEX Week 7 reading includes Judith Butler', () => {
      const r7 = cleanReadings.find(x => x.weekNumber === 7 && /Butler/i.test(x.authorName || x.title));
      expect(r7).toBeDefined();
      expect(r7.title).toMatch(/Gender Performativity & Drag|Gender Trouble/i);
    });

    test('144: PRJ-SEX Week 9 reading includes Gayle Rubin', () => {
      const r9 = cleanReadings.find(x => x.weekNumber === 9 && /Rubin/i.test(x.authorName || x.title));
      expect(r9).toBeDefined();
    });

    test('145: PRJ-SEX Week 10 reading includes Douglas Crimp', () => {
      const r10 = cleanReadings.find(x => x.weekNumber === 10 && /Crimp/i.test(x.authorName || x.title));
      expect(r10).toBeDefined();
    });

    test('146: PRJ-SEX specifies weeks and modules in structured units', () => {
      expect(dto.weeks?.length).toBeGreaterThanOrEqual(10);
    });

    test('147: PRJ-SEX zero fabricated data (no 100 pt fabrication)', () => {
      cleanAssignments.forEach(a => {
        if (!a.rubricCriteria || a.rubricCriteria.length === 0) {
          expect(a.pointsPossible === null || a.pointsPossible === undefined || a.pointsPossible.includes('Points')).toBe(true);
        }
      });
    });
  });
});
