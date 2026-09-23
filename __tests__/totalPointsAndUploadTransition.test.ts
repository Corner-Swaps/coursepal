import { isDeliverableNotReading, isGenericPlaceholderReadingTitle, deduplicateReadingsList } from '../src/utils/readingDisplayHelper';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { Reading } from '../src/types/models';

describe('Total Points Domain Isolation & Reading Elimination', () => {
  describe('isDeliverableNotReading & isGenericPlaceholderReadingTitle', () => {
    it('identifies Total Points and points summaries as non-readings', () => {
      const testCases = [
        'Total Points',
        'Total Points: 100',
        'Total Points Possible',
        'Total: 100 Points',
        'Total 100 Points',
        '100 Points Total',
        'Total Grade',
        'Total Grade Points',
        'Points Possible',
        '100 Points',
        'Total: 100%'
      ];

      for (const tc of testCases) {
        const isDeliv = isDeliverableNotReading(tc);
        const isPlaceholder = isGenericPlaceholderReadingTitle(tc);
        expect(isDeliv || isPlaceholder).toBe(true);
      }
    });

    it('does not reject genuine academic reading titles', () => {
      const genuineReadings = [
        'Corey & Corey Ch. 1-3',
        'Maddux & Winstead: Psychopathology Foundations',
        'APA Division 40 Clinical Neuropsychology Protocols',
        'Lezak et al.: Neuropsychological Assessment Ch. 4',
        'Feast Feature Store Architecture Whitepaper',
        'Deep Learning Systems: Principles and Practices'
      ];

      for (const r of genuineReadings) {
        expect(isDeliverableNotReading(r)).toBe(false);
        expect(isGenericPlaceholderReadingTitle(r)).toBe(false);
      }
    });
  });

  describe('LocalSyllabusParser Table Ingestion', () => {
    it('never extracts "Total Points" as a reading from course tables', () => {
      const tableSyllabus = `
CS 501: Advanced Systems Programming
Fall 2026

Course Schedule & Syllabus Requirements
Week
Title
Category
Sub-Type
Points
Weight
Due Date

Week 1
Linux Kernel Internals
Reading
Textbook
N/A
N/A
2026-09-08

Week 2
Memory Management
Reading
Textbook
N/A
N/A
2026-09-15

Week 3
Concurrency Primitives
Reading
Textbook
N/A
N/A
2026-09-22

Week 4
Kernel Module Project
Assignment
Project
50 Points
25%
2026-09-29

Week 8
Distributed Datastores
Assignment
Project
50 Points
25%
2026-10-27

Week 12
Final Systems Architecture
Assignment
Exam
100 Points
50%
2026-11-24

Week 13
Total Points: 200 Points
Total
Grading Scale
200 Points
100%
N/A
`;

      const parser = new LocalSyllabusParser();
      const parsed = parser.parseText(tableSyllabus);

      // Verify that assignments received points
      expect(parsed.assignments?.length).toBeGreaterThanOrEqual(2);
      const kernelProj = parsed.assignments?.find(a => a.title.toLowerCase().includes('kernel'));
      expect(kernelProj?.pointsPossible).toBe('50 Points');

      // Verify that 0 readings have "Total Points" as title
      const allReadings = parsed.weeks?.flatMap(w => w.readings || []) || [];
      const totalPointsReadings = allReadings.filter(r =>
        r.title.toLowerCase().includes('total points') ||
        r.title.toLowerCase().includes('total 100') ||
        /^(?:total\s+)?points\b/i.test(r.title)
      );
      expect(totalPointsReadings.length).toBe(0);

      // Verify that genuine readings are preserved
      expect(allReadings.length).toBe(3);
      expect(allReadings[0].title).toBe('Linux Kernel Internals');
    });
  });

  describe('SyllabusImportManager & deduplicateReadingsList', () => {
    it('purges any accidental Total Points items from readings list', () => {
      const mockReadings: Reading[] = [
        {
          id: 'r1',
          courseId: 'c1',
          title: 'Total Points',
          isCompleted: false,
          isDeleted: false,
          isFavorite: false,
          summaryText: '',
          keyTakeawaysText: '',
          mediaType: 'textbook',
          mediaTypeRaw: 'textbook',
          estimatedTimeText: '30m',
          weekNumber: 1
        },
        {
          id: 'r2',
          courseId: 'c1',
          title: 'Total Points: 100',
          isCompleted: false,
          isDeleted: false,
          isFavorite: false,
          summaryText: '',
          keyTakeawaysText: '',
          mediaType: 'textbook',
          mediaTypeRaw: 'textbook',
          estimatedTimeText: '30m',
          weekNumber: 1
        },
        {
          id: 'r3',
          courseId: 'c1',
          title: 'Corey Chapter 1: Basic Principles',
          chapterText: 'Chapter 1',
          isCompleted: false,
          isDeleted: false,
          isFavorite: false,
          summaryText: '',
          keyTakeawaysText: '',
          mediaType: 'textbook',
          mediaTypeRaw: 'textbook',
          estimatedTimeText: '30m',
          weekNumber: 1
        }
      ];

      const clean = deduplicateReadingsList(mockReadings, [{ id: 'c1', courseCode: 'CS 101' }]);
      expect(clean.length).toBe(1);
      expect(clean[0].id).toBe('r3');
      expect(clean[0].title).toBe('Corey Chapter 1: Basic Principles');
    });

    it('SyllabusImportManager.deduplicateReadings rejects total points candidates', () => {
      const candidates = [
        { title: 'Total Points', weekNumber: 1 },
        { title: 'Total Points Possible', weekNumber: 1 },
        { title: 'Total: 100 Points', weekNumber: 2 },
        { title: 'Research Design Fundamentals', chapterText: 'Ch. 2', weekNumber: 2 }
      ];

      const result = SyllabusImportManager.shared.deduplicateReadings(candidates as any, []);
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Research Design Fundamentals');
    });
  });
});
