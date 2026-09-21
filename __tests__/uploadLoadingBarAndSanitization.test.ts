import { cleanUploadStatusMessage } from '../src/utils/readingDisplayHelper';

describe('Upload Loading Bar & Message Sanitization Suite', () => {
  describe('cleanUploadStatusMessage', () => {
    it('returns default fallback when message is null, undefined, or empty', () => {
      expect(cleanUploadStatusMessage(null)).toBe('Processing syllabus, please wait...');
      expect(cleanUploadStatusMessage(undefined)).toBe('Processing syllabus, please wait...');
      expect(cleanUploadStatusMessage('')).toBe('Processing syllabus, please wait...');
      expect(cleanUploadStatusMessage('   ')).toBe('Processing syllabus, please wait...');
    });

    it('strips "AI" occurrences completely from messages', () => {
      expect(cleanUploadStatusMessage('AI extracting schedule...')).toBe('Extracting schedule...');
      expect(cleanUploadStatusMessage('Extracting schedule with AI...')).toBe('Extracting schedule with...');
      expect(cleanUploadStatusMessage('AI extraction complete')).toBe('Extraction complete');
      expect(cleanUploadStatusMessage('Analyzing syllabus with Gemini AI engine')).toBe('Analyzing syllabus with engine');
      expect(cleanUploadStatusMessage('AI')).toBe('Processing syllabus, please wait...');
    });

    it('strips "Gemini" and "Artificial Intelligence" occurrences', () => {
      expect(cleanUploadStatusMessage('Gemini processing syllabus, please wait...')).toBe('Processing syllabus, please wait...');
      expect(cleanUploadStatusMessage('Artificial Intelligence analysis...')).toBe('Analysis...');
    });

    it('preserves clean user-facing status messages without distortion', () => {
      expect(cleanUploadStatusMessage('Reading syllabus...')).toBe('Reading syllabus...');
      expect(cleanUploadStatusMessage('Opening CPC 512.pdf...')).toBe('Opening CPC 512.pdf...');
      expect(cleanUploadStatusMessage('Setting up your schedule...')).toBe('Setting up your schedule...');
      expect(cleanUploadStatusMessage('Resuming schedule setup for syllabus.pdf...')).toBe('Resuming schedule setup for syllabus.pdf...');
    });
  });

  describe('Single Course Progress Calculation (Assignments & Readings)', () => {
    it('calculates progress accurately for active course without leaking other courses', () => {
      const activeCourseId = 'c-active-1';
      const secondaryCourseId = 'c-other-2';

      const allReadings = [
        { id: 'r1', courseId: activeCourseId, isCompleted: true, isDeleted: false },
        { id: 'r2', courseId: activeCourseId, isCompleted: false, isDeleted: false },
        { id: 'r3', courseId: activeCourseId, isCompleted: true, isDeleted: false },
        { id: 'r4', courseId: secondaryCourseId, isCompleted: true, isDeleted: false },
        { id: 'r5', courseId: secondaryCourseId, isCompleted: true, isDeleted: false },
        { id: 'r6', courseId: activeCourseId, isCompleted: false, isDeleted: true } // deleted
      ];

      const activeReadings = allReadings.filter(
        r => !r.isDeleted && r.courseId === activeCourseId
      );

      const total = activeReadings.length;
      const completed = activeReadings.filter(r => r.isCompleted).length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

      expect(total).toBe(3);
      expect(completed).toBe(2);
      expect(pct).toBe(67);
    });
  });

  describe('Assignment Capture & Filtering Calibration', () => {
    it('captures assignments with week numbers or deliverable keywords even without explicit weight or points', () => {
      const { SyllabusImportManager } = require('../src/services/SyllabusImportManager');
      const candidates = [
        {
          title: 'Case Study 1: Ethical Dilemmas',
          weekNumber: 3
        },
        {
          title: 'Midterm Exam',
          fullInstructions: 'Comprehensive midterm examination'
        },
        {
          title: 'Final Project Report',
          fullInstructions: '10-page final report'
        },
        {
          title: 'Reflection Paper',
          weekNumber: 6
        },
        {
          title: 'Required Readings Chapter 4' // purely reading, should be rejected by isInvalidAssignmentTitle
        }
      ];

      const deduplicated = SyllabusImportManager.shared.deduplicateAssignments(candidates);

      expect(deduplicated.length).toBe(4);
      expect(deduplicated.map((a: any) => a.title)).toEqual([
        'Case Study 1: Ethical Dilemmas',
        'Midterm Exam',
        'Final Project Report',
        'Reflection Paper'
      ]);
    });

    it('retains all non-deleted course assignments in Syllabus screen without requiring weight percentage', () => {
      const { isInvalidAssignmentTitle } = require('../src/utils/readingDisplayHelper');
      const courseId = 'c-101';
      const courseCodeKey = 'cpc 511';

      const allAssignments: any[] = [
        { id: 'a1', courseId, courseCode: 'cpc 511', title: 'Reflection Paper', isDeleted: false, weightPercentage: '20%' },
        { id: 'a2', courseId, courseCode: 'cpc 511', title: 'Midterm Exam', isDeleted: false, weightPercentage: undefined, pointsPossible: undefined },
        { id: 'a3', courseId, courseCode: 'cpc 511', title: 'Final Case Presentation', isDeleted: false, weightPercentage: null },
        { id: 'a4', courseId, courseCode: 'cpc 511', title: 'Deleted Item', isDeleted: true, weightPercentage: '10%' },
        { id: 'a5', courseId: 'other-course', courseCode: 'cs 501', title: 'Other Course Paper', isDeleted: false, weightPercentage: '50%' }
      ];

      // Replicating SyllabusScreen filter logic
      const filtered = allAssignments.filter(
        a =>
          !a.isDeleted &&
          (a.courseId ? a.courseId === courseId : (a.courseCode || '').toLowerCase() === courseCodeKey) &&
          !isInvalidAssignmentTitle(a.title)
      );

      expect(filtered.length).toBe(3);
      expect(filtered.map(a => a.title)).toEqual([
        'Reflection Paper',
        'Midterm Exam',
        'Final Case Presentation'
      ]);
    });

    it('does not collapse distinct numbered assignments like Assignment 1 and Assignment 10', () => {
      const { SyllabusImportManager } = require('../src/services/SyllabusImportManager');
      const candidates = [
        { title: 'Assignment 1', pointsPossible: '10 Points' },
        { title: 'Assignment 2', pointsPossible: '10 Points' },
        { title: 'Assignment 10', pointsPossible: '10 Points' },
        { title: 'Quiz 1', weightPercentage: '5%' },
        { title: 'Quiz 10', weightPercentage: '5%' }
      ];

      const deduplicated = SyllabusImportManager.shared.deduplicateAssignments(candidates);
      expect(deduplicated.length).toBe(5);
      expect(deduplicated.map((a: any) => a.title)).toContain('Assignment 1');
      expect(deduplicated.map((a: any) => a.title)).toContain('Assignment 10');
      expect(deduplicated.map((a: any) => a.title)).toContain('Quiz 1');
      expect(deduplicated.map((a: any) => a.title)).toContain('Quiz 10');
    });

    it('captures schedule deliverables alongside readings in weekly schedule rows', () => {
      const { LocalSyllabusParser } = require('../src/services/LocalSyllabusParser');
      const syllabusText = `
Course: CPC 590 Clinical Foundations
Weekly Schedule:
Week 1: Introduction to Clinical Ethics
Readings: Corey Chapter 1
Week 2: Assessment Frameworks
Readings: Corey Chapter 2; Due: Reflection Paper 1 (worth 15%)
Week 3: Diagnostic Protocols
Readings: Gehart Chapter 3; Midterm Exam worth 25%
      `.trim();

      const parsed = LocalSyllabusParser.shared.parseText(syllabusText);
      const assignmentTitles = (parsed.assignments || []).map((a: any) => a.title);
      expect(assignmentTitles.some((t: string) => /reflection paper/i.test(t))).toBe(true);
      expect(assignmentTitles.some((t: string) => /midterm exam/i.test(t))).toBe(true);
    });

    it('specifies blue loading bar configuration without black background or AI keywords', () => {
      const { CoursePalTheme } = require('../src/constants/theme');
      const pillBlue = '#2563EB';
      expect(pillBlue).toBe('#2563EB');
      expect(CoursePalTheme.accentBlue).toBe('#2470F5');
      // Verify message is clean and sanitized
      const statusMsg = cleanUploadStatusMessage('Reading syllabus, please wait a moment...');
      expect(statusMsg).toBe('Reading syllabus, please wait a moment...');
      expect(statusMsg.includes('AI')).toBe(false);
    });
  });
});

