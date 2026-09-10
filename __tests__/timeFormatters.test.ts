import {
  formatTime,
  getBaseTermStartDate,
  weekNumberForDate,
  deriveWeekNumber,
  dateForWeek,
  formatDueDate
} from '../src/utils/timeFormatters';

describe('Time Formatters & Academic Date Calculus', () => {
  describe('formatTime', () => {
    test('formats 0 seconds as 00:00', () => {
      expect(formatTime(0)).toBe('00:00');
    });

    test('formats 300 seconds as 05:00', () => {
      expect(formatTime(300)).toBe('05:00');
    });

    test('formats 3599 seconds as 59:59', () => {
      expect(formatTime(3599)).toBe('59:59');
    });

    test('formats 60 seconds as 01:00', () => {
      expect(formatTime(60)).toBe('01:00');
    });

    test('formats 9 seconds as 00:09 with leading zero', () => {
      expect(formatTime(9)).toBe('00:09');
    });

    test('formats 3600 seconds as 01:00:00 when hours > 0', () => {
      expect(formatTime(3600)).toBe('01:00:00');
    });

    test('formats 3665 seconds as 01:01:05', () => {
      expect(formatTime(3665)).toBe('01:01:05');
    });

    test('handles negative values and NaN gracefully', () => {
      expect(formatTime(-10)).toBe('00:00');
      expect(formatTime(NaN)).toBe('00:00');
    });
  });

  describe('getBaseTermStartDate', () => {
    test('resolves July 1 for summer months (May-Aug)', () => {
      const summer = new Date(2026, 6, 15); // July 2026
      const base = getBaseTermStartDate(summer);
      expect(base.getFullYear()).toBe(2026);
      expect(base.getMonth()).toBe(6); // July (0-indexed 6)
      expect(base.getDate()).toBe(1);
      expect(base.getHours()).toBe(23);
      expect(base.getMinutes()).toBe(59);
    });

    test('resolves September 1 for fall months (Sep-Dec)', () => {
      const fall = new Date(2026, 9, 10); // October 2026
      const base = getBaseTermStartDate(fall);
      expect(base.getFullYear()).toBe(2026);
      expect(base.getMonth()).toBe(8); // September (0-indexed 8)
      expect(base.getDate()).toBe(1);
    });

    test('resolves January 15 for winter/spring months (Jan-Apr)', () => {
      const spring = new Date(2026, 2, 5); // March 2026
      const base = getBaseTermStartDate(spring);
      expect(base.getFullYear()).toBe(2026);
      expect(base.getMonth()).toBe(0); // January (0-indexed 0)
      expect(base.getDate()).toBe(15);
    });
  });

  describe('weekNumberForDate & deriveWeekNumber', () => {
    const termStart = new Date(2026, 8, 1); // Sep 1, 2026

    test('computes week 1 for the start day', () => {
      expect(weekNumberForDate(termStart, termStart)).toBe(1);
    });

    test('computes week 2 for 7 days later', () => {
      const day8 = new Date(2026, 8, 8);
      expect(weekNumberForDate(day8, termStart)).toBe(2);
    });

    test('derives week numbers matching Swift deriveWeekNumber', () => {
      const target = new Date(2026, 8, 15); // 14 days later
      expect(deriveWeekNumber(target, termStart)).toBe(3);
    });

    test('clamps between 1 and 20', () => {
      const farFuture = new Date(2028, 0, 1);
      expect(weekNumberForDate(farFuture, termStart)).toBe(20);
    });
  });

  describe('dateForWeek', () => {
    test('returns exact 7-day increments from base date', () => {
      const start = new Date(2026, 8, 1);
      const week1Date = dateForWeek(1, start);
      expect(week1Date.getTime()).toBe(start.getTime());

      const week2Date = dateForWeek(2, start);
      const diffDays = (week2Date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(7);
    });
  });

  describe('formatDueDate', () => {
    const now = new Date(2026, 6, 15); // Year 2026

    test('returns week range when date is null and range is present', () => {
      expect(formatDueDate(null, 'Week 3: Module 2', now)).toBe('Week 3: Module 2');
    });

    test('returns "No due date set" when date is null and range is unknown or empty', () => {
      expect(formatDueDate(null, 'Unknown', now)).toBe('No due date set');
      expect(formatDueDate(null, null, now)).toBe('No due date set');
    });

    test('formats same-year date without year suffix', () => {
      const target = new Date(2026, 6, 20); // July 20, 2026 (Monday)
      expect(formatDueDate(target, null, now)).toBe('Due Monday, July 20');
    });

    test('formats different-year date with full year suffix', () => {
      const target = new Date(2025, 11, 15); // Dec 15, 2025 (Monday)
      expect(formatDueDate(target, null, now)).toBe('Due Monday, December 15, 2025');
    });
  });
});
