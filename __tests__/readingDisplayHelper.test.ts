import {
  cleanChapterFromRaw,
  stripChapterMentions,
  distillSmartReadingTitle,
  formatDisplayTitleWithChapter,
  formatAuthorAndPagesSubtitle
} from '../src/utils/readingDisplayHelper';

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
  });
});
