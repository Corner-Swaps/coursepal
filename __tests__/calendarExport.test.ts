/**
 * CalendarExportService Unit Tests
 * Parity with native iOS CalendarSyncService & RFC 5545 iCalendar standard
 */

import { CalendarExportService } from '../src/services/CalendarExportService';
import { Course, Assignment, Reading } from '../src/types/models';

describe('CalendarExportService', () => {
  const mockCourse: Course = {
    id: 'course-chem101',
    creatorId: 'creator-1',
    courseName: 'Organic Chemistry',
    courseCode: 'CHEM 201',
    instructorName: 'Dr. Walter White',
    termWeeks: 14,
    hexColor: '#059669',
    sharingCode: 'CHEM201',
    isDeleted: false,
    isFavorite: false,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    weeks: [],
    assignments: [],
    syllabusDocs: []
  };

  const mockAssignment: Assignment = {
    id: 'assign-midterm-1',
    courseId: 'course-chem101',
    courseCode: 'CHEM 201',
    title: 'Midterm Exam Preparation',
    weekNumber: 6,
    dueDate: new Date('2026-10-15T14:00:00Z'),
    isCompleted: false,
    isDeleted: false,
    pointsPossible: '100 Points',
    weightPercentage: '20%',
    fullInstructions: 'Bring scientific calculator, pencil, and student ID.',
    noteText: 'Review chapters 1 through 5 thoroughly.',
    isFavorite: false,
    rubricCriteria: []
  };

  const mockReading: Reading = {
    id: 'read-ch4',
    weekId: 'week-4',
    courseCode: 'CHEM 201',
    title: 'Alkanes and Cycloalkanes',
    authorName: 'Vollhardt & Schore',
    chapterText: 'Chapter 4',
    pagesText: 'pp. 110-145',
    resourceTitle: 'Organic Chemistry Structure & Function',
    summaryText: 'Conformational analysis of cyclohexane and boat/chair forms.',
    keyTakeawaysText: 'Conformations and ring strain.',
    estimatedTimeText: '45 mins',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    dueDate: new Date('2026-09-28T18:00:00Z'),
    isCompleted: false,
    isDeleted: false,
    isFavorite: false
  };

  describe('generateVEvent', () => {
    it('generates an RFC 5545 compliant VEVENT block with 24h and 2h reminders', () => {
      const event = CalendarExportService.generateVEvent({
        uid: 'test-event-1',
        title: 'Problem Set #3',
        courseCode: 'CHEM 201',
        dueDate: new Date('2026-10-20T20:00:00Z'),
        description: 'Complete questions 1 through 15',
        location: 'Science Hall 302'
      });

      expect(event).toContain('BEGIN:VEVENT');
      expect(event).toContain('END:VEVENT');
      expect(event).toContain('UID:test-event-1@coursepal.app');
      expect(event).toContain('SUMMARY:[CHEM 201] Problem Set #3');
      expect(event).toContain('DESCRIPTION:Complete questions 1 through 15');
      expect(event).toContain('LOCATION:Science Hall 302');
      expect(event).toContain('STATUS:CONFIRMED');

      // Schedule deadline 1 hour duration ending at due date
      expect(event).toContain('DTSTART:20261020T190000Z');
      expect(event).toContain('DTEND:20261020T200000Z');

      // 24 Hour Alarm
      expect(event).toContain('TRIGGER:-P1D');
      expect(event).toContain('DESCRIPTION:Reminder: 24 hours until due');

      // 2 Hour Alarm
      expect(event).toContain('TRIGGER:-PT2H');
      expect(event).toContain('DESCRIPTION:Reminder: 2 hours until due');
    });

    it('escapes special characters such as semicolons, commas, and newlines in summary and description', () => {
      const event = CalendarExportService.generateVEvent({
        uid: 'escape-test',
        title: 'Project; Phase 1, Final Draft',
        courseCode: 'CS 101',
        dueDate: new Date('2026-11-01T12:00:00Z'),
        description: 'Line 1\nLine 2, with comma; and semicolon\\backslash'
      });

      expect(event).toContain('SUMMARY:[CS 101] Project\\; Phase 1\\, Final Draft');
      expect(event).toContain('DESCRIPTION:Line 1\\nLine 2\\, with comma\\; and semicolon\\\\backslash');
    });
  });

  describe('wrapVCalendar', () => {
    it('wraps events into a valid VCALENDAR standard envelope', () => {
      const event = CalendarExportService.generateVEvent({
        uid: 'cal-wrap-1',
        title: 'Quiz 1',
        courseCode: 'MATH 101',
        dueDate: new Date('2026-09-15T09:00:00Z')
      });

      const ics = CalendarExportService.wrapVCalendar([event]);
      expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
      expect(ics.endsWith('END:VCALENDAR')).toBe(true);
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//CoursePal//Academic Companion//EN');
      expect(ics).toContain('CALSCALE:GREGORIAN');
      expect(ics).toContain('METHOD:PUBLISH');
      expect(ics).toContain('UID:cal-wrap-1@coursepal.app');
    });
  });

  describe('createAssignmentICS', () => {
    it('creates complete .ics content for an assignment deliverable', () => {
      const ics = CalendarExportService.createAssignmentICS(mockAssignment, 'Organic Chemistry');
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('[CHEM 201] Midterm Exam Preparation');
      expect(ics).toContain('Course: Organic Chemistry');
      expect(ics).toContain('Points: 100 Points');
      expect(ics).toContain('Weight: 20%');
      expect(ics).toContain('Bring scientific calculator\\, pencil\\, and student ID.');
      expect(ics).toContain('Review chapters 1 through 5 thoroughly.');
      expect(ics).toContain('END:VCALENDAR');
    });
  });

  describe('createReadingICS', () => {
    it('creates complete .ics content for an assigned reading', () => {
      const ics = CalendarExportService.createReadingICS(mockReading, 'Organic Chemistry');
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('[CHEM 201] Alkanes and Cycloalkanes');
      expect(ics).toContain('Author: Vollhardt & Schore');
      expect(ics).toContain('Chapter: Chapter 4');
      expect(ics).toContain('Pages: pp. 110-145');
      expect(ics).toContain('Source: Organic Chemistry Structure & Function');
      expect(ics).toContain('Notes: Conformational analysis of cyclohexane and boat/chair forms.');
      expect(ics).toContain('END:VCALENDAR');
    });
  });

  describe('createCourseScheduleICS', () => {
    it('aggregates all active assignments and readings for a course while skipping deleted items', () => {
      const deletedAssignment: Assignment = {
        ...mockAssignment,
        id: 'assign-deleted',
        title: 'Deleted Assignment',
        isDeleted: true
      };

      const deletedReading: Reading = {
        ...mockReading,
        id: 'read-deleted',
        title: 'Deleted Reading',
        isDeleted: true
      };

      const readingWithoutDueDate: Reading = {
        ...mockReading,
        id: 'read-no-due',
        title: 'Optional Reading No Due Date',
        dueDate: undefined,
        isDeleted: false
      };

      const assignments = [mockAssignment, deletedAssignment];
      const readings = [mockReading, deletedReading, readingWithoutDueDate];

      const fullScheduleICS = CalendarExportService.createCourseScheduleICS(
        mockCourse,
        assignments,
        readings
      );

      // Should include active items
      expect(fullScheduleICS).toContain('UID:assign-assign-midterm-1@coursepal.app');
      expect(fullScheduleICS).toContain('UID:reading-read-ch4@coursepal.app');

      // Should exclude deleted and undated items
      expect(fullScheduleICS).not.toContain('Deleted Assignment');
      expect(fullScheduleICS).not.toContain('Deleted Reading');
      expect(fullScheduleICS).not.toContain('Optional Reading No Due Date');

      // Should have 2 VEVENT blocks
      const veventMatches = fullScheduleICS.match(/BEGIN:VEVENT/g);
      expect(veventMatches).toHaveLength(2);
    });
  });

  describe('exportAndShareICS', () => {
    it('successfully handles file generation and share invocation', async () => {
      const result = await CalendarExportService.exportAndShareICS(
        'test-calendar',
        'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
        'Course Schedule'
      );
      expect(result).toBe(true);
    });
  });
});
