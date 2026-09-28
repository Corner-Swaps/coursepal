/**
 * GoogleCalendarService
 * Enables seamless, zero-friction syncing of assignments, readings, and modules
 * into Google Calendar via RFC-compliant web/app templates.
 * 
 * Works universally across iOS, Android, and web with zero OAuth friction.
 */

import { Linking, Alert, Clipboard, Platform } from 'react-native';
import { Assignment, Reading, Course, RubricCriterionDTO } from '../types/models';
import {
  parseSafeDate,
  isRealDateOrRangeString,
  isDateRangeString,
  cleanAssignmentTitle,
  formatDisplayTitleWithChapter,
  cleanChapterFromRaw
} from '../utils/readingDisplayHelper';
import { resolveFullAuthorName } from '../utils/authorResolver';

export interface GoogleCalendarEventOptions {
  title: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  details?: string;
  location?: string;
}

export class GoogleCalendarService {
  /**
   * Constructs an official Google Calendar event creation URL.
   * Universal URL template:
   * https://calendar.google.com/calendar/render?action=TEMPLATE&text={title}&dates={start}/{end}&details={details}&location={location}
   */
  public static buildEventUrl(options: GoogleCalendarEventOptions): string {
    const pad = (n: number) => String(n).padStart(2, '0');

    let datesParam: string;
    if (options.allDay !== false) {
      // All-day format: YYYYMMDD/YYYYMMDD (end date is exclusive in Google Calendar)
      const start = options.startDate;
      const startStr = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}`;

      const inclusiveEnd = options.endDate || options.startDate;
      // Google Calendar all-day end date is exclusive, so add 1 day
      const exclusiveEnd = new Date(
        inclusiveEnd.getFullYear(),
        inclusiveEnd.getMonth(),
        inclusiveEnd.getDate() + 1
      );
      const endStr = `${exclusiveEnd.getFullYear()}${pad(exclusiveEnd.getMonth() + 1)}${pad(exclusiveEnd.getDate())}`;
      datesParam = `${startStr}/${endStr}`;
    } else {
      // Timed event in UTC format: YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ
      const formatUTC = (d: Date) =>
        `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

      const startUTC = formatUTC(options.startDate);
      const end = options.endDate || new Date(options.startDate.getTime() + 60 * 60 * 1000);
      const endUTC = formatUTC(end);
      datesParam = `${startUTC}/${endUTC}`;
    }

    const cleanTitle = (options.title || 'CoursePal Item').trim().slice(0, 250);
    const cleanDetails = (options.details || '').trim().slice(0, 3000);
    const cleanLocation = (options.location || '').trim().slice(0, 200);

    const queryParts = [
      'action=TEMPLATE',
      `text=${encodeURIComponent(cleanTitle)}`,
      `dates=${datesParam}`
    ];

    if (cleanDetails) {
      queryParts.push(`details=${encodeURIComponent(cleanDetails)}`);
    }

    if (cleanLocation) {
      queryParts.push(`location=${encodeURIComponent(cleanLocation)}`);
    }

    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (userTz) {
        queryParts.push(`ctz=${encodeURIComponent(userTz)}`);
      }
    } catch {}

    return `https://calendar.google.com/calendar/render?${queryParts.join('&')}`;
  }

  /**
   * Helper to parse a date or date range into { start, end } dates.
   */
  public static parseEventDateRange(
    dateOrRange?: Date | string | null,
    fallbackYear: number = 2026
  ): { startDate: Date; endDate?: Date } | null {
    if (!dateOrRange) return null;
    if (dateOrRange instanceof Date) {
      if (isNaN(dateOrRange.getTime())) return null;
      return { startDate: dateOrRange };
    }

    const rawStr = String(dateOrRange).trim();
    if (!rawStr) return null;

    if (isDateRangeString(rawStr)) {
      const parts = rawStr.split(/\s*[-–—]\s*|\s+\bto\b\s+/i);
      if (parts.length >= 2) {
        const startParsed = parseSafeDate(parts[0], fallbackYear);
        // If part 2 lacks month name, try borrowing from part 1
        let endRaw = parts[1];
        const monthMatch = parts[0].match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
        if (monthMatch && !/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(endRaw)) {
          endRaw = `${monthMatch[0]} ${endRaw}`;
        }
        const endParsed = parseSafeDate(endRaw, fallbackYear);

        if (startParsed && endParsed) {
          return { startDate: startParsed, endDate: endParsed };
        }
        if (startParsed) {
          return { startDate: startParsed };
        }
      }
    }

    const singleDate = parseSafeDate(rawStr, fallbackYear);
    if (singleDate) {
      return { startDate: singleDate };
    }

    return null;
  }

  /**
   * Builds the Google Calendar URL for an Assignment.
   */
  public static buildAssignmentEventUrl(
    assignment: Assignment,
    course?: Course | null,
    overrideDate?: Date | null
  ): string {
    const courseCode = assignment.courseCode || course?.courseCode || course?.courseName || 'Course';
    const cleanTitle = cleanAssignmentTitle(assignment.title);
    const eventTitle = `[${courseCode}] Due: ${cleanTitle}`;

    // Resolve date
    let resolvedDate: Date | null = overrideDate || (assignment.dueDate ? parseSafeDate(assignment.dueDate) : null);

    // If date is missing, check course weeks matching weekNumber or moduleNumber
    if (!resolvedDate && course?.weeks) {
      if (assignment.weekNumber && assignment.weekNumber > 0) {
        const matchedWeek = course.weeks.find(w => w.weekNumber === assignment.weekNumber);
        if (matchedWeek?.startDate) {
          resolvedDate = parseSafeDate(matchedWeek.startDate);
        } else if (matchedWeek?.dateRangeStr) {
          const range = this.parseEventDateRange(matchedWeek.dateRangeStr);
          if (range) resolvedDate = range.startDate;
        }
      } else if (assignment.moduleNumber && assignment.moduleNumber > 0) {
        const matchedWeek = course.weeks.find(w => w.moduleNumber === assignment.moduleNumber);
        if (matchedWeek?.startDate) {
          resolvedDate = parseSafeDate(matchedWeek.startDate);
        } else if (matchedWeek?.dateRangeStr) {
          const range = this.parseEventDateRange(matchedWeek.dateRangeStr);
          if (range) resolvedDate = range.startDate;
        }
      }
    }

    // Fallback: today
    const finalStartDate = resolvedDate || new Date();

    // Check for explicit time string in noteText or instructions (e.g. "11:59 PM", "5:00 pm")
    const combinedText = `${assignment.noteText || ''} ${assignment.fullInstructions || ''}`;
    const timeMatch = combinedText.match(/\b(1[0-2]|0?[1-9]):([0-5][0-9])\s*(am|pm)\b/i);

    let allDay = true;
    let timedStart: Date | undefined;
    let timedEnd: Date | undefined;

    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const isPM = timeMatch[3].toLowerCase() === 'pm';
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;

      timedEnd = new Date(finalStartDate.getFullYear(), finalStartDate.getMonth(), finalStartDate.getDate(), hours, minutes, 0);
      timedStart = new Date(timedEnd.getTime() - 60 * 60 * 1000); // 1 hour block
      allDay = false;
    }

    // Build rich details body
    const detailsSections: string[] = [];

    const courseDisplayName = course?.courseName
      ? `${course.courseName} (${courseCode})`
      : courseCode;
    detailsSections.push(`Course: ${courseDisplayName}`);

    if (assignment.dueDate) {
      const d = parseSafeDate(assignment.dueDate);
      if (d) {
        const dateStr = d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
        detailsSections.push(`Due Date: ${dateStr}`);
      }
    }

    const scheduleParts: string[] = [];
    if (assignment.weekNumber && assignment.weekNumber > 0) {
      scheduleParts.push(`Week ${assignment.weekNumber}`);
    }
    if (assignment.moduleNumber && assignment.moduleNumber > 0) {
      scheduleParts.push(`Module ${assignment.moduleNumber}`);
    } else if (assignment.moduleMention) {
      scheduleParts.push(assignment.moduleMention);
    }
    if (scheduleParts.length > 0) {
      detailsSections.push(`Schedule: ${scheduleParts.join(' · ')}`);
    }

    const statusStr = assignment.isCompleted ? 'Completed' : 'Pending';
    detailsSections.push(`Status: ${statusStr}`);

    if (assignment.pointsPossible) {
      detailsSections.push(`Points: ${assignment.pointsPossible}`);
    }
    if (assignment.weightPercentage) {
      detailsSections.push(`Weight: ${assignment.weightPercentage} of Final Grade`);
    }

    // Rubric criteria breakdown
    const rubric = assignment.rubricCriteria || (assignment as any).rubric;
    if (Array.isArray(rubric) && rubric.length > 0) {
      const rubricLines = rubric.map(r => {
        const name = r.criterionName || (r as any).name || (r as any).title || 'Criterion';
        const pts = r.points !== null && r.points !== undefined ? ` (${r.points} pts)` : '';
        return `• ${name}${pts}`;
      });
      detailsSections.push(`\nRubric Criteria:\n${rubricLines.join('\n')}`);
    }

    // Instructions
    if (assignment.fullInstructions && assignment.fullInstructions.trim()) {
      detailsSections.push(`\nInstructions:\n${assignment.fullInstructions.trim()}`);
    }

    // Notes
    if (assignment.noteText && assignment.noteText.trim()) {
      detailsSections.push(`\nPersonal Notes:\n${assignment.noteText.trim()}`);
    }

    // Resource link
    if (assignment.mediaUrl && assignment.mediaUrl.trim()) {
      detailsSections.push(`\nResource Link:\n${assignment.mediaUrl.trim()}`);
    }

    detailsSections.push('\nManaged with CoursePal');

    return this.buildEventUrl({
      title: eventTitle,
      startDate: allDay ? finalStartDate : timedStart!,
      endDate: allDay ? undefined : timedEnd!,
      allDay,
      details: detailsSections.join('\n'),
      location: courseDisplayName
    });
  }

  /**
   * Builds the Google Calendar URL for a Reading.
   */
  public static buildReadingEventUrl(
    reading: Reading,
    course?: Course | null,
    fallbackDate?: Date | string | null
  ): string {
    const courseCode = reading.courseCode || course?.courseCode || course?.courseName || 'Course';
    const rawAuth = reading.authorName?.trim() || '';
    const resolvedAuth = resolveFullAuthorName(rawAuth) || rawAuth;

    const dispTitle = formatDisplayTitleWithChapter(
      reading,
      reading.chapterText,
      reading.resourceTitle,
      course?.courseName,
      resolvedAuth
    );
    const eventTitle = `[${courseCode}] Reading: ${dispTitle}`;

    // Resolve date
    let resolvedDate: Date | null = null;
    if (fallbackDate instanceof Date) {
      resolvedDate = fallbackDate;
    } else if (typeof fallbackDate === 'string' && fallbackDate.trim()) {
      const range = this.parseEventDateRange(fallbackDate);
      if (range) resolvedDate = range.startDate;
    }
    if (!resolvedDate && reading.dueDate) {
      resolvedDate = parseSafeDate(reading.dueDate);
    } else if (!resolvedDate && reading.dateRangeStr) {
      const range = this.parseEventDateRange(reading.dateRangeStr);
      if (range) resolvedDate = range.startDate;
    } else if (course?.weeks) {
      const targetWk = reading.weekNumber || (reading.weekId && /\d+/.test(reading.weekId) ? parseInt(reading.weekId.match(/\d+/)![0], 10) : null);
      if (targetWk) {
        const w = course.weeks.find(wItem => wItem.weekNumber === targetWk);
        if (w?.startDate) resolvedDate = parseSafeDate(w.startDate);
        else if (w?.dateRangeStr) {
          const range = this.parseEventDateRange(w.dateRangeStr);
          if (range) resolvedDate = range.startDate;
        }
      }
    }

    const finalStartDate = resolvedDate || new Date();

    // Details body
    const detailsSections: string[] = [];
    const courseDisplayName = course?.courseName
      ? `${course.courseName} (${courseCode})`
      : courseCode;
    detailsSections.push(`Course: ${courseDisplayName}`);
    detailsSections.push(`Reading: ${reading.title}`);

    if (resolvedAuth) {
      detailsSections.push(`Author: ${resolvedAuth}`);
    }

    if (reading.chapterText) {
      const cleanCh = cleanChapterFromRaw(reading.chapterText);
      if (cleanCh) detailsSections.push(`Chapter: ${cleanCh}`);
    }

    if (reading.pagesText) {
      detailsSections.push(`Pages: ${reading.pagesText}`);
    }

    const scheduleParts: string[] = [];
    if (reading.weekNumber && reading.weekNumber > 0) {
      scheduleParts.push(`Week ${reading.weekNumber}`);
    }
    if (reading.moduleNumber && reading.moduleNumber > 0) {
      scheduleParts.push(`Module ${reading.moduleNumber}`);
    } else if (reading.moduleMention) {
      scheduleParts.push(reading.moduleMention);
    }
    if (scheduleParts.length > 0) {
      detailsSections.push(`Schedule: ${scheduleParts.join(' · ')}`);
    }

    const reqType = reading.isRequired === false || reading.requirementType === 'optional'
      ? 'Optional Reading'
      : 'Required Reading';
    detailsSections.push(`Requirement: ${reqType}`);

    if (reading.relevantTopics && reading.relevantTopics.trim()) {
      detailsSections.push(`Focus Theme: ${reading.relevantTopics.trim()}`);
    }

    if (reading.summaryText && reading.summaryText.trim()) {
      detailsSections.push(`\nSummary:\n${reading.summaryText.trim()}`);
    }
    if (reading.keyTakeawaysText && reading.keyTakeawaysText.trim()) {
      detailsSections.push(`\nKey Takeaways:\n${reading.keyTakeawaysText.trim()}`);
    }


    const resourceUrl = (reading as any).mediaUrl || reading.videoUrl;
    if (resourceUrl) {
      detailsSections.push(`\nResource URL:\n${resourceUrl.trim()}`);
    }

    detailsSections.push('\nManaged with CoursePal');

    return this.buildEventUrl({
      title: eventTitle,
      startDate: finalStartDate,
      allDay: true,
      details: detailsSections.join('\n'),
      location: courseDisplayName
    });
  }

  /**
   * Builds the Google Calendar URL for an entire Module.
   */
  public static buildModuleEventUrl(params: {
    moduleNumber: number;
    moduleLabel?: string | null;
    theme?: string | null;
    readings: Reading[];
    assignments?: Assignment[];
    course?: Course | null;
    dateRangeStr?: string | null;
    startDate?: Date | string | null;
  }): string {

    const courseCode = params.course?.courseCode || params.course?.courseName || 'Course';
    const modLabel = params.moduleLabel || `Module ${params.moduleNumber}`;
    const cleanTheme = params.theme ? `: ${params.theme}` : '';
    const eventTitle = `[${courseCode}] ${modLabel}${cleanTheme}`;

    // Resolve date range for the module
    let startDate: Date = new Date();
    let endDate: Date | undefined;

    if (params.dateRangeStr && isRealDateOrRangeString(params.dateRangeStr)) {
      const range = this.parseEventDateRange(params.dateRangeStr);
      if (range) {
        startDate = range.startDate;
        endDate = range.endDate;
      }
    } else if (params.startDate) {
      const parsed = parseSafeDate(params.startDate);
      if (parsed) startDate = parsed;
    } else {
      // Look up readings in this module for date hints
      const readingWithDate = params.readings.find(r => r.dueDate || r.dateRangeStr);
      if (readingWithDate) {
        if (readingWithDate.dateRangeStr) {
          const range = this.parseEventDateRange(readingWithDate.dateRangeStr);
          if (range) {
            startDate = range.startDate;
            endDate = range.endDate;
          }
        } else if (readingWithDate.dueDate) {
          const parsed = parseSafeDate(readingWithDate.dueDate);
          if (parsed) startDate = parsed;
        }
      }
    }

    // Build details body
    const detailsSections: string[] = [];
    const courseDisplayName = params.course?.courseName
      ? `${params.course.courseName} (${courseCode})`
      : courseCode;

    detailsSections.push(`Course: ${courseDisplayName}`);
    detailsSections.push(`Module: ${modLabel}`);
    if (params.theme) {
      detailsSections.push(`Focus Theme: ${params.theme}`);
    }
    if (params.dateRangeStr) {
      detailsSections.push(`Dates: ${params.dateRangeStr}`);
    }

    // Readings summary
    if (params.readings.length > 0) {
      const readingLines = params.readings.map(r => {
        const rawAuth = r.authorName?.trim() || '';
        const auth = resolveFullAuthorName(rawAuth) || rawAuth;
        const ch = r.chapterText ? ` (${cleanChapterFromRaw(r.chapterText)})` : '';
        const authorPart = auth ? `${auth}: ` : '';
        return `• ${authorPart}${r.title}${ch}`;
      });
      detailsSections.push(`\nReadings (${params.readings.length}):\n${readingLines.join('\n')}`);
    }

    // Assignments summary
    const moduleAssignments = params.assignments?.filter(
      a => !a.isDeleted && (a.moduleNumber === params.moduleNumber || (a.moduleMention && a.moduleMention.includes(String(params.moduleNumber))))
    ) || [];

    if (moduleAssignments.length > 0) {
      const assignLines = moduleAssignments.map(a => {
        const pts = a.pointsPossible ? ` · ${a.pointsPossible}` : '';
        const wt = a.weightPercentage ? ` · ${a.weightPercentage}` : '';
        return `• ${cleanAssignmentTitle(a.title)}${wt}${pts}`;
      });
      detailsSections.push(`\nAssignments & Deliverables (${moduleAssignments.length}):\n${assignLines.join('\n')}`);
    }

    detailsSections.push('\nManaged with CoursePal');

    return this.buildEventUrl({
      title: eventTitle,
      startDate,
      endDate,
      allDay: true,
      details: detailsSections.join('\n'),
      location: courseDisplayName
    });
  }

  /**
   * Launches Google Calendar directly on the assignment's due date in Day View,
   * while copying the assignment title, rubric criteria, points, and instructions
   * to the device clipboard so the user can easily paste into their schedule.
   */
  public static async syncAssignment(
    assignment: Assignment,
    course?: Course | null,
    overrideDate?: Date | null
  ): Promise<boolean> {
    try {
      // 1. Resolve exact date
      let resolvedDate: Date | null = overrideDate || (assignment.dueDate ? parseSafeDate(assignment.dueDate) : null);
      if (!resolvedDate && (assignment as any).dateRangeStr) {
        const range = this.parseEventDateRange((assignment as any).dateRangeStr);
        if (range) resolvedDate = range.startDate;
      }
      if (!resolvedDate && course?.weeks) {
        if (assignment.weekNumber && assignment.weekNumber > 0) {
          const matchedWeek = course.weeks.find(w => w.weekNumber === assignment.weekNumber);
          if (matchedWeek?.startDate) resolvedDate = parseSafeDate(matchedWeek.startDate);
          else if (matchedWeek?.dateRangeStr) {
            const range = this.parseEventDateRange(matchedWeek.dateRangeStr);
            if (range) resolvedDate = range.startDate;
          }
        } else if (assignment.moduleNumber && assignment.moduleNumber > 0) {
          const matchedWeek = course.weeks.find(w => w.moduleNumber === assignment.moduleNumber);
          if (matchedWeek?.startDate) resolvedDate = parseSafeDate(matchedWeek.startDate);
          else if (matchedWeek?.dateRangeStr) {
            const range = this.parseEventDateRange(matchedWeek.dateRangeStr);
            if (range) resolvedDate = range.startDate;
          }
        }
      }

      const finalDate = resolvedDate || new Date();

      // 2. Pre-fill clipboard with rich details so the user can paste into the event on that date
      const courseCode = assignment.courseCode || course?.courseCode || course?.courseName || 'Course';
      const cleanTitle = cleanAssignmentTitle(assignment.title);
      const detailsLines: string[] = [`[${courseCode}] Due: ${cleanTitle}`];
      if (assignment.pointsPossible) detailsLines.push(`Points: ${assignment.pointsPossible}`);
      if (assignment.weightPercentage) detailsLines.push(`Weight: ${assignment.weightPercentage}`);
      if (assignment.fullInstructions && assignment.fullInstructions.trim()) {
        detailsLines.push(`\nInstructions:\n${assignment.fullInstructions.trim()}`);
      }
      if (assignment.noteText && assignment.noteText.trim()) {
        detailsLines.push(`\nNotes:\n${assignment.noteText.trim()}`);
      }

      try {
        Clipboard.setString(detailsLines.join('\n'));
      } catch {}

      // 3. Open Google Calendar directly to that date in Day View
      return await this.openDateInGoogleCalendar(finalDate);
    } catch {
      Alert.alert(
        'Unable to Open Google Calendar',
        'Could not open Google Calendar on this device. Please check your internet connection or browser settings.'
      );
      return false;
    }
  }

  /**
   * Launches Google Calendar directly on the reading's scheduled date in Day View,
   * while copying the reading title, author, chapter, pages, and key takeaways
   * to the device clipboard so the user can easily paste into their schedule.
   */
  public static async syncReading(
    reading: Reading,
    course?: Course | null,
    fallbackDate?: Date | string | null
  ): Promise<boolean> {
    try {
      // 1. Resolve exact date
      let resolvedDate: Date | null = null;
      if (fallbackDate instanceof Date) {
        resolvedDate = fallbackDate;
      } else if (typeof fallbackDate === 'string' && fallbackDate.trim()) {
        const range = this.parseEventDateRange(fallbackDate);
        if (range) resolvedDate = range.startDate;
      }
      if (!resolvedDate && reading.dueDate) {
        resolvedDate = parseSafeDate(reading.dueDate);
      } else if (!resolvedDate && reading.dateRangeStr) {
        const range = this.parseEventDateRange(reading.dateRangeStr);
        if (range) resolvedDate = range.startDate;
      } else if (course?.weeks) {
        const targetWk = reading.weekNumber || (reading.weekId && /\d+/.test(reading.weekId) ? parseInt(reading.weekId.match(/\d+/)![0], 10) : null);
        if (targetWk) {
          const w = course.weeks.find(wItem => wItem.weekNumber === targetWk);
          if (w?.startDate) resolvedDate = parseSafeDate(w.startDate);
          else if (w?.dateRangeStr) {
            const range = this.parseEventDateRange(w.dateRangeStr);
            if (range) resolvedDate = range.startDate;
          }
        }
      }

      const finalDate = resolvedDate || new Date();

      // 2. Pre-fill clipboard with reading details
      const courseCode = reading.courseCode || course?.courseCode || course?.courseName || 'Course';
      const rawAuth = reading.authorName?.trim() || '';
      const resolvedAuth = resolveFullAuthorName(rawAuth) || rawAuth;
      const dispTitle = formatDisplayTitleWithChapter(
        reading,
        reading.chapterText,
        reading.resourceTitle,
        course?.courseName,
        resolvedAuth
      );
      const detailsLines: string[] = [`[${courseCode}] Reading: ${dispTitle}`];
      if (resolvedAuth) detailsLines.push(`Author: ${resolvedAuth}`);
      if (reading.chapterText) {
        const cleanCh = cleanChapterFromRaw(reading.chapterText);
        if (cleanCh) detailsLines.push(`Chapter: ${cleanCh}`);
      }
      if (reading.pagesText) detailsLines.push(`Pages: ${reading.pagesText}`);
      if (reading.summaryText && reading.summaryText.trim()) {
        detailsLines.push(`\nSummary:\n${reading.summaryText.trim()}`);
      }
      if (reading.keyTakeawaysText && reading.keyTakeawaysText.trim()) {
        detailsLines.push(`\nKey Takeaways:\n${reading.keyTakeawaysText.trim()}`);
      }

      try {
        Clipboard.setString(detailsLines.join('\n'));
      } catch {}

      // 3. Open Google Calendar directly to that date in Day View
      return await this.openDateInGoogleCalendar(finalDate);
    } catch {
      Alert.alert(
        'Unable to Open Google Calendar',
        'Could not open Google Calendar on this device. Please check your internet connection or browser settings.'
      );
      return false;
    }
  }

  /**
   * Launches Google Calendar directly on the module's start date in Day View,
   * while copying the module overview, readings list, and deliverables to the clipboard.
   */
  public static async syncModule(params: {
    moduleNumber: number;
    moduleLabel?: string | null;
    theme?: string | null;
    readings: Reading[];
    assignments?: Assignment[];
    course?: Course | null;
    dateRangeStr?: string | null;
    startDate?: Date | string | null;
  }): Promise<boolean> {
    try {
      // 1. Resolve date
      let startDate: Date = new Date();
      if (params.dateRangeStr && isRealDateOrRangeString(params.dateRangeStr)) {
        const range = this.parseEventDateRange(params.dateRangeStr);
        if (range) startDate = range.startDate;
      } else if (params.startDate) {
        const parsed = parseSafeDate(params.startDate);
        if (parsed) startDate = parsed;
      } else {
        const readingWithDate = params.readings.find(r => r.dueDate || r.dateRangeStr);
        if (readingWithDate) {
          if (readingWithDate.dateRangeStr) {
            const range = this.parseEventDateRange(readingWithDate.dateRangeStr);
            if (range) startDate = range.startDate;
          } else if (readingWithDate.dueDate) {
            const parsed = parseSafeDate(readingWithDate.dueDate);
            if (parsed) startDate = parsed;
          }
        }
      }

      // 2. Pre-fill clipboard with module details
      const courseCode = params.course?.courseCode || params.course?.courseName || 'Course';
      const modLabel = params.moduleLabel || `Module ${params.moduleNumber}`;
      const detailsLines: string[] = [`[${courseCode}] ${modLabel}${params.theme ? `: ${params.theme}` : ''}`];
      if (params.dateRangeStr) detailsLines.push(`Dates: ${params.dateRangeStr}`);
      if (params.readings.length > 0) {
        detailsLines.push(`\nReadings (${params.readings.length}):`);
        params.readings.forEach(r => detailsLines.push(`• ${r.title}`));
      }

      try {
        Clipboard.setString(detailsLines.join('\n'));
      } catch {}

      // 3. Open Google Calendar directly to that date in Day View
      return await this.openDateInGoogleCalendar(startDate);
    } catch {
      Alert.alert(
        'Unable to Open Google Calendar',
        'Could not open Google Calendar on this device. Please check your internet connection or browser settings.'
      );
      return false;
    }
  }

  /**
   * Constructs a URL that opens Google Calendar directly on a specific date in Day View.
   * Universal URL format: https://calendar.google.com/calendar/u/0/r/day/YYYY/MM/DD
   * Strictly enforces 4-digit year, 2-digit zero-padded month, and 2-digit zero-padded day
   * to ensure Google Calendar's route regex matches without falling back to today.
   */
  public static buildDayViewUrl(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const validDate = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
    const y = validDate.getFullYear();
    const m = pad(validDate.getMonth() + 1);
    const d = pad(validDate.getDate());
    return `https://calendar.google.com/calendar/u/0/r/day/${y}/${m}/${d}`;
  }

  /**
   * Opens Google Calendar directly on a specific date in Day View,
   * allowing the user to view that day's schedule and enter new items directly.
   */
  public static async openDateInGoogleCalendar(date: Date): Promise<boolean> {
    const rawDate = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
    // Pin to local noon to avoid any timezone boundary offset when converting to seconds
    const validDate = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate(), 12, 0, 0);

    try {
      const url = this.buildDayViewUrl(validDate);
      await Linking.openURL(url);
      return true;
    } catch {
      Alert.alert(
        'Unable to Open Google Calendar',
        'Could not open Google Calendar on this device. Please check your internet connection or browser settings.'
      );
      return false;
    }
  }

  /**
   * Opens the calendar application directly on a specific date.
   * Universal implementation opens Google Calendar Day View route.
   */
  public static async openDateInCalendar(date: Date): Promise<boolean> {
    return await this.openDateInGoogleCalendar(date);
  }

  /**
   * Constructs a URL to open a blank or pre-titled new event creation dialog on a specific date.
   */
  public static buildNewEventOnDateUrl(date: Date, title?: string): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const startStr = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
    const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const endStr = `${nextDay.getFullYear()}${pad(nextDay.getMonth() + 1)}${pad(nextDay.getDate())}`;

    const queryParts = [
      'action=TEMPLATE',
      `dates=${startStr}/${endStr}`
    ];

    if (title && title.trim()) {
      queryParts.push(`text=${encodeURIComponent(title.trim())}`);
    }

    return `https://calendar.google.com/calendar/render?${queryParts.join('&')}`;
  }

  /**
   * Opens Google Calendar to create a new event directly on a specific date.
   */
  public static async openNewEventOnDate(date: Date, title?: string): Promise<boolean> {
    try {
      const url = this.buildNewEventOnDateUrl(date, title);
      await Linking.openURL(url);
      return true;
    } catch {
      Alert.alert(
        'Unable to Open Calendar',
        'Could not open Calendar on this device.'
      );
      return false;
    }
  }
}

