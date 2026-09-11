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
  ItemDTO
} from '../types/models';
import { FacultyExtractor } from './FacultyExtractor';
import { cleanChapterFromRaw } from '../utils/readingDisplayHelper';

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
  private static readonly pointsRegex = /\b(\d{1,4})\s*(pts|points|pt|%|percent)/i;
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

  private static readonly citationRegex = /([A-Za-z]+(?:\s+[A-Za-z]+)?\s*\(?\s*(?:chapters?|chs?\.?|chps?\.?|chap\.?|ch\.?|ch\b)\s*\d{1,3}(?:\s*[-–&,and\+]+\s*\d{1,3})*\)?|(?:chapters?|chs?\.?|chps?\.?|chap\.?|ch\.?|ch\b)\s*\d{1,3}(?:\s*[-–&,and\+]+\s*\d{1,3})*|See\s+Brightspace[^\n]*|Reading\s*Week)/i;
  private static readonly chapterRegex = /\b(chapters?|chs?\.?|chps?\.?|chap\.?)\s*(\d+([-\s&,and\+]+\d+)*)\b/i;
  private static readonly pagesRegex = /\b(pages?|pp?\.?)\s*(\d+([-\s&,and\+]+\d+)*)\b/i;

  private static readonly dateExtractionRegexes: RegExp[] = [
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i,
    /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
    /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/,
    /\b(\d{1,2})[-/](\d{1,2})\b/
  ];

  private static readonly dayNameRegex = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i;
  private static readonly isoDateRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
  private static readonly slashDateRegex = /^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/;
  private static readonly standaloneCodeRegex = /\b([A-Z]{2,6}\s*\d{3,4}[A-Z]?)\b/;
  private static readonly codeWithTitleRegex = /([A-Z]{2,6}\s*\d{3,4}[A-Z]?)\s*[:\-–—]?\s*(.+)/;

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
    'copyright ©', 'all rights reserved', 'printed on', 'retrieved from', 'page ',
    'last updated', 'office hours:', 'zoom link:', 'phone:', 'prerequisites:',
    'corequisites:', 'rubric summary', 'late deductions', 'late assignments deductions',
    'apa style guide tutorial', 'sensitive content notice', 'traffic-light approach'
  ];

  // MARK: - Main Parsing Entry Point
  public parseText(rawText: string): CourseDTO {
    const termYear = this.extractYear(rawText) ?? 2026;

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
      const idx = assignments.findIndex(a => this.fuzzyMatch(a.title, sa.title));
      if (idx >= 0) {
        const existing = assignments[idx];
        const mergedDate = existing.dueDate ?? sa.dueDate;
        const mergedWeight = existing.weightPercentage ?? sa.weightPercentage;
        const mergedPts = (existing.pointsPossible != null && existing.pointsPossible !== '100 Points')
          ? existing.pointsPossible
          : sa.pointsPossible;
        assignments[idx] = {
          ...existing,
          title: existing.title.length >= sa.title.length ? existing.title : sa.title,
          dueDate: mergedDate,
          pointsPossible: mergedPts,
          weightPercentage: mergedWeight,
          noteText: existing.noteText ?? sa.noteText
        };
      } else {
        assignments.push(sa);
      }
    }

    const requiredTexts = this.extractRequiredTextsAndResources(reconstitutedLines);

    let paddedWeeks = this.padWeeks(weeks, courseName, courseCode);
    this.harmonizeWeekDateRangesAndAssignments(paddedWeeks, assignments);

    const totalScheduleReadings = paddedWeeks.reduce((acc, w) => acc + (w.readings?.length ?? 0), 0);
    if (totalScheduleReadings === 0 && requiredTexts.length > 0 && paddedWeeks.length > 0) {
      paddedWeeks[0].readings = requiredTexts;
    }

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
        rubric: a.rubric
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
    if (synthesizedItems.filter(i => i.category === 'Reading').length === 0 && requiredTexts.length > 0) {
      for (const r of requiredTexts) {
        synthesizedItems.push({
          title: r.title,
          authorName: r.authorName,
          resourceTitle: r.resourceTitle,
          category: 'Reading',
          subType: 'TEXTBOOK',
          description: r.summaryText,
          weekNumber: 1,
          summaryText: r.summaryText,
          keyTakeaways: r.keyTakeawaysText,
          estimatedTime: r.estimatedTimeText
        });
      }
    }

    const sharingCode = Math.floor(100000 + Math.random() * 900000).toString();
    const facultyInfo = FacultyExtractor.extractFaculty(rawText);

    return {
      id: `course-${Math.random().toString(36).substring(2, 10)}`,
      creatorId: 'local-user',
      courseName,
      courseCode,
      instructorName: facultyInfo.name,
      instructorEmail: facultyInfo.email,
      termWeeks: paddedWeeks.length,
      sharingCode,
      weeks: paddedWeeks,
      assignments,
      items: synthesizedItems
    };
  }

  // MARK: - PASS 0: Lexer & Line Reconstitution
  public lexerReconstituteLines(rawText: string): string[] {
    let cleanInput = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\bMODU\s*\n\s*LE\s*(\d+)/gi, 'MODULE $1')
      .replace(/\bMODU\s*\n\s*LE\b/gi, 'MODULE')
      .replace(/\bMODU\s+LE/gi, 'MODULE')
      .replace(/\bREADI\s*\n\s*NG\s*\n\s*WEEK\b/gi, 'READING WEEK')
      .replace(/\bREADI\s*\n\s*NG\b/gi, 'READING')
      .replace(/\bREADI\s+NG\s*(?:WEEK)?/gi, 'READING WEEK')
      .replace(/(\d{1,2}\/\d{1,2}\/2)\s+(\d)\b/g, '$1$2')
      .replace(/(\d{1,2}\/\d{1,2}\/2)\s*\n\s*(\d)\b/g, '$1$2')
      .replace(/\b(Corey|Yalom|Creswell|Gehart|Nichols|Davis)\s*\n\s*(Ch(?:apters?|\.)?\s*[\d\s&,\-–\+]+)/gi, '$1 $2')
      .replace(/\b(Ch(?:apters?|\.)?\s*[\d\s&,\-–\+]+&)\s*\n\s*(\d+)(?![/\d])/gi, '$1 $2')
      .replace(/\b(Yalom\s+Ch\.\s*[\d\s&,\-–\+]+&)\s*\n\s*(\d+)(?![/\d])/gi, '$1 $2')
      .replace(/\b(Corey\s+Ch\.\s*[\d\s&,\-–\+]+&)\s*\n\s*(\d+)(?![/\d])/gi, '$1 $2');

    const rawLines = cleanInput
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const reconstituted: string[] = [];
    let buffer = '';

    for (const rawLine of rawLines) {
      const line = rawLine;
      const lower = line.toLowerCase();

      // Skip noise timestamps and URLs
      if (
        lower.includes('simple syllabus') ||
        lower.includes('simplesyllabus') ||
        lower.includes('error_codes') ||
        lower.includes('codes=') ||
        lower.startsWith('http') ||
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
        lower.includes('course') || lower.includes('policy') ||
        lower.includes('grading') || (line.includes(':') && line.length < 60) ||
        line.includes('%') || line.includes('points') || lower.includes('due') ||
        lower.includes('assignment') || lower.includes('report') || lower.includes('presentation') ||
        line.startsWith('•') || line.startsWith('*') || line.startsWith('-');

      if (buffer.length === 0) {
        buffer = line;
      } else {
        const lowerBuf = buffer.toLowerCase().trim();
        const isDueTrailing = lowerBuf.endsWith('due') || lowerBuf.endsWith('- due') || lowerBuf.endsWith('– due') || lowerBuf.endsWith('due:') || lowerBuf.endsWith('due sunday,') || lowerBuf.endsWith('due friday,') || lowerBuf.endsWith('–') || lowerBuf.endsWith('-');
        const isOverviewTableSplit = /^\s*([A-Za-z\s&,\.\-–:]+?)\s+(\d{1,3}%)\s*$/.test(line) && !lowerBuf.includes('%') && !lowerBuf.includes('overview') && buffer.length < 50;

        if (isDueTrailing || isOverviewTableSplit) {
          buffer += ' ' + line;
        } else if (isHeader) {
          reconstituted.push(buffer);
          buffer = line;
        } else {
          const lastChar = buffer[buffer.length - 1];
          if (lastChar === '.' || lastChar === ':' || lastChar === '!' || lastChar === '?' || lastChar === '%') {
            reconstituted.push(buffer);
            buffer = line;
          } else {
            buffer += ' ' + line;
          }
        }
      }
    }
    if (buffer.length > 0) {
      reconstituted.push(buffer);
    }

    return reconstituted;
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
        inTextSection = false;
        break;
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
    termYear: number,
    courseCode: string
  ): AssignmentDTO[] {
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

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lower = line.trim().toLowerCase();
      const isAssignKeyword = lower.includes('assignment') || lower.includes('paper') || lower.includes('report') ||
        lower.includes('presentation') || lower.includes('facilitation') || lower.includes('project') ||
        lower.includes('attendance') || lower.includes('participation') || lower.includes('engagement') ||
        lower.includes('reflection') || lower.includes('peer review') || lower.includes('rubric') ||
        lower.includes('grading criteria') || lower.includes('overview of required') || lower.includes('course assignment details');

      if (isAssignKeyword || lower.includes('course assignment details')) {
        inPolicySection = false;
      }
      if (policySectionHeaders.some(h => lower.includes(h)) && !isAssignKeyword) {
        inPolicySection = true;
      }
      if (inPolicySection) continue;
      if (this.isBoilerplatePolicyLine(lower)) continue;

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
        if (primaryIsoDate && (lastMatchedIndex !== null || results.length > 0)) {
          const targetIdx = lastMatchedIndex ?? (results.length - 1);
          if (!results[targetIdx].dueDate) {
            results[targetIdx] = {
              ...results[targetIdx],
              dueDate: primaryIsoDate
            };
          }
        }
        continue;
      }

      const numMatch = line.match(LocalSyllabusParser.assignmentNumRegex);
      const isAssignHeaderLine = !!percentMatch || !!numMatch || lower.startsWith('overview of required assignments');

      if (isAssignHeaderLine || (pointsMatch && isAssignKeyword)) {
        let weightStr: string | undefined = undefined;
        let pointsStr = '100 Points';

        const ptsMatch = line.match(LocalSyllabusParser.ptsMatchesRegex);
        if (percentMatch) weightStr = percentMatch[0];
        if (ptsMatch) pointsStr = ptsMatch[0];

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

        const videoUrl = this.extractVideoUrl(line);
        const cleanTitle = this.buildStrict3To5WordTitle(line, true, true);
        const lowerClean = cleanTitle.toLowerCase();

        if (
          lowerClean.includes('overview required') ||
          lowerClean.includes('total 100') ||
          lowerClean.includes('page ') ||
          lowerClean === 'item title' ||
          lowerClean === 'total' ||
          lowerClean.startsWith('total ')
        ) {
          continue;
        }

        const rubricCriteriaWords = [
          'coherence', 'organization', 'evidence', 'critical analysis', 'ethics',
          'competence', 'quality of presentation', 'oral presentation', 'self-reflection',
          'self- awareness', 'self- regulation', 'communication', 'compassion',
          'course concepts', 'personal philosophy', 'grading criteria', 'grade points',
          'conversations', 'participation (oral)'
        ];
        const trimmedClean = lowerClean.replace(/^[•\-*▪●: \t\n()]+|[•\-*▪●: \t\n()]+$/g, '');
        if (rubricCriteriaWords.some(w => trimmedClean === w || trimmedClean.startsWith(w))) {
          if (lastMatchedIndex !== null && lastMatchedIndex < results.length) {
            const rawPts = parseFloat(pointsStr.replace(/[^\d.]/g, '')) || undefined;
            const rawPct = weightStr ? parseFloat(weightStr.replace(/[^\d.]/g, '')) : undefined;
            const criterion: RubricCriterionDTO = {
              criterionName: cleanTitle,
              points: rawPts,
              percentage: rawPct
            };
            const existing = results[lastMatchedIndex];
            results[lastMatchedIndex] = {
              ...existing,
              rubric: [...(existing.rubric ?? []), criterion]
            };
          }
          continue;
        }

        const tag = this.classifySemanticCategory(line, weightStr ?? pointsStr, videoUrl);

        if ((tag === 'assignment' || tag === 'inClass') && cleanTitle.length >= 3) {
          const instructions = videoUrl ? `Link: ${videoUrl}` : 'Parsed from syllabus.';

          let matchedIdx: number | null = null;
          const explicitNum = line.match(LocalSyllabusParser.explicitAssignNumRegex);
          if (explicitNum && explicitNum[1]) {
            const num = parseInt(explicitNum[1], 10);
            if (num >= 1 && num <= results.length) {
              matchedIdx = num - 1;
            }
          }

          if (matchedIdx === null) {
            const foundIdx = results.findIndex(a => this.fuzzyMatch(a.title, cleanTitle));
            if (foundIdx >= 0) matchedIdx = foundIdx;
          }

          if (matchedIdx !== null) {
            lastMatchedIndex = matchedIdx;
            const existing = results[matchedIdx];
            const mergedDate = finalDate ?? existing.dueDate;
            const mergedWeight = existing.weightPercentage ?? weightStr;
            const mergedPts = (existing.pointsPossible != null && existing.pointsPossible !== '100 Points')
              ? existing.pointsPossible
              : pointsStr;
            results[matchedIdx] = {
              ...existing,
              title: existing.title.length >= cleanTitle.length ? existing.title : cleanTitle,
              dueDate: mergedDate,
              pointsPossible: mergedPts,
              weightPercentage: mergedWeight,
              noteText: existing.noteText ?? videoUrl
            };
          } else {
            const dto: AssignmentDTO = {
              id: `assign-${Math.random().toString(36).substring(2, 10)}`,
              title: cleanTitle,
              dueDate: finalDate,
              fullInstructions: instructions,
              pointsPossible: pointsStr,
              weightPercentage: weightStr,
              noteText: videoUrl
            };
            results.push(dto);
            lastMatchedIndex = results.length - 1;
          }
        }
      }
    }

    return results;
  }

  // MARK: - PASS 3: Weekly Schedule & Readings Extractor
  public extractWeeklyScheduleAndReadings(
    lines: string[],
    rawText: string | null = null,
    termYear: number,
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

    const policySectionHeaders = [
      'course policies', 'late assignments', 'university policies', 'non-discrimination',
      'religious accommodations', 'academic integrity', 'ai use policy', 'support services',
      'disability services', 'sensitive content notice', 'master of counselling\'s professional code',
      'professional code (2.0)', 'hallmarks of maturity'
    ];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lower = line.trim().toLowerCase();
      const cleanLower = lower.replace(/^[•\-*▪● \t]+|[•\-*▪● \t]+$/g, '');
      if (lower.length === 0) continue;

      const isWeekOrScheduleHeader = lower.includes('date content requirements') ||
        lower.includes('weekly schedule') ||
        lower.includes('course schedule') ||
        lower.includes('week modules topics readings') ||
        lower.includes('topics, modules') ||
        lower.startsWith('week ') ||
        lower.startsWith('module ') ||
        lower.startsWith('unit ') ||
        lower.startsWith('week 1') ||
        /^\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/.test(line) ||
        lower.includes('corey') || lower.includes('yalom') || lower.includes('creswell') || lower.includes('gehart') || lower.includes('brightspace') ||
        (lower.startsWith('1 ') && (lower.includes('jul') || lower.includes('aug') || lower.includes('sep') || lower.includes('jan') || lower.includes('feb') || lower.includes('mar')));

      if (isWeekOrScheduleHeader) {
        inPolicySection = false;
      }
      if (policySectionHeaders.some(h => lower.includes(h)) && !isWeekOrScheduleHeader) {
        inPolicySection = true;
      }
      if (inPolicySection) continue;
      if (this.isBoilerplatePolicyLine(lower)) continue;

      const instructionPrefixes = ['this paper', 'the video', 'the deadline', 'each week', 'in small groups', 'beginning in', 'prepare an', 'write an', 'following our', 'by the end', 'in response', 'guided by', 'students will', 'students are'];
      if (instructionPrefixes.some(p => lower.startsWith(p))) continue;

      let foundWeekNum: number | null = null;
      for (const regex of LocalSyllabusParser.weekHeaderRegexes) {
        const match = line.match(regex);
        if (match) {
          for (let g = match.length - 1; g >= 1; g--) {
            const val = parseInt(match[g], 10);
            if (!isNaN(val)) {
              foundWeekNum = val;
              break;
            }
          }
          if (foundWeekNum !== null) break;
        }
      }

      if (foundWeekNum === null && (lower.includes('reading week') || lower.includes('readi ng week'))) {
        foundWeekNum = (weeks[weeks.length - 1]?.weekNumber ?? 7) + 1;
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
        inPolicySection = false;
        if (currentReadings.length > 0 || (currentWeekNum !== foundWeekNum && !weeks.some(w => w.weekNumber === currentWeekNum))) {
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

        const rawTheme = line
          .replace(/^\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*/i, '')
          .replace(/^\s*(?:week|module|modu\s*le|unit|session)\s*\d+[:\-–\s]*/i, '')
          .trim();
        const cleanTheme = rawTheme
          .replace(/\b(?:Corey|Yalom|Creswell|Gehart|Nichols|Davis|APA|See Brightspace|Assigned Readings)\b.*$/i, '')
          .trim();

        if (modulePrefix) {
          currentWeekTheme = cleanTheme.length === 0 ? modulePrefix : `${modulePrefix}: ${cleanTheme}`;
        } else {
          currentWeekTheme = cleanTheme.length === 0 ? `Week ${foundWeekNum}` : cleanTheme;
        }

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
          currentWeekDateRange = LocalSyllabusParser.formatExplicitDateRange(dStart.date, dEnd.date);
          currentWeekDateIso = dEnd.isoString;
        } else if (headerDates.length > 0) {
          currentWeekDateIso = headerDates[0].isoString;
        }

        const lineHasCitation = LocalSyllabusParser.citationRegex.test(line) ||
          lower.includes('corey') || lower.includes('yalom') || lower.includes('creswell') ||
          lower.includes('gehart') || lower.includes('nichols') || lower.includes('brightspace') ||
          lower.includes('reading week');
        if (!lineHasCitation) {
          continue;
        }
      }

      const videoUrl = this.extractVideoUrl(line);
      const hasValidUrl = !!videoUrl && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'));

      // Skip pure header phrases
      const pureHeaderPhrases = [
        'modules', 'topics', 'related readings', 'modules topics related readings',
        'course session/date', 'topics, modules, and assignments', 'readings',
        'topics, modules, and assignments readings',
        'course session/date topics, modules, and assignments readings'
      ];
      if (pureHeaderPhrases.includes(lower.trim())) continue;

      // Skip assignment lines
      const isAssignmentLine = lower.includes('assignment') || lower.includes('% of') ||
        lower.includes('due date') || lower.includes('due:') ||
        (lower.includes('%') && !lower.includes('gehart') && !lower.includes('chapter'));
      if (isAssignmentLine) continue;

      let workLine = line.trim();
      workLine = workLine.replace(/^\s*(?:modules?|topics?|related readings?|course session\/?date)\s*/i, '');
      workLine = workLine.replace(/^\s*(?:module|unit|week)\s*\d+[:\-–\s]*/i, '');
      workLine = workLine.replace(/^[•\-*▪●: \t]+|[•\-*▪●: \t]+$/g, '');

      const isBookCitation = LocalSyllabusParser.citationRegex.test(workLine) ||
        lower.includes('corey') || lower.includes('yalom') || lower.includes('creswell') ||
        lower.includes('gehart') || lower.includes('nichols') || lower.includes('davis') ||
        lower.includes('isbn:') || lower.includes('(6th ed)') || lower.includes('7th canadian') ||
        cleanLower.startsWith('read:') || cleanLower.startsWith('watch:') ||
        cleanLower.startsWith('listen:') || cleanLower.startsWith('podcast:') ||
        hasValidUrl;

      if (!isBookCitation) continue;

      // Check subsegments
      const subSegments = workLine.includes(';')
        ? workLine.split(';').map(s => s.trim()).filter(s => s.length >= 3)
        : [workLine];

      for (const segment of subSegments) {
        let exactTitle = segment;
        let finalTopic: string | undefined = !currentWeekTheme.toLowerCase().startsWith('week ') ? currentWeekTheme : undefined;

        if (hasValidUrl && subSegments.length === 1) {
          const vUrl = videoUrl ?? '';
          if (vUrl.includes('youtube.com') || vUrl.includes('youtu.be')) {
            exactTitle = 'YouTube Video';
          } else if (vUrl.includes('ted.com')) {
            exactTitle = 'TED Talk';
          } else if (vUrl.includes('podbean')) {
            exactTitle = 'Podcast Episode';
          } else {
            exactTitle = 'Web Resource';
          }
        } else {
          const citMatch = segment.match(LocalSyllabusParser.citationRegex);
          if (citMatch && citMatch.index !== undefined) {
            exactTitle = citMatch[0].replace(/^[•\-*▪●(): \t]+|[•\-*▪●(): \t]+$/g, '').trim();
            const topicRaw = segment.substring(0, citMatch.index)
              .replace(/\b(modules?|topics?|related readings?)\b/gi, '')
              .replace(/^[•\-*▪●(): \t\n ]+|[•\-*▪●(): \t\n ]+$/g, '');
            if (topicRaw.length >= 4 && !topicRaw.toLowerCase().startsWith('week') && !topicRaw.toLowerCase().startsWith('module')) {
              finalTopic = topicRaw;
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
          'core materials', 'reading list', 'textbooks', 'required texts', 'course readings'
        ];
        if (
          rejectedTitles.includes(lowerTitle) ||
          exactTitle.length < 3 ||
          lowerTitle.includes('required reading & core materials') ||
          lowerTitle.includes('required readings & core materials') ||
          lowerTitle === 'reading' ||
          lowerTitle === 'readings'
        ) continue;

        const dates = this.extractAllDates(line, termYear);
        const isoDate = dates.length > 0 ? dates[0].isoString : currentWeekDateIso;
        const { chapter: ch, pages: pg } = this.extractChapterAndPages(segment);
        const mediaTypeStr = (hasValidUrl || lower.includes('watch') || lower.includes('ted') || lower.includes('podcast')) ? 'video' : 'textbook';

        const smartTitle = this.cleanAndSummarizeTitle(exactTitle, true);
        const finalTitle = smartTitle.length === 0 ? exactTitle : smartTitle;
        const { author: extractedAuthor, resource: extractedRes } = this.extractAuthorAndResource(finalTitle);

        const readingDTO: ReadingDTO = {
          id: `read-${Math.random().toString(36).substring(2, 10)}`,
          title: finalTitle,
          authorName: extractedAuthor,
          resourceTitle: extractedRes ?? (finalTitle.split(/\s+/).length <= 5 ? finalTitle : undefined),
          mediaType: mediaTypeStr,
          isCompleted: false,
          summaryText: '',
          keyTakeawaysText: `• Review ${finalTitle}`,
          estimatedTimeText: mediaTypeStr === 'video' ? '~20–30 min' : '~40–60 min',
          videoUrl: (hasValidUrl && subSegments.length === 1) ? videoUrl : undefined,
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

    if (currentReadings.length > 0 || weeks.length === 0) {
      weeks.push({
        id: `week-${currentWeekNum}`,
        weekNumber: currentWeekNum,
        startDate: undefined,
        theme: currentWeekTheme,
        dateRangeStr: currentWeekDateRange,
        readings: currentReadings
      });
    }

    return { weeks, scheduleAssignments };
  }

  // MARK: - Semantic Classification
  public classifySemanticCategory(title: string, points?: string | null, url?: string | null): SemanticCategory {
    const t = title.toLowerCase();

    // 0. Noise / Policy Filter Check
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

    // 1. Points Anchor or Percentage
    if (points != null || t.includes('pts') || t.includes('points') || t.includes('%')) {
      return 'assignment';
    }

    // 2. In-Class
    if (t.includes('guest speaker') || t.includes('in class') || t.includes('activity')) {
      return 'inClass';
    }

    // 3. Explicit Assignment Title
    if (
      t.includes('assignment 1') || t.includes('assignment 2') || t.includes('assignment 3') ||
      t.includes('assignment 4') || t.includes('assignment 5') || t.includes('midterm') ||
      t.includes('final exam') || t.includes('research proposal') || t.includes('ethics paper') ||
      t.includes('final presentation') || t.includes('quiz')
    ) {
      return 'assignment';
    }

    // 4. Media / Watching
    if (t.includes('watch') || t.includes('ted') || t.includes('youtube') || t.includes('podcast') || t.includes('vimeo') || url != null) {
      return 'media';
    }

    // 5. Reading Keywords
    if (
      t.includes('chapter') || t.includes('ch.') || t.includes('read ') ||
      t.includes('reading') || t.includes('textbook') || t.includes('pages') ||
      t.includes('pp.') || t.includes('article') || t.includes('book') ||
      t.includes('journal') || t.includes('isbn:')
    ) {
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
    const prefixRegex = /^\s*(?:readings?|read|watch|listen|assignments?|required|overview of|module\s*\d+|unit\s*\d+|week\s*\d+)\s*[:\-–]*\s*/i;
    clean = clean.replace(prefixRegex, '');

    if (removePoints) {
      clean = clean.replace(/\s*\(?\b\d{1,3}%\)?\s*/gi, ' ');
      clean = clean.replace(/\s*\(?\b\d{1,4}\s*(?:pts|points|pt)\b\)?\s*/gi, ' ');
    }

    if (removeDates) {
      clean = clean.replace(/\s*[\-\–]?\s*due\s+.*$/i, '');
      clean = clean.replace(/\s*[\-\–]?\s*submitted\s+by\s+.*$/i, '');
      const leadingDateRegex = /^\s*(?:(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)\s+\d{1,2}(?:\s*[\/\-&]\s*\d{1,2})?(?:\s*,\s*\d{4})?|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|(?:mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*,\s*)?)\s*[:\-–]?\s*/i;
      clean = clean.replace(leadingDateRegex, '');
    }

    clean = clean.replace(/^[•\-*▪●: \t\n]+|[•\-*▪●: \t\n]+$/g, '');
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

    title = title.replace(/^[A-Z]{2,5}\s*\d{3,4}[A-Z]?\s*[:\-–\.]*\s*/i, '').trim();

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
    title = title.replace(/^[A-Z]{2,5}\s*\d{3,4}[A-Z]?\s*[:\-–\.]*\s*/i, '');

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

    title = title.replace(/^[•\-*▪●: \t\n]+|[•\-*▪●: \t\n]+$/g, '');
    title = title.replace(/\s+/g, ' ');

    return title.length === 0 ? 'Reading' : title;
  }

  public repairChapterArtifacts(text: string): string {
    let str = text;
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

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx >= 0) {
      const left = trimmed.substring(0, colonIdx).trim();
      const right = trimmed.substring(colonIdx + 1).trim();
      const leftLower = left.toLowerCase();
      const nonAuthorWords = [
        'research design', 'principles', 'introduction', 'handbook', 'guide',
        'foundations', 'psychology', 'theory', 'family systems', 'clinical',
        'counseling', 'case study', 'course', 'textbook', 'overview', 'methods',
        'chapter', 'read'
      ];
      const isNotAuthor = nonAuthorWords.some(w => leftLower.includes(w));
      if (left.length > 0 && left.length < 40 && !isNotAuthor) {
        return { author: left, resource: right.length > 0 ? right : undefined };
      }
    }

    const authorChapterPattern = /^([A-Z][a-zA-Z\s&,\.\-–]+?)\s*[:\-–]?\s*\b(?:chapters?|chps?\.?|chap\.?|ch\b\.?|chs\b\.?)\s*(.*)$/i;
    const match = trimmed.match(authorChapterPattern);
    if (match) {
      let author = match[1].trim();
      for (const tp of topicNoise) {
        if (author.toLowerCase().startsWith(tp)) {
          author = author.substring(tp.length).replace(/^[:-–— \t]+/, '');
          break;
        }
      }
      const rawRes = match[2]?.trim();
      const resource = rawRes ? this.repairChapterArtifacts(rawRes).trim() : undefined;
      const nonAuthorWords = [
        'research design', 'principles', 'introduction', 'handbook', 'guide',
        'foundations', 'psychology', 'theory', 'family systems', 'clinical',
        'counseling', 'case study', 'course', 'textbook', 'overview', 'methods',
        'chapter', 'read'
      ];
      const authorLower = author.toLowerCase();
      const isNotAuthor = nonAuthorWords.some(w => authorLower.includes(w));
      if (author.length > 0 && author.length < 35 && !author.toLowerCase().includes('required') && !isNotAuthor) {
        return { author, resource: resource && resource.length > 0 ? resource : undefined };
      }
    }

    return { author: undefined, resource: trimmed.length > 0 ? trimmed : undefined };
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
  public extractAllDates(text: string, fallbackYear: number = 2026): ExtractedDateInfo[] {
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
        const parsed = LocalSyllabusParser.parseISO8601Date(m[0], fallbackYear);
        if (parsed.isoString.length > 0 && !results.some(r => r.isoString === parsed.isoString)) {
          results.push(parsed);
        }
      }
    }

    return results;
  }

  public static formatExplicitDateRange(start: Date, end: Date): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startM = monthNames[start.getMonth()];
    const endM = monthNames[end.getMonth()];
    const startD = start.getDate();
    const endD = end.getDate();
    const year = end.getFullYear();

    if (start.getMonth() === end.getMonth()) {
      return `${startM} ${startD} – ${endD}, ${year}`;
    } else {
      return `${startM} ${startD} – ${endM} ${endD}, ${year}`;
    }
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

  public static parseISO8601Date(dateStr: string, fallbackYear: number = 2026): ExtractedDateInfo {
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

  private static parseSingleComponentDate(raw: string, fallbackYear: number): ExtractedDateInfo {
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
      if (y < 100) y += 2000;
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
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
    let foundYear: number = fallbackYear;

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

  private static createDateInfo(year: number, month: number, day: number): ExtractedDateInfo {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const isoString = `${year}-${pad(month)}-${pad(day)}`;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const displayString = `${monthNames[month - 1]} ${day}, ${year}`;
    const date = new Date(year, month - 1, day, 23, 59, 59);
    return { displayString, isoString, date };
  }

  // MARK: - Identity and Helper Functions
  private extractYear(text: string): number | undefined {
    const match = text.match(/\b(202[4-9]|203[0-5])\b/);
    return match ? parseInt(match[0], 10) : undefined;
  }

  private extractCourseIdentity(lines: string[]): { code: string; name: string } {
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
          foundCode = codeMatch[1].trim().toUpperCase().replace(/\s+/g, ' ');
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
        const rawCode = matchWithTitle[1].trim().toUpperCase().replace(/\s+/g, ' ');
        const rawName = matchWithTitle[2].trim();
        let cleanName = rawName.replace(/^\s*(syllabus|course|class|outline|fall|spring|summer|winter|202[0-9])\s*/i, '').trim();
        const stopMatch = cleanName.match(/\s+(vanwdy|school of|credits|\d+\s*credits|effective|course dates|faculty|primary faculty|email|building|room)\b/i);
        if (stopMatch && stopMatch.index !== undefined) {
          cleanName = cleanName.substring(0, stopMatch.index).trim();
        }
        if (rawCode.length > 0 && cleanName.length > 0 && cleanName.toLowerCase() !== 'syllabus') {
          return { code: rawCode, name: cleanName };
        }
        foundCode = rawCode;
      }

      // Stage 2: Standalone Code
      if (!foundCode) {
        const matchStandalone = line.match(LocalSyllabusParser.standaloneCodeRegex);
        if (matchStandalone) {
          foundCode = matchStandalone[1].trim().toUpperCase().replace(/\s+/g, ' ');
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

    const isPeerReview1 = l1.includes('peer review') || l1.includes('peer-review');
    const isPeerReview2 = l2.includes('peer review') || l2.includes('peer-review');
    const isReflection1 = l1.includes('reflection') || l1.includes('self-reflection');
    const isReflection2 = l2.includes('reflection') || l2.includes('self-reflection');

    if ((isPeerReview1 && isReflection2) || (isReflection1 && isPeerReview2)) return false;
    if (isPeerReview1 !== isPeerReview2 && (isPeerReview1 || isPeerReview2)) return false;
    if (isReflection1 !== isReflection2 && (isReflection1 || isReflection2)) return false;

    const clean1 = l1.replace(/[^a-z]/g, '');
    const clean2 = l2.replace(/[^a-z]/g, '');
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

  private harmonizeWeekDateRangesAndAssignments(weeks: WeekDTO[], assignments: AssignmentDTO[]): void {
    // Preserves exact document data
  }
}
