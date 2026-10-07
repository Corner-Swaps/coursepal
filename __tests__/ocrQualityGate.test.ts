import { needsVisionOCR, extractTextFromPDF } from '../src/services/PDFTextExtractor';
import { NativeModules, Platform } from 'react-native';

describe('OCR Quality Gate: needsVisionOCR and extractTextFromPDF', () => {
  describe('needsVisionOCR', () => {
    it('returns true for empty, null, undefined, and whitespace-only text', () => {
      expect(needsVisionOCR('')).toBe(true);
      expect(needsVisionOCR(null as any)).toBe(true);
      expect(needsVisionOCR(undefined as any)).toBe(true);
      expect(needsVisionOCR('   \n\t  ')).toBe(true);
    });

    it('returns true for sparse text (< 60 characters or < 8 words)', () => {
      expect(needsVisionOCR('Page 1 of 12')).toBe(true);
      expect(needsVisionOCR('Course Syllabus')).toBe(true);
      expect(needsVisionOCR('Introduction to Computer Science - Fall 2026')).toBe(true);
    });

    it('returns true for junk text with replacement characters (\\uFFFD)', () => {
      const junk = 'Course syllabus header \uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD with lots of corrupted font characters \uFFFD\uFFFD\uFFFD\uFFFD\uFFFD';
      expect(needsVisionOCR(junk)).toBe(true);
    });

    it('returns true for junk text with low alphabetic character ratio (garbage symbols)', () => {
      const symbolJunk = '==================== !@#$%^&*()_+ 1234567890 -------------------- <><><><><><> /?.,;:\'\"[]{}\\|';
      expect(needsVisionOCR(symbolJunk)).toBe(true);
    });

    it('returns true for unbroken gibberish strings without spaces', () => {
      const unbroken = 'asdfkjasdfkljasdfkljasdfkljasdfkljasdfkljasdfkljasdfkljasdfkljasdfkljasdfkljasdfkljasdfklj';
      expect(needsVisionOCR(unbroken)).toBe(true);
    });

    it('returns false for clean, readable syllabus text', () => {
      const cleanSyllabus = `
        Course Syllabus: PSYC 612 Advanced Clinical Psychopathology
        Instructor: Dr. Diana Morgan, Ph.D.
        Welcome to the course. This seminar covers advanced diagnostic methods and clinical interventions.
        Required Readings:
        Week 1: Chapters 1 & 2 in Clinical Psychology Handbook.
        Week 2: Diagnostic criteria and ethical decision-making frameworks.
        Assignments:
        Midterm Examination worth 30% due on October 15.
        Final Clinical Dossier worth 40% due on December 10.
        Class Participation worth 30% throughout the semester.
      `.trim();
      expect(needsVisionOCR(cleanSyllabus)).toBe(false);
    });
  });

  describe('extractTextFromPDF quality gate wiring', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('falls through to extractTextViaVision when extractText returns junk text', async () => {
      const junkText = 'Page 1 \uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD';
      const visionCleanText = 'PSYC 612 Course Syllabus. Extracted cleanly via Apple Vision OCR with full schedule and assignments.';

      Platform.OS = 'ios';
      NativeModules.PDFTextExtractor = {
        extractText: jest.fn().mockResolvedValue(junkText),
        extractTextViaVision: jest.fn().mockResolvedValue(visionCleanText)
      };

      const result = await extractTextFromPDF('file:///tmp/syllabus.pdf');
      expect(NativeModules.PDFTextExtractor.extractText).toHaveBeenCalledWith('file:///tmp/syllabus.pdf');
      expect(NativeModules.PDFTextExtractor.extractTextViaVision).toHaveBeenCalledWith('file:///tmp/syllabus.pdf');
      expect(result).toBe(visionCleanText);
    });

    it('returns text immediately when extractText returns high quality text', async () => {
      const cleanText = 'PSYC 612 Course Syllabus. Instructor: Dr. Morgan. This course covers clinical psychopathology in depth with assignments and readings.';

      Platform.OS = 'ios';
      NativeModules.PDFTextExtractor = {
        extractText: jest.fn().mockResolvedValue(cleanText),
        extractTextViaVision: jest.fn()
      };

      const result = await extractTextFromPDF('file:///tmp/syllabus.pdf');
      expect(NativeModules.PDFTextExtractor.extractText).toHaveBeenCalledWith('file:///tmp/syllabus.pdf');
      expect(NativeModules.PDFTextExtractor.extractTextViaVision).not.toHaveBeenCalled();
      expect(result).toBe(cleanText);
    });
  });
});
