/**
 * GoogleCalendarSync Unit Tests
 * Verifies URL templates, date parsing, assignment, reading, and module payloads,
 * as well as one-tap calendar syncing.
 */

import { GoogleCalendarService } from '../src/services/GoogleCalendarService';
import { CalendarExportService } from '../src/services/CalendarExportService';
import { Course, Assignment, Reading } from '../src/types/models';
import { Linking } from 'react-native';

jest.mock('react-native', () => {
  const actualRN = jest.requireActual('react-native');
  return {
    ...actualRN,
    Linking: {
      openURL: jest.fn().mockResolvedValue(true),
      canOpenURL: jest.fn().mockResolvedValue(true)
    },
    Alert: {
      alert: jest.fn()
    },
    Clipboard: {
      setString: jest.fn(),
      getString: jest.fn().mockResolvedValue('')
    }
  };
});

describe('GoogleCalendarService', () => {
  const mockCourse: Course = {
    id: 'course-cpc512',
    creatorId: 'user-1',
    courseName: 'Family Systems Theory',
    courseCode: 'CPC 512',
    instructorName: 'Dr. Salvador Minuchin',
    termWeeks: 12,
    hexColor: '#2563EB',
    sharingCode: 'CPC512',
    isDeleted: false,
    isFavorite: false,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    weeks: [
      {
        id: 'wk-1',
        weekNumber: 1,
        startDate: new Date('2026-09-08T12:00:00Z'),
        dateRangeStr: 'Sep 8 – Sep 14, 2026',
        theme: 'Foundations of Systemic Family Therapy',
        readings: []
      },
      {
        id: 'wk-5',
        weekNumber: 5,
        startDate: new Date('2026-10-06T12:00:00Z'),
        dateRangeStr: 'Oct 6 – Oct 12, 2026',
        theme: 'Structural Family Therapy & Mapping',
        readings: []
      }
    ],
    assignments: [],
    syllabusDocs: []
  };

  const mockAssignment: Assignment = {
    id: 'assign-case-1',
    courseId: 'course-cpc512',
    courseCode: 'CPC 512',
    title: 'Case Conceptualization & Treatment Plan',
    weekNumber: 5,
    dueDate: new Date('2026-10-15T12:00:00Z'),
    isCompleted: false,
    isDeleted: false,
    pointsPossible: '100 Points',
    weightPercentage: '20%',
    fullInstructions: 'Complete comprehensive genogram and theoretical conceptualization using structural family therapy.',
    noteText: 'Review rubric criteria before submission. Deadline is 11:59 PM.',
    isFavorite: false,
    rubricCriteria: [
      { criterionName: 'Theoretical Conceptualization', points: 30 },
      { criterionName: 'Evidence & Support', points: 30 },
      { criterionName: 'Clinical Competence', points: 40 }
    ]
  };

  const mockReading: Reading = {
    id: 'read-ch1',
    weekId: 'wk-1',
    courseCode: 'CPC 512',
    title: 'Systemic Interventions & Foundations',
    authorName: 'Gehart, D. R.',
    chapterText: 'Chapters 1–3',
    pagesText: 'pp. 15–48',
    resourceTitle: 'Mastering Competencies in Family Therapy',
    summaryText: 'Core axioms of cybernetics and feedback loops in family systems.',
    keyTakeawaysText: 'First-order vs second-order cybernetics.',
    estimatedTimeText: '45 mins',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    dueDate: new Date('2026-09-10T12:00:00Z'),
    dateRangeStr: 'Sep 8 – Sep 14, 2026',
    relevantTopics: 'Systemic Foundations',
    isCompleted: false,
    isDeleted: false,
    isFavorite: false,
    isRequired: true
  };


  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildEventUrl', () => {
    it('constructs an all-day Google Calendar URL with exclusive +1 day end date', () => {
      const url = GoogleCalendarService.buildEventUrl({
        title: 'Midterm Exam',
        startDate: new Date(2026, 9, 15), // Oct 15, 2026
        allDay: true,
        details: 'Bring pencils and calculator',
        location: 'Hall A'
      });

      expect(url).toContain('https://calendar.google.com/calendar/render?');
      expect(url).toContain('action=TEMPLATE');
      expect(url).toContain('text=Midterm%20Exam');
      // Inclusive start 20261015, exclusive end 20261016
      expect(url).toContain('dates=20261015/20261016');
      expect(url).toContain('details=Bring%20pencils%20and%20calculator');
      expect(url).toContain('location=Hall%20A');
    });

    it('constructs a timed Google Calendar URL in UTC format', () => {
      const start = new Date(Date.UTC(2026, 9, 15, 18, 0, 0));
      const end = new Date(Date.UTC(2026, 9, 15, 19, 0, 0));

      const url = GoogleCalendarService.buildEventUrl({
        title: 'Project Presentation',
        startDate: start,
        endDate: end,
        allDay: false,
        details: 'Live dyadic presentation'
      });

      expect(url).toContain('dates=20261015T180000Z/20261015T190000Z');
      expect(url).toContain('text=Project%20Presentation');
    });
  });

  describe('parseEventDateRange', () => {
    it('parses single ISO and formatted dates', () => {
      const single = GoogleCalendarService.parseEventDateRange('2026-10-15');
      expect(single).not.toBeNull();
      expect(single?.startDate.getMonth()).toBe(9); // October
      expect(single?.startDate.getDate()).toBe(15);
    });

    it('parses hyphen and en-dash date ranges into start and end dates', () => {
      const range = GoogleCalendarService.parseEventDateRange('Sep 8 – Sep 14, 2026');
      expect(range).not.toBeNull();
      expect(range?.startDate.getMonth()).toBe(8); // September
      expect(range?.startDate.getDate()).toBe(8);
      expect(range?.endDate?.getMonth()).toBe(8);
      expect(range?.endDate?.getDate()).toBe(14);
    });

    it('borrows month name for short second range parts like "Sep 1 - 5, 2026"', () => {
      const range = GoogleCalendarService.parseEventDateRange('Sep 1 – 5, 2026');
      expect(range).not.toBeNull();
      expect(range?.startDate.getDate()).toBe(1);
      expect(range?.endDate?.getDate()).toBe(5);
    });
  });

  describe('buildAssignmentEventUrl', () => {
    it('generates a rich assignment payload with rubric, points, and instructions', () => {
      const url = GoogleCalendarService.buildAssignmentEventUrl(mockAssignment, mockCourse);

      expect(url).toContain('text=%5BCPC%20512%5D%20Due%3A%20Case%20Conceptualization%20%26%20Treatment%20Plan');
      // Due date was Oct 15, note had 11:59 PM so timed event or all-day
      expect(url).toContain('Theoretical%20Conceptualization%20(30%20pts)');
      expect(url).toContain('Evidence%20%26%20Support%20(30%20pts)');
      expect(url).toContain('Clinical%20Competence%20(40%20pts)');
      expect(url).toContain('100%20Points');
      expect(url).toContain('20%25%20of%20Final%20Grade');
      expect(url).toContain('Managed%20with%20CoursePal');
    });

    it('falls back to matched course week date if assignment has no explicit dueDate', () => {
      const undatedAssign: Assignment = {
        ...mockAssignment,
        id: 'undated-1',
        dueDate: null,
        noteText: 'Review before submission', // No time specified -> all-day
        weekNumber: 5
      };

      const url = GoogleCalendarService.buildAssignmentEventUrl(undatedAssign, mockCourse);
      expect(url).toContain('action=TEMPLATE');
      // Week 5 starts on 2026-10-06
      expect(url).toContain('dates=20261006/20261007');
    });
  });

  describe('buildReadingEventUrl', () => {
    it('generates a reading payload with author, chapter, pages, and key takeaways', () => {
      const url = GoogleCalendarService.buildReadingEventUrl(mockReading, mockCourse);

      expect(url).toContain('Reading%3A%20Chapters%201%E2%80%933%20%C2%B7%20Systemic%20Interventions%20%26%20Foundations');
      expect(url).toContain('Author%3A%20Diane%20R.%20Gehart');
      expect(url).toContain('Chapter%3A%20Chapters%201%E2%80%933');
      expect(url).toContain('Pages%3A%20pp.%2015%E2%80%9348');
      expect(url).toContain('Required%20Reading');
      expect(url).toContain('First-order%20vs%20second-order%20cybernetics.');
    });
  });

  describe('buildModuleEventUrl', () => {
    it('generates a comprehensive module payload including overview and readings list', () => {
      const moduleAssignment: Assignment = {
        ...mockAssignment,
        moduleNumber: 1
      };

      const url = GoogleCalendarService.buildModuleEventUrl({
        moduleNumber: 1,
        moduleLabel: 'Module 1',
        theme: 'Foundations of Systemic Family Therapy',
        readings: [mockReading],
        assignments: [moduleAssignment],
        course: mockCourse,
        dateRangeStr: 'Sep 8 – Sep 14, 2026'
      });

      expect(url).toContain('text=%5BCPC%20512%5D%20Module%201%3A%20Foundations%20of%20Systemic%20Family%20Therapy');
      // Date range from Sep 8 to Sep 14 -> exclusive end is Sep 15
      expect(url).toContain('dates=20260908/20260915');
      expect(url).toContain('Readings%20(1)');
      expect(url).toContain('Diane%20R.%20Gehart');
      expect(url).toContain('Assignments%20%26%20Deliverables');
    });
  });



  describe('buildDayViewUrl', () => {
    it('formats single-digit month and day with strict zero-padding', () => {
      const date = new Date(2026, 8, 8); // Sep 8, 2026
      const url = GoogleCalendarService.buildDayViewUrl(date);
      expect(url).toBe('https://calendar.google.com/calendar/u/0/r/day/2026/09/08');
    });

    it('formats double-digit month and day properly', () => {
      const date = new Date(2026, 9, 15); // Oct 15, 2026
      const url = GoogleCalendarService.buildDayViewUrl(date);
      expect(url).toBe('https://calendar.google.com/calendar/u/0/r/day/2026/10/15');
    });

    it('falls back safely to today if an invalid date is passed', () => {
      const url = GoogleCalendarService.buildDayViewUrl(new Date('invalid'));
      expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/u\/0\/r\/day\/\d{4}\/\d{2}\/\d{2}$/);
    });
  });

  describe('sync methods & openDateInCalendar', () => {
    it('syncAssignment opens date in Calendar app via calshow on iOS and copies details to clipboard', async () => {
      const success = await GoogleCalendarService.syncAssignment(mockAssignment, mockCourse);
      expect(success).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledTimes(1);
      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/^calshow:\d+$/));
    });

    it('syncReading opens date in Calendar app via calshow on iOS and copies details to clipboard', async () => {
      const success = await GoogleCalendarService.syncReading(mockReading, mockCourse);
      expect(success).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledTimes(1);
      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/^calshow:\d+$/));
    });

    it('syncModule opens start date in Calendar app via calshow on iOS and copies overview to clipboard', async () => {
      const success = await GoogleCalendarService.syncModule({
        moduleNumber: 1,
        theme: 'Family Foundations',
        readings: [mockReading],
        course: mockCourse,
        dateRangeStr: 'Sep 8 – Sep 14, 2026'
      });
      expect(success).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledTimes(1);
      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/^calshow:\d+$/));
    });
  });

  describe('CalendarExportService module parity', () => {
    it('createModuleICS generates valid RFC 5545 VEVENT for a course module', () => {
      const ics = CalendarExportService.createModuleICS({
        moduleNumber: 1,
        theme: 'Foundations of Systemic Family Therapy',
        readings: [mockReading],
        assignments: [mockAssignment],
        course: mockCourse,
        dateRangeStr: 'Sep 8 – Sep 14, 2026'
      });

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('SUMMARY:[CPC 512] Module 1: Foundations of Systemic Family Therapy');
      expect(ics).toContain('UID:module-1-CPC 512@coursepal.app');
      expect(ics).toContain('END:VCALENDAR');
    });
  });
});
