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
  resolveReadingMediaType,
  parseChapterNumbers,
  formatChapterList,
  splitInstructionsIntoParagraphs,
  cleanRubricCriterionName,
  deduplicateReadingTitle,
  isInvalidAssignmentTitle,
  isGenericPlaceholderTheme,
  cleanAcademicWeekTheme,
  isItemForCourse,
  matchCourseForItem,
  getAssignmentInstructionSummary
} from '../src/utils/readingDisplayHelper';
import { sanitizeAssignment, sanitizeReading } from '../src/context/CoursePalContext';
import { Reading, Course } from '../src/types/models';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

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

    it('formats PSYC 612 readings cleanly without repeating digits, et al., or punctuation artifacts', () => {
      const courseName = 'Advanced Cognitive Behavioural Interventions';

      // Beck (Ch. 7–9)
      const rBeck = {
        title: 'Beck (Ch. 7–9)',
        chapterText: 'Chapters 7–9',
        authorName: 'Beck'
      };
      const tBeck = formatDisplayTitleWithChapter(rBeck, rBeck.chapterText, undefined, courseName, rBeck.authorName);
      const sBeck = formatAuthorAndPagesSubtitle(rBeck.authorName, undefined, undefined, tBeck, courseName);
      expect(tBeck).toBe('Beck (Ch. 7–9)');
      expect(sBeck).toBe('');

      // Hayes et al. (Ch. 3–5)
      const rHayes = {
        title: 'Hayes et al. (Ch. 3–5)',
        chapterText: 'Chapters 3–5',
        authorName: 'Hayes et al.'
      };
      const tHayes = formatDisplayTitleWithChapter(rHayes, rHayes.chapterText, undefined, courseName, rHayes.authorName);
      const sHayes = formatAuthorAndPagesSubtitle(rHayes.authorName, undefined, undefined, tHayes, courseName);
      expect(tHayes).toBe('Hayes et al. (Ch. 3–5)');
      expect(sHayes).toBe('');

      // Linehan (Ch. 6–8)
      const rLinehan = {
        title: 'Linehan (Ch. 6–8)',
        chapterText: 'Chapters 6–8',
        authorName: 'Linehan'
      };
      const tLinehan = formatDisplayTitleWithChapter(rLinehan, rLinehan.chapterText, undefined, courseName, rLinehan.authorName);
      const sLinehan = formatAuthorAndPagesSubtitle(rLinehan.authorName, undefined, undefined, tLinehan, courseName);
      expect(tLinehan).toBe('Linehan (Ch. 6–8)');
      expect(sLinehan).toBe('');

      // Clark (Ch. 4)
      const rClark = {
        title: 'Clark (Ch. 4)',
        chapterText: 'Chapter 4',
        authorName: 'Clark'
      };
      const tClark = formatDisplayTitleWithChapter(rClark, rClark.chapterText, undefined, courseName, rClark.authorName);
      const sClark = formatAuthorAndPagesSubtitle(rClark.authorName, undefined, undefined, tClark, courseName);
      expect(tClark).toBe('Clark (Ch. 4)');
      expect(sClark).toBe('');

      // Craske & Barlow (Ch. 2 & 5)
      const rCraske = {
        title: 'Craske & Barlow (Ch. 2 & 5)',
        chapterText: 'Chapters 2 & 5',
        authorName: 'Craske & Barlow'
      };
      const tCraske = formatDisplayTitleWithChapter(rCraske, rCraske.chapterText, undefined, courseName, rCraske.authorName);
      const sCraske = formatAuthorAndPagesSubtitle(rCraske.authorName, undefined, undefined, tCraske, courseName);
      expect(tCraske).toBe('Craske & Barlow (Ch. 2 & 5)');
      expect(sCraske).toBe('');

      // Even if authorName is not explicitly passed, auto-detects from title
      const tBeckAuto = formatDisplayTitleWithChapter('Beck (Ch. 7–9)');
      expect(tBeckAuto).toBe('Beck (Ch. 7–9)');

      const tHayesAuto = formatDisplayTitleWithChapter('Hayes et al. (Ch. 3–5)');
      expect(tHayesAuto).toBe('Hayes et al. (Ch. 3–5)');
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
      expect(resolveReadingMediaType({ mediaType: 'paper' })).toBe('paper');
      expect(resolveReadingMediaType({ mediaType: 'Article / Paper' })).toBe('paper');
    });

    it('resolves from mediaTypeRaw when mediaType is missing', () => {
      expect(resolveReadingMediaType({ mediaTypeRaw: 'journal article' })).toBe('article');
      expect(resolveReadingMediaType({ mediaTypeRaw: 'research paper' })).toBe('paper');
      expect(resolveReadingMediaType({ mediaTypeRaw: 'youtube video' })).toBe('video');
      expect(resolveReadingMediaType({ mediaTypeRaw: 'podcast episode' })).toBe('podcast');
    });

    it('infers "article" and "paper" from title or resource hints when non-textbook', () => {
      expect(resolveReadingMediaType({ title: 'Grief in Contemporary Society (Article)' })).toBe('article');
      expect(resolveReadingMediaType({ title: 'Corey Chapter 3', resourceTitle: 'Journal Article' })).toBe('article');
      expect(resolveReadingMediaType({ title: 'The Role of Attachment Theory (Article / Paper)' })).toBe('paper');
      expect(resolveReadingMediaType({ title: 'White Paper on Cognitive Architectures' })).toBe('paper');
      expect(resolveReadingMediaType({ title: 'TED Talk on Mindsets' })).toBe('video');
      expect(resolveReadingMediaType({ title: 'Podcast: The Daily' })).toBe('podcast');
    });

    it('defaults to textbook when no article/video/podcast markers exist', () => {
      expect(resolveReadingMediaType({ title: 'Chapter 4: Cognitive Behavioral Therapy' })).toBe('textbook');
      expect(resolveReadingMediaType(null)).toBe('textbook');
      expect(resolveReadingMediaType(undefined)).toBe('textbook');
    });
  });

  describe('User Request: Repeated Chapter Elimination & Colon/Dash Cleansing', () => {
    it('normalizes colon ranges like 1: 3 and 4: 10 to canonical Chapters 1–3 and Chapters 4–10', () => {
      expect(cleanChapterFromRaw('1: 3')).toBe('Chapters 1–3');
      expect(cleanChapterFromRaw('4: 10')).toBe('Chapters 4–10');
      expect(cleanChapterFromRaw('1:3')).toBe('Chapters 1–3');
      expect(cleanChapterFromRaw('1: 3 · Chapters 1-3')).toBe('Chapters 1–3');
    });

    it('eradicates "1: 3 · Chapters 1–3" and "4: 10 · Chapters 4–10" artifacts from formatDisplayTitleWithChapter', () => {
      const title1 = formatDisplayTitleWithChapter({
        title: '1: 3 · Chapters 1–3',
        chapterText: '1: 3',
        resourceTitle: '1: 3',
        authorName: 'Gehart'
      });
      expect(title1).toBe('Chapters 1–3');

      const title2 = formatDisplayTitleWithChapter({
        title: '4: 10 · Chapters 4–10',
        chapterText: '4: 10',
        resourceTitle: '4: 10',
        authorName: 'Gehart'
      });
      expect(title2).toBe('Chapters 4–10');

      const title3 = formatDisplayTitleWithChapter({
        title: 'Chapters 1–3',
        chapterText: 'Chapters 1-3',
        resourceTitle: '1: 3',
        authorName: 'Gehart'
      });
      expect(title3).toBe('Chapters 1–3');
    });

    it('parses chapter numbers and formats canonical chapter lists accurately', () => {
      expect(parseChapterNumbers('Chapter 1')).toEqual([1]);
      expect(parseChapterNumbers('Chapters 1–3')).toEqual([1, 2, 3]);
      expect(parseChapterNumbers('1: 3')).toEqual([1, 2, 3]);
      expect(parseChapterNumbers('4: 10')).toEqual([4, 5, 6, 7, 8, 9, 10]);
      expect(parseChapterNumbers('Chapters 5 & 7')).toEqual([5, 7]);
      expect(parseChapterNumbers('Chapters 1 and 7')).toEqual([1, 7]);
      expect(parseChapterNumbers('Reading')).toEqual([]);

      expect(formatChapterList([1])).toBe('Chapter 1');
      expect(formatChapterList([7])).toBe('Chapter 7');
      expect(formatChapterList([5, 7])).toBe('Chapters 5 & 7');
      expect(formatChapterList([1, 2, 3])).toBe('Chapters 1–3');
      expect(formatChapterList([4, 5, 6, 7, 8, 9, 10])).toBe('Chapters 4–10');
    });

    it('implements user requirement: "if it says one, you don\'t need to say in the next one chapter one and seven"', () => {
      const readings = [
        {
          id: 'r1',
          title: 'Chapter 1',
          chapterText: 'Chapter 1',
          authorName: 'Corey',
          weekNumber: 1,
          courseCode: 'CPC 512'
        },
        {
          id: 'r2',
          title: 'Chapters 1 & 7',
          chapterText: 'Chapters 1 & 7',
          authorName: 'Corey',
          weekNumber: 1,
          courseCode: 'CPC 512'
        }
      ];

      const deduplicated = deduplicateReadingsList(readings);
      expect(deduplicated).toHaveLength(2);
      expect(deduplicated[0].title).toBe('Chapter 1');
      // In the second item, Chapter 1 was already stated, so it does NOT say "Chapters 1 & 7", it says "Chapter 7"!
      expect(deduplicated[1].title).toBe('Chapter 7');
      expect(deduplicated[1].chapterText).toBe('Chapter 7');
    });

    it('resolves the exact user screenshot (CPC 512 Week 2): removes 1: 3 colon artifact and deduplicates 5 & 7 redundancy', () => {
      const readings = [
        {
          id: 'r1',
          title: '1: 3 · Chapters 1–3',
          chapterText: '1: 3',
          resourceTitle: '1: 3',
          authorName: 'Gehart',
          weekNumber: 2,
          courseCode: 'CPC 512',
          dueDate: new Date(2026, 7, 6)
        },
        {
          id: 'r2',
          title: 'Chapter 5',
          chapterText: 'Chapter 5',
          authorName: 'Gehart',
          weekNumber: 2,
          courseCode: 'CPC 512',
          dueDate: new Date(2026, 7, 6)
        },
        {
          id: 'r3',
          title: 'Chapters 5 & 7',
          chapterText: 'Chapters 5 & 7',
          authorName: 'Gehart',
          weekNumber: 2,
          courseCode: 'CPC 512',
          dueDate: new Date(2026, 7, 6)
        },
        {
          id: 'r4',
          title: 'Chapter 7',
          chapterText: 'Chapter 7',
          authorName: 'Gehart',
          weekNumber: 2,
          courseCode: 'CPC 512',
          dueDate: new Date(2026, 7, 6)
        },
        // Week 3
        {
          id: 'r5',
          title: '4: 10 · Chapters 4–10',
          chapterText: '4: 10',
          resourceTitle: '4: 10',
          authorName: 'Gehart',
          weekNumber: 3,
          courseCode: 'CPC 512'
        },
        {
          id: 'r6',
          title: 'Chapter 11',
          chapterText: 'Chapter 11',
          authorName: 'Gehart',
          weekNumber: 3,
          courseCode: 'CPC 512'
        }
      ];

      const deduplicated = deduplicateReadingsList(readings);

      // Week 2 readings:
      const week2 = deduplicated.filter(r => r.weekNumber === 2);
      expect(week2).toHaveLength(3);
      expect(week2[0].title).toBe('Chapters 1–3');
      expect(week2[1].title).toBe('Chapter 5');
      expect(week2[2].title).toBe('Chapter 7');

      // Week 3 readings:
      const week3 = deduplicated.filter(r => r.weekNumber === 3);
      expect(week3).toHaveLength(2);
      expect(week3[0].title).toBe('Chapters 4–10');
      expect(week3[1].title).toBe('Chapter 11');
    });

    it('deduplicates when combined reading is listed first (Chapters 5 & 7 followed by Chapter 5 and Chapter 7)', () => {
      const readings = [
        {
          id: 'r1',
          title: 'Chapters 5 & 7',
          chapterText: 'Chapters 5 & 7',
          authorName: 'Gehart',
          weekNumber: 2,
          courseCode: 'CPC 512'
        },
        {
          id: 'r2',
          title: 'Chapter 5',
          chapterText: 'Chapter 5',
          authorName: 'Gehart',
          weekNumber: 2,
          courseCode: 'CPC 512'
        },
        {
          id: 'r3',
          title: 'Chapter 7',
          chapterText: 'Chapter 7',
          authorName: 'Gehart',
          weekNumber: 2,
          courseCode: 'CPC 512'
        }
      ];

      const deduplicated = deduplicateReadingsList(readings);
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].title).toBe('Chapters 5 & 7');
    });
  });

  describe('splitInstructionsIntoParagraphs', () => {
    it('returns empty array for empty or whitespace-only inputs', () => {
      expect(splitInstructionsIntoParagraphs('')).toEqual([]);
      expect(splitInstructionsIntoParagraphs('   ')).toEqual([]);
      expect(splitInstructionsIntoParagraphs(null)).toEqual([]);
      expect(splitInstructionsIntoParagraphs(undefined)).toEqual([]);
    });

    it('splits double-newline separated paragraphs', () => {
      const text = 'Paragraph 1 instructions.\n\nParagraph 2 requirements.\n\nParagraph 3 submission guidelines.';
      const result = splitInstructionsIntoParagraphs(text);
      expect(result).toEqual([
        'Paragraph 1 instructions.',
        'Paragraph 2 requirements.',
        'Paragraph 3 submission guidelines.'
      ]);
    });

    it('splits long walls of text into readable chunks', () => {
      const wall = 'This is the first sentence of the assignment. Here is a second sentence describing what students should analyze. Then students must provide a critique based on peer-reviewed literature. Finally, write a conclusion summarizing the key themes and personal reflections on clinical practice.';
      const result = splitInstructionsIntoParagraphs(wall);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every(p => p.length > 0)).toBe(true);
    });

    it('separates explicit assignment sections into distinct paragraphs', () => {
      const sectionText = 'Understanding family systems is key. For the first part, students create a genogram. Requirements: Must have 3-4 generations. Part 2: Write a reflection paper. Format: APA 7th edition with 5 scholarly sources.';
      const result = splitInstructionsIntoParagraphs(sectionText);
      expect(result.length).toBeGreaterThanOrEqual(4);
      expect(result.some(p => p.startsWith('Requirements:'))).toBe(true);
      expect(result.some(p => p.startsWith('Part 2:'))).toBe(true);
      expect(result.some(p => p.startsWith('Format:'))).toBe(true);
    });
  });

  describe('cleanRubricCriterionName Capitalization (Downstairs Points Breakdown)', () => {
    it('always capitalizes the first letter of rubric criterion names', () => {
      expect(cleanRubricCriterionName('evidence and support (Scholarly Sources)')).toBe('Evidence and support (Scholarly Sources)');
      expect(cleanRubricCriterionName('analysis and use of course concepts')).toBe('Analysis and use of Course Concepts');
      expect(cleanRubricCriterionName('self-awareness & reflection')).toBe('Self-awareness & reflection');
      expect(cleanRubricCriterionName('cultural competence')).toBe('Cultural Competence');
      expect(cleanRubricCriterionName('oral presentation')).toBe('Oral presentation');
    });
  });

  describe('deduplicateReadingTitle & strict non-repetition', () => {
    it('deduplicates identical phrases joined by dashes or colons', () => {
      expect(
        deduplicateReadingTitle('Sexual and Gender Minority Youth in Canada – Sexual and Gender Minority Youth in Canada')
      ).toBe('Sexual and Gender Minority Youth in Canada');

      expect(
        deduplicateReadingTitle('Chapter 1 · Sexual and Gender Minority Youth in Canada – Sexual and Gender Minority Youth in Canada')
      ).toBe('Chapter 1 · Sexual and Gender Minority Youth in Canada');

      expect(
        deduplicateReadingTitle('Chapter 4 · Chapter 4')
      ).toBe('Chapter 4');

      expect(
        deduplicateReadingTitle('Chapter 4 · Chapter 4: Gender Identity')
      ).toBe('Chapter 4 · Gender Identity');
    });

    it('formats display titles without repeating book subtitle matching chapter title', () => {
      const reading = {
        title: 'Growing into Resilience: Sexual and Gender Minority Youth in Canada: Chapter 1 — Sexual and Gender Minority Youth in Canada',
        chapterText: 'Chapter 1',
        resourceTitle: 'Growing into Resilience: Sexual and Gender Minority Youth in Canada'
      };
      const displayTitle = formatDisplayTitleWithChapter(reading);
      expect(displayTitle).toBe('Chapter 1 · Sexual and Gender Minority Youth in Canada');
    });

    it('formats subsequent chapters cleanly without book subtitle stutter', () => {
      const reading = {
        title: 'Growing into Resilience: Sexual and Gender Minority Youth in Canada: Chapter 2 — Resilience and Identity',
        chapterText: 'Chapter 2',
        resourceTitle: 'Growing into Resilience: Sexual and Gender Minority Youth in Canada'
      };
      const displayTitle = formatDisplayTitleWithChapter(reading);
      expect(displayTitle).toBe('Chapter 2 · Resilience and Identity');
    });
  });

  describe('isInvalidAssignmentTitle & table header rejection', () => {
    it('rejects description weight and table header artifacts', () => {
      expect(isInvalidAssignmentTitle('Description Weight')).toBe(true);
      expect(isInvalidAssignmentTitle('description / weight')).toBe(true);
      expect(isInvalidAssignmentTitle('Description & Weight')).toBe(true);
      expect(isInvalidAssignmentTitle('Description')).toBe(true);
      expect(isInvalidAssignmentTitle('Weight')).toBe(true);
      expect(isInvalidAssignmentTitle('Assessment Item')).toBe(true);
      expect(isInvalidAssignmentTitle('Assessment Title')).toBe(true);
      expect(isInvalidAssignmentTitle('Assessment Structure & Grade Breakdown')).toBe(true);
      expect(isInvalidAssignmentTitle('Target Format')).toBe(true);
      expect(isInvalidAssignmentTitle('Due Module')).toBe(true);
      expect(isInvalidAssignmentTitle('Module 5')).toBe(true);
      expect(isInvalidAssignmentTitle('Week 2')).toBe(true);
    });

    it('accepts genuine assignment titles', () => {
      expect(isInvalidAssignmentTitle('Comprehensive Clinical Case Formulation')).toBe(false);
      expect(isInvalidAssignmentTitle('Group Therapy Reflection Paper')).toBe(false);
      expect(isInvalidAssignmentTitle('Midterm Examination')).toBe(false);
      expect(isInvalidAssignmentTitle('Peer Review Assignment')).toBe(false);
    });
  });

  describe('NEUR 740 Author Citation Formatting & Groth-Marnat Healing', () => {
    it('formats author citation titles consistently as Author (Ch. X) or Author (Ch. X & Y)', () => {
      expect(formatDisplayTitleWithChapter('Lezak et al. (Ch. 1–3)')).toBe('Lezak et al. (Ch. 1–3)');
      expect(formatDisplayTitleWithChapter('Luria (Ch. 2)')).toBe('Luria (Ch. 2)');
      expect(formatDisplayTitleWithChapter('Lichtenberger (Ch. 2)')).toBe('Lichtenberger (Ch. 2)');
      expect(formatDisplayTitleWithChapter('Squire (Ch. 3)')).toBe('Squire (Ch. 3)');
      expect(formatDisplayTitleWithChapter('Lezak et al. (Ch. 11 & 12)')).toBe('Lezak et al. (Ch. 11 & 12)');
      expect(formatDisplayTitleWithChapter('Delis et al. (Ch. 1–4)')).toBe('Delis et al. (Ch. 1–4)');
    });

    it('heals and formats Groth-Marnat from raw Groth-Marnat (Chapters 4 & 5)', () => {
      const res = formatDisplayTitleWithChapter({
        title: 'Groth-Marnat (Chapters 4 & 5)',
        chapterText: 'Chapters 4 & 5',
        authorName: 'Groth-Marnat',
        resourceTitle: 'Groth-Marnat'
      });
      expect(res).toBe('Groth-Marnat (Ch. 4 & 5)');
    });

    it('heals corrupted artifact "Chapters 4 & 5 · Marnat ( )" and "Groth: Marnat ( ) · Groth-Marnat"', () => {
      const res = formatDisplayTitleWithChapter({
        title: 'Chapters 4 & 5 · Marnat ( )',
        chapterText: 'Chapters 4 & 5',
        resourceTitle: 'Groth: Marnat ( ) · Groth-Marnat'
      });
      expect(res).toBe('Groth-Marnat (Ch. 4 & 5)');
    });

    it('produces empty subtitle for author-chapter card matching other NEUR 740 cards', () => {
      const sub1 = formatAuthorAndPagesSubtitle(
        'Groth-Marnat',
        '',
        'Groth-Marnat',
        'Groth-Marnat (Ch. 4 & 5)',
        'NEUR 740'
      );
      expect(sub1).toBe('');

      const sub2 = formatAuthorAndPagesSubtitle(
        'Groth: Marnat',
        '',
        'Groth: Marnat ( ) · Groth-Marnat',
        'Groth-Marnat (Ch. 4 & 5)',
        'NEUR 740'
      );
      expect(sub2).toBe('');

      const sub3 = formatAuthorAndPagesSubtitle(
        'Lezak et al.',
        '',
        '',
        'Lezak et al. (Ch. 1–3)',
        'NEUR 740'
      );
      expect(sub3).toBe('');
    });

    it('heals reading end-to-end via sanitizeReading', () => {
      const corrupted = {
        id: 'read-neur-2',
        title: 'Chapters 4 & 5 · Marnat ( )',
        chapterText: 'Chapters 4 & 5',
        resourceTitle: 'Groth: Marnat ( ) · Groth-Marnat',
        isCompleted: false
      } as Reading;
      const sanitized = sanitizeReading(corrupted);
      expect(sanitized.title).toBe('Groth-Marnat (Ch. 4 & 5)');
      expect(sanitized.authorName).toBe('Groth-Marnat');
      expect(sanitized.chapterText).toBe('Chapters 4 & 5');

      const sub = formatAuthorAndPagesSubtitle(
        sanitized.authorName,
        sanitized.pagesText,
        sanitized.resourceTitle,
        sanitized.title,
        'NEUR 740'
      );
      expect(sub).toBe('');
    });

    it('verifies NEUR 740 assignments contain deliverable formats and no fabricated points', () => {
      const { LocalSyllabusParser } = require('../src/services/LocalSyllabusParser');
      const { execSync } = require('child_process');
      const fs = require('fs');
      const pdfPath = '/Users/slava/Downloads/NEUR_740_Neuropsych_Assessment_Syllabus.pdf';
      if (fs.existsSync(pdfPath)) {
        const swiftCmd = `swift -e '
import PDFKit
import Foundation
let url = URL(fileURLWithPath: "${pdfPath}")
if let doc = PDFDocument(url: url), let str = doc.string {
    print(str)
}
'`;
        const text = execSync(swiftCmd).toString();
        const parsed = LocalSyllabusParser.shared.parseText(text);

        const caseConference = parsed.assignments?.find((a: any) => /case conference/i.test(a.title));
        expect(caseConference).toBeDefined();
        expect(caseConference?.noteText).toContain('Weekly Case Contributions & Diagnostic Briefs');
        expect(caseConference?.weightPercentage).toBe('20%');
        expect((caseConference as any)?.pointsPossible).toBeUndefined();

        // Verify all 4 assignments have NO fabricated points
        for (const a of parsed.assignments || []) {
          expect((a as any).pointsPossible).toBeUndefined();
        }
      }
    });
  });

  describe('Academic Citation Title Formatting & Publication Year Preservation', () => {
    it('preserves publication years and topics in academic paper citations', () => {
      const r1 = { title: 'Li et al. (2020)', authorName: 'Li et al.' };
      expect(formatDisplayTitleWithChapter(r1, null, null, 'DATA 630', 'Li et al.')).toBe('Li et al. (2020)');

      const r2 = { title: 'Rajbhandari et al. (2020)', authorName: 'Rajbhandari et al.' };
      expect(formatDisplayTitleWithChapter(r2, null, null, 'DATA 630', 'Rajbhandari et al.')).toBe('Rajbhandari et al. (2020)');

      const r3 = { title: 'Shoeybi et al. (Megatron)', authorName: 'Shoeybi et al.' };
      expect(formatDisplayTitleWithChapter(r3, null, null, 'DATA 630', 'Shoeybi et al.')).toBe('Shoeybi et al. (Megatron)');

      const r4 = { title: 'Dettmers et al. (QLoRA)', authorName: 'Dettmers et al.' };
      expect(formatDisplayTitleWithChapter(r4, null, null, 'DATA 630', 'Dettmers et al.')).toBe('Dettmers et al. (QLoRA)');

      const r5 = { title: 'Burns et al. (Ch. 4–6)', authorName: 'Burns et al.' };
      expect(formatDisplayTitleWithChapter(r5, 'Chapters 4–6', null, 'DATA 630', 'Burns et al.')).toBe('Burns et al. (Ch. 4–6)');
    });
  });

  describe('Textbook Subtitle Non-Repetition & Canonical Module Topics (CPC 512 Fix)', () => {
    it('eradicates textbook publisher subtitle repetition from card title and subtitle', () => {
      const readingWithTopic = {
        title: 'Mastering Competency in Family Therapy: A Practical Approach to Theory and Clinical Case Documentation',
        chapterText: 'Chapters 1-3',
        resourceTitle: 'Mastering Competency in Family Therapy: A Practical Approach to Theory and Clinical Case Documentation',
        authorName: 'Diane R. Gehart',
        relevantTopics: 'Systems Theory and the History of Family Therapy'
      };

      const title = formatDisplayTitleWithChapter(
        readingWithTopic,
        readingWithTopic.chapterText,
        readingWithTopic.resourceTitle,
        'Family Systems Approaches to Counselling',
        readingWithTopic.authorName
      );
      const subtitle = formatAuthorAndPagesSubtitle(
        readingWithTopic.authorName,
        null,
        readingWithTopic.resourceTitle,
        title,
        'Family Systems Approaches to Counselling'
      );

      // Must NOT repeat "A Practical Approach to Theory and Clinical Case Documentation"
      expect(title).not.toContain('A Practical Approach to Theory and Clinical Case Documentation');
      expect(subtitle).not.toContain('A Practical Approach to Theory and Clinical Case Documentation');

      expect(title).toBe('Chapters 1–3 · Systems Theory and the History of Family Therapy');
      expect(subtitle).toBe('Mastering Competency in Family Therapy · Diane R. Gehart');
    });

    it('formats clean author and chapter when no specific subtopic is provided without repeating book subtitle or textbook title', () => {
      const readingWithoutTopic = {
        title: 'Mastering Competency in Family Therapy: A Practical Approach to Theory and Clinical Case Documentation',
        chapterText: 'Chapter 2',
        resourceTitle: 'Mastering Competency in Family Therapy: A Practical Approach to Theory and Clinical Case Documentation',
        authorName: 'Diane R. Gehart'
      };

      const title = formatDisplayTitleWithChapter(
        readingWithoutTopic,
        readingWithoutTopic.chapterText,
        readingWithoutTopic.resourceTitle,
        'Family Systems Approaches to Counselling',
        readingWithoutTopic.authorName
      );
      const subtitle = formatAuthorAndPagesSubtitle(
        readingWithoutTopic.authorName,
        null,
        readingWithoutTopic.resourceTitle,
        title,
        'Family Systems Approaches to Counselling'
      );

      expect(title).toBe('Mastering Competency in Family Therapy · Chapter 2');
      expect(subtitle).toBe('Diane R. Gehart');
    });

    it('verifies all 10 canonical modules for CPC 512 display without repeated chapters or textbook subtitle stutter', () => {
      const modules = [
        { modNum: 1, weekNum: 1, chapter: 'Chapters 1–3', theme: 'Systems Theory and the History of Family Therapy' },
        { modNum: 2, weekNum: 2, chapter: 'Chapter 2', theme: 'Family of Origin/ Genograms' },
        { modNum: 3, weekNum: 3, chapter: 'Chapters 11–15', theme: 'Diverse Populations and Family Therapy Case Conceptualization and Application' },
        { modNum: 4, weekNum: 4, chapter: 'Chapter 7', theme: 'Bowen Family Systems' },
        { modNum: 5, weekNum: 5, chapter: 'Chapter 5', theme: 'Structural Family Therapy' },
        { modNum: 6, weekNum: 7, chapter: 'Chapter 4', theme: 'Strategic Family Therapy' },
        { modNum: 7, weekNum: 8, chapter: 'Chapter 6', theme: 'Experiential Family Therapy' },
        { modNum: 8, weekNum: 9, chapter: 'Chapter 7', theme: 'Psychoanalytic Family Therapy' },
        { modNum: 9, weekNum: 10, chapter: 'Chapter 8', theme: 'Cognitive Behavioural Family Therapy' },
        { modNum: 10, weekNum: 11, chapter: 'Chapter 10', theme: 'Social Constructionist Family Therapy' }
      ];

      for (const m of modules) {
        const item = {
          title: m.chapter,
          chapterText: m.chapter,
          resourceTitle: 'Mastering Competency in Family Therapy: A Practical Approach to Theory and Clinical Case Documentation',
          authorName: 'Diane R. Gehart',
          relevantTopics: m.theme
        };
        const title = formatDisplayTitleWithChapter(
          item,
          item.chapterText,
          item.resourceTitle,
          'Family Systems Approaches to Counselling',
          item.authorName
        );
        const subtitle = formatAuthorAndPagesSubtitle(
          item.authorName,
          null,
          item.resourceTitle,
          title,
          'Family Systems Approaches to Counselling'
        );

        expect(title).not.toContain('A Practical Approach to Theory and Clinical Case Documentation');
        expect(subtitle).not.toContain('A Practical Approach to Theory and Clinical Case Documentation');
        expect(title).toContain(m.theme);
        expect(subtitle).toBe('Mastering Competency in Family Therapy · Diane R. Gehart');
      }
    });

    it('verifies CPC 512 canonical modules with null resourceTitle display clean author and full chapter topic', () => {
      const modules = [
        { modNum: 1, weekNum: 1, chapter: 'Chapters 1–3', theme: 'Systems Theory and the History of Family Therapy' },
        { modNum: 2, weekNum: 2, chapter: 'Chapter 2', theme: 'Family of Origin/ Genograms' },
        { modNum: 3, weekNum: 3, chapter: 'Chapters 11–15', theme: 'Diverse Populations and Family Therapy Case Conceptualization and Application' },
        { modNum: 4, weekNum: 4, chapter: 'Chapter 7', theme: 'Bowen Family Systems' },
        { modNum: 5, weekNum: 5, chapter: 'Chapter 5', theme: 'Structural Family Therapy' },
        { modNum: 6, weekNum: 7, chapter: 'Chapter 4', theme: 'Strategic Family Therapy' },
        { modNum: 7, weekNum: 8, chapter: 'Chapter 6', theme: 'Experiential Family Therapy' },
        { modNum: 8, weekNum: 9, chapter: 'Chapter 7', theme: 'Psychoanalytic Family Therapy' },
        { modNum: 9, weekNum: 10, chapter: 'Chapter 8', theme: 'Cognitive Behavioural Family Therapy' },
        { modNum: 10, weekNum: 11, chapter: 'Chapter 10', theme: 'Social Constructionist Family Therapy' }
      ];

      for (const m of modules) {
        const item = {
          title: `${m.chapter} · ${m.theme}`,
          chapterText: m.chapter,
          resourceTitle: null,
          authorName: 'Diane R. Gehart',
          relevantTopics: m.theme
        };
        const title = formatDisplayTitleWithChapter(
          item,
          item.chapterText,
          null,
          'Family Systems Approaches to Counselling',
          item.authorName
        );
        const subtitle = formatAuthorAndPagesSubtitle(
          item.authorName,
          null,
          null,
          title,
          'Family Systems Approaches to Counselling'
        );

        expect(title).toBe(`${m.chapter} · ${m.theme}`);
        expect(subtitle).toBe('Diane R. Gehart');
        expect(title).not.toContain('Mastering Competency');
        expect(subtitle).not.toContain('Mastering Competency');
      }
    });
  });

  describe('Multi-Citation Splitting & Bare Chapter Display Healing', () => {
    it('splits semicolon-separated reading citations into distinct candidates', () => {
      const candidate1 = {
        title: 'Lezak et al. (Ch. 1–3); Luria (Ch. 2)',
        weekNumber: 1
      };
      const split1 = SyllabusImportManager.splitMultiCitationCandidate(candidate1);
      expect(split1).toHaveLength(2);
      expect(split1[0].title).toBe('Lezak et al. (Ch. 1–3)');
      expect(split1[0].authorName).toBe('Lezak et al.');
      expect(split1[0].chapterText).toBe('Chapters 1–3');
      expect(split1[1].title).toBe('Luria (Ch. 2)');
      expect(split1[1].authorName).toBe('Luria');
      expect(split1[1].chapterText).toBe('Chapter 2');

      const candidate2 = {
        title: 'Groth-Marnat (Ch. 4 & 5); Lichtenberger (Ch. 2)',
        weekNumber: 2
      };
      const split2 = SyllabusImportManager.splitMultiCitationCandidate(candidate2);
      expect(split2).toHaveLength(2);
      expect(split2[0].title).toBe('Groth-Marnat (Ch. 4 & 5)');
      expect(split2[0].authorName).toBe('Groth-Marnat');
      expect(split2[0].chapterText).toBe('Chapters 4 & 5');
      expect(split2[1].title).toBe('Lichtenberger (Ch. 2)');
      expect(split2[1].authorName).toBe('Lichtenberger');
      expect(split2[1].chapterText).toBe('Chapter 2');
    });

    it('formats author citation titles cleanly into Author (Ch. X)', () => {
      const item = {
        title: 'Lezak et al. (Ch. 1–3)',
        authorName: 'Lezak et al.',
        chapterText: 'Chapters 1–3'
      };
      const title = formatDisplayTitleWithChapter(item, item.chapterText, null, 'NEUR 740', item.authorName);
      expect(title).toBe('Lezak et al. (Ch. 1–3)');
    });

    it('cleans Groth-Marnat (Ch. 4 & 5) without stutter suffix like "· Marnat"', () => {
      const item = {
        title: 'Groth-Marnat (Ch. 4 & 5)',
        authorName: 'Groth-Marnat',
        chapterText: 'Chapters 4 & 5'
      };
      const title = formatDisplayTitleWithChapter(item, item.chapterText, null, 'NEUR 740', item.authorName);
      expect(title).toBe('Groth-Marnat (Ch. 4 & 5)');
      expect(title).not.toContain('· Marnat');
    });

    it('cleans multi-author with semicolon and eliminates author echo stutter', () => {
      const item = {
        title: 'Groth-Marnat; Lichtenberger (Ch. 4 & 5)',
        authorName: 'Groth-Marnat; Lichtenberger',
        chapterText: 'Chapters 4 & 5'
      };
      const title = formatDisplayTitleWithChapter(item, item.chapterText, null, 'NEUR 740', item.authorName);
      expect(title).toBe('Groth-Marnat, Lichtenberger (Ch. 4 & 5)');
      expect(title).not.toContain('· Marnat');

      const subtitle = formatAuthorAndPagesSubtitle(item.authorName, null, null, title, 'NEUR 740');
      expect(subtitle).not.toContain(';');
    });

    it('cleans semicolons in author subtitles (e.g. Lezak et al.; Luria -> Lezak et al., Luria)', () => {
      const sub1 = formatAuthorAndPagesSubtitle('Lezak et al.; Luria', null, null, 'Chapters 1–3', 'NEUR 740');
      expect(sub1).toBe('Lezak et al., Luria');

      const sub2 = formatAuthorAndPagesSubtitle('Lezak et al.; Squire', null, null, 'Chapters 11 & 12', 'NEUR 740');
      expect(sub2).toBe('Lezak et al., Squire');
    });

    it('deduplicates reading title when later segment is substring of earlier segment', () => {
      const result = deduplicateReadingTitle('Groth-Marnat, Lichtenberger (Ch. 4 & 5) · Marnat');
      expect(result).toBe('Groth-Marnat, Lichtenberger (Ch. 4 & 5)');
    });
  });

  describe('Semicolon Citation Splitting & Required vs Optional Readings', () => {
    it('correctly splits 4 readings with Required and Optional sections and semicolon boundaries', () => {
      const inputStr = 'Required: Wada & Fellner, 2025; Maddux & Winstead, (2019): Ch 1&2, 4-6; DSM 5-TR: Section 1, Section 3 - Culture and Psychiatric Diagnosis pg. 859. Optional: World Health Organization (2010) ICD. http://www.who.int/classifications/icd/en.';

      const candidates = SyllabusImportManager.splitMultiCitationCandidate({
        title: inputStr,
        weekNumber: 1
      });

      expect(candidates).toHaveLength(4);

      // Reading 1: Wada & Fellner
      expect(candidates[0].isRequired).toBe(true);
      expect(candidates[0].requirementType).toBe('required');
      expect(candidates[0].authorName).toBe('Wada & Fellner');
      expect(candidates[0].title).toContain('Wada & Fellner');
      expect(candidates[0].title).not.toMatch(/^required:/i);

      // Reading 2: Maddux & Winstead
      expect(candidates[1].isRequired).toBe(true);
      expect(candidates[1].requirementType).toBe('required');
      expect(candidates[1].authorName).toBe('Maddux & Winstead');
      expect(candidates[1].chapterText).toBeDefined();

      // Reading 3: DSM 5-TR
      expect(candidates[2].isRequired).toBe(true);
      expect(candidates[2].requirementType).toBe('required');
      expect(candidates[2].authorName).toBe('DSM 5-TR');
      expect(candidates[2].pagesText).toContain('859');

      // Reading 4: World Health Organization
      expect(candidates[3].isRequired).toBe(false);
      expect(candidates[3].requirementType).toBe('optional');
      expect(candidates[3].authorName).toBe('World Health Organization');
      expect(candidates[3].videoUrl).toBe('http://www.who.int/classifications/icd/en');
      expect(candidates[3].title).not.toContain('http');
      expect(candidates[3].title).not.toMatch(/^optional:/i);
    });

    it('deduplicateReadings preserves isRequired and requirementType', () => {
      const readings = SyllabusImportManager.shared.deduplicateReadings([
        {
          title: 'Wada & Fellner, 2025',
          authorName: 'Wada & Fellner',
          isRequired: true,
          requirementType: 'required',
          weekNumber: 1
        },
        {
          title: 'World Health Organization (2010) ICD',
          authorName: 'World Health Organization',
          isRequired: false,
          requirementType: 'optional',
          weekNumber: 1
        }
      ]);

      expect(readings).toHaveLength(2);
      expect(readings[0].isRequired).toBe(true);
      expect(readings[0].requirementType).toBe('required');
      expect(readings[1].isRequired).toBe(false);
      expect(readings[1].requirementType).toBe('optional');
    });

    it('sanitizeReading cleans and normalizes isRequired and requirementType', () => {
      const cleanReq = sanitizeReading({
        id: 'r-1',
        title: 'Required: Wada & Fellner, 2025',
        mediaTypeRaw: 'textbook',
        mediaType: 'textbook',
        isCompleted: false,
        isDeleted: false,
        summaryText: '',
        keyTakeawaysText: '',
        estimatedTimeText: '',
        isFavorite: false,
        isRequired: true,
        requirementType: 'required'
      });

      expect(cleanReq.isRequired).toBe(true);
      expect(cleanReq.requirementType).toBe('required');
      expect(cleanReq.title).not.toMatch(/^required:/i);

      const cleanOpt = sanitizeReading({
        id: 'r-2',
        title: 'Optional: WHO ICD',
        mediaTypeRaw: 'article',
        mediaType: 'article',
        isCompleted: false,
        isDeleted: false,
        summaryText: '',
        keyTakeawaysText: '',
        estimatedTimeText: '',
        isFavorite: false,
        isRequired: false,
        requirementType: 'optional'
      });

      expect(cleanOpt.isRequired).toBe(false);
      expect(cleanOpt.requirementType).toBe('optional');
      expect(cleanOpt.title).not.toMatch(/^optional:/i);
    });
  });

  describe('isGenericPlaceholderTheme & Schedule Pill Suppression', () => {
    it('accurately identifies generic schedule and syllabus column headers', () => {
      expect(isGenericPlaceholderTheme('Schedule')).toBe(true);
      expect(isGenericPlaceholderTheme('schedule')).toBe(true);
      expect(isGenericPlaceholderTheme('Weekly Schedule')).toBe(true);
      expect(isGenericPlaceholderTheme('Week 1 Schedule')).toBe(true);
      expect(isGenericPlaceholderTheme('Week 2 Schedule')).toBe(true);
      expect(isGenericPlaceholderTheme('Wk 3: Schedule')).toBe(true);
      expect(isGenericPlaceholderTheme('Course Schedule')).toBe(true);
      expect(isGenericPlaceholderTheme('Tentative Schedule')).toBe(true);
      expect(isGenericPlaceholderTheme('Readings')).toBe(true);
      expect(isGenericPlaceholderTheme('Course Readings')).toBe(true);
      expect(isGenericPlaceholderTheme('Topics')).toBe(true);
      expect(isGenericPlaceholderTheme('Overview')).toBe(true);
      expect(isGenericPlaceholderTheme('Week 1')).toBe(true);
      expect(isGenericPlaceholderTheme('Required')).toBe(true);
      expect(isGenericPlaceholderTheme('Optional')).toBe(true);
      expect(isGenericPlaceholderTheme(null)).toBe(true);
      expect(isGenericPlaceholderTheme(undefined)).toBe(true);
      expect(isGenericPlaceholderTheme('')).toBe(true);
    });

    it('preserves genuine academic and subject matter themes', () => {
      expect(isGenericPlaceholderTheme('Creating a caring community, Introduction to Family Systems, Course overview')).toBe(false);
      expect(isGenericPlaceholderTheme('Bowen Family Systems')).toBe(false);
      expect(isGenericPlaceholderTheme('Introduction to Systems Thinking')).toBe(false);
      expect(isGenericPlaceholderTheme('Structural Family Systems')).toBe(false);
      expect(isGenericPlaceholderTheme('Cognitive Behavioural Family Therapy')).toBe(false);
    });

    it('does not append generic "Schedule" as substantive topic to reading title', () => {
      const display = formatDisplayTitleWithChapter(
        {
          title: 'Wada & Fellner, 2025',
          relevantTopics: 'Schedule'
        } as any,
        null,
        null,
        'CPC 524'
      );
      expect(display).not.toContain('Schedule');
    });

    it('sanitizes generic placeholder themes from reading relevantTopics', () => {
      const reading = sanitizeReading({
        id: 'r-schedule-test',
        title: 'Maddux & Winstead (2019): Ch 1&2',
        relevantTopics: 'Week 1 Schedule',
        mediaTypeRaw: 'textbook',
        mediaType: 'textbook',
        isCompleted: false,
        isDeleted: false,
        summaryText: '',
        keyTakeawaysText: '',
        estimatedTimeText: '',
        isFavorite: false
      });
      expect(reading.relevantTopics).toBeUndefined();
    });
  });

  describe('cleanAcademicWeekTheme', () => {
    it('cleans messy multi-column table crossover string with dates, citations, and numbers', () => {
      const input = '4-6; DSM 5-TR The History and Section 1, Section 3 - 4/10/26 Modul Cultural Context Culture and e 2 of Clinical Diagnosis (...';
      const cleaned = cleanAcademicWeekTheme(input);
      expect(cleaned).toBe('The History and Cultural Context of Clinical Diagnosis');
    });

    it('returns empty string when input is entirely citations and dates without genuine topic', () => {
      expect(cleanAcademicWeekTheme('4-6; DSM 5-TR Section 1, Section 3 - 4/10/26')).toBe('');
      expect(cleanAcademicWeekTheme('Required: Corey & Corey Ch. 1 & 2; Yalom Ch. 1')).toBe('');
      expect(cleanAcademicWeekTheme('Maddux & Winstead (2019): Ch 1&2, 4-6')).toBe('');
    });

    it('preserves clean genuine academic topics', () => {
      expect(cleanAcademicWeekTheme('Bowen Family Systems')).toBe('Bowen Family Systems');
      expect(cleanAcademicWeekTheme('Mood Disorders')).toBe('Mood Disorders');
      expect(cleanAcademicWeekTheme('Systems Theory & Family Dynamics')).toBe('Systems Theory & Family Dynamics');
      expect(cleanAcademicWeekTheme('Structural Family Therapy')).toBe('Structural Family Therapy');
    });

    it('strips week and module prefixes while preserving topic', () => {
      expect(cleanAcademicWeekTheme('Week 4: Mood Disorders')).toBe('Mood Disorders');
      expect(cleanAcademicWeekTheme('Module 2: Genograms')).toBe('Genograms');
      expect(cleanAcademicWeekTheme('Wk 3 - Systems Theory')).toBe('Systems Theory');
    });

    it('returns empty string for placeholder and schedule headers', () => {
      expect(cleanAcademicWeekTheme('Week 4 Schedule')).toBe('');
      expect(cleanAcademicWeekTheme('Course Schedule')).toBe('');
      expect(cleanAcademicWeekTheme('Topics')).toBe('');
      expect(cleanAcademicWeekTheme('Readings')).toBe('');
      expect(cleanAcademicWeekTheme(null)).toBe('');
      expect(cleanAcademicWeekTheme('')).toBe('');
    });
  });

  describe('isItemForCourse & matchCourseForItem (Universal Resilient Matcher)', () => {
    const courseA = {
      id: 'c-cpc512-active',
      courseCode: 'CPC 512',
      courseName: 'Family Systems Approaches to Counselling'
    };
    const courseB = {
      id: 'c-psyc612-active',
      courseCode: 'PSYC 612',
      courseName: 'Cognitive Neuroscience'
    };

    it('matches by direct courseId equality even if courseCode is missing or divergent', () => {
      const reading = { courseId: 'c-cpc512-active', courseCode: 'OTHER' };
      expect(isItemForCourse(reading, courseA)).toBe(true);
      expect(isItemForCourse(reading, courseB)).toBe(false);
    });

    it('matches by alphanumeric normalized course code when courseId differs or is unset', () => {
      const r1 = { courseId: 'diff-id', courseCode: 'CPC512' };
      expect(isItemForCourse(r1, courseA)).toBe(true);

      const r2 = { courseId: null, courseCode: 'cpc 512' };
      expect(isItemForCourse(r2, courseA)).toBe(true);

      const r3 = { courseId: undefined, courseCode: 'CPC-512' };
      expect(isItemForCourse(r3, courseA)).toBe(true);
    });

    it('matches department and course number regex tokens across long titles', () => {
      const rLong = { courseId: 'diff-id-2', courseCode: 'CPC 512 - Summer 2026' };
      expect(isItemForCourse(rLong, courseA)).toBe(true);

      const cLong = { id: 'c-new', courseCode: 'CPC 512: Family Systems', courseName: 'Family Systems Approaches to Counselling' };
      const rShort = { courseId: 'diff-id-3', courseCode: 'CPC 512' };
      expect(isItemForCourse(rShort, cLong)).toBe(true);
    });

    it('matches course name containment when course code contains or matches course name', () => {
      const rByName = { courseId: 'diff-id-4', courseCode: 'Family Systems Approaches' };
      expect(isItemForCourse(rByName, courseA)).toBe(true);
    });

    it('returns false for null, undefined, or unrelated courses', () => {
      expect(isItemForCourse(null, courseA)).toBe(false);
      expect(isItemForCourse({ courseCode: 'CS 101' }, courseA)).toBe(false);
      expect(isItemForCourse(undefined, undefined)).toBe(false);
    });

    it('matchCourseForItem finds the correct owning course from a course list', () => {
      const readingA = { courseId: 'old-uuid', courseCode: 'CPC512' };
      const matched = matchCourseForItem(readingA, [courseB, courseA]);
      expect(matched?.id).toBe(courseA.id);

      const readingB = { courseId: courseB.id };
      expect(matchCourseForItem(readingB, [courseA, courseB])?.id).toBe(courseB.id);

      const readingUnknown = { courseId: 'unknown', courseCode: 'BIO 100' };
      expect(matchCourseForItem(readingUnknown, [courseA, courseB])).toBeUndefined();
    });
  });

  describe('getAssignmentInstructionSummary (Deadline down below, zero week-leak, non-repetitive)', () => {
    const courseNoWeeks = {
      id: 'cpc-514',
      courseCode: 'CPC 514',
      courseName: 'Research Methods and Statistics',
      weeks: []
    } as unknown as Course;

    const courseWithWeeks = {
      id: 'cpc-512',
      courseCode: 'CPC 512',
      courseName: 'Family Systems',
      weeks: [{ id: 'w1', weekNumber: 1, theme: 'Intro', readings: [] }, { id: 'w2', weekNumber: 2, theme: 'Theory', readings: [] }]
    } as unknown as Course;

    it('strips deadlines and due dates so they are kept strictly down below on the card', () => {
      const assign = {
        title: 'Research Article Analysis-Group Presentation',
        noteText: 'Presentations: Weeks 4–8 · Deadline: July 8',
        subTypeRaw: 'presentation'
      };
      const summary = getAssignmentInstructionSummary(assign, courseNoWeeks);
      expect(summary).not.toMatch(/deadline/i);
      expect(summary).not.toMatch(/july 8/i);
    });

    it('suppresses week references when the course has no weeks', () => {
      const assign = {
        title: 'Research Article Analysis-Group Presentation',
        noteText: 'Presentations: Weeks 4–8 · Deadline: July 8',
        subTypeRaw: 'presentation'
      };
      const summary = getAssignmentInstructionSummary(assign, courseNoWeeks);
      expect(summary).not.toMatch(/\bweeks?\b/i);
      expect(summary).not.toMatch(/4[–-]8/);
      expect(summary).toBe('In small groups · Slide deck with presenter notes');
    });

    it('never repeats presentation up top when assignment title already indicates presentation', () => {
      const assign = {
        title: 'Research Article Analysis-Group Presentation',
        noteText: 'Presentations: Weeks 4–8 · Deadline: July 8',
        subTypeRaw: 'presentation'
      };
      const summary = getAssignmentInstructionSummary(assign, courseNoWeeks);
      expect(summary).not.toMatch(/presentation/i);
    });

    it('never repeats week up top in assignment instruction summary', () => {
      const assign = {
        title: 'Reflective Paper',
        noteText: 'Week 3 · 4–5 pages double spaced',
        subTypeRaw: 'paper'
      };
      const summary = getAssignmentInstructionSummary(assign, courseWithWeeks);
      expect(summary).not.toMatch(/\bweeks?\s*\d+\b/i);
      expect(summary).toBe('4–5 pages double spaced');
    });

    it('preserves clean deliverables and instruction details when non-repetitive', () => {
      const assign1 = {
        title: 'Peer Review Discussion Board Activity',
        noteText: 'Weekly peer feedback posts · 4 Word Document files',
        subTypeRaw: 'assignment'
      };
      const summary1 = getAssignmentInstructionSummary(assign1, courseNoWeeks);
      expect(summary1).toBe('Weekly peer feedback posts · 4 Word Document files');

      const assign2 = {
        title: 'Research Study Design-Individual Paper',
        noteText: '10–12 pages double-spaced with IRB ethics proposal',
        subTypeRaw: 'paper'
      };
      const summary2 = getAssignmentInstructionSummary(assign2, courseNoWeeks);
      expect(summary2).toBe('10–12 pages double-spaced with IRB ethics proposal');
    });
  });
});


