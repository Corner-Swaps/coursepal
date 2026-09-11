/**
 * CalendarExportService
 * Parity with native iOS CalendarSyncService.swift & RFC 5545 iCalendar standard.
 * Exports assignments, readings, and entire course schedules to Apple Calendar / Google Calendar (.ics).
 */

import { Share, Platform } from 'react-native';
import { Assignment, Reading, Course } from '../types/models';
import { parseSafeDate } from '../utils/readingDisplayHelper';

export class CalendarExportService {
  /**
   * Formats a JavaScript Date into iCalendar UTC timestamp format: YYYYMMDDTHHMMSSZ
   */
  private static formatICSDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getUTCFullYear();
    const m = pad(date.getUTCMonth() + 1);
    const d = pad(date.getUTCDate());
    const h = pad(date.getUTCHours());
    const min = pad(date.getUTCMinutes());
    const s = pad(date.getUTCSeconds());
    return `${y}${m}${d}T${h}${min}${s}Z`;
  }

  /**
   * Cleans text for iCalendar description / summary fields (escapes commas, semicolons, backslashes)
   */
  private static escapeICSText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  /**
   * Generates a single VEVENT block for an assignment or reading
   */
  public static generateVEvent(params: {
    uid: string;
    title: string;
    courseCode: string;
    dueDate: Date;
    description?: string;
    location?: string;
  }): string {
    const dtstamp = this.formatICSDate(new Date());
    // Schedule deadline for 1 hour duration ending at due date
    const endDate = new Date(params.dueDate);
    const startDate = new Date(endDate.getTime() - 60 * 60 * 1000);

    const dtStart = this.formatICSDate(startDate);
    const dtEnd = this.formatICSDate(endDate);

    const summary = this.escapeICSText(`[${params.courseCode}] ${params.title}`);
    const desc = this.escapeICSText(params.description || `Managed by CoursePal Academic Planner`);
    const loc = this.escapeICSText(params.location || 'University Campus / Online');

    return [
      'BEGIN:VEVENT',
      `UID:${params.uid}@coursepal.app`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${loc}`,
      'STATUS:CONFIRMED',
      // Alarm 1: 24 Hours Before
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder: 24 hours until due',
      'END:VALARM',
      // Alarm 2: 2 Hours Before
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder: 2 hours until due',
      'END:VALARM',
      'END:VEVENT'
    ].join('\r\n');
  }

  /**
   * Wraps VEVENT block(s) into complete VCALENDAR file content
   */
  public static wrapVCalendar(vevents: string[]): string {
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CoursePal//Academic Companion//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...vevents,
      'END:VCALENDAR'
    ].join('\r\n');
  }

  /**
   * Generates .ics file content for an Assignment
   */
  public static createAssignmentICS(assignment: Assignment, courseName?: string): string {
    const rawDate = parseSafeDate(assignment.dueDate) || new Date();
    const details = [
      `Course: ${courseName || assignment.courseCode || 'Academic Course'}`,
      assignment.pointsPossible ? `Points: ${assignment.pointsPossible}` : null,
      assignment.weightPercentage ? `Weight: ${assignment.weightPercentage}` : null,
      assignment.fullInstructions ? `Instructions: ${assignment.fullInstructions}` : null,
      assignment.noteText ? `Personal Notes: ${assignment.noteText}` : null
    ]
      .filter(Boolean)
      .join('\n');

    const vevent = this.generateVEvent({
      uid: `assignment-${assignment.id}`,
      title: assignment.title,
      courseCode: assignment.courseCode || 'Course',
      dueDate: rawDate,
      description: details
    });

    return this.wrapVCalendar([vevent]);
  }

  /**
   * Generates .ics file content for a Reading
   */
  public static createReadingICS(reading: Reading, courseName?: string): string {
    const rawDate = parseSafeDate(reading.dueDate) || new Date();
    const details = [
      `Course: ${courseName || reading.courseCode || 'Academic Course'}`,
      reading.authorName ? `Author: ${reading.authorName}` : null,
      reading.chapterText ? `Chapter: ${reading.chapterText}` : null,
      reading.pagesText ? `Pages: ${reading.pagesText}` : null,
      reading.resourceTitle ? `Source: ${reading.resourceTitle}` : null,
      reading.summaryText ? `Notes: ${reading.summaryText}` : null
    ]
      .filter(Boolean)
      .join('\n');

    const vevent = this.generateVEvent({
      uid: `reading-${reading.id}`,
      title: reading.title,
      courseCode: reading.courseCode || 'Course',
      dueDate: rawDate,
      description: details
    });

    return this.wrapVCalendar([vevent]);
  }

  /**
   * Generates a full semester course .ics schedule
   */
  public static createCourseScheduleICS(
    course: Course,
    assignments: Assignment[],
    readings: Reading[]
  ): string {
    const courseCodeKey = (course.courseCode || course.courseName).toLowerCase();
    const vevents: string[] = [];

    // Add assignments with due dates
    const courseAssigns = assignments.filter(
      a =>
        !a.isDeleted &&
        a.dueDate &&
        (a.courseId === course.id || (a.courseCode || '').toLowerCase() === courseCodeKey)
    );
    for (const a of courseAssigns) {
      const d = parseSafeDate(a.dueDate);
      if (!d) continue;
      vevents.push(
        this.generateVEvent({
          uid: `assign-${a.id}`,
          title: a.title,
          courseCode: course.courseCode || course.courseName,
          dueDate: d,
          description: `Assignment for ${course.courseName}. Points: ${a.pointsPossible || 'N/A'}`
        })
      );
    }

    // Add readings with due dates
    const courseReadings = readings.filter(
      r => !r.isDeleted && r.dueDate && (r.courseCode || '').toLowerCase() === courseCodeKey
    );
    for (const r of courseReadings) {
      const d = parseSafeDate(r.dueDate);
      if (!d) continue;
      vevents.push(
        this.generateVEvent({
          uid: `reading-${r.id}`,
          title: r.title,
          courseCode: course.courseCode || course.courseName,
          dueDate: d,
          description: `Reading for ${course.courseName}. ${r.chapterText || ''}`
        })
      );
    }

    return this.wrapVCalendar(vevents);
  }

  /**
   * Exports and shares .ics file via native iOS Share Sheet
   */
  public static async exportAndShareICS(
    filename: string,
    icsContent: string,
    subjectTitle: string
  ): Promise<boolean> {
    try {
      let fileUri: string | null = null;
      try {
        const FileSystem = require('expo-file-system');
        if (FileSystem && FileSystem.cacheDirectory) {
          const cleanFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
          const finalPath = `${FileSystem.cacheDirectory}${cleanFilename}.ics`;
          await FileSystem.writeAsStringAsync(finalPath, icsContent, {
            encoding: FileSystem.EncodingType?.UTF8 || 'utf8'
          });
          fileUri = finalPath;
        }
      } catch {
        fileUri = null;
      }

      if (fileUri && Platform.OS === 'ios') {
        await Share.share(
          {
            title: subjectTitle,
            url: fileUri
          },
          {
            subject: subjectTitle
          }
        );
      } else {
        await Share.share({
          title: subjectTitle,
          message: icsContent
        });
      }

      return true;
    } catch {
      return false;
    }
  }
}
