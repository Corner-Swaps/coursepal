import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { cleanAssignmentTitle } from '../src/utils/readingDisplayHelper';
import { NotificationService, WidgetUpcomingItem } from '../src/services/NotificationService';
import { Course, Reading, Assignment } from '../src/types/models';

describe('Citation, Assignment Title, and Widget Integrity Suite', () => {
  describe('cleanAssignmentTitle', () => {
    it('strips deadline prefixes like "Due:" and "Due by:"', () => {
      expect(cleanAssignmentTitle('Due: Final Project Proposal')).toBe('Final Project Proposal');
      expect(cleanAssignmentTitle('Due by 11:59 PM: Reflection Paper #1')).toBe('Reflection Paper #1');
      expect(cleanAssignmentTitle('Assignment: Family Genogram Report')).toBe('Family Genogram Report');
      expect(cleanAssignmentTitle('Deliverable #2: Case Formulation')).toBe('Case Formulation');
    });

    it('strips multi-week and presentation noise in parentheses', () => {
      expect(cleanAssignmentTitle('Group Presentation (Weeks 5, 7, 8)')).toBe('Group Presentation');
      expect(cleanAssignmentTitle('Group Facilitation Presentation (group presentations)')).toBe('Group Facilitation Presentation');
      expect(cleanAssignmentTitle('(Weeks 5, 7, 8) Group Presentation')).toBe('Group Presentation');
      expect(cleanAssignmentTitle('Final Paper (in-class presentation)')).toBe('Final Paper');
    });

    it('strips trailing due dates and percentages', () => {
      expect(cleanAssignmentTitle('Research Paper - Due Oct 15 at 11:59 PM')).toBe('Research Paper');
      expect(cleanAssignmentTitle('Midterm Exam (25%)')).toBe('Midterm Exam');
      expect(cleanAssignmentTitle('Case Study - 20%')).toBe('Case Study');
    });
  });

  describe('splitMultiCitationCandidate and Author Recognition', () => {
    it('accurately splits citations separated by commas', () => {
      const candidate = {
        title: 'Gehart chapters 1-3, Corey chapter 4',
        mediaType: 'article' as const
      };

      const results = SyllabusImportManager.splitMultiCitationCandidate(candidate);
      expect(results.length).toBe(2);
      expect(results[0].authorName).toBe('Gehart');
      expect(results[0].chapterText).toBe('Chapters 1–3');
      expect(results[1].authorName).toBe('Corey');
      expect(results[1].chapterText).toBe('Chapter 4');
    });

    it('accurately splits citations separated by semicolons', () => {
      const candidate = {
        title: 'Corey (2021) Ch. 4; Gehart (2018) Ch. 2',
        mediaType: 'article' as const
      };

      const results = SyllabusImportManager.splitMultiCitationCandidate(candidate);
      expect(results.length).toBe(2);
      expect(results[0].authorName).toBe('Corey');
      expect(results[0].chapterText).toBe('Chapter 4');
      expect(results[1].authorName).toBe('Gehart');
      expect(results[1].chapterText).toBe('Chapter 2');
    });

    it('preserves multi-author APA citations with commas intact without splitting author names', () => {
      const candidate = {
        title: 'Wada, K., & Fellner, K. D. (2014). Grounded theory in counselling psychology. Canadian Journal of Counselling.',
        mediaType: 'article' as const
      };

      const results = SyllabusImportManager.splitMultiCitationCandidate(candidate);
      expect(results.length).toBe(1);
      expect(results[0].authorName).toBe('Wada, K., & Fellner, K. D.');
    });

    it('recognizes APA single authors with initials and commas', () => {
      const candidate = {
        title: 'Gehart, D. R. (2018). Mastering Competencies in Family Therapy. Cengage.',
        mediaType: 'article' as const
      };

      const results = SyllabusImportManager.splitMultiCitationCandidate(candidate);
      expect(results.length).toBe(1);
      expect(results[0].authorName).toBe('Gehart, D. R.');
    });

    it('recognizes authors without parentheses followed directly by chapter numbers', () => {
      const candidate = {
        title: 'Nichols ch 5',
        mediaType: 'article' as const
      };

      const results = SyllabusImportManager.splitMultiCitationCandidate(candidate);
      expect(results.length).toBe(1);
      expect(results[0].authorName).toBe('Nichols');
      expect(results[0].chapterText).toBe('Chapter 5');
    });
  });

  describe('Deduplication and Repeating Sections Prevention', () => {
    it('consolidates multi-week group presentations into a single assignment with scheduledWeeks', () => {
      const candidates = [
        {
          title: 'Group Facilitation Presentation',
          weekNumber: 5,
          pointsPossible: '25 Points',
          weightPercentage: '25%'
        },
        {
          title: 'Group Facilitation Presentation',
          weekNumber: 7,
          pointsPossible: '25 Points',
          weightPercentage: '25%'
        },
        {
          title: 'Group Facilitation Presentation (group presentations)',
          weekNumber: 8,
          pointsPossible: '25 Points',
          weightPercentage: '25%'
        }
      ];

      const sim = new SyllabusImportManager();
      const deduplicated = sim.deduplicateAssignments(candidates);

      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0].title).toBe('Group Facilitation Presentation');
      expect(deduplicated[0].scheduledWeeks).toEqual([5, 7, 8]);
    });

    it('enriches existing weekly items instead of duplicating from top-level assignments and readings', () => {
      const sim = new SyllabusImportManager();
      const rawDto = {
        course: { code: 'CPC 523', title: 'Psychology of Sexuality' },
        weeks: [
          {
            weekNumber: 1,
            readings: [
              { title: 'Corey (2021) Ch. 1', weekNumber: 1 }
            ],
            assignments: [
              { title: 'Reflection Paper #1', weekNumber: 1 }
            ]
          }
        ],
        readings: [
          { title: 'Corey (2021) Ch. 1', author: 'Corey', isRequired: true }
        ],
        assignments: [
          { title: 'Reflection Paper #1', pointsPossible: '20 Points', weightPercentage: '20%' }
        ]
      };

      const normalized = sim.normalizeAndValidateSyllabusPayload(rawDto);
      expect(normalized.candidateReadings.length).toBe(1);
      expect(normalized.candidateAssignments.length).toBe(1);
      expect(normalized.candidateReadings[0].authorName).toBe('Gerald Corey');
      expect(normalized.candidateAssignments[0].pointsPossible).toBe('20 Points');
      expect(normalized.candidateAssignments[0].weightPercentage).toBe('20%');
    });
  });

  describe('Widget Completeness across Assignment, Reading, and Module Tasks', () => {
    it('includes assignment, reading, and module in top upcoming items when all three are pending', () => {
      const sampleCourse: Course = {
        id: 'c-1',
        creatorId: 'user-1',
        courseCode: 'CPC 512',
        courseName: 'Family Systems',
        hexColor: '#2470F5',
        instructorName: 'Dr. Smith',
        termWeeks: 10,
        sharingCode: 'ABC123',
        isDeleted: false,
        isFavorite: false,
        createdAt: new Date(),
        weeks: [],
        assignments: [],
        syllabusDocs: []
      };

      const sampleAssignment: Assignment = {
        id: 'a-1',
        title: 'Case Formulation Paper',
        courseCode: 'CPC 512',
        weekNumber: 3,
        dueDate: new Date(Date.now() + 24 * 3600 * 1000), // tomorrow
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        rubricCriteria: []
      };

      const sampleReading: Reading = {
        id: 'r-1',
        title: 'Gehart (2018) Ch. 4',
        courseCode: 'CPC 512',
        weekNumber: 2,
        chapterText: 'Chapter 4',
        dueDate: new Date(Date.now() + 48 * 3600 * 1000), // in 2 days
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        mediaType: 'article',
        mediaTypeRaw: 'article',
        isRequired: true,
        summaryText: '',
        keyTakeawaysText: '',
        estimatedTimeText: '~45 min read'
      };

      const sampleModule: Reading = {
        id: 'm-1',
        title: 'Narrative Therapy Principles',
        courseCode: 'CPC 512',
        moduleNumber: 3,
        moduleMention: 'Module 3',
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        mediaType: 'article',
        mediaTypeRaw: 'article',
        isRequired: true,
        summaryText: '',
        keyTakeawaysText: '',
        estimatedTimeText: '~45 min read'
      };

      const snapshot = NotificationService.shared.generateWidgetSnapshot({
        courses: [sampleCourse],
        assignments: [sampleAssignment],
        readings: [sampleReading, sampleModule],
        now: new Date()
      });

      const types = snapshot.upcomingItems.map((item: WidgetUpcomingItem) => item.type);
      expect(types).toContain('assignment');
      expect(types).toContain('reading');
      expect(types).toContain('module');

      const moduleItem = snapshot.upcomingItems.find((item: WidgetUpcomingItem) => item.type === 'module');
      expect(moduleItem).toBeDefined();
      expect(moduleItem?.dueText).toBe('Module 3');
      expect(moduleItem?.deepLinkUrl).toContain('viewMode=modules');
    });
  });

  describe('Textbook and Author Extraction & Office Hours', () => {
    it('accurately parses string citations into structured TextbookResource', () => {
      const apaString = 'Creswell, J.W., & Creswell. J. D. (2022). Research Design: Qualitative, Quantitative, and Mixed Methods Approaches (6th ed.). SAGE Publications. ISBN-13: 978-1506386706';
      const parsed = SyllabusImportManager.parseCitationStringToTextbook(apaString);
      expect(parsed).not.toBeNull();
      expect(parsed?.authorName).toContain('Creswell');
      expect(parsed?.title).toContain('Research Design');
      expect(parsed?.edition).toBe('6th ed.');
      expect(parsed?.isbn).toBe('978-1506386706');
    });

    it('extracts string textbooks and office hours from payload in normalizeAndValidateSyllabusPayload', () => {
      const rawDto = {
        courseName: 'Research Methods',
        courseCode: 'CPC 514',
        officeHours: 'Tuesdays & Thursdays 2:00 PM – 4:00 PM',
        textbooks: [
          'Creswell, J.W., & Creswell. J. D. (2022). Research Design: Qualitative, Quantitative, and Mixed Methods Approaches (6th ed.). SAGE Publications.'
        ],
        weeks: []
      };

      const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(rawDto);
      expect(normalized.officeHours).toBe('Tuesdays & Thursdays 2:00 PM – 4:00 PM');
      expect(normalized.textbooks.length).toBe(1);
      expect(normalized.textbooks[0].authorName).toContain('Creswell');
      expect(normalized.textbooks[0].title).toContain('Research Design');
    });

    it('synthesizes textbook catalog from schedule readings when textbooks catalog is empty', () => {
      const rawDto = {
        courseName: 'Scalable Machine Learning Systems',
        courseCode: 'DATA 630',
        weeks: [
          {
            weekNumber: 1,
            readings: [
              {
                title: 'Designing Machine Learning Systems',
                authorName: 'Huyen, C.',
                chapterText: 'Chapter 1'
              },
              {
                title: 'Designing Data-Intensive Applications',
                authorName: 'Kleppmann, M.',
                chapterText: 'Chapter 2'
              }
            ]
          }
        ]
      };

      const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(rawDto);
      expect(normalized.textbooks.length).toBe(2);
      expect(normalized.textbooks.some(t => t.authorName === 'Chip Huyen')).toBe(true);
      expect(normalized.textbooks.some(t => t.authorName === 'Martin Kleppmann')).toBe(true);
    });

    it('propagates textbooks and office hours during enrichPayloadWithLocalExtraction', () => {
      const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload({
        courseName: 'Research Methods',
        courseCode: 'CPC 514',
        weeks: []
      });

      const localDto: any = {
        id: 'local-1',
        courseName: 'Research Methods',
        courseCode: 'CPC 514',
        officeHours: 'Office: Mon 10-12',
        textbooks: [
          { title: 'Research Design', authorName: 'Creswell & Creswell', edition: '6th ed.' }
        ],
        assignments: [
          { id: 'a1', title: 'Article Review', weightPercentage: '20%' }
        ]
      };

      const enriched = SyllabusImportManager.shared.enrichPayloadWithLocalExtraction(normalized, localDto);
      expect(enriched.officeHours).toBe('Office: Mon 10-12');
      expect(enriched.textbooks.length).toBe(1);
      expect(enriched.textbooks[0].authorName).toBe('Creswell & Creswell');
    });
  });
});
