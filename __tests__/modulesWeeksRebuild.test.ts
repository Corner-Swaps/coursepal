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
  const fullPath = path.resolve(__dirname, 'fixtures/modules-weeks', fileName);
  const swiftCmd = `swift -e '
import PDFKit
import Foundation
let url = URL(fileURLWithPath: "${fullPath}")
if let doc = PDFDocument(url: url), let str = doc.string {
    print(str)
}
'`;
  return execSync(swiftCmd, { encoding: 'utf8' });
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

      expect(norm.weeks).toBeDefined();
      expect(norm.weeks?.length).toBe(12);
      const weekNums = norm.weeks?.map(w => w.weekNumber).sort((a, b) => a - b);
      expect(weekNums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

      const readingsFor = (wk: number) => cleanReadings.filter(r => r.weekNumber === wk).map(r => r.title);
      const weekFor = (wk: number) => norm.weeks?.find(w => w.weekNumber === wk);

      // Themes = topic lines, never "Class N THURSDAY, 2026" fragments, never SSA/CM/BS legend
      for (const w of norm.weeks || []) {
        const theme = w.theme || '';
        expect(theme).not.toMatch(/\bClass\s*\d+\b/i);
        expect(theme).not.toMatch(/\bTHURSDAY\b/i);
        expect(theme).not.toMatch(/\b2026\b/);
        expect(theme).not.toMatch(/Smith-\s*Adcock|Malchiodi|BrightSpace|\bSSA-|\bCM-|\bBS-/i);
      }

      // Week 1: Class 1 (Oct 1) — SSA Ch.1, CM Ch.1
      expect(weekFor(1)?.theme).toMatch(/Introductions|Historical and Contextual Trends/i);
      expect(readingsFor(1).some(t => /SSA.*Chapters?\s*1\b/i.test(t))).toBe(true);
      expect(readingsFor(1).some(t => /CM.*Chapters?\s*1\b/i.test(t))).toBe(true);
      expect(readingsFor(1).length).toBe(2);

      // Week 2: Class 2 (Oct 8) — Laws & Ethics — SSA Ch.2, CM Ch.2
      expect(weekFor(2)?.theme).toMatch(/Laws\s*&\s*Ethics/i);
      expect(readingsFor(2).some(t => /SSA.*Chapters?\s*2\b/i.test(t))).toBe(true);
      expect(readingsFor(2).some(t => /CM.*Chapters?\s*2\b/i.test(t))).toBe(true);
      expect(readingsFor(2).length).toBe(2);

      // Week 3: Class 3 (Oct 15) — Attachment, Trauma & Repair — SSA Ch.3, CM Ch.6
      expect(weekFor(3)?.theme).toMatch(/Attachment,\s*Trauma\s*&\s*Repair/i);
      expect(readingsFor(3).some(t => /SSA.*Chapters?\s*3\b/i.test(t))).toBe(true);
      expect(readingsFor(3).some(t => /CM.*Chapters?\s*6\b/i.test(t))).toBe(true);
      expect(readingsFor(3).length).toBe(2);

      // Week 4: Class 4 (Oct 22) — Therapeutic Alliance / Psychodynamic Approaches — SSA Ch.4,5, CM Ch.7,9
      expect(weekFor(4)?.theme).toMatch(/Therapeutic Alliance|Psychodynamic Approaches/i);
      expect(readingsFor(4).some(t => /SSA.*Chapters?\s*4,\s*5\b/i.test(t))).toBe(true);
      expect(readingsFor(4).some(t => /CM.*Chapters?\s*7,\s*9\b/i.test(t))).toBe(true);
      expect(readingsFor(4).length).toBe(2);

      // Week 5: Class 5 (Oct 29) — Humanistic Approaches — SSA Ch.6, CM Ch.4,5
      expect(weekFor(5)?.theme).toMatch(/Humanistic Approaches/i);
      expect(readingsFor(5).some(t => /SSA.*Chapters?\s*6\b/i.test(t))).toBe(true);
      expect(readingsFor(5).some(t => /CM.*Chapters?\s*4,\s*5\b/i.test(t))).toBe(true);
      expect(readingsFor(5).length).toBe(2);

      // Week 6: Class 6 (Nov 5) — Cognitive-Behavioural Approaches — SSA Ch.7, CM Ch.13
      expect(weekFor(6)?.theme).toMatch(/Cognitive-\s*Behavioural Approaches/i);
      expect(readingsFor(6).some(t => /SSA.*Chapters?\s*7\b/i.test(t))).toBe(true);
      expect(readingsFor(6).some(t => /CM.*Chapters?\s*13\b/i.test(t))).toBe(true);
      expect(readingsFor(6).length).toBe(2);

      // Week 7: Week of Nov 12 = Reading Week, empty
      expect(weekFor(7)?.theme).toMatch(/Reading Week/i);
      expect((weekFor(7) as any)?.isReadingWeek || (weekFor(7) as any)?.isNonInstructional).toBe(true);
      expect(readingsFor(7).length).toBe(0);

      // Week 8: Class 7 (Nov 19) = World Café, empty
      expect(weekFor(8)?.theme).toMatch(/World\s*Caf[eé]/i);
      expect(readingsFor(8).length).toBe(0);

      // Week 9: Class 8 (Nov 26) — Conceptualization, Assessment and Treatment Planning — SSA Ch.9, CM Ch.3
      expect(weekFor(9)?.theme).toMatch(/Conceptualization,\s*Assessment\s+and\s+Treatment\s+Planning/i);
      expect(readingsFor(9).some(t => /SSA.*Chapters?\s*9\b/i.test(t))).toBe(true);
      expect(readingsFor(9).some(t => /CM.*Chapters?\s*3\b/i.test(t))).toBe(true);
      expect(readingsFor(9).length).toBe(2);

      // Week 10: Class 9 (Dec 3) — Family and Organizational Systems Approaches — SSA Ch.8, CM Ch.10,12
      expect(weekFor(10)?.theme).toMatch(/Family and Organizational Systems Approaches/i);
      expect(readingsFor(10).some(t => /SSA.*Chapters?\s*8\b/i.test(t))).toBe(true);
      expect(readingsFor(10).some(t => /CM.*Chapters?\s*10,\s*12\b/i.test(t))).toBe(true);
      expect(readingsFor(10).length).toBe(2);

      // Week 11: Class 10 (Dec 10) — Counselling Young Children — SSA Ch.10,11,12
      expect(weekFor(11)?.theme).toMatch(/Counselling Young Children/i);
      expect(readingsFor(11).some(t => /SSA.*Chapters?\s*10,\s*11,\s*12\b/i.test(t))).toBe(true);
      expect(readingsFor(11).length).toBe(1);

      // Week 12: Class 11 (Dec 17) — Counselling with Adolescents — SSA Ch.13,14,15, CM Ch.14
      expect(weekFor(12)?.theme).toMatch(/Counselling with Adolescents/i);
      expect(readingsFor(12).some(t => /SSA.*Chapters?\s*13,\s*14,\s*15\b/i.test(t))).toBe(true);
      expect(readingsFor(12).some(t => /CM.*Chapters?\s*14\b/i.test(t))).toBe(true);
      expect(readingsFor(12).length).toBe(2);

      // No reading titled "laws & ethics" or "group 1"
      expect(cleanReadings.some(r => /laws\s*&\s*ethics/i.test(r.title))).toBe(false);
      expect(cleanReadings.some(r => /group\s*1/i.test(r.title))).toBe(false);
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
