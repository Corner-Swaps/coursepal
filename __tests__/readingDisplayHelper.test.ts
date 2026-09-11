import {
  cleanChapterFromRaw,
  stripChapterMentions,
  distillSmartReadingTitle,
  formatDisplayTitleWithChapter,
  formatAuthorAndPagesSubtitle,
  parseSafeDate,
  formatAssignmentDueDate
} from '../src/utils/readingDisplayHelper';
import { sanitizeAssignment } from '../src/context/CoursePalContext';

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
  });
});
