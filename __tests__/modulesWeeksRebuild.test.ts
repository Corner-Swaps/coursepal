import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { extractTextFromDocxBase64 } from '../src/services/DocxTextExtractor';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractDocx(fileName: string): string {
  const filePath = path.resolve(__dirname, 'fixtures/modules-weeks', fileName);
  const base64 = fs.readFileSync(filePath).toString('base64');
  return extractTextFromDocxBase64(base64);
}

function extractPdf(fileName: string): string {
  const filePath = path.resolve(__dirname, 'fixtures/modules-weeks', fileName);
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });
}

function runPipeline(rawText: string) {
  const parser = LocalSyllabusParser.shared;
  const importManager = SyllabusImportManager.shared;

  const dto = parser.parseText(rawText);
  const norm = importManager.normalizeAndValidateSyllabusPayload(dto, rawText);
  const cleanReadings = importManager.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
  const cleanAssignments = importManager.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

  return { dto, norm, cleanReadings, cleanAssignments };
}

describe('Modules Weeks Rebuild Suite (Red -> Green)', () => {
  describe('A. CPC 522 reading schedule docx', () => {
    it('meets all schedule rebuild specs for CPC 522 reading schedule', () => {
      const rawText = extractDocx('CPC 522 Fall 2026 Reading Schedule (1).docx');
      const { norm, cleanReadings } = runPipeline(rawText);
      console.log('TEST A READINGS:', cleanReadings.map(r => ({ week: r.weekNumber, title: r.title })));
      console.log('TEST A WEEKS:', norm.weeks?.map(w => ({ week: w.weekNumber, theme: w.theme })));
      console.log('TEST A TEXTBOOKS:', norm.textbooks);

      // Exactly 10 week entries [1..10]
      expect(norm.weeks).toBeDefined();
      expect(norm.weeks?.length).toBe(10);
      const weekNums = norm.weeks?.map(w => w.weekNumber).sort((a, b) => a - b);
      expect(weekNums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      // Session 9 (Dec 4) owns exactly 4 readings matching /Chapters 8, 9, 12/i, /attachment.*styles/i, /Psychologist \(2016\)/i, /Chapters 7 and 10/i
      const s9Readings = cleanReadings.filter(r => r.weekNumber === 9);
      expect(s9Readings.length).toBe(4);
      expect(s9Readings.some(r => /Chapters 8, 9, 12/i.test(r.title))).toBe(true);
      expect(s9Readings.some(r => /attachment.*styles/i.test(r.title))).toBe(true);
      expect(s9Readings.some(r => /Psychologist \(2016\)/i.test(r.title))).toBe(true);
      expect(s9Readings.some(r => /Chapters 7 and 10/i.test(r.title))).toBe(true);

      // Session 10 (Dec 11) owns exactly 1 reading matching /Courtois and Ford book Chapters 9 and 10/i
      const s10Readings = cleanReadings.filter(r => r.weekNumber === 10);
      expect(s10Readings.length).toBe(1);
      expect(/Courtois and Ford book Chapters 9 and 10/i.test(s10Readings[0].title)).toBe(true);

      // Sessions 7 and 8 have zero readings
      expect(cleanReadings.filter(r => r.weekNumber === 7).length).toBe(0);
      expect(cleanReadings.filter(r => r.weekNumber === 8).length).toBe(0);

      // No reading titled /Ethics and boundary issues/i, /^Psychologist \(2016\)$/i, or /for Trauma Paper/i
      expect(cleanReadings.some(r => /Ethics and boundary issues/i.test(r.title))).toBe(false);
      expect(cleanReadings.some(r => /^Psychologist \(2016\)$/i.test(r.title))).toBe(false);
      expect(cleanReadings.some(r => /for Trauma Paper/i.test(r.title))).toBe(false);

      // Textbooks list is exactly 3 (joined title+author matches /briere/, /tedeschi/, /linklater/, and no entry is a bare chapter without "book")
      expect(norm.textbooks.length).toBe(3);
      const joinedBooks = norm.textbooks.map(b => `${b.title} ${(b as any).author || (b as any).authorName || ''}`.toLowerCase());
      expect(joinedBooks.some(b => /briere/i.test(b))).toBe(true);
      expect(joinedBooks.some(b => /tedeschi/i.test(b))).toBe(true);
      expect(joinedBooks.some(b => /linklater/i.test(b))).toBe(true);
      norm.textbooks.forEach(b => {
        if (/chapter/i.test(b.title)) {
          expect(b.title.toLowerCase()).toContain('book');
        }
      });

      // Every reading has moduleNumber 0 and empty moduleMention
      cleanReadings.forEach(r => {
        expect(r.moduleNumber || 0).toBe(0);
        expect(r.moduleMention || '').toBe('');
      });

      // Every week has moduleNumber 0
      norm.weeks?.forEach(w => {
        expect((w as any).moduleNumber || 0).toBe(0);
      });
    });
  });

  describe('B. CPC 522 main syllabus docx', () => {
    it('meets all assignment and alternative specs for CPC 522 main syllabus', () => {
      const rawText = extractDocx('Syllabus-CPC 522 Fall 2026.docx');
      const { dto, norm, cleanAssignments } = runPipeline(rawText);
      console.log('TEST B DTO ASSIGNMENTS:', dto.assignments?.map((a: any) => ({ title: a.title, weight: a.weightPercentage, week: a.weekNumber, sched: a.scheduledWeeks })));
      console.log('TEST B CANDIDATES:', norm.candidateAssignments.map(a => ({ title: a.title, week: a.weekNumber, sched: a.scheduledWeeks })));
      const p1 = cleanAssignments.find(a => /Language and Violence/i.test(a.title));
      const p2 = cleanAssignments.find(a => /Psychotherapy for Trauma/i.test(a.title));
      console.log('TEST B ASSIGNMENTS:', cleanAssignments.map(a => ({ title: a.title, weight: a.weightPercentage, week: a.weekNumber, isAlt: (a as any).isAlternative, altGrp: (a as any).alternativeGroupId })));
      expect(p1).toBeDefined();
      expect(p2).toBeDefined();
      expect(p1?.weightPercentage).toBe('40%');
      expect(p2?.weightPercentage).toBe('40%');

      // Both isAlternative=true, same alternativeGroupId
      expect((p1 as any)?.isAlternative).toBe(true);
      expect((p2 as any)?.isAlternative).toBe(true);
      expect((p1 as any)?.alternativeGroupId).toBeTruthy();
      expect((p1 as any)?.alternativeGroupId).toBe((p2 as any)?.alternativeGroupId);

      // Course weight total ≤100% counting one per alternative group
      const accountedGroups = new Set<string>();
      let totalWeight = 0;
      cleanAssignments.forEach(a => {
        const weightNum = parseFloat((a.weightPercentage || '0').replace('%', '')) || 0;
        const altGroup = (a as any).alternativeGroupId;
        if ((a as any).isAlternative && altGroup) {
          if (!accountedGroups.has(altGroup)) {
            accountedGroups.add(altGroup);
            totalWeight += weightNum;
          }
        } else {
          totalWeight += weightNum;
        }
      });
      expect(totalWeight).toBeLessThanOrEqual(100);

      // No assignment has weekNumber > 0 (the doc gives no week info)
      cleanAssignments.forEach(a => {
        expect(a.weekNumber || 0).toBe(0);
      });
    });
  });

  describe('C. CPC 600 pdf', () => {
    it('meets all weekly schedule and non-instructional specs for CPC 600', () => {
      const rawText = extractPdf('Child and youth - syllabus.pdf');
      const { dto, norm, cleanReadings } = runPipeline(rawText);
      console.log('CPC 600 WEEKS:', norm.weeks?.map(w => ({ wk: w.weekNumber, theme: w.theme, date: w.dateRangeStr || w.startDate })));
      console.log('CPC 600 CLEAN READINGS:', cleanReadings.map(r => ({ wk: r.weekNumber, title: r.title })));
      expect(norm.weeks).toBeDefined();
      expect(norm.weeks?.length).toBe(10);
      const weekNums = norm.weeks?.map(w => w.weekNumber).sort((a, b) => a - b);
      expect(weekNums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      // Week 7 readings match /CM- Chapter 3/i and /SSA- Chapter 9/i
      const w7Readings = cleanReadings.filter(r => r.weekNumber === 7);
      expect(w7Readings.some(r => /CM- Chapter 3/i.test(r.title))).toBe(true);
      expect(w7Readings.some(r => /SSA- Chapter 9/i.test(r.title))).toBe(true);

      // No reading titled "laws & ethics" or "group 1"
      expect(cleanReadings.some(r => /laws\s*&\s*ethics/i.test(r.title))).toBe(false);
      expect(cleanReadings.some(r => /group\s*1/i.test(r.title))).toBe(false);

      // At least one non-instructional week flagged (reading week) and it did not consume week number 7
      const hasNonInstructional = norm.weeks?.some(w => (w as any).isNonInstructional === true || (w as any).isReadingWeek === true) ||
        (norm as any).nonInstructionalWeeks?.length > 0;
      expect(hasNonInstructional).toBe(true);
    });
  });

  describe('D. Module axis dead (all fixtures)', () => {
    it('ensures no module axis in any fixture or parseText', () => {
      const fixtures = [
        extractDocx('CPC 522 Fall 2026 Reading Schedule (1).docx'),
        extractDocx('Syllabus-CPC 522 Fall 2026.docx'),
        extractPdf('Child and youth - syllabus.pdf')
      ];

      // parseText('x').moduleReadings is null/empty
      const parsedX = LocalSyllabusParser.shared.parseText('Some random text');
      expect((parsedX as any).moduleReadings == null || (parsedX as any).moduleReadings.length === 0).toBe(true);

      for (const text of fixtures) {
        const { dto, norm, cleanReadings, cleanAssignments } = runPipeline(text);
        expect((dto as any).moduleReadings == null || (dto as any).moduleReadings.length === 0).toBe(true);

        cleanReadings.forEach(r => {
          expect(r.moduleNumber || 0).toBe(0);
          expect(r.moduleMention || '').toBe('');
        });

        cleanAssignments.forEach(a => {
          expect(a.moduleNumber || 0).toBe(0);
          expect(a.moduleMention || '').toBe('');
        });

        norm.weeks?.forEach(w => {
          expect((w as any).moduleNumber || 0).toBe(0);
        });
      }
    });
  });

  describe('E. Not-a-syllabus', () => {
    it('yields null/empty courseCode and courseName, zero readings, zero assignments for safety-record', () => {
      const rawText = extractPdf('Safety_Record_notif-dispatch-1.pdf');
      const { dto, norm, cleanReadings, cleanAssignments } = runPipeline(rawText);

      expect(norm.courseCode || '').toBe('');
      expect(norm.courseName || '').toBe('');
      expect(cleanReadings.length).toBe(0);
      expect(cleanAssignments.length).toBe(0);
    });
  });
});
