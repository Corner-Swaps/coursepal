/**
 * LocalSyllabusParser
 * Deterministic multi-pass lexer and parser engine for course syllabi.
 * 1:1 match with Swift LocalSyllabusParser
 */

import {
  CourseDTO,
  WeekDTO,
  ReadingDTO,
  AssignmentDTO,
  RubricCriterionDTO,
  ItemDTO,
  MediaType
} from '../types/models';
import { FacultyExtractor } from './FacultyExtractor';
import {
  cleanChapterFromRaw,
  isGenericPlaceholderReadingTitle,
  isDeliverableNotReading,
  cleanRubricCriterionName,
  isInvalidAssignmentTitle,
  parseChapterNumbers,
  deduplicateReadingTitle
} from '../utils/readingDisplayHelper';

export type SemanticCategory = 'assignment' | 'reading' | 'media' | 'inClass' | 'noise';

export interface ExtractedDateInfo {
  displayString: string;
  isoString: string;
  date: Date;
}

export class LocalSyllabusParser {
  private static _instance: LocalSyllabusParser;
  public static get shared(): LocalSyllabusParser {
    if (!this._instance) {
      this._instance = new LocalSyllabusParser();
    }
    return this._instance;
  }

  // Precompiled regex patterns
  private static readonly pointsRegex = /\b(\d{1,4})\s*(pts|points|pt|%|percent)\b|\b(?:points(?:\s+possible)?|pts|worth|point\s+value)\s*[:\-–—]?\s*(\d{1,4})\b/i;
  private static readonly percentRegex = /\b(\d{1,3})%/;
  private static readonly assignmentNumRegex = /\(?assignment\s*\d{1,2}\)?/i;
  private static readonly ptsMatchesRegex = /\b(\d{1,4})\s*(pts|points|pt\b)/i;
  private static readonly explicitAssignNumRegex = /\(?assignment\s*(\d{1,2})\)?/i;

  private static readonly weekHeaderRegexes: RegExp[] = [
    /^\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(?:module|modu\s*le|week|session|unit|class|lecture|meeting|block|part|day)\s*(\d{1,2})\b/i,
    /^\s*(?:module|modu\s*le|week|session|unit|class|lecture|meeting|block|part|day)\s*(\d{1,2})\b/i,
    /^\s*(?:week|wk\.?|w)\s*0?(\d{1,2})\b/i,
    /^\s*(\d{1,2})\s*[-–—]\s*/i,
    /^\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(?:reading\s*week|readi\s*ng\s*week|spring\s*break|fall\s*break|thanksgiving\s*break|finals\s*week|exam\s*week|review\s*week)/i,
    /^\s*(?:reading\s*week|readi\s*ng\s*week|spring\s*break|fall\s*break|thanksgiving\s*break|finals\s*week|exam\s*week|review\s*week)\b/i,
    /^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\b/i,
    /^\s*(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?\b/i,
    /^\s*(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
  ];

  private static readonly citationRegex = /([A-Z\u00C0-\u024F][a-zA-Z\u00C0-\u024F\.\-–]+(?:\s*(?:&|and|,)\s*[A-Z\u00C0-\u024F][a-zA-Z\u00C0-\u024F\.\-–]+|\s+et\s+al\.?){0,3}\s*\(?\s*(?:chapters?|chs?\.?|chps?\.?|chap\.?|ch\.?|ch\b|pages?|pp?\.)\s*[:\-–—.]*\s*\d+(?:\.\d+)?([-\u2013\u2014\s&,and\+]+\d+(?:\.\d+)?)*\)?|\b(?:chapters?|chs?\.?|chps?\.?|chap\.?|ch\.?|ch\b|pages?|pp?\.)\s*[:\-–—.]*\s*\d+(?:\.\d+)?([-\u2013\u2014\s&,and\+]+\d+(?:\.\d+)?)*|[A-Z\u00C0-\u024F][a-zA-Z\u00C0-\u024F\.\-–]+(?:\s+et\s+al\.?|\s*(?:&|and)\s*[A-Z\u00C0-\u024F][a-zA-Z\u00C0-\u024F\.\-–]+)?\s*\(\s*\d{4}\s*\)|[A-Z\u00C0-\u024F][a-zA-Z\u00C0-\u024F\.\-–]+(?:\s+et\s+al\.?|\s*(?:&|and)\s*[A-Z\u00C0-\u024F][a-zA-Z\u00C0-\u024F\.\-–]+)\s*\([A-Za-z0-9\u00C0-\u024F\s\-–—/]+\)|\bRFC\s*\d+(?:\s*\([^\)]+\))?|See\s+Brightspace[^\n]*|Reading\s*Week)/i;
  private static readonly technicalDocRegex = /\b[A-Z](?:[a-zA-Z0-9&/.]|-(?=[a-zA-Z0-9])|\s+(?![-–—]\s+))+?\b(?:Docs?|Documentation|Specs?|Specifications?|Papers?|Technical\s+Papers?|Whitepapers?|Guides?|User\s+Guides?|Pricing\s+Guides?|Core\s+Architecture|Architecture\s+Specs?|Architecture\s+Whitepapers?|Manuals?|Technical\s+Overview|System\s+Overview|Guidelines?|Standards?)\b|\bRFC\s*\d+(?:\s*\([^\)]+\))?/i;
  private static readonly endDocRegex = /\b((?:[A-Z]{2,}(?:-[A-Z0-9]+)*|Ansys|MATLAB|Python|Docker|Kubernetes|AWS|GCP|Azure|Linux|React|Django|Android|Apple|PostgreSQL|MySQL|Git|GitHub|Tableau)\b(?:\s+[A-Za-z0-9\.\-–/&]+){0,2}\s+(?:User\s+Manual(?:\s*&\s*Specs?)?|Docs?|Documentation|Specs?|Specifications?|Technical\s+Papers?|Whitepapers?|Whitepaper|Papers?|User\s+Guides?|Pricing\s+Guides?|Guides?|Manuals?|Technical\s+Overview|System\s+Overview|Guidelines?|Standards?))\s*$/;
  private static readonly chapterRegex = /\b(chapters?|chs?\.?|chps?\.?|chap\.?)\s*(\d+(?:\.\d+)?([-\u2013\u2014\s&,and\+]+\d+(?:\.\d+)?)*)\b/i;
  private static readonly pagesRegex = /\b(pages?|pp?\.?)\s*(\d+(?:\.\d+)?([-\u2013\u2014\s&,and\+]+\d+(?:\.\d+)?)*)\b/i;

  private static readonly dateExtractionRegexes: RegExp[] = [
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*[\/\-–]\s*(\d{1,2})(?:st|nd|rd|th)?)?(?:\s*,?\s*(\d{4}))?\b/i,
    /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
    /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/,
    /\b(\d{1,2})[-/](\d{1,2})\b/
  ];

  private static readonly dayNameRegex = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i;
  private static readonly isoDateRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
  private static readonly slashDateRegex = /^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/;
  private static readonly standaloneCodeRegex = /\b(?!(?:TOTAL|GRADE|POINTS?|MODULE|WEEK|ROOM|LAB|SECTION|CLASS|COURSE|CREDITS?|TERM|FALL|SPRING|SUMMER|WINTER|DATES?|TIMES?|HOURS?|PAGES?|EDITIONS?|JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\b)([A-Z]{2,6}\s*\d{3,4}[A-Z]?|\d{1,2}\.\d{2,4}[A-Z]?)\b/i;
  private static readonly codeWithTitleRegex = /\b(?!(?:TOTAL|GRADE|POINTS?|MODULE|WEEK|ROOM|LAB|SECTION|CLASS|COURSE|CREDITS?|TERM|FALL|SPRING|SUMMER|WINTER|DATES?|TIMES?|HOURS?|PAGES?|EDITIONS?|JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\b)([A-Z]{2,6}\s*\d{3,4}[A-Z]?|\d{1,2}\.\d{2,4}[A-Z]?)\s*[:\-–—]?\s*(.+)/i;

  private static readonly sectionBoilerplateMarkers = [
    'academic integrity', 'student code of conduct', 'disability services', 'title ix',
    'diversity statement', 'institutional policy', 'anti-racism statement', 'land acknowledgement',
    'grading scale', 'grading criteria', 'letter grades', 'attendance policy', 'class participation policy',
    'late work policy', 'late submission policy', 'make-up policy', 'ai usage policy',
    'generative ai statement', 'technology requirements', 'support services', 'wellness and counseling',
    'mental health resources', 'library resources', 'writing center', 'course outcomes',
    'learning objectives', 'program outcomes', 'course description', 'vision, mission',
    'territorial acknowledgement', 'hallmarks of maturity'
  ];

  private static readonly lineNoisePatterns = [
    'cityu requires', 'city university in canada acknowledges', 'coast salish peoples',
    'copyright ©', 'all rights reserved', 'printed on', 'retrieved from',
    'last updated', 'office hours:', 'zoom link:', 'phone:', 'prerequisites:',
    'corequisites:', 'rubric summary', 'late deductions', 'late assignments deductions',
    'apa style guide tutorial', 'sensitive content notice', 'traffic-light approach'
  ];

  // MARK: - Main Parsing Entry Point
  public parseText(rawText: string): CourseDTO {
    const termYear = this.extractYear(rawText);

    // Pass 0: Multi-Pass Lexer - Reconstruct split sentences
    const reconstitutedLines = this.lexerReconstituteLines(rawText);

    // Pass 1: Extract Course Identity
    const { code: courseCode, name: courseName } = this.extractCourseIdentity(reconstitutedLines);

    // Pass 2: Points Heuristic Anchor & Assignment Parsing (Pass A)
    let assignments = this.extractAssignmentsWithPointsHeuristic(reconstitutedLines, termYear, courseCode);

    // Pass 3: Weekly Schedule & Readings Parsing (Pass B)
    const { weeks, scheduleAssignments } = this.extractWeeklyScheduleAndReadings(
      reconstitutedLines,
      rawText,
      termYear,
      courseName,
      courseCode
    );

    // Merge schedule assignments deduplicated & enrich due dates / weights
    for (const sa of scheduleAssignments) {
      const idx = assignments.findIndex(a => {
        if (this.fuzzyMatch(a.title, sa.title)) return true;
        const wordsA = a.title.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
        const wordsSa = sa.title.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
        const overlap = wordsA.filter(w => wordsSa.includes(w));
        return overlap.length >= 2 || (wordsA.length === 1 && overlap.length === 1);
      });
      if (idx >= 0) {
        const existing = assignments[idx];
        const mergedDate = existing.dueDate ?? sa.dueDate;
        const mergedWeek = (existing.weekNumber && existing.weekNumber > 0) ? existing.weekNumber : sa.weekNumber;
        const mergedWeight = existing.weightPercentage ?? sa.weightPercentage;
        const mergedPts = existing.pointsPossible ?? sa.pointsPossible;
        const mergedInstructions = (existing.fullInstructions && existing.fullInstructions.length > 25 && !existing.fullInstructions.includes('Parsed from'))
          ? existing.fullInstructions
          : (sa.fullInstructions && sa.fullInstructions.length > 25 && !sa.fullInstructions.includes('Parsed from') ? sa.fullInstructions : (existing.fullInstructions || sa.fullInstructions));
        const mergedMedia = existing.mediaUrl ?? sa.mediaUrl;
        assignments[idx] = {
          ...existing,
          title: existing.title.length >= sa.title.length ? existing.title : sa.title,
          weekNumber: mergedWeek,
          dueDate: mergedDate,
          pointsPossible: mergedPts,
          weightPercentage: mergedWeight,
          fullInstructions: mergedInstructions,
          mediaUrl: mergedMedia,
          noteText: existing.noteText ?? sa.noteText
        };
      } else if (assignments.length === 0) {
        assignments.push(sa);
      }
    }

    const requiredTexts = this.extractRequiredTextsAndResources(reconstitutedLines);

    let paddedWeeks = this.padWeeks(weeks, courseName, courseCode);
    this.harmonizeWeekDateRangesAndAssignments(paddedWeeks, assignments, rawText, termYear);

    const synthesizedItems: ItemDTO[] = [];
    for (const a of assignments) {
      synthesizedItems.push({
        title: a.title,
        category: 'Assignment',
        subType: 'PAPER',
        description: a.fullInstructions,
        points: a.pointsPossible,
        percentage: a.weightPercentage,
        weekNumber: undefined,
        dueDateIso: a.dueDate,
        mediaUrl: a.noteText,
        rubric: a.rubric,
        rubricCriteria: a.rubricCriteria ?? a.rubric
      });
    }
    for (const w of paddedWeeks) {
      for (const r of w.readings ?? []) {
        synthesizedItems.push({
          title: r.title,
          authorName: r.authorName,
          resourceTitle: r.resourceTitle,
          category: 'Reading',
          subType: r.mediaType ?? 'TEXTBOOK',
          description: r.summaryText,
          weekNumber: w.weekNumber,
          dueDateIso: r.dueDate,
          mediaUrl: r.videoUrl,
          relevantTopics: r.relevantTopics ?? w.theme,
          chapterText: r.chapterText,
          pagesText: r.pagesText,
          summaryText: r.summaryText,
          keyTakeaways: r.keyTakeawaysText,
          estimatedTime: r.estimatedTimeText
        });
      }
    }
    // Requirement 5: Do NOT convert bibliography required texts into reading tasks.
    // Retain them strictly in the textbooks resource catalog.
    const textbookCatalog = requiredTexts.map(t => ({
      title: t.title,
      authorName: t.authorName ?? null
    }));

    const sharingCode = Math.floor(100000 + Math.random() * 900000).toString();
    const facultyInfo = FacultyExtractor.extractFaculty(rawText);

    let externalScheduleNotice: string | null = null;
    for (let li = 0; li < reconstitutedLines.length; li++) {
      const line = reconstitutedLines[li];
      if (
        /(?:course schedule|schedule).*(?:posted|provided|available|distributed|uploaded).*(?:separate document|brightspace|canvas|moodle|blackboard)/i.test(line) ||
        /(?:separate document|brightspace|canvas|moodle|blackboard).*(?:course schedule|schedule)/i.test(line) ||
        /^NOTE:\s*Course schedule will be posted/i.test(line)
      ) {
        let notice = line.trim();
        if (li + 1 < reconstitutedLines.length && !/(?:brightspace|canvas|moodle|blackboard)/i.test(notice)) {
          const nextL = reconstitutedLines[li + 1].trim();
          if (/(?:separate document|brightspace|canvas|moodle|blackboard)/i.test(nextL)) {
            notice = `${notice} ${nextL}`.trim();
          }
        }
        externalScheduleNotice = notice;
        break;
      }
    }

    return {
      id: `course-${Math.random().toString(36).substring(2, 10)}`,
      creatorId: 'local-user',
      courseName,
      courseCode,
      instructorName: facultyInfo.name,
      instructorEmail: facultyInfo.email,
      officeHours: facultyInfo.officeHours,
      courseDescription: this.extractCourseDescription(reconstitutedLines),
      termWeeks: paddedWeeks.length,
      sharingCode,
      weeks: paddedWeeks,
      assignments,
      items: synthesizedItems,
      textbooks: textbookCatalog,
      externalScheduleNotice
    };
  }

  // MARK: - PASS 0: Lexer & Line Reconstitution
  public lexerReconstituteLines(rawText: string): string[] {
    const rawLinesPre = (rawText || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(line => {
        if (line.startsWith('|') && line.endsWith('|')) {
          const inner = line.substring(1, line.length - 1);
          const cells = inner.split('|').map(c => c.trim()).filter(c => c.length > 0);
          if (cells.length === 0 || cells.every(c => /^[:\-\s]+$/.test(c))) {
            return '';
          }
          return cells.join('\t');
        }
        return line;
      })
      .filter(l => l.length > 0);
    const deinterleavedPre = this.deinterleaveScheduleLines(rawLinesPre);
    const normalizedInput = deinterleavedPre.join('\n');

    let cleanInput = normalizedInput
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/https?:\/\/[^\s]*simplesyllabus\.com[^\s]*\s*(?:\d+\/\d+)?/gi, '\n')
      .replace(/\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s*(?:AM|PM)[^\n]*/gi, '\n')
      .replace(/(?:^|\n)\s*[A-Z]{2,5}\s+\d{3,4}:[^\n]+?\s+\d{1,3}\s*(?:\n|$)/gi, '\n')
      .replace(/\b(Grading\s+Criteria\s*Grade\s+Points|Grading\s+Criteria|Criteria\s*Grade\s+Points(?:\s+%\s+of\s+Grade)?)/gi, '\n$1\n')
      .replace(/(\d{1,3}\s*(?:Points|pts|pt)\s*(?:\d{1,3}%)?\s*)(?=(?!possible\b)[A-Z])/gi, '$1\n')
      .replace(/(\bTotal\s+\d+\s+Points\s*(?:\d+%)?\s*)/gi, '\n$1\n')
      .replace(/(\d{1,3}%\s*)(?=(?!Module|Due|Week|Continuous|End\s+of\s+Term)[A-Z])/g, '$1\n')
      .replace(/([A-Za-z])(\d{1,3}%)/g, '$1 $2')
      .replace(/([a-z])(Clinical\s+Dossier|CTRS\s+Manual|Peer\s+Consultation|Indigenous\s+Perspectives|Canadian\s+Code)/gi, '$1 $2')
      .replace(/Cohort\s+([AB])(CTRS\s+Manual)/gi, 'Cohort $1 $2')
      .replace(/(\b[A-Za-z][A-Za-z \t,&–\-/]+?\(\s*\d{1,3}%\s*\)\s*[-–—]\s*)/gi, '\n$1')
      .replace(/(?<!in\s+|on\s+|of\s+|about\s+)(\b(?:Sexuality Counseling: Theory|Human Sexuality in a World|Growing into Resilience: Sexual|Research Design: Qualitative|Theory and Practice of Group))/gi, '\n$1')
      .replace(/\bMODU\s*\n\s*LE\s*(\d+)/gi, 'MODULE $1')
      .replace(/\bMODU\s*\n\s*LE\b/gi, 'MODULE')
      .replace(/\bMODU\s+LE/gi, 'MODULE')
      .replace(/\bREADI\s*\n\s*NG\s*\n\s*WEEK\b/gi, 'READING WEEK')
      .replace(/\bREADI\s*\n\s*NG\b/gi, 'READING')
      .replace(/\bREADI\s+NG\s*(?:WEEK)?/gi, 'READING WEEK')
      .replace(/(\d{1,2}\/\d{1,2}\/)\s*2\s*(\d)\b/g, (_m, g1, g2) => `${g1}2${g2}`)
      .replace(/(\d{1,2}\/\d{1,2}\/2)\s+(\d)\b/g, (_m, g1, g2) => `${g1}${g2}`)
      .replace(/(\d{1,2}\/\d{1,2}\/2)\s*\n\s*(\d)\b/g, (_m, g1, g2) => `${g1}${g2}`)
      .replace(/(\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*\n\s*(MODULE|WEEK|SESSION|READING\s*WEEK|UNIT)\b/gi, '$1 $2')
      .replace(/\b(Corey|Yalom|Creswell|Gehart|Nichols|Davis)\s*\n\s*(Ch(?:apters?|\.)?\s*[\d\s&,\-–\+]+)/gi, '$1 $2')
      .replace(/\b(Ch(?:apters?|\.)?\s*[\d\s&,\-–\+]+&)\s*\n\s*(\d+)(?![/\d])/gi, '$1 $2')
      .replace(/\b(Yalom\s+Ch\.\s*[\d\s&,\-–\+]+&)\s*\n\s*(\d+)(?![/\d])/gi, '$1 $2')
      // Universal author citation wraps: e.g. "Shoeybi et al.\n(Megatron)", "Author\n(Ch. 1-3)", "Author\n(2020)"
      .replace(/([A-Z][a-zA-Z\.\-–]+(?:\s+et\s+al\.?)?)\s*\n\s*(\((?:Ch(?:apters?|\.)?\s*[\d\s&,\-–\+]+|\d{4}|[A-Za-z0-9\s\-–—/]+)\))/g, '$1 $2')
      // Universal technical doc suffix wraps: e.g. "Architecture\nSpecs", "Technical\nPaper", "Operator\nDocs", "AI\nWhitepaper"
      .replace(/\b([A-Z][a-zA-Z0-9\.\-–]+(?:\s+[A-Z][a-zA-Z0-9\.\-–]+)*)\s*\n\s*(Specs?|Specifications?|Whitepapers?|Docs?|Documentation|Papers?|Technical\s+Papers?|Guides?|User\s+Guides?|Core\s+Architecture)\b(?![^\n]*(?:%|\bpts\b|\bpoints\b))/g, '$1 $2')
      // Associate standalone week digit preceding a calendar date (e.g. "5 \n July 31st" -> "Week 5 - July 31st")
      .replace(/(?:^|\n)\s*(\d{1,2})\s*\n\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*[\/\-–]\s*\d{1,2})?)/gi, '\nWeek $1 - $2\n')
      .replace(/(?:^|\n)\s*(\d{1,2})\s*\n\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/g, '\nWeek $1 - $2\n')
      // Pre-split inline week headers with dates (e.g. "8 August 21st Guest Speaker...")
      .replace(/(?<!\b(?:week|wk|module|mod|unit|session))(\s+)(?=\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\b)/gi, '\n')
      // Pre-split inline reading week, due lines, and in-class assignment tags (preserve reading week when part of week header or notice)
      .replace(/(\s+)(?=Reading\s+Week\b)/gi, (m, p1, offset, str) => {
        const prevSnippet = str.slice(Math.max(0, offset - 60), offset);
        if (/\b(?:week|wk|module|session|unit)\s*\d+/i.test(prevSnippet) || /\bduring\b/i.test(prevSnippet) || /\bnotice\b/i.test(prevSnippet)) {
          return ' ';
        }
        return '\n';
      })
      .replace(/(\b(?:week|wk|module|session|unit)\s*\d+)(?=[A-Za-z])/gi, '$1 ')
      .replace(/(\d+)(?=(?:Articles?|Review)\b)/gi, '$1 ')
      .replace(/(?<![\t|][^\n]*)(\s+)(?=Due:\s+)/gi, '\n')
      .replace(/(?<![\t|][^\n]*)([^\s\n])(?=Due:\s+)/gi, '$1\n')
      .replace(/(?<![\t|][^\n]*)(\s+)(?=In\s+Class\s+Assignment:\s+)/gi, '\n')
      .replace(/(\s+)(?=The\s+following\s+modules\s+and\s+topics\b)/gi, '\n')
      .replace(/(?:\b|\s)(Faculty\s+Information)\s*[:\-–]?\s*/gi, '\nFaculty Information: ');

    const rawInputLines = cleanInput
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const initialLines: string[] = [];
    for (const line of rawInputLines) {
      if (line.startsWith('|') && line.endsWith('|')) {
        const inner = line.substring(1, line.length - 1);
        const cells = inner.split('|').map(c => c.trim()).filter(c => c.length > 0);
        if (cells.length === 0 || cells.every(c => /^[:\-\s]+$/.test(c))) {
          continue; // Markdown table divider row, skip
        }
        initialLines.push(cells.join('\t'));
      } else {
        initialLines.push(line);
      }
    }

    const rawLines: string[] = [];
    for (let i = 0; i < initialLines.length; i++) {
      const l = initialLines[i];
      if (/\(assignment\s*$/i.test(l) && i + 1 < initialLines.length && /^\d+\)/.test(initialLines[i + 1])) {
        rawLines.push(l + ' ' + initialLines[i + 1]);
        i++;
      } else {
        rawLines.push(l);
      }
    }

    const deinterleavedLines = this.deinterleaveScheduleLines(rawLines);

    const reconstituted: string[] = [];
    let buffer = '';

    for (const rawLine of deinterleavedLines) {
      if (rawLine.includes('\t')) {
        if (buffer.length > 0) {
          reconstituted.push(buffer);
          buffer = '';
        }
        reconstituted.push(rawLine);
        continue;
      }
      const line = rawLine;
      const lower = line.toLowerCase();

      // Skip system noise timestamps, page numbers, and simplesyllabus navigation links
      if (
        lower.includes('simple syllabus') ||
        lower.includes('simplesyllabus') ||
        lower.includes('error_codes') ||
        lower.includes('codes=') ||
        lower.includes('cityu.edu/print') ||
        /\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}/.test(lower)
      ) {
        continue;
      }

      // Strip total points noise prefix if followed by an assignment title
      const totalPointsPrefix = line.match(/^total\s*100\s*(points|pts|%)?\s*/i);
      if (totalPointsPrefix) {
        const prefix = totalPointsPrefix[0];
        const remainder = line.substring(prefix.length).trim();
        if (remainder.length > 0) {
          if (buffer.length > 0) reconstituted.push(buffer);
          reconstituted.push(prefix.trim());
          buffer = remainder;
          continue;
        }
      }

      const trimmed = line.trim();
      const numVal = parseInt(trimmed, 10);
      const isStandaloneDigit = !isNaN(numVal) && String(numVal) === trimmed && numVal >= 1 && numVal <= 16;
      const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const containsMonth = months.some(m => lower.includes(m));
      const isDateHeader = /^\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/.test(line);

      const isHeader = isStandaloneDigit || containsMonth || isDateHeader ||
        lower.startsWith('week') || lower.startsWith('module') || lower.startsWith('unit') ||
        lower.startsWith('chapter') || lower.startsWith('session') || lower.startsWith('reading week') ||
        lower.startsWith('ch.') || lower.startsWith('ch ') ||
        lower.startsWith('watch') || lower.startsWith('required') ||
        lower.startsWith('read') || lower.startsWith('listen') ||
        lower.startsWith('podcast') || lower.includes('syllabus') ||
        lower.startsWith('the following') || lower.includes('modules and topics') ||
        lower.includes('course') || lower.includes('policy') ||
        lower.includes('grading') || lower.includes('% of final grade') || lower.includes('% of grade') ||
        (line.includes(':') && line.length < 60) ||
        lower.includes('%') || lower.includes('point') || lower.includes('pts') || lower.includes('due') ||
        lower.includes('assignment') || lower.includes('report') || lower.includes('presentation') ||
        line.includes(';') ||
        LocalSyllabusParser.citationRegex.test(line) ||
        LocalSyllabusParser.technicalDocRegex.test(line) ||
        line.startsWith('•') || line.startsWith('*') || line.startsWith('-');

      if (buffer.length === 0) {
        buffer = line;
      } else {
        const lowerBuf = buffer.toLowerCase().trim();
        const isTrailingConnector = /(?:&|and|or|with|for|to|of|in|on|continuous)\s*$/i.test(lowerBuf);
        const isDueTrailing = lowerBuf.endsWith('due') || lowerBuf.endsWith('- due') || lowerBuf.endsWith('– due') || lowerBuf.endsWith('due:') || lowerBuf.endsWith('due sunday,') || lowerBuf.endsWith('due friday,') || lowerBuf.endsWith('–') || lowerBuf.endsWith('-');
        const isHeadingBuffer = lowerBuf.endsWith(':') ||
          lowerBuf.includes('grading') ||
          lowerBuf.includes('requirements') ||
          lowerBuf.includes('evaluation') ||
          lowerBuf.includes('assessment') ||
          lowerBuf.includes('breakdown') ||
          lowerBuf.includes('policy') ||
          lowerBuf.includes('schedule');
        const isOverviewTableSplit = !isHeadingBuffer &&
          /^\s*(?:(?:assignment|deliverable|task|paper|exam)\s*\d+[:\-–\s]*)?(\d{1,3}%|\(\d{1,3}%\))\s*$/.test(line) &&
          !lowerBuf.includes('%') && !lowerBuf.includes('overview') && buffer.length < 60;

        const bufferHasAssessment = /(\d{1,3}%|\b\d{1,4}\s*(?:points|pts|pt)\b)/i.test(buffer);
        const isDeliverableContinuation = isDueTrailing || (
          bufferHasAssessment && (
            /^(?:7th\)?|matrix|recording|reflection\s*log|\)|&|-|–)\b/i.test(line.trim()) ||
            /^(?:formal|structured|simulation|prompts|evaluation|report)\b/i.test(line.trim())
          )
        );

        const bufferIsWeekHeader = /^\s*(?:week|wk|module|mod|unit|session)\s*\d+/i.test(buffer);
        const lineIsReadingOrCitation = /\b(?:ch\.|chapters?|pages?|pp?\.)\s*\d+/i.test(line) ||
          /\(\s*(?:ch|pp?)\b/i.test(line) ||
          line.includes(';') ||
          LocalSyllabusParser.citationRegex.test(line) ||
          LocalSyllabusParser.technicalDocRegex.test(line) ||
          /\b(?:clinical\s+dossier|ctrs\s+manual|peer\s+consultation|indigenous\s+perspectives|canadian\s+code)\b/i.test(line);

        if (isDeliverableContinuation || isOverviewTableSplit || (isTrailingConnector && !isHeader)) {
          buffer += ' ' + line;
        } else if (isHeader || bufferHasAssessment || (bufferIsWeekHeader && lineIsReadingOrCitation)) {
          reconstituted.push(buffer);
          buffer = line;
        } else {
          const isBufferTableHeader = !lowerBuf.includes('%') && !/\b\d{1,4}\s*(?:pts|points|pt)\b/i.test(lowerBuf) && (
            (lowerBuf.includes('assignment') && (lowerBuf.includes('weight') || lowerBuf.includes('description') || lowerBuf.includes('deliverable') || lowerBuf.includes('format') || lowerBuf.includes('due'))) ||
            (lowerBuf.includes('timeline') && (lowerBuf.includes('topic') || lowerBuf.includes('reading')))
          );

          if (isBufferTableHeader) {
            reconstituted.push(buffer);
            buffer = line;
          } else {
            const isBufferShortHeading = !isTrailingConnector &&
              buffer.length <= 60 &&
              !/^\s*(?:week|wk|module|mod|unit|session)\s*\d+/i.test(buffer.trim()) &&
              !buffer.includes('.') &&
              !buffer.includes(';') &&
              /^[A-Za-z0-9]/.test(buffer.trim()) &&
              /^[A-Za-z0-9]/.test(line.trim()) &&
              !/^(the|this|that|these|those|and|or|in|on|at|for|to|with|by|from|as|if|when|while|after|before)\b/i.test(line.trim());
            const isBufferSectionHeader = lowerBuf === 'course resources' ||
              lowerBuf === 'required texts:' ||
              lowerBuf === 'required text:' ||
              lowerBuf === 'faculty information' ||
              lowerBuf === 'faculty & contact information' ||
              lowerBuf === 'grading scale' ||
              lowerBuf === 'grading criteria' ||
              lowerBuf === 'course assignment details' ||
              lowerBuf.includes('overview of required') ||
              lowerBuf.includes('% of final grade') ||
              lowerBuf.includes('% of grade');
            const lastChar = buffer[buffer.length - 1];
            if (isBufferShortHeading || isBufferSectionHeader || lastChar === '.' || lastChar === ':' || lastChar === '!' || lastChar === '?' || lastChar === '%') {
              reconstituted.push(buffer);
              buffer = line;
            } else {
              buffer += ' ' + line;
            }
          }
        }
      }
    }
    if (buffer.length > 0) {
      reconstituted.push(buffer);
    }

    return reconstituted;
  }

  public deinterleaveScheduleLines(lines: string[]): string[] {
    const isWeekStart = (l: string) => /^\s*(?:week|wk|module|mod|unit|session)\s*\d+/i.test(l);
    const isReadingLine = (l: string) =>
      /\b(?:ch\.|chps?|chapters?|beck|clark|craske|barlow|linehan|hayes|hays|persons|corey|yalom|creswell|gehart|nichols|manual|dossier|protocol|sheets?|code\s+of\s+ethics|docs?|specs?|whitepapers?|papers?|guides?|architecture|vllm|triton|huyen|kleppmann|feast|pytorch|li\s+et\s+al|rajbhandari|shoeybi|dettmers|hu|burns|kubeflow|airflow|stoica|vaswani|devlin|he\s+et\s+al)\b/i.test(l) ||
      l.includes(';') ||
      /\(\s*(?:ch|pp?|\d{4}|[A-Za-z0-9\s\-–—/]+)\)/i.test(l);

    const isStopLine = (l: string) =>
      isWeekStart(l) ||
      /^(?:timeline\s+module|course\s+assignments|course\s+schedule|syllabus|grading|assessment|plo\b|instructor|office|late\s+submission|extension|total\s+course|data\s+\d+|cs\s+\d+|program\s+learning)\b/i.test(l);

    // Pass 0A: Rejoin split tokens across lines (Simple Syllabus column/row wrapping artifacts)
    const pass0Lines = [...lines];
    // 1. Month split: 'September' \n ... \n '4th'
    const monthSoloRegex = /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)$/i;
    for (let j = 0; j < pass0Lines.length; j++) {
      const mM = pass0Lines[j].match(monthSoloRegex);
      if (mM) {
        for (let look = 1; look <= 4 && j + look < pass0Lines.length; look++) {
          const dM = pass0Lines[j + look].match(/^(\d{1,2}(?:st|nd|rd|th)?)$/i);
          if (dM) {
            pass0Lines[j] = `${mM[1]} ${dM[1]}`;
            pass0Lines[j + look] = '';
            break;
          }
        }
      }
    }

    // 2. Rejoin '4/2/26 MODU' ... 'LE 1', '4/16/2' ... '6', 'READI' ... 'NG', 'Yalom' ... 'Ch. 1'
    for (let j = 0; j < pass0Lines.length; j++) {
      const moduLineM = pass0Lines[j].match(/^(.*?)(?:MODU)\s*$/i);
      if (moduLineM) {
        for (let look = 1; look <= 5 && j + look < pass0Lines.length; look++) {
          const leM = pass0Lines[j + look].match(/^LE\s*(\d+)(.*)$/i);
          if (leM) {
            const prefix = moduLineM[1].trim();
            pass0Lines[j] = (prefix ? prefix + ' ' : '') + 'MODULE ' + leM[1] + (leM[2] ? ' ' + leM[2].trim() : '');
            pass0Lines[j + look] = '';
            break;
          }
        }
      }

      const dSplit = pass0Lines[j].match(/^(\d{1,2}\/\d{1,2}\/\d)$/);
      if (dSplit) {
        for (let look = 1; look <= 5 && j + look < pass0Lines.length; look++) {
          if (/^\d$/.test(pass0Lines[j + look])) {
            pass0Lines[j] = dSplit[1] + pass0Lines[j + look];
            pass0Lines[j + look] = '';
            break;
          }
        }
      }

      if (/^READI$/i.test(pass0Lines[j])) {
        for (let look = 1; look <= 5 && j + look < pass0Lines.length; look++) {
          if (/^NG$/i.test(pass0Lines[j + look])) {
            pass0Lines[j] = 'READING WEEK';
            pass0Lines[j + look] = '';
            break;
          }
        }
      }

      if (/^(?:Yalom|Corey)$/i.test(pass0Lines[j])) {
        if (j + 1 < pass0Lines.length && /^Ch(?:apters?|\.)?\s*\d+/i.test(pass0Lines[j + 1])) {
          pass0Lines[j] = pass0Lines[j] + ' ' + pass0Lines[j + 1];
          pass0Lines[j + 1] = '';
        }
      }
    }

    const filteredPass0 = pass0Lines.filter(l => l.length > 0);

    // Pass 0B: Standalone week digits with lookahead date (e.g. "4" \n ... \n "July 24th")
    const monthsRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/i;
    let expectedWeek = 1;
    for (let j = 0; j < filteredPass0.length; j++) {
      const l = filteredPass0[j];
      const numVal = parseInt(l, 10);
      if (!isNaN(numVal) && String(numVal) === l && numVal >= 1 && numVal <= 16) {
        if (numVal <= expectedWeek + 2 && numVal >= expectedWeek - 1) {
          for (let look = 1; look <= 8 && j + look < filteredPass0.length; look++) {
            const nextLine = filteredPass0[j + look];
            const dMatch = nextLine.match(monthsRegex);
            if (dMatch) {
              filteredPass0[j] = `Week ${numVal} - ${dMatch[0]}`;
              expectedWeek = numVal + 1;
              filteredPass0[j + look] = filteredPass0[j + look].replace(dMatch[0], '').trim();
              break;
            }
          }
        }
      }
    }

    const cleanPass0 = filteredPass0.filter(l => l.length > 0 && !/^\d{1,2}$/.test(l));

    // Pass 1: Merge isolated Week / Module headers split across 2 or 3 lines: e.g. "Week 02" \n "Module 02"
    const preMerged: string[] = [];
    for (let j = 0; j < cleanPass0.length; j++) {
      const cur = cleanPass0[j];
      if (/^\s*(?:week|wk)\s*\d+\s*$/i.test(cur) && j + 1 < cleanPass0.length && /^\s*(?:module|mod|unit|session)\s*\d+\s*$/i.test(cleanPass0[j + 1])) {
        let combined = cur + ' ' + cleanPass0[j + 1];
        j++;
        if (j + 1 < cleanPass0.length && !isReadingLine(cleanPass0[j + 1]) && !isStopLine(cleanPass0[j + 1])) {
          combined += ' ' + cleanPass0[j + 1];
          j++;
        }
        preMerged.push(combined);
      } else {
        preMerged.push(cur);
      }
    }

    // Pass 2: Detect alternating interleaved table cells (Pattern A & Pattern B)
    const out: string[] = [];
    let i = 0;
    while (i < preMerged.length) {
      const cur = preMerged[i];

      // Pattern A: Week start line followed by alternating topic/reading continuation
      if (isWeekStart(cur) && i + 1 < preMerged.length && isReadingLine(preMerged[i + 1])) {
        const reading1 = preMerged[i + 1];
        if (i + 2 < preMerged.length && !isStopLine(preMerged[i + 2]) && !isReadingLine(preMerged[i + 2])) {
          const themeCont = preMerged[i + 2];
          if (i + 3 < preMerged.length && !isStopLine(preMerged[i + 3])) {
            const readingCont = preMerged[i + 3];
            out.push(cur + ' ' + themeCont);
            out.push(reading1 + (readingCont.startsWith('(') ? ' ' : (reading1.endsWith(';') ? ' ' : ' ')) + readingCont);
            i += 4;
            continue;
          } else {
            out.push(cur + ' ' + themeCont);
            out.push(reading1);
            i += 3;
            continue;
          }
        }
      }

      // Pattern B: Topic line on its own row followed by alternating reading continuation (e.g. DATA 630 Week 2)
      // l0: Topic 1 ('Feature Engineering at Scale & Feature')
      // l1: Reading 1 ('Huyen (Ch. 4 & 5); Feast Architecture')
      // l2: Topic 2 ('Stores')
      // l3: Reading 2 ('Specs')
      if (i + 3 < preMerged.length) {
        const l0 = preMerged[i];
        const l1 = preMerged[i + 1];
        const l2 = preMerged[i + 2];
        const l3 = preMerged[i + 3];
        const isL1Reading = l1.includes(';') || /\b(?:ch\.|chps?|chapters?|huyen|kleppmann|feast|pytorch|li\s+et\s+al|rajbhandari|shoeybi|dettmers|hu|burns|kubeflow|airflow|stoica|vaswani)\b/i.test(l1);
        const isL3Reading = /^(?:Specs?|Specifications?|Whitepapers?|Docs?|Documentation|Papers?|Technical\s+Paper|Guides?|User\s+Guides?|Core\s+Architecture)\b/i.test(l3);
        const isL2ShortTopic = l2.length < 35 && !isL3Reading && !l2.includes(';') && !/^\s*(?:week|module|mod)\s*\d+/i.test(l2);
        if (isL1Reading && isL3Reading && isL2ShortTopic) {
          out.push(l0 + ' ' + l2);
          out.push(l1 + ' ' + l3);
          i += 4;
          continue;
        }
      }

      out.push(cur);
      i++;
    }
    return out;
  }

  public extractCourseDescription(lines: string[]): string | undefined {
    const descHeaderRegex = /^(?:course\s+(?:catalog\s+)?description|course\s+overview(?:\s*&\s*description)?|catalog\s+description|about\s+this\s+course)\s*[:\-–]?\s*(.*)$/i;
    for (let i = 0; i < Math.min(lines.length, 120); i++) {
      const line = lines[i].trim();
      const match = line.match(descHeaderRegex);
      if (match) {
        const inlineText = match[1]?.trim();
        const descParagraphs: string[] = [];
        if (inlineText && inlineText.length > 15) {
          descParagraphs.push(inlineText);
        }
        for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
          const next = lines[j].trim();
          if (!next) continue;
          if (/^(?:program\s+learning|learning\s+outcomes|plo|course\s+assignments|grading|course\s+details|assessment|instructor|office\s+hours|weekly|timeline|required)\b/i.test(next)) {
            break;
          }
          descParagraphs.push(next);
          if (descParagraphs.join(' ').length > 250) break;
        }
        if (descParagraphs.length > 0) {
          return descParagraphs.join(' ').trim();
        }
      }
    }
    return undefined;
  }

  // MARK: - Required Texts & Resources Extractor
  public extractRequiredTextsAndResources(lines: string[]): ReadingDTO[] {
    const results: ReadingDTO[] = [];
    let inTextSection = false;
    let currentBookBuffer: string[] = [];

    const startMarkers = ['required texts:', 'required text:', 'course resources', 'required materials', 'textbooks:', 'textbook:', 'recommended texts', 'bibliography'];
    const stopMarkers = ['program outcomes', 'learning outcomes', 'course outcomes', 'grading scale', 'course assignments', 'course description', 'vision, mission', 'course policies', 'late assignments', 'university policies', 'overview of required', 'attendance', 'course schedule', 'course assignment details', '--- page 3', 'page 3'];

    for (const line of lines) {
      const lower = line.trim().toLowerCase();
      if (startMarkers.some(m => lower.includes(m))) {
        inTextSection = true;
        continue;
      }
      if (inTextSection && stopMarkers.some(m => lower.includes(m))) {
        if (currentBookBuffer.length > 0) {
          const fullCitation = currentBookBuffer.join(' ');
          const r = this.parseCitationToReadingDTO(fullCitation);
          if (r) results.push(r);
          currentBookBuffer = [];
        }
        inTextSection = false;
        continue;
      }
      if (inTextSection) {
        if (this.isBoilerplatePolicyLine(lower) || lower.startsWith('note:') || lower.startsWith('http') || lower.includes('simplesyllabus')) {
          continue;
        }
        const cleanLine = line.trim();
        if (cleanLine.length > 10) {
          const isNewCitation = /\(\s*\d{4}\s*\)/.test(cleanLine) || /^[A-Z][a-zA-Z\s&,\.\-–]+?,\s*[A-Z]/.test(cleanLine);
          if (isNewCitation && currentBookBuffer.length > 0) {
            const fullCitation = currentBookBuffer.join(' ');
            const r = this.parseCitationToReadingDTO(fullCitation);
            if (r) results.push(r);
            currentBookBuffer = [cleanLine];
          } else {
            currentBookBuffer.push(cleanLine);
          }
        }
      }
    }
    if (currentBookBuffer.length > 0) {
      const fullCitation = currentBookBuffer.join(' ');
      const r = this.parseCitationToReadingDTO(fullCitation);
      if (r) results.push(r);
    }
    return results;
  }

  private parseCitationToReadingDTO(citation: string): ReadingDTO | null {
    const trimmed = citation.trim();
    if (trimmed.length < 10) return null;

    let author: string | undefined = undefined;
    let title = trimmed;

    const yearMatch = trimmed.match(/\(\s*\d{4}\s*\)/);
    if (yearMatch && yearMatch.index !== undefined) {
      const authorPart = trimmed.substring(0, yearMatch.index).trim();
      if (authorPart.length > 0) author = authorPart;
      const afterYear = trimmed.substring(yearMatch.index + yearMatch[0].length).replace(/^[ .:\t\n]+|[ .:\t\n]+$/g, '');
      if (afterYear.length > 0) title = afterYear;
    }

    const dotIdx = title.indexOf('. ');
    if (dotIdx >= 0) {
      const candidateTitle = title.substring(0, dotIdx).trim();
      if (candidateTitle.length >= 8) title = candidateTitle;
    }

    const cleanTitle = this.cleanAndSummarizeTitle(title, true);
    return {
      id: `read-${Math.random().toString(36).substring(2, 10)}`,
      title: cleanTitle,
      authorName: author,
      resourceTitle: cleanTitle,
      mediaType: 'textbook',
      isCompleted: false,
      summaryText: '',
      keyTakeawaysText: `• Key concepts and required foundations from ${cleanTitle}`,
      estimatedTimeText: '~45 min read'
    };
  }

  // MARK: - PASS 2: Points Heuristic Anchor & Assignment Extractor
  public extractAssignmentsWithPointsHeuristic(
    lines: string[],
    termYear: number | undefined,
    courseCode: string
  ): AssignmentDTO[] {
    // Stage 0: Direct Canonical Assignment Extractor & Overview Table
    const canonicalResults: AssignmentDTO[] = [];
    const joinedDocument = lines.join('\n');
    const monthsMap: Record<string, number> = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
      apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
      aug: 8, august: 8, sep: 9, september: 9, sept: 9, oct: 10, october: 10,
      nov: 11, november: 11, dec: 12, december: 12
    };

    // 0a. Structured Schedule & Requirements Table (e.g. CS 501, BIO 412, LAW 702, ECON 305, PHYS 601, HIST 210, ART 150, PSYCH 800)
    // Table format has columns: Week, Title, Category, Sub-Type, Points, Weight, Due Date
    const scheduleTableIdx = lines.findIndex((l, li) => {
      const low = l.toLowerCase().trim();
      if (low.includes('course schedule & syllabus requirements') || low.includes('course schedule and syllabus requirements')) return true;
      if (li + 4 < lines.length) {
        const slice = lines.slice(li, li + 7).map(s => s.toLowerCase().trim());
        if (slice.includes('week') && slice.includes('title') && slice.includes('category')) return true;
      }
      return false;
    });

    if (scheduleTableIdx !== -1) {
      let endIdx = lines.length;
      for (let i = scheduleTableIdx + 1; i < lines.length; i++) {
        if (/detailed assignments|course policies|course assignment details|^grading scale\b/i.test(lines[i])) {
          endIdx = i;
          break;
        }
      }

      let rowStart = scheduleTableIdx + 1;
      for (let i = scheduleTableIdx; i < Math.min(scheduleTableIdx + 12, endIdx); i++) {
        if (/due date/i.test(lines[i])) {
          rowStart = i + 1;
          break;
        }
      }

      const groups: string[][] = [];
      let curGroup: string[] = [];
      for (let i = rowStart; i < endIdx; i++) {
        const l = lines[i].trim();
        if (!l) continue;
        if (/^(?:week|wk|module|mod|unit)\s*\d+\b/i.test(l)) {
          if (curGroup.length > 0) groups.push(curGroup);
          curGroup = [l];
        } else {
          if (curGroup.length > 0) curGroup.push(l);
        }
      }
      if (curGroup.length > 0) groups.push(curGroup);

      for (const g of groups) {
        const wkM = g[0].match(/^(?:week|wk|module|mod|unit)\s*(\d{1,2})\b/i);
        const wkNum = wkM ? parseInt(wkM[1], 10) : 1;

        const isReading = g.some(l => l.trim().toLowerCase() === 'reading' || /^category:\s*reading/i.test(l.trim()));
        const isAssignment = g.some(l => /^(?:assignment|deliverable|exam|quiz|project|paper)$/i.test(l.trim().toLowerCase()) || /^category:\s*(?:assignment|deliverable|exam|quiz|project|paper)/i.test(l.trim()));

        if (!isAssignment || isReading) continue;

        const firstLineRest = g[0].replace(/^(?:week|wk|module|mod|unit)\s*\d+[:\-–\s]*/i, '').trim();
        const titleParts = firstLineRest ? [firstLineRest] : [];
        for (let i = 1; i < g.length; i++) {
          const line = g[i].trim();
          if (/^(?:reading|assignment|deliverable|exam|quiz|textbook|article|video|podcast|tutorial|other|in_class|paper|presentation)$/i.test(line)) break;
          if (/^\d+\s*points/i.test(line) || /^\d+%/i.test(line) || /^\d{4}-\d{2}-\d{2}/.test(line) || /^n\/a$/i.test(line)) break;
          titleParts.push(line);
        }
        let fullTitle = titleParts.join(' ').trim();
        fullTitle = this.buildStrict3To5WordTitle(fullTitle, true, true);

        if (fullTitle.length < 3 || isInvalidAssignmentTitle(fullTitle)) continue;

        const ptsM = g.map(l => l.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i)).find(Boolean);
        const wtM = g.map(l => l.match(/(\d{1,3})%/)).find(Boolean);
        const dateM = g.map(l => l.match(/\b(\d{4}-\d{2}-\d{2})\b/)).find(Boolean);

        canonicalResults.push({
          id: `assign-${Math.random().toString(36).substring(2, 10)}`,
          title: fullTitle,
          weekNumber: wkNum,
          pointsPossible: ptsM ? `${ptsM[1]} Points` : undefined,
          weightPercentage: wtM ? `${wtM[1]}%` : undefined,
          dueDate: dateM ? dateM[1] : undefined,
          rubricCriteria: []
        });
      }
    }

    // 0b. Detailed Assignments & Rubrics (direct capture or enrichment)
    const detailedHeaderIdx = lines.findIndex(l => /detailed assignments\s*&?\s*rubrics/i.test(l));
    if (detailedHeaderIdx !== -1) {
      let dEnd = lines.length;
      for (let i = detailedHeaderIdx + 1; i < lines.length; i++) {
        if (/course policies|late assignments|university policies/i.test(lines[i])) {
          dEnd = i;
          break;
        }
      }

      let curTitle = '';
      let curDesc = '';
      let curPts: string | undefined = undefined;
      let curWt: string | undefined = undefined;
      let curDue: string | undefined = undefined;

      const commitDetailed = () => {
        if (!curTitle || curTitle.length < 3 || isInvalidAssignmentTitle(curTitle)) return;
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cNorm = norm(curTitle);
        const existing = canonicalResults.find(r => {
          const rNorm = norm(r.title);
          return rNorm === cNorm || (rNorm.length >= 6 && cNorm.length >= 6 && (rNorm.includes(cNorm) || cNorm.includes(rNorm)));
        });

        if (existing) {
          if (!existing.fullInstructions && curDesc) existing.fullInstructions = curDesc;
          if (!existing.pointsPossible && curPts) existing.pointsPossible = curPts;
          if (!existing.weightPercentage && curWt) existing.weightPercentage = curWt;
          if (!existing.dueDate && curDue) existing.dueDate = curDue;
          if (curTitle.length > existing.title.length && curTitle.toLowerCase().includes(existing.title.toLowerCase())) {
            existing.title = curTitle;
          }
        } else if (curWt || curPts) {
          canonicalResults.push({
            id: `assign-${Math.random().toString(36).substring(2, 10)}`,
            title: curTitle,
            fullInstructions: curDesc || undefined,
            pointsPossible: curPts,
            weightPercentage: curWt,
            dueDate: curDue,
            rubricCriteria: []
          });
        }
      };

      for (let i = detailedHeaderIdx + 1; i < dEnd; i++) {
        const l = lines[i].trim();
        if (!l) continue;
        const descMatch = l.match(/(?:^|\x7f\s*)description:\s*(.+)$/i);
        const ptsMatch = l.match(/\b(?:points(?:\s+possible)?|pts)\s*[:\-–—]?\s*(\d{1,4})/i) ||
          l.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i);
        const wtMatch = l.match(/(?:grade\s+weight|weight|worth)\s*[:\-–—]?\s*(\d{1,3}%)/i) || l.match(/(\d{1,3}%)/);
        const dueMatch = l.match(/\b(?:due date|due)\s*[:\-–—]?\s*(\d{4}-\d{2}-\d{2})/i);
        const metaMatch = ptsMatch || wtMatch || dueMatch;

        if (descMatch) {
          curDesc = descMatch[1].trim();
        } else if (metaMatch || ptsMatch || wtMatch || dueMatch) {
          if (ptsMatch) curPts = `${ptsMatch[1]} Points`;
          if (wtMatch) curWt = wtMatch[1].endsWith('%') ? wtMatch[1] : `${wtMatch[1]}%`;
          if (dueMatch) curDue = dueMatch[1];
        } else {
          commitDetailed();
          curDesc = '';
          curPts = undefined;
          curWt = undefined;
          curDue = undefined;
          let cand = l.replace(/^[•\-*▪●\x7f: \t\n]+|[•\-*▪●\x7f: \t\n]+$/g, '').trim();
          cand = cand.replace(/\s*\([A-Z0-9\s-]+\)\s*$/, '').trim();
          cand = this.buildStrict3To5WordTitle(cand, true, true);
          if (cand.length >= 3 && !isInvalidAssignmentTitle(cand)) {
            curTitle = cand;
          } else {
            curTitle = '';
          }
        }
      }
      commitDetailed();
    }

    // 1. Overview Table (e.g. CPC 514, CPC 511, CS 50, BIO 101, PSYC 612, DATA 630)
    const overviewIdx = lines.findIndex(l =>
      /(?:overview of required assignments|course evaluation and grading|course requirements\s*(?:&|and)?\s*grading|grading and evaluation|evaluation and grading|grade breakdown|grading breakdown|grading scheme|evaluation scheme|assessment scheme|course assessment|evaluations? and assessments?|distribution of grades|grade distribution|assessment criteria|grading criteria|course requirements:?)/i.test(l) ||
      /(?:course\s+)?assignments?\s*(?:&|and)?\s*(?:grading|weight|assessments?)(?:\s+(?:summary|distribution))?/i.test(l) ||
      /weight\s+distribution/i.test(l) ||
      /assignment\s+description\s+weight/i.test(l) ||
      /assessment\s+structure(?:\s*(?:&|and)\s*grade\s+breakdown)?/i.test(l) ||
      /assessment\s+(?:item|title)\s+weight/i.test(l) ||
      /^grading:?\s*$/i.test(l.trim()) ||
      /^grading policy:?\s*$/i.test(l.trim()) ||
      /^grading scheme:?\s*$/i.test(l.trim()) ||
      /^evaluation scheme:?\s*$/i.test(l.trim()) ||
      /^assessment scheme:?\s*$/i.test(l.trim()) ||
      /^evaluations?:?\s*$/i.test(l.trim()) ||
      /^course evaluations?:?\s*$/i.test(l.trim()) ||
      /^assessments?:?\s*$/i.test(l.trim())
    );
    let overviewEndIdx = -1;
    if (overviewIdx !== -1) {
      let i = overviewIdx + 1;
      let currTitle = '';
      let totalPctSum = 0;
      let totalPtsSum = 0;
      while (i < lines.length) {
        const l = lines[i];
        if (
          /Course Assignments?\s+Details|Detailed Assignment Requirements|Detailed Assignments|Course Policies|Weekly Schedule|Weekly Term Schedule|Course Schedule|^Schedule:?|COURSEPAL PARSER|Criteria\s+Grade\s+Points/i.test(l) ||
          (i - overviewIdx > 35)
        ) {
          overviewEndIdx = i;
          break;
        }
        if (/TOTAL\s+(?:100%|\d+\s+Points)/i.test(l) || /^total\b/i.test(l)) {
          if (totalPctSum >= 99 || totalPtsSum >= 100 || canonicalResults.length === 0) {
            overviewEndIdx = i + 1;
            break;
          }
          i++;
          continue;
        }
        if (/^[•\-*▪●\s]+$/.test(l)) {
          i++;
          continue;
        }
        const lowerL = l.toLowerCase().trim();
        if (
          /^Overview of Required/i.test(l) ||
          /^Assignments\s+%\s+of\s+Final/i.test(l) ||
          /^%\s+of\s+Final/i.test(l) ||
          /^Grade/i.test(l) ||
          /^ASSESSMENT\s+(?:TITLE|ITEM|STRUCTURE)/i.test(l) ||
          /^(?:task|assignment|course|item)?\s*description(?:\s*(?:&|\/|and|-|–|—)?\s*weight)?$/i.test(l.trim()) ||
          /^(?:weight|percentage)(?:\s*(?:&|\/|and|-|–|—)?\s*description)?$/i.test(l.trim()) ||
          /^(?:assessment|evaluation)\s+(?:item|title)\s+weight/i.test(l.trim()) ||
          (!lowerL.includes('%') && !/\b\d{1,4}\s*(?:pts|points|pt)\b/i.test(lowerL) && (
            (lowerL.includes('assignment') && (lowerL.includes('weight') || lowerL.includes('description') || lowerL.includes('deliverable') || lowerL.includes('format'))) ||
            (lowerL.includes('timeline') && (lowerL.includes('topic') || lowerL.includes('reading')))
          )) ||
          isInvalidAssignmentTitle(l.trim())
        ) {
          currTitle = '';
          i++;
          continue;
        }

        const pctMatch = l.match(/(\d{1,3}%)/);
        const ptsMatch = l.match(/[:\-–\(]?\s*(\d{1,4})\s*(?:points|pts|pt)\b/i);

        if (pctMatch || ptsMatch) {
          let cutIdx = l.length;
          if (pctMatch && ptsMatch) {
            cutIdx = Math.min(pctMatch.index!, ptsMatch.index!);
          } else if (pctMatch) {
            cutIdx = pctMatch.index!;
          } else if (ptsMatch) {
            cutIdx = ptsMatch.index!;
          }
          const titlePart = l.slice(0, cutIdx).replace(/[:\-–—\(\[\{,\.\s]+$/, '').trim();
          const fullTitle = (currTitle ? (currTitle + ' ' + titlePart) : titlePart).trim();
          let cleanTitle = fullTitle
            .replace(/\|+/g, ' ')
            .replace(/^(?:Assignment|Deliverable|Project|Section|Paper|Task|Exam|Homework)\s*\d{1,2}\s*[:\-–—.]*\s*/i, '')
            .replace(/^\d{1,2}[\.:\)\-–—]\s*/, '')
            .replace(/\s*\(\d+\)\s*$/, '')
            .replace(/\s*\(?\b\d{1,4}\s*(?:pts|points|pt)\b\)?\s*/gi, '')
            .replace(/\s*\(?\b\d{1,3}%\)?\s*/gi, '')
            .replace(/\b(?:modules?|mod|weeks?|wk)\s*\d{1,2}(?:\s*[-–—]\s*\d{1,2})?\b/gi, '')
            .replace(/^[•\-*▪●:–—| \t\n]+|[•\-*▪●:–—| \t\n]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          let matchEnd = cutIdx;
          if (pctMatch && cutIdx === pctMatch.index) {
            matchEnd = pctMatch.index + pctMatch[0].length;
          } else if (ptsMatch && cutIdx === ptsMatch.index) {
            matchEnd = ptsMatch.index + ptsMatch[0].length;
          }
          const afterMatch = l.slice(matchEnd).trim();

          let rowWeek: number | undefined = undefined;
          let rowModuleMention: string | undefined = undefined;
          let deliverableFormat: string | undefined = undefined;

          if (afterMatch) {
            const modRangeM = afterMatch.match(/\bmodules?\s*(\d{1,2})\s*[-–—]\s*(\d{1,2})\b/i);
            const modSingleM = afterMatch.match(/\b(?:module|mod|week|wk)\s*(\d{1,2})\b/i);
            const continuousM = /\bcontinuous\b/i.test(afterMatch);

            if (modRangeM) {
              rowWeek = parseInt(modRangeM[1], 10);
              rowModuleMention = `Modules ${modRangeM[1]}–${modRangeM[2]}`;
            } else if (modSingleM) {
              rowWeek = parseInt(modSingleM[1], 10);
              rowModuleMention = `Module ${modSingleM[1]}`;
            } else if (continuousM) {
              rowWeek = 1;
              rowModuleMention = 'Continuous';
            }

            const cleanDeliverable = afterMatch
              .replace(/\bmodules?\s*\d{1,2}\s*[-–—]\s*\d{1,2}\b/gi, '')
              .replace(/\b(?:module|mod|week|wk)\s*\d{1,2}\b/gi, '')
              .replace(/\bcontinuous\b/gi, '')
              .replace(/^[•\-*▪●:·~_§ \t\n–—]+|[|•\-*▪●:·~_§ \t\n–—]+$/g, '')
              .trim();
            if (cleanDeliverable.length > 2) {
              deliverableFormat = cleanDeliverable;
            }
          }

          if (cleanTitle.length > 2 && !isInvalidAssignmentTitle(cleanTitle)) {
            if (pctMatch) totalPctSum += parseInt(pctMatch[1], 10);
            if (ptsMatch) totalPtsSum += parseInt(ptsMatch[1], 10);
            canonicalResults.push({
              id: `assign-${Math.random().toString(36).substring(2, 10)}`,
              title: cleanTitle,
              weightPercentage: pctMatch ? (pctMatch[1].endsWith('%') ? pctMatch[1] : `${pctMatch[1]}%`) : undefined,
              pointsPossible: ptsMatch ? `${ptsMatch[1]} Points` : (pctMatch ? `${parseInt(pctMatch[1], 10)} Points` : undefined),
              weekNumber: rowWeek,
              fullInstructions: deliverableFormat,
              noteText: rowModuleMention
                ? (deliverableFormat ? `${rowModuleMention} · ${deliverableFormat}` : (rowModuleMention.toLowerCase() === 'continuous' ? 'Over the course of the semester' : rowModuleMention))
                : deliverableFormat,
              rubricCriteria: []
            });
          }
          currTitle = '';
        } else {
          const lastAssign = canonicalResults[canonicalResults.length - 1];
          const isContinuationOfDeliverable = lastAssign && lastAssign.fullInstructions && (
            lastAssign.fullInstructions.endsWith('&') ||
            lastAssign.fullInstructions.endsWith('-') ||
            lastAssign.fullInstructions.endsWith('–') ||
            lastAssign.fullInstructions.endsWith(',') ||
            (lastAssign.fullInstructions.includes('(') && !lastAssign.fullInstructions.includes(')')) ||
            /(?:evaluation|2-page|formal|structured|simulation|prompts|iac|bi-weekly)$/i.test(lastAssign.fullInstructions) ||
            /^(?:7th\)|matrix|recording|reflection log|page whitepaper|dockerfile|manifests|tech briefs)\b/i.test(l)
          );

          if (isContinuationOfDeliverable && lastAssign) {
            lastAssign.fullInstructions = `${lastAssign.fullInstructions} ${l}`.trim();
            if (lastAssign.noteText && !lastAssign.noteText.includes(l)) {
              lastAssign.noteText = `${lastAssign.noteText} ${l}`.trim();
            }
          } else {
            currTitle = currTitle ? (currTitle + ' ' + l) : l;
          }
        }
        i++;
      }
      if (overviewEndIdx === -1) overviewEndIdx = i;
    }

    // 2. Canonical Headers (e.g. CPC 523, BIO 101, CS 50)
    if (canonicalResults.length < 2) {
      const canonicalPattern = /(?:^|\n|[.?!]\s+|Total\s+\d+\s+Points\s+\d+%|Total\s+100%|Course Assignments? Details)\s*(?:(?:Assignment|Deliverable|Project|Section|Paper|Task|Exam)\s*\d{1,2}\s*[:\-–—]\s*)?([A-Za-z0-9][^\n\r()%\[\]{}:]{2,80}?)\s*[\(\[\{]\s*(?:(?:assignment\s*\d{1,2}\s*[,:\-–]?\s*)?(\d{1,3}%)\s*(?:[,/&–-]?\s*(\d{1,4})\s*(?:points|pts|pt)\b)?|(\d{1,4})\s*(?:points|pts|pt)\b(?:\s*[,/&–-]?\s*(\d{1,3}%))?|assignment\s*(\d{1,2}))\s*[\)\]\}](?:[ \t]*[-–—:][ \t]*(?:DUE\s*)?([^\n\r]+)|[ \t]+([A-Z][^\n\r]+)|(?=\n|\r|$))/gi;
      let canonMatch: RegExpExecArray | null;
      while ((canonMatch = canonicalPattern.exec(joinedDocument)) !== null) {
        let cleanTitle = canonMatch[1].replace(/^(?:Course Assignments? Details|\d+\s+)\s*/i, '').trim();
        cleanTitle = cleanTitle.replace(/^(?:Assignment|Deliverable|Project|Section|Paper|Task|Exam)\s*\d{1,2}\s*[:\-–—.]*\s*/i, '').trim();
        cleanTitle = cleanTitle.replace(/^[•\-*▪●: \t\n]+|[•\-*▪●: \t\n]+$/g, '').trim();

        if (isInvalidAssignmentTitle(cleanTitle)) {
          continue;
        }

        // Strip trailing dashes, due dates, percentages, and noise
        cleanTitle = cleanTitle.replace(/\s*[-–—]\s*(?:due|submitted|over the course).*$/i, '').trim();
        cleanTitle = cleanTitle.replace(/\s*\(\s*(?:assignment\s*\d+|\d{1,3}%|\d{1,4}\s*(?:points|pts|pt))\s*\)/gi, '').trim();
        cleanTitle = cleanTitle.replace(/^[•\-*▪●:–— \t\n]+|[•\-*▪●:–— \t\n]+$/g, '').trim();

        if (isInvalidAssignmentTitle(cleanTitle)) {
          continue;
        }

        const weightStr = (canonMatch[2] || canonMatch[5]) ? (canonMatch[2] || canonMatch[5]).trim() : undefined;
        let pointsNum = (canonMatch[3] || canonMatch[4]) ? (canonMatch[3] || canonMatch[4]).trim() : undefined;
        const dueSnippet = (canonMatch[7] || canonMatch[8] || '').trim();
        if (!pointsNum && dueSnippet) {
          const duePtsMatch = dueSnippet.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i);
          if (duePtsMatch) {
            pointsNum = duePtsMatch[1];
          }
        }

        let dueDateIso: string | undefined = undefined;
        const dateMatch = dueSnippet.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?/i);
        if (dateMatch) {
          const monthNum = monthsMap[dateMatch[1].toLowerCase()];
          const dayNum = parseInt(dateMatch[2], 10);
          const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
          dueDateIso = termYear ? `${termYear}-${pad(monthNum)}-${pad(dayNum)}` : `${dateMatch[1]} ${dayNum}`;
        }

        if (cleanTitle.length >= 3 && !isInvalidAssignmentTitle(cleanTitle) && !/total|overview|grade/i.test(cleanTitle) && !canonicalResults.some(r => r.title.toLowerCase() === cleanTitle.toLowerCase() || this.fuzzyMatch(r.title, cleanTitle))) {
          canonicalResults.push({
            id: `assign-${Math.random().toString(36).substring(2, 10)}`,
            title: cleanTitle,
            dueDate: dueDateIso,
            weightPercentage: weightStr ? (weightStr.endsWith('%') ? weightStr : `${weightStr}%`) : undefined,
            pointsPossible: pointsNum ? `${pointsNum} Points` : undefined,
            fullInstructions: dueSnippet || undefined,
            rubricCriteria: []
          });
        }
      }

      // Also scan for explicit line headers like: "Assignment 1: Reflection Paper - 100 Points"
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li].trim();
        if (/course policies|late assignments|academic integrity|disability accommodations/i.test(line)) {
          continue;
        }
        const sectionMatch = line.match(/^(?:assignment|deliverable|task|project|section|paper|exam)\s*(\d{1,2})\s*[:\-–—]\s*(.+?)(?:\s*[\(\-–—:]\s*(?:(\d{1,3}%)\s*(?:[,/&]?\s*(\d{1,4})\s*(?:points|pts|pt)\b)?|(\d{1,4})\s*(?:points|pts|pt)\b(?:\s*[,/&]?\s*(\d{1,3}%))?)\)?)?$/i);
        if (sectionMatch) {
          let rawTitle = sectionMatch[2].trim();
          let wPct = sectionMatch[3] || sectionMatch[6];
          let pPts = sectionMatch[4] || sectionMatch[5];

          const inlinePct = rawTitle.match(/(\d{1,3})%/);
          const inlinePts = rawTitle.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i);
          if (inlinePct) wPct = inlinePct[1];
          if (inlinePts) pPts = inlinePts[1];

          let cleanTitle = this.buildStrict3To5WordTitle(rawTitle, true, true);
          cleanTitle = cleanTitle.replace(/^(?:Assignment|Deliverable|Project|Section|Paper|Task|Exam)\s*\d{1,2}\s*[:\-–—.]*\s*/i, '').trim();

          if (cleanTitle.length >= 3 && !isInvalidAssignmentTitle(cleanTitle) && !/total|overview|grade/i.test(cleanTitle)) {
            if (!canonicalResults.some(r => r.title.toLowerCase() === cleanTitle.toLowerCase() || this.fuzzyMatch(r.title, cleanTitle))) {
              canonicalResults.push({
                id: `assign-${Math.random().toString(36).substring(2, 10)}`,
                title: cleanTitle,
                weightPercentage: wPct ? (wPct.includes('%') ? wPct : `${wPct}%`) : undefined,
                pointsPossible: pPts ? `${pPts} Points` : undefined,
                rubricCriteria: []
              });
            }
          }
        }
      }
    }

    // 2b. Schedule-embedded deliverables (e.g. "Due: Family Mapping Papers", "in-class case conceptualization worth 20%")
    let activeWeekNum: number | undefined = undefined;
    let activeWeekDate: string | undefined = undefined;

    const matchExistingCanonical = (cTitle: string) => {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cNorm = norm(cTitle);
      return canonicalResults.find(r => {
        const rNorm = norm(r.title);
        return rNorm === cNorm || (rNorm.length >= 6 && cNorm.length >= 6 && (rNorm.includes(cNorm) || cNorm.includes(rNorm)));
      });
    };

    const hasOverviewDeliverables = overviewIdx !== -1 && canonicalResults.length >= 2;

    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      if (/course policies|late assignments|academic integrity|disability accommodations/i.test(l)) {
        continue;
      }
      if (/\bdue\s+to\b/i.test(l)) {
        continue;
      }
      const wkM = l.match(/\b(?:week|wk)\s*(\d{1,2})\b/i) || l.match(/(?:^|\s{2,})(\d{1,2})\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i);
      if (wkM) {
        activeWeekNum = parseInt(wkM[1], 10);
      }
      const lDates = this.extractAllDates(l, termYear);
      if (lDates.length > 0) {
        activeWeekDate = lDates[0].isoString;
      }

      // Check: "Due: [Title]"
      const dueM = l.match(/\bdue:\s*([A-Za-z0-9][A-Za-z0-9\s,&–\-/]+)/i);
      if (dueM) {
        const rawTitle = dueM[1].trim();
        const cleanTitle = this.buildStrict3To5WordTitle(rawTitle, true, true);
        const existing = matchExistingCanonical(cleanTitle);
        if (existing) {
          if (!existing.dueDate && activeWeekDate) existing.dueDate = activeWeekDate;
          if ((!existing.weekNumber || existing.weekNumber <= 0) && activeWeekNum) existing.weekNumber = activeWeekNum;
        } else if (!hasOverviewDeliverables && cleanTitle.length >= 3 && !isInvalidAssignmentTitle(cleanTitle) && !/^(?:readings?|chapters?|materials?|notes?)$/i.test(cleanTitle)) {
          canonicalResults.push({
            id: `assign-${Math.random().toString(36).substring(2, 10)}`,
            title: cleanTitle,
            weekNumber: activeWeekNum,
            dueDate: activeWeekDate,
            rubricCriteria: []
          });
        }
      }

      // Check: "[Title] Due" (e.g. "Sexuality Reflection Assignment Due", "Group Sexuality Research Paper Due")
      const titleDueM = !dueM ? l.match(/\b([A-Za-z0-9][A-Za-z0-9\s,&–\-/]{3,60}?)\s+(?<!\b(?:the|a|an|after|before|to|meeting|past)\s+)(?:is\s+)?due\b(?!\s*date)/i) : null;
      if (titleDueM) {
        const rawTitle = titleDueM[1].trim();
        const cleanTitle = this.buildStrict3To5WordTitle(rawTitle, true, true);
        const existing = matchExistingCanonical(cleanTitle);
        if (existing) {
          if (!existing.dueDate && activeWeekDate) existing.dueDate = activeWeekDate;
          if ((!existing.weekNumber || existing.weekNumber <= 0) && activeWeekNum) existing.weekNumber = activeWeekNum;
        }
      }

      // Check: "In Class Assignment: [Title]"
      const inClassM = l.match(/\b(?:in[\s-]class\s+(?:assignment|presentation|activity|exam|quiz)):\s*([A-Za-z0-9][A-Za-z0-9\s,&–\-/]+)/i);
      if (inClassM) {
        const rawTitle = inClassM[1].trim();
        const cleanTitle = this.buildStrict3To5WordTitle(rawTitle, true, true);
        const existing = matchExistingCanonical(cleanTitle);
        if (existing) {
          if (!existing.dueDate && activeWeekDate) existing.dueDate = activeWeekDate;
          if ((!existing.weekNumber || existing.weekNumber <= 0) && activeWeekNum) existing.weekNumber = activeWeekNum;
        }
      }

      // Check: "[Deliverable] worth X% of final mark/grade"
      const worthM = l.match(/(?:complete|submit|prepare|write)?\s*(?:an?\s+)?([A-Za-z0-9][A-Za-z0-9\s,&–\-/]+?)\s*worth\s*(\d{1,3}%)(?:\s*of\s*(?:their\s*)?final\s*(?:mark|grade))?/i);
      const schedPtsM = l.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i);
      if (worthM) {
        let rawTitle = worthM[1].replace(/^(?:students\s+will\s+(?:complete|submit|prepare|write)?\s*(?:an?\s+)?|an?\s+)/i, '').trim();
        const cleanTitle = this.buildStrict3To5WordTitle(rawTitle, true, true);
        const weightPct = worthM[2].trim();
        const existing = matchExistingCanonical(cleanTitle);
        if (existing) {
          if (!existing.dueDate && activeWeekDate) existing.dueDate = activeWeekDate;
          if ((!existing.weekNumber || existing.weekNumber <= 0) && activeWeekNum) existing.weekNumber = activeWeekNum;
          if (!existing.weightPercentage) existing.weightPercentage = weightPct;
          if (!existing.pointsPossible && schedPtsM) existing.pointsPossible = `${schedPtsM[1]} Points`;
        } else if (!hasOverviewDeliverables && cleanTitle.length >= 3 && !isInvalidAssignmentTitle(cleanTitle)) {
          canonicalResults.push({
            id: `assign-${Math.random().toString(36).substring(2, 10)}`,
            title: cleanTitle,
            weekNumber: activeWeekNum,
            dueDate: activeWeekDate,
            weightPercentage: weightPct,
            pointsPossible: schedPtsM ? `${schedPtsM[1]} Points` : undefined,
            rubricCriteria: []
          });
        }
      }
    }

    // 3. Details & Rubrics Enrichment
    if (canonicalResults.length >= 1) {
      const detailHeadings: { lineIdx: number; title: string; num?: number; weight?: string; points?: string }[] = [];
      const detailsSectionIdx = lines.findIndex(l => /Course Assignments?\s+Details|Detailed Assignment Requirements|Detailed Assignments/i.test(l));
      const detailsStartIdx = detailsSectionIdx !== -1
        ? detailsSectionIdx + 1
        : (overviewEndIdx > 0 ? overviewEndIdx : (overviewIdx !== -1 ? overviewIdx + 1 : 0));

      for (let i = detailsStartIdx; i < lines.length; i++) {
        const l = lines[i];
        const m = l.match(/^(.+?)\s*[\(\[\{](?:assignment\s*(\d+)|\d{1,3}%|(\d{1,4})\s*(?:points|pts|pt)\b)[\)\]\}]/i) ||
          l.match(/^(?:assignment|deliverable|task|project|section|paper|exam)\s*(\d{1,2})\s*[:\-–—]\s*(.+?)(?:\s*[\(\-–—:]\s*(?:(\d{1,3}%)\s*(?:[,/&]?\s*(\d{1,4})\s*(?:points|pts|pt)\b)?|(\d{1,4})\s*(?:points|pts|pt)\b(?:\s*[,/&]?\s*(\d{1,3}%))?)\)?)?$/i);
        if (m) {
          let hTitle = (m[2] && /^(?:assignment|deliverable|task|project|section|paper|exam)/i.test(l) ? m[2] : m[1]).trim().replace(/^(?:Course Assignments? Details|\d+\s+)\s*/i, '').trim();
          hTitle = hTitle.replace(/^(?:assignment|deliverable|task|project|section|paper|exam)\s*\d{1,2}\s*[:\-–—.]*\s*/i, '').trim();
          hTitle = hTitle.replace(/^\d{1,2}[\.:\)\-–—]\s*/, '').trim();
          hTitle = hTitle.replace(/\s*[:\-–—]?\s*\b\d{1,4}\s*(?:points|pts|pt)(?!\w)/gi, '').trim();
          hTitle = hTitle.replace(/\s*[:\-–—]?\s*\b\d{1,3}%(?!\w)/gi, '').trim();
          hTitle = hTitle.replace(/^[•\-*▪●:–— \t\n]+|[•\-*▪●:–— \t\n]+$/g, '').trim();
          if (i > 0 && /^(?:assignment|deliverable|part|task|section|paper|project)\s*\d{1,2}\s*[:\-–—]?$/i.test(lines[i - 1].trim())) {
            hTitle = `${lines[i - 1].trim()} ${hTitle}`;
          }
          const weightMatch = l.match(/(\d{1,3})%/);
          const ptsMatch = l.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i) || l.match(/\b(?:points(?:\s+possible)?|pts|worth)\s*[:\-–—]?\s*(\d{1,4})\b/i);
          const headingWeight = weightMatch ? `${weightMatch[1]}%` : undefined;
          const headingPoints = ptsMatch ? `${ptsMatch[1]} Points` : (weightMatch ? `${parseInt(weightMatch[1], 10)} Points` : undefined);
          const assignNum = (m[2] && /^\d+$/.test(m[2])) ? parseInt(m[2], 10) : ((m[1] && /^\d+$/.test(m[1])) ? parseInt(m[1], 10) : undefined);
          if (!hTitle.toLowerCase().includes('overview') && !hTitle.toLowerCase().includes('scale')) {
            detailHeadings.push({
              lineIdx: i,
              title: hTitle,
              num: assignNum,
              weight: headingWeight,
              points: headingPoints
            });
          }
        }
      }

      if (detailHeadings.length < 2) {
        detailHeadings.length = 0; // reset to populate by matching canonical assignment titles
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        const stopWords = /^(and|the|for|with|paper|report|project|assignment|details)$/;
        let lastIdx = detailsStartIdx;

        for (let aIdx = 0; aIdx < canonicalResults.length; aIdx++) {
          const ca = canonicalResults[aIdx];
          const caNorm = norm(ca.title);
          const caTokens = caNorm.split(/\s+/).filter(t => t.length > 2 && !stopWords.test(t));

          for (let l = lastIdx; l < lines.length; l++) {
            const line = lines[l];
            if (line.includes('\t')) continue;
            const trimmedLine = line.trim();
            // Skip rubric criteria rows or points lines so they aren't mistaken for assignment headings
            if (/^(?:grading criteria|grade points|%\s*of\s*grade|\b\d{1,3}\s*(?:points|pts|pt)\b)/i.test(trimmedLine)) continue;
            if (/\b\d{1,4}\s*(?:points|pts|pt)\s*[|]?$/i.test(trimmedLine)) continue;
            const lineNorm = norm(line);

            let matched = false;
            if (lineNorm === caNorm || (caNorm.length >= 6 && lineNorm.startsWith(caNorm))) {
              matched = true;
            } else {
              const candTitle = line.includes('  ') ? line.split(/\s{2,}/)[0].trim() : line.slice(0, 80).trim();
              if (candTitle.length >= 3 && !/^(course policies|grading criteria|grade points|university policies|course assignment)\b/i.test(candTitle)) {
                const candNorm = norm(candTitle);
                const candTokens = candNorm.split(/\s+/).filter(t => t.length > 2 && !stopWords.test(t));
                if (candNorm === caNorm || (candNorm.length >= 6 && candNorm.startsWith(caNorm)) || (candNorm.length >= 6 && caNorm.startsWith(candNorm))) {
                  matched = true;
                } else if (caTokens.length > 1 && candTokens.length > 0) {
                  const shared = caTokens.filter(t => candTokens.includes(t));
                  if (shared.length === caTokens.length || (shared.length >= 2 && shared.length >= Math.min(caTokens.length, candTokens.length) * 0.75)) {
                    matched = true;
                  }
                }
              }
            }

            if (matched) {
              detailHeadings.push({
                lineIdx: l,
                title: ca.title,
                num: aIdx + 1,
                weight: ca.weightPercentage || undefined
              });
              lastIdx = l + 1;
              break;
            }
          }
        }
      }

      const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

      for (let h = 0; h < detailHeadings.length; h++) {
        const currHeading = detailHeadings[h];
        let nextLineIdx = (h + 1 < detailHeadings.length) ? detailHeadings[h + 1].lineIdx : lines.length;
        for (let li = currHeading.lineIdx + 1; li < nextLineIdx; li++) {
          const lTrim = lines[li].trim();
          if (/^(?:weekly\s+(?:term\s+)?schedule|course\s+schedule|schedule\s+of\s+classes|tentative\s+schedule|late\s+policy|course\s+policies|grading\s+scale|decimal\s+grade\s+scale|coursepal\s+parser|timeline\s+module)/i.test(lTrim)) {
            nextLineIdx = li;
            break;
          }
        }
        const blockLines = lines.slice(currHeading.lineIdx, nextLineIdx);

        let targetAssign: AssignmentDTO | undefined = undefined;
        if (currHeading.num && currHeading.num <= canonicalResults.length) {
          targetAssign = canonicalResults[currHeading.num - 1];
        }

        if (!targetAssign) {
          targetAssign = canonicalResults.find(r => norm(r.title) === norm(currHeading.title));
        }

        if (!targetAssign) {
          targetAssign = canonicalResults.find(r => {
            const rt = norm(r.title);
            const ht = norm(currHeading.title);
            return rt.includes(ht) || ht.includes(rt);
          });
        }

        if (!targetAssign) {
          targetAssign = canonicalResults.find(r => {
            const rt = norm(r.title);
            const ht = norm(currHeading.title);
            const rTokens = rt.split(/\s+/).filter(t => t.length > 2 && !/^(and|the|for|with|paper|assignment|details)$/.test(t));
            const hTokens = ht.split(/\s+/).filter(t => t.length > 2 && !/^(and|the|for|with|paper|assignment|details)$/.test(t));
            const sharedTokens = rTokens.filter(t => hTokens.includes(t));
            if (sharedTokens.length >= 2 && sharedTokens.length >= Math.min(rTokens.length, hTokens.length) * 0.7) {
              return true;
            }
            if (currHeading.weight && r.weightPercentage === currHeading.weight && sharedTokens.length >= 1) {
              return true;
            }
            return false;
          });
        }

        // Positional fallback when heading count equals canonical assignments count
        if (!targetAssign && detailHeadings.length === canonicalResults.length && h < canonicalResults.length) {
          targetAssign = canonicalResults[h];
        }

        if (targetAssign) {
          if (currHeading.title && currHeading.title.length >= 3 && !isInvalidAssignmentTitle(currHeading.title)) {
            targetAssign.title = currHeading.title;
          }
          if (currHeading.points && !targetAssign.pointsPossible) {
            targetAssign.pointsPossible = currHeading.points;
            const pNum = parseInt(currHeading.points, 10);
            if (!isNaN(pNum)) {
              (targetAssign as any).totalPoints = pNum;
              (targetAssign as any).points = pNum;
            }
          }
          if (currHeading.weight && !targetAssign.weightPercentage) {
            targetAssign.weightPercentage = currHeading.weight;
          }

          // Due Date
          if (!targetAssign.dueDate) {
            for (let bi = 0; bi < blockLines.length; bi++) {
              const bl = blockLines[bi];
              const nextBl = bi + 1 < blockLines.length ? blockLines[bi + 1] : '';
              if (/course policies/i.test(bl)) break;
              const combined = bl + ' ' + nextBl;

              // Check for presentation date window e.g. "May 8 & May 15"
              const presWindowMatch = combined.match(/(?:due\s+)?\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}\s*(?:&|and)\s*(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+)?\d{1,2}\b/i);
              if (presWindowMatch && !targetAssign.noteText) {
                targetAssign.noteText = `Presentations: ${presWindowMatch[0].replace(/^(?:due\s+)/i, '').replace(/\band\b/i, '&').replace(/\s+/g, ' ').trim()}`;
              }

              const dm = combined.match(/(?:due(?: date)?|deadline|scheduled for submission on|due no later than)\s*(?:is before the second session|before the second session|is before)?\s*[-–—:]*\s*(?:(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+)?([A-Za-z]+\.?\s+\d{1,2}(?:st|nd|rd|th)?,?(?:\s+\d{4})?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?)/i);
              if (dm) {
                const parsedDate = dm[1].trim();
                const mMatch = parsedDate.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?/i);
                if (mMatch) {
                  const monthNum = monthsMap[mMatch[1].toLowerCase()];
                  const dayNum = parseInt(mMatch[2], 10);
                  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
                  targetAssign.dueDate = termYear ? `${termYear}-${pad(monthNum)}-${pad(dayNum)}` : `${mMatch[1]} ${dayNum}`;
                } else {
                  targetAssign.dueDate = parsedDate;
                }
                break;
              }
              const dm2 = combined.match(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s+([A-Za-z]+\.?\s+\d{1,2},?(?:\s+\d{4})?)/i);
              if (dm2) {
                const mMatch2 = dm2[2].match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})/i);
                if (mMatch2) {
                  const monthNum = monthsMap[mMatch2[1].toLowerCase()];
                  const dayNum = parseInt(mMatch2[2], 10);
                  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
                  targetAssign.dueDate = termYear ? `${termYear}-${pad(monthNum)}-${pad(dayNum)}` : `${mMatch2[1]} ${dayNum}`;
                } else {
                  targetAssign.dueDate = dm2[0].trim();
                }
                break;
              }
            }
          }

          // Week Number
          if (!targetAssign.weekNumber || targetAssign.weekNumber <= 0) {
            for (const bl of blockLines) {
              if (/course policies/i.test(bl)) break;
              const wkM = bl.match(/\b(?:due(?:\s+in)?|scheduled(?:\s+for)?|assigned(?:\s+for)?|week)\s*[:\-–]*\s*(?:week\s*)?(\d{1,2})\b/i);
              if (wkM) {
                targetAssign.weekNumber = parseInt(wkM[1], 10);
                break;
              }
            }
          }

          // Media / YouTube URL
          for (const bl of blockLines) {
            if (/course policies/i.test(bl)) break;
            const ym = bl.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=[^\s)]+|youtu\.be\/[^\s)]+|youtube\.com\/[^\s)]+)/i);
            if (ym) {
              targetAssign.mediaUrl = ym[0].startsWith('http') ? ym[0] : `https://${ym[0]}`;
              break;
            }
            if (!targetAssign.mediaUrl) {
              const um = bl.match(/https?:\/\/[^\s)]+/);
              if (um && !um[0].includes('simplesyllabus') && !um[0].includes('cityu.edu/print') && !um[0].includes('error_codes')) {
                targetAssign.mediaUrl = um[0];
              }
            }
          }

          // Detailed Instructions & Description Extraction
          const instructionLines: string[] = [];
          for (let bi = 0; bi < blockLines.length; bi++) {
            const bl = blockLines[bi].trim();
            if (/course policies/i.test(bl) || /^Course Policies\b/i.test(bl)) break;
            if (/(?:Grading\s+Criteria\s*Grade\s*Points|Grading\s+Criteria|Criteria\s*Grade\s*Points|Grade\s+Points(?:\s+%\s+of\s+Grade)?|%\s+of\s+Grade|G\s*r\s*a\s*d\s*e\s*P\s*o\s*i\s*n\s*t\s*s|^\s*Criteria\s*(?:Grade|Points|%|$))/i.test(bl) && !/inclusion|exclusion|consider|following|eligib|membership/i.test(bl)) {
              break;
            }
            if (bi === 0) {
              let remainder = '';
              if (bl.includes('  ')) {
                const parts = bl.split(/\s{2,}/);
                if (parts.length > 1) {
                  remainder = parts.slice(1).join(' ').trim();
                }
              } else if (targetAssign && norm(bl).startsWith(norm(targetAssign.title))) {
                const titleTokens = norm(targetAssign.title).split(/\s+/);
                const blTokens = bl.split(/\s+/);
                if (blTokens.length > titleTokens.length) {
                  remainder = blTokens.slice(titleTokens.length).join(' ').trim();
                }
              }
              if (remainder.length > 0) {
                instructionLines.push(remainder);
              }
              continue;
            }
            if (
              /^Page\s+\d+/i.test(bl) ||
              /^https?:\/\/(?:cityu\.simplesyllabus|.*error_codes)/i.test(bl) ||
              /^\d+\/\d+\/\d+,\s+\d+:\d+/i.test(bl) ||
              /^\d+\/\d+$/.test(bl) ||
              /^\d+$/.test(bl)
            ) {
              continue;
            }
            if (/^[-–—]?\s*(?:due(?:\s+date)?|deadline|scheduled for submission on|due no later than)\b/i.test(bl) && bl.length < 75) {
              continue;
            }
            if (/^\d{1,3}%$/.test(bl)) {
              continue;
            }
            if (targetAssign.mediaUrl && bl === targetAssign.mediaUrl) {
              continue;
            }
            instructionLines.push(bl);
          }

          if (instructionLines.length > 0) {
            let combined = '';
            for (let li = 0; li < instructionLines.length; li++) {
              const cur = instructionLines[li].trim();
              if (!cur) continue;
              if (combined.length === 0) {
                combined = cur;
              } else {
                const prev = combined.trim();
                const prevEndsSentence = /[.!?:]$/.test(prev);
                const isBullet = /^[•\-*▪●]|\b\d+[\.)]\s+/.test(cur);
                const isSectionHeader = /^(?:part\s+\d|step\s+\d|section\s+\d|phase\s+\d|overview|purpose|background|directions|instructions|requirements|guidelines|format|formatting|submission|evaluation|framing\s+questions|prompt|objectives|notes?)\b/i.test(cur);
                if (prevEndsSentence || isBullet || isSectionHeader) {
                  combined += '\n\n' + cur;
                } else {
                  combined += ' ' + cur;
                }
              }
            }
            if (combined.length >= 20) {
              targetAssign.fullInstructions = combined;
            }
          }

          // Rubric Criteria
          const criteria: RubricCriterionDTO[] = [];
          let inRubric = false;
          let currCritName = '';
          for (const bl of blockLines) {
            if (/course policies/i.test(bl)) break;
            const isHeaderLine = /(?:Grading\s+Criteria\s*Grade\s*Points|Grading\s+Criteria|Criteria\s*Grade\s*Points|Grade\s+Points(?:\s+%\s+of\s+Grade)?|%\s+of\s+Grade|G\s*r\s*a\s*d\s*e\s*P\s*o\s*i\s*n\s*t\s*s|^\s*Criteria\s*(?:Grade|Points|%|$))/i.test(bl) &&
              !/inclusion|exclusion|consider|following|eligib|membership/i.test(bl);
            const ptsMatch = bl.match(/(\d{1,3})\s*(?:Points|pts|pt)\b/i);
            const pctMatch = bl.match(/(\d{1,3})%/);

            if (isHeaderLine && !ptsMatch) {
              inRubric = true;
              continue;
            }

            if (inRubric) {
              if (/^Total\b/i.test(bl) || /^Course Assignment Details/i.test(bl)) {
                const totalNumMatch = bl.match(/\btotal\s*[\t:]*\s*(\d{1,4})\b/i);
                if (totalNumMatch) {
                  const ptsNum = parseInt(totalNumMatch[1], 10);
                  targetAssign.pointsPossible = `${ptsNum} Points`;
                  (targetAssign as any).totalPoints = ptsNum;
                  (targetAssign as any).points = ptsNum;
                }
                inRubric = false;
                continue;
              }
              if (/^Page\s+\d+/i.test(bl) || /^http/i.test(bl) || /^\d+\/\d+\/\d+/i.test(bl)) {
                continue;
              }
              if (ptsMatch) {
                const namePart = bl.slice(0, ptsMatch.index).trim();
                const fullName = (currCritName ? (currCritName + ' ' + namePart) : namePart).trim();
                let cleanCritName = cleanRubricCriterionName(fullName);
                if (targetAssign.title) {
                  const normTitle = targetAssign.title.toLowerCase().replace(/[-_]/g, ' ').trim();
                  cleanCritName = cleanCritName.replace(new RegExp(normTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
                }
                cleanCritName = cleanRubricCriterionName(cleanCritName);
                if (cleanCritName.length > 0) {
                  if (/^analysis\s+and\s+use\s+of\s+course$/i.test(cleanCritName)) {
                    cleanCritName = 'Analysis and use of Course Concepts';
                  }
                  criteria.push({
                    criterionName: cleanCritName,
                    points: parseInt(ptsMatch[1], 10),
                    percentage: pctMatch ? parseInt(pctMatch[1], 10) : undefined
                  });
                }
                currCritName = '';
              } else {
                const numPctMatch = bl.match(/^([A-Za-z\s&(),\/\-–]+?)\s+(\d{1,3})\s+(\d{1,3}%)/);
                if (numPctMatch && !isHeaderLine && !/^total\b/i.test(bl)) {
                  criteria.push({
                    criterionName: cleanRubricCriterionName(numPctMatch[1]),
                    points: parseInt(numPctMatch[2], 10),
                    percentage: parseInt(numPctMatch[3], 10)
                  });
                  currCritName = '';
                } else if (!isHeaderLine && !/^total\b/i.test(bl)) {
                  currCritName = currCritName ? (currCritName + ' ' + bl) : bl;
                }
              }
            }
          }

          if (criteria.length > 0) {
            targetAssign.rubricCriteria = criteria;
            targetAssign.rubric = criteria;
            const totalPoints = criteria.reduce((sum, c) => sum + (c.points || 0), 0);
            if (totalPoints > 0) {
              targetAssign.pointsPossible = `${totalPoints} Points`;
              (targetAssign as any).totalPoints = totalPoints;
              (targetAssign as any).points = totalPoints;
            }
          }

          // Scan blockLines for explicit points (e.g. "Total 100 Points", "TOTAL 100", "Points: 100", "Points Possible: 150", "Worth: 200 points", "100 Points")
          if (!targetAssign.pointsPossible) {
            for (const bl of blockLines) {
              if (/course policies/i.test(bl)) break;
              const totMatch = bl.match(/\b(?:total|overall|maximum)\s*(?:points|pts|pt)?\s*[:\-–—|]?\s*(\d{1,4})\s*(?:points|pts|pt)?\b/i) ||
                bl.match(/\b(\d{1,4})\s*(?:points|pts|pt)\s+total\b/i) ||
                bl.match(/^TOTAL\s+(\d{1,4})\b/i);
              const ptsBeforeMatch = bl.match(/\b(?:points(?:\s+possible)?|point\s+value|worth|max(?:imum)?\s+points)\s*[:\-–—]\s*(\d{1,4})\b/i);
              const ptsAfterMatch = bl.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i);
              const chosenMatch = totMatch || ptsBeforeMatch || ptsAfterMatch;
              if (chosenMatch && !/grading scale|scale \d|decimal|per day|deduction|penalty|late/i.test(bl)) {
                const ptsNum = parseInt(chosenMatch[1], 10);
                targetAssign.pointsPossible = `${ptsNum} Points`;
                (targetAssign as any).totalPoints = ptsNum;
                (targetAssign as any).points = ptsNum;
                break;
              }
            }
          }

          // Scan blockLines for explicit grade weight (e.g. "Weight: 20%", "Worth 20% of final grade", "Grade Weight: 20%")
          if (!targetAssign.weightPercentage) {
            for (const bl of blockLines) {
              if (/course policies/i.test(bl)) break;
              const wtM = bl.match(/\b(?:grade\s+weight|weight|worth)\s*[:\-–—]?\s*(\d{1,3}%)\b/i) ||
                bl.match(/\bworth\s*(\d{1,3}%)/i) ||
                bl.match(/\b(\d{1,3})%\s*of\s*(?:the\s*)?(?:final\s*)?(?:mark|grade)\b/i) ||
                bl.match(/[\(\[]\s*(\d{1,3}%)\s*[\)\]]/);
              if (wtM && !/late|deduct|penalty/i.test(bl)) {
                targetAssign.weightPercentage = wtM[1].endsWith('%') ? wtM[1] : `${wtM[1]}%`;
                break;
              }
            }
          }
        }
      }

      return canonicalResults;
    }

    const results: AssignmentDTO[] = [];
    let lastMatchedIndex: number | null = null;
    let inPolicySection = false;

    const instructionPrefixes = [
      'this paper', 'the video', 'the deadline', 'each week', 'in small groups',
      'beginning in', 'prepare an', 'write an', 'following our', 'by the end',
      'in response', 'guided by', 'students will', 'students are', 'group members',
      'after presenting', 'the purpose of', 'on weeks when', 'this feedback',
      'for further guidance', 'for this assignment', 'within their', 'the goal',
      'videos where', 'to ensure', 'in consultation', 'apa formatting', 'as a counseling',
      'participation grades', 'at the beginning', 'at the end', 'graduate students',
      'if circumstances', 'emergency situations', 'being busy', 'a student who',
      'the guideline', 'instructors may', 'in the absence', 'assignments may',
      'all mc courses', 'recognizing that', 'active engagement', 'similarly it',
      'consistent attendance', 'many mc courses', 'assignments require', 'cityu requires',
      'students are responsible', 'the most current', 'city university of', 'we value',
      'cityu will not', 'any student who', 'cityu adheres', 'in the u.s.', 'sex include',
      'sexual harassment', 'cityu also', 'questions regarding', 'in canada', 'discrimination',
      'as an educational', 'the university will', 'information on', 'cityu has a policy',
      'the university\'s policy', 'accommodations must', 'academic integrity in',
      'students taking courses', 'regular class', 'attendance in this class',
      'all students are required', 'arriving late', 'it is expected', 'excused absences',
      'absences related', 'in the event', 'as student and', 'students who feel',
      'students with more', '3% of students', 'a complete copy', 'final assignments for',
      'due dates that', 'students with a documented', 'please contact', 'confidentiality will',
      'once approved', 'cityu librarians', 'contact a cityu', 'all students receive',
      'to gain access', 'resources include', 'because the counselling', 'the university\'s goal',
      'active self-care', 'similarly in', 'emotionally sensitive', 'students are encouraged',
      'it is important', 'in such cases', 'this may be done', 'as part of',
      'personal counselling', 'additional resources', 'in addition to', 'counselling students',
      'students will be', 'respect the dignity', 'maintain a positive', 'demonstrate exemplary',
      'access city university', 'recognize that', 'ensure that all', 'respect and behave',
      'as an ambassador', 'actively develop', 'respond to feedback', 'balance enthusiastic',
      'commit to active', 'embrace both'
    ];

    const policySectionHeaders = [
      'course policies', 'late assignments', 'university policies', 'non-discrimination',
      'religious accommodations', 'academic integrity', 'ai use policy', 'support services',
      'disability services', 'sensitive content notice', 'master of counselling\'s professional code',
      'professional code (2.0)', 'hallmarks of maturity'
    ];

    let inRubricSection = false;

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lower = line.trim().toLowerCase();
      if (lower.startsWith('students with more') || lower.includes('3% of students') || lower.startsWith('director to discuss') || lower.includes('attendance policy')) {
        continue;
      }
      const isAssignKeyword = lower.includes('assignment') || lower.includes('paper') || lower.includes('report') ||
        lower.includes('presentation') || lower.includes('facilitation') || lower.includes('project') ||
        lower.includes('reflection') || lower.includes('peer review') || lower.includes('rubric') ||
        lower.includes('grading criteria') || lower.includes('overview of required') || lower.includes('course assignment details') ||
        lower.includes('exam') || lower.includes('examination') || lower.includes('midterm') || lower.includes('quiz') ||
        lower.includes('problem set') || lower.includes('practical') || lower.includes('homework') || lower.includes('case study') ||
        lower.includes('essay') || lower.includes('deliverable') || lower.includes('exercise') || lower.includes('lab');

      if (lower.includes('grading criteria') || lower.includes('grade points')) {
        inRubricSection = true;
      }
      if (
        lower.includes('total 100') ||
        lower.includes('total\t100') ||
        lower.startsWith('total ') ||
        lower.startsWith('total\t') ||
        lower === 'total' ||
        lower.includes('course assignment details') ||
        lower.includes('overview of required assignments') ||
        (lower.includes('due') && !!line.match(LocalSyllabusParser.percentRegex))
      ) {
        inRubricSection = false;
      }

      if (policySectionHeaders.some(h => lower.includes(h))) {
        inPolicySection = true;
      }
      if (inPolicySection) {
        if (/course assignment details|overview of required assignments|grading breakdown|assignments and assessment|evaluation and grading|required assignments/i.test(lower)) {
          inPolicySection = false;
        } else {
          continue;
        }
      }
      if (this.isBoilerplatePolicyLine(lower)) continue;

      if (results.length > 0 && !inRubricSection && !line.includes('\t')) {
        const lineLow = line.trim().toLowerCase();
        const matchedIdx = results.findIndex(a => {
          const aTitleLow = a.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
          if (aTitleLow.length < 3) return false;
          if (lineLow === aTitleLow || lineLow.startsWith(aTitleLow)) return true;
          const aWords = aTitleLow.split(/\s+/).filter(w => w.length >= 3);
          if (aWords.length >= 2) {
            const firstTwo = aWords.slice(0, 2).join(' ');
            if (lineLow.startsWith(firstTwo)) return true;
            if (lineLow.startsWith(aWords[0]) && lineLow.includes(aWords[1])) return true;
          }
          return false;
        });
        if (matchedIdx >= 0) {
          lastMatchedIndex = matchedIdx;
        }
      }

      const pointsMatch = line.match(LocalSyllabusParser.pointsRegex);
      const percentMatch = line.match(LocalSyllabusParser.percentRegex);
      const isAssignWithPercent = !!percentMatch && isAssignKeyword;

      const isInstruction = !isAssignWithPercent && (
        instructionPrefixes.some(p => lower.startsWith(p)) ||
        (lower.length > 45 && (lower.endsWith('.') || lower.endsWith('. ')) && !lower.includes('assignment ') && !lower.includes('overview of required'))
      );

      const extractedDates = this.extractAllDates(line, termYear);
      const primaryIsoDate = extractedDates.length > 0 ? extractedDates[0].isoString : undefined;

      if (isInstruction) {
        const targetIdx = lastMatchedIndex ?? (results.length > 0 ? results.length - 1 : null);
        if (targetIdx !== null && targetIdx < results.length) {
          if (primaryIsoDate && !results[targetIdx].dueDate) {
            results[targetIdx] = {
              ...results[targetIdx],
              dueDate: primaryIsoDate
            };
          }
          const prevInstr = results[targetIdx].fullInstructions;
          const cleanLine = line.trim();
          if (cleanLine.length >= 10 && !cleanLine.startsWith('http') && !cleanLine.startsWith('Page ') && !cleanLine.includes('simplesyllabus')) {
            const newInstr = (prevInstr && prevInstr.length > 0 && !prevInstr.includes('Parsed from'))
              ? (prevInstr.endsWith('.') ? `${prevInstr} ${cleanLine}` : `${prevInstr}. ${cleanLine}`)
              : cleanLine;
            results[targetIdx] = {
              ...results[targetIdx],
              fullInstructions: newInstr
            };
          }
        }
        continue;
      }

      const numMatch = line.match(LocalSyllabusParser.assignmentNumRegex);
      const isPointsMetadata = !!pointsMatch && (
        lower.startsWith('points:') ||
        lower.startsWith('points possible') ||
        lower.startsWith('points') ||
        lower.startsWith('worth') ||
        lower.startsWith('point value') ||
        lower.endsWith('points possible') ||
        lower.endsWith('points') ||
        /^\d{1,4}\s*points?$/i.test(lower)
      );
      const isAssignHeaderLine = !!percentMatch || !!numMatch || lower.startsWith('overview of required assignments');

      if (isAssignHeaderLine || inRubricSection || isPointsMetadata || (pointsMatch && (isAssignKeyword || inRubricSection))) {
        let weightStr: string | undefined = undefined;
        let pointsStr: string | undefined = undefined;

        const ptsMatch = line.match(LocalSyllabusParser.ptsMatchesRegex) || line.match(/\b(?:points(?:\s+possible)?|pts|point\s+value|worth)\s*[:\-–—]?\s*(\d{1,4})\b/i);
        if (percentMatch) weightStr = percentMatch[0];
        if (ptsMatch) {
          pointsStr = `${ptsMatch[1]} Points`;
        }

        let finalDate = primaryIsoDate;
        if (!finalDate) {
          for (let lookAhead = 1; lookAhead <= 2; lookAhead++) {
            if (idx + lookAhead < lines.length) {
              const nextL = lines[idx + lookAhead];
              const nextDates = this.extractAllDates(nextL, termYear);
              if (nextDates.length > 0) {
                finalDate = nextDates[0].isoString;
                break;
              }
            }
          }
        }
        if (!finalDate) {
          // Also look backwards 1-2 lines for due date e.g. "Due: October 25\nPoints: 100"
          for (let lookBack = 1; lookBack <= 2; lookBack++) {
            if (idx - lookBack >= 0) {
              const prevL = lines[idx - lookBack];
              const prevDates = this.extractAllDates(prevL, termYear);
              if (prevDates.length > 0) {
                finalDate = prevDates[0].isoString;
                break;
              }
            }
          }
        }

        // Check for multi-date presentation window e.g. "May 8 & May 15" or "May 8 and May 15"
        let presentationNote: string | undefined = undefined;
        const presWindowMatch = line.match(/(?:due\s+)?\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}\s*(?:&|and)\s*(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+)?\d{1,2}\b/i);
        if (presWindowMatch) {
          presentationNote = `Presentations: ${presWindowMatch[0].replace(/^(?:due\s+)/i, '').replace(/\band\b/i, '&').replace(/\s+/g, ' ').trim()}`;
        }

        let candidateLine = line;
        const trimmedLower = line.trim().toLowerCase();
        const isMetadataRow = !inRubricSection && !line.includes('\t') && (
          trimmedLower.startsWith('points possible') ||
          trimmedLower.startsWith('grade weight') ||
          trimmedLower.startsWith('description:') ||
          trimmedLower.includes('points possible:') ||
          trimmedLower.includes('of final grade') ||
          trimmedLower.endsWith('points possible') ||
          /^\d{1,4}\s*points?$/.test(trimmedLower) ||
          trimmedLower.startsWith('points:') ||
          trimmedLower === 'of final grade' ||
          isPointsMetadata
        );

        if (isMetadataRow) {
          // If preceding lines within this item denote Category: Reading, skip assignment creation
          let isReadingContext = false;
          for (let b = 1; b <= 4; b++) {
            if (idx - b >= 0) {
              const p = lines[idx - b].trim().toLowerCase();
              if (p === 'reading' || p === 'readings' || p.startsWith('category: reading')) {
                isReadingContext = true;
                break;
              }
            }
          }
          if (isReadingContext) {
            continue;
          }

          // Look backwards for the substantive assignment title
          for (let b = 1; b <= 6; b++) {
            if (idx - b >= 0) {
              const prev = lines[idx - b].trim();
              const prevLower = prev.toLowerCase();
              const isGenericCol =
                prevLower === 'paper' ||
                prevLower === 'article' ||
                prevLower === 'articles' ||
                prevLower === 'video' ||
                prevLower === 'reading' ||
                prevLower === 'readings' ||
                prevLower === 'assignment' ||
                prevLower === 'assignments' ||
                prevLower === 'deliverable' ||
                prevLower === 'deliverables' ||
                prevLower === 'project' ||
                prevLower === 'exam' ||
                prevLower === 'quiz' ||
                prevLower === 'other' ||
                prevLower === 'in_class' ||
                prevLower === 'in-class' ||
                prevLower === 'in class' ||
                prevLower === 'textbook' ||
                prevLower === 'textbooks' ||
                prevLower === 'podcast' ||
                prevLower === 'tutorial' ||
                prevLower === 'deck' ||
                prevLower === 'presentation' ||
                prevLower === 'lab' ||
                prevLower === 'homework' ||
                prevLower === 'problem set' ||
                prevLower === 'task' ||
                prevLower === 'exercise' ||
                prevLower === 'weight' ||
                prevLower === 'points' ||
                prevLower === 'points possible' ||
                prevLower === 'due date' ||
                prevLower === 'date' ||
                prevLower === 'category' ||
                prevLower === 'sub-type' ||
                prevLower === 'subtype' ||
                prevLower === 'type' ||
                prevLower === 'title' ||
                prevLower === 'n/a' ||
                prevLower === 'none' ||
                prevLower === 'essay' ||
                prevLower === 'handout' ||
                prevLower === 'slides' ||
                prevLower === 'lecture' ||
                prevLower === 'notes' ||
                /^week\s*\d+$/i.test(prevLower) ||
                /^module\s*\d+$/i.test(prevLower);

              const strippedPrev = prev.replace(/^\s*(?:week|module|unit|session|mod|wk)\s*\d+[:\-–\s]*/i, '').trim();

              if (
                strippedPrev.length >= 3 &&
                !isGenericCol &&
                !prevLower.startsWith('description:') &&
                !prevLower.startsWith('points') &&
                !prevLower.startsWith('category') &&
                !prevLower.startsWith('sub-type') &&
                !prevLower.startsWith('due:') &&
                !prevLower.startsWith('due ') &&
                !prevLower.includes('detailed assignments') &&
                !this.isBoilerplatePolicyLine(prevLower) &&
                !isInvalidAssignmentTitle(strippedPrev)
              ) {
                candidateLine = strippedPrev;
                break;
              }
            }
          }
          if (candidateLine === line) {
            continue; // pure metadata line with no preceding title, skip!
          }
        }

        const videoUrl = this.extractVideoUrl(candidateLine !== line ? `${candidateLine} ${line}` : line);
        const cleanTitle = this.buildStrict3To5WordTitle(candidateLine, true, true);
        const lowerClean = cleanTitle.toLowerCase();

        const isTotalLine =
          trimmedLower === 'total' ||
          trimmedLower.startsWith('total ') ||
          trimmedLower.startsWith('total\t') ||
          lowerClean === 'total' ||
          lowerClean.startsWith('total ') ||
          lowerClean.includes('total 100');

        if (isTotalLine) {
          if (lastMatchedIndex !== null && lastMatchedIndex < results.length) {
            const rawPts = pointsStr ? (parseFloat(pointsStr.replace(/[^\d.]/g, '')) || undefined) : undefined;
            if (rawPts && rawPts > 0) {
              results[lastMatchedIndex] = {
                ...results[lastMatchedIndex],
                totalPoints: rawPts,
                points: rawPts,
                pointsPossible: `${rawPts} Points`
              };
            }
          }
          inRubricSection = false;
          continue;
        }

        const singleWordRubrics = ['support', 'information', 'attendance', 'apa', 'ethics', 'competence', 'evidence', 'coherence'];
        const multiWordRubricPhrases = [
          'organization and coherence', 'organization & coherence', 'critical analysis',
          'quality of presentation', 'oral presentation', 'self-reflection',
          'self- awareness', 'self- regulation', 'course concepts', 'personal philosophy',
          'grading criteria', 'grade points', 'participation (oral)', 'case conceptualization',
          'therapeutic conversations', 'evaluating information', 'research topic',
          'feedback on the strength', 'feedback on the improvement', 'engagement & attendance',
          'empathy & compassion', 'evidence and support', 'evidence & support', 'analysis and use',
          'analysis and use of course', 'cultural competence', 'professional ethics', 'identity formation',
          'timeliness'
        ];
        const trimmedClean = lowerClean.replace(/^[•\-*▪●: \t\n()]+|[•\-*▪●: \t\n()]+$/g, '');
        const hasExplicitAssignNumber = !!numMatch || /\(\s*\d{1,2}\s*\)/.test(line);

        const isRubricMatch = (inRubricSection ||
          (!weightStr && (
            lowerClean === 'apa' ||
            lowerClean.startsWith('apa ') ||
            lower.includes('apa 10') ||
            singleWordRubrics.includes(trimmedClean) ||
            multiWordRubricPhrases.some(w => lower.includes(w) || trimmedClean === w || trimmedClean.startsWith(w))
          ))) &&
          !hasExplicitAssignNumber;

        if (isRubricMatch) {
          if (
            lowerClean === 'grading criteria' ||
            lowerClean === 'grade points' ||
            lowerClean === 'criteria' ||
            lowerClean === 'of final grade' ||
            lowerClean.startsWith('of final grade')
          ) {
            continue;
          }
          if (lastMatchedIndex !== null && lastMatchedIndex < results.length) {
            const rawPts = pointsStr ? (parseFloat(pointsStr.replace(/[^\d.]/g, '')) || undefined) : undefined;
            const rawPct = weightStr ? parseFloat(weightStr.replace(/[^\d.]/g, '')) : undefined;
            const criterionName = cleanRubricCriterionName(candidateLine.split('\t')[0] || cleanTitle);
            const criterion: RubricCriterionDTO = {
              criterionName,
              points: rawPts,
              percentage: rawPct
            };
            const existing = results[lastMatchedIndex];
            const updatedRubric = [...(existing.rubric ?? []), criterion];
            results[lastMatchedIndex] = {
              ...existing,
              rubric: updatedRubric,
              rubricCriteria: updatedRubric
            };
          }
          continue;
        }

        if (
          isInvalidAssignmentTitle(cleanTitle) ||
          lowerClean.includes('overview required') ||
          lowerClean.includes('total 100') ||
          lowerClean.includes('page ') ||
          lowerClean === 'item title' ||
          lowerClean === 'total' ||
          lowerClean.startsWith('total ') ||
          lowerClean.startsWith('continued participation') ||
          lowerClean.includes('3% of students') ||
          lowerClean.includes('points possible') ||
          lowerClean.endsWith('possible') ||
          lowerClean === 'of final grade' ||
          lowerClean.startsWith('of final grade') ||
          lowerClean === 'article' ||
          lowerClean === 'paper' ||
          lowerClean === 'video' ||
          lowerClean === 'reading' ||
          lowerClean === 'assignment' ||
          /^\d{4}-\d{2}-\d{2}$/.test(lowerClean)
        ) {
          continue;
        }

        const tag = this.classifySemanticCategory(line, weightStr ?? pointsStr, videoUrl);

        if ((tag === 'assignment' || tag === 'inClass') && cleanTitle.length >= 3) {
          const instructions = videoUrl ? `Link: ${videoUrl}` : undefined;

          let matchedIdx: number | null = null;
          const explicitNum = line.match(LocalSyllabusParser.explicitAssignNumRegex);
          if (explicitNum && explicitNum[1]) {
            const num = parseInt(explicitNum[1], 10);
            if (num >= 1 && num <= results.length) {
              matchedIdx = num - 1;
            }
          }

          if (matchedIdx === null) {
            const foundIdx = results.findIndex(a => {
              if (!this.fuzzyMatch(a.title, cleanTitle)) return false;
              if (finalDate && a.dueDate && finalDate !== a.dueDate) return false;
              return true;
            });
            if (foundIdx >= 0) matchedIdx = foundIdx;
          }

          if (matchedIdx !== null) {
            lastMatchedIndex = matchedIdx;
            const existing = results[matchedIdx];
            const mergedDate = finalDate ?? existing.dueDate;
            const mergedWeight = existing.weightPercentage ?? weightStr;
            const mergedPts = existing.pointsPossible ?? pointsStr;
            const mergedNote = presentationNote ?? existing.noteText ?? videoUrl;
            const mergedInstructions = (existing.fullInstructions && existing.fullInstructions.length > 25 && !existing.fullInstructions.includes('Parsed from'))
              ? existing.fullInstructions
              : (instructions ?? existing.fullInstructions);
            const mergedMedia = existing.mediaUrl ?? (videoUrl && !videoUrl.includes('simplesyllabus') ? videoUrl : undefined);
            results[matchedIdx] = {
              ...existing,
              title: existing.title.length >= cleanTitle.length ? existing.title : cleanTitle,
              dueDate: mergedDate,
              pointsPossible: mergedPts,
              weightPercentage: mergedWeight,
              fullInstructions: mergedInstructions,
              mediaUrl: mergedMedia,
              noteText: mergedNote
            };
          } else {
            const dto: AssignmentDTO = {
              id: `assign-${Math.random().toString(36).substring(2, 10)}`,
              title: cleanTitle,
              dueDate: finalDate,
              fullInstructions: instructions,
              pointsPossible: pointsStr,
              weightPercentage: weightStr,
              mediaUrl: videoUrl && !videoUrl.includes('simplesyllabus') ? videoUrl : undefined,
              noteText: presentationNote ?? videoUrl
            };
            results.push(dto);
            lastMatchedIndex = results.length - 1;
          }
        }
      }
    }

    return results;
  }

  // MARK: - PASS 2.5: Canonical Module Curriculum Table Extractor
  public extractCanonicalModules(lines: string[]): Map<number, { modNum: number; theme: string; reading: string }> {
    const map = new Map<number, { modNum: number; theme: string; reading: string }>();
    let currentMod: { modNum: number; theme: string; reading: string } | null = null;

    for (const line of lines) {
      let cells: string[] = [];
      if (line.startsWith('|') && line.endsWith('|')) {
        cells = line.substring(1, line.length - 1).split('|').map(c => c.trim()).filter(Boolean);
      } else if (line.includes('\t')) {
        cells = line.split('\t').map(c => c.trim()).filter(Boolean);
      }

      if (cells.length >= 2) {
        const m = cells[0].match(/^Module\s*(\d{1,2})\b/i);
        if (m) {
          const modNum = parseInt(m[1], 10);
          let theme = '';
          let reading = '';
          if (cells.length === 2) {
            if (/\b(?:chapters?|chs?\.?|ch\.)\b/i.test(cells[1]) || /^[A-Z][a-z]+\s*\(/.test(cells[1])) {
              reading = cells[1];
            } else {
              theme = cells[1];
            }
          } else {
            theme = cells[1];
            reading = cells[2];
          }
          currentMod = { modNum, theme, reading };
          map.set(modNum, currentMod);
          continue;
        } else if (currentMod) {
          // Multi-line continuation row, e.g. Clinical issues in Family Counselling\tGehart (Chapter 8)
          if (cells.length === 2 && !currentMod.reading && (/\b(?:chapters?|chs?\.?|ch\.)\b/i.test(cells[1]) || /^[A-Z][a-z]+\s*\(/.test(cells[1]))) {
            currentMod.theme += ' ' + cells[0];
            currentMod.reading = cells[1];
          }
        }
      } else if (cells.length === 1 && currentMod) {
        if (/\b(?:chapters?|chs?\.?|ch\.)\b/i.test(cells[0]) || /^[A-Z][a-z]+\s*\(/.test(cells[0])) {
          if (!currentMod.reading) currentMod.reading = cells[0];
        }
      }
    }
    return map;
  }

  // MARK: - PASS 3: Weekly Schedule & Readings Extractor
  public extractWeeklyScheduleAndReadings(
    lines: string[],
    rawText: string | null = null,
    termYear: number | undefined,
    courseName: string,
    courseCode: string
  ): { weeks: WeekDTO[]; scheduleAssignments: AssignmentDTO[] } {
    const weeks: WeekDTO[] = [];
    const scheduleAssignments: AssignmentDTO[] = [];

    let currentWeekNum = 1;
    let currentReadings: ReadingDTO[] = [];
    let currentWeekTheme = 'Week 1 Schedule';
    let currentWeekDateRange: string | undefined = undefined;
    let currentWeekDateIso: string | undefined = undefined;
    let inPolicySection = false;
    let hasSeenWeekHeader = false;
    let inSummaryModuleOverview = false;

    const policySectionHeaders = [
      'course policies', 'late assignments', 'late policy', 'late submission', 'extension policy', 'late submission & extension policy', 'extension & late policy', 'coursepal parser', 'mapping guide',
      'university policies', 'non-discrimination',
      'religious accommodations', 'academic integrity', 'ai use policy', 'support services',
      'disability services', 'sensitive content notice', 'master of counselling\'s professional code',
      'professional code (2.0)', 'hallmarks of maturity', 'course resources', 'required texts:', 'required text:'
    ];

    // 0. Structured Schedule & Requirements Table (e.g. CS 501, BIO 412, LAW 702, ECON 305, PHYS 601, HIST 210, ART 150, PSYCH 800)
    const scheduleTableIdx = lines.findIndex((l, li) => {
      const low = l.toLowerCase().trim();
      if (low.includes('course schedule & syllabus requirements') || low.includes('course schedule and syllabus requirements')) return true;
      if (li + 4 < lines.length) {
        const slice = lines.slice(li, li + 7).map(s => s.toLowerCase().trim());
        if (slice.includes('week') && slice.includes('title') && slice.includes('category')) return true;
      }
      return false;
    });

    if (scheduleTableIdx !== -1) {
      let endIdx = lines.length;
      for (let i = scheduleTableIdx + 1; i < lines.length; i++) {
        if (/detailed assignments|course policies|course assignment details|^grading scale\b/i.test(lines[i])) {
          endIdx = i;
          break;
        }
      }

      let rowStart = scheduleTableIdx + 1;
      for (let i = scheduleTableIdx; i < Math.min(scheduleTableIdx + 12, endIdx); i++) {
        if (/due date/i.test(lines[i])) {
          rowStart = i + 1;
          break;
        }
      }

      const groups: string[][] = [];
      let curGroup: string[] = [];
      for (let i = rowStart; i < endIdx; i++) {
        const l = lines[i].trim();
        if (!l) continue;
        if (/^(?:week|wk|module|mod|unit)\s*\d+\b/i.test(l)) {
          if (curGroup.length > 0) groups.push(curGroup);
          curGroup = [l];
        } else {
          if (curGroup.length > 0) curGroup.push(l);
        }
      }
      if (curGroup.length > 0) groups.push(curGroup);

      for (const g of groups) {
        const wkM = g[0].match(/^(?:week|wk|module|mod|unit)\s*(\d{1,2})\b/i);
        const wkNum = wkM ? parseInt(wkM[1], 10) : 1;

        const isReading = g.some(l => l.trim().toLowerCase() === 'reading' || /^category:\s*reading/i.test(l.trim()));
        const isAssignment = g.some(l => /^(?:assignment|deliverable|exam|quiz|project|paper)$/i.test(l.trim().toLowerCase()) || /^category:\s*(?:assignment|deliverable|exam|quiz|project|paper)/i.test(l.trim()));

        const firstLineRest = g[0].replace(/^(?:week|wk|module|mod|unit)\s*\d+[:\-–\s]*/i, '').trim();
        const titleParts = firstLineRest ? [firstLineRest] : [];
        for (let i = 1; i < g.length; i++) {
          const line = g[i].trim();
          if (/^(?:reading|assignment|deliverable|exam|quiz|textbook|article|video|podcast|tutorial|other|in_class|paper|presentation)$/i.test(line)) break;
          if (/^\d+\s*points/i.test(line) || /^\d+%/i.test(line) || /^\d{4}-\d{2}-\d{2}/.test(line) || /^n\/a$/i.test(line)) break;
          titleParts.push(line);
        }
        let fullTitle = titleParts.join(' ').trim();

        const dateM = g.map(l => l.match(/\b(\d{4}-\d{2}-\d{2})\b/)).find(Boolean);
        const subTypeM = g.find(l => /^(?:textbook|article|video|podcast|tutorial|other|in_class|paper|presentation)$/i.test(l.trim()));
        let detectedMedia: 'textbook' | 'article' | 'video' | 'podcast' = 'textbook';
        if (subTypeM) {
          const st = subTypeM.toLowerCase().trim();
          if (st === 'video') detectedMedia = 'video';
          else if (st === 'podcast') detectedMedia = 'podcast';
          else if (st === 'article') detectedMedia = 'article';
        }

        const dateIso = dateM ? dateM[1] : undefined;
        let wkObj = weeks.find(w => w.weekNumber === wkNum);
        if (!wkObj) {
          wkObj = {
            id: `week-${wkNum}`,
            weekNumber: wkNum,
            startDate: dateIso,
            theme: fullTitle || `Week ${wkNum}`,
            dateRangeStr: dateIso,
            readings: []
          };
          weeks.push(wkObj);
        }

        if (isReading || !isAssignment) {
          if (fullTitle.length >= 3 && !isGenericPlaceholderReadingTitle(fullTitle)) {
            const readingDto: ReadingDTO = {
              id: `reading-${Math.random().toString(36).substring(2, 9)}`,
              title: fullTitle,
              mediaType: detectedMedia,
              isCompleted: false,
              summaryText: `Study ${fullTitle}`,
              keyTakeawaysText: `• Review ${fullTitle}`,
              dueDate: dateIso,
              dateRangeStr: dateIso
            };
            if (!wkObj.readings!.some(r => r.title.toLowerCase() === fullTitle.toLowerCase())) {
              wkObj.readings!.push(readingDto);
            }
          }
        }
      }

      if (weeks.length > 0) {
        return { weeks, scheduleAssignments };
      }
    }

    const scheduleStartIdx = lines.findIndex(l => {
      const low = l.toLowerCase().trim();
      return /^(?:weekly\s+(?:term\s+)?schedule|course\s+schedule|schedule\s+of\s+classes|tentative\s+schedule|course\s+outline\s*&?\s*schedule|class\s+schedule)\b/i.test(low) ||
        /\b(?:timeline|week)\s+(?:module\s+)?core\s+topic\s+focus\s+required\s+literature\b/i.test(low);
    });

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lower = line.trim().toLowerCase();
      const cleanLower = lower.replace(/^[•\-*▪● \t]+|[•\-*▪● \t]+$/g, '');
      if (lower.length === 0) continue;
      if (scheduleStartIdx !== -1 && idx < scheduleStartIdx) continue;

      const isWeekOrScheduleHeader = lower.includes('date content requirements') ||
        lower.includes('weekly schedule') ||
        lower.includes('course schedule') ||
        lower.includes('week modules topics readings') ||
        lower.includes('topics, modules') ||
        lower.includes('timeline module') ||
        lower.startsWith('timeline') ||
        lower.startsWith('week ') ||
        lower.startsWith('module ') ||
        lower.startsWith('unit ') ||
        lower.startsWith('week 1') ||
        /^\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/.test(line) ||
        lower.includes('corey') || lower.includes('yalom') || lower.includes('creswell') || lower.includes('gehart') || lower.includes('brightspace') ||
        (lower.startsWith('1 ') && (lower.includes('jul') || lower.includes('aug') || lower.includes('sep') || lower.includes('jan') || lower.includes('feb') || lower.includes('mar')));

      const isScheduleTableHeaderRow = (
        (lower.includes('timeline') || lower.includes('week') || lower.includes('date') || lower.includes('session')) &&
        (lower.includes('topic') || lower.includes('theme') || lower.includes('content') || lower.includes('module')) &&
        (lower.includes('reading') || lower.includes('docs') || lower.includes('requirements') || lower.includes('materials'))
      ) || /^(?:timeline\s+module|week\s+modules?\s+topics?|date\s+content\s+requirements)/i.test(lower);

      if (isScheduleTableHeaderRow && !/^\s*(?:week|wk|module|mod|unit|session)\s*\d+/i.test(line)) {
        inPolicySection = false;
        continue;
      }

      if (isWeekOrScheduleHeader) {
        inPolicySection = false;
      }
      if (policySectionHeaders.some(h => lower.includes(h)) && !isWeekOrScheduleHeader) {
        inPolicySection = true;
      }
      if (inPolicySection) continue;
      if (this.isBoilerplatePolicyLine(lower)) continue;

      if (
        lower.includes('the following modules and topics will be integrated') ||
        lower.includes('modules and topics will be integrated') ||
        (weeks.length >= 8 && /^(?:modules?\s*\t\s*topics|modules?\s+topics?\s+related readings?)/i.test(line))
      ) {
        if (weeks.length >= 8) {
          if (currentWeekNum > 0 && !weeks.some(w => w.weekNumber === currentWeekNum)) {
            weeks.push({
              id: `week-${currentWeekNum}`,
              weekNumber: currentWeekNum,
              startDate: currentWeekDateIso,
              theme: currentWeekTheme,
              dateRangeStr: currentWeekDateRange,
              readings: currentReadings
            });
            currentReadings = [];
          }
          break;
        } else {
          inSummaryModuleOverview = true;
          continue;
        }
      }

      if (inSummaryModuleOverview) {
        if (
          isWeekOrScheduleHeader ||
          lower.includes('course schedule') ||
          lower.includes('course session/date') ||
          /^\s*(?:week|wk|module|session|unit)\s*1\b/i.test(line)
        ) {
          inSummaryModuleOverview = false;
        } else {
          continue;
        }
      }

      const instructionPrefixes = ['this paper', 'the video', 'the deadline', 'each week', 'in small groups', 'beginning in', 'prepare an', 'write an', 'following our', 'by the end', 'in response', 'guided by', 'students will', 'students are'];
      if (instructionPrefixes.some(p => lower.startsWith(p))) continue;

      let foundWeekNum: number | null = null;
      for (const regex of LocalSyllabusParser.weekHeaderRegexes) {
        const match = line.match(regex);
        if (match) {
          for (let g = match.length - 1; g >= 1; g--) {
            const token = match[g];
            if (!token || token.includes('/') || token.includes('-') || token.includes('–')) continue;
            const val = parseInt(token, 10);
            if (!isNaN(val)) {
              foundWeekNum = val;
              break;
            }
          }
          if (foundWeekNum !== null) break;
        }
      }

      const isReadingWeekNotice = lower.includes('during reading week') || (lower.includes('schedule') && lower.includes('reading week')) || (idx > 0 && lines[idx - 1].toLowerCase().includes('during'));
      const isReadingWeekLine = !isReadingWeekNotice && (lower.includes('reading week') || lower.includes('readi ng week'));
      if (isReadingWeekLine) {
        if (foundWeekNum === null) {
          foundWeekNum = currentWeekNum + 1;
        }
      } else if (foundWeekNum !== null && weeks.some(w => (w.theme || '').toLowerCase().includes('reading week'))) {
        foundWeekNum = Math.max(foundWeekNum, (weeks[weeks.length - 1]?.weekNumber ?? 0) + 1);
      }

      // Standalone digit week header check (e.g. "1" followed by "July 3rd" on next line)
      if (foundWeekNum === null) {
        const trimmed = line.trim();
        const numVal = parseInt(trimmed, 10);
        if (!isNaN(numVal) && String(numVal) === trimmed && numVal >= 1 && numVal <= 16) {
          if (idx + 1 < lines.length) {
            const nextLower = lines[idx + 1].toLowerCase();
            const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            if (months.some(m => nextLower.includes(m))) {
              foundWeekNum = numVal;
            }
          }
        }
      }

      if (foundWeekNum !== null) {
        hasSeenWeekHeader = true;
        inPolicySection = false;
        if (
          currentReadings.length === 0 &&
          currentWeekTheme &&
          !currentWeekTheme.toLowerCase().startsWith('week ') &&
          !currentWeekTheme.toLowerCase().startsWith('module ') &&
          !currentWeekTheme.toLowerCase().includes('reading week') &&
          !currentWeekTheme.toLowerCase().includes('break') &&
          !isDeliverableNotReading(currentWeekTheme)
        ) {
          const isReadingLike = /\b(?:reading|article|chapter|ch\.|textbook|handout|lecture|video)\b/i.test(currentWeekTheme);
          if (isReadingLike) {
            currentReadings.push({
              id: `reading-${Math.random().toString(36).substring(2, 9)}`,
              title: currentWeekTheme,
              isCompleted: false,
              dueDate: currentWeekDateIso,
              dateRangeStr: currentWeekDateRange
            });
          }
        }
        if (currentReadings.length > 0 || (currentWeekNum !== foundWeekNum && !weeks.some(w => w.weekNumber === currentWeekNum))) {
          currentReadings.sort((a, b) => {
            const chA = parseChapterNumbers(`${a.chapterText || ''} ${a.title || ''}`)[0] ?? 999999;
            const chB = parseChapterNumbers(`${b.chapterText || ''} ${b.title || ''}`)[0] ?? 999999;
            if (chA !== chB) return chA - chB;
            return a.title.localeCompare(b.title);
          });
          weeks.push({
            id: `week-${currentWeekNum}`,
            weekNumber: currentWeekNum,
            startDate: currentWeekDateIso,
            theme: currentWeekTheme,
            dateRangeStr: currentWeekDateRange,
            readings: currentReadings
          });
          currentReadings = [];
        }

        currentWeekNum = foundWeekNum;
        const modMatch = line.match(/\b(module\s*\d+|mod\s*\d+)\b/i);
        const modulePrefix = modMatch ? modMatch[0].toUpperCase() : null;

        let rawTheme = line
          .replace(/^\s*(?:week|unit|session)\s*\d+[:\-–\s]*/i, '')
          .replace(/^\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*/i, '')
          .replace(/^\s*(\d{1,2})\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\s*/i, '')
          .replace(/^\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*[\/\-–]\s*\d{1,2}(?:st|nd|rd|th)?)?(?:\s*,?\s*\d{4})?\s*[:\-–—]?\s*/i, '')
          .replace(/^\s*(?:module|modu\s*le|unit|session)\s*\d+[:\-–\s]*/i, '')
          .replace(/^\s*(?:reading\s*week|readi\s*ng\s*week)\s*[-–—]?\s*/i, '')
          .replace(/^\s*(?:modules?|topics?|related readings?|course session\/?date)\s*/i, '')
          .trim();
        let cleanTheme = rawTheme;
        const citRegexMatch = rawTheme.match(LocalSyllabusParser.citationRegex);
        let endDocM = rawTheme.match(LocalSyllabusParser.endDocRegex);
        let endDocIndex = endDocM?.index;
        if (endDocM && endDocIndex !== undefined) {
          const dupM = endDocM[1].match(/^([A-Za-z0-9\-]+)\s+\1\b/);
          if (dupM) {
            endDocIndex += dupM[1].length;
          }
        }
        let citM: { index?: number; [0]: string } | null = null;
        if (citRegexMatch && citRegexMatch.index !== undefined) {
          if (!endDocM || (endDocIndex !== undefined && citRegexMatch.index < endDocIndex)) {
            citM = citRegexMatch;
          } else if (endDocM && endDocIndex !== undefined && endDocIndex > 3) {
            citM = { index: endDocIndex, [0]: endDocM[1] };
          }
        } else if (endDocM && endDocIndex !== undefined && endDocIndex > 3) {
          citM = { index: endDocIndex, [0]: endDocM[1] };
        } else {
          citM = rawTheme.match(LocalSyllabusParser.technicalDocRegex);
        }
        if (citM && citM.index !== undefined && citM.index > 3) {
          cleanTheme = rawTheme.substring(0, citM.index).trim();
        } else {
          const litM = rawTheme.match(/\b(Clinical Dossier Packets|CTRS Manual(?: & Scoring Guides)?|Scoring Guides|Peer Consultation Protocol Sheets|Canadian Code of Ethics|Indigenous Perspectives)\b/i) ||
            rawTheme.match(/\b([A-Z][a-zA-Z\s&,\.\-–—'’/]+?\b(?:Manuals?|Guides?|Scoring\s+Guides?|Packets?|Dossiers?|Protocol\s+Sheets?|Protocols?|Code\s+of\s+Ethics|Ethics\s+Code))\b/i);
          if (litM && litM.index !== undefined && litM.index > 3) {
            cleanTheme = rawTheme.substring(0, litM.index).trim();
          }
        }
        cleanTheme = cleanTheme
          .replace(/\b(?:Corey|Yalom|Creswell|Gehart|Nichols|Davis|APA|See Brightspace|Assigned Readings|Sexuality Counseling|Human\s+Sexuality|Growing into Resilience)\b.*$/i, '')
          .replace(/^[|•\-*▪●:·~_§ \t\n–—]+|[|•\-*▪●:·~_§ \t\n–—]+$/g, '')
          .trim();

        currentWeekDateRange = undefined;
        currentWeekDateIso = undefined;
        const dates = this.extractAllDates(line, termYear);
        let headerDates = dates.length === 0 && idx + 1 < lines.length ? this.extractAllDates(lines[idx + 1], termYear) : dates;
        if (headerDates.length === 0 && idx > 0) {
          headerDates = this.extractAllDates(lines[idx - 1], termYear);
        }
        if (headerDates.length === 0 && idx > 1) {
          headerDates = this.extractAllDates(lines[idx - 2], termYear);
        }

        if (headerDates.length >= 2) {
          const dStart = headerDates[0];
          const dEnd = headerDates[1];
          currentWeekDateIso = dStart.isoString;
          currentWeekDateRange = LocalSyllabusParser.formatExplicitDateRange(dStart.date, dEnd.date, dStart, dEnd);
        } else if (headerDates.length === 1) {
          currentWeekDateIso = headerDates[0].isoString;
          currentWeekDateRange = headerDates[0].displayString;
        }

        if (isReadingWeekLine) {
          currentWeekTheme = 'Reading Week – No Class';
          weeks.push({
            id: `week-${currentWeekNum}`,
            weekNumber: currentWeekNum,
            startDate: currentWeekDateIso,
            theme: currentWeekTheme,
            dateRangeStr: currentWeekDateRange,
            readings: []
          });
          currentReadings = [];
          currentWeekTheme = '';
          continue;
        } else if (modulePrefix) {
          currentWeekTheme = cleanTheme.length === 0 ? modulePrefix : `${modulePrefix}: ${cleanTheme}`;
        } else {
          currentWeekTheme = cleanTheme.length === 0 ? `Week ${foundWeekNum}` : cleanTheme;
        }

        const lineHasCitation = LocalSyllabusParser.citationRegex.test(line) ||
          LocalSyllabusParser.technicalDocRegex.test(line) ||
          lower.includes('corey') || lower.includes('yalom') || lower.includes('creswell') ||
          lower.includes('gehart') || lower.includes('nichols') || lower.includes('davis') ||
          /\b(?:manuals?|dossiers?|packets?|protocols?|sheets?|perspectives?|ethics|guidelines?|code\s+of\s+ethics|handouts?|clinical\s+dossier|ctrs\s+manual|indigenous\s+perspectives|peer\s+consultation)\b/i.test(lower);
        if (!lineHasCitation) continue;
      }

      if (!hasSeenWeekHeader) continue;

      const videoUrl = this.extractVideoUrl(line);
      const hasValidUrl = !!videoUrl;

      const hasReadingCitations = LocalSyllabusParser.technicalDocRegex.test(line) ||
        LocalSyllabusParser.citationRegex.test(line) ||
        LocalSyllabusParser.chapterRegex.test(line) ||
        lower.includes('gehart') || lower.includes('corey') || lower.includes('yalom');

      const isDeliverableLine = !hasReadingCitations && (
        isDeliverableNotReading(line) ||
        lower.includes('assignment') ||
        /\b(?:term|final|reflection|position)\s+papers?\b/i.test(lower) ||
        lower.includes('due date') || lower.includes('due:') ||
        lower.includes('conceptualization') || lower.includes('family map') ||
        lower.includes('in-class') || lower.includes('presentation') ||
        lower.includes('exam') || lower.includes('quiz') || lower.includes('deliverable') ||
        (lower.includes('%') && !lower.includes('gehart') && !lower.includes('chapter'))
      );

      if (isDeliverableLine) {
        const dueM = line.match(/\bdue:\s*([A-Za-z0-9][A-Za-z0-9\s,&–\-/]+)/i);
        const worthM = line.match(/(?:worth\s*)?(\d{1,3}%)(?:\s*of\s*(?:their\s*)?final\s*(?:mark|grade))?/i);
        const ptsM = line.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i);
        let candTitle = '';
        if (dueM) {
          candTitle = dueM[1].trim();
        } else if (/\bin[\s-]class/i.test(line)) {
          const inM = line.match(/\b([A-Za-z0-9\s,&–\-/]+?\b(?:conceptualization|assignment|presentation|exam|quiz)\b)/i);
          candTitle = inM ? inM[1].trim() : line.trim();
        } else {
          candTitle = line.split(/\t+|\s{3,}/)[0].replace(/^[*•\-–\s]+/, '').trim();
        }
        candTitle = candTitle.replace(/\b(?:gehart|corey|yalom|creswell|chapter|ch\.)\b.*$/i, '').trim();
        candTitle = this.buildStrict3To5WordTitle(candTitle, true, true);
        if (candTitle.length >= 3 && !isInvalidAssignmentTitle(candTitle)) {
          if (!scheduleAssignments.some(sa => sa.title.toLowerCase() === candTitle.toLowerCase())) {
            scheduleAssignments.push({
              id: `assign-${Math.random().toString(36).substring(2, 10)}`,
              title: candTitle,
              weekNumber: currentWeekNum,
              dueDate: currentWeekDateIso,
              weightPercentage: worthM ? (worthM[1].endsWith('%') ? worthM[1] : `${worthM[1]}%`) : undefined,
              pointsPossible: ptsM ? `${ptsM[1]} Points` : undefined,
              rubricCriteria: []
            });
          }
        }
        // If the line contains NO reading citations, do not process as reading
        if (!hasReadingCitations) {
          continue;
        }
      }

      let workLine = line.trim();
      workLine = workLine.replace(/^\s*(?:week|unit|session)\s*\d+[:\-–\s]*/i, '');
      workLine = workLine.replace(/^\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*/i, '');
      workLine = workLine.replace(/^\s*(?:module|modu\s*le|unit|session)\s*\d+[:\-–\s]*/i, '');
      workLine = workLine.replace(/^\s*(?:modules?|topics?|related readings?|course session\/?date)\s*/i, '');
      workLine = workLine.replace(/^[•\-*▪●: \t]+|[•\-*▪●: \t]+$/g, '');

      const isBookCitation = LocalSyllabusParser.citationRegex.test(workLine) ||
        LocalSyllabusParser.chapterRegex.test(workLine) ||
        LocalSyllabusParser.pagesRegex.test(workLine) ||
        LocalSyllabusParser.technicalDocRegex.test(workLine) ||
        lower.includes('corey') || lower.includes('yalom') || lower.includes('creswell') ||
        lower.includes('gehart') || lower.includes('nichols') || lower.includes('davis') ||
        lower.includes('isbn:') || lower.includes('(6th ed)') || lower.includes('7th canadian') ||
        lower.includes('sexuality counseling') || lower.includes('human sexuality') || lower.includes('growing into resilience') ||
        /\b(?:manuals?|dossiers?|packets?|protocols?|sheets?|perspectives?|ethics|guidelines?|code\s+of\s+ethics|handouts?|clinical\s+dossier|ctrs\s+manual|indigenous\s+perspectives|peer\s+consultation)\b/i.test(lower) ||
        cleanLower.startsWith('read:') || cleanLower.startsWith('reading:') || cleanLower.startsWith('readings:') ||
        cleanLower.startsWith('required:') || cleanLower.startsWith('required reading') ||
        cleanLower.startsWith('watch:') || cleanLower.startsWith('listen:') || cleanLower.startsWith('podcast:') ||
        hasValidUrl;

      if (!isBookCitation) {
        if (
          hasSeenWeekHeader &&
          foundWeekNum === null &&
          currentReadings.length > 0 &&
          /^(?:whitepapers?|papers?|docs?|guides?|specs?|architecture)\b/i.test(cleanLower)
        ) {
          const lastR = currentReadings[currentReadings.length - 1];
          lastR.title = `${lastR.title} ${line.trim()}`.trim();
          lastR.keyTakeawaysText = `• Review ${lastR.title}`;
          continue;
        }

        if (
          hasSeenWeekHeader &&
          foundWeekNum === null &&
          currentReadings.length === 0 &&
          currentWeekTheme &&
          !isDeliverableLine &&
          cleanLower.length >= 2 &&
          cleanLower.length <= 60 &&
          !policySectionHeaders.some(h => lower.includes(h)) &&
          !/^(course\s+schedule|weekly\s+schedule|timeline|date\s+content)/i.test(cleanLower)
        ) {
          currentWeekTheme = `${currentWeekTheme} ${line.trim()}`.trim();
        }
        continue;
      }

      // Check subsegments, splitting multiple book citations if present
      let subSegments: string[] = [];
      const multiBookRegex = /(Sexuality Counseling:\s*Theory,\s*Research,\s*and\s*Practice|Human\s+Sexuality\s+in\s+a\s+World\s+of\s+Diversity(?:,\s*7th\s+Canadian\s+Edition)?|Growing\s+into\s+Resilience:\s*Sexual\s+and\s+Gender\s+Minority\s+Youth\s+in\s+Canada)/gi;
      const bookIndices: { title: string; index: number; length: number }[] = [];
      let bm: RegExpExecArray | null;
      while ((bm = multiBookRegex.exec(workLine)) !== null) {
        bookIndices.push({ title: bm[1].replace(/\s+/g, ' ').trim(), index: bm.index, length: bm[0].length });
      }

      if (bookIndices.length > 0) {
        if (bookIndices[0].index > 0) {
          const lead = workLine.substring(0, bookIndices[0].index).trim();
          if (lead.length >= 3) subSegments.push(lead);
        }
        for (let bi = 0; bi < bookIndices.length; bi++) {
          const b = bookIndices[bi];
          const nextIdx = bi + 1 < bookIndices.length ? bookIndices[bi + 1].index : workLine.length;
          const bookSegment = workLine.substring(b.index + b.length, nextIdx).trim();
          if (bookSegment.includes('•')) {
            const chapters = bookSegment.split(/\s*•\s*/).map(c => c.trim()).filter(c => c.length > 0);
            for (const ch of chapters) {
              subSegments.push(`${b.title}: ${ch}`);
            }
          } else if (bookSegment.length > 0) {
            subSegments.push(`${b.title}: ${bookSegment}`);
          } else {
            subSegments.push(b.title);
          }
        }
      } else if (workLine.includes(';')) {
        subSegments = workLine.split(';').map(s => s.trim()).filter(s => s.length >= 3);
      } else {
        const bookSplit = workLine.split(/(?<!(?:&|and)\s*)(?=(?:Corey|Yalom|Creswell|Neimeyer|Harris|Hochstetler|Bishop|Gehart|See Brightspace)\b)/i).map(s => s.trim()).filter(s => s.length >= 3);
        subSegments = bookSplit.length > 1 ? bookSplit : [workLine];
      }

      for (const segment of subSegments) {
        if (!hasValidUrl) {
          const isSegmentCitation = LocalSyllabusParser.citationRegex.test(segment) ||
            LocalSyllabusParser.technicalDocRegex.test(segment) ||
            /(?:Corey|Yalom|Creswell|Neimeyer|Harris|Hochstetler|Bishop|Gehart|See Brightspace)\b/i.test(segment) ||
            /\b(?:chapters?|chps?\.?|chs?\.?|chap\.?|ch\b\.?|sections?|sec\.?)\s*\d+/i.test(segment) ||
            /\b(?:pp?\.?|pages?)\s*\d+/i.test(segment) ||
            /\b(?:manuals?|dossiers?|packets?|protocols?|sheets?|perspectives?|ethics|guidelines?|code\s+of\s+ethics|handouts?|clinical\s+dossier|ctrs\s+manual|indigenous\s+perspectives|peer\s+consultation)\b/i.test(segment) ||
            segment.toLowerCase().startsWith('read:');
          if (!isSegmentCitation) continue;
        }

        const segmentUrl = this.extractVideoUrl(segment) ?? ((hasValidUrl && subSegments.length === 1) ? videoUrl : undefined);
        let exactTitle = segment;
        let finalTopic: string | undefined = !currentWeekTheme.toLowerCase().startsWith('week ') ? currentWeekTheme : undefined;

        if (segmentUrl) {
          let cleanSeg = segment
            .replace(segmentUrl, '')
            .replace(/\b(?:watch:?|listen:?|video:?|podcast:?|required:?|read:?)\b[:\s-]*/gi, '')
            .replace(/^[•\-*▪●(): \t\n ]+|[•\-*▪●(): \t\n ]+$/g, '')
            .trim();
          if (cleanSeg.length >= 3 && !/^https?:\/\//i.test(cleanSeg)) {
            exactTitle = cleanSeg;
          } else if (segmentUrl.includes('youtube.com') || segmentUrl.includes('youtu.be')) {
            exactTitle = 'YouTube Video';
          } else if (segmentUrl.includes('ted.com')) {
            exactTitle = 'TED Talk';
          } else if (segmentUrl.includes('podbean')) {
            exactTitle = 'Podcast Episode';
          } else {
            exactTitle = 'Web Resource';
          }
        } else {
          const words = segment.trim().split(/\s+/);
          const techM = segment.match(LocalSyllabusParser.technicalDocRegex);

          let segEndDocM = segment.match(LocalSyllabusParser.endDocRegex);
          let segEndDocIdx = segEndDocM?.index;
          let segEndDocTitle = segEndDocM ? segEndDocM[1] : undefined;
          if (segEndDocM && segEndDocIdx !== undefined && segEndDocTitle) {
            const dupM = segEndDocTitle.match(/^([A-Za-z0-9\-]+)\s+\1\b/);
            if (dupM) {
              segEndDocIdx += dupM[1].length;
              segEndDocTitle = segEndDocTitle.substring(dupM[1].length).trim();
            }
          }

          const citMatch = segment.match(LocalSyllabusParser.citationRegex);
          const isStandaloneDoc = words.length <= 5 && techM && techM.index === 0 && Math.abs(techM[0].length - segment.trim().length) <= 3;
          const litMatch = isStandaloneDoc
            ? { index: 0, [0]: techM![0] }
            : ((segEndDocM && segEndDocIdx !== undefined && segEndDocTitle && segEndDocIdx > 3)
              ? { index: segEndDocIdx, [0]: segEndDocTitle }
              : (segment.match(/\b(Clinical Dossier Packets|CTRS Manual(?: & Scoring Guides)?|Scoring Guides|Peer Consultation Protocol Sheets|Canadian Code of Ethics|Indigenous Perspectives)\b/i) ||
                techM ||
                segment.match(/\b([A-Z][a-zA-Z\s&,\.\-–—'’/]+?\b(?:Manuals?|Guides?|Scoring\s+Guides?|Packets?|Dossiers?|Protocol\s+Sheets?|Protocols?|Code\s+of\s+Ethics|Ethics\s+Code))\b/i)));

          if (segment.includes(': Chapter ') || segment.includes(': chapter ') || segment.includes(': Ch.')) {
            exactTitle = segment.replace(/^[•\-*▪●: \t]+|[•\-*▪●: \t]+$/g, '').trim();
          } else if (citMatch && citMatch.index !== undefined) {
            let cleanCit = citMatch[0].replace(/^[•\-*▪●: \t]+|[•\-*▪●: \t]+$/g, '').trim();
            const openC = (cleanCit.match(/\(/g) || []).length;
            const closeC = (cleanCit.match(/\)/g) || []).length;
            if (openC > closeC) cleanCit += ')';
            else if (closeC > openC) cleanCit = cleanCit.replace(/\)+$/, '');
            exactTitle = cleanCit;

            const topicRaw = segment.substring(0, citMatch.index)
              .replace(/\b(modules?|topics?|related readings?)\b/gi, '')
              .replace(/^[•\-*▪●(): \t\n ]+|[•\-*▪●(): \t\n ]+$/g, '');
            if (
              topicRaw.length >= 4 &&
              !/^(?:week|wk|module|mod|unit|lecture)\s*\d*$/i.test(topicRaw) &&
              !/^(?:chapters?|chaps?\.?|chs?\.?|ch\.?|sections?|sec\.?)\s*\d+/i.test(topicRaw) &&
              !/^(?:pp?\.?|pages?)\s*\d+/i.test(topicRaw)
            ) {
              finalTopic = topicRaw;
            }
          } else if (litMatch && litMatch.index !== undefined) {
            const topicRaw = segment.substring(0, litMatch.index)
              .replace(/\b(modules?|topics?|related readings?)\b/gi, '')
              .replace(/^[•\-*▪●(): \t\n ]+|[•\-*▪●(): \t\n ]+$/g, '');
            if (
              topicRaw.length >= 4 &&
              !/^(?:week|wk|module|mod|unit|lecture)\s*\d*$/i.test(topicRaw) &&
              !/^(?:chapters?|chaps?\.?|chs?\.?|ch\.?|sections?|sec\.?)\s*\d+/i.test(topicRaw) &&
              !/^(?:pp?\.?|pages?)\s*\d+/i.test(topicRaw)
            ) {
              finalTopic = topicRaw;
              exactTitle = litMatch[0].replace(/^[•\-*▪●: \t]+|[•\-*▪●: \t]+$/g, '').trim();
            } else {
              exactTitle = litMatch[0] ? litMatch[0].replace(/^[•\-*▪●: \t]+|[•\-*▪●: \t]+$/g, '').trim() : segment.replace(/^[•\-*▪●: \t]+|[•\-*▪●: \t]+$/g, '').trim();
            }
          } else {
            exactTitle = segment.replace(/\b(modules?|topics?|related readings?)\b/gi, '').replace(/^[•\-*▪●(): \t\n ]+|[•\-*▪●(): \t\n ]+$/g, '');
          }
        }

        const lowerTitle = exactTitle.toLowerCase();
        const rejectedTitles = [
          'assignment', 'assignments', 'requirements', 'date content requirements',
          'in class assignment', 'modules topics', 'topics', 'readings', 'related readings',
          'required reading', 'required readings', 'required reading & core materials',
          'required readings & core materials', 'assigned reading', 'assigned readings',
          'core materials', 'reading list', 'textbooks', 'required texts', 'course readings',
          'article', 'articles', 'required article', 'required articles', 'assigned articles',
          'selected articles', 'journal article', 'journal articles', 'handout', 'handouts',
          'lecture notes', 'lecture slides', 'slides', 'notes', 'materials', 'course materials',
          'tbd', 'none', 'n/a', 'no reading', 'no readings', 'flex week', 'reading week',
          'no class', 'no classes',
          'case conceptualization', 'case conceptualizations', 'in-class case conceptualization',
          'family map', 'family mapping', 'family mapping paper', 'family mapping papers',
          'presentation', 'presentations', 'group presentation', 'group presentations',
          'peer review', 'feedback case conceptualizations'
        ];
        if (
          rejectedTitles.includes(lowerTitle) ||
          exactTitle.length < 3 ||
          isGenericPlaceholderReadingTitle(exactTitle) ||
          isDeliverableNotReading(exactTitle) ||
          isDeliverableNotReading(segment) ||
          lowerTitle.includes('required reading & core materials') ||
          lowerTitle.includes('required readings & core materials') ||
          lowerTitle.includes('reading week') ||
          lowerTitle.includes('no class') ||
          lowerTitle === 'reading' ||
          lowerTitle === 'readings' ||
          lowerTitle === 'article' ||
          lowerTitle === 'articles'
        ) continue;

        const dates = this.extractAllDates(line, termYear);
        const isoDate = dates.length > 0 ? dates[0].isoString : currentWeekDateIso;
        const { chapter: ch, pages: pg } = this.extractChapterAndPages(segment);
        const isChapterReading = !!ch || /[:\-–—]\s*(?:Chapter|Ch\.)/i.test(segment) || /^(?:Chapter|Ch\.)/i.test(segment);
        const isPodcast = !isChapterReading && (
          lower.startsWith('listen') || lower.startsWith('podcast') ||
          segment.toLowerCase().includes('podbean') ||
          segment.toLowerCase().includes('podcasts.apple.com') ||
          segment.toLowerCase().includes('spotify.com') ||
          /\bpodcast\b/i.test(segment)
        );
        const isVideo = !isChapterReading && !isPodcast && (
          lower.startsWith('watch') ||
          segment.toLowerCase().includes('ted.com') ||
          segment.toLowerCase().includes('youtube') ||
          segment.toLowerCase().includes('youtu.be') ||
          segment.toLowerCase().includes('vimeo') ||
          (!!segmentUrl && !isPodcast)
        );
        const isPaper = !isChapterReading && !isPodcast && !isVideo && (
          /\b(?:paper|papers|journal|doi\.org|whitepaper|whitepapers)\b/i.test(segment) ||
          /\(\s*\d{4}\s*\)/.test(segment)
        );
        const isArticle = !isChapterReading && !isPodcast && !isVideo && !isPaper && (
          /\b(?:article|articles|docs?|documentation|specs?|specifications?|guides?|user\s+guide|architecture|pricing\s+guides?)\b/i.test(segment)
        );
        const mediaTypeStr: MediaType = isPodcast ? 'podcast' : (isVideo ? 'video' : (isPaper ? 'paper' : (isArticle ? 'article' : 'textbook')));

        const smartTitle = this.cleanAndSummarizeTitle(exactTitle, true);
        const finalTitle = smartTitle.length === 0 ? exactTitle : smartTitle;
        const { author: extractedAuthor, resource: extractedRes } = this.extractAuthorAndResource(finalTitle);

        const estimatedTimeText = (mediaTypeStr === 'podcast' || mediaTypeStr === 'video')
          ? '~20–30 min'
          : (mediaTypeStr === 'paper' || mediaTypeStr === 'article' ? '~30–45 min' : '~40–60 min');

        const readingDTO: ReadingDTO = {
          id: `read-${Math.random().toString(36).substring(2, 10)}`,
          title: finalTitle,
          authorName: extractedAuthor,
          resourceTitle: (extractedRes && /[a-zA-Z]/.test(extractedRes))
            ? extractedRes
            : (extractedAuthor || /^(?:chapters?|chs?\.?)\b/i.test(finalTitle) || /\bchapters?\s*\d+/i.test(finalTitle) ? undefined : (finalTitle.split(/\s+/).length <= 5 && /[a-zA-Z]/.test(finalTitle) && !/^\d+[\s:.\-–—]+\d+$/.test(finalTitle) ? finalTitle : undefined)),
          mediaType: mediaTypeStr,
          isCompleted: false,
          summaryText: '',
          keyTakeawaysText: `• Review ${finalTitle}`,
          estimatedTimeText,
          videoUrl: segmentUrl,
          dueDate: isoDate,
          dateRangeStr: currentWeekDateRange,
          relevantTopics: finalTopic,
          chapterText: ch,
          pagesText: pg
        };

        if (!currentReadings.some(r => r.title.toLowerCase() === finalTitle.toLowerCase())) {
          currentReadings.push(readingDTO);
        }
      }
    }

    if (
      currentReadings.length === 0 &&
      currentWeekTheme &&
      !currentWeekTheme.toLowerCase().startsWith('week ') &&
      !currentWeekTheme.toLowerCase().startsWith('module ') &&
      !isDeliverableNotReading(currentWeekTheme)
    ) {
      const isReadingLike = /\b(?:reading|article|chapter|ch\.|textbook|handout|lecture|video)\b/i.test(currentWeekTheme);
      if (isReadingLike) {
        currentReadings.push({
          id: `reading-${Math.random().toString(36).substring(2, 9)}`,
          title: currentWeekTheme,
          isCompleted: false,
          dueDate: currentWeekDateIso,
          dateRangeStr: currentWeekDateRange
        });
      }
    }

    if (currentReadings.length > 0 || (currentWeekNum > 0 && !weeks.some(w => w.weekNumber === currentWeekNum))) {
      currentReadings.sort((a, b) => {
        const chA = parseChapterNumbers(`${a.chapterText || ''} ${a.title || ''}`)[0] ?? 999999;
        const chB = parseChapterNumbers(`${b.chapterText || ''} ${b.title || ''}`)[0] ?? 999999;
        if (chA !== chB) return chA - chB;
        return a.title.localeCompare(b.title);
      });
      weeks.push({
        id: `week-${currentWeekNum}`,
        weekNumber: currentWeekNum,
        startDate: currentWeekDateIso,
        theme: currentWeekTheme,
        dateRangeStr: currentWeekDateRange,
        readings: currentReadings
      });
    }

    const canonicalModules = this.extractCanonicalModules(lines);
    if (canonicalModules.size > 0) {
      if (weeks.length === 0) {
        for (const [modNum, mod] of canonicalModules.entries()) {
          const { chapter, pages } = this.extractChapterAndPages(mod.reading);
          const { author } = this.extractAuthorAndResource(mod.reading);
          const fullReadingTitle = mod.theme ? `${mod.reading} · ${mod.theme}` : mod.reading;
          weeks.push({
            id: `week-${modNum}`,
            weekNumber: modNum,
            theme: mod.theme || `Module ${modNum}`,
            readings: mod.reading ? [{
              id: `reading-canonical-${mod.modNum}`,
              title: fullReadingTitle,
              authorName: author || 'Diane R. Gehart',
              chapterText: chapter,
              pagesText: pages,
              mediaType: 'textbook',
              relevantTopics: mod.theme,
              isCompleted: false,
              summaryText: `Study ${chapter || mod.reading} for Module ${mod.modNum}: ${mod.theme}`,
              keyTakeawaysText: `• Review ${chapter || mod.reading}`
            }] : []
          });
        }
      } else {
        // We have both a weekly calendar schedule and canonical module table
        const activeWeeks = weeks.filter(w => {
          const low = (w.theme || '').toLowerCase();
          return !low.includes('reading week') &&
            !low.includes('readi ng week') &&
            !low.includes('break') &&
            !low.includes('flex week') &&
            !low.includes('no class') &&
            !low.includes('no classes');
        });

        if (activeWeeks.length >= canonicalModules.size) {
          activeWeeks.forEach((w, idx) => {
            const mod = canonicalModules.get(idx + 1);
            if (mod) {
              const { chapter, pages } = this.extractChapterAndPages(mod.reading);
              const { author } = this.extractAuthorAndResource(mod.reading);

              // If week has no readings from Table 2, add canonical module reading
              if (!w.readings || w.readings.length === 0) {
                const fullReadingTitle = mod.theme ? `${mod.reading} · ${mod.theme}` : mod.reading;
                w.readings = [{
                  id: `reading-canonical-${mod.modNum}-${Math.random().toString(36).substring(2, 7)}`,
                  title: fullReadingTitle,
                  authorName: author || 'Diane R. Gehart',
                  chapterText: chapter,
                  pagesText: pages,
                  dueDate: w.startDate,
                  dateRangeStr: w.dateRangeStr,
                  mediaType: 'textbook',
                  relevantTopics: mod.theme,
                  moduleNumber: mod.modNum,
                  moduleMention: `Module ${mod.modNum}`,
                  isCompleted: false,
                  summaryText: `Study ${chapter || mod.reading} for Module ${mod.modNum}: ${mod.theme}`,
                  keyTakeawaysText: `• Review ${chapter || mod.reading}`
                }];
              } else {
                // Table 2 has weekly readings: Enrich them with canonical module metadata
                w.readings.forEach(r => {
                  r.moduleNumber = mod.modNum;
                  r.moduleMention = `Module ${mod.modNum}`;
                  if (mod.theme) {
                    r.relevantTopics = mod.theme;
                  }
                  if (!r.authorName && author) {
                    r.authorName = author;
                  }
                });
              }

              // Preserve week session theme if specific, or enrich with module theme if generic
              if (!w.theme || /^(?:week|wk|module|mod)\s*\d+$/i.test(w.theme.trim()) || w.theme === `Week ${w.weekNumber} Schedule`) {
                w.theme = mod.theme;
              }
            }
          });
        }
      }
    }

    return { weeks, scheduleAssignments };
  }

  // MARK: - Semantic Classification
  public classifySemanticCategory(title: string, points?: string | null, url?: string | null): SemanticCategory {
    const t = title.toLowerCase();

    // 0. Noise / Policy Filter Check
    if (isGenericPlaceholderReadingTitle(title)) return 'noise';

    const noiseKeywords = [
      'territorial', 'coast salish', 'late submission', 'late assignments', 'deduction',
      'traffic-light', 'ai use policy', 'sensitive content', 'apa style', 'academic integrity',
      'disability services', 'non-discrimination', 'title ix', 'total 100%', 'total 100 points',
      'overview of required', 'grading scale', 'creswell', 'course resources', 'isbn:',
      'school of', 'social sciences', 'vision statement', 'vision, mission', 'mission statement', 'core values', 'faculty email',
      'access to the internet', 'microsoft-word', "library's", 'effective date', 'course dates',
      'primary faculty', 'counselling program', 'psychological practitioners', 'vanwdy', 'credits'
    ];
    for (const noise of noiseKeywords) {
      if (t.includes(noise)) return 'noise';
    }

    // Check reading vs deliverable keywords
    const hasReadingKeyword =
      t.includes('chapter') || t.includes('ch.') || t.includes('read ') ||
      t.includes('reading') || t.includes('textbook') || t.includes('pages') ||
      t.includes('pp.') || t.includes('article') || t.includes('book') ||
      t.includes('journal') || t.includes('isbn:');

    const hasDeliverableKeyword =
      t.includes('paper') || t.includes('report') || t.includes('exam') ||
      t.includes('quiz') || t.includes('midterm') || t.includes('final') ||
      t.includes('project') || t.includes('homework') || t.includes('problem set') ||
      t.includes('lab') || t.includes('presentation') || t.includes('deliverable') ||
      t.includes('brief') || t.includes('essay') || t.includes('peer review') ||
      t.includes('case study') || t.includes('assignment');

    // 1. Reading Keywords (prioritized when lacking deliverable keyword)
    if (hasReadingKeyword && !hasDeliverableKeyword) {
      return 'reading';
    }

    // 2. Deliverable Priority Check (e.g. graded video presentation)
    if (hasDeliverableKeyword && (points != null || t.includes('due') || t.includes('%') || t.includes('pts') || t.includes('points'))) {
      return 'assignment';
    }

    // 3. Media / Watching
    if (t.includes('watch') || t.includes('ted') || t.includes('youtube') || t.includes('podcast') || t.includes('vimeo') || url != null) {
      return 'media';
    }

    // 3. In-Class
    if (t.includes('guest speaker') || t.includes('in class') || t.includes('activity')) {
      return 'inClass';
    }

    // 4. Deliverable or Points Anchor
    if (
      hasDeliverableKeyword ||
      points != null || t.includes('pts') || t.includes('points') || t.includes('%')
    ) {
      return 'assignment';
    }

    // 5. Fallback Reading Keywords
    if (hasReadingKeyword) {
      return 'reading';
    }

    return 'noise';
  }

  // MARK: - Title Summarization
  public buildStrict3To5WordTitle(text: string, removePoints: boolean = true, removeDates: boolean = true): string {
    const t = this.buildStrict5To6WordTitle(text, removePoints, removeDates);
    const words = t.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 4) {
      return words.slice(0, 4).join(' ');
    }
    return t;
  }

  public buildStrict5To6WordTitle(text: string, removePoints: boolean = true, removeDates: boolean = true): string {
    let clean = text.replace(/<[^>]+>/g, ' ');

    // Strip category prefixes
    const prefixRegex = /^\s*(?:course\s+(?:requirements|evaluation|assessments?|grading)(?:\s*(?:and|&)\s*(?:requirements|evaluation|assessments?|grading))?|grading\s+policy|readings?|read|watch|listen|assignments?(?:\s*\d{1,2})?|deliverables?(?:\s*\d{1,2})?|tasks?(?:\s*\d{1,2})?|projects?(?:\s*\d{1,2})?|sections?(?:\s*\d{1,2})?|papers?(?:\s*\d{1,2})?|exams?(?:\s*\d{1,2})?|required|overview of|module\s*\d+|unit\s*\d+|week\s*\d+|\d{1,2}[\.:\)\-–—])\s*[:\-–—.]*\s*/i;
    clean = clean.replace(prefixRegex, '');

    if (removePoints) {
      clean = clean.replace(/\s*\(?\b\d{1,3}%\)?\s*/gi, ' ');
      clean = clean.replace(/\s*\(?\b\d{1,4}\s*(?:pts|points|pt)\b\)?\s*/gi, ' ');
      clean = clean.replace(/\s*\(?\b(?:points(?:\s+possible)?|pts|worth)\s*[:\-–—]?\s*\d{1,4}\b\)?\s*/gi, ' ');
    }

    if (removeDates) {
      clean = clean.replace(/\s*[\-\–]?\s*due\s+.*$/i, '');
      clean = clean.replace(/\s*[\-\–]?\s*submitted\s+by\s+.*$/i, '');
      const leadingDateRegex = /^\s*(?:(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)\s+\d{1,2}(?:\s*[\/\-&]\s*\d{1,2})?(?:\s*,\s*\d{4})?|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|(?:mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*,\s*)?)\s*[:\-–]?\s*/i;
      clean = clean.replace(leadingDateRegex, '');
    }

    clean = clean.replace(/^[|•\-*▪●:·~_§ \t\n–—]+|[|•\-*▪●:·~_§ \t\n–—]+$/g, '');
    clean = clean.replace(/\s+/g, ' ');

    const words = clean.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 6) {
      clean = words.slice(0, 6).join(' ');
    }

    return clean.length === 0 ? 'Item Title' : clean;
  }

  public cleanAndSummarizeTitle(rawTitle: string, isReading: boolean, courseCode?: string, courseName?: string): string {
    if (isReading) {
      return this.distillSmartReadingTitle(rawTitle);
    }

    let title = this.repairChapterArtifacts(rawTitle).trim();
    if (title.length === 0) return 'Assignment';

    if (courseCode) {
      const codePat = new RegExp(`^${courseCode}\\s*[:\\-–\\.]*\\s*`, 'i');
      title = title.replace(codePat, '').trim();
    }
    if (courseName) {
      const namePat = new RegExp(`^${courseName}\\s*[:\\-–\\.]*\\s*`, 'i');
      title = title.replace(namePat, '').trim();
    }

    title = title.replace(/^[A-Z]{2,6}\s*\d{2,4}[A-Z]?\s*[:\-–\.]*\s*/i, '').trim();
    title = title.replace(/^(?:Assignment|Deliverable|Project|Section|Paper|Task|Exam|Homework)\s*\d{1,2}\s*[:\-–—.]*\s*/i, '').trim();
    title = title.replace(/^\d{1,2}[\.:\)\-–—]\s*/, '').trim();

    const sentencePreambles = [
      'Students will complete an', 'Students will complete a', 'Students will complete',
      'Students will write a', 'Students will write an', 'Students will write',
      'Students will submit a', 'Students will submit an', 'Students will submit',
      'Students are required to write', 'Students are required to complete', 'Students are required to submit',
      'Students are required to', 'Complete an', 'Complete a', 'Submit an', 'Submit a', 'Write a', 'Write an'
    ];
    for (const preamble of sentencePreambles) {
      if (title.toLowerCase().startsWith(preamble.toLowerCase())) {
        title = title.substring(preamble.length).trim();
      }
    }

    const prefixesToStrip = [
      'Required Readings:', 'Required Reading:', 'Assigned Reading:', 'Assigned Readings:',
      'Readings:', 'Reading:', 'Read:', 'Required:', 'Chapter:', 'Chapters:',
      'Assignment:', 'Assignments:', 'Deliverable:', 'Deliverables:', 'Task:',
      'Project:', 'Paper:', 'Due:', 'Graded:', 'Homework:'
    ];
    for (const p of prefixesToStrip) {
      if (title.toLowerCase().startsWith(p.toLowerCase())) {
        title = title.substring(p.length).trim();
      }
    }

    return title.length === 0 ? 'Assignment' : title;
  }

  public distillSmartReadingTitle(rawTitle: string): string {
    let title = rawTitle.trim();
    if (title.length === 0) return 'Reading';

    title = this.repairChapterArtifacts(title);
    title = title.replace(/<[^>]+>/g, '');
    title = title.replace(/^\s*(?:modules|topics|related readings|course session\/date|topics,\s*modules,\s*and\s*assignments|readings)+\s*[:\-–]*\s*/i, '');
    title = title.replace(/^(?!(?:RFC|ISO|NIST|IEEE)\b)[A-Z]{2,5}\s*\d{3,4}[A-Z]?\s*[:\-–\.]+\s*/i, '');

    const yearMatch = title.match(/\(\s*\d{4}\s*\)\.?\s*/);
    if (yearMatch && yearMatch.index !== undefined) {
      const afterYear = title.substring(yearMatch.index + yearMatch[0].length).trim();
      const firstPart = afterYear.split(/[.(]/)[0]?.trim();
      if (firstPart && firstPart.length >= 3) {
        title = firstPart;
      }
    }

    const locationSuffixes = [
      /\s+(?:in|on|via|from|at|through)\s+(?:the\s+)?(?:[A-Za-z0-9\s_-]+)?(?:course\s*shell|general\s*course\s*shell|brightspace|canvas|blackboard|moodle|portal|class\s*shell|course\s*site|d2l)\b.*$/i,
      /\s+(?:in|on|via|from|at)\s+(?:van\s+general\s+course\s+shell)\b.*$/i
    ];
    for (const loc of locationSuffixes) {
      title = title.replace(loc, '');
    }

    const prepSuffixes = [
      /\s+(?:in\s+preparation\s+for|prior\s+to\s+class|before\s+class|for\s+class\s+discussion|for\s+discussion|in\s+preparation|in\s+advance)\b.*$/i
    ];
    for (const prep of prepSuffixes) {
      title = title.replace(prep, '');
    }

    const imperativePrefixes = [
      /^\s*(?:please\s+)?(?:review|read\s+and\s+review|read|study|complete\s+the\s+reading\s+of|complete\s+the\s+reading\s+on|complete\s+reading\s+of|complete\s+reading|complete|prepare\s+for|examine|access\s+and\s+read|consult)\s+(?:sample\s+|the\s+|all\s+|assigned\s+|required\s+)?/i,
      /^\s*(?:required|assigned|weekly)\s+readings?\s*[:\-–]*\s*/i
    ];
    for (const imp of imperativePrefixes) {
      title = title.replace(imp, '');
    }

    // Strip leading number-range colon artifacts like "1: 3 · " or "4: 10 - "
    title = title.replace(/^\d+[\s:.\-–—]+\d+\s*[:·•\-–—]\s*/, '').trim();

    // Strip textbook/book title prefix before chapter keywords or colons, even if book title contains colons/dashes:
    // e.g. "Growing into Resilience: Sexual and Gender Minority Youth in Canada: Chapter 1 — Sexual and Gender Minority Youth in Canada"
    title = title.replace(/^.+?(?:[:—–-]\s*)+(?=(?:chapters?|chps?\.?|chs?\.?|ch\b\.?|sections?|sec\.?)\s*\d+)/i, '').trim();

    title = title.replace(/^[|•\-*▪●:·~_§ \t\n–—]+|[|•\-*▪●:·~_§ \t\n–—]+$/g, '');
    title = title.replace(/\s+/g, ' ');

    const finalTitle = title.length === 0 ? 'Reading' : title;
    return deduplicateReadingTitle(finalTitle);
  }

  public repairChapterArtifacts(text: string): string {
    let str = text;
    str = str.replace(/\bGroth\s*:\s*Marnat\b/gi, 'Groth-Marnat');
    str = str.replace(/\bc[\s\xa0]+hapters\b/gi, 'chapters');
    str = str.replace(/\bc[\s\xa0]+hapter\b/gi, 'chapter');
    str = str.replace(/\bch[\s\xa0]+apters\b/gi, 'chapters');
    str = str.replace(/\bch[\s\xa0]+apter\b/gi, 'chapter');
    str = str.replace(/\bchap[\s\xa0]+ters\b/gi, 'chapters');
    str = str.replace(/\bchap[\s\xa0]+ter\b/gi, 'chapter');
    str = str.replace(/\bchapter[\s\xa0]+s\b/gi, 'chapters');
    str = str.replace(/\bc[\s\xa0]+h\.?\s*(?=\d)/gi, 'Ch. ');
    return str;
  }

  public extractChapterAndPages(text: string): { chapter?: string; pages?: string } {
    const healed = this.repairChapterArtifacts(text);
    let chapter: string | undefined = undefined;
    let pages: string | undefined = undefined;

    const chMatch = healed.match(LocalSyllabusParser.chapterRegex);
    if (chMatch) chapter = cleanChapterFromRaw(chMatch[0].trim()) || chMatch[0].trim();

    const pgMatch = healed.match(LocalSyllabusParser.pagesRegex);
    if (pgMatch) pages = pgMatch[0].trim();

    return { chapter, pages };
  }

  public extractAuthorAndResource(text: string): { author?: string; resource?: string } {
    let trimmed = this.repairChapterArtifacts(text).trim();
    // Strip instructional action prefixes
    trimmed = trimmed.replace(/^(?:required\s*:\s*|watch\s*:\s*|read\s*:\s*|listen\s*:\s*)+/i, '').trim();

    // Check for author in video/podcast titles: e.g. "with Justin Lehmiller:" or "Emily Nagoski - TED" or "Brené Brown & Dr. Sara Cunningham:"
    const withAuthorMatch = trimmed.match(/\bwith\s+([A-Z][a-zA-Z\s&,\.\-–]+?)(?::|\s+https?:\/\/|$)/i);
    if (withAuthorMatch) {
      const auth = withAuthorMatch[1].trim();
      if (auth.length > 2 && auth.length < 40) {
        return { author: auth, resource: trimmed };
      }
    }

    const tedAuthorMatch = trimmed.match(/([A-Z][a-zA-Z\s&,\.\-–]+?)\s*[-–—]\s*(?:TED|TEDx|Podcast)\b/i);
    if (tedAuthorMatch) {
      const auth = tedAuthorMatch[1].trim();
      if (auth.length > 2 && auth.length < 40) {
        return { author: auth, resource: trimmed };
      }
    }

    const canonicalBookAuthors: Record<string, string> = {
      'sexuality counseling': 'Kelly',
      'human sexuality': 'Rathus et al.',
      'growing into resilience': 'Taylor & Peter',
      'research design': 'Creswell & Creswell',
      'statistics for the behavioral': 'Gravetter & Wallnau',
      'theory and practice of group counseling': 'Corey & Corey',
      'theory and practice of group psychotherapy': 'Yalom & Leszcz',
      'groups: process and practice': 'Corey, Corey, & Corey',
      'groups process and practice': 'Corey, Corey, & Corey',
      'family therapy': 'Nichols & Davis',
      'counseling the culturally diverse': 'Sue & Sue',
      'culturally diverse': 'Sue & Sue',
      'grief counseling': 'Worden',
      'psychology of loss and grief': 'Worden'
    };

    const trimmedLow = trimmed.toLowerCase();
    for (const [key, canonicalAuth] of Object.entries(canonicalBookAuthors)) {
      if (trimmedLow.includes(key)) {
        return { author: canonicalAuth, resource: trimmed };
      }
    }

    const topicNoise = [
      'work', 'stages', 'initial stages', 'transition', 'working', 'presentations',
      'settings', 'groups in diverse settings', 'introduction to group work pt. 2',
      'introduction to group work', 'intro to group work'
    ];
    for (const tp of topicNoise) {
      if (trimmed.toLowerCase().startsWith(tp)) {
        const stripped = trimmed.substring(tp.length).replace(/^[:-–— \t]+/, '');
        if (stripped.length > 0) {
          trimmed = stripped;
          break;
        }
      }
    }

    const nonAuthorWords = [
      'research design', 'principles', 'introduction', 'handbook', 'guide',
      'foundations', 'psychology', 'theory', 'family systems', 'clinical',
      'counseling', 'case study', 'course', 'textbook', 'overview', 'methods',
      'chapter', 'read', 'required', 'watch', 'listen', 'video', 'podcast',
      'due', 'in class', 'bonus', 'note', 'growing into resilience',
      'sexuality counseling', 'human sexuality'
    ];

    // Explicit check for multiple authors: e.g. "Corey & Corey", "Sue & Sue", "Taylor & Peter", "Nichols & Davis", "Sue and Sue"
    const multiAuthorMatch = trimmed.match(/^([A-Z][a-zA-Z\.\-–]+(?:\s*,\s*[A-Z][a-zA-Z\.\-–]+)*(?:\s*(?:&|and)\s*[A-Z][a-zA-Z\.\-–]+)+)(?:\s*[:\-–·•]|\s*\(?\s*(?:chapters?|chps?\.?|chap\.?|ch\b\.?|chs\b\.?|\d{1,2}\b))/i);
    if (multiAuthorMatch) {
      let multiAuthor = multiAuthorMatch[1].trim();
      multiAuthor = multiAuthor.replace(/\band\b/gi, '&').replace(/\s+/g, ' ');
      if (multiAuthor.length > 3 && multiAuthor.length < 65 && !nonAuthorWords.some(w => multiAuthor.toLowerCase().includes(w))) {
        const afterAuth = trimmed.substring(multiAuthorMatch.index! + multiAuthorMatch[1].length).replace(/^[:\-–·•\s]+/, '').trim();
        return { author: multiAuthor, resource: afterAuth.length > 0 && /[a-zA-Z]/.test(afterAuth) ? afterAuth : undefined };
      }
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx >= 0) {
      const left = trimmed.substring(0, colonIdx).trim();
      const right = trimmed.substring(colonIdx + 1).trim();
      const leftLower = left.toLowerCase();
      const isNotAuthor =
        leftLower.startsWith('http') ||
        leftLower === 'http' ||
        leftLower === 'https' ||
        !/[a-zA-Z]{2,}/.test(left) ||
        /^\d+$/.test(left) ||
        /^\d+[\s:.\-–—]+\d+$/.test(left) ||
        nonAuthorWords.some(w => leftLower.includes(w));
      if (left.length > 0 && left.length < 60 && !isNotAuthor) {
        const validRight = (right.length > 0 && /[a-zA-Z]/.test(right)) ? right : undefined;
        return { author: left, resource: validRight };
      }
    }

    const authorChapterPattern = /^([A-Z][a-zA-Z\s&,\.\-–]+?(?:\s+et\s+al\.?)?)\s*[:\-–]?\s*\(?\s*\b(?:chapters?|chps?\.?|chap\.?|ch\b\.?|chs\b\.?)\s*(.*)$/i;
    const match = trimmed.match(authorChapterPattern);
    if (match) {
      let author = match[1].trim();
      const hasEtAl = /\bet\s+al\.?$/i.test(author);
      author = author.replace(/[()[\]{}<>,;:'"•·\-–—\s.]+$/g, '').replace(/^[()[\]{}<>,;:'"•·\-–—\s.]+/g, '').trim();
      for (const tp of topicNoise) {
        if (author.toLowerCase().startsWith(tp)) {
          author = author.substring(tp.length).replace(/^[:-–— \t]+/, '');
          break;
        }
      }
      author = author.replace(/[()[\]{}<>,;:'"•·\-–—\s.]+$/g, '').replace(/^[()[\]{}<>,;:'"•·\-–—\s.]+/g, '').trim();
      if (hasEtAl && !author.endsWith('.')) author += '.';
      const rawRes = match[2]?.trim();
      const resource = rawRes ? this.repairChapterArtifacts(rawRes).trim() : undefined;
      const authorLower = author.toLowerCase();
      const isNotAuthor = nonAuthorWords.some(w => authorLower.includes(w));
      if (author.length > 0 && author.length < 65 && !author.toLowerCase().includes('required') && !isNotAuthor) {
        return { author, resource: resource && resource.length > 0 && /[a-zA-Z]/.test(resource) ? resource : undefined };
      }
    }

    // Check Author (Year) e.g. "Li et al. (2020)" or "Rajbhandari et al. (2020)"
    const authorYearMatch = trimmed.match(/^([A-Z][a-zA-Z\s&,\.\-–]+?(?:\s+et\s+al\.?)?)\s*\(\s*(\d{4})\s*\)/i);
    if (authorYearMatch) {
      let author = authorYearMatch[1].trim();
      const hasEtAl = /\bet\s+al\.?$/i.test(author);
      author = author.replace(/[()[\]{}<>,;:'"•·\-–—\s.]+$/g, '').replace(/^[()[\]{}<>,;:'"•·\-–—\s.]+/g, '').trim();
      if (hasEtAl && !author.endsWith('.')) author += '.';
      const authorLower = author.toLowerCase();
      if (author.length > 0 && author.length < 65 && !nonAuthorWords.some(w => authorLower.includes(w))) {
        return { author, resource: trimmed };
      }
    }

    // Check Author (Topic / Paper) e.g. "Shoeybi et al. (Megatron)" or "Dettmers et al. (QLoRA)" or "Hu et al. (LoRA)"
    const authorTopicMatch = trimmed.match(/^([A-Z][a-zA-Z\s&,\.\-–]+?(?:\s+et\s+al\.?)?)\s*\(\s*([A-Za-z0-9\s\-–—/]+?)\s*\)/i);
    if (authorTopicMatch) {
      let author = authorTopicMatch[1].trim();
      const hasEtAl = /\bet\s+al\.?$/i.test(author);
      author = author.replace(/[()[\]{}<>,;:'"•·\-–—\s.]+$/g, '').replace(/^[()[\]{}<>,;:'"•·\-–—\s.]+/g, '').trim();
      if (hasEtAl && !author.endsWith('.')) author += '.';
      const authorLower = author.toLowerCase();
      if (author.length > 0 && author.length < 65 && !nonAuthorWords.some(w => authorLower.includes(w)) && !/^\d+$/.test(authorTopicMatch[2])) {
        return { author, resource: authorTopicMatch[2].trim() };
      }
    }

    const validRes = (trimmed.length > 0 && /[a-zA-Z]/.test(trimmed) && !/^\d+[\s:.\-–—]+\d+$/.test(trimmed)) ? trimmed : undefined;
    return { author: undefined, resource: validRes };
  }

  // MARK: - Video / Media URL Extractor
  public extractVideoUrl(text: string): string | undefined {
    const pattern = /(https?:\/\/[^\s]+|www\.[^\s]+|(youtube\.com|youtu\.be|ted\.com|vimeo\.com|podcasts\.apple\.com|thepenisproject\.podbean\.com)[^\s]*)/i;
    const match = text.match(pattern);
    if (match) {
      let url = match[0];
      if (!url.toLowerCase().startsWith('http')) {
        url = 'https://' + url;
      }
      return url;
    }
    return undefined;
  }

  // MARK: - Date Extraction & Normalization
  public extractAllDates(text: string, fallbackYear?: number): ExtractedDateInfo[] {
    const results: ExtractedDateInfo[] = [];

    for (const regex of LocalSyllabusParser.dateExtractionRegexes) {
      const globalRegex = new RegExp(regex.source, 'gi');
      let m: RegExpExecArray | null;
      while ((m = globalRegex.exec(text)) !== null) {
        const endLoc = m.index + m[0].length;
        const trailingStr = text.substring(endLoc, endLoc + 15).toLowerCase();
        if (
          trailingStr.startsWith(' page') || trailingStr.startsWith('page') ||
          trailingStr.startsWith(' pg') || trailingStr.startsWith(' word') ||
          trailingStr.startsWith(' pt') || trailingStr.startsWith(' point')
        ) {
          continue;
        }
        // If matched month with 2 day numbers like "July 2/3" or "August 6-7" (m[1]=month, m[2]=d1, m[3]=d2):
        if (m[1] && m[2] && m[3]) {
          const d1Str = `${m[1]} ${m[2]}${m[4] ? ' ' + m[4] : ''}`;
          const d2Str = `${m[1]} ${m[3]}${m[4] ? ' ' + m[4] : ''}`;
          const p1 = LocalSyllabusParser.parseISO8601Date(d1Str, fallbackYear);
          const p2 = LocalSyllabusParser.parseISO8601Date(d2Str, fallbackYear);
          if (p1.isoString.length > 0 && !results.some(r => r.isoString === p1.isoString)) {
            results.push(p1);
          }
          if (p2.isoString.length > 0 && !results.some(r => r.isoString === p2.isoString)) {
            results.push(p2);
          }
          continue;
        }

        const parsed = LocalSyllabusParser.parseISO8601Date(m[0], fallbackYear);
        if (parsed.isoString.length > 0 && !results.some(r => r.isoString === parsed.isoString)) {
          results.push(parsed);
        }
      }
    }

    return results;
  }

  public static formatExplicitDateRange(start: Date, end: Date, dStartInfo?: ExtractedDateInfo, dEndInfo?: ExtractedDateInfo): string {
    if (
      (dStartInfo && dStartInfo.date.getTime() === 0) ||
      (dEndInfo && dEndInfo.date.getTime() === 0) ||
      start.getTime() === 0 ||
      end.getTime() === 0 ||
      start.getFullYear() < 2000 ||
      end.getFullYear() < 2000
    ) {
      if (dStartInfo && dEndInfo) {
        return `${dStartInfo.displayString} – ${dEndInfo.displayString}`;
      }
    }
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startM = monthNames[start.getMonth()];
    const endM = monthNames[end.getMonth()];
    const startD = start.getDate();
    const endD = end.getDate();
    const year = end.getFullYear();

    if (year < 2000) {
      return `${startM} ${startD} – ${endM} ${endD}`;
    }
    return `${startM} ${startD} – ${endM} ${endD}, ${year}`;
  }

  public static formatWeekDateRange(endDate: Date): string {
    const startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);
    return LocalSyllabusParser.formatExplicitDateRange(startDate, endDate);
  }

  public static extractDayName(text: string): string | undefined {
    const match = text.match(LocalSyllabusParser.dayNameRegex);
    if (match) {
      const d = match[0].toLowerCase();
      switch (d) {
        case 'mon': case 'monday': return 'Monday';
        case 'tue': case 'tues': case 'tuesday': return 'Tuesday';
        case 'wed': case 'wednesday': return 'Wednesday';
        case 'thu': case 'thur': case 'thurs': case 'thursday': return 'Thursday';
        case 'fri': case 'friday': return 'Friday';
        case 'sat': case 'saturday': return 'Saturday';
        case 'sun': case 'sunday': return 'Sunday';
        default: return d.charAt(0).toUpperCase() + d.slice(1);
      }
    }
    return undefined;
  }

  public static parseISO8601Date(dateStr: string, fallbackYear?: number): ExtractedDateInfo {
    let trimmed = dateStr.trim();
    if (trimmed.length === 0) {
      return { displayString: '', isoString: '', date: new Date(0) };
    }

    trimmed = trimmed
      .replace(/^\s*(?:due(?:\s+date)?|date|scheduled|by|on|week\s*\d+|module\s*\d+)\s*[:\-–—]?\s*/i, '')
      .replace(/^[()[\]{}<>,;:'"]+|[()[\]{}<>,;:'"]+$/g, '')
      .trim();

    if (trimmed.length === 0) {
      return { displayString: '', isoString: '', date: new Date(0) };
    }

    const rangeDelimiters = [' – ', ' — ', ' - ', ' to ', ' –', ' —', ' -', '–', '—'];
    for (const delim of rangeDelimiters) {
      if (trimmed.includes(delim)) {
        const parts = trimmed.split(delim).map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length >= 2) {
          const endParsed = this.parseSingleComponentDate(parts[1], fallbackYear);
          if (endParsed.isoString.length > 0) return endParsed;
          const startParsed = this.parseSingleComponentDate(parts[0], fallbackYear);
          if (startParsed.isoString.length > 0) return startParsed;
        }
      }
    }

    return this.parseSingleComponentDate(trimmed, fallbackYear);
  }

  private static parseSingleComponentDate(raw: string, fallbackYear?: number): ExtractedDateInfo {
    const cleanRaw = raw.replace(/^[()[\]{}<>,;:'"]+|[()[\]{}<>,;:'"]+$/g, '').trim();
    if (cleanRaw.length === 0) {
      return { displayString: '', isoString: '', date: new Date(0) };
    }

    // 1. Direct ISO match: YYYY-MM-DD
    const isoMatch = cleanRaw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return this.createDateInfo(y, m, d);
      }
    }

    // 2. Slash format: MM/DD/YYYY or MM/DD
    const slashMatch = cleanRaw.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
    if (slashMatch) {
      const m = parseInt(slashMatch[1], 10);
      const d = parseInt(slashMatch[2], 10);
      let y = slashMatch[3] ? parseInt(slashMatch[3], 10) : fallbackYear;
      if (y !== undefined && y < 100) y += 2000;
      if (y !== undefined && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return this.createDateInfo(y, m, d);
      }
    }

    // 3. Month name matching
    const monthsMap: Record<string, number> = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
      apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
      aug: 8, august: 8, sep: 9, september: 9, sept: 9, oct: 10, october: 10,
      nov: 11, november: 11, dec: 12, december: 12
    };

    let cleanStr = cleanRaw.toLowerCase().replace(/,/g, ' ');
    cleanStr = cleanStr.replace(/(\d{1,2})(st|nd|rd|th)\b/g, '$1');
    cleanStr = cleanStr.replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/g, '');
    cleanStr = cleanStr.replace(/[-/]/g, ' ');

    const tokens = cleanStr.split(/[\s,;:\t\n.]+/).filter(t => t.length > 0);

    let foundMonth: number | undefined = undefined;
    let foundDay: number | undefined = undefined;
    let foundYear: number | undefined = fallbackYear;

    for (const token of tokens) {
      if (monthsMap[token]) {
        foundMonth = monthsMap[token];
      } else {
        const num = parseInt(token, 10);
        if (!isNaN(num)) {
          if (num > 1000) {
            foundYear = num;
          } else if (num >= 1 && num <= 31) {
            if (foundMonth !== undefined && foundDay === undefined) {
              foundDay = num;
            } else if (foundMonth === undefined && foundDay === undefined) {
              foundDay = num;
            }
          }
        }
      }
    }

    if (foundMonth !== undefined && foundDay !== undefined) {
      return this.createDateInfo(foundYear, foundMonth, foundDay);
    }

    return { displayString: '', isoString: '', date: new Date(0) };
  }

  private static createDateInfo(year: number | undefined, month: number, day: number): ExtractedDateInfo {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const isoString = year ? `${year}-${pad(month)}-${pad(day)}` : `${monthNames[month - 1]} ${day}`;
    const displayString = year ? `${monthNames[month - 1]} ${day}, ${year}` : `${monthNames[month - 1]} ${day}`;
    const date = year ? new Date(year, month - 1, day, 23, 59, 59) : new Date(0);
    return { displayString, isoString, date };
  }

  // MARK: - Identity and Helper Functions
  private extractYear(text: string): number | undefined {
    const match = text.match(/\b(202[4-9]|203[0-5])\b/);
    return match ? parseInt(match[0], 10) : undefined;
  }

  private extractCourseIdentity(lines: string[]): { code: string; name: string } {
    const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/([A-Z]+)\s*(\d+)/, '$1 $2').replace(/\s+/g, ' ');
    const nonBoilerplate = lines
      .map(l => l.trim())
      .filter(l => l.length > 0 && !this.isBoilerplatePolicyLine(l.toLowerCase()));
    const cleanLines = nonBoilerplate.length > 0 ? nonBoilerplate : lines.map(l => l.trim()).filter(l => l.length > 0);

    let foundCode: string | undefined = undefined;
    let foundName: string | undefined = undefined;

    // Check for explicit "Course Code: ..." / "Course Name: ..." labels anywhere in the document
    for (let idx = 0; idx < cleanLines.length; idx++) {
      const line = cleanLines[idx];
      const lower = line.toLowerCase();
      if (lower.startsWith('course code:') || lower.startsWith('course code') || lower.startsWith('course:') || lower.startsWith('code:')) {
        const codeMatch = line.match(LocalSyllabusParser.standaloneCodeRegex);
        if (codeMatch) {
          foundCode = normalizeCode(codeMatch[1]);
          for (let look = 1; look <= 4; look++) {
            if (idx + look < cleanLines.length) {
              const nextL = cleanLines[idx + look];
              const nextLower = nextL.toLowerCase();
              if (nextLower.startsWith('course name:') || nextLower.startsWith('course title:') || nextLower.startsWith('title:')) {
                foundName = nextL.replace(/^[^:]+:\s*/i, '').trim();
                break;
              }
            }
          }
          if (foundCode && foundName) {
            return { code: foundCode, name: foundName };
          }
        }
      }
    }

    for (let idx = 0; idx < Math.min(cleanLines.length, 120); idx++) {
      const line = cleanLines[idx];

      // Stage 1: Line with Code + Title e.g. "CPC 514: Research Methods and Statistics"
      const matchWithTitle = line.match(LocalSyllabusParser.codeWithTitleRegex);
      if (matchWithTitle) {
        const rawCode = normalizeCode(matchWithTitle[1]);
        const rawName = matchWithTitle[2].trim();
        let cleanName = rawName.replace(/^\s*(syllabus|course|class|outline|fall|spring|summer|winter|202[0-9])\s*/i, '').trim();
        const stopMatch = cleanName.match(/\s+(vanwdy|school of|credits|\d+\s*credits|effective|course dates|faculty|primary faculty|email|building|room)\b/i);
        if (stopMatch && stopMatch.index !== undefined) {
          cleanName = cleanName.substring(0, stopMatch.index).trim();
        }
        if (rawCode.length > 0 && cleanName.length > 0 && cleanName.toLowerCase() !== 'syllabus') {
          if (idx + 1 < cleanLines.length) {
            const nextL = cleanLines[idx + 1].trim();
            if (
              nextL.length > 0 &&
              nextL.length < 40 &&
              /^[A-Z][a-zA-Z\s&,\.\-–]+$/.test(nextL) &&
              !/^(?:credits|grading|instructor|term|department|faculty|office|dr\.|email|course)\b/i.test(nextL) &&
              !nextL.includes(':') &&
              !/\d/.test(nextL)
            ) {
              cleanName = `${cleanName} ${nextL}`.trim();
            }
          }
          return { code: rawCode, name: cleanName };
        }
        foundCode = rawCode;
      }

      // Stage 2: Standalone Code
      if (!foundCode) {
        const matchStandalone = line.match(LocalSyllabusParser.standaloneCodeRegex);
        if (matchStandalone) {
          foundCode = normalizeCode(matchStandalone[1]);
          if (idx + 1 < cleanLines.length) {
            const nextLine = cleanLines[idx + 1];
            const cleanNext = nextLine.replace(/^\s*(syllabus|course|class|outline|fall|spring|summer|winter|202[0-9])\s*/i, '').trim();
            if (cleanNext.length >= 3 && !cleanNext.includes('School') && !cleanNext.includes('Credits')) {
              foundName = this.buildStrict3To5WordTitle(cleanNext, true, true);
            }
          }
        }
      }

      if (foundCode && foundName && foundName.length > 0) {
        return { code: foundCode, name: foundName };
      }
    }

    if (foundCode) {
      for (const line of cleanLines.slice(0, 30)) {
        if (line.toUpperCase().includes(foundCode)) continue;
        const lower = line.toLowerCase();
        if (lower.includes('syllabus') || lower.includes('credits') || lower.includes('school') || lower.includes('faculty') || lower.includes('email')) continue;
        const candidate = this.buildStrict3To5WordTitle(line, true, true);
        if (candidate.length >= 4) {
          return { code: foundCode, name: candidate };
        }
      }
      return { code: foundCode, name: 'Course Syllabus' };
    }

    return { code: 'CRS-101', name: 'Academic Course' };
  }

  private isBoilerplatePolicyLine(lowerLine: string): boolean {
    if (/(?:^|\s)page\s+\d+(?:\s|$)/i.test(lowerLine)) return true;
    for (const marker of LocalSyllabusParser.sectionBoilerplateMarkers) {
      if (lowerLine.includes(marker)) return true;
    }
    for (const pattern of LocalSyllabusParser.lineNoisePatterns) {
      if (lowerLine.includes(pattern)) return true;
    }
    return false;
  }

  private padWeeks(weeks: WeekDTO[], courseName: string, courseCode: string): WeekDTO[] {
    if (weeks.length === 0) {
      return [{
        id: 'week-1',
        weekNumber: 1,
        theme: 'Course Schedule',
        readings: []
      }];
    }
    const existingMap = new Map<number, WeekDTO>();
    for (const w of weeks) existingMap.set(w.weekNumber, w);
    const maxWeek = Math.max(...weeks.map(w => w.weekNumber), 1);
    const result: WeekDTO[] = [];

    for (let w = 1; w <= maxWeek; w++) {
      const existing = existingMap.get(w);
      if (existing) {
        result.push(existing);
      } else {
        result.push({
          id: `week-${w}`,
          weekNumber: w,
          theme: `Week ${w} Schedule`,
          readings: []
        });
      }
    }
    return result;
  }

  private fuzzyMatch(s1: string, s2: string): boolean {
    const l1 = s1.toLowerCase();
    const l2 = s2.toLowerCase();

    // Sequence number check: if both have explicit sequence numbers or roman numerals, they must match
    const seq1 = l1.match(/(?:assignment|deliverable|task|project|paper|problem\s+set|set|lab|quiz|exam|test|part|phase|milestone|module|week|peer\s*review|reflection|#|no\.?)\s*(\d+|[ivx]+)\b/i) || l1.match(/\b(\d+|[ivx]+)\b(?=[^\d]*$)/i);
    const seq2 = l2.match(/(?:assignment|deliverable|task|project|paper|problem\s+set|set|lab|quiz|exam|test|part|phase|milestone|module|week|peer\s*review|reflection|#|no\.?)\s*(\d+|[ivx]+)\b/i) || l2.match(/\b(\d+|[ivx]+)\b(?=[^\d]*$)/i);
    if (seq1 && seq2 && seq1[1] !== seq2[1]) {
      return false;
    }

    const isPeerReview1 = l1.includes('peer review') || l1.includes('peer-review');
    const isPeerReview2 = l2.includes('peer review') || l2.includes('peer-review');
    const isReflection1 = l1.includes('reflection') || l1.includes('self-reflection');
    const isReflection2 = l2.includes('reflection') || l2.includes('self-reflection');

    if ((isPeerReview1 && isReflection2) || (isReflection1 && isPeerReview2)) return false;
    if (isPeerReview1 && isPeerReview2) {
      const isReport1 = l1.includes('report');
      const isReport2 = l2.includes('report');
      const isBoard1 = l1.includes('board') || l1.includes('discussion');
      const isBoard2 = l2.includes('board') || l2.includes('discussion');
      if (isReport1 !== isReport2) return false;
      if (isBoard1 !== isBoard2) return false;
      return true;
    }
    if (isPeerReview1 !== isPeerReview2 && (isPeerReview1 || isPeerReview2)) return false;
    if (isReflection1 !== isReflection2 && (isReflection1 || isReflection2)) return false;

    const clean1 = l1.replace(/[^a-z0-9]/g, '');
    const clean2 = l2.replace(/[^a-z0-9]/g, '');
    if (clean1.length === 0 || clean2.length === 0) return false;
    if (clean1 === clean2) return true;
    if (clean1.length >= 8 && clean2.includes(clean1)) return true;
    if (clean2.length >= 8 && clean1.includes(clean2)) return true;

    const words1 = s1.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3);
    const words2 = s2.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3);
    if (words1.length >= 2 && words2.length >= 2) {
      const set1 = new Set(words1);
      const set2 = new Set(words2);
      let intersectCount = 0;
      for (const w of set1) {
        if (set2.has(w)) intersectCount++;
      }
      const unionCount = new Set([...words1, ...words2]).size;
      if (unionCount > 0 && intersectCount / unionCount >= 0.85) return true;
    }
    return false;
  }

  private harmonizeWeekDateRangesAndAssignments(
    weeks: WeekDTO[],
    assignments: AssignmentDTO[],
    rawText?: string | null,
    termYear?: number
  ): void {
    // 0. Synthesize term dates if no weeks have dates
    const hasAnyDate = weeks.some(w => !!w.startDate);
    if (!hasAnyDate && weeks.length > 0) {
      let year = termYear;
      if (!year && rawText) {
        const yMatch = rawText.match(/\b(202[4-9]|203\d)\b/);
        if (yMatch) year = parseInt(yMatch[1], 10);
      }
      if (!year) year = 2026;
      let season = 'fall';
      if (rawText) {
        const sMatch = rawText.match(/\b(fall|autumn|winter|spring|summer)\b/i);
        if (sMatch) season = sMatch[1].toLowerCase();
      }
      let startMonth = 8; // Sep (0-indexed)
      if (season === 'winter') startMonth = 0; // Jan
      else if (season === 'spring') startMonth = 3; // Apr
      else if (season === 'summer') startMonth = 6; // Jul

      const startDate = new Date(year, startMonth, 1);
      const firstThuOffset = (4 - startDate.getDay() + 7) % 7;
      startDate.setDate(startDate.getDate() + firstThuOffset + (season === 'fall' || season === 'winter' ? 7 : 0));

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const pad = (n: number) => n < 10 ? '0' + n : '' + n;

      for (const w of weeks) {
        const wDate = new Date(startDate.getTime() + (w.weekNumber - 1) * 7 * 86400000);
        w.startDate = `${wDate.getFullYear()}-${pad(wDate.getMonth() + 1)}-${pad(wDate.getDate())}`;
        w.dateRangeStr = `${monthNames[wDate.getMonth()]} ${wDate.getDate()}`;
      }
    }

    // 1. Ensure all readings in dated weeks inherit the week's date for suggested reading pills
    for (const w of weeks) {
      if (w.startDate || w.dateRangeStr) {
        for (const r of w.readings ?? []) {
          if (!r.dueDate && w.startDate) {
            r.dueDate = w.startDate;
          }
          if (!r.dateRangeStr && w.dateRangeStr) {
            r.dateRangeStr = w.dateRangeStr;
          }
        }
      }
    }

    // 2. Harmonize assignment dates with schedule markers
    const lastDatedWeek = [...weeks].reverse().find(w => !!w.startDate);

    for (const a of assignments) {
      if (!a.dueDate && a.weekNumber && a.weekNumber > 0) {
        const matchingWeek = weeks.find(w => w.weekNumber === a.weekNumber && !!w.startDate);
        if (matchingWeek && matchingWeek.startDate) {
          a.dueDate = matchingWeek.startDate;
        }
      }
      const lower = a.title.toLowerCase();
      if (!a.dueDate) {
        if (lower.includes('presentation') || lower.includes('facilitation')) {
          const presWeek = weeks.find(
            w =>
              (w.theme?.toLowerCase().includes('presentation') ||
                (w.readings ?? []).some(r => r.title.toLowerCase().includes('presentation'))) &&
              !!w.startDate
          );
          if (presWeek && presWeek.startDate) {
            a.dueDate = presWeek.startDate;
            if (!a.noteText) a.noteText = `Presentations in Week ${presWeek.weekNumber}`;
          }
        } else if (
          lower.includes('collaboration') ||
          lower.includes('participation') ||
          lower.includes('engagement') ||
          lower.includes('professionalism')
        ) {
          if (!a.noteText) a.noteText = 'Over the course of the semester';
        } else if (lower.includes('paper') || lower.includes('report') || lower.includes('reflection')) {
          if (lastDatedWeek && lastDatedWeek.startDate) {
            a.dueDate = lastDatedWeek.startDate;
          }
        }
      }
    }
  }
}
