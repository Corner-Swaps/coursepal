import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  SyllabusImportManager,
  RawAssignmentCandidate,
  RawReadingCandidate
} from '../src/services/SyllabusImportManager';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { BundledSyllabiCatalog } from '../src/utils/syllabusCatalog';

function extractTextFromPdf(pdfPath: string): string {
  try {
    const swiftCmd = `swift -e '
import PDFKit
import Foundation
let url = URL(fileURLWithPath: "${pdfPath}")
if let doc = PDFDocument(url: url), let str = doc.string {
    print(str)
}
'`;
    return execSync(swiftCmd).toString();
  } catch {
    const pyScript = `import pypdf; r=pypdf.PdfReader('${pdfPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
    return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });
  }
}

describe('CoursePal Extraction Fixes: Red-Green Verification Pack', () => {
  const importManager = SyllabusImportManager.shared;
  const localParser = LocalSyllabusParser.shared;

  describe('Fix 2: No Invented Weights (Explicit % only, points-only assignments get null)', () => {
    it('SOCS_4890 must produce null weights on its actual data (real fixture)', () => {
      const fixturePath = path.resolve(__dirname, 'fixtures/Syllabus_and_Curriculum_Human_Sexuality_and_Social_Theory.pdf');
      const text = extractTextFromPdf(fixturePath);
      expect(text.length).toBeGreaterThan(100);

      const dto = localParser.parseText(text);
      expect(dto.courseCode).toContain('SOCS');
      const norm = importManager.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanAssignments = importManager.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

      expect(cleanAssignments.length).toBeGreaterThanOrEqual(5);
      // All SOCS_4890 deliverables are strictly point-based with zero explicit % weights in syllabus
      for (const a of cleanAssignments) {
        expect(a.weightPercentage).toBeNull();
      }
    });
    it('sets weightPercentage to null for points-only assignments (no invented weight)', () => {
      const pointsOnlyCandidates: RawAssignmentCandidate[] = [
        {
          title: 'Midterm Exam',
          points: '100',
          pointsPossible: '100 Points',
          weekNumber: 6
        },
        {
          title: 'Weekly Quiz 1',
          pointsPossible: '25 pts',
          weekNumber: 2
        },
        {
          title: 'Case Study Analysis',
          noteText: 'Submit detailed analysis · 50 points total',
          weekNumber: 4
        }
      ];

      const result = importManager.deduplicateAssignments(pointsOnlyCandidates);
      expect(result.length).toBe(3);

      const midterm = result.find(a => a.title.includes('Midterm'));
      expect(midterm).toBeDefined();
      expect(midterm?.pointsPossible).toBe('100 Points');
      expect(midterm?.weightPercentage).toBeNull();

      const quiz = result.find(a => a.title.includes('Weekly Quiz 1'));
      expect(quiz).toBeDefined();
      expect(quiz?.pointsPossible).toBe('25 pts');
      expect(quiz?.weightPercentage).toBeNull();

      const caseStudy = result.find(a => a.title.includes('Case Study'));
      expect(caseStudy).toBeDefined();
      expect(caseStudy?.pointsPossible).toBe('50 Points');
      expect(caseStudy?.weightPercentage).toBeNull();
    });

    it('preserves weightPercentage when explicit % is present in fields or text', () => {
      const weightedCandidates: RawAssignmentCandidate[] = [
        {
          title: 'Term Paper',
          weightPercentage: '30%',
          points: '100',
          pointsPossible: '100 Points',
          weekNumber: 10
        },
        {
          title: 'Final Presentation',
          weightPercentage: '25%',
          pointsPossible: '50 Points',
          weekNumber: 12
        },
        {
          title: 'Ethics Essay',
          noteText: 'Worth 15% of final grade · 100 points',
          weekNumber: 5
        }
      ];

      const result = importManager.deduplicateAssignments(weightedCandidates);
      expect(result.length).toBe(3);

      const paper = result.find(a => a.title.includes('Term Paper'));
      expect(paper?.weightPercentage).toBe('30%');
      expect(paper?.pointsPossible).toBe('100 Points');

      const presentation = result.find(a => a.title.includes('Final Presentation'));
      expect(presentation?.weightPercentage).toBe('25%');
      expect(presentation?.pointsPossible).toBe('50 Points');

      const essay = result.find(a => a.title.includes('Ethics Essay'));
      expect(essay?.weightPercentage).toBe('15%');
      expect(essay?.pointsPossible).toBe('100 Points');
    });

    it('does not invent weight percentage when bare points string is passed without %', () => {
      const bareNumberCandidate: RawAssignmentCandidate[] = [
        {
          title: 'Lab Report 1',
          points: '100',
          weight: '100',
          weekNumber: 3
        }
      ];

      const result = importManager.deduplicateAssignments(bareNumberCandidate);
      expect(result.length).toBe(1);
      // Must not invent 100% for a 100-point lab report
      expect(result[0].pointsPossible).toBe('100 Points');
      expect(result[0].weightPercentage).toBeNull();
    });
  });

  describe('Fix 3: Cross-Bleed Guard (Reading row must never emit as assignment)', () => {
    it('filters out candidates categorized as reading or textbook in deduplicateAssignments', () => {
      const mixedCandidates: RawAssignmentCandidate[] = [
        {
          title: 'Corey Chapter 3: Cognitive Behavioral Therapy',
          category: 'Reading',
          subType: 'textbook',
          weekNumber: 2
        } as any,
        {
          title: 'Diagnostic and Statistical Manual DSM-5-TR',
          category: 'textbook',
          weekNumber: 3
        } as any,
        {
          title: 'Weekly Reflection Journal',
          category: 'assignment',
          pointsPossible: '20 Points',
          weekNumber: 2
        }
      ];

      const assignments = importManager.deduplicateAssignments(mixedCandidates);
      expect(assignments.length).toBe(1);
      expect(assignments[0].title).toBe('Weekly Reflection Journal');
      expect(assignments.some(a => a.title.toLowerCase().includes('corey'))).toBe(false);
      expect(assignments.some(a => a.title.toLowerCase().includes('dsm'))).toBe(false);
    });

    it('filters out reading entries in normalizeAndValidateSyllabusPayload', () => {
      const payload: any = {
        course_name: 'Counseling Ethics',
        course_code: 'CPC 512',
        term: 'Fall 2026',
        assignments: [
          {
            title: 'Wada & Fellner (2014) Indigenous Perspectives',
            category: 'reading',
            weekNumber: 4
          },
          {
            title: 'Ethics Position Paper',
            category: 'assignment',
            pointsPossible: '100 Points',
            weightPercentage: '30%',
            weekNumber: 8
          }
        ],
        readings: [
          {
            title: 'Wada & Fellner (2014) Indigenous Perspectives',
            authorName: 'Wada & Fellner',
            chapterText: 'Article',
            weekNumber: 4
          }
        ]
      };

      const normalized = importManager.normalizeAndValidateSyllabusPayload(payload);
      expect(normalized.candidateAssignments.length).toBe(1);
      expect(normalized.candidateAssignments[0].title).toBe('Ethics Position Paper');
      expect(normalized.candidateAssignments.some(a => a.title?.includes('Wada & Fellner'))).toBe(false);
      expect(normalized.candidateReadings.length).toBe(1);
      expect(normalized.candidateReadings[0].title).toContain('Wada & Fellner');
    });

    it('ensures reading citation rows never emit as deliverable in LocalSyllabusParser', () => {
      const sampleText = `
Week 4: Cognitive Interventions
Corey, G. (2021). Theory and Practice of Counseling and Psychotherapy (10th ed.), Chapter 7.
Assignment 1: Reflection Paper due Oct 15 - 100 points
      `;

      const result = localParser.parseText(sampleText);
      // Deliverable list must contain Assignment 1, but NOT the Corey reading
      expect(result.assignments?.some(a => a.title.includes('Reflection Paper'))).toBe(true);
      expect(result.assignments?.some(a => a.title.toLowerCase().includes('corey'))).toBe(false);
    });
  });

  describe('Fix 4: Dedupe Fix (Merge module/week double-emissions without merging distinct books)', () => {
    it('merges module and week double-emissions of the same reading with different week/module stamps', () => {
      const doubleEmissions: RawReadingCandidate[] = [
        {
          title: 'Theory and Practice of Counseling',
          resourceTitle: 'Theory and Practice of Counseling',
          authorName: 'Corey, G.',
          chapterText: 'Chapter 3',
          moduleNumber: 1,
          moduleMention: 'Module 1',
          weekNumber: undefined
        },
        {
          title: 'Theory and Practice of Counseling',
          resourceTitle: 'Theory and Practice of Counseling',
          authorName: 'Corey, G.',
          chapterText: 'Chapter 3',
          weekNumber: 1,
          dateRangeStr: 'Sep 8 – Sep 14'
        }
      ];

      const merged = importManager.deduplicateReadings(doubleEmissions);
      expect(merged.length).toBe(1);
      expect(merged[0].title).toContain('Theory and Practice');
      expect(merged[0].chapterText).toBe('Chapter 3');
      // Both week and module metadata should be preserved
      expect(merged[0].weekNumber).toBe(1);
      expect(merged[0].moduleNumber).toBe(1);
      expect(merged[0].dateRangeStr).toBe('Sep 8 – Sep 14');
    });

    it('merges same reading double-emissions across different week stamps (e.g. week 1 vs week 2)', () => {
      const doubleWeeklyEmissions: RawReadingCandidate[] = [
        {
          title: 'The Gift of Therapy',
          resourceTitle: 'The Gift of Therapy',
          authorName: 'Yalom, I. D.',
          chapterText: 'Chapters 1–5',
          weekNumber: 1
        },
        {
          title: 'The Gift of Therapy',
          resourceTitle: 'The Gift of Therapy',
          authorName: 'Yalom, I. D.',
          chapterText: 'Chapters 1–5',
          weekNumber: 2
        }
      ];

      const merged = importManager.deduplicateReadings(doubleWeeklyEmissions);
      expect(merged.length).toBe(1);
      expect(merged[0].title).toContain('Gift of Therapy');
      expect(merged[0].chapterText).toBe('Chapters 1–5');
    });

    it('strictly preserves distinct books with the same chapter locator (never merges different books)', () => {
      const distinctBooksSameChapter: RawReadingCandidate[] = [
        {
          title: 'Theory and Practice of Counseling',
          resourceTitle: 'Theory and Practice of Counseling',
          authorName: 'Corey, G.',
          chapterText: 'Chapter 4',
          weekNumber: 2
        },
        {
          title: 'The Gift of Therapy',
          resourceTitle: 'The Gift of Therapy',
          authorName: 'Yalom, I. D.',
          chapterText: 'Chapter 4',
          weekNumber: 2
        }
      ];

      const result = importManager.deduplicateReadings(distinctBooksSameChapter);
      expect(result.length).toBe(2);
      expect(result.some(r => (r.authorName || '').toLowerCase().includes('corey'))).toBe(true);
      expect(result.some(r => (r.authorName || '').toLowerCase().includes('yalom'))).toBe(true);
      expect(result.some(r => (r.resourceTitle || '').includes('Theory and Practice'))).toBe(true);
      expect(result.some(r => (r.resourceTitle || '').includes('Gift of Therapy'))).toBe(true);
    });

    it('strictly preserves the same book with different chapters across weeks', () => {
      const sameBookDifferentChapters: RawReadingCandidate[] = [
        {
          title: 'Theory and Practice of Counseling',
          resourceTitle: 'Theory and Practice of Counseling',
          authorName: 'Corey, G.',
          chapterText: 'Chapter 3',
          weekNumber: 1
        },
        {
          title: 'Theory and Practice of Counseling',
          resourceTitle: 'Theory and Practice of Counseling',
          authorName: 'Corey, G.',
          chapterText: 'Chapter 4',
          weekNumber: 2
        }
      ];

      const result = importManager.deduplicateReadings(sameBookDifferentChapters);
      expect(result.length).toBe(2);
      const ch3 = result.find(r => r.chapterText === 'Chapter 3');
      const ch4 = result.find(r => r.chapterText === 'Chapter 4');
      expect(ch3).toBeDefined();
      expect(ch4).toBeDefined();
      expect(ch3?.weekNumber).toBe(1);
      expect(ch4?.weekNumber).toBe(2);
    });

    it('gen20 fixtures must have zero duplicate reading groups (real fixtures)', () => {
      const fixturesDir = path.resolve(__dirname, 'fixtures/generated_20_syllabi');
      const pdfFiles = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.pdf'));
      expect(pdfFiles.length).toBe(20);

      for (const file of pdfFiles) {
        const fullPath = path.join(fixturesDir, file);
        const text = extractTextFromPdf(fullPath);
        const parsed = localParser.parseText(text);
        const norm = importManager.normalizeAndValidateSyllabusPayload(parsed, text);
        const cleanReadings = importManager.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

        // Group readings by scheduled week/module
        const groups = new Map<string, typeof cleanReadings>();
        for (const r of cleanReadings) {
          const groupKey = r.weekNumber != null ? `week-${r.weekNumber}` : (r.moduleNumber != null ? `mod-${r.moduleNumber}` : 'unassigned');
          if (!groups.has(groupKey)) groups.set(groupKey, []);
          groups.get(groupKey)!.push(r);
        }

        // Zero duplicate readings within any group
        for (const [groupKey, groupReadings] of groups.entries()) {
          const seen = new Set<string>();
          for (const r of groupReadings) {
            const normTitle = (r.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const normLoc = (r.chapterText || r.pagesText || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const key = `${normTitle}_${normLoc}`;
            expect(seen.has(key)).toBe(false);
            seen.add(key);
          }
        }
      }
    }, 60000);
  });

  describe('Bundled Syllabus Catalog File Integrity', () => {
    it('every syllabusCatalog.ts fileName strictly matches a real physical file in src/assets/syllabi/', () => {
      const syllabiDir = path.resolve(__dirname, '../src/assets/syllabi');
      expect(BundledSyllabiCatalog.length).toBeGreaterThanOrEqual(14);

      for (const item of BundledSyllabiCatalog) {
        expect(item.fileName).toBeTruthy();
        const fullPath = path.join(syllabiDir, item.fileName);
        expect(fs.existsSync(fullPath)).toBe(true);
        const stat = fs.statSync(fullPath);
        expect(stat.size).toBeGreaterThan(1000);
      }
    });
  });
});

