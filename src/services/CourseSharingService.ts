/**
 * CourseSharingService
 * Compact URL-safe base64url serialization, compression, and invite link generation.
 * 1:1 match with Swift CourseSharingService
 */

import { CourseDTO } from '../types/models';

function utf8ToBase64(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64');
  }
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf-8');
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return base64;
}

export class CourseSharingService {
  private static _instance: CourseSharingService;
  public static get shared(): CourseSharingService {
    if (!this._instance) {
      this._instance = new CourseSharingService();
    }
    return this._instance;
  }

  /**
   * Static helper for direct URL generation
   */
  public static generateShareUrl(course: CourseDTO | any): string {
    return CourseSharingService.shared.generateShareLink(course);
  }

  /**
   * Converts a Course object (with its weeks, readings, assignments) to a CourseDTO
   */
  public courseToDTO(course: any): CourseDTO {
    return {
      id: course.id,
      creatorId: course.creatorId,
      courseName: course.courseName,
      courseCode: course.courseCode,
      courseDescription: course.courseDescription,
      instructorName: course.instructorName,
      instructorEmail: course.instructorEmail,
      termWeeks: course.termWeeks,
      sharingCode: course.sharingCode,
      weeks: (course.weeks || []).map((w: any) => ({
        id: w.id,
        weekNumber: w.weekNumber,
        theme: w.theme,
        startDate: w.startDate ? (w.startDate instanceof Date ? w.startDate.toISOString() : String(w.startDate)) : null,
        readings: (w.readings || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          authorName: r.authorName,
          resourceTitle: r.resourceTitle,
          mediaType: r.mediaType || r.mediaTypeRaw,
          isCompleted: Boolean(r.isCompleted),
          summaryText: r.summaryText || '',
          keyTakeawaysText: r.keyTakeawaysText || '',
          estimatedTimeText: r.estimatedTimeText || '',
          videoUrl: r.videoUrl || null,
          chapterText: r.chapterText || null,
          pagesText: r.pagesText || null,
          dueDate: r.dueDate ? (r.dueDate instanceof Date ? r.dueDate.toISOString() : String(r.dueDate)) : null,
          relevantTopics: r.relevantTopics || null
        }))
      })),
      assignments: (course.assignments || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        dueDate: a.dueDate ? (a.dueDate instanceof Date ? a.dueDate.toISOString() : String(a.dueDate)) : null,
        fullInstructions: a.fullInstructions,
        pointsPossible: a.pointsPossible,
        weightPercentage: a.weightPercentage,
        noteText: a.noteText,
        pointsBreakdown: a.pointsBreakdown,
        relevantTopics: a.relevantTopics,
        mediaUrl: a.mediaUrl,
        rubric: a.rubricCriteria || a.rubric || null,
        isCompleted: Boolean(a.isCompleted)
      }))
    };
  }

  /**
   * Encodes a Course or CourseDTO into a compact base64url payload
   */
  public encodeCourseToPayload(course: CourseDTO | any): string {
    const dto = (course.weeks && course.weeks[0]?.readings !== undefined) || course.assignments !== undefined
      ? this.courseToDTO(course)
      : (course as CourseDTO);
    const jsonStr = JSON.stringify(dto);
    const base64 = utf8ToBase64(jsonStr);
    return toBase64Url(base64);
  }

  /**
   * Decodes a CourseDTO from a URL, raw base64url token, or JSON string
   */
  public decodeCourse(input: string): CourseDTO | null {
    const raw = input.trim();
    if (!raw) return null;

    // 1. Direct JSON String
    if (raw.startsWith('{') && raw.includes('courseName')) {
      try {
        return JSON.parse(raw) as CourseDTO;
      } catch {
        // continue
      }
    }

    // 2. Extract 'data=' parameter from URL if present
    let payloadToDecode = raw;
    if (raw.toLowerCase().includes('data=')) {
      const parts = raw.split(/[?&#]/);
      for (const part of parts) {
        if (part.toLowerCase().startsWith('data=')) {
          payloadToDecode = part.substring(5);
          break;
        }
      }
    }

    try {
      const base64 = fromBase64Url(payloadToDecode);
      const jsonStr = base64ToUtf8(base64);
      return JSON.parse(jsonStr) as CourseDTO;
    } catch {
      return null;
    }
  }

  /**
   * Generates web shareable link
   */
  public generateShareLink(course: CourseDTO | any): string {
    const code = course.sharingCode || course.courseCode || 'CRS';
    const payload = this.encodeCourseToPayload(course);
    return `https://classpal.app/join?code=${encodeURIComponent(code)}&data=${payload}`;
  }

  /**
   * Generates formatted invite text
   */
  public generateShareMessage(course: CourseDTO | any): string {
    const code = course.sharingCode || course.courseCode || 'CRS';
    const link = this.generateShareLink(course);
    const readingsCount = (course.weeks ?? []).reduce((acc: number, w: any) => acc + (w.readings?.length ?? 0), 0);
    const assignmentsCount = course.assignments?.length ?? 0;

    return `Join '${course.courseName}' on CoursePal!\n\n📋 Course Code: ${code}\n📖 ${readingsCount} Readings • 📝 ${assignmentsCount} Assignments\n\nTap the link to enroll in one click:\n${link}`;
  }
}
