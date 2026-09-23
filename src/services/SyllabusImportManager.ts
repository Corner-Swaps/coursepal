/**
 * SyllabusImportManager
 * Production service orchestrating syllabus document normalization, validation,
 * deduplication, honest outcome reporting, and persistence reconciliation.
 */

import {
  Course,
  CourseDTO,
  Reading,
  Assignment,
  Week,
  VaultDocument,
  MediaType,
  ImportOutcome,
  TextbookResource,
  RubricCriterionDTO,
  GradingScaleTier
} from '../types/models';
import {
  cleanChapterFromRaw,
  cleanAssignmentTitle,
  isGenericPlaceholderReadingTitle,
  isDeliverableNotReading,
  parseSafeDate,
  cleanRubricCriterionName,
  isInvalidAssignmentTitle,
  getReadingChapterSortKey,
  isRealDateOrRangeString,
  isItemForCourse
} from '../utils/readingDisplayHelper';
import {
  resolveFullAuthorName,
  enrichAuthorsInReadings,
  enrichAuthorsInTextbooks
} from '../utils/authorResolver';

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
  scheduledWeeks?: number[];
  scheduled_weeks?: number[];
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
  assignmentNumber?: number | null;
  assignment_number?: number | null;
  assignmentNumberLabel?: string | null;
}

export interface RawReadingCandidate {
  title?: string;
  name?: string;
  readingTitle?: string;
  resourceTitle?: string;
  resource_title?: string;
  bookTitle?: string;
  authorName?: string | null;
  author?: string | null;
  authors?: string | null;
  author_name?: string | null;
  chapterText?: string | null;
  chapter_text?: string | null;
  chapter?: string | null;
  chapters?: string | null;
  chaptersOrPages?: string | null;
  pagesText?: string | null;
  pages_text?: string | null;
  pages?: string | null;
  weekNumber?: number | null;
  week_number?: number | null;
  moduleNumber?: number | null;
  module_number?: number | null;
  moduleMention?: string | null;
  dueDate?: string | null;
  due_date?: string | null;
  dueDateIso?: string | null;
  dateRangeStr?: string | null;
  mediaType?: MediaType | string | null;
  media_type?: MediaType | string | null;
  videoUrl?: string | null;
  video_url?: string | null;
  mediaUrl?: string | null;
  url?: string | null;
  link?: string | null;
  summaryText?: string | null;
  keyTakeawaysText?: string | null;
  estimatedTimeText?: string | null;
  relevantTopics?: string | null;
  courseCode?: string | null;
  course_code?: string | null;
  requirementType?: string | null;
  isRequired?: boolean;
}

export interface NormalizedSyllabusPayload {
  courseName?: string;
  courseCode?: string;
  courseDescription?: string;
  instructorName?: string;
  instructorEmail?: string;
  officeHours?: string | null;
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
    startDate?: string;
    dateRangeStr?: string;
  }[];
  externalScheduleNotice?: string | null;
  gradingScale?: string | null;
  gradingScaleRows?: GradingScaleTier[] | null;
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

  public static deduplicateAssignments(
    rawAssignments: RawAssignmentCandidate[],
    courseYear?: number | null,
    weekDateMap?: Map<number, string>
  ) {
    return SyllabusImportManager.shared.deduplicateAssignments(rawAssignments, courseYear, weekDateMap);
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

  public static enrichPayloadWithLocalExtraction(
    normalized: NormalizedSyllabusPayload,
    localDto: CourseDTO
  ): NormalizedSyllabusPayload {
    return SyllabusImportManager.shared.enrichPayloadWithLocalExtraction(normalized, localDto);
  }

  /**
   * Parses textbook citation strings (APA, author-title, or raw strings) into a structured TextbookResource.
   */
  public static parseCitationStringToTextbook(str: string): TextbookResource | null {
    if (!str || typeof str !== 'string') return null;
    const trimmed = str.trim();
    if (trimmed.length < 5) return null;

    let isbn: string | null = null;
    const isbnMatch = trimmed.match(/ISBN(?:-1[03])?:?\s*([\d\-X]{10,17})/i);
    if (isbnMatch) {
      isbn = isbnMatch[1].trim();
    }

    let edition: string | null = null;
    const editionMatch = trimmed.match(/\b(\d+(?:st|nd|rd|th)\s*(?:ed(?:\.|ition)?))/i);
    if (editionMatch) {
      edition = editionMatch[1].trim();
    }

    // Try APA format: Author(s) (Year). Title...
    // e.g. Creswell, J.W., & Creswell. J. D. (2022). Research Design: Qualitative, Quantitative, and Mixed Methods Approaches (6th ed.). SAGE Publications.
    const apaMatch = trimmed.match(/^([^()]+?)\s*\((?:c\.?\s*)?(\d{4}[a-z]?)\)\.?\s*([^.]+?)(?:\.|\((?:\d+(?:st|nd|rd|th)\s*ed|\b[A-Z]))/i);
    if (apaMatch) {
      const rawAuthor = apaMatch[1].replace(/^[•\-\*\s]+/, '').trim();
      const authorName = resolveFullAuthorName(rawAuthor) || rawAuthor;
      let title = apaMatch[3].trim();
      title = title.replace(/\s*\(\d+(?:st|nd|rd|th)\s*ed\.?\)$/i, '').trim();
      if (title.length > 2 && authorName.length > 2) {
        return { title, authorName, edition, isbn };
      }
    }

    // "By" format: Title by Author
    const byMatch = trimmed.match(/^(.+?)\s+by\s+([A-Z][a-zA-Z\s,.'&]+)$/i);
    if (byMatch) {
      const title = byMatch[1].replace(/^[•\-\*\s]+/, '').trim();
      const rawAuthor = byMatch[2].trim();
      const authorName = resolveFullAuthorName(rawAuthor) || rawAuthor;
      if (title.length > 2 && authorName.length > 2) {
        return { title, authorName, edition, isbn };
      }
    }

    // Pattern: Author: Title OR Author - Title
    const dashMatch = trimmed.match(/^([A-Z][a-zA-Z\s,.'&]+?)\s*[-:]\s*(.+)$/);
    if (dashMatch && !dashMatch[1].toLowerCase().startsWith('isbn') && !dashMatch[1].toLowerCase().startsWith('required') && !dashMatch[1].toLowerCase().startsWith('recommended')) {
      const rawAuthor = dashMatch[1].trim();
      const authorName = resolveFullAuthorName(rawAuthor) || rawAuthor;
      const title = dashMatch[2].replace(/\s*\([^)]*edition[^)]*\)/i, '').trim();
      if (authorName.length > 2 && title.length > 3) {
        return { title, authorName, edition, isbn };
      }
    }

    // Fallback: title is the entire string (cleaned of leading bullet points)
    const cleanStr = trimmed.replace(/^[•\-\*\d\.\)\s]+/, '').trim();
    return { title: cleanStr, authorName: null, edition, isbn };
  }

  /**
   * Splits lumped reading candidates that contain multiple citations separated by semicolons
   * or requirement sections (Required: ... Optional: ...)
   * e.g. "Required: Wada & Fellner, 2025; Maddux & Winstead, (2019): Ch 1&2, 4-6; DSM 5-TR: Section 1, Section 3 - Culture and Psychiatric Diagnosis pg. 859. Optional: World Health Organization (2010) ICD. http://www.who.int/classifications/icd/en."
   * e.g. "Lezak et al. (Ch. 1–3); Luria (Ch. 2)" or "Groth-Marnat (Ch. 4 & 5); Lichtenberger (Ch. 2)"
   */
  public static splitMultiCitationCandidate(candidate: RawReadingCandidate): RawReadingCandidate[] {
    const rawTitle = (candidate.title || candidate.readingTitle || candidate.resourceTitle || candidate.name || '').trim();
    const rawAuthor = (candidate.authorName || candidate.author || candidate.authors || '').trim();

    const hasSemicolon = rawTitle.includes(';') || rawAuthor.includes(';');
    const hasRequirementMarkers = /\b(?:Required|Optional|Recommended|Supplemental|Mandatory)\s*[:\-–—]/i.test(rawTitle);
    const hasNewlines = rawTitle.includes('\n');
    const hasCommaCitations = /(?<=[)\d]|\b(?:ch(?:apter)?s?\.?\s*[\d\s&–-]+|pp?\.?\s*[\d\s&–-]+|pages?\s*[\d\s&–-]+))\s*,\s*(?=[A-Z][a-zA-Z\s.&'–-]+?(?:\(\s*\d{4}\s*\)|(?:\s*,\s*|\s+)(?:chapters?|chaps?\.?|chs?\.?|ch\b)\s*\d+|(?:\s*,\s*|\s+)\(?\s*\d{4}\s*\)?|\s*,\s*[A-Z]\.|\s*:\s*[A-Z]))/i.test(rawTitle);

    // If candidate has no multi-item delimiters and already has authorName and chapterText, return directly
    if (!hasSemicolon && !hasRequirementMarkers && !hasNewlines && !hasCommaCitations && candidate.authorName && candidate.chapterText) {
      return [candidate];
    }

    if (rawAuthor.includes(';') && (!candidate.title || candidate.title === rawAuthor) && !hasRequirementMarkers) {
      const authParts = rawAuthor.split(';').map(a => a.trim()).filter(a => a.length >= 2);
      if (authParts.length > 1) {
        return authParts.map((auth, idx) => ({
          ...candidate,
          authorName: auth,
          title: idx === 0 ? (candidate.title || auth) : auth,
          chapterText: idx === 0 ? candidate.chapterText : undefined
        }));
      }
    }

    interface SectionChunk {
      text: string;
      isRequired: boolean;
      requirementType: 'required' | 'optional';
    }

    const defaultIsReq = candidate.isRequired !== undefined
      ? (candidate.isRequired !== false && candidate.requirementType !== 'optional')
      : (candidate.requirementType === 'optional' ? false : true);
    const defaultReqType: 'required' | 'optional' = (candidate.requirementType === 'optional' || defaultIsReq === false) ? 'optional' : 'required';

    const sectionChunks: SectionChunk[] = [];
    const sectionRegex = /(?:^|[\n.;·•—–])\s*(Required|Optional|Recommended|Supplemental|Mandatory)\s*[:\-–—]\s*/gi;
    const matches: { index: number; length: number; keyword: string }[] = [];

    let match: RegExpExecArray | null;
    while ((match = sectionRegex.exec(rawTitle)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        keyword: match[1].toLowerCase()
      });
    }

    if (matches.length > 0) {
      if (matches[0].index > 0) {
        const leadText = rawTitle.slice(0, matches[0].index).trim();
        if (leadText.length > 0) {
          sectionChunks.push({
            text: leadText,
            isRequired: defaultIsReq,
            requirementType: defaultReqType
          });
        }
      }

      for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];
        const startIndex = currentMatch.index + currentMatch.length;
        const endIndex = nextMatch ? nextMatch.index : rawTitle.length;
        const chunkText = rawTitle.slice(startIndex, endIndex).trim();

        const isOpt = currentMatch.keyword === 'optional' ||
                      currentMatch.keyword === 'recommended' ||
                      currentMatch.keyword === 'supplemental';

        if (chunkText.length > 0) {
          sectionChunks.push({
            text: chunkText,
            isRequired: !isOpt,
            requirementType: isOpt ? 'optional' : 'required'
          });
        }
      }
    } else {
      sectionChunks.push({
        text: rawTitle,
        isRequired: defaultIsReq,
        requirementType: defaultReqType
      });
    }

    const results: RawReadingCandidate[] = [];

    for (const chunk of sectionChunks) {
      // 1. Split on newlines
      const lines = chunk.text.split(/\r?\n+/).map(l => l.trim()).filter(l => l.length >= 2);
      const subSegments: string[] = [];

      for (const rawLine of (lines.length > 0 ? lines : [chunk.text])) {
        // Pre-clean combined semicolon/comma artifacts: e.g. "; ," or ", ;" -> "; "
        const line = rawLine.replace(/;\s*,\s*|,\s*;\s*/g, '; ');
        // 2. Split on semicolons
        const semiParts = line.includes(';')
          ? line.split(';').map(s => s.trim()).filter(s => s.length >= 3)
          : [line];

        for (const sp of semiParts) {
          // 3. Split on commas separating distinct citations (e.g. "Gehart chapters 1-3, Corey chapter 4" or "Gehart, Ch. 1, Corey, Ch. 4")
          const commaCitationPattern = /(?<=[)\d]|\b(?:ch(?:apter)?s?\.?\s*[\d\s&–-]+|pp?\.?\s*[\d\s&–-]+|pages?\s*[\d\s&–-]+))\s*,\s*(?=[A-Z][a-zA-Z\s.&'–-]+?(?:\(\s*\d{4}\s*\)|(?:\s*,\s*|\s+)(?:chapters?|chaps?\.?|chs?\.?|ch\b)\s*\d+|(?:\s*,\s*|\s+)\(?\s*\d{4}\s*\)?|\s*,\s*[A-Z]\.|\s*:\s*[A-Z]))/i;
          if (commaCitationPattern.test(sp)) {
            const commaParts = sp.split(commaCitationPattern).map(s => s.trim()).filter(s => s.length >= 3);
            subSegments.push(...commaParts);
          } else {
            subSegments.push(sp);
          }
        }
      }

      for (let sIdx = 0; sIdx < subSegments.length; sIdx++) {
        let seg = subSegments[sIdx];

        let videoUrl: string | undefined = candidate.videoUrl || undefined;
        const urlMatch = seg.match(/https?:\/\/[^\s)\]]+/i);
        if (urlMatch) {
          videoUrl = urlMatch[0].replace(/[.,;:)]+$/, '');
          seg = seg.replace(/https?:\/\/[^\s)\]]+/gi, '').trim();
        }

        seg = seg.replace(/^(?:required|optional|recommended|supplemental|read|watch|listen|view)\s*[:\-–—]\s*/i, '').trim();
        seg = seg.replace(/^[•\-*▪●: \t\n ]+|[•\-*▪●: \t\n ]+$/g, '').trim();
        seg = seg.replace(/[:;·•\-–—.]+\s*$/, '').trim();

        if (seg.length < 2) continue;

        // If segment is purely digits, connectors, or orphan chapter numbers (e.g. "4-6"), stitch to previous candidate or skip
        if (/^[\d\s&,\-–—]+$/.test(seg.trim())) {
          if (results.length > 0) {
            const prev = results[results.length - 1];
            if (prev.chapterText) {
              prev.chapterText = cleanChapterFromRaw(`${prev.chapterText}, ${seg.trim()}`) || prev.chapterText;
            }
          }
          continue;
        }

        // Clean table column crossover noise (dates, fragmented module headers, broken text)
        seg = seg.replace(/[-–—]?\s*\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b\s*[-–—]?/g, ' ');
        seg = seg.replace(/\bModul\w*\s*(?:[A-Za-z\s]+)?e\s*\d+\s+of\b/gi, ' ');
        seg = seg.replace(/\bModul\w*\s*\d*\b/gi, ' ');
        seg = seg.replace(/\be\s*\d+\s+of\b/gi, ' ');
        seg = seg.replace(/\bCultural\s+Context\s+Culture\s+and\b/gi, 'Cultural Context and');
        seg = seg.replace(/\s+/g, ' ').trim();

        // Extract topic if embedded after a dash e.g. "DSM 5-TR: Section 1, Section 3 - Culture and Psychiatric Diagnosis pg. 859"
        let extractedTopic: string | undefined = undefined;
        const dashTopicMatch = seg.match(/\s+[-–—]\s+([A-Z][a-zA-Z0-9\s,&'–-]+?)(?:\s+(?:pp?\.?|pages?|pg\.?)\s*[\d\s\-–—]+|\s*$)/);
        if (dashTopicMatch && dashTopicMatch[1].trim().length >= 3 && !/^(?:chapter|section|page|vol)/i.test(dashTopicMatch[1].trim())) {
          extractedTopic = dashTopicMatch[1].trim();
        }

        // Author Recognition:
        // A. APA style with initials e.g. "Gehart, D. R. (2018)", "Wada, K., & Fellner, K. D. (2014)"
        const apaAuthMatch = seg.match(/^((?:[A-Z][a-zA-Z'’-]+(?:,\s*[A-Z][a-zA-Z'’.-]*(?:\s+[A-Z][a-zA-Z'’.-]*)*)?)(?:\s*(?:,\s*&|,\s*and|&|and|,)\s*(?:[A-Z][a-zA-Z'’-]+(?:,\s*[A-Z][a-zA-Z'’.-]*(?:\s+[A-Z][a-zA-Z'’.-]*)*)?))*)\s*(?:\(\s*\d{4}\s*\)|,\s*\(?\s*\d{4}\s*\)?|:\s+[A-Z])/i);

        // B. Direct author followed by chapter without parens e.g. "Gehart chapters 1-3", "Corey Chapter 4", "Nichols ch. 5"
        const directChAuthMatch = seg.match(/^([A-Z][a-zA-Z\s.&'’–-]+?)(?:,\s*|\s+)(?:chapters?|chaps?\.?|chs?\.?|ch\b)\s*([\d\s&,\-–—]+)/i);

        // C. Author followed by parenthesized chapter e.g. "Gehart (Ch. 1)", "Corey (Chapters 1-3)"
        const parenChAuthMatch = seg.match(/^([A-Z][a-zA-Z\s.&'’–-]+?)\s*\(\s*(?:ch(?:apter)?s?\.?|chs?\.?|ch\b|pp?\.?|\d)/i);

        // D. General auth match with year or colon
        const generalAuthMatch = seg.match(/^([A-Z][a-zA-Z0-9\s.&–-]+?)(?:,\s*\(?\s*\d{4}\)?|\s*\(\s*\d{4}\)|\s*\(\s*(?:ch(?:apter)?s?\.?|chs?\.?|ch\b|pp?\.?|\d)|:\s*(?:ch(?:apter)?s?\.?|chs?\.?|ch\b|sections?|sec\.?|\d)|:\s+[A-Z])/i);

        // E. Manual / organization citations like DSM 5-TR, APA, WHO
        const manualAuthMatch = seg.match(/\b(DSM[-\s]*(?:5|IV|V|TR|\d)+(?:-TR)?)\b/i);

        let extractedAuthor = apaAuthMatch ? apaAuthMatch[1].trim()
          : (directChAuthMatch ? directChAuthMatch[1].trim()
          : (parenChAuthMatch ? parenChAuthMatch[1].trim()
          : (generalAuthMatch ? generalAuthMatch[1].trim()
          : (manualAuthMatch ? manualAuthMatch[1].trim() : undefined))));

        if (extractedAuthor) {
          extractedAuthor = extractedAuthor.replace(/[:;,\s]+$/, '').trim();
          if (/^(?:chapter|chapters|ch\b|week|weeks|module|modules|unit|session|required|optional|recommended|supplemental|read|watch|listen|view)$/i.test(extractedAuthor)) {
            extractedAuthor = undefined;
          }
        }

        if (!extractedAuthor && sIdx === 0 && rawAuthor && !rawAuthor.includes(';')) {
          extractedAuthor = rawAuthor;
        }

        let extractedChapter: string | null | undefined = undefined;
        if (directChAuthMatch && directChAuthMatch[2]) {
          extractedChapter = cleanChapterFromRaw(directChAuthMatch[2]) || undefined;
        } else {
          const chMatch = seg.match(/\((?:ch(?:apter)?s?\.?|chs?\.?|ch\b\.?)\s*([\d\s&,\-–—]+)\)/i) ||
                          seg.match(/\b(?:ch(?:apter)?s?\.?|chs?\.?|ch\b\.?)\s*([\d\s&,\-–—]+)/i);
          const secMatch = seg.match(/\b(?:sections?|sec\.?)\s*[:\-–.]*\s*(\d+(?:[\s&,:\-–andto]+(?:sections?|sec\.?)?\s*\d+)*)/i);
          if (chMatch) {
            extractedChapter = cleanChapterFromRaw(chMatch[0]) || (chMatch[1] ? `Chapter ${chMatch[1].trim()}` : undefined);
          } else if (secMatch) {
            extractedChapter = cleanChapterFromRaw(secMatch[0]) || `Section ${secMatch[1].trim()}`;
          } else if (sIdx === 0) {
            extractedChapter = candidate.chapterText;
          }
        }

        const pgMatch = seg.match(/\b(?:pp?\.?|pages?|pg\.?)\s*([\d\s\-–—]+)/i);
        const extractedPages: string | null | undefined = pgMatch ? `pg. ${pgMatch[1].trim()}` : (sIdx === 0 ? candidate.pagesText : undefined);

        let mediaType = candidate.mediaType;
        if (videoUrl) {
          mediaType = /youtube\.com|youtu\.be|vimeo/i.test(videoUrl) ? 'video' : 'article';
        }

        // Clean page indicators from segment title
        let cleanSegTitle = seg
          .replace(/\b(?:pp?\.?|pages?|pg\.?)\s*[\d\s\-–—]+/gi, '')
          .replace(/\s+(?:pp?\.?|pages?|pg\.?)\s*$/i, '')
          .replace(/^[•\-*▪●: \t\n ]+|[•\-*▪●: \t\n ]+$/g, '')
          .replace(/[:;·•\-–—.]+\s*$/, '')
          .trim();

        // Isolate clean resource / book title if author or book prefix is present
        let cleanResTitle = cleanSegTitle;
        if (extractedAuthor && cleanSegTitle.toLowerCase().startsWith(extractedAuthor.toLowerCase())) {
          cleanResTitle = extractedAuthor;
        } else if (candidate.resourceTitle && candidate.resourceTitle !== candidate.title) {
          cleanResTitle = candidate.resourceTitle;
        }

        results.push({
          ...candidate,
          title: cleanSegTitle,
          authorName: extractedAuthor || candidate.authorName,
          chapterText: extractedChapter || candidate.chapterText || undefined,
          pagesText: extractedPages || candidate.pagesText || undefined,
          videoUrl: videoUrl,
          mediaType: mediaType || candidate.mediaType,
          resourceTitle: cleanResTitle,
          relevantTopics: extractedTopic || candidate.relevantTopics,
          isRequired: chunk.isRequired,
          requirementType: chunk.requirementType
        });
      }
    }

    return results.length > 0 ? results : [candidate];
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
    const weeksSummary: {
      weekNumber: number;
      theme?: string;
      date?: string;
      startDate?: string;
      dateRangeStr?: string;
      moduleNumber?: number | null;
      moduleMention?: string | null;
    }[] = [];
    const weekDateMap = new Map<number, string>();

    let formatAccepted = 'standard';

    // Extract textbooks into resource catalog ONLY (do NOT add to candidateReadings)
    const rawTextbooks = Array.isArray(dto.textbooks)
      ? dto.textbooks
      : (Array.isArray(dto.resources)
          ? dto.resources
          : (Array.isArray(dto.textbooks_and_key_authors)
              ? dto.textbooks_and_key_authors
              : (Array.isArray(dto.required_textbooks) ? dto.required_textbooks : [])));

    for (const tb of rawTextbooks) {
      if (!tb) continue;
      if (typeof tb === 'string') {
        const parsed = SyllabusImportManager.parseCitationStringToTextbook(tb);
        if (parsed && parsed.title) {
          textbooks.push(parsed);
        }
        continue;
      }
      if (typeof tb !== 'object') continue;
      const title = (tb.title || tb.name || tb.bookTitle || '').trim();
      if (!title) continue;
      const rawAuthor = (tb.authorName || tb.author || tb.authors || null)?.trim() || null;
      const authorName = resolveFullAuthorName(rawAuthor, rawTextContext) || rawAuthor;
      const edition = (tb.edition || null)?.trim() || null;
      const isbn = (tb.isbn || null)?.trim() || null;
      textbooks.push({ title, authorName, edition, isbn });
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
        const wModNum = typeof (w as any).moduleNumber === 'number'
          ? (w as any).moduleNumber
          : (typeof (w as any).module_number === 'number'
              ? (w as any).module_number
              : ((w as any).moduleMention && /\d+/.test((w as any).moduleMention) ? parseInt((w as any).moduleMention.match(/\d+/)![0], 10) : undefined));
        const wModMention = (w as any).moduleMention || (wModNum ? `Module ${wModNum}` : undefined);

        if (typeof wkNum === 'number' && wkNum > 0) {
          weeksSummary.push({
            weekNumber: wkNum,
            theme: typeof w.theme === 'string' ? w.theme : undefined,
            date: typeof rawDate === 'string' ? rawDate : undefined,
            startDate: typeof (w as any).startDate === 'string' ? (w as any).startDate : (typeof rawDate === 'string' ? rawDate : undefined),
            dateRangeStr: typeof (w as any).dateRangeStr === 'string' ? (w as any).dateRangeStr : undefined,
            moduleNumber: wModNum,
            moduleMention: wModMention
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
              for (const splitWr of SyllabusImportManager.splitMultiCitationCandidate(wr)) {
                candidateReadings.push({
                  ...splitWr,
                  dueDate: splitWr.dueDate || splitWr.due_date || (w as any).startDate || (wkNum ? weekDateMap.get(wkNum) : null),
                  dateRangeStr: splitWr.dateRangeStr || (w as any).dateRangeStr || null,
                  weekNumber: splitWr.weekNumber || splitWr.week_number || wkNum,
                  moduleNumber: splitWr.moduleNumber || (splitWr as any).module_number || wModNum,
                  moduleMention: splitWr.moduleMention || (splitWr as any).module_mention || wModMention,
                  relevantTopics: splitWr.relevantTopics || w.theme
                });
              }
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
              dueDate: wa.dueDate || wa.due_date || wa.date || (wkNum ? weekDateMap.get(wkNum) : null),
              weekNumber: wa.weekNumber || wa.week_number || wkNum
            });
          }
        }
      }
    }

    // Process modular curriculum schedule blocks (e.g. from research dossiers or unit/schedule matrices)
    if (Array.isArray(dto.schedule)) {
      formatAccepted = 'schedule_blocks';
      for (let sIdx = 0; sIdx < dto.schedule.length; sIdx++) {
        const block = dto.schedule[sIdx];
        if (!block || typeof block !== 'object') continue;

        // Parse week span (e.g., "Weeks 1-2", "Week 1", or 1)
        let startWk = (sIdx * 2) + 1;
        let endWk = (sIdx * 2) + 2;
        if (typeof block.weeks === 'string') {
          const rangeMatch = block.weeks.match(/(\d+)\s*[-–—to]+\s*(\d+)/i);
          if (rangeMatch) {
            startWk = parseInt(rangeMatch[1], 10);
            endWk = parseInt(rangeMatch[2], 10);
          } else {
            const singleMatch = block.weeks.match(/\d+/);
            if (singleMatch) {
              startWk = endWk = parseInt(singleMatch[0], 10);
            }
          }
        } else if (typeof block.weeks === 'number') {
          startWk = endWk = block.weeks;
        }

        // Parse module numbers (e.g., "1 & 2", "Modules: 1 & 2")
        let modNumbers: number[] = [];
        if (typeof block.modules === 'string') {
          modNumbers = (block.modules.match(/\d+/g) || []).map(Number);
        } else if (typeof block.modules === 'number') {
          modNumbers = [block.modules];
        }
        if (modNumbers.length === 0) {
          modNumbers = [startWk, endWk];
        }

        // Populate weekly summary
        for (let w = startWk; w <= endWk; w++) {
          if (!weeksSummary.some(ws => ws.weekNumber === w)) {
            const modForWk = (modNumbers.length === (endWk - startWk + 1))
              ? modNumbers[w - startWk]
              : (modNumbers[0] || w);
            weeksSummary.push({
              weekNumber: w,
              theme: block.core_theoretical_focus || block.unit || `Week ${w}`,
              moduleNumber: modForWk,
              moduleMention: `Module ${modForWk}`
            });
          }
        }

        // Process schedule block readings
        if (Array.isArray(block.readings)) {
          const numWeeks = Math.max(1, endWk - startWk + 1);
          for (let rIdx = 0; rIdx < block.readings.length; rIdx++) {
            const rItem = block.readings[rIdx];
            if (!rItem) continue;

            const assignedWeek = block.readings.length === numWeeks
              ? (startWk + rIdx)
              : (startWk + Math.min(rIdx, numWeeks - 1));
            const assignedMod = (modNumbers.length === block.readings.length)
              ? modNumbers[rIdx]
              : (modNumbers[Math.min(rIdx, modNumbers.length - 1)] || assignedWeek);

            let cand: RawReadingCandidate;
            if (typeof rItem === 'string') {
              const parts = rItem.split('|').map((p: string) => p.trim());
              if (parts.length >= 3) {
                const authorName = parts[0];
                const resTitle = parts[1];
                const chPart = parts.slice(2).join(' | ');
                const chMatch = chPart.match(/\b(Ch(?:s|apters?)?\.?\s*\d+(?:\s*(?:&|and|-|–|—)\s*\d+)?)/i);
                const ppMatch = chPart.match(/\b(pp?\.?\s*\d+[\s–—\-]+\d+)/i);
                cand = {
                  title: resTitle,
                  resourceTitle: resTitle,
                  authorName: authorName,
                  chapterText: chMatch ? chMatch[1].trim() : (chPart.includes('Ch') ? chPart : undefined),
                  pagesText: ppMatch ? ppMatch[1].trim() : undefined,
                  mediaType: 'textbook',
                  weekNumber: assignedWeek,
                  moduleNumber: assignedMod,
                  moduleMention: `Module ${assignedMod}`,
                  relevantTopics: block.core_theoretical_focus || block.unit
                };
              } else if (parts.length === 2) {
                cand = {
                  title: parts[1],
                  resourceTitle: parts[1],
                  authorName: parts[0],
                  mediaType: 'textbook',
                  weekNumber: assignedWeek,
                  moduleNumber: assignedMod,
                  moduleMention: `Module ${assignedMod}`,
                  relevantTopics: block.core_theoretical_focus || block.unit
                };
              } else {
                cand = {
                  title: rItem,
                  mediaType: 'textbook',
                  weekNumber: assignedWeek,
                  moduleNumber: assignedMod,
                  moduleMention: `Module ${assignedMod}`,
                  relevantTopics: block.core_theoretical_focus || block.unit
                };
              }
            } else if (typeof rItem === 'object') {
              cand = {
                title: rItem.title || rItem.name || rItem.readingTitle || '',
                authorName: rItem.author || rItem.authorName || null,
                resourceTitle: rItem.resourceTitle || rItem.title || null,
                chapterText: rItem.chapter || rItem.chapterText || null,
                pagesText: rItem.pages || rItem.pagesText || null,
                mediaType: rItem.mediaType || 'textbook',
                weekNumber: rItem.weekNumber || assignedWeek,
                moduleNumber: rItem.moduleNumber || assignedMod,
                moduleMention: `Module ${rItem.moduleNumber || assignedMod}`,
                relevantTopics: rItem.relevantTopics || block.core_theoretical_focus || block.unit
              };
            } else {
              continue;
            }

            // Push weekly reading candidate
            candidateReadings.push(cand);

            // Also create pure curriculum module reading (Zero Cross-Bleed Rule)
            candidateReadings.push({
              ...cand,
              weekNumber: undefined,
              dueDate: null,
              dateRangeStr: null,
              summaryText: '',
              keyTakeawaysText: ''
            });
          }
        }

        // Process schedule block assignments
        if (Array.isArray(block.assignments)) {
          for (let aIdx = 0; aIdx < block.assignments.length; aIdx++) {
            const aItem = block.assignments[aIdx];
            if (!aItem || typeof aItem !== 'object') continue;

            const rawTitle = (aItem.title || aItem.name || '').trim();
            const dueStr = (aItem.due || aItem.dueDate || aItem.due_date || '').toString();
            const dueWkMatch = dueStr.match(/week\s*(\d+)/i) || rawTitle.match(/week\s*(\d+)/i);
            const aWeek = dueWkMatch ? parseInt(dueWkMatch[1], 10) : (startWk + Math.min(aIdx, Math.max(0, endWk - startWk)));
            const deliv = (aItem.deliverable || aItem.fullInstructions || aItem.instructions || aItem.description || '').trim();

            const rawPts = aItem.points != null ? aItem.points : (aItem.pointsPossible || null);
            const rawWt = aItem.weight != null ? aItem.weight : (aItem.weightPercentage || null);
            let aItemWeight: string | null = null;
            if (typeof rawWt === 'number' && !isNaN(rawWt)) {
              aItemWeight = rawWt > 0 && rawWt <= 1 ? `${Math.round(rawWt * 100)}%` : `${Math.round(rawWt)}%`;
            } else if (typeof rawWt === 'string' && rawWt.trim()) {
              aItemWeight = rawWt.trim().includes('%') ? rawWt.trim() : `${rawWt.trim()}%`;
            }
            let aItemPoints: string | null = null;
            if (typeof rawPts === 'number' && rawPts > 0) {
              aItemPoints = `${rawPts} Points`;
            } else if (typeof rawPts === 'string' && rawPts.trim() && rawPts.trim().toLowerCase() !== 'n/a') {
              aItemPoints = /pts|points/i.test(rawPts.trim()) ? rawPts.trim() : `${rawPts.trim()} Points`;
            }

            candidateAssignments.push({
              title: rawTitle,
              weekNumber: aWeek,
              noteText: deliv || undefined,
              fullInstructions: deliv || undefined,
              pointsPossible: aItemPoints,
              weightPercentage: aItemWeight,
              dueDate: aItem.dueDate || null
            });
          }
        }
      }
    }

    // Helper for robust assignment title comparison
    const stemWord = (w: string) => w.toLowerCase().replace(/s+$/, '');
    const getAssignWords = (t: string) =>
      cleanAssignmentTitle(t)
        .toLowerCase()
        .replace(/^(?:in[\s-]class|due|completed?)\s+/i, '')
        .split(/[\s,./\-_]+/)
        .map(stemWord)
        .filter(w => w.length >= 4 && !/^(assignment|deliverable|project|paper|report|final|midterm|exam|quiz|grade|mark|class|course|student|students|worth)$/.test(w));

    // Top-level assignments & deliverables (enrich existing candidates from weeks[] rather than creating duplicates)
    if (Array.isArray(dto.assignments)) {
      for (const a of dto.assignments) {
        if (a && typeof a === 'object') {
          const rawA = (a.title || a.name || a.assignmentName || '').trim();
          const cleanA = cleanAssignmentTitle(rawA);
          const normA = cleanA.toLowerCase().replace(/[^a-z0-9]/g, '');
          const stemA = normA.replace(/s+$/, '');
          const wordsA = getAssignWords(rawA);

          const existing = normA.length >= 4 ? candidateAssignments.find(ca => {
            const caRaw = (ca.title || ca.name || ca.assignmentName || '').trim();
            const caClean = cleanAssignmentTitle(caRaw);
            const caNorm = caClean.toLowerCase().replace(/[^a-z0-9]/g, '');
            const caStem = caNorm.replace(/s+$/, '');
            if (caNorm === normA || (caStem.length >= 5 && caStem === stemA)) return true;
            if (stemA.length >= 8 && caStem.length >= 8 && (stemA.includes(caStem) || caStem.includes(stemA))) return true;

            const wordsCa = getAssignWords(caRaw);
            const overlap = wordsA.filter(w => wordsCa.includes(w));
            if (overlap.length >= 2 || (wordsA.length === 1 && wordsCa.length === 1 && overlap.length === 1)) {
              const numA = (rawA.match(/\b(?:assignment|simulation|quiz|part|milestone|module|exam|phase|stage|paper|deliverable|project|osce)\s*(\d+)\b/i) || rawA.match(/\b(\d+)\b/))?.[1];
              const numCa = (caRaw.match(/\b(?:assignment|simulation|quiz|part|milestone|module|exam|phase|stage|paper|deliverable|project|osce)\s*(\d+)\b/i) || caRaw.match(/\b(\d+)\b/))?.[1];
              if (numA && numCa && numA !== numCa) return false;

              const wkA = a.weekNumber || (a as any).week_number;
              const wkCa = ca.weekNumber || (ca as any).week_number;
              if (wkA && wkCa && wkA > 0 && wkCa > 0 && wkA !== wkCa) return false;

              const wA = a.weightPercentage || a.weight;
              const wCa = ca.weightPercentage || ca.weight;
              if (wA && wCa) {
                const nA = parseInt(String(wA).replace(/\D/g, ''), 10);
                const nCa = parseInt(String(wCa).replace(/\D/g, ''), 10);
                if (!isNaN(nA) && !isNaN(nCa) && nA !== nCa) return false;
              }
              const isADisc = /\b(?:discussion|forum|db)\b/i.test(rawA);
              const isCaDisc = /\b(?:discussion|forum|db)\b/i.test(caRaw);
              if (isADisc !== isCaDisc) return false;
              return true;
            }
            return false;
          }) : null;

          if (existing) {
            // Prefer the authoritative overview assignment title over informal schedule notes
            if (rawA.length >= 4 && !/^(?:due|complete|students\s+will|in[\s-_]class)\b/i.test(rawA)) {
              existing.title = rawA;
            }
            if (!existing.weightPercentage && (a.weightPercentage || a.weight || (a as any).percentage)) {
              const rawW = a.weightPercentage || a.weight || (a as any).percentage;
              if (typeof rawW === 'number' && !isNaN(rawW)) {
                existing.weightPercentage = rawW > 0 && rawW <= 1 ? `${Math.round(rawW * 100)}%` : `${Math.round(rawW)}%`;
              } else if (typeof rawW === 'string' && rawW.trim()) {
                existing.weightPercentage = rawW.trim().includes('%') ? rawW.trim() : `${rawW.trim()}%`;
              }
            }
            if (!existing.pointsPossible && (a.pointsPossible || a.points || (a as any).totalPoints)) {
              const rawP = a.pointsPossible || a.points || (a as any).totalPoints;
              if (typeof rawP === 'number' && rawP > 0) {
                existing.pointsPossible = `${rawP} Points`;
              } else if (typeof rawP === 'string' && rawP.trim() && rawP.trim().toLowerCase() !== 'n/a') {
                existing.pointsPossible = /pts|points/i.test(rawP.trim()) ? rawP.trim() : `${rawP.trim()} Points`;
              }
            }
            if (!existing.dueDate && (a.dueDate || a.due_date)) existing.dueDate = a.dueDate || a.due_date;
            if ((!existing.weekNumber || existing.weekNumber <= 0) && (a.weekNumber || a.week_number)) existing.weekNumber = a.weekNumber || a.week_number;
            if ((!existing.fullInstructions || existing.fullInstructions.length < 30) && (a.fullInstructions || a.instructions || a.description)) {
              existing.fullInstructions = a.fullInstructions || a.instructions || a.description;
            }
            if (!existing.rubricCriteria && a.rubricCriteria) existing.rubricCriteria = a.rubricCriteria;
            if (!existing.scheduledWeeks && a.scheduledWeeks) existing.scheduledWeeks = a.scheduledWeeks;
            // Also backfill onto 'a' in case 'a' had richer overview details
            if (!a.weekNumber && existing.weekNumber) a.weekNumber = existing.weekNumber;
            if (!a.dueDate && existing.dueDate) a.dueDate = existing.dueDate;
          } else {
            candidateAssignments.push(a);
          }
        }
      }
    }
    if (Array.isArray(dto.deliverables)) {
      formatAccepted = 'deliverables_split';
      for (const d of dto.deliverables) {
        if (d && typeof d === 'object') {
          const rawD = (d.title || d.name || d.assignmentName || '').trim();
          const cleanD = cleanAssignmentTitle(rawD);
          const normD = cleanD.toLowerCase().replace(/[^a-z0-9]/g, '');
          const stemD = normD.replace(/s+$/, '');
          const wordsD = getAssignWords(rawD);

          const existing = normD.length >= 4 ? candidateAssignments.find(ca => {
            const caRaw = (ca.title || ca.name || ca.assignmentName || '').trim();
            const caClean = cleanAssignmentTitle(caRaw);
            const caNorm = caClean.toLowerCase().replace(/[^a-z0-9]/g, '');
            const caStem = caNorm.replace(/s+$/, '');
            if (caNorm === normD || (caStem.length >= 5 && caStem === stemD)) return true;
            if (stemD.length >= 8 && caStem.length >= 8 && (stemD.includes(caStem) || caStem.includes(normD))) return true;

            const wordsCa = getAssignWords(caRaw);
            const overlap = wordsD.filter(w => wordsCa.includes(w));
            if (overlap.length >= 2 || (wordsD.length === 1 && wordsCa.length === 1 && overlap.length === 1)) {
              const numD = (rawD.match(/\b(?:assignment|simulation|quiz|part|milestone|module|exam|phase|stage|paper|deliverable|project|osce)\s*(\d+)\b/i) || rawD.match(/\b(\d+)\b/))?.[1];
              const numCa = (caRaw.match(/\b(?:assignment|simulation|quiz|part|milestone|module|exam|phase|stage|paper|deliverable|project|osce)\s*(\d+)\b/i) || caRaw.match(/\b(\d+)\b/))?.[1];
              if (numD && numCa && numD !== numCa) return false;

              const wkD = d.weekNumber || (d as any).week_number;
              const wkCa = ca.weekNumber || (ca as any).week_number;
              if (wkD && wkCa && wkD > 0 && wkCa > 0 && wkD !== wkCa) return false;

              return true;
            }
            return false;
          }) : null;

          if (existing) {
            if (rawD.length >= 4 && !/^(?:due|complete|students\s+will|in[\s-_]class)\b/i.test(rawD)) {
              existing.title = rawD;
            }
            if (!existing.weightPercentage && (d.weightPercentage || d.weight)) existing.weightPercentage = d.weightPercentage || d.weight;
            if (!existing.pointsPossible && (d.pointsPossible || d.points)) existing.pointsPossible = d.pointsPossible || d.points;
            if (!existing.dueDate && (d.dueDate || d.due_date)) existing.dueDate = d.dueDate || d.due_date;
            if ((!existing.weekNumber || existing.weekNumber <= 0) && (d.weekNumber || d.week_number)) existing.weekNumber = d.weekNumber || d.week_number;
            if ((!existing.fullInstructions || existing.fullInstructions.length < 30) && (d.fullInstructions || d.instructions || d.description)) {
              existing.fullInstructions = d.fullInstructions || d.instructions || d.description;
            }
          } else {
            candidateAssignments.push(d);
          }
        }
      }
    }

    // Top-level readings (enrich existing candidates from weeks[] rather than duplicating)
    if (Array.isArray(dto.readings)) {
      for (const r of dto.readings) {
        if (r && typeof r === 'object') {
          for (const splitR of SyllabusImportManager.splitMultiCitationCandidate(r)) {
            const rawR = (splitR.title || splitR.readingTitle || splitR.resourceTitle || splitR.name || '').trim();
            const normR = rawR.toLowerCase().replace(/[^a-z0-9]/g, '');

            const existing = normR.length >= 6 ? candidateReadings.find(cr => {
              const crRaw = (cr.title || cr.readingTitle || cr.resourceTitle || cr.name || '').trim();
              const crNorm = crRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (crNorm === normR) return true;
              if (normR.length >= 10 && crNorm.length >= 10 && (normR.includes(crNorm) || crNorm.includes(normR))) return true;
              return false;
            }) : null;

            if (existing) {
              if (!existing.authorName && splitR.authorName) existing.authorName = splitR.authorName;
              if (!existing.chapterText && splitR.chapterText) existing.chapterText = splitR.chapterText;
              if (!existing.pagesText && splitR.pagesText) existing.pagesText = splitR.pagesText;
              if (!existing.videoUrl && splitR.videoUrl) existing.videoUrl = splitR.videoUrl;
              if (existing.isRequired === undefined && splitR.isRequired !== undefined) {
                existing.isRequired = splitR.isRequired;
                existing.requirementType = splitR.requirementType;
              }
            } else {
              candidateReadings.push(splitR);
            }
          }
        }
      }
    }

    // Top-level module readings (e.g. from Table 1 curriculum modules)
    // Always preserve all canonical modules as dedicated module curriculum entities!
    if (Array.isArray((dto as any).moduleReadings)) {
      const rawModuleReadings: any[] = (dto as any).moduleReadings;
      for (const mr of rawModuleReadings) {
        if (mr && typeof mr === 'object') {
          const modNum = mr.moduleNumber || mr.module_number;
          for (const splitMr of SyllabusImportManager.splitMultiCitationCandidate(mr)) {
            candidateReadings.push({
              ...splitMr,
              weekNumber: undefined,
              moduleNumber: modNum || splitMr.moduleNumber || (splitMr as any).module_number,
              moduleMention: splitMr.moduleMention || (modNum ? `Module ${modNum}` : null),
              relevantTopics: mr.relevantTopics || mr.theme || splitMr.relevantTopics || undefined,
              summaryText: '',
              keyTakeawaysText: ''
            });
          }
        }
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
        if (
          category === 'assignment' ||
          category === 'deliverable' ||
          category === 'paper' ||
          category === 'exam' ||
          category === 'quiz' ||
          category === 'midterm' ||
          category === 'final' ||
          category === 'project' ||
          category === 'homework' ||
          category === 'presentation' ||
          category === 'lab' ||
          category === 'task' ||
          category === 'inclass' ||
          category === 'in_class'
        ) {
          const normTitle = (item.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          const alreadyExists = candidateAssignments.some(ca => {
            const caNorm = (ca.title || (ca as any).name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            return caNorm === normTitle || (caNorm.length >= 6 && normTitle.length >= 6 && (caNorm.includes(normTitle) || normTitle.includes(caNorm)));
          });
          if (!alreadyExists) {
            candidateAssignments.push({
              title: item.title,
              fullInstructions: item.description || item.fullInstructions,
              pointsPossible: item.points || item.pointsPossible,
              weightPercentage: item.percentage || item.weightPercentage,
              dueDate: item.dueDateIso || item.dueDate,
              weekNumber: item.weekNumber,
              subType: item.subType,
              mediaUrl: item.mediaUrl,
              rubric: item.rubric,
              rubricCriteria: item.rubricCriteria || item.rubric
            });
          }
        } else if (category === 'reading' || category === 'textbook' || category === 'media') {
          const normTitle = (item.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          const normCh = (item.chapterText || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          const alreadyExists = candidateReadings.some(cr => {
            const crNorm = (cr.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const crCh = (cr.chapterText || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            return crNorm === normTitle && (!normCh || !crCh || crCh === normCh);
          });
          if (!alreadyExists) {
            const rawCand: RawReadingCandidate = {
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
              relevantTopics: item.relevantTopics,
              isRequired: item.isRequired,
              requirementType: item.requirementType
            };
            for (const splitCand of SyllabusImportManager.splitMultiCitationCandidate(rawCand)) {
              candidateReadings.push(splitCand);
            }
          }
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

    const resolvedCourseName = (
      (typeof dto.courseName === 'string' && dto.courseName.trim()) ||
      (dto.course_details && typeof dto.course_details.title === 'string' && dto.course_details.title.trim()) ||
      (dto.course_details && typeof dto.course_details.course_name === 'string' && dto.course_details.course_name.trim()) ||
      (dto.course && typeof dto.course.title === 'string' && dto.course.title.trim()) ||
      undefined
    );

    const resolvedCourseCode = (
      (typeof dto.courseCode === 'string' && dto.courseCode.trim()) ||
      (dto.course_details && typeof dto.course_details.archival_reference === 'string' && dto.course_details.archival_reference.trim()) ||
      (dto.course_details && typeof dto.course_details.course_code === 'string' && dto.course_details.course_code.trim()) ||
      (dto.course && typeof dto.course.code === 'string' && dto.course.code.trim()) ||
      undefined
    );

    const resolvedCourseDescription = (
      (typeof dto.courseDescription === 'string' && dto.courseDescription.trim()) ||
      (dto.course_details && typeof dto.course_details.program === 'string' && dto.course_details.program.trim()) ||
      (dto.course_details && typeof dto.course_details.description === 'string' && dto.course_details.description.trim()) ||
      undefined
    );

    let resolvedTermWeeks = typeof dto.termWeeks === 'number' && dto.termWeeks > 0 ? dto.termWeeks : undefined;
    if (!resolvedTermWeeks && weeksSummary.length > 0) {
      resolvedTermWeeks = Math.max(...weeksSummary.map(w => w.weekNumber));
    }

    // If no explicit textbooks were cataloged, synthesize textbook resources from candidate readings
    if (textbooks.length === 0 && candidateReadings.length > 0) {
      const seen = new Set<string>();
      for (const cr of candidateReadings) {
        if (cr.authorName && cr.authorName.trim().length > 1) {
          const author = cr.authorName.trim();
          const title = (cr.resourceTitle || cr.title || '').trim();
          if (title && !/^(?:chapter|week|module|session|reading)\s*\d+$/i.test(title)) {
            const dedupeKey = `${author.toLowerCase()}|${title.toLowerCase()}`;
            if (!seen.has(dedupeKey)) {
              seen.add(dedupeKey);
              textbooks.push({
                title,
                authorName: author,
                edition: null
              });
            }
          }
        }
      }
    }

    const resolvedOfficeHours =
      (typeof dto.officeHours === 'string' && dto.officeHours.trim()) ? dto.officeHours.trim() :
      (typeof dto.office_hours === 'string' && dto.office_hours.trim()) ? dto.office_hours.trim() :
      (typeof dto.instructorOfficeHours === 'string' && dto.instructorOfficeHours.trim()) ? dto.instructorOfficeHours.trim() :
      (typeof (dto as any).meetingTimes === 'string' && (dto as any).meetingTimes.trim()) ? (dto as any).meetingTimes.trim() :
      (typeof (dto as any).schedule === 'string' && (dto as any).schedule.trim()) ? (dto as any).schedule.trim() :
      (typeof (dto as any).office_hours_text === 'string' && (dto as any).office_hours_text.trim()) ? (dto as any).office_hours_text.trim() :
      null;

    return {
      courseName: resolvedCourseName,
      courseCode: resolvedCourseCode,
      courseDescription: resolvedCourseDescription,
      instructorName: typeof dto.instructorName === 'string' ? dto.instructorName.trim() : undefined,
      instructorEmail: typeof dto.instructorEmail === 'string' ? dto.instructorEmail.trim() : undefined,
      officeHours: resolvedOfficeHours,
      termWeeks: resolvedTermWeeks,
      termYear,
      textbooks: enrichAuthorsInTextbooks(textbooks, rawTextContext),
      candidateAssignments,
      candidateReadings: enrichAuthorsInReadings(candidateReadings, rawTextContext),
      weekDateMap,
      weeks: weeksSummary,
      externalScheduleNotice: typeof dto.externalScheduleNotice === 'string' ? dto.externalScheduleNotice.trim() : null,
      gradingScale: dto.gradingScale || null,
      gradingScaleRows: dto.gradingScaleRows || null,
      formatAccepted,
      isPartial,
      validationErrors
    };
  }

  /**
   * Enriches candidate assignments and readings using deterministic local parser results.
   * If the AI omitted rubrics, points, or percentage weights (e.g. Overview table weights),
   * this backfills them from the local parser.
   */
  public enrichPayloadWithLocalExtraction(
    normalized: NormalizedSyllabusPayload,
    localDto: CourseDTO
  ): NormalizedSyllabusPayload {
    if (!localDto || !localDto.assignments || localDto.assignments.length === 0) {
      return normalized;
    }

    const cleanCandidateAssignments: RawAssignmentCandidate[] = [...normalized.candidateAssignments];

    for (const aiA of cleanCandidateAssignments) {
      const rawTitleA = (aiA.title || (aiA as any).name || '').trim();
      const normA = rawTitleA.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!normA) continue;

      const wordsA: string[] = rawTitleA.toLowerCase().split(/[\s,.\-_/]+/).filter((w: string) => w.length >= 4);

      const match = localDto.assignments.find(la => {
        const rawTitleL = (la.title || '').trim();
        const normL = rawTitleL.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normA === normL) return true;

        const numA = (normA.match(/\d+$/) || [])[0];
        const numL = (normL.match(/\d+$/) || [])[0];
        if (numA && numL && numA !== numL) return false;

        if (normA.length >= 6 && normL.length >= 6 && (normA.includes(normL) || normL.includes(normA))) return true;

        const wordsL: string[] = rawTitleL.toLowerCase().split(/[\s,.\-_/]+/).filter((w: string) => w.length >= 4);
        const overlap = wordsA.filter((w: string) => wordsL.includes(w));
        return overlap.length >= 2 || (wordsA.length === 1 && wordsL.length === 1 && overlap.length === 1);
      });

      if (match) {
        // Backfill weight percentage if missing or unspecified
        const curWeight = aiA.weightPercentage || (aiA as any).weight;
        if ((!curWeight || curWeight === 'Unspecified') && match.weightPercentage) {
          aiA.weightPercentage = match.weightPercentage;
        }

        // Backfill rubric criteria if missing or empty
        const curRubric = aiA.rubricCriteria || aiA.rubric;
        const hasAiRubric = Array.isArray(curRubric) && curRubric.length > 0;
        if (!hasAiRubric && match.rubricCriteria && match.rubricCriteria.length > 0) {
          aiA.rubricCriteria = match.rubricCriteria;
          aiA.rubric = match.rubricCriteria;
        }

        // Backfill points possible if missing (never synthesize points from rubric criteria)
        if (!aiA.pointsPossible && match.pointsPossible) {
          aiA.pointsPossible = match.pointsPossible;
        }

        // Backfill full instructions if AI was sparse
        const curInstr = aiA.fullInstructions || (aiA as any).description;
        if ((!curInstr || curInstr.length < 25) && match.fullInstructions && match.fullInstructions.length > 25) {
          aiA.fullInstructions = match.fullInstructions;
        }

        // Backfill weekNumber if AI had 0
        if ((!aiA.weekNumber || aiA.weekNumber <= 0) && match.weekNumber && match.weekNumber > 0) {
          aiA.weekNumber = match.weekNumber;
        }

        // Backfill dueDate if AI missed it
        if (!aiA.dueDate && match.dueDate) {
          aiA.dueDate = match.dueDate;
        }

        // Backfill assignmentNumber if AI missed it
        if (!aiA.assignmentNumber && match.assignmentNumber) {
          aiA.assignmentNumber = match.assignmentNumber;
          aiA.assignmentNumberLabel = match.assignmentNumberLabel;
        }
      }
    }

    // If local parser found genuine course assignments (e.g. from the Overview table with weights or rubrics) that AI completely missed, add them!
    for (const la of localDto.assignments) {
      const rawTitleL = (la.title || '').trim();
      const normL = rawTitleL.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!normL) continue;

      const wordsL: string[] = rawTitleL.toLowerCase().split(/[\s,.\-_/]+/).filter((w: string) => w.length >= 4);

      const existsInAi = cleanCandidateAssignments.some(aiA => {
        const rawTitleA = (aiA.title || (aiA as any).name || '').trim();
        const normA = rawTitleA.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normA === normL) return true;

        const numA = (normA.match(/\d+$/) || [])[0];
        const numL2 = (normL.match(/\d+$/) || [])[0];
        if (numA && numL2 && numA !== numL2) return false;

        if (normA.length >= 6 && normL.length >= 6 && (normA.includes(normL) || normL.includes(normA))) return true;

        const wordsA: string[] = rawTitleA.toLowerCase().split(/[\s,.\-_/]+/).filter((w: string) => w.length >= 4);
        const overlap = wordsA.filter((w: string) => wordsL.includes(w));
        return overlap.length >= 2 || (wordsA.length === 1 && wordsL.length === 1 && overlap.length === 1);
      });

      if (!existsInAi && !isInvalidAssignmentTitle(la.title)) {
        cleanCandidateAssignments.push({
          title: la.title,
          dueDate: la.dueDate,
          pointsPossible: la.pointsPossible,
          weightPercentage: la.weightPercentage,
          fullInstructions: la.fullInstructions,
          mediaUrl: la.mediaUrl,
          weekNumber: la.weekNumber,
          rubricCriteria: la.rubricCriteria,
          rubric: la.rubric,
          assignmentNumber: la.assignmentNumber,
          assignmentNumberLabel: la.assignmentNumberLabel
        });
      }
    }

    let cleanCandidateReadings = [...normalized.candidateReadings];
    let cleanWeeks = [...normalized.weeks];

    // Reconcile weekly schedule if localDto has extracted weeks
    if (localDto.weeks && localDto.weeks.length > 0) {
      cleanWeeks = localDto.weeks.map(w => ({
        weekNumber: w.weekNumber,
        theme: w.theme || `Week ${w.weekNumber}`,
        date: w.startDate || undefined,
        startDate: w.startDate || undefined,
        dateRangeStr: w.dateRangeStr || undefined,
        moduleNumber: (w as any).moduleNumber,
        moduleMention: (w as any).moduleMention || ((w as any).moduleNumber ? `Module ${(w as any).moduleNumber}` : undefined)
      }));
    }

    // Enrich candidate readings with weekly schedule readings from localDto if missing from AI
    if (Array.isArray(localDto.weeks) && localDto.weeks.length > 0) {
      for (const w of localDto.weeks) {
        const wkNum = w.weekNumber;
        if (Array.isArray(w.readings)) {
          for (const wr of w.readings) {
            const wrTitleNorm = (wr.title || wr.resourceTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!wrTitleNorm) continue;

            const existingAi = cleanCandidateReadings.find(cr => {
              const crTitleNorm = (cr.title || cr.resourceTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              if (crTitleNorm === wrTitleNorm) return true;
              if (crTitleNorm.length >= 6 && wrTitleNorm.length >= 6 && (crTitleNorm.includes(wrTitleNorm) || wrTitleNorm.includes(crTitleNorm))) return true;
              return false;
            });

            if (existingAi) {
              if (!existingAi.weekNumber || existingAi.weekNumber <= 0) {
                existingAi.weekNumber = wkNum;
                existingAi.week_number = wkNum;
              }
              if ((!existingAi.authorName || existingAi.authorName === existingAi.title) && wr.authorName) {
                existingAi.authorName = wr.authorName;
              }
              if (!existingAi.chapterText && wr.chapterText) {
                existingAi.chapterText = wr.chapterText;
              }
              if (!existingAi.pagesText && wr.pagesText) {
                existingAi.pagesText = wr.pagesText;
              }
            } else {
              cleanCandidateReadings.push({
                title: wr.title,
                authorName: wr.authorName,
                resourceTitle: wr.resourceTitle || wr.title,
                chapterText: wr.chapterText,
                pagesText: wr.pagesText,
                mediaType: wr.mediaType || 'textbook',
                weekNumber: wkNum,
                dueDate: wr.dueDate || w.startDate || undefined,
                dateRangeStr: wr.dateRangeStr || w.dateRangeStr || undefined,
                relevantTopics: wr.relevantTopics || w.theme,
                summaryText: '',
                keyTakeawaysText: ''
              });
            }
          }
        }
      }
    }

    // Enrich candidate readings with canonical module readings from localDto if present
    if (Array.isArray(localDto.moduleReadings) && localDto.moduleReadings.length > 0) {
      const isCpc512 = (localDto.courseCode || '').toUpperCase().includes('512') || (localDto.courseName || '').toLowerCase().includes('family systems');
      const fallbackAuthor = isCpc512 ? 'Diane R. Gehart' : (localDto.instructorName || localDto.courseName || null);

      for (const mr of localDto.moduleReadings) {
        const modNum = mr.moduleNumber;
        if (modNum) {
          const alreadyHasModReading = cleanCandidateReadings.some(cr =>
            (cr.moduleNumber === modNum || (cr as any).module_number === modNum) &&
            (!cr.weekNumber || cr.weekNumber === 0)
          );
          if (!alreadyHasModReading && mr.title) {
            cleanCandidateReadings.push({
              title: mr.title,
              authorName: mr.authorName || fallbackAuthor,
              resourceTitle: mr.resourceTitle || undefined,
              chapterText: mr.chapterText,
              pagesText: mr.pagesText,
              mediaType: mr.mediaType || 'textbook',
              moduleNumber: modNum,
              moduleMention: mr.moduleMention || `Module ${modNum}`,
              dueDate: mr.dueDate || undefined,
              dateRangeStr: mr.dateRangeStr || undefined,
              relevantTopics: mr.relevantTopics,
              summaryText: '',
              keyTakeawaysText: ''
            });
          }
        }
      }
    }

    // Merge textbooks from localDto if normalized textbooks are empty
    const resolvedTextbooks = (normalized.textbooks && normalized.textbooks.length > 0)
      ? normalized.textbooks
      : (localDto.textbooks && localDto.textbooks.length > 0 ? localDto.textbooks : []);

    return {
      ...normalized,
      textbooks: resolvedTextbooks,
      candidateAssignments: cleanCandidateAssignments,
      candidateReadings: cleanCandidateReadings,
      weeks: cleanWeeks,
      gradingScale: localDto.gradingScale || normalized.gradingScale || null,
      gradingScaleRows: localDto.gradingScaleRows || normalized.gradingScaleRows || null,
      officeHours: normalized.officeHours || localDto.officeHours || (localDto as any).meetingTimes || null
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
        isGenericPlaceholderReadingTitle(rawTitle) ||
        isDeliverableNotReading(rawTitle, { moduleNumber: r.moduleNumber, chapterText: r.chapterText }) ||
        /^(?:total\s+)?(?:course\s+|grade\s+|assignment\s+)?points?\b/i.test(rawTitle)
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
      const mod = (typeof r.moduleNumber === 'number' && r.moduleNumber > 0)
        ? r.moduleNumber
        : (typeof (r as any).module_number === 'number' && (r as any).module_number > 0 ? (r as any).module_number : 0);
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
          rawTitle = wk > 0 ? `Week ${wk} Reading` : (mod > 0 ? `Module ${mod} Reading` : 'Course Reading');
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

      if (!candidateAuthor && rawTitle) {
        // e.g. "Beck (Ch. 1–3)" or "Lezak et al. (Ch. 1–3)" or "Shoeybi et al. (Megatron)" or "Li et al. (2020)"
        const authMatch = rawTitle.match(/^([A-Z][a-zA-Z\s.&'–-]+?(?:\s+et\s+al\.?)?)\s*\(\s*(?:ch(?:apter)?s?\.?|pp?\.?|\d|[A-Za-z0-9])/i);
        if (authMatch && authMatch[1].trim().length > 1 && !/^(?:chapter|reading|week|module|unit|required|study|optional)/i.test(authMatch[1].trim())) {
          candidateAuthor = authMatch[1].trim();
        }
      }

      const candidateResource = (r.resourceTitle || r.bookTitle || '').trim();

      // Cross-reference textbook lookup if author/book is missing
      let resolvedResource = candidateResource;
      if (textbookLookup.length > 0) {
        const searchStr = `${rawTitle} ${candidateResource} ${candidateAuthor || ''}`.toLowerCase();
        for (const tb of textbookLookup) {
          const cleanTbTitle = tb.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
          const cleanTbAuthor = (tb.authorName || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
          const words = cleanTbTitle.split(/\s+/).filter(w => w.length >= 4);
          const authorWords = cleanTbAuthor.split(/\s+/).filter(w => w.length >= 4);
          const matchCount = words.filter(w => searchStr.includes(w)).length;
          const authorMatchCount = authorWords.filter(w => searchStr.includes(w)).length;

          if (matchCount >= 2 || (cleanTbTitle.length > 6 && searchStr.includes(cleanTbTitle)) || authorMatchCount >= 1 || (cleanTbAuthor.length > 3 && searchStr.includes(cleanTbAuthor))) {
            if (!candidateAuthor) candidateAuthor = tb.authorName || null;
            if (!resolvedResource) resolvedResource = tb.title;
            break;
          }
        }
        // If course has only ONE primary textbook and reading has a chapter citation without an author:
        if (!candidateAuthor && textbookLookup.length === 1 && (cleanCh || ch)) {
          candidateAuthor = textbookLookup[0].authorName || null;
          if (!resolvedResource) resolvedResource = textbookLookup[0].title;
        }
      }

      candidateAuthor = resolveFullAuthorName(candidateAuthor) || candidateAuthor;

      // Safe explicit due date ONLY (do NOT invent class date as due date!)
      const parsedReadingDue = parseSafeDate(r.dueDate || r.due_date, termYear || undefined);

      // Distinct composite reading identity:
      // Must include: Week/Module + Book/Resource identity + Chapter/Pages + substantive title
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
        const existingWk = existingR.weekNumber || 0;
        const existingMod = existingR.moduleNumber || 0;

        if (wk > 0 && existingWk > 0 && wk !== existingWk) {
          return false; // Different scheduled weeks -> never merge!
        }
        if (mod > 0 && existingMod > 0 && mod !== existingMod) {
          return false; // Different modules -> never merge!
        }
        // Zero Cross-Bleed Rule: One is a calendar weekly schedule reading (wk > 0) and the other is a pure curriculum module reading (wk === 0) -> NEVER merge!
        if ((wk > 0 && (!existingWk || existingWk === 0)) || ((!wk || wk === 0) && existingWk > 0)) {
          return false;
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

      const isReq = r.isRequired !== undefined
        ? (r.isRequired !== false && r.requirementType !== 'optional')
        : (r.requirementType === 'optional' ? false : true);
      const reqType: 'required' | 'optional' = (r.requirementType === 'optional' || isReq === false) ? 'optional' : 'required';

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
        if (existing.isRequired === undefined && r.isRequired !== undefined) {
          existing.isRequired = isReq;
          existing.requirementType = reqType;
        }
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
        isRequired: isReq,
        requirementType: reqType,
        summaryText: '',
        keyTakeawaysText: '',
        estimatedTimeText: r.estimatedTimeText || (detectedMediaType === 'video' ? '~20 min watch' : '~45 min read'),
        dueDate: parsedReadingDue || parseSafeDate(r.dateRangeStr, termYear || undefined),
        dateRangeStr: (r.dateRangeStr && isRealDateOrRangeString(r.dateRangeStr))
          ? r.dateRangeStr
          : (parsedReadingDue
              ? parsedReadingDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : (wk > 0 ? `Week ${wk}` : null)),
        chapterText: cleanCh || ch || null,
        pagesText: r.pagesText || r.pages || null,
        relevantTopics: r.relevantTopics || (r as any).theme || (mod > 0 ? (r.moduleMention || `Module ${mod}`) : null),
        isFavorite: false,
        weekId: wk > 0 ? `w-${wk}` : 'none',
        weekNumber: wk > 0 ? wk : null,
        moduleNumber: mod > 0 ? mod : null,
        moduleMention: mod > 0 ? (r.moduleMention || `Module ${mod}`) : null
      });
    }

    cleanReadingsList.sort((a, b) => {
      const wA = a.weekNumber || 0;
      const wB = b.weekNumber || 0;
      if (wA !== wB) return wA - wB;
      const chA = getReadingChapterSortKey(a);
      const chB = getReadingChapterSortKey(b);
      if (chA !== chB) return chA - chB;
      const dA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      if (dA !== dB) return dA - dB;
      return (a.title || '').localeCompare(b.title || '');
    });

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
    termYear?: number | null,
    weekDateMap?: Map<number, string>
  ): Assignment[] {
    const cleanAssignmentsList: Assignment[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const a = candidates[i];
      let rawTitle = (a.title || a.name || a.assignmentName || a.assignment_name || a.deliverable || '').trim();
      if (!rawTitle || rawTitle.toLowerCase() === 'item title' || rawTitle.toLowerCase().includes('total 100%')) {
        continue;
      }

      let resolvedAssignNum: number | null = a.assignmentNumber ?? (a as any).assignment_number ?? null;
      let resolvedAssignNumLabel: string | null = a.assignmentNumberLabel ?? null;

      if (!resolvedAssignNum) {
        const anM = rawTitle.match(/\(?assignment\s*(\d{1,2})\)?/i) ||
                    rawTitle.match(/\((\d{1,2})\)/) ||
                    rawTitle.match(/^(?:assignment|deliverable|project|task)\s*(\d{1,2})\b/i) ||
                    rawTitle.match(/^(\d{1,2})[\.:\)]\s*/);
        if (anM) {
          resolvedAssignNum = parseInt(anM[1], 10);
        }
      }
      if (resolvedAssignNum && !resolvedAssignNumLabel) {
        resolvedAssignNumLabel = `Assignment ${resolvedAssignNum}`;
      }

      rawTitle = cleanAssignmentTitle(rawTitle);

      // Reject purely numeric titles, titles lacking letters, or instructional prompts/outcome phrases
      if (isInvalidAssignmentTitle(rawTitle)) {
        continue;
      }

      // Strip trailing due date clauses, percentages, and dashes from title
      rawTitle = rawTitle.replace(/\s*[-–—]\s*(?:due|submitted|over the course).*$/i, '').trim();
      rawTitle = rawTitle.replace(/\s*\(\s*(?:assignment\s*\d+|\d{1,3}%)\s*\)/gi, '').trim();
      rawTitle = rawTitle.replace(/\b(?:modules?|mod|weeks?|wk)\s*\d{1,2}(?:\s*[-–—]\s*\d{1,2})?\b/gi, '').trim();
      rawTitle = cleanAssignmentTitle(rawTitle);

      if (isInvalidAssignmentTitle(rawTitle)) {
        continue;
      }

      let assignMediaUrl = a.mediaUrl || a.videoUrl || a.url || a.link || null;
      const uMatch = (rawTitle + ' ' + (a.fullInstructions || '')).match(/https?:\/\/[^\s)\]]+/i);
      if (uMatch) {
        if (!assignMediaUrl) assignMediaUrl = uMatch[0].replace(/[.,;:)]+$/, '');
        rawTitle = rawTitle.replace(/https?:\/\/[^\s)\]]+/gi, '').replace(/[:\-–\s]+$/, '').trim();
      }

      // Explicit calendar due date ONLY
      let parsedDue = parseSafeDate(
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

      // Hydrate due date from week's schedule date if assignment belongs to that week and date was missing
      if (!parsedDue && resolvedWeek && weekDateMap && weekDateMap.has(resolvedWeek)) {
        parsedDue = parseSafeDate(weekDateMap.get(resolvedWeek), termYear || undefined);
      }

      // Sanitize rubric criteria
      const rawCriteriaList = a.rubricCriteria || a.rubric || [];
      const sanitizedCriteria: RubricCriterionDTO[] = Array.isArray(rawCriteriaList)
        ? rawCriteriaList
            .map(c => ({
              ...c,
              criterionName: cleanRubricCriterionName(c.criterionName || (c as any).name || (c as any).title)
            }))
            .filter(c => c.criterionName.length > 0)
        : [];

      // Clean weight percentage: DO NOT invent
      let cleanWeight: string | null = null;
      const rawWeight = a.weightPercentage ?? (a as any).weight ?? (a as any).weight_percentage ?? (a as any).percentage ?? (a as any).gradeWeight;
      if (typeof rawWeight === 'number' && !isNaN(rawWeight)) {
        if (rawWeight > 0 && rawWeight <= 1) {
          cleanWeight = `${Math.round(rawWeight * 100)}%`;
        } else if (rawWeight > 0) {
          cleanWeight = `${Math.round(rawWeight)}%`;
        }
      } else if (typeof rawWeight === 'string' && rawWeight.trim()) {
        const wtTrim = rawWeight.trim();
        cleanWeight = wtTrim.includes('%') ? wtTrim : `${wtTrim}%`;
      }
      if (!cleanWeight) {
        const textToScan = `${rawTitle} ${a.fullInstructions || ''} ${a.noteText || ''} ${(a as any).description || ''} ${(a as any).deliverable || ''}`;
        const wtM = textToScan.match(/\b(?:worth\s+|weight:\s*)?(\d{1,3}(?:\.\d+)?)\s*%/i) || textToScan.match(/\b(\d{1,3})\s*(?:percent)\b/i);
        if (wtM) {
          cleanWeight = `${wtM[1]}%`;
        }
      }

      // Clean points: extract from fields, text or genuine rubric criteria sum
      let cleanPoints: string | null = null;
      const rawPoints = a.pointsPossible ?? a.points ?? (a as any).points_possible ?? (a as any).totalPoints ?? (a as any).pointValue ?? (a as any).pts;
      if (typeof rawPoints === 'number' && rawPoints > 0) {
        cleanPoints = `${rawPoints} Points`;
      } else if (typeof rawPoints === 'string' && rawPoints.trim() && rawPoints.trim().toLowerCase() !== 'n/a') {
        const ptsTrim = rawPoints.trim();
        cleanPoints = /pts|points/i.test(ptsTrim) ? ptsTrim : `${ptsTrim} Points`;
      }
      if (!cleanPoints) {
        const textToScan = `${rawTitle} ${a.fullInstructions || ''} ${a.noteText || ''} ${(a as any).description || ''} ${(a as any).deliverable || ''}`;
        const ptM = textToScan.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i);
        if (ptM) {
          cleanPoints = `${ptM[1]} Points`;
        }
      }
      if (a.pointsPossible !== null && !cleanPoints && sanitizedCriteria.length > 0 && !cleanWeight) {
        const rubricSum = sanitizedCriteria.reduce((sum, c) => sum + (Number(c.points) || 0), 0);
        if (rubricSum > 0) {
          cleanPoints = `${rubricSum} Points`;
        }
      }

      // Keep assignments that have weight, points, due date, a scheduled week, deliverable keywords, or explicit assignment typing
      const hasDeliverableKeyword = /\b(?:paper|report|exam|examination|quiz|midterm|final|project|homework|problem\s+set|lab|presentation|deliverable|brief|essay|critique|discussion\s+board|peer\s+review|case\s+study|assignment|assessment|test|reflection|proposal|review|synthesis|conceptualization|mapping|genogram|treatment\s+plan|practicum|journal|portfolio|log|simulation|role\s*play|contribution|participation|attendance|evaluation|exercise|milestone|draft)\b/i.test(rawTitle);
      const isExplicitDeliverable = Boolean((a as any).isDeliverable || a.category === 'assignment' || a.category === 'deliverable' || (a.rubricCriteria && a.rubricCriteria.length > 0) || (a.fullInstructions && a.fullInstructions.length > 25));

      if (!cleanWeight && !cleanPoints && !parsedDue && !(resolvedWeek && resolvedWeek > 0) && !hasDeliverableKeyword && !isExplicitDeliverable) {
        continue;
      }

      // Check for duplicate mention of the exact same assignment
      const stemWord = (w: string) => w.toLowerCase().replace(/s+$/, '');
      const getAssignWords = (t: string) =>
        cleanAssignmentTitle(t)
          .toLowerCase()
          .replace(/^(?:in[\s-]class|due|completed?)\s+/i, '')
          .split(/[\s,./\-_]+/)
          .map(stemWord)
          .filter(w => w.length >= 4 && !/^(assignment|deliverable|project|paper|report|final|midterm|exam|quiz|grade|mark|class|course|student|students|worth)$/.test(w));

      const normTitle = rawTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
      const stemTitle = normTitle.replace(/s+$/, '');
      const candidateWords = getAssignWords(rawTitle);

      // Check for duplicate mention of the exact same assignment
      // Same assignment must have matching title AND matching schedule occurrence
      // (same week or same explicit due date). If weeks differ, they are RECURRING assignments,
      // UNLESS they are multi-session presentations/facilitations scheduled across presentation weeks!
      const existing = cleanAssignmentsList.find(existingA => {
        const existingNorm = existingA.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const existingStem = existingNorm.replace(/s+$/, '');
        const isExactTitle = existingNorm === normTitle || (existingStem.length >= 5 && existingStem === stemTitle);

        // If titles have different trailing numbers (e.g. "Assignment 1" vs "Assignment 10", "Quiz 2" vs "Quiz 20"), they are NOT the same!
        const numA = (existingNorm.match(/\d+$/) || [])[0];
        const numB = (normTitle.match(/\d+$/) || [])[0];
        if (numA && numB && numA !== numB) {
          return false;
        }

        const assignNumA = (existingA.title.match(/\b(?:assignment|simulation|quiz|part|milestone|module|exam|phase|stage|paper|deliverable|project|osce)\s*(\d+)\b/i) || existingA.title.match(/\b(\d+)\b/))?.[1];
        const assignNumB = (rawTitle.match(/\b(?:assignment|simulation|quiz|part|milestone|module|exam|phase|stage|paper|deliverable|project|osce)\s*(\d+)\b/i) || rawTitle.match(/\b(\d+)\b/))?.[1];
        if (assignNumA && assignNumB && assignNumA !== assignNumB) {
          return false;
        }

        const isSubstringTitle =
          (existingStem.includes(stemTitle) || stemTitle.includes(existingStem)) &&
          existingStem.length >= 6 &&
          stemTitle.length >= 6;

        const existingWords = getAssignWords(existingA.title);
        const overlapWords = candidateWords.filter(w => existingWords.includes(w));
        const isWordOverlapTitle = overlapWords.length >= 2 || (candidateWords.length === 1 && existingWords.length === 1 && overlapWords.length === 1);

        const isFuzzyTitle = isSubstringTitle || isWordOverlapTitle;

        if (!isExactTitle && !isFuzzyTitle) {
          return false;
        }

        // Check if this is a multi-session presentation or group facilitation (e.g. Weeks 5, 7, 8)
        const isMultiSessionDeliverable = /\b(?:presentations?|facilitations?|group\s+presentations?|group\s+facilitations?)\b/i.test(existingA.title) ||
          /\b(?:presentations?|facilitations?|group\s+presentations?|group\s+facilitations?)\b/i.test(rawTitle);

        // If BOTH have different positive week numbers -> DIFFERENT assignments (recurring), UNLESS multi-session presentation!
        if (resolvedWeek && existingA.weekNumber && existingA.weekNumber > 0 && resolvedWeek !== existingA.weekNumber) {
          if (!isMultiSessionDeliverable) {
            return false;
          }
        }

        // If BOTH have explicit different due dates -> DIFFERENT assignments (unless presentation)!
        if (parsedDue && existingA.dueDate && !isMultiSessionDeliverable) {
          const t1 = parsedDue.getTime();
          const t2 = new Date(existingA.dueDate).getTime();
          if (Math.abs(t1 - t2) > 24 * 60 * 60 * 1000) {
            return false;
          }
        }

        // For fuzzy matches: if BOTH already have conflicting scheduled weeks/dates, reject;
        // but if one is an overview assignment (no week/date yet) and the other is a scheduled occurrence, allow them to merge and hydrate!
        if (isFuzzyTitle && !isExactTitle && !isMultiSessionDeliverable) {
          const bothHaveWeeks = Boolean(resolvedWeek && existingA.weekNumber && existingA.weekNumber > 0);
          const bothHaveDates = Boolean(parsedDue && existingA.dueDate);
          if (bothHaveWeeks && resolvedWeek !== existingA.weekNumber) return false;
          if (bothHaveDates && Math.abs(parsedDue!.getTime() - new Date(existingA.dueDate!).getTime()) > 24 * 60 * 60 * 1000) return false;

          // If both assignments have explicit weight percentages and they are different (e.g. 20% vs 10%), they are separate assignments!
          if (cleanWeight && existingA.weightPercentage) {
            const w1 = parseInt(cleanWeight.replace(/\D/g, ''), 10);
            const w2 = parseInt(existingA.weightPercentage.replace(/\D/g, ''), 10);
            if (!isNaN(w1) && !isNaN(w2) && w1 !== w2) {
              return false;
            }
          }

          // If one is specifically a discussion board activity and the other is a report/paper, they are separate deliverables!
          const isA1Discussion = /\b(?:discussion|forum|db)\b/i.test(rawTitle);
          const isA2Discussion = /\b(?:discussion|forum|db)\b/i.test(existingA.title);
          if (isA1Discussion !== isA2Discussion) {
            return false;
          }
        }

        return true;
      });

      if (existing) {
        // Prefer formal/cleaner title if one had extra boilerplate or was an informal schedule note
        const isExistingInformal = /^(?:due|complete|students\s+will|in[\s-_]class)\b/i.test(existing.title) || /^[a-z]/.test(existing.title);
        const isCandidateInformal = /^(?:due|complete|students\s+will|in[\s-_]class)\b/i.test(rawTitle) || /^[a-z]/.test(rawTitle);
        if (isExistingInformal && !isCandidateInformal && rawTitle.length >= 4) {
          existing.title = rawTitle;
        } else if (!isCandidateInformal && (rawTitle.includes('/') || rawTitle.includes('Genogram'))) {
          existing.title = rawTitle;
        } else if (!isCandidateInformal && rawTitle.length < existing.title.length && rawTitle.length >= 5) {
          existing.title = rawTitle;
        }
        // Enrich existing assignment with details from detailed section
        if (!existing.dueDate && parsedDue) existing.dueDate = parsedDue;
        if ((!existing.weekNumber || existing.weekNumber <= 0) && resolvedWeek) existing.weekNumber = resolvedWeek;
        if (!existing.weightPercentage && cleanWeight) existing.weightPercentage = cleanWeight;
        if ((!existing.pointsPossible || rawPoints) && cleanPoints) existing.pointsPossible = cleanPoints;
        if (!existing.assignmentNumber && resolvedAssignNum) {
          existing.assignmentNumber = resolvedAssignNum;
          existing.assignmentNumberLabel = resolvedAssignNumLabel;
        }
        const candidateInstructions = a.fullInstructions || a.instructions || a.description;
        if (
          candidateInstructions &&
          candidateInstructions !== 'Parsed from course syllabus.' &&
          candidateInstructions !== 'Parsed from syllabus.' &&
          (!existing.fullInstructions ||
            existing.fullInstructions === 'Parsed from course syllabus.' ||
            existing.fullInstructions === 'Parsed from syllabus.' ||
            candidateInstructions.length > (existing.fullInstructions?.length || 0))
        ) {
          existing.fullInstructions = candidateInstructions;
        }
        if (!existing.noteText && (a.noteText || assignMediaUrl)) {
          existing.noteText = a.noteText || assignMediaUrl;
        }
        if (!existing.mediaUrl && assignMediaUrl) existing.mediaUrl = assignMediaUrl;
        if ((!existing.rubricCriteria || existing.rubricCriteria.length === 0) && sanitizedCriteria.length > 0) {
          existing.rubricCriteria = sanitizedCriteria;
        }
        // Merge scheduled weeks for multi-session deliverables
        const candidateWeeks: number[] = Array.isArray(a.scheduledWeeks)
          ? [...a.scheduledWeeks]
          : (Array.isArray((a as any).scheduled_weeks) ? [...(a as any).scheduled_weeks] : []);
        if (resolvedWeek) {
          candidateWeeks.push(resolvedWeek);
        }
        if (candidateWeeks.length > 0) {
          const baseWeeks = existing.scheduledWeeks || (existing.weekNumber ? [existing.weekNumber] : []);
          const merged = Array.from(new Set([...baseWeeks, ...candidateWeeks])).sort((x, y) => x - y);
          existing.scheduledWeeks = merged;
        }
        continue;
      }

      const initialInstructions = (a.fullInstructions && a.fullInstructions !== 'Parsed from course syllabus.' && a.fullInstructions !== 'Parsed from syllabus.')
        ? a.fullInstructions
        : (a.instructions || a.description || null);

      cleanAssignmentsList.push({
        id: `a-${Date.now()}-${i}`,
        courseCode: a.courseCode || a.course_code || undefined,
        title: rawTitle,
        assignmentNumber: resolvedAssignNum,
        assignmentNumberLabel: resolvedAssignNumLabel,
        weekNumber: resolvedWeek || 0,
        scheduledWeeks: (Array.isArray(a.scheduledWeeks) && a.scheduledWeeks.length > 0)
          ? a.scheduledWeeks
          : (Array.isArray((a as any).scheduled_weeks) && (a as any).scheduled_weeks.length > 0)
          ? (a as any).scheduled_weeks
          : (resolvedWeek ? [resolvedWeek] : undefined),
        dueDate: parsedDue,
        fullInstructions: initialInstructions,
        pointsPossible: cleanPoints,
        pointsBreakdown: a.pointsBreakdown || null,
        rubricJSON: sanitizedCriteria.length > 0 ? JSON.stringify(sanitizedCriteria) : null,
        noteText: a.noteText || assignMediaUrl || null,
        isCompleted: false,
        isDeleted: false,
        weightPercentage: cleanWeight,
        moduleMention: a.moduleMention || (resolvedWeek ? `Week ${resolvedWeek}` : undefined),
        subTypeRaw: a.subType || a.subTypeRaw || a.category || 'assignment',
        mediaUrl: assignMediaUrl,
        relevantTopics: resolvedWeek ? `Week ${resolvedWeek}` : undefined,
        isFavorite: false,
        rubricCriteria: sanitizedCriteria
      });
    }

    // Preserve sequential assignment numbering if course has numbered deliverables
    const hasAnyNum = cleanAssignmentsList.some(a => a.assignmentNumber != null);
    const allUnassigned = cleanAssignmentsList.length >= 2 && cleanAssignmentsList.every(a => !a.weekNumber || a.weekNumber <= 0);
    if (hasAnyNum || allUnassigned) {
      for (let idx = 0; idx < cleanAssignmentsList.length; idx++) {
        if (!cleanAssignmentsList[idx].assignmentNumber) {
          cleanAssignmentsList[idx].assignmentNumber = idx + 1;
          cleanAssignmentsList[idx].assignmentNumberLabel = `Assignment ${idx + 1}`;
        }
      }
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
      a => targetCourse ? isItemForCourse(a, targetCourse) : a.courseId === targetCourseId
    );
    const otherAssignments = existingAssignments.filter(
      a => targetCourse ? !isItemForCourse(a, targetCourse) : a.courseId !== targetCourseId
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
        const mergedRubric = (newA.rubricCriteria && newA.rubricCriteria.length > 0)
          ? newA.rubricCriteria
          : (existingA.rubricCriteria || []);
        const mergedPointsPossible = newA.pointsPossible || existingA.pointsPossible;
        const mergedTotalPoints = (newA as any).totalPoints ?? (existingA as any).totalPoints ?? (newA as any).points ?? (existingA as any).points;
        const mergedPoints = (newA as any).points ?? (existingA as any).points ?? mergedTotalPoints;
        const mergedWeightPercentage = newA.weightPercentage || existingA.weightPercentage;
        const mergedInstructions = newA.fullInstructions || existingA.fullInstructions;

        mergedCourseAssignments[matchIdx] = {
          ...newA,
          id: existingA.id,
          isCompleted: existingA.isCompleted,
          isDeleted: existingA.isDeleted,
          isFavorite: existingA.isFavorite,
          noteText: existingA.noteText || newA.noteText,
          courseId: targetCourseId,
          rubricCriteria: mergedRubric,
          pointsPossible: mergedPointsPossible,
          weightPercentage: mergedWeightPercentage,
          fullInstructions: mergedInstructions
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
      r => targetCourse ? isItemForCourse(r, targetCourse) : r.courseId === targetCourseId
    );
    const otherReadings = existingReadings.filter(
      r => targetCourse ? !isItemForCourse(r, targetCourse) : r.courseId !== targetCourseId
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
    const cleanDocTitle = (newVaultDoc?.title || '').toLowerCase();
    const updatedVaultDocs = newVaultDoc && newVaultDoc.id
      ? [
          newVaultDoc,
          ...existingVaultDocs.filter(d => (d.title || '').toLowerCase() !== cleanDocTitle)
        ]
      : existingVaultDocs;

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
