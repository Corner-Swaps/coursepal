/**
 * SyllabusImportManager
 * Production service orchestrating syllabus document normalization, validation,
 * deduplication, honest outcome reporting, and persistence reconciliation.
 */

import {
  Course,
  Reading,
  Assignment,
  Week,
  VaultDocument,
  MediaType,
  ImportOutcome,
  TextbookResource,
  RubricCriterionDTO
} from '../types/models';
import {
  cleanChapterFromRaw,
  isGenericPlaceholderReadingTitle,
  parseSafeDate
} from '../utils/readingDisplayHelper';

export interface RawAssignmentCandidate {
  title?: string;
  name?: string;
  assignmentName?: string;
  assignment_name?: string;
  deliverable?: string;
  dueDate?: string | null;
  due_date?: string | null;
  dueDateIso?: string | null;
  rawDueDate?: string | null;
  date?: string | null;
  pointsPossible?: string | null;
  points?: string | null;
  points_possible?: string | null;
  totalPoints?: string | null;
  weightPercentage?: string | null;
  weight?: string | null;
  weight_percentage?: string | null;
  percentage?: string | null;
  fullInstructions?: string | null;
  instructions?: string | null;
  description?: string | null;
  weekNumber?: number | null;
  week_number?: number | null;
  subType?: string | null;
  subTypeRaw?: string | null;
  category?: string | null;
  rubric?: RubricCriterionDTO[] | null;
  rubricCriteria?: RubricCriterionDTO[] | null;
  mediaUrl?: string | null;
  videoUrl?: string | null;
  url?: string | null;
  link?: string | null;
  noteText?: string | null;
  moduleMention?: string | null;
  courseCode?: string | null;
  course_code?: string | null;
  pointsBreakdown?: string | null;
}

export interface RawReadingCandidate {
  title?: string;
  name?: string;
  readingTitle?: string;
  resourceTitle?: string;
  bookTitle?: string;
  authorName?: string | null;
  author?: string | null;
  authors?: string | null;
  chapterText?: string | null;
  chapter?: string | null;
  chapters?: string | null;
  chaptersOrPages?: string | null;
  pagesText?: string | null;
  pages?: string | null;
  mediaType?: string | null;
  videoUrl?: string | null;
  mediaUrl?: string | null;
  url?: string | null;
  link?: string | null;
  weekNumber?: number | null;
  week_number?: number | null;
  dueDate?: string | null;
  due_date?: string | null;
  summaryText?: string | null;
  keyTakeawaysText?: string | null;
  estimatedTimeText?: string | null;
  relevantTopics?: string | null;
}

export interface NormalizedSyllabusPayload {
  courseName?: string;
  courseCode?: string;
  courseDescription?: string;
  instructorName?: string;
  instructorEmail?: string;
  termWeeks?: number;
  termYear?: number | null;
  textbooks: TextbookResource[];
  candidateAssignments: RawAssignmentCandidate[];
  candidateReadings: RawReadingCandidate[];
  weekDateMap: Map<number, string>;
  weeks: {
    weekNumber: number;
    theme?: string;
    date?: string;
  }[];
  formatAccepted: string;
  isPartial: boolean;
  validationErrors: string[];
}

export interface ImportOutcomeDetails {
  outcome: ImportOutcome;
  success: boolean;
  message: string;
  isFallbackUsed: boolean;
  readingsCount: number;
  assignmentsCount: number;
  celebrationAllowed: boolean;
}

export type SyllabusPayloadInput = any;

export class SyllabusImportManager {
  private static _instance: SyllabusImportManager;
  public static get shared(): SyllabusImportManager {
    if (!this._instance) {
      this._instance = new SyllabusImportManager();
    }
    return this._instance;
  }

  public static normalizeAndValidateSyllabusPayload(rawDto: any, rawTextContext?: string) {
    return SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(rawDto, rawTextContext);
  }

  public static deduplicateReadings(
    rawReadings: RawReadingCandidate[],
    textbooks: TextbookResource[] = [],
    courseYear?: number | null
  ) {
    return SyllabusImportManager.shared.deduplicateReadings(rawReadings, textbooks, courseYear);
  }

  public static deduplicateAssignments(rawAssignments: RawAssignmentCandidate[], courseYear?: number | null) {
    return SyllabusImportManager.shared.deduplicateAssignments(rawAssignments, courseYear);
  }

  public static determineImportOutcome(params: {
    fileName: string;
    hasReadablePayload: boolean;
    isApiSuccess: boolean;
    isFallbackUsed: boolean;
    isPartial: boolean;
    readingsCount: number;
    assignmentsCount: number;
    saveSuccess: boolean;
    errorMessage?: string;
  }) {
    return SyllabusImportManager.shared.determineImportOutcome(params);
  }

  public static mergeReimportedCourse(params: {
    targetCourseId: string;
    existingCourses: Course[];
    existingReadings: Reading[];
    existingAssignments: Assignment[];
    existingVaultDocs: VaultDocument[];
    newCourseData: Partial<Course>;
    newReadings: Reading[];
    newAssignments: Assignment[];
    newVaultDoc: VaultDocument;
  }) {
    return SyllabusImportManager.shared.mergeReimportedCourse(params);
  }

  public static repairTruncatedJson(str: string): any | null {
    return SyllabusImportManager.shared.tryRepairTruncatedJson(str);
  }

  /**
   * 1. Normalize and validate raw AI response or parser DTO before deciding whether extraction succeeded.
   * Supports: items, readings, assignments, deliverables, and nested weeks.
   * An items-only response is NOT discarded.
   * Disallows inventing points (no '100 Points') or year (no fallback 2026).
   */
  public normalizeAndValidateSyllabusPayload(
    rawDto: any,
    rawTextContext?: string
  ): NormalizedSyllabusPayload {
    const validationErrors: string[] = [];

    let dto = rawDto;
    if (typeof dto === 'string') {
      const trimmed = dto.trim();
      let clean = trimmed;
      if (clean.startsWith('```')) {
        clean = clean.split('\n').slice(1).join('\n');
        if (clean.endsWith('```')) clean = clean.slice(0, -3).trim();
      }
      try {
        dto = JSON.parse(clean);
      } catch (err: any) {
        // Attempt truncated JSON repair if possible
        const repaired = this.tryRepairTruncatedJson(clean);
        if (repaired) {
          dto = repaired;
          validationErrors.push('Recovered partially truncated JSON payload.');
        } else {
          return {
            textbooks: [],
            candidateAssignments: [],
            candidateReadings: [],
            weekDateMap: new Map(),
            weeks: [],
            formatAccepted: 'malformed_json',
            isPartial: true,
            validationErrors: ['Failed to parse JSON response: ' + err.message]
          };
        }
      }
    }

    if (!dto || typeof dto !== 'object') {
      return {
        textbooks: [],
        candidateAssignments: [],
        candidateReadings: [],
        weekDateMap: new Map(),
        weeks: [],
        formatAccepted: 'invalid_type',
        isPartial: false,
        validationErrors: ['Extracted payload is not an object or array.']
      };
    }

    if (Array.isArray(dto)) {
      dto = dto[0] || {};
    }

    // Explicitly reject error objects from API
    if (dto.error || dto.errorMessage) {
      return {
        textbooks: [],
        candidateAssignments: [],
        candidateReadings: [],
        weekDateMap: new Map(),
        weeks: [],
        formatAccepted: 'error_response',
        isPartial: false,
        validationErrors: [dto.error?.message || dto.errorMessage || 'AI returned an error object.']
      };
    }

    const textbooks: TextbookResource[] = [];
    const candidateAssignments: RawAssignmentCandidate[] = [];
    const candidateReadings: RawReadingCandidate[] = [];
    const weeksSummary: { weekNumber: number; theme?: string; date?: string }[] = [];
    const weekDateMap = new Map<number, string>();

    let formatAccepted = 'standard';

    // Extract textbooks into resource catalog ONLY (do NOT add to candidateReadings)
    const rawTextbooks = Array.isArray(dto.textbooks)
      ? dto.textbooks
      : (Array.isArray(dto.resources) ? dto.resources : []);

    for (const tb of rawTextbooks) {
      if (!tb || typeof tb !== 'object') continue;
      const title = (tb.title || tb.name || tb.bookTitle || '').trim();
      if (!title) continue;
      const authorName = (tb.authorName || tb.author || tb.authors || null)?.trim() || null;
      const edition = (tb.edition || null)?.trim() || null;
      textbooks.push({ title, authorName, edition });
    }

    // Check for explicit term year (NO hardcoded 2026 fallback!)
    let termYear: number | null = null;
    if (typeof dto.termYear === 'number' && dto.termYear > 1900 && dto.termYear < 2100) {
      termYear = dto.termYear;
    } else if (typeof dto.termYear === 'string' && /^\d{4}$/.test(dto.termYear.trim())) {
      termYear = parseInt(dto.termYear.trim(), 10);
    } else if (rawTextContext) {
      const yearMatch = rawTextContext.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        termYear = parseInt(yearMatch[1], 10);
      }
    }

    // Process nested weeks
    if (Array.isArray(dto.weeks)) {
      for (const w of dto.weeks) {
        if (!w || typeof w !== 'object') continue;
        const wkNum = w.weekNumber || w.week_number;
        const rawDate = w.date || w.startDate || w.rawDate || w.dateRangeStr;
        if (typeof wkNum === 'number' && wkNum > 0) {
          weeksSummary.push({
            weekNumber: wkNum,
            theme: typeof w.theme === 'string' ? w.theme : undefined,
            date: typeof rawDate === 'string' ? rawDate : undefined
          });

          if (rawDate && typeof rawDate === 'string') {
            const parsed = parseSafeDate(rawDate, termYear || undefined);
            if (parsed) {
              weekDateMap.set(wkNum, parsed.toISOString().split('T')[0]);
            }
          }
        }

        // Nested readings
        if (Array.isArray(w.readings)) {
          for (const wr of w.readings) {
            if (wr && typeof wr === 'object') {
              candidateReadings.push({
                ...wr,
                weekNumber: wr.weekNumber || wr.week_number || wkNum,
                relevantTopics: wr.relevantTopics || w.theme
              });
            }
          }
        }

        // Nested assignments / deliverables
        const weekDeliverables = Array.isArray(w.assignments)
          ? w.assignments
          : (Array.isArray(w.deliverables) ? w.deliverables : []);
        for (const wa of weekDeliverables) {
          if (wa && typeof wa === 'object') {
            candidateAssignments.push({
              ...wa,
              weekNumber: wa.weekNumber || wa.week_number || wkNum
            });
          }
        }
      }
    }

    // Top-level assignments & deliverables
    if (Array.isArray(dto.assignments)) {
      for (const a of dto.assignments) {
        if (a && typeof a === 'object') candidateAssignments.push(a);
      }
    }
    if (Array.isArray(dto.deliverables)) {
      formatAccepted = 'deliverables_split';
      for (const d of dto.deliverables) {
        if (d && typeof d === 'object') candidateAssignments.push(d);
      }
    }

    // Top-level readings
    if (Array.isArray(dto.readings)) {
      for (const r of dto.readings) {
        if (r && typeof r === 'object') candidateReadings.push(r);
      }
    }

    // Items-only or generic items list (e.g. from local parser or alternate AI schema)
    if (Array.isArray(dto.items)) {
      if (candidateAssignments.length === 0 && candidateReadings.length === 0) {
        formatAccepted = 'items_only';
      }
      for (const item of dto.items) {
        if (!item || typeof item !== 'object') continue;
        const category = (item.category || item.type || '').toLowerCase();
        if (category === 'assignment' || category === 'deliverable' || category === 'paper' || category === 'exam') {
          candidateAssignments.push({
            title: item.title,
            fullInstructions: item.description || item.fullInstructions,
            pointsPossible: item.points || item.pointsPossible,
            weightPercentage: item.percentage || item.weightPercentage,
            dueDate: item.dueDateIso || item.dueDate,
            weekNumber: item.weekNumber,
            subType: item.subType,
            mediaUrl: item.mediaUrl,
            rubric: item.rubric
          });
        } else if (category === 'reading' || category === 'textbook' || category === 'media') {
          candidateReadings.push({
            title: item.title,
            authorName: item.authorName,
            resourceTitle: item.resourceTitle,
            chapterText: item.chapterText,
            pagesText: item.pagesText,
            mediaType: item.subType || item.mediaType,
            weekNumber: item.weekNumber,
            dueDate: item.dueDateIso || item.dueDate,
            videoUrl: item.mediaUrl || item.videoUrl,
            summaryText: item.summaryText || item.description,
            keyTakeawaysText: item.keyTakeaways,
            estimatedTimeText: item.estimatedTime,
            relevantTopics: item.relevantTopics
          });
        }
      }
    }

    // Completeness validation: If text context is extensive (> 2000 chars) but total tasks <= 1
    const totalExtracted = candidateAssignments.length + candidateReadings.length;
    let isPartial = false;
    if (rawTextContext && rawTextContext.length > 2000 && totalExtracted <= 1) {
      isPartial = true;
      validationErrors.push('Only 1 task extracted from a multi-page/large document.');
    }

    return {
      courseName: typeof dto.courseName === 'string' ? dto.courseName.trim() : undefined,
      courseCode: typeof dto.courseCode === 'string' ? dto.courseCode.trim() : undefined,
      courseDescription: typeof dto.courseDescription === 'string' ? dto.courseDescription.trim() : undefined,
      instructorName: typeof dto.instructorName === 'string' ? dto.instructorName.trim() : undefined,
      instructorEmail: typeof dto.instructorEmail === 'string' ? dto.instructorEmail.trim() : undefined,
      termWeeks: typeof dto.termWeeks === 'number' && dto.termWeeks > 0 ? dto.termWeeks : undefined,
      termYear,
      textbooks,
      candidateAssignments,
      candidateReadings,
      weekDateMap,
      weeks: weeksSummary,
      formatAccepted,
      isPartial,
      validationErrors
    };
  }

  /**
   * 2. Deduplicate readings without merging different books or uncertain matches.
   * Two books with Chapter 1 in Week 2 must remain separate.
   * Bibliography-only books are NOT converted into reading tasks.
   */
  public deduplicateReadings(
    candidates: RawReadingCandidate[],
    textbooks: TextbookResource[] = [],
    termYear?: number | null
  ): Reading[] {
    const cleanReadingsList: Reading[] = [];

    // Lookup table for textbook title and author resolution
    const textbookLookup = textbooks.filter(t => t.title && t.authorName);

    for (let i = 0; i < candidates.length; i++) {
      const r = candidates[i];
      let rawTitle = (r.title || r.name || r.readingTitle || r.resourceTitle || r.bookTitle || '').trim();
      if (
        !rawTitle ||
        rawTitle.toLowerCase().includes('required reading & core materials') ||
        isGenericPlaceholderReadingTitle(rawTitle)
      ) {
        continue;
      }

      // Extract direct video/media URL from fields or title
      let extractedVideoUrl: string | null = r.videoUrl || r.mediaUrl || r.url || r.link || null;
      const textToScan = `${rawTitle} ${r.resourceTitle || ''} ${r.summaryText || ''}`;
      const urlMatch = textToScan.match(/https?:\/\/[^\s)\]]+/i);
      if (urlMatch) {
        if (!extractedVideoUrl) extractedVideoUrl = urlMatch[0].replace(/[.,;:)]+$/, '');
        rawTitle = rawTitle.replace(/https?:\/\/[^\s)\]]+/gi, '').replace(/[:\-–\s]+$/, '').trim();
      }

      // Strip leading directives
      rawTitle = rawTitle.replace(/^(?:required:?\s*)?(?:watch:?\s*|listen:?\s*|read:?\s*|podcast:?\s*)/i, '').trim();

      const ch = (r.chapterText || r.chapter || r.chapters || r.chaptersOrPages || '').trim();
      const wk = (typeof r.weekNumber === 'number' && r.weekNumber > 0)
        ? r.weekNumber
        : (typeof r.week_number === 'number' && r.week_number > 0 ? r.week_number : 0);
      const cleanCh = cleanChapterFromRaw(ch || rawTitle);

      // Infer media type
      let detectedMediaType: MediaType = (r.mediaType as MediaType) || 'textbook';
      if (extractedVideoUrl) {
        if (/youtube\.com|youtu\.be|vimeo\.com|ted\.com\/talks/i.test(extractedVideoUrl)) {
          detectedMediaType = 'video';
        } else if (/podbean\.com|podcast|spotify\.com|apple\.com\/podcast/i.test(extractedVideoUrl)) {
          detectedMediaType = 'podcast';
        } else {
          detectedMediaType = 'article';
        }
      } else if (/\b(watch|youtube|vimeo|ted talk|documentary|film)\b/i.test(rawTitle)) {
        detectedMediaType = 'video';
      } else if (/\b(podcast|listen|audio)\b/i.test(rawTitle)) {
        detectedMediaType = 'podcast';
      }

      if (!rawTitle) {
        if (r.resourceTitle && !r.resourceTitle.startsWith('http')) {
          rawTitle = r.resourceTitle;
        } else {
          rawTitle = wk > 0 ? `Week ${wk} Reading` : 'Course Reading';
        }
      }

      // Resolve author and book identity
      let candidateAuthor = (r.authorName || r.author || r.authors || null)?.trim() || null;
      if (candidateAuthor) {
        if (
          /^(required|watch|read|reading|readings|author|null|undefined|none|see brightspace)$/i.test(candidateAuthor) ||
          candidateAuthor.toLowerCase().startsWith('required:') ||
          candidateAuthor.toLowerCase().startsWith('watch:')
        ) {
          candidateAuthor = null;
        }
      }

      const candidateResource = (r.resourceTitle || r.bookTitle || '').trim();

      // Cross-reference textbook lookup if author/book is missing
      let resolvedResource = candidateResource;
      if ((!candidateAuthor || !resolvedResource) && textbookLookup.length > 0) {
        const searchStr = `${rawTitle} ${candidateResource}`.toLowerCase();
        for (const tb of textbookLookup) {
          const cleanTbTitle = tb.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
          const words = cleanTbTitle.split(/\s+/).filter(w => w.length >= 4);
          const matchCount = words.filter(w => searchStr.includes(w)).length;
          if (matchCount >= 2 || searchStr.includes(cleanTbTitle)) {
            if (!candidateAuthor) candidateAuthor = tb.authorName || null;
            if (!resolvedResource) resolvedResource = tb.title;
            break;
          }
        }
      }

      // Safe explicit due date ONLY (do NOT invent class date as due date!)
      const parsedReadingDue = parseSafeDate(r.dueDate || r.due_date, termYear || undefined);

      // Distinct composite reading identity:
      // Must include: Week + Book/Resource identity + Chapter/Pages + substantive title
      const normBook = (resolvedResource || candidateAuthor || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const normCh = cleanCh ? cleanCh.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      const normPages = (r.pagesText || r.pages || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const normTitle = rawTitle.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Duplicate detection:
      // Merge ONLY if demonstrable duplicate:
      // 1. Same week AND identical mediaUrl (if URL present)
      // 2. Same week AND same book AND same chapter/pages
      // 3. Same week AND identical normalized title AND (same book or both without book)
      const existing = cleanReadingsList.find(existingR => {
        if (wk > 0 && (existingR.weekNumber || 0) !== wk) {
          return false; // Different scheduled weeks -> never merge!
        }
        // Identical non-empty media URL
        if (extractedVideoUrl && existingR.videoUrl && extractedVideoUrl === existingR.videoUrl) {
          return true;
        }
        const existingBook = (existingR.resourceTitle || existingR.authorName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const rawExistingCh = cleanChapterFromRaw(existingR.chapterText || existingR.title);
        const existingCh = rawExistingCh ? rawExistingCh.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const existingPages = (existingR.pagesText || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const existingTitle = existingR.title.toLowerCase().replace(/[^a-z0-9]/g, '');

        // If both have different identifiable books, DO NOT MERGE!
        if (normBook && existingBook && normBook !== existingBook) {
          return false;
        }

        // Same book, same chapter:
        if (normBook && existingBook && normBook === existingBook && normCh && existingCh && normCh === existingCh) {
          return true;
        }

        // Same title and same chapter:
        if (normTitle === existingTitle && (!normCh || !existingCh || normCh === existingCh)) {
          return true;
        }

        return false;
      });

      if (existing) {
        // Merge demonstrable duplicate and enrich
        if (!existing.authorName && candidateAuthor) existing.authorName = candidateAuthor;
        if (!existing.resourceTitle && resolvedResource) existing.resourceTitle = resolvedResource;
        if (!existing.videoUrl && extractedVideoUrl) {
          existing.videoUrl = extractedVideoUrl;
          existing.mediaType = detectedMediaType;
        }
        if (!existing.chapterText && (cleanCh || ch)) existing.chapterText = cleanCh || ch;
        if (!existing.pagesText && (r.pagesText || r.pages)) existing.pagesText = r.pagesText || r.pages;
        if (!existing.dueDate && parsedReadingDue) existing.dueDate = parsedReadingDue;
        continue;
      }

      cleanReadingsList.push({
        id: `r-${Date.now()}-${i}`,
        title: rawTitle,
        authorName: candidateAuthor,
        resourceTitle: resolvedResource || rawTitle,
        mediaTypeRaw: detectedMediaType,
        mediaType: detectedMediaType,
        isCompleted: false,
        isDeleted: false,
        summaryText: r.summaryText || '',
        keyTakeawaysText: r.keyTakeawaysText || `• Study ${rawTitle}`,
        estimatedTimeText: r.estimatedTimeText || (detectedMediaType === 'video' ? '~20 min watch' : '~45 min read'),
        dueDate: parsedReadingDue,
        dateRangeStr: parsedReadingDue
          ? parsedReadingDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : (wk > 0 ? `Week ${wk}` : null),
        chapterText: cleanCh || ch || null,
        pagesText: r.pagesText || r.pages || null,
        relevantTopics: r.relevantTopics || (wk > 0 ? `Week ${wk}` : null),
        isFavorite: false,
        weekId: wk > 0 ? `w-${wk}` : 'none',
        weekNumber: wk > 0 ? wk : null
      });
    }

    return cleanReadingsList;
  }

  /**
   * 3. Deduplicate assignments preserving recurring deliverables across weeks.
   * "Weekly Reflection" in Weeks 1, 2, and 3 must remain 3 assignments.
   * Missing points stay null (no '100 Points').
   * Week date is NOT fabricated into assignment deadline.
   */
  public deduplicateAssignments(
    candidates: RawAssignmentCandidate[],
    termYear?: number | null
  ): Assignment[] {
    const cleanAssignmentsList: Assignment[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const a = candidates[i];
      let rawTitle = (a.title || a.name || a.assignmentName || a.assignment_name || a.deliverable || '').trim();
      if (!rawTitle || rawTitle.toLowerCase() === 'item title' || rawTitle.toLowerCase().includes('total 100%')) {
        continue;
      }

      let assignMediaUrl = a.mediaUrl || a.videoUrl || a.url || a.link || null;
      const uMatch = (rawTitle + ' ' + (a.fullInstructions || '')).match(/https?:\/\/[^\s)\]]+/i);
      if (uMatch) {
        if (!assignMediaUrl) assignMediaUrl = uMatch[0].replace(/[.,;:)]+$/, '');
        rawTitle = rawTitle.replace(/https?:\/\/[^\s)\]]+/gi, '').replace(/[:\-–\s]+$/, '').trim();
      }

      // Explicit calendar due date ONLY (do NOT invent from week's class date!)
      const parsedDue = parseSafeDate(
        a.dueDate || a.due_date || a.dueDateIso || a.date || a.rawDueDate,
        termYear || undefined
      );

      // Determine week number from explicit property or title mention
      let resolvedWeek: number | null = null;
      if (typeof a.weekNumber === 'number' && a.weekNumber > 0) {
        resolvedWeek = a.weekNumber;
      } else if (typeof a.week_number === 'number' && a.week_number > 0) {
        resolvedWeek = a.week_number;
      } else {
        const m = (rawTitle + ' ' + (a.moduleMention || '')).match(/\b(?:week|wk|module|mod)\s*[:\-–#.]*\s*(\d{1,2})\b/i);
        if (m) {
          resolvedWeek = parseInt(m[1], 10);
        }
      }

      // Clean points: DO NOT default to '100 Points'!
      let cleanPoints: string | null = null;
      const rawPoints = a.pointsPossible || a.points || a.points_possible || a.totalPoints;
      if (rawPoints && typeof rawPoints === 'string' && rawPoints.trim() && rawPoints.trim().toLowerCase() !== 'n/a') {
        const ptsTrim = rawPoints.trim();
        cleanPoints = /pts|points/i.test(ptsTrim) ? ptsTrim : `${ptsTrim} Points`;
      }

      // Clean weight percentage: DO NOT invent
      let cleanWeight: string | null = null;
      const rawWeight = a.weightPercentage || a.weight || a.weight_percentage || a.percentage;
      if (rawWeight && typeof rawWeight === 'string' && rawWeight.trim()) {
        const wtTrim = rawWeight.trim();
        cleanWeight = wtTrim.includes('%') ? wtTrim : `${wtTrim}%`;
      }

      const normTitle = rawTitle.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Check for duplicate mention of the exact same assignment
      // Same assignment must have matching title AND matching schedule occurrence
      // (same week or same explicit due date). If weeks differ, they are RECURRING assignments!
      const existing = cleanAssignmentsList.find(existingA => {
        const existingNorm = existingA.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const isExactTitle = existingNorm === normTitle;
        const isFuzzyTitle =
          (existingNorm.includes(normTitle) || normTitle.includes(existingNorm)) &&
          existingNorm.length >= 6 &&
          normTitle.length >= 6;

        if (!isExactTitle && !isFuzzyTitle) {
          return false;
        }

        // If one has week 1 and the other week 2 -> DIFFERENT assignments (recurring)!
        if (resolvedWeek && existingA.weekNumber && existingA.weekNumber > 0 && resolvedWeek !== existingA.weekNumber) {
          return false;
        }

        // If both have explicit different due dates -> DIFFERENT assignments!
        if (parsedDue && existingA.dueDate) {
          const t1 = parsedDue.getTime();
          const t2 = new Date(existingA.dueDate).getTime();
          if (Math.abs(t1 - t2) > 24 * 60 * 60 * 1000) {
            return false;
          }
        }

        // For fuzzy matches, require same week or same due date
        if (isFuzzyTitle && !isExactTitle) {
          const sameDate = parsedDue && existingA.dueDate && Math.abs(parsedDue.getTime() - new Date(existingA.dueDate).getTime()) <= 24 * 60 * 60 * 1000;
          const sameWeek = resolvedWeek && existingA.weekNumber && existingA.weekNumber > 0 && resolvedWeek === existingA.weekNumber;
          if (!sameDate && !sameWeek && (parsedDue || resolvedWeek)) {
            return false;
          }
        }

        return true;
      });

      if (existing) {
        // Prefer shorter, cleaner title if one had extra boilerplate
        if (rawTitle.length < existing.title.length && rawTitle.length >= 5) {
          existing.title = rawTitle;
        }
        // Enrich existing assignment with details from detailed section
        if (!existing.dueDate && parsedDue) existing.dueDate = parsedDue;
        if (!existing.weightPercentage && cleanWeight) existing.weightPercentage = cleanWeight;
        if (!existing.pointsPossible && cleanPoints) existing.pointsPossible = cleanPoints;
        if (
          (!existing.fullInstructions || existing.fullInstructions === 'Parsed from course syllabus.') &&
          (a.fullInstructions || a.instructions || a.description)
        ) {
          existing.fullInstructions = a.fullInstructions || a.instructions || a.description;
        }
        if (!existing.noteText && (a.noteText || assignMediaUrl)) {
          existing.noteText = a.noteText || assignMediaUrl;
        }
        if (!existing.mediaUrl && assignMediaUrl) existing.mediaUrl = assignMediaUrl;
        if ((!existing.rubricCriteria || existing.rubricCriteria.length === 0) && (a.rubric || a.rubricCriteria)) {
          existing.rubricCriteria = a.rubric || a.rubricCriteria || [];
        }
        continue;
      }

      cleanAssignmentsList.push({
        id: `a-${Date.now()}-${i}`,
        courseCode: a.courseCode || a.course_code || undefined,
        title: rawTitle,
        weekNumber: resolvedWeek || 0,
        dueDate: parsedDue,
        fullInstructions: a.fullInstructions || a.instructions || a.description || 'Parsed from course syllabus.',
        pointsPossible: cleanPoints,
        pointsBreakdown: a.pointsBreakdown || null,
        rubricJSON: a.rubric ? JSON.stringify(a.rubric) : null,
        noteText: a.noteText || assignMediaUrl || null,
        isCompleted: false,
        isDeleted: false,
        weightPercentage: cleanWeight,
        moduleMention: a.moduleMention || (resolvedWeek ? `Week ${resolvedWeek}` : undefined),
        subTypeRaw: a.subType || a.subTypeRaw || a.category || 'assignment',
        mediaUrl: assignMediaUrl,
        relevantTopics: resolvedWeek ? `Week ${resolvedWeek}` : undefined,
        isFavorite: false,
        rubricCriteria: a.rubric || a.rubricCriteria || []
      });
    }

    return cleanAssignmentsList;
  }

  /**
   * 4. Determine import outcome honestly without false celebration.
   */
  public determineImportOutcome(params: {
    fileName: string;
    hasReadablePayload: boolean;
    isApiSuccess: boolean;
    isFallbackUsed: boolean;
    isPartial: boolean;
    readingsCount: number;
    assignmentsCount: number;
    saveSuccess: boolean;
    errorMessage?: string;
  }): ImportOutcomeDetails {
    const {
      fileName,
      hasReadablePayload,
      isApiSuccess,
      isFallbackUsed,
      isPartial,
      readingsCount,
      assignmentsCount,
      saveSuccess,
      errorMessage
    } = params;

    const totalTasks = readingsCount + assignmentsCount;

    if (!hasReadablePayload) {
      return {
        outcome: 'UNREADABLE_DOCUMENT',
        success: false,
        message: `Could not extract text or readable pages from ${fileName} (scanned or image-only document). Document stored in vault.`,
        isFallbackUsed,
        readingsCount: 0,
        assignmentsCount: 0,
        celebrationAllowed: false
      };
    }

    if (!isApiSuccess && !isFallbackUsed) {
      return {
        outcome: 'API_FAILURE',
        success: false,
        message: errorMessage ? `API Error: ${errorMessage}` : `Failed to process ${fileName} via AI service.`,
        isFallbackUsed: false,
        readingsCount: 0,
        assignmentsCount: 0,
        celebrationAllowed: false
      };
    }

    if (!saveSuccess) {
      return {
        outcome: 'SAVE_FAILURE',
        success: false,
        message: `Failed to save ${fileName} to storage.`,
        isFallbackUsed,
        readingsCount,
        assignmentsCount,
        celebrationAllowed: false
      };
    }

    if (totalTasks === 0) {
      return {
        outcome: 'NO_TASKS_FOUND',
        success: false,
        message: `Stored ${fileName} in Vault, but no readings or assignments were detected in the document.`,
        isFallbackUsed,
        readingsCount: 0,
        assignmentsCount: 0,
        celebrationAllowed: false
      };
    }

    if (isPartial) {
      return {
        outcome: 'PARTIAL_EXTRACTION',
        success: true,
        message: `Partially extracted ${fileName}: found ${readingsCount} readings & ${assignmentsCount} assignments.`,
        isFallbackUsed,
        readingsCount,
        assignmentsCount,
        celebrationAllowed: false // Do not celebrate partial or incomplete extraction
      };
    }

    if (isFallbackUsed) {
      return {
        outcome: 'LOCAL_FALLBACK',
        success: true,
        message: `Imported ${fileName} using offline local parser (${readingsCount} readings & ${assignmentsCount} assignments).`,
        isFallbackUsed: true,
        readingsCount,
        assignmentsCount,
        celebrationAllowed: totalTasks > 0
      };
    }

    return {
      outcome: 'SUCCESS',
      success: true,
      message: `Successfully imported ${fileName} with ${readingsCount} readings & ${assignmentsCount} assignments!`,
      isFallbackUsed: false,
      readingsCount,
      assignmentsCount,
      celebrationAllowed: true
    };
  }

  /**
   * 5. Reimport reconciliation:
   * Avoid multiplying tasks and preserve user edits when reimporting the same syllabus document.
   */
  public mergeReimportedCourse(params: {
    targetCourseId: string;
    existingCourses: Course[];
    existingReadings: Reading[];
    existingAssignments: Assignment[];
    existingVaultDocs: VaultDocument[];
    newCourseData: Partial<Course>;
    newReadings: Reading[];
    newAssignments: Assignment[];
    newVaultDoc: VaultDocument;
  }): {
    updatedCourses: Course[];
    updatedReadings: Reading[];
    updatedAssignments: Assignment[];
    updatedVaultDocs: VaultDocument[];
  } {
    const {
      targetCourseId,
      existingCourses,
      existingReadings,
      existingAssignments,
      existingVaultDocs,
      newCourseData,
      newReadings,
      newAssignments,
      newVaultDoc
    } = params;

    const targetCourse = existingCourses.find(c => c.id === targetCourseId);
    const courseCodeKey = (targetCourse?.courseCode || targetCourse?.courseName || '').toLowerCase();

    // Reconcile assignments: update or append, preserving existing completion and notes
    const courseExistingAssignments = existingAssignments.filter(
      a => a.courseId === targetCourseId || (a.courseCode || '').toLowerCase() === courseCodeKey
    );
    const otherAssignments = existingAssignments.filter(
      a => a.courseId !== targetCourseId && (a.courseCode || '').toLowerCase() !== courseCodeKey
    );

    const mergedCourseAssignments: Assignment[] = [...courseExistingAssignments];

    for (const newA of newAssignments) {
      const normTitle = newA.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchIdx = mergedCourseAssignments.findIndex(existingA => {
        const exNorm = existingA.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (exNorm !== normTitle) return false;
        // Same week number check
        if (newA.weekNumber && existingA.weekNumber && newA.weekNumber !== existingA.weekNumber) return false;
        return true;
      });

      if (matchIdx >= 0) {
        // Preserve user state: isCompleted, isDeleted, custom user notes
        const existingA = mergedCourseAssignments[matchIdx];
        mergedCourseAssignments[matchIdx] = {
          ...newA,
          id: existingA.id,
          isCompleted: existingA.isCompleted,
          isDeleted: existingA.isDeleted,
          isFavorite: existingA.isFavorite,
          noteText: existingA.noteText || newA.noteText,
          courseId: targetCourseId
        };
      } else {
        mergedCourseAssignments.push({
          ...newA,
          courseId: targetCourseId
        });
      }
    }

    // Reconcile readings: update or append, preserving completion and user status
    const courseExistingReadings = existingReadings.filter(
      r => r.courseId === targetCourseId || (r.courseCode || '').toLowerCase() === courseCodeKey
    );
    const otherReadings = existingReadings.filter(
      r => r.courseId !== targetCourseId && (r.courseCode || '').toLowerCase() !== courseCodeKey
    );

    const mergedCourseReadings: Reading[] = [...courseExistingReadings];

    for (const newR of newReadings) {
      const normTitle = newR.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const newBook = (newR.resourceTitle || newR.authorName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const newCh = (newR.chapterText || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const matchIdx = mergedCourseReadings.findIndex(existingR => {
        const exBook = (existingR.resourceTitle || existingR.authorName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const exCh = (existingR.chapterText || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const exTitle = existingR.title.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (newR.weekNumber && existingR.weekNumber && newR.weekNumber !== existingR.weekNumber) {
          return false;
        }

        if (newBook && exBook && newBook === exBook && newCh && exCh && newCh === exCh) {
          return true;
        }

        return exTitle === normTitle;
      });

      if (matchIdx >= 0) {
        const existingR = mergedCourseReadings[matchIdx];
        mergedCourseReadings[matchIdx] = {
          ...newR,
          id: existingR.id,
          isCompleted: existingR.isCompleted,
          isDeleted: existingR.isDeleted,
          isFavorite: existingR.isFavorite,
          courseId: targetCourseId
        };
      } else {
        mergedCourseReadings.push({
          ...newR,
          courseId: targetCourseId
        });
      }
    }

    // Reconcile course metadata
    const updatedCourses = existingCourses.map(c => {
      if (c.id !== targetCourseId) return c;
      return {
        ...c,
        ...newCourseData,
        id: c.id,
        assignments: mergedCourseAssignments,
        textbooks: newCourseData.textbooks || c.textbooks
      };
    });

    // Vault document update: replace existing doc with same title or prepend
    const cleanDocTitle = newVaultDoc.title.toLowerCase();
    const updatedVaultDocs = [
      newVaultDoc,
      ...existingVaultDocs.filter(d => d.title.toLowerCase() !== cleanDocTitle)
    ];

    return {
      updatedCourses,
      updatedReadings: [...mergedCourseReadings, ...otherReadings],
      updatedAssignments: [...mergedCourseAssignments, ...otherAssignments],
      updatedVaultDocs
    };
  }

  /**
   * Try repairing truncated JSON string (e.g. from token limit cutoff)
   */
  private tryRepairTruncatedJson(str: string): any | null {
    let s = str.trim();
    // Close strings if unclosed
    const quoteCount = (s.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      s += '"';
    }

    // Attempt closing arrays and objects
    const stack: string[] = [];
    for (const char of s) {
      if (char === '{') stack.push('}');
      else if (char === '[') stack.push(']');
      else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }

    while (stack.length > 0) {
      s += stack.pop();
    }

    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
}
