import {
  cleanChapterFromRaw,
  stripChapterMentions,
  distillSmartReadingTitle,
  formatDisplayTitleWithChapter,
  formatAuthorAndPagesSubtitle,
  parseSafeDate,
  formatAssignmentDueDate,
  getSanitizedCoursePill,
  deduplicateReadingsList,
  isReadingWeekEnabled,
  extractReadingWeekNumber,
  isGenericPlaceholderReadingTitle,
  extractWeekFromText,
  deriveWeekForReading,
  deriveWeekForAssignment,
  healItemWeeks,
  formatShortDocumentTitle,
  discoverReadingTopics,
  formatSuggestedDatePill,
  formatWeekHeaderDate,
  formatSuggestedReadingCardText,
  isRealDateOrRangeString,
  isGenericDatePlaceholder,
  cleanDateRangeDisplay,
  resolveReadingMediaType
} from '../src/utils/readingDisplayHelper';
import { sanitizeAssignment, sanitizeReading } from '../src/context/CoursePalContext';
import { Reading, Course } from '../src/types/models';

describe('ReadingDisplayHelper Chapter Deduplication & Normalization', () => {
  describe('cleanChapterFromRaw', () => {
    it('normalizes single chapter abbreviations to canonical "Chapter X"', () => {
      expect(cleanChapterFromRaw('Ch. 1')).toBe('Chapter 1');
      expect(cleanChapterFromRaw('ch 12')).toBe('Chapter 12');
      expect(cleanChapterFromRaw('Chap. 7')).toBe('Chapter 7');
      expect(cleanChapterFromRaw('Chapter 9')).toBe('Chapter 9');
    });

    it('normalizes multiple chapters to canonical "Chapters X & Y" or "Chapters X–Y"', () => {
      expect(cleanChapterFromRaw('Ch. 12 & 13')).toBe('Chapters 12 & 13');
      expect(cleanChapterFromRaw('Chapters 1 and 2')).toBe('Chapters 1 & 2');
      expect(cleanChapterFromRaw('ch 3-4')).toBe('Chapters 3–4');
      expect(cleanChapterFromRaw('Ch. 10, 11')).toBe('Chapters 10, 11');
      expect(cleanChapterFromRaw('Chapters 14 & 15')).toBe('Chapters 14 & 15');
    });

    it('resolves duplicated chapter artifacts like "Chapter 1 · Ch. 1"', () => {
      expect(cleanChapterFromRaw('Chapter 1 · Ch. 1')).toBe('Chapter 1');
    });

    it('accepts pure digit inputs when provided as chapter text', () => {
      expect(cleanChapterFromRaw('12')).toBe('Chapter 12');
      expect(cleanChapterFromRaw('12 & 13')).toBe('Chapters 12 & 13');
      expect(cleanChapterFromRaw('1-4')).toBe('Chapters 1–4');
    });

    it('rejects non-chapter text, dates, years, and syllabus titles', () => {
      expect(cleanChapterFromRaw('Assigned Readings')).toBeNull();
      expect(cleanChapterFromRaw('Course Shell Readings')).toBeNull();
      expect(cleanChapterFromRaw('Theory and Practice (2014)')).toBeNull();
      expect(cleanChapterFromRaw('Module 1: Intro')).toBeNull();
      expect(cleanChapterFromRaw('')).toBeNull();
      expect(cleanChapterFromRaw(null)).toBeNull();
      expect(cleanChapterFromRaw(undefined)).toBeNull();
    });
  });

  describe('stripChapterMentions', () => {
    it('strips all variants of chapter mentions leaving only substantive text', () => {
      expect(stripChapterMentions('Chapter 1 · Ch. 1')).toBe('');
      expect(stripChapterMentions('Chapters 12 & 13')).toBe('');
      expect(stripChapterMentions('Chapter 4: Group Dynamics')).toBe('Group Dynamics');
      expect(stripChapterMentions('Ch. 5 - Working Stage')).toBe('Working Stage');
      expect(stripChapterMentions('Theory and Practice of Group Psychotherapy')).toBe(
        'Theory and Practice of Group Psychotherapy'
      );
    });
  });

  describe('formatDisplayTitleWithChapter', () => {
    it('states the chapter EXACTLY ONCE when title is only chapter references', () => {
      expect(formatDisplayTitleWithChapter('Chapter 1 · Ch. 1', 'Ch. 1')).toBe('Chapter 1');
      expect(formatDisplayTitleWithChapter('Chapters 12 & 13', 'Ch. 12 & 13')).toBe('Chapters 12 & 13');
      expect(formatDisplayTitleWithChapter('Chapter 2', 'Ch. 2')).toBe('Chapter 2');
      expect(formatDisplayTitleWithChapter({ title: 'Chapters 5 & 6', chapterText: 'Ch. 5 & 6' })).toBe(
        'Chapters 5 & 6'
      );
    });

    it('combines chapter and substantive title cleanly without repeating', () => {
      expect(
        formatDisplayTitleWithChapter({
          title: 'Chapter 4: Group Dynamics',
          chapterText: 'Ch. 4'
        })
      ).toBe('Chapter 4 · Group Dynamics');
    });

    it('preserves non-chapter titles like "Assigned Readings" without injecting chapters', () => {
      expect(formatDisplayTitleWithChapter('Assigned Readings', undefined)).toBe('Assigned Readings');
    });
  });

  describe('formatAuthorAndPagesSubtitle', () => {
    it('strictly excludes chapter mentions so chapters are never repeated down below', () => {
      const sub = formatAuthorAndPagesSubtitle({
        authorName: 'Yalom',
        pagesText: 'Ch. 12',
        resourceTitle: 'Theory and Practice of Group Psychotherapy'
      });
      expect(sub).toBe('Theory and Practice of Group Psychotherapy · Yalom');
      expect(sub.includes('Ch.')).toBe(false);
      expect(sub.includes('Chapter')).toBe(false);
    });

    it('includes page numbers ONLY when they are genuine page digits or ranges', () => {
      const sub = formatAuthorAndPagesSubtitle({
        authorName: 'Corey',
        pagesText: '14-35',
        resourceTitle: 'Groups: Process and Practice'
      });
      expect(sub).toBe('Groups: Process and Practice · Corey · pp. 14–35');
    });

    it('cleans textbook and reading placeholder names from resource title', () => {
      const sub = formatAuthorAndPagesSubtitle({
        authorName: 'Corey',
        pagesText: '',
        resourceTitle: 'Textbook'
      });
      expect(sub).toBe('Corey');
    });

    it('deduplicates when textbook title matches course name or is already in title', () => {
      const sub = formatAuthorAndPagesSubtitle(
        'Goldenberg & Goldenberg',
        '1-35',
        'Family Therapy: An Overview',
        'Family Therapy: An Overview',
        'Family Systems Therapy'
      );
      // Because "Family Therapy: An Overview" is already the displayTitle, subtitle only shows author & pages
      expect(sub).toBe('Goldenberg & Goldenberg · pp. 1–35');
    });
  });

  describe('User Case: Family Therapy Deduplication Across Card', () => {
    it('handles identical textbook and course redundancy without repeating phrases', () => {
      const rawReading = {
        id: 'r1',
        title: 'Family Therapy: An Overview',
        chapterText: 'Chapter 1',
        resourceTitle: 'Family Therapy: An Overview',
        authorName: 'Goldenberg & Goldenberg',
        pagesText: 'pp. 1-35',
        courseCode: 'CPC 512'
      };
      const courseName = 'Family Therapy';

      const displayTitle = formatDisplayTitleWithChapter(
        rawReading.title,
        rawReading.chapterText,
        rawReading.resourceTitle,
        courseName
      );
      expect(displayTitle).toBe('Chapter 1');

      const displaySubtitle = formatAuthorAndPagesSubtitle(
        rawReading.authorName,
        rawReading.pagesText,
        rawReading.resourceTitle,
        displayTitle,
        courseName
      );
      expect(displaySubtitle).toBe('Family Therapy: An Overview · Goldenberg & Goldenberg · pp. 1–35');
    });

    it('handles repeated prefix stutter like "Family Therapy: Family Therapy: An Overview"', () => {
      const displayTitle = formatDisplayTitleWithChapter(
        'Family Therapy: Family Therapy: An Overview',
        'Chapter 1',
        'Family Therapy: An Overview',
        'Family Systems Therapy'
      );
      expect(displayTitle).toBe('Chapter 1');
    });

    it('retains distinct chapter topic when reading has a genuine sub-topic', () => {
      const displayTitle = formatDisplayTitleWithChapter(
        'Chapter 4: Adlerian Family Therapy',
        'Chapter 4',
        'Family Therapy: An Overview',
        'Family Systems Therapy'
      );
      expect(displayTitle).toBe('Chapter 4 · Adlerian Family Therapy');

      const displaySubtitle = formatAuthorAndPagesSubtitle(
        'Goldenberg & Goldenberg',
        'pp. 95-130',
        'Family Therapy: An Overview',
        displayTitle,
        'Family Systems Therapy'
      );
      expect(displaySubtitle).toBe('Family Therapy: An Overview · Goldenberg & Goldenberg · pp. 95–130');
    });

    it('cleans Gehart list artifacts like Chapters 1-3 · 3 and Chapters 4-10 · 10', () => {
      expect(
        formatDisplayTitleWithChapter({
          title: 'Chapters 1–3 · 3',
          chapterText: 'Chapters 1-3',
          resourceTitle: 'Family Therapy: An Overview',
          authorName: 'Gehart'
        })
      ).toBe('Chapters 1–3');

      expect(
        formatDisplayTitleWithChapter({
          title: 'Chapters 4–10 · 10',
          chapterText: 'Chapters 4-10',
          resourceTitle: 'Family Therapy: An Overview',
          authorName: 'Gehart'
        })
      ).toBe('Chapters 4–10');

      expect(
        formatDisplayTitleWithChapter({
          title: 'Chapters 1–3 · 3: overview Gehart',
          chapterText: 'Chapters 1-3',
          resourceTitle: 'Family Therapy: An Overview',
          authorName: 'Gehart'
        })
      ).toBe('Chapters 1–3');
    });

    it('cleans corrupted subtitle fragments like "overview Gehart 3" and "4: 10 · Gehart"', () => {
      const sub1 = formatAuthorAndPagesSubtitle({
        authorName: 'Gehart',
        resourceTitle: 'overview Gehart 3'
      });
      expect(sub1).toBe('Gehart');

      const sub2 = formatAuthorAndPagesSubtitle({
        authorName: 'Gehart',
        resourceTitle: '4: 10'
      });
      expect(sub2).toBe('Gehart');
    });

    it('formats substantive textbook title with chapters when no sub-topic exists (e.g. Gehart Mastering Competencies)', () => {
      const displayTitle = formatDisplayTitleWithChapter(
        {
          title: 'Chapters 1–3',
          chapterText: 'Chapters 1-3',
          resourceTitle: 'Mastering Competencies in Family Therapy',
          authorName: 'Gehart'
        },
        'Chapters 1-3',
        'Mastering Competencies in Family Therapy',
        'Family Therapy',
        'Gehart'
      );
      expect(displayTitle).toBe('Mastering Competencies in Family Therapy · Chapters 1–3');

      const displaySubtitle = formatAuthorAndPagesSubtitle(
        'Gehart',
        undefined,
        'Mastering Competencies in Family Therapy',
        displayTitle,
        'Family Therapy'
      );
      expect(displaySubtitle).toBe('Gehart');
    });
  });

  describe('parseSafeDate & formatAssignmentDueDate', () => {
    it('safely parses Date objects, ISO strings, timestamps, and returns null for invalid values', () => {
      const date = new Date(2026, 4, 14);
      expect(parseSafeDate(date)).toEqual(date);
      expect(parseSafeDate('2026-05-14T12:00:00.000Z')?.getFullYear()).toBe(2026);
      expect(parseSafeDate(date.getTime())?.getFullYear()).toBe(2026);
      expect(parseSafeDate(null)).toBeNull();
      expect(parseSafeDate(undefined)).toBeNull();
      expect(parseSafeDate('invalid-date-string')).toBeNull();
    });

    it('formats assignment due date cleanly e.g. "Due Thursday, May 14"', () => {
      const date = new Date(2026, 4, 14);
      expect(formatAssignmentDueDate(date)).toBe('Due Thursday, May 14');
      expect(formatAssignmentDueDate(null)).toBeNull();
    });
  });

  describe('sanitizeAssignment', () => {
    it('hydrates string due dates to Date objects and normalizes points and weights', () => {
      const sanitized = sanitizeAssignment({
        id: 'test-1',
        title: ' Research Paper  ',
        weekNumber: 3,
        dueDate: ('2026-05-14T00:00:00.000Z' as any),
        pointsPossible: '100',
        weightPercentage: '20',
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        rubricCriteria: []
      });

      expect(sanitized.title).toBe('Research Paper');
      expect(sanitized.dueDate instanceof Date).toBe(true);
      expect(sanitized.pointsPossible).toBe('100 Pts');
      expect(sanitized.weightPercentage).toBe('20%');
      expect(sanitized.weekNumber).toBe(3);
    });

    it('preserves weekNumber: 0 when week toggle is off (does not force week 1)', () => {
      const sanitized = sanitizeAssignment({
        id: 'test-2',
        title: 'Midterm Essay',
        weekNumber: 0,
        dueDate: null,
        pointsPossible: '50',
        weightPercentage: '15',
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        rubricCriteria: []
      });

      expect(sanitized.weekNumber).toBe(0);
    });
  });

  describe('sanitizeReading', () => {
    it('preserves weekNumber: 0 and weekId: undefined when week is turned off', () => {
      const sanitized = sanitizeReading({
        id: 'r-1',
        title: 'Intro to Algorithms',
        chapterText: 'Chapter 1',
        weekNumber: 0,
        weekId: undefined,
        mediaType: 'textbook',
        mediaTypeRaw: 'textbook',
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        summaryText: '',
        keyTakeawaysText: '',
        estimatedTimeText: ''
      });

      expect(sanitized.weekNumber).toBe(0);
      expect(sanitized.weekId).toBeUndefined();
    });
  });

  describe('isReadingWeekEnabled & extractReadingWeekNumber', () => {
    it('correctly detects active week toggle', () => {
      expect(isReadingWeekEnabled({ weekNumber: 2 })).toBe(true);
      expect(isReadingWeekEnabled({ weekId: 'w-4' })).toBe(true);
      expect(extractReadingWeekNumber({ weekNumber: 2 })).toBe(2);
      expect(extractReadingWeekNumber({ weekId: 'w-4' })).toBe(4);
    });

    it('returns false and null when week toggle is turned off or not set', () => {
      expect(isReadingWeekEnabled({ weekNumber: 0 })).toBe(false);
      expect(isReadingWeekEnabled({ weekNumber: null, weekId: undefined })).toBe(false);
      expect(isReadingWeekEnabled({ weekId: 'none' })).toBe(false);
      expect(isReadingWeekEnabled({ weekId: '' })).toBe(false);
      expect(extractReadingWeekNumber({ weekNumber: 0 })).toBeNull();
      expect(extractReadingWeekNumber({ weekId: undefined })).toBeNull();
      expect(extractReadingWeekNumber({ weekId: 'none' })).toBeNull();
    });
  });

  describe('getSanitizedCoursePill', () => {
    it('returns courseCode when it is valid and non-generic', () => {
      expect(getSanitizedCoursePill('CPC 514', { courseCode: 'CPC 514', courseName: 'Family Therapy' })).toBe('CPC 514');
      expect(getSanitizedCoursePill(null, { courseCode: 'PSYC 101', courseName: 'Intro Psych' })).toBe('PSYC 101');
    });

    it('rejects generic "NEW" or placeholder course codes and falls back to courseName', () => {
      expect(getSanitizedCoursePill('NEW', { courseCode: 'NEW', courseName: 'Family Systems Theory' })).toBe('Family Systems Theory');
      expect(getSanitizedCoursePill('NEW COU', { courseCode: 'NEW COU', courseName: 'Family Systems Theory' })).toBe('Family Systems Theory');
      expect(getSanitizedCoursePill('Reading', { courseCode: 'Reading', courseName: 'Cognitive Psychology' })).toBe('Cognitive Psychology');
      expect(getSanitizedCoursePill('Assignment', { courseCode: 'Assignment', courseName: 'Statistics' })).toBe('Statistics');
    });

    it('falls back to "Reading" when neither code nor name is available', () => {
      expect(getSanitizedCoursePill(null, null)).toBe('Reading');
      expect(getSanitizedCoursePill('NEW', null)).toBe('Reading');
      expect(getSanitizedCoursePill('   ', { courseCode: 'NEW', courseName: '   ' })).toBe('Reading');
    });
  });

  describe('deduplicateReadingsList', () => {
    const courses = [
      { id: 'c1', courseCode: 'CPC 514', courseName: 'Family Systems Theory' }
    ];

    it('merges intra-week duplicate chapter cards into a single clean card with the richer title', () => {
      const readings = [
        {
          id: 'r1',
          title: 'Chapters 1–3 · Systems Theory and the History of Family Therapy',
          chapterText: 'Chapters 1-3',
          authorName: 'Gehart',
          resourceTitle: 'Family Therapy: An Overview',
          weekId: 'week-1',
          courseCode: 'CPC 514',
          isCompleted: false,
          isDeleted: false
        },
        {
          id: 'r2',
          title: 'Chapters 1–3',
          chapterText: 'Chapters 1-3',
          authorName: 'Gehart',
          resourceTitle: 'overview Gehart',
          weekId: 'week-1',
          courseCode: 'CPC 514',
          isCompleted: false,
          isDeleted: false
        }
      ];

      const deduplicated = deduplicateReadingsList(readings, courses);
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].title).toBe('Chapters 1–3 · Systems Theory and the History of Family Therapy');
      expect(deduplicated[0].authorName).toBe('Gehart');
    });

    it('preserves completion status when one of the merged cards is completed', () => {
      const readings = [
        {
          id: 'r1',
          title: 'Chapters 1–3',
          chapterText: 'Chapters 1-3',
          authorName: 'Gehart',
          weekId: 'week-1',
          courseCode: 'CPC 514',
          isCompleted: false,
          isDeleted: false
        },
        {
          id: 'r2',
          title: 'Chapters 1–3 · Systems Theory',
          chapterText: 'Chapters 1-3',
          authorName: 'Gehart',
          weekId: 'week-1',
          courseCode: 'CPC 514',
          isCompleted: true,
          isDeleted: false
        }
      ];

      const deduplicated = deduplicateReadingsList(readings, courses);
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].isCompleted).toBe(true);
    });

    it('consolidates multi-week identical clones that share the exact same chapter, author, and due date', () => {
      const readings = [
        // Week 5
        {
          id: 'r-w5-1',
          title: 'Chapters 4–10 · Family Therapy Models',
          chapterText: 'Chapters 4-10',
          authorName: 'Gehart',
          weekId: 'week-5',
          courseCode: 'CPC 514',
          dueDate: new Date(2026, 3, 9),
          isCompleted: false,
          isDeleted: false
        },
        {
          id: 'r-w5-2',
          title: 'Chapters 4–10',
          chapterText: 'Chapters 4-10',
          authorName: 'Gehart',
          weekId: 'week-5',
          courseCode: 'CPC 514',
          dueDate: new Date(2026, 3, 9),
          isCompleted: false,
          isDeleted: false
        },
        // Week 7 clone
        {
          id: 'r-w7-1',
          title: 'Chapters 4–10 · Family Therapy Models',
          chapterText: 'Chapters 4-10',
          authorName: 'Gehart',
          weekId: 'week-7',
          courseCode: 'CPC 514',
          dueDate: new Date(2026, 3, 9),
          isCompleted: false,
          isDeleted: false
        },
        // Week 8 clone
        {
          id: 'r-w8-1',
          title: 'Chapters 4–10',
          chapterText: 'Chapters 4-10',
          authorName: 'Gehart',
          weekId: 'week-8',
          courseCode: 'CPC 514',
          dueDate: new Date(2026, 3, 9),
          isCompleted: false,
          isDeleted: false
        }
      ];

      const deduplicated = deduplicateReadingsList(readings, courses);
      // Instead of 4 clutter cards, it is consolidated into 1 distinct reading
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].chapterText).toBe('Chapters 4–10');
      expect(deduplicated[0].title).toBe('Chapters 4–10 · Family Therapy Models');
    });
  });

  describe('User Case: Leading Topic Numbers & Dangling Parentheses (Gehart Syllabi)', () => {
    it('infers Chapter X from leading topic numbers e.g. "7 Experiential Family Therapy"', () => {
      expect(cleanChapterFromRaw('7 Experiential Family Therapy')).toBe('Chapter 7');
      expect(formatDisplayTitleWithChapter('7 Experiential Family Therapy')).toBe(
        'Chapter 7 · Experiential Family Therapy'
      );
    });

    it('infers Chapter 9 and cleans secondary course topic across newline', () => {
      const raw = '9 Cognitive Behavioural Family Therapy\nClinical issues in Family Counselling';
      expect(cleanChapterFromRaw(raw)).toBe('Chapter 9');
      expect(formatDisplayTitleWithChapter(raw)).toBe(
        'Chapter 9 · Cognitive Behavioural Family Therapy'
      );
    });

    it('cleans dangling parentheses and years from author and resource subtitles', () => {
      expect(formatAuthorAndPagesSubtitle('Gehart (')).toBe('Gehart');
      expect(formatAuthorAndPagesSubtitle('Gehart (2014)')).toBe('Gehart');
      expect(formatAuthorAndPagesSubtitle('Gehart (')).toBe('Gehart');
      expect(
        formatAuthorAndPagesSubtitle({
          authorName: 'Gehart (',
          resourceTitle: 'Mastering Competencies ('
        })
      ).toBe('Mastering Competencies · Gehart');
    });

    it('does not misclassify calendar dates as chapter numbers', () => {
      expect(cleanChapterFromRaw('24 April 2026')).toBeNull();
      expect(cleanChapterFromRaw('14 May')).toBeNull();
      expect(cleanChapterFromRaw('3 October')).toBeNull();
    });
  });

  describe('isGenericPlaceholderReadingTitle & Placeholder Drop', () => {
    it('identifies generic placeholder words as placeholders', () => {
      expect(isGenericPlaceholderReadingTitle('Articles')).toBe(true);
      expect(isGenericPlaceholderReadingTitle('articles')).toBe(true);
      expect(isGenericPlaceholderReadingTitle('Articles:')).toBe(true);
      expect(isGenericPlaceholderReadingTitle('• Articles')).toBe(true);
      expect(isGenericPlaceholderReadingTitle('Required Articles')).toBe(true);
      expect(isGenericPlaceholderReadingTitle('Selected Articles')).toBe(true);
      expect(isGenericPlaceholderReadingTitle('Readings')).toBe(true);
      expect(isGenericPlaceholderReadingTitle('Required Readings')).toBe(true);
      expect(isGenericPlaceholderReadingTitle('Handouts')).toBe(true);
      expect(isGenericPlaceholderReadingTitle('Lecture Notes')).toBe(true);
      expect(isGenericPlaceholderReadingTitle('TBD')).toBe(true);
      expect(isGenericPlaceholderReadingTitle(null)).toBe(true);
      expect(isGenericPlaceholderReadingTitle('')).toBe(true);
    });

    it('does not classify substantive titles or assignments as placeholders', () => {
      expect(isGenericPlaceholderReadingTitle('Gehart Chapter 5')).toBe(false);
      expect(isGenericPlaceholderReadingTitle('Research Article Analysis')).toBe(false);
      expect(isGenericPlaceholderReadingTitle('Articles on Structural Family Therapy')).toBe(false);
      expect(isGenericPlaceholderReadingTitle('Chapter 1')).toBe(false);
      expect(isGenericPlaceholderReadingTitle('Micro-Skills Video Recording')).toBe(false);
    });

    it('deduplicateReadingsList automatically drops placeholder items e.g. "Articles"', () => {
      const list = [
        { id: 'r1', title: 'Gehart chapter 5', weekNumber: 2 },
        { id: 'r2', title: 'Articles', weekNumber: 2 },
        { id: 'r3', title: 'Required Articles', weekNumber: 2 }
      ];
      const result = deduplicateReadingsList(list);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Gehart chapter 5');
    });
  });

  describe('extractWeekFromText & Week Derivation', () => {
    it('extracts week numbers from various academic text formats', () => {
      expect(extractWeekFromText('Week 3: Theoretical Perspectives')).toBe(3);
      expect(extractWeekFromText('Assigned for W-4')).toBe(4);
      expect(extractWeekFromText('Module 2 Assignment')).toBe(2);
      expect(extractWeekFromText('Unit 5 Exam')).toBe(5);
      expect(extractWeekFromText('Session 7 Discussion')).toBe(7);
      expect(extractWeekFromText('Random text without week')).toBeNull();
      expect(extractWeekFromText(null)).toBeNull();
    });

    it('derives correct week for readings and turns on week by default', () => {
      const reading1: any = {
        id: 'r-test-1',
        title: 'Cybernetics in Family Therapy',
        relevantTopics: 'Week 2 Systems Theory',
        weekNumber: 0
      };
      expect(deriveWeekForReading(reading1)).toBe(2);

      const reading2: any = {
        id: 'r-test-2',
        title: 'Chapter 4: Structural Models',
        weekNumber: 0
      };
      expect(deriveWeekForReading(reading2)).toBe(4);
    });

    it('derives correct week for assignments from titles, modules, and due dates', () => {
      const assign1: any = {
        id: 'a-test-1',
        title: 'Week 3: Peer Review Discussion Feedback',
        weekNumber: 0
      };
      expect(deriveWeekForAssignment(assign1)).toBe(3);

      const assign2: any = {
        id: 'a-test-2',
        title: 'Midterm Exam',
        weekNumber: 0
      };
      expect(deriveWeekForAssignment(assign2)).toBe(5);

      const assign3: any = {
        id: 'a-test-3',
        title: 'Final Capstone Project',
        weekNumber: 0
      };
      expect(deriveWeekForAssignment(assign3)).toBe(10);
    });

    it('healItemWeeks heals previously zeroed readings and assignments to active weeks', () => {
      const mockCourses: any[] = [
        { id: 'c-1', courseCode: 'CPC 514', courseName: 'Family Therapy', termWeeks: 10 }
      ];
      const mockReadings: any[] = [
        { id: 'r-1', courseCode: 'CPC 514', title: 'Chapter 1 Foundations', weekNumber: 0 },
        { id: 'r-2', courseCode: 'CPC 514', title: 'Chapter 2 History', relevantTopics: 'Week 2', weekNumber: 0 },
        { id: 'r-3', courseCode: 'CPC 514', title: 'Advanced Topics', weekNumber: 3, weekId: 'w-3' }
      ];
      const mockAssignments: any[] = [
        { id: 'a-1', courseCode: 'CPC 514', title: 'Week 1: Discussion Feedback', weekNumber: 0 },
        { id: 'a-2', courseCode: 'CPC 514', title: 'Midterm Paper', weekNumber: 0 },
        { id: 'a-3', courseCode: 'CPC 514', title: 'Final Capstone', weekNumber: 0 }
      ];

      const { readings, assignments } = healItemWeeks(mockCourses, mockReadings, mockAssignments);

      // All readings must have weekNumber >= 1 and valid weekId
      expect(readings.every(r => (r.weekNumber ?? 0) > 0)).toBe(true);
      expect(readings.every(r => typeof r.weekId === 'string' && r.weekId.startsWith('w-'))).toBe(true);
      expect(readings[0].weekNumber).toBe(1);
      expect(readings[1].weekNumber).toBe(2);
      expect(readings[2].weekNumber).toBe(3);

      // All assignments must have weekNumber >= 1
      expect(assignments.every(a => (a.weekNumber ?? 0) > 0)).toBe(true);
      expect(assignments[0].weekNumber).toBe(1);
      expect(assignments[1].weekNumber).toBe(5);
      expect(assignments[2].weekNumber).toBe(10);
    });
  });

  describe('formatShortDocumentTitle', () => {
    it('truncates long document names to the first 4 words and strips file extensions', () => {
      const longTitle = 'PSYCH_101_Introduction_To_Cognitive_Psychology_Spring_2026_Final_Syllabus.pdf';
      expect(formatShortDocumentTitle(longTitle)).toBe('PSYCH 101 Introduction To');
    });

    it('handles short document titles without truncating', () => {
      const shortTitle = 'Biology Syllabus.pdf';
      expect(formatShortDocumentTitle(shortTitle)).toBe('Biology Syllabus');
    });

    it('strips bracketed and parenthesized artifacts', () => {
      const titleWithBrackets = 'History [PDF] 201 (Final).docx';
      expect(formatShortDocumentTitle(titleWithBrackets)).toBe('History 201');
    });

    it('handles null or undefined safely', () => {
      expect(formatShortDocumentTitle(null)).toBe('Document');
      expect(formatShortDocumentTitle(undefined)).toBe('Document');
    });
  });

  describe('discoverReadingTopics', () => {
    it('returns empty array when reading only has chapter or page text and no substantive topic', () => {
      const reading = {
        id: 'r1',
        courseCode: 'BIO 101',
        title: 'Chapter 4',
        chapterText: 'Chapter 4',
        pagesText: 'pp. 120-155',
        relevantTopics: 'Chapter 4, pp. 120-155, Week 1',
        isCompleted: false
      } as unknown as Reading;
      const topics = discoverReadingTopics(reading);
      expect(topics).toEqual([]);
    });

    it('extracts real topic after chapter prefix from title', () => {
      const reading = {
        id: 'r2',
        courseCode: 'BIO 101',
        title: 'Chapter 4: Cell Division and Mitosis',
        chapterText: 'Chapter 4',
        relevantTopics: 'Chapter 4',
        isCompleted: false
      } as unknown as Reading;
      const topics = discoverReadingTopics(reading);
      expect(topics).toEqual(['Cell Division and Mitosis']);
    });

    it('returns genuine topics from relevantTopics while filtering out chapters, pages, and week references', () => {
      const reading = {
        id: 'r3',
        courseCode: 'CS 201',
        title: 'Introduction to Algorithms',
        chapterText: 'Ch. 3',
        relevantTopics: 'Week 2, Ch. 3, Graph Traversal, Breadth-First Search, pp. 45-60',
        isCompleted: false
      } as unknown as Reading;
      const topics = discoverReadingTopics(reading);
      expect(topics).toEqual(['Graph Traversal', 'Breadth-First Search']);
    });

    it('derives topic from course week theme when available and reading has no explicit topic', () => {
      const course = {
        id: 'c1',
        courseCode: 'PHIL 101',
        courseName: 'Ethics',
        hexColor: '#2470F5',
        termYear: 'Fall 2026',
        createdAt: new Date(),
        updatedAt: new Date(),
        syllabusData: {
          courseInfo: { courseCode: 'PHIL 101', courseName: 'Ethics' },
          gradingCriteria: [],
          assignments: [],
          weeks: [
            { weekNumber: 3, theme: 'Week 3: Utilitarianism and Deontology', readings: [] }
          ]
        }
      } as unknown as Course;

      const reading = {
        id: 'r4',
        courseCode: 'PHIL 101',
        title: 'Selected Excerpts',
        weekNumber: 3,
        isCompleted: false
      } as unknown as Reading;

      const topics = discoverReadingTopics(reading, [course]);
      expect(topics).toEqual(['Utilitarianism and Deontology']);
    });

    it('filters out generic placeholder labels like "readings", "core materials", "article"', () => {
      const reading = {
        id: 'r5',
        courseCode: 'ENG 102',
        title: 'Assigned Reading',
        relevantTopics: 'Required Readings, Core Materials, Article',
        isCompleted: false
      } as unknown as Reading;
      expect(discoverReadingTopics(reading)).toEqual([]);
    });
  });

  describe('formatSuggestedDatePill', () => {
    it('formats valid Date or date string to "Suggested: Mon Day"', () => {
      const d = new Date(2026, 8, 16); // Sep 16, 2026
      expect(formatSuggestedDatePill(d)).toBe('Suggested: Sep 16');
      expect(formatSuggestedDatePill('2026-10-04T12:00:00Z')).toBe('Suggested: Oct 4');
    });

    it('formats date range strings into suggested pill label', () => {
      expect(formatSuggestedDatePill(null, 'Sep 14 – Sep 20')).toBe('Suggested: Sep 14 – Sep 20');
    });

    it('returns null when no valid date or range is present', () => {
      expect(formatSuggestedDatePill(null)).toBeNull();
      expect(formatSuggestedDatePill(undefined)).toBeNull();
      expect(formatSuggestedDatePill('')).toBeNull();
    });
  });

  describe('formatWeekHeaderDate', () => {
    it('formats date using abbreviated weekday and month (e.g. "Tue, Sep 1")', () => {
      const d = new Date(2026, 8, 1); // Sep 1, 2026 is Tuesday
      expect(formatWeekHeaderDate(d)).toBe('Tue, Sep 1');

      const wed = new Date(2026, 8, 2); // Sep 2, 2026 is Wednesday
      expect(formatWeekHeaderDate(wed)).toBe('Wed, Sep 2');
    });
  });

  describe('formatSuggestedReadingCardText', () => {
    it('formats real single Date as "Suggested: Read by Mon Day" without weekday name', () => {
      const d = new Date(2026, 8, 5); // Sep 5, 2026
      expect(formatSuggestedReadingCardText(d)).toBe('Suggested: Read by Sep 5');
    });

    it('formats date range from document into "Suggested: Sep 1 – Sep 5"', () => {
      expect(formatSuggestedReadingCardText(null, 'Sep 1 – Sep 5')).toBe('Suggested: Sep 1 – Sep 5');
      expect(formatSuggestedReadingCardText(null, 'September 1 to September 5')).toBe('Suggested: Sep 1 – Sep 5');
      expect(formatSuggestedReadingCardText(null, 'Sep 14 – Sep 20')).toBe('Suggested: Sep 14 – Sep 20');
      expect(formatSuggestedReadingCardText(null, 'between September 1 to September 5')).toBe('Suggested: Sep 1 – Sep 5');
    });

    it('uses fallback week date range from document when direct date is missing', () => {
      expect(formatSuggestedReadingCardText(null, null, 'Sep 1 – Sep 5')).toBe('Suggested: Sep 1 – Sep 5');
    });

    it('strictly returns null when dateRangeStr is a generic placeholder like "Week 1" or "Module 2"', () => {
      expect(formatSuggestedReadingCardText(null, 'Week 1')).toBeNull();
      expect(formatSuggestedReadingCardText(null, 'Week 5')).toBeNull();
      expect(formatSuggestedReadingCardText(null, 'Module 3')).toBeNull();
      expect(formatSuggestedReadingCardText(null, 'unknown')).toBeNull();
      expect(formatSuggestedReadingCardText(null, 'tbd')).toBeNull();
      expect(formatSuggestedReadingCardText(null, '')).toBeNull();
      expect(formatSuggestedReadingCardText(null, null, null)).toBeNull();
    });

    it('never invents or makes up dates when no real document date exists', () => {
      expect(formatSuggestedReadingCardText(undefined, undefined, undefined)).toBeNull();
      expect(isRealDateOrRangeString('Week 1')).toBe(false);
      expect(isRealDateOrRangeString('Assigned Readings')).toBe(false);
      expect(isRealDateOrRangeString('Sep 1 – Sep 5')).toBe(true);
      expect(isRealDateOrRangeString('4/2/26')).toBe(true);
    });
  });

  describe('resolveReadingMediaType', () => {
    it('resolves explicit mediaType "article" or "paper"', () => {
      expect(resolveReadingMediaType({ mediaType: 'article' })).toBe('article');
      expect(resolveReadingMediaType({ mediaType: 'paper' })).toBe('article');
      expect(resolveReadingMediaType({ mediaType: 'Article / Paper' })).toBe('article');
    });

    it('resolves from mediaTypeRaw when mediaType is missing', () => {
      expect(resolveReadingMediaType({ mediaTypeRaw: 'journal article' })).toBe('article');
      expect(resolveReadingMediaType({ mediaTypeRaw: 'research paper' })).toBe('article');
      expect(resolveReadingMediaType({ mediaTypeRaw: 'youtube video' })).toBe('video');
      expect(resolveReadingMediaType({ mediaTypeRaw: 'podcast episode' })).toBe('podcast');
    });

    it('infers "article" from title or resource hints when non-textbook', () => {
      expect(resolveReadingMediaType({ title: 'Grief in Contemporary Society (Article)' })).toBe('article');
      expect(resolveReadingMediaType({ title: 'Corey Chapter 3', resourceTitle: 'Journal Article' })).toBe('article');
      expect(resolveReadingMediaType({ title: 'The Role of Attachment Theory (Article / Paper)' })).toBe('article');
      expect(resolveReadingMediaType({ title: 'White Paper on Cognitive Architectures' })).toBe('article');
      expect(resolveReadingMediaType({ title: 'TED Talk on Mindsets' })).toBe('video');
      expect(resolveReadingMediaType({ title: 'Podcast: The Daily' })).toBe('podcast');
    });

    it('defaults to textbook when no article/video/podcast markers exist', () => {
      expect(resolveReadingMediaType({ title: 'Chapter 4: Cognitive Behavioral Therapy' })).toBe('textbook');
      expect(resolveReadingMediaType(null)).toBe('textbook');
      expect(resolveReadingMediaType(undefined)).toBe('textbook');
    });
  });
});

