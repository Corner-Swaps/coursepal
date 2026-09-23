import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import {
  cleanChapterFromRaw,
  formatDisplayTitleWithChapter,
  cleanAcademicWeekTheme,
  stripChapterMentions,
} from '../src/utils/readingDisplayHelper';
import { resolveFullAuthorName } from '../src/utils/authorResolver';

describe('CPC 524 Multi-Citation & Schedule Ingestion Calibration Audit', () => {
  const parser = new LocalSyllabusParser();
  const importManager = new SyllabusImportManager();

  describe('1. Clean Chapter & Multi-Section Parsing', () => {
    test('normalizes multi-section "Section 1, Section 3" into "Sections 1 & 3"', () => {
      const res = cleanChapterFromRaw('Section 1, Section 3');
      expect(res).toBe('Sections 1 & 3');
    });

    test('normalizes "Ch 1&2, 4-6" into "Chapters 1 & 2, 4–6"', () => {
      const res = cleanChapterFromRaw('Ch 1&2, 4-6');
      expect(res).toBe('Chapters 1 & 2, 4–6');
    });

    test('normalizes "Sections 1 & 3" into "Sections 1 & 3"', () => {
      const res = cleanChapterFromRaw('Sections 1 & 3');
      expect(res).toBe('Sections 1 & 3');
    });

    test('normalizes "Sec. 1, 3" into "Sections 1 & 3"', () => {
      const res = cleanChapterFromRaw('Sec. 1, 3');
      expect(res).toBe('Sections 1 & 3');
    });
  });

  describe('2. Author Resolution for Clinical & Diagnostic Scholars', () => {
    test('resolves "Maddux & Winstead, (2019)" to full canonical name', () => {
      const author = resolveFullAuthorName('Maddux & Winstead, (2019)');
      expect(author).toBe('James E. Maddux & Barbara A. Winstead');
    });

    test('resolves "Wada & Fellner, (2025)" to full canonical name', () => {
      const author = resolveFullAuthorName('Wada & Fellner, (2025)');
      expect(author).toBe('Kaori Wada & Karlee D. Fellner');
    });

    test('resolves "Preston, O\'Neal, & Talaga (2021)" to full canonical name', () => {
      const author = resolveFullAuthorName("Preston, O'Neal, & Talaga (2021)");
      expect(author).toBe('John D. Preston, John H. O’Neal & Mary C. Talaga');
    });

    test('resolves "Carlson" to Neil R. Carlson', () => {
      const author = resolveFullAuthorName('Carlson');
      expect(author).toBe('Neil R. Carlson');
    });

    test('resolves "DSM 5-TR" to American Psychiatric Association', () => {
      const author = resolveFullAuthorName('DSM 5-TR');
      expect(author).toBe('American Psychiatric Association');
    });

    test('resolves "WHO ICD" to World Health Organization', () => {
      const author = resolveFullAuthorName('WHO ICD');
      expect(author).toBe('World Health Organization');
    });
  });

  describe('3. LocalSyllabusParser extractChapterAndPages & extractAuthorAndResource', () => {
    test('extracts chapter and author from "Maddux & Winstead, (2019): Ch 1&2, 4-6"', () => {
      const ch = parser.extractChapterAndPages('Maddux & Winstead, (2019): Ch 1&2, 4-6');
      expect(ch.chapter).toBe('Chapters 1 & 2, 4–6');

      const auth = parser.extractAuthorAndResource('Maddux & Winstead, (2019): Ch 1&2, 4-6');
      expect(auth.author).toContain('Maddux');
      expect(auth.author).toContain('Winstead');
    });

    test('extracts section and pages from "DSM 5-TR Section 1, Section 3 - Culture and Psychiatric Diagnosis pg. 859"', () => {
      const ch = parser.extractChapterAndPages('DSM 5-TR Section 1, Section 3 - Culture and Psychiatric Diagnosis pg. 859');
      expect(ch.chapter).toBe('Sections 1 & 3');
      expect(ch.pages).toBe('pg. 859');

      const auth = parser.extractAuthorAndResource('DSM 5-TR Section 1, Section 3 - Culture and Psychiatric Diagnosis pg. 859');
      expect(auth.author).toBe('American Psychiatric Association');
    });

    test('extracts author and resource from "WHO ICD-11"', () => {
      const auth = parser.extractAuthorAndResource('WHO ICD-11');
      expect(auth.author).toBe('World Health Organization');
      expect(auth.resource).toBe('ICD-11');
    });

    test('extracts author and chapter from "Optional: Preston, O\'Neal, & Talaga (2021) Ch. 3"', () => {
      const ch = parser.extractChapterAndPages("Optional: Preston, O'Neal, & Talaga (2021) Ch. 3");
      expect(ch.chapter).toBe('Chapter 3');

      const auth = parser.extractAuthorAndResource("Optional: Preston, O'Neal, & Talaga (2021) Ch. 3");
      expect(auth.author).toContain('Preston');
      expect(auth.author).toContain('Talaga');
    });
  });

  describe('4. Table Column Wrap & Column Bleed Sanitization', () => {
    test('cleanAcademicWeekTheme recovers complete topic without reading or column-bleed noise', () => {
      const mangled = '4-6; DSM 5-TR The History and Section 1, Section 3 - 4/10/26 Modul Cultural Context Culture and e 2 of Clinical Diagnosis (...';
      const cleanTheme = cleanAcademicWeekTheme(mangled);
      expect(cleanTheme).toBe('The History and Cultural Context of Clinical Diagnosis');
      expect(cleanTheme).not.toContain('4-6');
      expect(cleanTheme).not.toContain('DSM');
      expect(cleanTheme).not.toContain('Section');
      expect(cleanTheme).not.toContain('4/10/26');
      expect(cleanTheme).not.toContain('Modul');
      expect(cleanTheme).not.toContain('e 2 of');
    });

    test('splitMultiCitationCandidate stitches orphan chapter numbers and separates readings', () => {
      const lineWithMultiCitation =
        'Maddux & Winstead, (2019): Ch 1&2, 4-6; DSM 5-TR Section 1, Section 3 - Culture and Psychiatric Diagnosis pg. 859; WHO ICD-11; Optional: Preston, O\'Neal, & Talaga (2021) Ch. 3';

      const candidates = SyllabusImportManager.splitMultiCitationCandidate({
        title: lineWithMultiCitation,
        courseCode: 'CPC 524',
        mediaType: 'textbook',
        isRequired: true,
        requirementType: 'required'
      });

      expect(candidates.length).toBe(4);

      // Candidate 1: Maddux & Winstead
      expect(candidates[0].authorName).toContain('Maddux');
      expect(candidates[0].chapterText).toBe('Chapters 1 & 2, 4–6');
      expect(candidates[0].requirementType).toBe('required');

      // Candidate 2: DSM 5-TR
      expect(candidates[1].title).toContain('DSM 5-TR');
      expect(candidates[1].chapterText).toBe('Sections 1 & 3');
      expect(candidates[1].pagesText).toBe('pg. 859');
      expect(candidates[1].relevantTopics).toBe('Culture and Psychiatric Diagnosis');
      expect(candidates[1].requirementType).toBe('required');

      // Candidate 3: WHO ICD-11
      expect(candidates[2].title).toContain('WHO ICD-11');
      expect(candidates[2].requirementType).toBe('required');

      // Candidate 4: Optional Preston
      expect(candidates[3].authorName).toContain('Preston');
      expect(candidates[3].chapterText).toBe('Chapter 3');
      expect(candidates[3].requirementType).toBe('optional');
      expect(candidates[3].isRequired).toBe(false);
    });
  });

  describe('5. Clean Reading Card Title Formatting (No Topic Bleed)', () => {
    test('formats Maddux & Winstead chapter cleanly without appending session theme', () => {
      const reading = {
        id: 'r1',
        title: 'Maddux & Winstead, (2019): Ch 1&2, 4-6',
        authorName: 'James E. Maddux & Barbara A. Winstead',
        chapterText: 'Chapters 1 & 2, 4–6',
        courseCode: 'CPC 524',
        relevantTopics: 'The History and Cultural Context of Clinical Diagnosis'
      };

      const title = formatDisplayTitleWithChapter(
        reading as any,
        reading.chapterText,
        undefined,
        'Psychopathology',
        reading.authorName
      );

      // Must be concise author citation: "Maddux & Winstead (Ch. 1 & 2, 4–6)"
      expect(title).toBe('Maddux & Winstead (Ch. 1 & 2, 4–6)');
      expect(title).not.toContain('The History and Cultural Context');
      expect(title).not.toContain(' · ');
    });

    test('formats DSM 5-TR cleanly with section numbers', () => {
      const reading = {
        id: 'r2',
        title: 'DSM 5-TR: Sections 1 & 3',
        authorName: 'American Psychiatric Association',
        chapterText: 'Sections 1 & 3',
        courseCode: 'CPC 524',
        relevantTopics: 'Culture and Psychiatric Diagnosis'
      };

      const title = formatDisplayTitleWithChapter(
        reading as any,
        reading.chapterText,
        'DSM-5-TR',
        'Psychopathology',
        reading.authorName
      );

      expect(title).toContain('Sections 1 & 3');
      expect(title).not.toContain('The History and Cultural Context');
    });
  });
});
