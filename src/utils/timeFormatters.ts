/**
 * Time and Date Formatters
 * 1:1 Parity with Swift WeekDateConverter and Timer formatting
 */

/**
 * Formats seconds into MM:SS (e.g. 05:00, 59:59) or HH:MM:SS if >= 1 hour.
 */
export function formatTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) {
    return '00:00';
  }

  const seconds = Math.floor(totalSeconds);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');

  if (hrs > 0) {
    const hh = String(hrs).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}

/**
 * Returns the academic base term start date based on the current calendar month.
 * 1:1 match with Swift WeekDateConverter.baseTermStartDate
 */
export function getBaseTermStartDate(now: Date = new Date()): Date {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed

  let termMonth = 1;
  let termDay = 15;

  if (month >= 5 && month <= 8) {
    termMonth = 7;
    termDay = 1;
  } else if (month >= 9 && month <= 12) {
    termMonth = 9;
    termDay = 1;
  } else {
    termMonth = 1;
    termDay = 15;
  }

  const termDate = new Date(year, termMonth - 1, termDay, 23, 59, 0, 0);
  return termDate;
}

/**
 * Computes week number (1 to 20) for a given date relative to term start.
 * 1:1 match with Swift WeekDateConverter.weekNumber(for:startDate:)
 */
export function weekNumberForDate(date: Date, startDate: Date = getBaseTermStartDate(date)): number {
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffMs = targetDay.getTime() - startDay.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;

  return Math.max(1, Math.min(20, week));
}

/**
 * Derives week number for a target date given the course start date.
 * 1:1 match with Swift WeekDateConverter.deriveWeekNumber
 */
export function deriveWeekNumber(targetDate: Date, courseStartDate: Date): number {
  const startDay = new Date(courseStartDate.getFullYear(), courseStartDate.getMonth(), courseStartDate.getDate());
  const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  const diffMs = targetDay.getTime() - startDay.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  return Math.max(1, diffWeeks + 1);
}

/**
 * Returns date for a given week number (1-indexed).
 * 1:1 match with Swift WeekDateConverter.date(forWeek:startDate:)
 */
export function dateForWeek(weekNumber: number, startDate: Date = getBaseTermStartDate()): Date {
  const target = new Date(startDate.getTime());
  const addedDays = Math.max(0, weekNumber - 1) * 7;
  target.setDate(target.getDate() + addedDays);
  return target;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Formats due date string matching Swift WeekDateConverter.formattedDueDate 1:1.
 * e.g. "Due Thursday, July 9" or "Due Thursday, July 9, 2025" if year differs.
 */
export function formatDueDate(date: Date | null, weekRange?: string | null, referenceNow: Date = new Date()): string {
  if (!date) {
    const trimmedRange = weekRange?.trim();
    if (trimmedRange && trimmedRange.toLowerCase() !== 'unknown' && trimmedRange.length > 0) {
      return trimmedRange;
    }
    return 'No due date set';
  }

  const dayOfWeek = WEEKDAY_NAMES[date.getDay()];
  const monthName = MONTH_NAMES[date.getMonth()];
  const day = date.getDate();
  const itemYear = date.getFullYear();
  const currentYear = referenceNow.getFullYear();

  if (itemYear !== currentYear) {
    return `Due ${dayOfWeek}, ${monthName} ${day}, ${itemYear}`;
  }

  return `Due ${dayOfWeek}, ${monthName} ${day}`;
}

/**
 * Returns Sunday (start of week at 00:00:00) for a given date.
 */
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() - day);
  return d;
}

/**
 * Calculates current academic course week (e.g. 1..16) relative to term start date
 * or course weeks, strictly avoiding raw calendar week of the year numbers (like week 38).
 */
export function calculateAcademicWeek(
  referenceDate: Date,
  activeCourse?: { weeks?: Array<{ weekNumber: number; startDate?: Date | string | null }> } | null,
  termStartDate?: Date | string | null,
  availableWeeks?: number[]
): number {
  const today = referenceDate;
  // 1. Check if today falls into any week with explicit startDate in active course
  if (activeCourse?.weeks && activeCourse.weeks.length > 0) {
    for (const w of activeCourse.weeks) {
      if (w.startDate) {
        const start = new Date(w.startDate);
        if (!isNaN(start.getTime())) {
          const startTime = getStartOfWeek(start).getTime();
          const endTime = startTime + 7 * 86400000;
          if (today.getTime() >= startTime && today.getTime() < endTime) {
            return w.weekNumber;
          }
        }
      }
    }
  }

  // 2. Relative to termStartDate if available, otherwise getBaseTermStartDate
  const parsedTermStart = termStartDate ? new Date(termStartDate) : null;
  const validTermStart = parsedTermStart && !isNaN(parsedTermStart.getTime()) ? parsedTermStart : null;
  const baseStart = validTermStart ? getStartOfWeek(validTermStart) : getStartOfWeek(getBaseTermStartDate(today));
  const diffMs = today.getTime() - baseStart.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 86400000));
  const calculatedWeek = Math.max(1, diffWeeks + 1);

  if (availableWeeks && availableWeeks.length > 0) {
    const minW = availableWeeks[0];
    const maxW = availableWeeks[availableWeeks.length - 1];
    if (calculatedWeek >= minW && calculatedWeek <= maxW) {
      return calculatedWeek;
    }
    if (calculatedWeek > maxW) {
      return maxW;
    }
    if (calculatedWeek < minW) {
      return minW;
    }
  }

  return calculatedWeek;
}
