import { Course, Reading, Assignment, MediaType } from '../types/models';
import { deriveWeekNumber, weekNumberForDate } from './timeFormatters';

/**
 * ReadingDisplayHelper
 * Universal, deduplicated chapter formatting and display engine.
 * Ensures that chapters are stated EXACTLY ONCE (never repeating "Ch. 12 · Chapters 12"
 * or duplicating chapters in subtitles down below).
 */

export function repairChapterArtifacts(text: string): string {
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

export function sanitizeDanglingPunctuation(str: string): string {
  if (!str) return '';
  let s = str.trim();
  // Strip complete parenthesized edition like (4th ed.), (2nd edition) - NEVER strip publication years in academic citations!
  s = s.replace(/\s*\(\s*(?:[a-z0-9\s.,]*\b(?:ed|edition)\.?)\s*\)/gi, ' ').trim();
  // Strip empty parentheses e.g. "( )" or "()"
  s = s.replace(/\s*\(\s*\)/g, ' ').trim();
  // Strip parenthesized number fragments left behind e.g. "( 3)", "(3)", "( 15 )", "(1-3)"
  s = s.replace(/\s*\(\s*[\d\s:.\-–—andto]+\s*\)\s*[-–—]?/gi, ' ').trim();
  // If there is an unclosed '(' or unstarted ')'
  const openCount = (s.match(/\(/g) || []).length;
  const closeCount = (s.match(/\)/g) || []).length;
  if (openCount !== closeCount) {
    s = s.replace(/[()]/g, ' ');
  }
  // Strip trailing unclosed parens with digits e.g. "( 5" or "(5"
  s = s.replace(/\s*\(\s*\d+\s*$/g, '').trim();
  // Strip empty parentheses again in case closing was removed
  s = s.replace(/\s*\(\s*\)/g, ' ').trim();
  // Collapse doubled punctuation (multiple commas, multiple dots, repeated dashes/colons)
  s = s.replace(/[,;]{2,}/g, ',');
  s = s.replace(/\.{2,}/g, '.');
  s = s.replace(/\s*[:·•\-–—]\s*[:·•\-–—]\s*/g, ' · ');
  s = s.replace(/\s*,\s*·\s*/g, ' · ');
  s = s.replace(/\s*·\s*,\s*/g, ' · ');
  s = s.replace(/\s*-\s*·\s*/g, ' · ');
  s = s.replace(/\s*·\s*-\s*/g, ' · ');
  s = s.replace(/\s*,\s*-\s*/g, ' - ');
  // Strip leading and trailing punctuation brackets/quotes/dashes/bullets (preserve balanced parens)
  const isBalanced = (s.match(/\(/g) || []).length === (s.match(/\)/g) || []).length;
  if (isBalanced) {
    s = s.replace(/^[:;•·\-–—~`!@#$%^&*[\]{}<>,?'"\s.]+|[:;•·\-–—~`!@#$%^&*[\]{}<>,?'"\s.]+$/g, '').trim();
  } else {
    s = s.replace(/^[:;•·\-–—~`!@#$%^&*()[\]{}<>,?'"\s.]+|[:;•·\-–—~`!@#$%^&*()[\]{}<>,?'"\s.]+$/g, '').trim();
  }
  s = s.replace(/\s*\(\s*\)/g, ' ').trim();
  s = s.replace(/\s+/g, ' ');
  return s;
}

export function cleanMultilineTitle(text: string): string {
  if (!text || !text.includes('\n')) return text;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return text.trim();

  const first = lines[0];
  // If first line ends with a connecting word/preposition/hyphen, it's wrapped text
  const endsWithConnector = /[:\-–—,&(]|(?:\b(?:and|or|of|in|to|the|a|for|with|by|on|at|part|vol|v)\b)$/i.test(first);
  if (endsWithConnector) {
    return lines.join(' ');
  }

  // If first line has a chapter keyword or starts with a chapter number or has 3+ words, it is a complete title on its own
  const hasChapter = /\b(?:chapters?|chaps?\.?|chs?\.?|ch\.?)\b/i.test(first) || /^\d{1,2}[:.\s–-]+[A-Za-z]/.test(first);
  if (hasChapter || first.split(/\s+/).length >= 3) {
    return first;
  }

  return lines.join(' ');
}

/**
 * Standardizes any chapter string into clean canonical representation:
 * - Single: "Chapter 1", "Chapter 12"
 * - Multiple: "Chapters 1 & 2", "Chapters 12 & 13", "Chapters 1–4"
 * Never returns mixed "Ch." or duplicates.
 */
export function cleanChapterFromRaw(rawCh?: string | null): string | null {
  if (!rawCh || !rawCh.trim()) return null;
  let cleaned = repairChapterArtifacts(rawCh.trim());
  cleaned = cleaned.replace(/[()[\]]/g, '').trim();

  // Check if string contains explicit chapter keywords: chapter, chapters, ch., ch, chap., etc.
  const hasChapterKeyword = /\b(?:chapters?|chaps?\.?|chs?\.?|ch\.?)\b/i.test(cleaned);
  // Check if string is purely digits/connectors e.g. "12", "12 & 13", "1-4", "1, 2", "1: 3", "4: 10"
  const isPureNumbers = /^\d+[\s&,:\-–andto\d]*$/i.test(cleaned);
  // Check if string starts with a leading chapter number e.g. "7 Experiential Family Therapy" or "7: Overview"
  const leadingNumMatch = cleaned.match(/^(\d{1,2})(?:[:.\s–-]+|\s+)(?!jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec\b)[A-Za-z]/i);

  // If string is a standalone 4-digit year (1800-2099) without explicit chapter keywords, it is a publication year, NOT a chapter!
  if (!hasChapterKeyword && /^(?:18|19|20)\d{2}$/.test(cleaned.trim())) {
    return null;
  }

  if (!hasChapterKeyword && !isPureNumbers && !leadingNumMatch) {
    // Not a chapter! Prevents dates, years, or topic titles from being misidentified as chapters
    return null;
  }

  // 1. If explicit chapter keyword exists, extract digits directly following it
  if (hasChapterKeyword) {
    const keywordDigitsMatch = cleaned.match(/\b(?:chapters?|chaps?\.?|chs?\.?|ch\.?)\s*[:\-–.]*\s*(\d+[\s&,:\-–andto\d]*)/i);
    if (keywordDigitsMatch) {
      let numPart = keywordDigitsMatch[1].trim();
      // Normalize colons between digits to en-dash: e.g. "1: 3" -> "1–3", "4: 10" -> "4–10"
      numPart = numPart.replace(/(\d+)\s*:\s*(\d+)/g, '$1–$2');
      // Normalize connectors: replace "and" with "&", "-" with en-dash "–"
      numPart = numPart
        .replace(/\band\b/gi, '&')
        .replace(/\s*-\s*/g, '–')
        .replace(/\s*–\s*/g, '–')
        .replace(/\s+/g, ' ');
      // Clean trailing/leading connectors
      numPart = numPart.replace(/^[,&–:\s]+|[,&–:\s]+$/g, '').trim();

      const isPlural = numPart.includes('&') || numPart.includes('–') || numPart.includes(',') || /\bto\b/i.test(numPart);
      return isPlural ? `Chapters ${numPart}` : `Chapter ${numPart}`;
    }

    // If chapter keyword exists without digits (e.g. "Chapter One", "Chapter IV")
    const keywordWordMatch = cleaned.match(/\b(?:chapters?)\s+([A-Za-z]+)\b/i);
    if (keywordWordMatch && !/^(?:and|to|the|of|in|for|from|with)\b/i.test(keywordWordMatch[1])) {
      const wordPart = keywordWordMatch[1].trim();
      return `Chapter ${wordPart.charAt(0).toUpperCase() + wordPart.slice(1)}`;
    }
  }

  if (leadingNumMatch && !hasChapterKeyword) {
    return `Chapter ${leadingNumMatch[1]}`;
  }

  // Extract all digit groups with connectors e.g. "12 & 13", "1, 2", "1-4", "1: 3", "4: 10", "12"
  const digitsMatch = cleaned.match(/\b\d+[\s&,:\-–andto\d]*\b/i);
  if (digitsMatch) {
    if (!hasChapterKeyword && /^(?:18|19|20)\d{2}$/.test(digitsMatch[0].trim())) {
      return null;
    }
    let numPart = digitsMatch[0].trim();
    // Normalize colons between digits to en-dash: e.g. "1: 3" -> "1–3", "4: 10" -> "4–10"
    numPart = numPart.replace(/(\d+)\s*:\s*(\d+)/g, '$1–$2');
    // Normalize connectors: replace "and" with "&", "-" with en-dash "–"
    numPart = numPart
      .replace(/\band\b/gi, '&')
      .replace(/\s*-\s*/g, '–')
      .replace(/\s*–\s*/g, '–')
      .replace(/\s+/g, ' ');
    // Clean trailing/leading connectors
    numPart = numPart.replace(/^[,&–:\s]+|[,&–:\s]+$/g, '').trim();

    const isPlural = numPart.includes('&') || numPart.includes('–') || numPart.includes(',') || /\bto\b/i.test(numPart);
    return isPlural ? `Chapters ${numPart}` : `Chapter ${numPart}`;
  }

  return null;
}

/**
 * Strips all chapter mentions, numbers, and connecting symbols from text.
 */
export function stripChapterMentions(text: string): string {
  if (!text) return '';
  const healed = repairChapterArtifacts(text);
  // Matches parenthesized chapter patterns: "(Chapters 1-3)", "(Ch. 1-3)", "(Chapters 1: 3)", "(Chapter 2)"
  let stripped = healed.replace(/\s*\(\s*(?:chapters?|chaps?\.?|chs?\.?|ch\.?)\s*[\d\s,&:.\-–—andto]+\s*\)/gi, ' ');
  // Matches "Chapter 1 · Ch. 1", "Chapters 12 & 13", "Ch. 12", "Ch 1 & 2", "Chapters 1: 3", etc.
  const chapterPattern = /\s*[:\-–·•]?\s*\b(?:chapters?|chaps?\.?|chs?\.?|ch\.?)\s*(?:[\d\s,&:.\-–—]*(?:\b(?:and|to)\b\s*)?)*[:\-–·•.]*\s*/gi;
  stripped = stripped.replace(chapterPattern, ' ');
  // Clean empty parentheses left behind when parenthesized chapter is stripped e.g. (Chapters 4 & 5) -> ( )
  stripped = stripped.replace(/\s*\(\s*\)/g, ' ');
  // Clean parenthesized remaining numbers e.g. ( 3) or ( 15)
  stripped = stripped.replace(/\s*\(\s*[\d\s:.\-–—andto]+\s*\)\s*[-–—]?/gi, ' ');
  // Clean dangling separators and whitespace
  stripped = stripped.replace(/^[:;•·\-–—\s.]+|[:;•·\-–—\s.]+$/g, '');
  stripped = stripped.replace(/\s+/g, ' ').trim();
  return stripped;
}

/**
 * Cleans out academic syllabus metadata noise (course codes, LMS terms, imperative verbs).
 */
export function distillSmartReadingTitle(rawTitle: string): string {
  let title = (rawTitle || '').trim();
  if (!title) return 'Reading';

  title = cleanMultilineTitle(title);
  title = repairChapterArtifacts(title);
  title = title.replace(/<[^>]+>/g, '');
  title = title.replace(/^[A-Z]{2,5}\s*\d{3,4}[A-Z]?\s*[:\-–.]*\s*/i, '');

  // Strip APA citation year "(2014)"
  const yearMatch = title.match(/\(\s*\d{4}\s*\)\.?\s*/);
  if (yearMatch && yearMatch.index !== undefined) {
    const afterYear = title.slice(yearMatch.index + yearMatch[0].length).trim();
    const firstPart = afterYear.split(/[.(]/)[0].trim();
    if (firstPart.length >= 3) {
      title = firstPart;
    }
  }

  // Strip LMS / portal locations
  title = title.replace(/\s+(?:in|on|via|from|at|through)\s+(?:the\s+)?(?:[A-Za-z0-9\s_-]+)?(?:course\s*shell|general\s*course\s*shell|brightspace|canvas|blackboard|moodle|portal|class\s*shell|course\s*site|d2l)\b.*$/i, '');
  title = title.replace(/\s+(?:in|on|via|from|at)\s+(?:van\s+general\s+course\s+shell)\b.*$/i, '');

  // Strip preparatory suffixes
  title = title.replace(/\s+(?:in\s+preparation\s+for|prior\s+to\s+class|before\s+class|for\s+class\s+discussion|for\s+discussion|in\s+preparation|in\s+advance)\b.*$/i, '');

  // Strip imperative verbs
  title = title.replace(/^\s*(?:please\s+)?(?:review|read\s+and\s+review|read|study|complete\s+the\s+reading\s+of|complete\s+the\s+reading\s+on|complete\s+reading\s+of|complete\s+reading|complete|prepare\s+for|examine|access\s+and\s+read|consult)\s+(?:sample\s+|the\s+|all\s+|assigned\s+|required\s+)?/i, '');
  const prefixMatch = title.match(/^\s*(?:required|assigned|weekly)?\s*readings?\s*[:\-–]+\s*(.+)$/i);
  if (prefixMatch && prefixMatch[1].trim()) {
    title = prefixMatch[1].trim();
  }

  return title || 'Reading';
}

const GENERIC_PLACEHOLDER_SET = new Set([
  'article', 'articles', 'required article', 'required articles',
  'assigned article', 'assigned articles', 'selected article', 'selected articles',
  'journal article', 'journal articles', 'online article', 'online articles',
  'reading', 'readings', 'required reading', 'required readings',
  'assigned reading', 'assigned readings', 'related reading', 'related readings',
  'weekly reading', 'weekly readings', 'course reading', 'course readings',
  'reading list', 'reading materials', 'course materials', 'core materials', 'materials',
  'textbook', 'textbooks', 'required texts', 'required text', 'course textbook',
  'handout', 'handouts', 'lecture notes', 'lecture slides', 'slides', 'notes',
  'tbd', 'none', 'n/a', 'no reading', 'no readings', 'no class', 'no classes',
  'reading week', 'flex week'
]);

export function isGenericPlaceholderReadingTitle(rawTitle: string | null | undefined): boolean {
  if (!rawTitle) return true;
  const normalized = rawTitle
    .toLowerCase()
    .replace(/^[•\-*▪●(): \t\n ]+|[•\-*▪●(): \t\n ]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length === 0) return true;
  if (GENERIC_PLACEHOLDER_SET.has(normalized)) return true;
  const strippedPunct = normalized.replace(/[:\-–—*?]+$/g, '').trim();
  if (GENERIC_PLACEHOLDER_SET.has(strippedPunct)) return true;
  return false;
}

export function isGenericPlaceholderTheme(theme?: string | null): boolean {
  if (!theme) return true;
  let t = theme.trim().toLowerCase();
  // Strip leading week or module prefixes e.g. "Week 1 Schedule" -> "Schedule", "Wk 2: Topics" -> "Topics"
  t = t.replace(/^(?:week|wk|module|mod)\s*0*\d+[:\-–—\s]*/i, '').trim();
  t = t.replace(/[:\-–—\s.]+/g, ' ').trim();
  if (t.length === 0) return true;
  return /^(?:schedule|weekly schedule|course schedule|class schedule|tentative schedule|schedule of classes|reading schedule|reading list|topics?|contents?|readings?|course readings?|assignments?|deliverables?|syllabus|calendar|dates?|overview|general|required|optional|none|tbd|n\/a)$/i.test(t);
}

/**
 * Thoroughly sanitizes and cleans a week or module theme/topic string.
 * Strips out:
 * - Table column bleed / leading chapter numbers & page numbers (e.g. "4-6;", "1-3;")
 * - Book and reading citations (e.g. "DSM 5-TR", "Maddux & Winstead", "Corey", "Yalom", "Section 1, Section 3")
 * - Dates and date ranges (e.g. "- 4/10/26", "Sep 17", "09/10/2026")
 * - Table/module column artifacts (e.g. "Modul", "e 2 of", "Module 2 of")
 * - Stuttering / duplicated words (e.g. "Cultural Context Culture and")
 * - Generic placeholders (e.g. "Schedule", "Week 4", "Readings", "TBD")
 * Returns a clean, readable academic topic, or an empty string '' if no genuine topic exists.
 */
export function cleanAcademicWeekTheme(rawTheme?: string | null): string {
  if (!rawTheme || typeof rawTheme !== 'string') return '';
  let t = rawTheme.replace(/\s+/g, ' ').trim();
  if (t.length === 0) return '';

  // 1. Strip leading week/module/session/unit indicator
  t = t.replace(/^(?:week|wk|module|mod|unit|session|lecture)\b\s*\d*[:\-–—\s]*/i, '').trim();

  // 2. Strip leading numbers, chapter ranges, or page markers with punctuation (e.g. "4-6;", "1-3, 5:", "Ch. 4-6;")
  t = t.replace(/^[\d\s\-–—,&]+[;:.]\s*/, '').trim();
  t = t.replace(/^(?:chs?\.?|chapters?|pp?\.?|pages?|sec(?:tions?)?\.?)\s*[\d\s\-–—,&]+[;:.]?\s*/i, '').trim();

  // 3. Strip reading citations, book mentions, and standard literature references
  // DSM references & section citations e.g. "DSM 5-TR The History and Section 1, Section 3"
  t = t.replace(/\bDSM[-\s]*(?:5|IV|V|TR|\d)+(?:-TR)?\b[:\s]*(?:The\s+History\s+and\s+)?(?:Section\s*\d+[\s,–-]*(?:Section\s*\d+)?[\s,;–-]*)*/gi, ' ');
  // Specific book authors and citations
  t = t.replace(/\b(?:Maddux\s*&\s*Winstead|Wada\s*&\s*Fellner|Corey\s*&\s*Corey|Corey|Yalom|Creswell|Gehart|Nichols|Beck|Neimeyer|Hochstetler|Bishop)\b.*?(?:;|\b(?=[A-Z][a-z]+)|\s*-\s*|\s*$)/gi, ' ');
  // Association / manual citations
  t = t.replace(/\b(?:American\s+Psychiatric\s+Association|World\s+Health\s+Organization|APA|WHO|ICD(?:-\d+)?)\b/gi, ' ');
  // Chapter and page markers anywhere in string
  t = t.replace(/\b(?:chapters?|chps?\.?|chs?\.?|ch\b\.?|sections?|sec\.?)\s*\d+[\d\s,&–\-]*/gi, ' ');
  t = t.replace(/\b(?:pp?\.?|pages?)\s*\d+[\d\s–\-]*/gi, ' ');
  t = t.replace(/\bpg\.?\s*\d+/gi, ' ');
  // Requirement labels
  t = t.replace(/\b(?:required|optional|assigned|suggested)\s*(?:readings?|materials?|texts?)?[:\s]*/gi, ' ');
  t = t.replace(/\b(?:required|optional)[:\s]+/gi, ' ');

  // 4. Strip dates and date ranges (e.g. "- 4/10/26", "4/10/2026", "Sep 17")
  t = t.replace(/[-–—]?\s*\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b\s*[-–—]?/g, ' ');
  t = t.replace(/[-–—]?\s*\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*[-–—]\s*\d{1,2}(?:st|nd|rd|th)?)?(?:,?\s*\d{4})?\b\s*[-–—]?/gi, ' ');

  // 5. Strip table column wrap artifacts / broken module fragments
  t = t.replace(/\bModul(?:e)?\b\s*\d*/gi, ' ');
  t = t.replace(/\be\s*\d+\s+of\b/gi, ' ');
  t = t.replace(/\b(?:course|weekly|class|tentative)\s+schedule\b/gi, ' ');
  t = t.replace(/\b(?:timeline|calendar)\b/gi, ' ');
  t = t.replace(/\b(?:course\s+session\/?date|related\s+readings?)\b/gi, ' ');

  // 6. Clean up stutter / duplicated words (e.g. "Cultural Context Culture and" -> "Cultural Context and")
  t = t.replace(/\bCultural\s+Context\s+Culture\s+and\b/gi, 'Cultural Context and');
  t = t.replace(/\b([A-Za-z]{4,})(?:al|e)?\s+Context\s+\1(?:al|e)?\s+and\b/gi, '$1al Context and');
  t = t.replace(/\b([A-Za-z]{3,})\s+\1\b/gi, '$1');

  // 7. Strip trailing unclosed parenthesis or ellipsis (e.g. " (...", "...")
  t = t.replace(/\s*\([^\)]*$/, '');
  t = t.replace(/\s*\.{2,}$/, '');

  // 8. Collapse spaces & trim punctuation
  t = t.replace(/\s+/g, ' ');
  t = t.replace(/^[:;•·\-–—\s,.]+|[:;•·\-–—\s,.]+$/g, '').trim();

  // 9. Validate genuine academic topic
  if (t.length < 3) return '';
  if (isGenericPlaceholderTheme(t)) return '';
  if (/^[\d\s\-–—,;.:()]+$/.test(t)) return '';
  if (/^(?:week|module|unit|session)\s*\d*$/i.test(t)) return '';

  return t;
}

/**
 * Determines if a title represents a student assignment, project, paper, presentation,
 * exam, or deliverable rather than genuine reading material.
 * Readings must strictly contain actual reading material (textbooks, chapters, articles, PDFs, media).
 */
export function isDeliverableNotReading(
  rawTitle: string | null | undefined,
  context?: { moduleNumber?: number | null; chapterText?: string | null }
): boolean {
  if (!rawTitle) return false;
  // Module curriculum topics (Modules 1–10) are NEVER student deliverables!
  if (context?.moduleNumber && context.moduleNumber > 0) return false;
  if (context?.chapterText && /\d+/.test(context.chapterText)) return false;

  const t = rawTitle
    .toLowerCase()
    .replace(/^[•\-*▪●(): \t\n ]+|[•\-*▪●(): \t\n ]+$/g, '')
    .trim();
  if (t.length === 0) return false;

  // Pure course topic protections
  if (/^family\s+of\s+origin(?:\s*\/\s*genograms?)?$/i.test(t)) return false;
  if (/^case\s+conceptualizations?$/i.test(t)) return false;
  if (/^introduction\s+to\s+mapping\s+tools$/i.test(t)) return false;

  // Explicit reading citations with chapter or page markers
  const hasChapterOrPage =
    /\b(?:chapters?|chps?\.?|chs?\.?|chap\.?|ch\b\.?|sections?|sec\.?)\s*\d+/i.test(t) ||
    /\b(?:pp?\.?|pages?)\s*\d+/i.test(t);

  const hasAuthorBookCitation =
    /(?:gehart|corey|yalom|creswell|nichols|neimeyer|hochstetler|bishop)\b/i.test(t) &&
    !/\b(?:feedback|worth\s*\d{1,3}%|due\b|assignment|exam|quiz)\b/i.test(t);

  // If it has explicit chapter or textbook citation and no deliverable marker (like "due", "worth X%", "rubric"), it's reading
  if ((hasChapterOrPage || hasAuthorBookCitation) && !/\b(?:worth\s*\d{1,3}%|due\s*:|rubric|students\s+will\s+complete)\b/i.test(t)) {
    return false;
  }

  // Common student deliverables that should never be in reading lists
  const deliverableRegexes = [
    /\b(?:in[\s-]class\s+)?case\s+conceptualizations?\s+(?:assignment|paper|exam|activity|worth)/i,
    /\bfamily\s+map(?:ping)?\s+papers?\b/i,
    /\bgenograms?(?:\s*(?:and|\/)\s*family\s+mapping)?\s+papers?\b/i,
    /\bmapping\s+papers?\b/i,
    /\bin[\s-]class\s+(?:case|assignment|activity|presentation|exam|quiz|conceptualization)/i,
    /\bin[\s-]class\b/i,
    /\bgroup\s+presentations?\b/i,
    /\bpeer\s+reviews?\s+group\s+report\b/i,
    /\bpeer\s+reviews?\b/i,
    /\breflection\s+papers?\b/i,
    /\bresearch\s+papers?\b/i,
    /\bterm\s+papers?\b/i,
    /\bfinal\s+papers?\b/i,
    /\bfeedback\s+case\s+conceptualizations?\b/i,
    /\bworth\s*\d{1,3}%\b/i,
    /\bdue\s*:\s*[a-z0-9]/i,
    /\bexams?\b/i,
    /\bquiz(?:zes)?\b/i,
    /\bmidterms?\b/i,
    /\bfinal\s+exams?\b/i,
    /\brubrics?\b/i,
    /\bassignments?\s*\d*\b/i,
    /\bdeliverables?\b/i
  ];

  for (const regex of deliverableRegexes) {
    if (regex.test(t)) {
      return true;
    }
  }

  return false;
}

export function deduplicateRepeatedPhrases(text: string): string {
  if (!text) return '';
  let str = text.trim();
  // Never split hyphenated compound words like "Groth-Marnat" or "evidence-based" (hyphen without whitespace)
  const parts = str.split(/\s*[:·•]\s*|\s+[-–—]\s+|\s*[–—]\s*/);
  if (parts.length > 1) {
    const uniqueParts: string[] = [];
    for (const p of parts) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (!uniqueParts.some(u => u.toLowerCase() === lower || u.toLowerCase().includes(lower))) {
        uniqueParts.push(trimmed);
      }
    }
    str = uniqueParts.join(': ');
  }
  return str;
}

/**
 * Deduplicates repeated chapter titles, phrases, and segments across separators.
 * Guarantees that no chapter name, book subtitle, or topic is stated more than once.
 * Handles patterns like:
 * - "Chapter 1 · Sexual and Gender Minority Youth in Canada – Sexual and Gender Minority Youth in Canada"
 * - "Chapter 4 · Chapter 4"
 * - "Chapter 4 · Chapter 4: Gender Identity"
 * - "A – A" or "A: A"
 */
export function deduplicateReadingTitle(title: string): string {
  if (!title || typeof title !== 'string') return '';
  let str = title.trim();

  // 1. Remove duplicate adjacent phrases joined by dashes, colons, or bullets:
  // e.g. "Sexual and Gender Minority Youth in Canada – Sexual and Gender Minority Youth in Canada"
  str = str.replace(/\b([A-Za-z0-9\s'&,.-]{3,60})\b\s*(?:[:—–·•\-]\s*)+\1\b/gi, '$1');

  // 2. Deduplicate segments joined by ' · '
  if (str.includes('·')) {
    const segments = str.split(/\s*·\s*/).map(s => s.trim()).filter(Boolean);
    const uniqueSegs: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      let seg = segments[i];
      // Inside this segment, also deduplicate dashes/colons
      if (/[:—–-]/.test(seg)) {
        const parts = seg.split(/\s*(?:[—–-]|:)\s+/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const uParts: string[] = [];
          for (const p of parts) {
            const pNorm = p.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!pNorm) continue;
            if (!uParts.some(u => u.toLowerCase().replace(/[^a-z0-9]/g, '') === pNorm)) {
              uParts.push(p);
            }
          }
          seg = uParts.join(' – ');
        }
      }

      const segNorm = seg.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!segNorm) continue;

      // If segment is identical to or contained in an already included segment, skip it (e.g. "Chapter 4 · Chapter 4" or "Groth-Marnat (Ch. 4) · Marnat")
      if (uniqueSegs.some(u => {
        const uNorm = u.toLowerCase().replace(/[^a-z0-9]/g, '');
        return uNorm === segNorm || (segNorm.length >= 4 && uNorm.includes(segNorm));
      })) {
        continue;
      }

      // If previous segment is a chapter (e.g. "Chapter 1") and this segment starts with that chapter, strip it
      if (uniqueSegs.length > 0) {
        const prev = uniqueSegs[uniqueSegs.length - 1];
        const chM = prev.match(/^(?:Chapter|Ch\.?)\s*(\d+)/i);
        if (chM) {
          const num = chM[1];
          const rep = new RegExp(`^(?:chapters?\\s*${num}|ch\\.?\\s*${num})[:·•\\-–—\\s]*`, 'i');
          seg = seg.replace(rep, '').trim();
        }
      }

      if (seg) {
        uniqueSegs.push(seg);
      }
    }
    str = uniqueSegs.join(' · ');
  } else if (/[:—–-]/.test(str)) {
    // No ' · ' but contains dashes/colons: deduplicate parts
    const parts = str.split(/\s*(?:[—–-]|:)\s+/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const uParts: string[] = [];
      for (const p of parts) {
        const pNorm = p.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!pNorm) continue;
        if (!uParts.some(u => u.toLowerCase().replace(/[^a-z0-9]/g, '') === pNorm)) {
          uParts.push(p);
        }
      }
      if (uParts.length >= 2) {
        const isCh = /^(?:Chapter|Ch\.?)\s*\d+$/i.test(uParts[0]);
        str = uParts.join(isCh ? ' · ' : ' – ');
      } else if (uParts.length === 1) {
        str = uParts[0];
      }
    }
  }

  // Final cleanup of duplicate adjacent phrases that might have been revealed
  str = str.replace(/\b([A-Za-z0-9\s'&,.-]{3,60})\b\s*(?:[:—–·•\-]\s*)+\1\b/gi, '$1');
  str = str.replace(/^[:;•·\-–—\s,.]+|[:;•·\-–—\s,.]+$/g, '').trim();

  return str;
}

/**
 * Returns a display title where the chapter is stated EXACTLY ONCE.
 * Eliminates all artifacts like "Ch. 12 · Chapters 12" or "Chapter 1 · Ch. 1"
 * and suppresses repeating the textbook title if it matches resourceTitle or courseName.
 */
export function formatDisplayTitleWithChapter(
  titleOrReading: string | { title: string; chapterText?: string | null; authorName?: string | null; resourceTitle?: string | null },
  chapterText?: string | null,
  resourceTitle?: string | null,
  courseName?: string | null,
  authorNameParam?: string | null
): string {
  let rawTitle = '';
  let rawCh: string | null | undefined = chapterText;
  let authorName: string | null | undefined = authorNameParam || null;
  let resTitle: string | null | undefined = resourceTitle;

  if (typeof titleOrReading === 'object' && titleOrReading !== null) {
    rawTitle = titleOrReading.title || '';
    if (!rawCh) rawCh = titleOrReading.chapterText;
    if (!authorName) authorName = titleOrReading.authorName;
    if (!resTitle) resTitle = titleOrReading.resourceTitle;
  } else {
    rawTitle = titleOrReading || '';
  }

  rawTitle = rawTitle.replace(/\bGroth\s*:\s*Marnat\b/gi, 'Groth-Marnat');
  if (resTitle) resTitle = resTitle.replace(/\bGroth\s*:\s*Marnat\b/gi, 'Groth-Marnat');
  if (authorName) authorName = authorName.replace(/\bGroth\s*:\s*Marnat\b/gi, 'Groth-Marnat').replace(/;\s*/g, ', ').trim();

  // If authorName is not explicitly provided, detect author citation prefix or name
  if (!authorName) {
    if (rawTitle) {
      const authMatch = rawTitle.match(/^([A-Z][a-zA-Z\s.&–-]+?)\s*\(\s*(?:ch(?:apter)?s?\.?|pp?\.?|\d)/i);
      if (authMatch) {
        authorName = authMatch[1].trim();
      } else if (rawTitle.toLowerCase().includes('groth-marnat') || /\bMarnat\b/i.test(rawTitle)) {
        authorName = 'Groth-Marnat';
      }
    }
    if (!authorName && resTitle) {
      if (resTitle.toLowerCase().includes('groth-marnat') || /\bMarnat\b/i.test(resTitle)) {
        authorName = 'Groth-Marnat';
      } else {
        const resAuthMatch = resTitle.match(/^([A-Z][a-zA-Z\s.&–-]+?)(?:\s*\(|\s*·|$)/);
        if (resAuthMatch && resAuthMatch[1].trim().length >= 3 && !/^(?:chapter|reading|textbook|required)/i.test(resAuthMatch[1].trim())) {
          authorName = resAuthMatch[1].trim();
        }
      }
    }
  }

  rawTitle = cleanMultilineTitle(rawTitle);
  rawTitle = rawTitle.replace(/^(?:required|optional|recommended|supplemental)\s*[:\-–—]\s*/i, '').trim();
  // Strip leading number range artifact like "1: 3 · ", "4: 10 - ", "1-3 · " etc.
  rawTitle = rawTitle.replace(/^\d+[\s:.\-–—]+\d+\s*[:·•\-–—]\s*/, '').trim();
  // Strip textbook/book title prefix before chapter keywords or colons, even if the book title contains colons/dashes:
  // e.g. "Growing into Resilience: Sexual and Gender Minority Youth in Canada: Chapter 1 — Sexual and Gender Minority Youth in Canada"
  // e.g. "Sexuality Counseling: Theory, Research, and Practice: Chapter 11 — Assessment in Sexuality Counseling"
  // e.g. "Human Sexuality in a World of Diversity, 7th Canadian Edition: Chapter 3 — Anatomy and Physiology"
  rawTitle = rawTitle.replace(/^.+?(?:[:—–-]\s*)+(?=(?:chapters?|chps?\.?|chs?\.?|ch\b\.?|sections?|sec\.?)\s*\d+)/i, '').trim();
  if (resTitle && resTitle.trim()) {
    const escRes = resTitle.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rawTitle = rawTitle.replace(new RegExp(`^${escRes}[:—–-\\s]+`, 'i'), '').trim();
  }

  // Detect chapter candidate from either chapterText or rawTitle
  const chapterCandidate = rawCh || rawTitle;
  let canonicalChapter = cleanChapterFromRaw(chapterCandidate);

  // If not found yet, check if rawTitle starts with a chapter number: e.g. "7 Experiential Family Therapy"
  if (!canonicalChapter) {
    const leadingMatch = rawTitle.trim().match(/^(\d{1,2})(?:[:.\s–-]+|\s+)(?!jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec\b)([A-Za-z].*)$/i);
    if (leadingMatch) {
      canonicalChapter = `Chapter ${leadingMatch[1]}`;
    }
  }

  // Extract substantive topic by stripping all chapter mentions and noise
  let substantiveTitle = stripChapterMentions(deduplicateRepeatedPhrases(distillSmartReadingTitle(rawTitle)));

  if (canonicalChapter) {
    // 1. Strip leading list numbers, e.g. "3. Family Therapy...", "3: overview", "10.", "7 Experiential..."
    substantiveTitle = substantiveTitle.replace(/^\d+[:.\s–-]+/, '').trim();

    // 2. Strip trailing list numbers, e.g. "Family Therapy 3", "overview 3"
    substantiveTitle = substantiveTitle.replace(/[:.\s–-]+\d+$/, '').trim();

    // 3. If substantiveTitle is purely numbers/punctuation or lacks letters, discard it
    if (/^[\d\s:.\-–—&]+$/.test(substantiveTitle) || !/[a-zA-Z]/.test(substantiveTitle)) {
      substantiveTitle = '';
    }

    // 4. Strip textbook/generic noise words
    substantiveTitle = substantiveTitle.replace(/\b(?:textbooks?|readings?|required|optional)\b/gi, '').trim();
    substantiveTitle = substantiveTitle.replace(/^[:;•·\-–—\s.]+|[:;•·\-–—\s.]+$/g, '').trim();

    // 5. If substantiveTitle contains "Book Title — Chapter Topic" or "Book Title: Chapter Topic", isolate genuine chapter topic
    if (/[:—–-]/.test(substantiveTitle)) {
      const parts = substantiveTitle.split(/\s*(?:[—–-]|:)\s+/);
      if (parts.length >= 2) {
        const uniqueParts: string[] = [];
        for (const p of parts) {
          const pt = p.trim();
          if (!pt) continue;
          const pNorm = pt.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!uniqueParts.some(u => u.toLowerCase().replace(/[^a-z0-9]/g, '') === pNorm)) {
            uniqueParts.push(pt);
          }
        }
        if (uniqueParts.length === 1) {
          substantiveTitle = uniqueParts[0];
        } else {
          const first = uniqueParts[0];
          const rest = uniqueParts.slice(1).join(' – ').trim();
          const normRest = rest.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normFirst = first.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normRes = (resTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');

          // If first AND rest together make up resTitle, rest is just the book subtitle, NOT a chapter topic
          if (normRes.length > 0 && normRes.includes(normFirst) && normRes.includes(normRest) && normRest.length > 10) {
            substantiveTitle = '';
          } else if (
            /\b(?:edition|textbook|handbook|reader|diversity|counselling|psychology|resilience|growing)\b/i.test(first) ||
            (resTitle && resTitle.toLowerCase().includes(first.toLowerCase())) ||
            (first.length > 15 && /[a-zA-Z]/.test(rest))
          ) {
            substantiveTitle = rest;
          } else {
            substantiveTitle = uniqueParts.join(' – ');
          }
        }
      }
    }
  }

  // If author is inside substantive title and canonicalChapter is present, strip it
  if (canonicalChapter && authorName && authorName.trim()) {
    const authParts = authorName
      .trim()
      .split(/[\s,;&;:()\-–—]+/)
      .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(w => w.length >= 2);
    for (const ap of authParts) {
      const reg = new RegExp(`\\b${ap}\\b`, 'gi');
      substantiveTitle = substantiveTitle.replace(reg, '').trim();
    }
    const fullAuth = authorName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    substantiveTitle = substantiveTitle.replace(new RegExp(`\\b${fullAuth}\\b`, 'gi'), '').trim();
    substantiveTitle = substantiveTitle.replace(/\bet\s+al\.?\b/gi, '').trim();
    substantiveTitle = substantiveTitle.replace(/^[:;•·\-–—\s.]+|[:;•·\-–—\s.]+$/g, '').trim();
  }

  // Sanitize any dangling brackets/parens/colons in substantive title
  substantiveTitle = sanitizeDanglingPunctuation(substantiveTitle);

  // If substantive title is just a truncated fragment, digits, or lacks real substantive letters
  if (
    substantiveTitle.length < 3 ||
    !/[a-zA-Z]{3,}/.test(substantiveTitle) ||
    /^(?:et\s+al\.?|ch(?:apter)?\.?|\d+|overview|an\s+overview|introduction)$/i.test(substantiveTitle.trim())
  ) {
    substantiveTitle = '';
  }

  const normSubstantive = substantiveTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normRes = (resTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normCourse = (courseName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Clean resource title candidate for pairing with chapter when no substantive title exists
  let cleanResForTitle = '';
  if (resTitle && resTitle.trim()) {
    let clean = sanitizeDanglingPunctuation(stripChapterMentions(deduplicateRepeatedPhrases(resTitle.trim())));
    clean = clean.replace(/,?\s*\b\d+(?:st|nd|rd|th)?\s+(?:Canadian\s+)?Edition\b/gi, '').trim();
    if (clean.length > 50 && clean.includes(':')) {
      const colonParts = clean.split(':');
      const mainBookTitle = colonParts[0].trim();
      if (mainBookTitle.length >= 5 && /[a-zA-Z]{3,}/.test(mainBookTitle)) {
        clean = mainBookTitle;
      }
    }
    if (authorName && authorName.trim()) {
      const authParts = authorName
        .trim()
        .split(/[\s,;&;:()\-–—]+/)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
        .filter(w => w.length >= 2);
      for (const ap of authParts) {
        clean = clean.replace(new RegExp(`\\b${ap}\\b`, 'gi'), '').trim();
      }
      clean = clean.replace(/\bet\s+al\.?\b/gi, '').trim();
    }
    clean = sanitizeDanglingPunctuation(clean);
    const lowerClean = clean.toLowerCase();
    const cleanAlpha = lowerClean.replace(/[^a-z0-9]/g, '');
    const isOverviewStutter =
      lowerClean === 'family therapy: an overview' || lowerClean.endsWith('an overview');
    const isJustCourse =
      normCourse.length > 0 &&
      (cleanAlpha === normCourse || (normCourse.length > 5 && cleanAlpha.startsWith(normCourse)));
    const hasLetters = /[a-zA-Z]/.test(clean);
    const isJustNumbersOrChapter =
      !hasLetters ||
      /^(?:chapters?|chps?\.?|chs?\.?|ch\b\.?)?\s*[\d\s&,:.\-–—]+$/i.test(clean) ||
      /^[\d\s&,:.\-–—]+$/.test(clean);
    if (
      clean.length >= 4 &&
      hasLetters &&
      /[a-zA-Z]{3,}/.test(clean) &&
      !/^(?:et\s+al\.?|ch(?:apter)?\.?|\d+|chapters?|readings?)$/i.test(clean.trim()) &&
      lowerClean !== 'overview' &&
      lowerClean !== 'an overview' &&
      !isJustCourse &&
      !isOverviewStutter &&
      !isJustNumbersOrChapter
    ) {
      cleanResForTitle = clean;
    }
  }

  // Check if substantive title matches or overlaps the textbook or course name
  let isBookOrCourseName =
    normSubstantive.length === 0 ||
    (normRes.length > 0 && (normSubstantive === normRes || (normSubstantive.length > 10 && normSubstantive.startsWith(normRes)))) ||
    (normCourse.length > 0 && (normSubstantive === normCourse || normCourse.includes(normSubstantive) || normSubstantive.includes(normCourse)));

  // Check if rawTitle is already an explicit author citation like "Beck (Ch. 1–3)" or "Persons (Ch. 1)"
  const isAuthorCitation = /^[A-Z][a-zA-Z\s.&–-]+?\s*\(\s*(?:ch(?:apter)?s?\.?|pp?\.?|\d)/i.test(rawTitle);

  // If substantiveTitle is empty (or matches book/course name) and reading has a topic:
  // (Do not append course week themes to self-contained author citations like "Beck (Ch. 1–3)")
  if (!isAuthorCitation) {
    const rawTopic = typeof titleOrReading === 'object' && titleOrReading !== null
      ? ((titleOrReading as any).topic || (titleOrReading as any).relevantTopics)
      : null;
    if (rawTopic && typeof rawTopic === 'string' && rawTopic.trim()) {
      let cleanTopic = rawTopic.trim();
      cleanTopic = cleanTopic.replace(/^(?:module|mod|week|wk|session|unit)\s*\d+[:\-–—\s]*/i, '').trim();
      cleanTopic = cleanTopic.replace(/^[:;•·\-–—\s.]+|[:;•·\-–—\s.]+$/g, '').trim();
      if (
        cleanTopic.length >= 3 &&
        !/^(?:week|module|unit|reading\s*week|no\s*class)\b/i.test(cleanTopic) &&
        !isGenericPlaceholderTheme(cleanTopic) &&
        (!substantiveTitle || isBookOrCourseName || substantiveTitle.toLowerCase() === 'reading')
      ) {
        substantiveTitle = cleanTopic;
        isBookOrCourseName = false;
      }
    }
  }

  // If rawTitle is an academic citation e.g. "Shoeybi et al. (Megatron)", "Li et al. (2020)", "Dettmers et al. (QLoRA)"
  // and no canonical chapter exists, preserve the full citation as the result title!
  const isPaperCitation = /^[A-Z\u00C0-\u024F][a-zA-Z\u00C0-\u024F\s.&–-]+?\s*\([A-Za-z0-9\s\-–—/]+\)$/.test(rawTitle.trim());
  if (isPaperCitation && !canonicalChapter) {
    return rawTitle.trim();
  }

  let resultTitle = '';
  if (canonicalChapter && substantiveTitle) {
    const escCh = canonicalChapter.replace(/\s+/g, '\\s*');
    const chRep = new RegExp(`^(?:${escCh}|ch(?:apter)?\\.?\\s*\\d+)[:·•\\-–—\\s]*`, 'i');
    substantiveTitle = substantiveTitle.replace(chRep, '').trim();
    if (substantiveTitle.toLowerCase().replace(/[^a-z0-9]/g, '') === canonicalChapter.toLowerCase().replace(/[^a-z0-9]/g, '')) {
      substantiveTitle = '';
    }
  }

  if (
    canonicalChapter &&
    authorName &&
    authorName.trim() &&
    (rawTitle.toLowerCase().includes(authorName.toLowerCase().trim()) ||
     rawTitle.toLowerCase().includes('marnat') ||
     (resTitle && resTitle.toLowerCase().includes(authorName.toLowerCase().trim())) ||
     (resTitle && resTitle.toLowerCase().includes('marnat')) ||
     /^[A-Z][a-zA-Z\s.&–-]+?\s*\(\s*(?:ch(?:apter)?s?\.?|pp?\.?|\d)/i.test(rawTitle)) &&
    !rawTitle.toLowerCase().includes('overview gehart')
  ) {
    const shortCh = canonicalChapter.replace(/^Chapters?\s*/i, 'Ch. ');
    // Clean any author stutter or duplicate fragments from substantiveTitle
    let cleanSub = substantiveTitle;
    const cleanAuthor = authorName.replace(/;\s*/g, ', ').trim();
    if (cleanSub) {
      const authParts = authorName
        .trim()
        .split(/[\s,;&;:()\-–—]+/)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
        .filter(w => w.length >= 2);
      for (const ap of authParts) {
        cleanSub = cleanSub.replace(new RegExp(`\\b${ap}\\b`, 'gi'), '').trim();
      }
      cleanSub = cleanSub.replace(/^[:;•·\-–—\s,.]+|[:;•·\-–—\s,.]+$/g, '').trim();
      const normAuth = cleanAuthor.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normSub = cleanSub.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!normSub || normSub.length <= 2 || normAuth.includes(normSub) || normSub.includes(normAuth)) {
        cleanSub = '';
      }
    }
    if (cleanSub && !isBookOrCourseName && cleanSub.toLowerCase() !== canonicalChapter.toLowerCase()) {
      resultTitle = `${cleanAuthor} (${shortCh}) · ${cleanSub}`;
    } else {
      resultTitle = `${cleanAuthor} (${shortCh})`;
    }
  } else if (canonicalChapter && substantiveTitle && !isBookOrCourseName && substantiveTitle.toLowerCase() !== canonicalChapter.toLowerCase()) {
    resultTitle = `${canonicalChapter} · ${substantiveTitle}`;
  } else if (canonicalChapter && isBookOrCourseName) {
    resultTitle = cleanResForTitle ? `${cleanResForTitle} · ${canonicalChapter}` : canonicalChapter;
  } else if (
    !substantiveTitle ||
    (canonicalChapter && substantiveTitle.toLowerCase() === canonicalChapter.toLowerCase()) ||
    substantiveTitle.toLowerCase() === 'reading' ||
    (substantiveTitle.toLowerCase() === 'assigned readings' && canonicalChapter)
  ) {
    if (canonicalChapter && cleanResForTitle) {
      resultTitle = `${cleanResForTitle} · ${canonicalChapter}`;
    } else {
      resultTitle = canonicalChapter || distillSmartReadingTitle(rawTitle);
    }
  } else if (canonicalChapter) {
    resultTitle = `${canonicalChapter} · ${substantiveTitle}`;
  } else {
    resultTitle = substantiveTitle;
  }

  // Sanitize any remaining leading or trailing number-range colon artifacts e.g. "1: 3 · " or " · 4: 10"
  resultTitle = resultTitle.replace(/^\d+[\s:.\-–—]+\d+\s*[:·•\-–—]\s*/, '').trim();
  resultTitle = resultTitle.replace(/\s*[:·•\-–—]\s*\d+[\s:.\-–—]+\d+$/, '').trim();
  // Sanitize duplicate separators and dangling punctuation
  resultTitle = resultTitle
    .replace(/\s*[:·•\-–—]\s*[:·•\-–—]\s*/g, ' · ')
    .replace(/^[:;•·\-–—\s,.]+|[:;•·\-–—\s,.]+$/g, '')
    .trim();

  // Strip trailing dangling fragments: e.g. " · 9", " · 8", " · et al. ( 5", " · et al.", " · ("
  resultTitle = resultTitle.replace(/\s*·\s*(?:et\s+al\.?[\s(]*\d*|\d+|\(\s*\d*|\b[a-z]{1,2}\b)\s*$/i, '').trim();
  if (authorName) {
    const authPieces = authorName
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(p => p.length >= 3);
    for (const p of authPieces) {
      const pRegex = new RegExp(`\\s*·\\s*${p}\\s*$`, 'i');
      resultTitle = resultTitle.replace(pRegex, '').trim();
    }
  }
  resultTitle = sanitizeDanglingPunctuation(resultTitle);
  resultTitle = deduplicateReadingTitle(resultTitle);

  // Naked parenthetical guard: Never allow bare "(Megatron)" or "(QLoRA)" to display
  if (/^\([A-Za-z0-9\s\-–—/]+\)$/.test(resultTitle)) {
    if (authorName && authorName.trim()) {
      resultTitle = `${authorName.trim()} ${resultTitle}`;
    } else if (rawTitle && rawTitle.trim()) {
      resultTitle = rawTitle.trim();
    }
  }

  return resultTitle;
}

/**
 * Subtitle formatter for the reading card down below.
 * CRITICAL: Chapters are strictly EXCLUDED so they are never repeated below the title!
 * Also omits textbook title if it's already displayed in displayTitle or identical to courseName.
 */
export function formatAuthorAndPagesSubtitle(
  authorOrReading?: string | { authorName?: string | null; pagesText?: string | null; resourceTitle?: string | null } | null,
  pagesText?: string | null,
  resourceTitle?: string | null,
  displayTitle?: string | null,
  courseName?: string | null
): string {
  let author = '';
  let pages = pagesText || '';
  let resource = resourceTitle || '';

  if (typeof authorOrReading === 'object' && authorOrReading !== null) {
    author = authorOrReading.authorName || '';
    pages = authorOrReading.pagesText || pages;
    resource = authorOrReading.resourceTitle || resource;
  } else if (typeof authorOrReading === 'string') {
    author = authorOrReading;
  }

  if (author) author = author.replace(/\bGroth\s*:\s*Marnat\b/gi, 'Groth-Marnat').replace(/;\s*/g, ', ').trim();
  if (resource) resource = resource.replace(/\bGroth\s*:\s*Marnat\b/gi, 'Groth-Marnat').trim();

  const parts: string[] = [];

  // 1. Clean Resource / Textbook Title (strip any chapter mentions)
  if (resource && resource.trim()) {
    let cleanRes = sanitizeDanglingPunctuation(stripChapterMentions(deduplicateRepeatedPhrases(resource.trim())));
    cleanRes = cleanRes.replace(/\bGroth\s*:\s*Marnat\b/gi, 'Groth-Marnat').trim();
    cleanRes = cleanRes.replace(/,?\s*\b\d+(?:st|nd|rd|th)?\s+(?:Canadian\s+)?Edition\b/gi, '').trim();

    // Discard pure digits / colons (e.g. "4: 10" or "3" or "10")
    if (/^[\d\s:.\-–—]+$/.test(cleanRes)) {
      cleanRes = '';
    }

    // Strip author name if contained inside cleanRes (e.g. "overview Gehart 3" -> "overview 3")
    if (author && author.trim()) {
      const authParts = author
        .trim()
        .split(/[\s,;&;:()\-–—]+/)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
        .filter(w => w.length >= 2);
      for (const ap of authParts) {
        const reg = new RegExp(`\\b${ap}\\b`, 'gi');
        cleanRes = cleanRes.replace(reg, '').trim();
      }
      const fullAuth = author.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleanRes = cleanRes.replace(new RegExp(`\\b${fullAuth}\\b`, 'gi'), '').trim();
      cleanRes = cleanRes.replace(/\bet\s+al\.?\b/gi, '').trim();
    }

    // Strip stray numbers from cleanRes (e.g. "overview 3" -> "overview")
    cleanRes = cleanRes.replace(/^\d+[:.\s–-]+|[:.\s–-]+\d+$/g, '').trim();
    cleanRes = sanitizeDanglingPunctuation(cleanRes);

    // Discard fragments like "overview" or "an overview", or if lacks real substantive words
    if (
      cleanRes.length < 3 ||
      !/[a-zA-Z]{3,}/.test(cleanRes) ||
      cleanRes.toLowerCase() === 'overview' ||
      cleanRes.toLowerCase() === 'an overview' ||
      /^(?:et\s+al\.?|ch(?:apter)?\.?|\d+)$/i.test(cleanRes.trim())
    ) {
      cleanRes = '';
    }

    // If cleanRes has a colon and long publisher subtitle (>50 chars), e.g. "Mastering Competency in Family Therapy: A Practical Approach..."
    // Clean it to the primary title to avoid multi-line textbook blurb clutter
    if (cleanRes.length > 50 && cleanRes.includes(':')) {
      const colonParts = cleanRes.split(':');
      const mainBookTitle = colonParts[0].trim();
      if (mainBookTitle.length >= 5 && /[a-zA-Z]{3,}/.test(mainBookTitle)) {
        cleanRes = mainBookTitle;
      }
    }

    // Suppress cleanRes if it is redundant with author
    const normCleanRes = cleanRes.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normAuth = (author || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normCleanRes && normAuth && (normCleanRes === normAuth || normAuth.includes(normCleanRes) || normCleanRes.includes(normAuth))) {
      cleanRes = '';
    }

    const lowerRes = cleanRes.toLowerCase();
    const lowerDisplay = (displayTitle || '').toLowerCase();
    const lowerCourse = (courseName || '').toLowerCase();

    const isAlreadyInTitle =
      lowerDisplay.includes(lowerRes) ||
      (cleanRes.length > 5 && lowerDisplay.replace(/chapters?\s*[\d&–,-]+\s*·\s*/i, '').includes(lowerRes));
    const isJustCourseName =
      lowerCourse && (lowerCourse === lowerRes || (lowerRes.length > 4 && lowerCourse.includes(lowerRes)));
    const isGeneric = lowerRes === 'reading' || lowerRes === 'textbook' || lowerRes === 'required reading';

    if (cleanRes && !isAlreadyInTitle && !isJustCourseName && !isGeneric) {
      parts.push(cleanRes);
    }
  }

  // 2. Clean Author (strip any chapter mentions and publication years in subtitle)
  if (author && author.trim()) {
    let cleanAuth = sanitizeDanglingPunctuation(stripChapterMentions(author.trim()));
    cleanAuth = cleanAuth.replace(/\s*\(\s*\d{4}\s*\)/g, '').replace(/;\s*/g, ', ').trim();
    // Discard pure digits / colons
    if (/^[\d\s:.\-–—]+$/.test(cleanAuth)) {
      cleanAuth = '';
    }
    if (cleanAuth) {
      const lowerAuth = cleanAuth.toLowerCase();
      const alreadyInParts = parts.some(p => p.toLowerCase().includes(lowerAuth));
      const alreadyInTitle = (displayTitle || '').toLowerCase().includes(lowerAuth);
      if (!alreadyInParts && !alreadyInTitle) {
        parts.push(cleanAuth);
      }
    }
  }

  // 3. Clean Pages: ONLY include if it's an actual page number/range (e.g. "pp. 14–35", "p. 12")
  // Chapters are NEVER allowed down below in pages!
  if (pages && pages.trim()) {
    let cleanPg = sanitizeDanglingPunctuation(pages.trim());
    const hasChapterMention = /\b(?:chapters?|chs?\.?|chap\.?)\b/i.test(cleanPg);
    const hasPageDigits = /\b(?:pp?\.?|pages?)\s*\d+/i.test(cleanPg) || /^\d+\s*[-–]\s*\d+$/.test(cleanPg);

    if (!hasChapterMention && hasPageDigits) {
      // Normalize hyphen to en-dash
      cleanPg = cleanPg.replace(/(\d+)\s*-\s*(\d+)/g, '$1–$2');
      if (/^\d+\s*–\s*\d+$/.test(cleanPg)) {
        cleanPg = `pp. ${cleanPg}`;
      } else if (!/^pp?\.?/i.test(cleanPg) && !/^pages?/i.test(cleanPg)) {
        cleanPg = `pp. ${cleanPg}`;
      }
      parts.push(cleanPg);
    }
  }

  const sanitizedParts = parts
    .map(p => p.replace(/^[:;•·\-–—\s,.]+|[:;•·\-–—\s,.]+$/g, '').trim())
    .filter(p => p.length > 0);

  // Strictly ensure no part duplicates any word or phrase in displayTitle
  const cleanParts: string[] = [];
  const lowDisp = (displayTitle || '').toLowerCase();
  for (const p of sanitizedParts) {
    const lowP = p.toLowerCase();
    if (lowDisp.includes(lowP) && lowP.length > 3) {
      continue;
    }
    cleanParts.push(p);
  }

  return cleanParts.join(' · ');
}

/**
 * Safely parses any date input (string, Date, number, null, undefined) into a valid Date object or null.
 * Protects against runtime crashes from .getFullYear() or .toLocaleDateString() on unparsed strings or invalid values.
 */
export function parseSafeDate(rawDate?: Date | string | number | null, fallbackYear: number = 2026): Date | null {
  if (!rawDate) return null;
  if (rawDate instanceof Date) {
    if (isNaN(rawDate.getTime())) return null;
    // If the Date has UTC midnight (e.g. from ISO string without time), in negative timezones like PDT (UTC-7)
    // it rolls back to 5:00 PM on the previous day. Pin to local noon on its calendar date.
    if (rawDate.getUTCHours() === 0 && rawDate.getUTCMinutes() === 0 && rawDate.getUTCSeconds() === 0) {
      return new Date(rawDate.getUTCFullYear(), rawDate.getUTCMonth(), rawDate.getUTCDate(), 12, 0, 0);
    }
    return rawDate;
  }
  if (typeof rawDate === 'number') {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return null;
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
    }
    return d;
  }

  const str = String(rawDate).trim();
  if (!str) return null;

  const lower = str.toLowerCase();
  if (
    lower.includes('over the course') ||
    lower.includes('throughout the') ||
    lower.includes('tbd') ||
    lower.includes('tba') ||
    lower.includes('none') ||
    lower.includes('unknown') ||
    lower === 'null' ||
    lower === 'undefined' ||
    /^week\s*\d*$/i.test(lower) ||
    /^module\s*\d*$/i.test(lower)
  ) {
    return null;
  }

  // 1. Direct ISO format check (e.g. "2026-05-15")
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const yr = parseInt(isoMatch[1], 10);
    const mo = parseInt(isoMatch[2], 10) - 1;
    const dy = parseInt(isoMatch[3], 10);
    const direct = new Date(yr, mo, dy, 12, 0, 0);
    if (!isNaN(direct.getTime())) return direct;
  }

  // 2. Clean ordinal suffixes, leading/trailing due words, day-of-week names
  const cleaned = str
    .replace(/\b(due|by|on|at)\b/gi, ' ')
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b[,\s]*/gi, '')
    .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // 3. Handle slash dates with 2-digit or 4-digit years e.g. "4/2/26"
  const slashMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10);
    const day = parseInt(slashMatch[2], 10);
    let yr = parseInt(slashMatch[3], 10);
    if (yr < 100) yr += 2000;
    const d = new Date(yr, month - 1, day, 9, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }

  // 4. Month Name + Day Number (e.g. "JULY 31", "August 21", "September 4")
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec'
  ];
  const monthMap: Record<string, number> = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11
  };

  const monthRegex = new RegExp(`\\b(${monthNames.join('|')})\\s+(\\d{1,2})(?:[\\s,]+(\\d{4}))?`, 'i');
  const match = cleaned.match(monthRegex);
  if (match) {
    const mStr = match[1].toLowerCase();
    const monthIdx = monthMap[mStr];
    const day = parseInt(match[2], 10);
    const yr = match[3] ? parseInt(match[3], 10) : fallbackYear;

    let hours = 9;
    let minutes = 0;
    const timeMatch = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3].toLowerCase();
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      hours = h;
      minutes = m;
    }

    if (monthIdx !== undefined && !isNaN(day) && day >= 1 && day <= 31) {
      const d = new Date(yr, monthIdx, day, hours, minutes, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 5. Day Month format: e.g. "31 July 2026"
  const dayMonthRegex = new RegExp(`(\\d{1,2})\\s+(${monthNames.join('|')})(?:[\\s,]+(\\d{4}))?`, 'i');
  const dmMatch = cleaned.match(dayMonthRegex);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const mStr = dmMatch[2].toLowerCase();
    const monthIdx = monthMap[mStr];
    const yr = dmMatch[3] ? parseInt(dmMatch[3], 10) : fallbackYear;
    if (monthIdx !== undefined && !isNaN(day) && day >= 1 && day <= 31) {
      const d = new Date(yr, monthIdx, day, 9, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 6. Native fallback parse
  const fallbackDate = new Date(cleaned);
  if (!isNaN(fallbackDate.getTime())) return fallbackDate;

  return null;
}

/**
 * Formats an assignment due date cleanly e.g. "Due Thursday, May 14".
 */
export function formatAssignmentDueDate(rawDate?: Date | string | number | null): string | null {
  const d = parseSafeDate(rawDate);
  if (!d) return null;
  return `Due ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`;
}

export function formatWeekHeaderDate(rawDate: Date | string | number): string {
  const d = parseSafeDate(rawDate) || new Date();
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
  const monthName = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${dayName}, ${monthName} ${day}`;
}

/**
 * Checks if a string is a generic placeholder rather than a real date or date range.
 */
export function isGenericDatePlaceholder(str?: string | null): boolean {
  if (!str) return true;
  const s = str.trim().toLowerCase();
  return (
    s === '' ||
    s === 'unknown' ||
    s === 'tbd' ||
    s === 'none' ||
    s === 'null' ||
    /^week\s*\d*$/i.test(s) ||
    /^module\s*\d*$/i.test(s) ||
    /^unit\s*\d*$/i.test(s) ||
    /^session\s*\d*$/i.test(s) ||
    /^(?:reading|readings|assigned readings)$/i.test(s)
  );
}

/**
 * Checks whether a string contains a genuine calendar date or date range from the document.
 */
export function isRealDateOrRangeString(str?: string | null): boolean {
  if (!str || isGenericDatePlaceholder(str)) return false;
  const s = str.trim().toLowerCase();
  const monthRegex = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;
  const slashDateRegex = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/;
  const isoDateRegex = /\b\d{4}-\d{2}-\d{2}\b/;
  return monthRegex.test(s) || slashDateRegex.test(s) || isoDateRegex.test(s);
}

/**
 * Checks if a string contains a date range (e.g. "Sep 1 – 5", "Sep 1 - Sep 5", "between September 1 to September 5").
 */
export function isDateRangeString(str?: string | null): boolean {
  if (!str || !isRealDateOrRangeString(str)) return false;
  const s = str.trim();
  // Exclude single ISO date strings YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  // Exclude single date strings like "July 2", "7/2/2026", "Sep 10"
  if (/^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?$/i.test(s)) return false;
  if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(s)) return false;

  return (/[-–—]|(\bto\b)|(\bbetween\b)/i.test(s) && /\d+/.test(s)) || /\b\d{1,2}\s*[\/\-–]\s*\d{1,2}\b/.test(s);
}

/**
 * Normalizes a date range string to a clean, concise format (e.g. "Sep 1 – Sep 5" or "Sep 1 – 5").
 */
export function cleanDateRangeDisplay(rangeStr: string): string {
  if (!rangeStr) return '';
  const trimmed = rangeStr.trim();
  // If it's a single ISO date (e.g. "2026-11-12"), format it cleanly
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = parseSafeDate(trimmed);
    if (d && !isNaN(d.getTime())) {
      const m = d.toLocaleDateString('en-US', { month: 'short' });
      return `${m} ${d.getDate()}`;
    }
  }

  let s = trimmed;
  // Strip leading prefixes
  s = s.replace(/^between\s+/i, '').replace(/^suggested:\s*/i, '').replace(/^suggested reading:\s*/i, '');
  // Remove 4-digit year if present, e.g. ", 2026" or " 2026" (ensure it is preceded by a word or space, not part of YYYY-MM-DD)
  s = s.replace(/(?:,\s*|\s+)\b20\d{2}\b/g, '').trim();
  // Standardize hyphens to en-dash with single spaces
  s = s.replace(/\s*[-–—]\s*/g, ' – ');
  // Replace "to" or "and" with "–" if between dates
  s = s.replace(/\s+\b(?:to|and)\b\s+/gi, ' – ');
  // Shorten full month names
  s = s.replace(/\bSeptember\b/gi, 'Sep')
       .replace(/\bOctober\b/gi, 'Oct')
       .replace(/\bNovember\b/gi, 'Nov')
       .replace(/\bDecember\b/gi, 'Dec')
       .replace(/\bJanuary\b/gi, 'Jan')
       .replace(/\bFebruary\b/gi, 'Feb')
       .replace(/\bMarch\b/gi, 'Mar')
       .replace(/\bApril\b/gi, 'Apr')
       .replace(/\bAugust\b/gi, 'Aug');
  // Strip any leading or trailing dashes/punctuation
  s = s.replace(/^[–—\-\s,.:]+|[–—\-\s,.:]+$/g, '').trim();
  // Clean up duplicate spaces
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Formats a short, accurate suggested reading line for reading cards without an icon.
 * STRICT: Only returns a string if the reading actually has a real date or date range from the PDF.
 * Never invents dates, and does not mention days of the week like "Tuesday".
 */
export function formatSuggestedReadingCardText(
  dateInput?: string | Date | null,
  dateRangeStr?: string | null,
  fallbackWeekDateStr?: string | null
): string | null {
  // 1. If dateRangeStr is a genuine date range from the document (e.g. "Sep 1 – Sep 5" or "Sep 14 – Sep 20")
  if (dateRangeStr && isDateRangeString(dateRangeStr)) {
    const cleanRange = cleanDateRangeDisplay(dateRangeStr);
    if (cleanRange) return `Suggested: ${cleanRange}`;
  }

  // 2. If fallbackWeekDateStr is a genuine date range from the document
  if (fallbackWeekDateStr && isDateRangeString(fallbackWeekDateStr)) {
    const cleanRange = cleanDateRangeDisplay(fallbackWeekDateStr);
    if (cleanRange) return `Suggested: ${cleanRange}`;
  }

  // 3. If dateInput is a valid Date or ISO string
  if (dateInput) {
    const d = parseSafeDate(dateInput);
    if (d && !isNaN(d.getTime())) {
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      const day = d.getDate();
      return `Suggested: Read by ${monthName} ${day}`;
    }
  }

  // 4. If dateRangeStr is a single real date string from the document (e.g. "September 5" or "4/2/26")
  if (dateRangeStr && isRealDateOrRangeString(dateRangeStr)) {
    const d = parseSafeDate(dateRangeStr);
    if (d && !isNaN(d.getTime())) {
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      const day = d.getDate();
      return `Suggested: Read by ${monthName} ${day}`;
    }
    const clean = cleanDateRangeDisplay(dateRangeStr);
    if (clean.length > 0) {
      return `Suggested: ${clean}`;
    }
  }

  // 5. If fallbackWeekDateStr is a single real date from the document
  if (fallbackWeekDateStr && isRealDateOrRangeString(fallbackWeekDateStr)) {
    const d = parseSafeDate(fallbackWeekDateStr);
    if (d && !isNaN(d.getTime())) {
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      const day = d.getDate();
      return `Suggested: Read by ${monthName} ${day}`;
    }
    const clean = cleanDateRangeDisplay(fallbackWeekDateStr);
    if (clean.length > 0) {
      return `Suggested: ${clean}`;
    }
  }

  // Strictly no real date found in the PDF -> return null so nothing is displayed (no making up things!)
  return null;
}

/**
 * Resolves the canonical MediaType ('textbook' | 'article' | 'video' | 'podcast')
 * from a reading's mediaType, mediaTypeRaw, or title/resource hints.
 */
export function resolveReadingMediaType(reading?: {
  mediaType?: any;
  mediaTypeRaw?: any;
  title?: string | null;
  resourceTitle?: string | null;
} | null): MediaType {
  if (!reading) return 'textbook';

  const rawType = (reading.mediaType || reading.mediaTypeRaw || '').toString().trim().toLowerCase();
  if (
    rawType === 'article / paper' ||
    rawType === 'article/paper' ||
    rawType === 'paper' ||
    rawType.includes('paper')
  ) {
    return 'paper';
  }
  if (
    rawType === 'article' ||
    rawType.includes('article')
  ) {
    return 'article';
  }
  if (rawType === 'video' || rawType.includes('video') || rawType.includes('watch') || rawType.includes('youtube') || rawType.includes('vimeo')) {
    return 'video';
  }
  if (rawType === 'podcast' || rawType.includes('podcast') || rawType.includes('listen') || rawType.includes('audio')) {
    return 'podcast';
  }

  // Check title or resourceTitle hints if mediaType is generic or unspecified
  const title = (reading.title || '').toLowerCase();
  const res = (reading.resourceTitle || '').toLowerCase();
  const combined = `${title} ${res}`;

  if (
    combined.includes('article / paper') ||
    combined.includes('article/paper') ||
    /\b(?:research paper|white paper|paper)\b/i.test(combined) ||
    /\b(?:paper)\b/i.test(res) ||
    (/\b(?:paper)\b/i.test(title) && !/\b(?:chapter|chs?\.?|chap\.?|textbook)\b/i.test(title))
  ) {
    return 'paper';
  }
  if (
    /\b(?:journal article|article)\b/i.test(combined) ||
    /\b(?:article)\b/i.test(res) ||
    (/\b(?:article)\b/i.test(title) && !/\b(?:chapter|chs?\.?|chap\.?|textbook)\b/i.test(title))
  ) {
    return 'article';
  }
  if (/\b(?:video|ted talk|watch|youtube|vimeo)\b/i.test(combined)) {
    return 'video';
  }
  if (/\b(?:podcast|episode|listen|audio)\b/i.test(combined)) {
    return 'podcast';
  }

  return 'textbook';
}

/**
 * Sanitizes course code tokens to eliminate placeholder tags like "NEW", "COURSE", or "READING".
 * Falls back to the real course code, course name, or "Reading".
 */
export function getSanitizedCoursePill(
  readingCourseCode?: string | null,
  matchedCourse?: { courseCode?: string | null; courseName?: string | null } | null
): string {
  const isGeneric = (code?: string | null): boolean => {
    if (!code || !code.trim()) return true;
    const trimmed = code.trim().toLowerCase();
    return (
      trimmed === 'new' ||
      trimmed === 'new course' ||
      trimmed === 'new cou' ||
      trimmed === 'reading' ||
      trimmed === 'readings' ||
      trimmed === 'assignment' ||
      trimmed === 'assignments' ||
      trimmed === 'course' ||
      trimmed === 'crs' ||
      trimmed === 'gen 101' ||
      trimmed === 'details' ||
      trimmed === 'gehart' ||
      trimmed === 'corey' ||
      trimmed === 'yalom' ||
      trimmed === 'creswell' ||
      trimmed === 'nichols' ||
      trimmed === 'davis' ||
      trimmed.startsWith('new ')
    );
  };

  if (matchedCourse && !isGeneric(matchedCourse.courseCode)) {
    return matchedCourse.courseCode!.trim();
  }
  if (!isGeneric(readingCourseCode)) {
    return readingCourseCode!.trim();
  }
  if (matchedCourse && matchedCourse.courseName && matchedCourse.courseName.trim()) {
    return matchedCourse.courseName.trim();
  }
  return 'Reading';
}

/**
 * Checks whether week scheduling is actively enabled for a reading.
 */
export function isReadingWeekEnabled(reading: {
  weekId?: string | null;
  weekNumber?: number | null;
  relevantTopics?: string | null;
  chapterText?: string | null;
}): boolean {
  if (reading.weekNumber !== undefined && reading.weekNumber !== null) {
    return reading.weekNumber > 0;
  }
  if (reading.weekId && reading.weekId !== 'none' && reading.weekId.trim() !== '') {
    const m = reading.weekId.match(/\d+/);
    return m !== null && parseInt(m[0], 10) > 0;
  }
  return false;
}

/**
 * Extracts a numeric week index from reading metadata (weekNumber or weekId).
 * Returns null if week scheduling is turned off or not set.
 */
export function extractReadingWeekNumber(reading: {
  weekId?: string | null;
  weekNumber?: number | null;
  relevantTopics?: string | null;
  chapterText?: string | null;
}): number | null {
  if (reading.weekNumber !== undefined && reading.weekNumber !== null) {
    return reading.weekNumber > 0 ? reading.weekNumber : null;
  }
  if (reading.weekId && reading.weekId !== 'none' && reading.weekId.trim() !== '') {
    const m = reading.weekId.match(/\d+/);
    if (m) return parseInt(m[0], 10);
  }
  return null;
}

export interface MinimalReadingItem {
  id: string;
  title: string;
  authorName?: string | null;
  resourceTitle?: string | null;
  chapterText?: string | null;
  pagesText?: string | null;
  dueDate?: Date | string | null;
  weekId?: string | null;
  weekNumber?: number | null;
  relevantTopics?: string | null;
  courseCode?: string | null;
  isCompleted?: boolean;
  isDeleted?: boolean;
  mediaType?: any;
  videoUrl?: string | null;
  [key: string]: any;
}

/**
 * Extracts an ordered list of unique chapter numbers from a text string.
 * Handles ranges ("1-3", "1–3", "1: 3", "4: 10", "4 to 10"), lists ("5 & 7", "1, 2"), and singles ("Chapter 5").
 */
export function parseChapterNumbers(text?: string | null): number[] {
  if (!text || !text.trim()) return [];
  const str = text.trim();

  // 1. Range check: e.g. "1-3", "1–3", "1: 3", "4: 10", "Chapters 1 to 3"
  const rangeMatch = str.match(/\b(\d{1,3})\s*(?:[-–—:]|\bto\b)\s*(\d{1,3})\b/i);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (!isNaN(start) && !isNaN(end) && start < end && end - start <= 30) {
      const nums: number[] = [];
      for (let i = start; i <= end; i++) {
        nums.push(i);
      }
      return nums;
    }
  }

  // 2. Extract from chapter section or whole string
  const chapterSectionMatch = str.match(/\b(?:chapters?|chaps?\.?|chs?\.?|ch\.?)\s*([\d\s&,–\-+andto]+)/i);
  const targetStr = chapterSectionMatch ? chapterSectionMatch[1] : str;
  const numMatches = targetStr.match(/\b\d{1,3}\b/g);
  if (!numMatches) return [];

  const seen = new Set<number>();
  const nums: number[] = [];
  for (const nm of numMatches) {
    const val = parseInt(nm, 10);
    // Exclude 4-digit years or 0
    if (val > 0 && val < 1000 && !seen.has(val)) {
      seen.add(val);
      nums.push(val);
    }
  }
  return nums.sort((a, b) => a - b);
}

/**
 * Formats a list of chapter numbers into canonical string:
 * e.g. [5] -> "Chapter 5"
 * e.g. [5, 7] -> "Chapters 5 & 7"
 * e.g. [1, 2, 3] -> "Chapters 1–3"
 * e.g. [4, 5, 6, 7, 8, 9, 10] -> "Chapters 4–10"
 */
export function formatChapterList(chapters: number[]): string {
  if (!chapters || chapters.length === 0) return '';
  const sorted = [...new Set(chapters)].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return `Chapter ${sorted[0]}`;
  }

  // Check if fully contiguous range
  const isContiguous = sorted.every((num, idx) => idx === 0 || num === sorted[idx - 1] + 1);
  if (isContiguous && sorted.length >= 2) {
    return `Chapters ${sorted[0]}–${sorted[sorted.length - 1]}`;
  }

  if (sorted.length === 2) {
    return `Chapters ${sorted[0]} & ${sorted[1]}`;
  }

  // List with Oxford/comma format e.g. Chapters 1, 2 & 4
  const lead = sorted.slice(0, -1).join(', ');
  return `Chapters ${lead} & ${sorted[sorted.length - 1]}`;
}

/**
 * Deduplicates and consolidates reading items:
 * 1. Merges intra-week duplicate chapter cards (e.g. "Chapters 1-3" + "overview Gehart").
 * 2. Eliminates repeated chapters within the same week ("once a chapter is repeated you don't need to say it again").
 *    If an earlier card already has Chapter 1, subsequent "Chapters 1 & 7" prunes 1 to become "Chapter 7".
 *    Subsets like "Chapter 5" and "Chapter 7" merge into "Chapters 5 & 7" without clutter.
 * 3. Consolidates identical inter-week range clones that share the exact same chapter, author, and due date.
 * 4. Preserves completion status and chooses the most descriptive title and metadata.
 */
export function deduplicateReadingsList<T extends MinimalReadingItem>(
  readings: T[],
  courses?: { id?: string; courseCode?: string | null; courseName?: string | null }[]
): T[] {
  if (!readings || readings.length <= 1) return readings;

  const result: T[] = [];
  const seenKeys = new Map<string, number>(); // key -> index in result
  const seenChaptersPerBookWeek = new Map<string, Set<number>>();

  for (const rawR of readings) {
    if (isGenericPlaceholderReadingTitle(rawR.title)) continue;
    if (isDeliverableNotReading(rawR.title, { moduleNumber: (rawR as any).moduleNumber, chapterText: (rawR as any).chapterText })) continue;
    let r = { ...rawR };

    // Pre-clean leading number-range artifact like "1: 3 · " or "4: 10 · "
    r.title = r.title.replace(/^\d+[\s:.\-–—]+\d+\s*[:·•\-–—]\s*/, '').trim();
    if (r.chapterText) {
      r.chapterText = r.chapterText.replace(/^\d+[\s:.\-–—]+\d+\s*[:·•\-–—]\s*/, '').trim();
    }

    const isPureModule = Boolean(
      (r as any).moduleNumber &&
      ((r as any).weekNumber === null || (r as any).weekNumber === undefined || (r as any).weekId === 'none' || (r as any).weekNumber === 0)
    );
    const weekNum = isPureModule ? 0 : (extractReadingWeekNumber(r) ?? 0);
    const modNum = (typeof (r as any).moduleNumber === 'number' && (r as any).moduleNumber > 0)
      ? (r as any).moduleNumber
      : (typeof (r as any).module_number === 'number' && (r as any).module_number > 0 ? (r as any).module_number : 0);
    const scheduleKey = modNum > 0 && (!weekNum || weekNum === 0) ? `m${modNum}` : (weekNum > 0 ? `w${weekNum}` : `w0`);

    const matchedCourse = courses?.find(
      c => (c.courseCode || c.courseName || '').toLowerCase() === (r.courseCode || '').toLowerCase()
    );
    const courseKey = (matchedCourse?.courseCode || matchedCourse?.courseName || r.courseCode || 'default')
      .trim()
      .toLowerCase();

    // Extract author and resource key
    const authorKey = (r.authorName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    let resKey = (r.resourceTitle || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    let bookKey = authorKey || resKey;
    if (!bookKey) {
      // Check if title has book prefix like "Corey Ch.", "Yalom Ch.", etc.
      const prefixMatch = r.title.match(/^([A-Za-z]+)\s+(?:Ch|Chapter|pp?)\b/i);
      if (prefixMatch) {
        bookKey = prefixMatch[1].toLowerCase();
      }
    }

    const bookWeekKey = `${courseKey}_${scheduleKey}_bk_${bookKey}`;
    const seenChapters = seenChaptersPerBookWeek.get(bookWeekKey) || new Set<number>();

    // Parse chapter numbers for repeated chapter detection
    const chapters = parseChapterNumbers(r.chapterText || r.title);
    if (chapters.length > 0) {
      const remainingChapters = chapters.filter(c => !seenChapters.has(c));

      if (remainingChapters.length === 0) {
        // All chapters in this item were already seen/assigned earlier in this week!
        let substantiveTopic = stripChapterMentions(distillSmartReadingTitle(r.title));
        if (/^[\d\s:.\-–—&]+$/.test(substantiveTopic) || !/[a-zA-Z]/.test(substantiveTopic)) {
          substantiveTopic = '';
        }
        const isGeneric =
          !substantiveTopic ||
          /^(?:overview|an overview|reading|readings|textbook|assigned readings|chapter\s*\d+)$/i.test(substantiveTopic.trim());

        if (isGeneric) {
          // Pure redundant duplicate! Merge completion/flags into the earlier reading
          const existingIdx = result.findIndex(ex => {
            const exIsPureMod = Boolean(
              (ex as any).moduleNumber &&
              ((ex as any).weekNumber === null || (ex as any).weekNumber === undefined || (ex as any).weekId === 'none' || (ex as any).weekNumber === 0)
            );
            const exWeek = exIsPureMod ? 0 : (extractReadingWeekNumber(ex) ?? 0);
            const exMod = (typeof (ex as any).moduleNumber === 'number' && (ex as any).moduleNumber > 0)
              ? (ex as any).moduleNumber
              : 0;
            const exScheduleKey = exMod > 0 && (!exWeek || exWeek === 0) ? `m${exMod}` : (exWeek > 0 ? `w${exWeek}` : `w0`);
            if (exScheduleKey !== scheduleKey) return false;
            if (modNum > 0 && exMod > 0 && modNum !== exMod) return false;
            if ((modNum > 0 && !weekNum && exWeek > 0) || (exMod > 0 && !exWeek && weekNum > 0)) return false;
            const exChs = parseChapterNumbers(ex.chapterText || ex.title);
            return chapters.some(c => exChs.includes(c));
          });
          if (existingIdx >= 0) {
            const existing = result[existingIdx];
            result[existingIdx] = {
              ...existing,
              isCompleted: Boolean(existing.isCompleted || r.isCompleted),
              isDeleted: Boolean(existing.isDeleted && r.isDeleted),
              videoUrl: existing.videoUrl || r.videoUrl
            };
          }
          continue; // Skip adding this redundant duplicate card!
        }
      } else if (remainingChapters.length < chapters.length) {
        // Some chapters were already seen, prune them!
        // "once a chapter is repeated you don't need to say it again so if it says one, you don't need to say in the next one chapter one and seven"
        const newChText = formatChapterList(remainingChapters);
        r.chapterText = newChText;
        r.title = formatDisplayTitleWithChapter(
          r,
          newChText,
          r.resourceTitle,
          matchedCourse?.courseName,
          r.authorName
        );
        for (const c of remainingChapters) {
          seenChapters.add(c);
        }
        seenChaptersPerBookWeek.set(bookWeekKey, seenChapters);
      } else {
        for (const c of chapters) {
          seenChapters.add(c);
        }
        seenChaptersPerBookWeek.set(bookWeekKey, seenChapters);
      }
    }

    const canonicalCh = cleanChapterFromRaw(r.chapterText || r.title);
    const displayTitle = formatDisplayTitleWithChapter(
      r.title,
      r.chapterText,
      r.resourceTitle,
      matchedCourse?.courseName,
      r.authorName
    );
    const normTitle = displayTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dateStr = r.dueDate ? (typeof r.dueDate === 'string' ? r.dueDate : (r.dueDate instanceof Date ? r.dueDate.toISOString() : String(r.dueDate))) : '';

    // Primary intra-week/module key (same course, same week/module, same book, and same chapter OR same title)
    const intraWeekKey = canonicalCh
      ? `intra_${courseKey}_${scheduleKey}_bk_${bookKey}_ch_${canonicalCh.toLowerCase().replace(/[^a-z0-9]/g, '')}`
      : `intra_${courseKey}_${scheduleKey}_bk_${bookKey}_t_${normTitle}`;

    // Inter-week clone key: same course, same book, same chapter, and identical non-empty due date (only if both are week-based, not module-based)
    const isModuleOnlyItem = !weekNum && modNum > 0;
    const interWeekCloneKey = (!isModuleOnlyItem && canonicalCh && dateStr)
      ? `inter_${courseKey}_bk_${bookKey}_ch_${canonicalCh.toLowerCase().replace(/[^a-z0-9]/g, '')}_d_${dateStr}`
      : null;

    let existingIndex = seenKeys.get(intraWeekKey) ?? (interWeekCloneKey ? seenKeys.get(interWeekCloneKey) : undefined);

    if (existingIndex === undefined && canonicalCh) {
      const candIdx = result.findIndex(existingR => {
        const exIsPureMod = Boolean(
          (existingR as any).moduleNumber &&
          ((existingR as any).weekNumber === null || (existingR as any).weekNumber === undefined || (existingR as any).weekId === 'none' || (existingR as any).weekNumber === 0)
        );
        const exWeek = exIsPureMod ? 0 : (extractReadingWeekNumber(existingR) ?? 0);
        const exMod = (typeof (existingR as any).moduleNumber === 'number' && (existingR as any).moduleNumber > 0)
          ? (existingR as any).moduleNumber
          : 0;
        const exScheduleKey = exMod > 0 && (!exWeek || exWeek === 0) ? `m${exMod}` : (exWeek > 0 ? `w${exWeek}` : `w0`);
        if (exScheduleKey !== scheduleKey) return false;
        if (modNum > 0 && exMod > 0 && modNum !== exMod) return false;
        if ((modNum > 0 && !weekNum && exWeek > 0) || (exMod > 0 && !exWeek && weekNum > 0)) return false;
        const exCh = cleanChapterFromRaw(existingR.chapterText || existingR.title);
        if (!exCh || exCh.toLowerCase().replace(/[^a-z0-9]/g, '') !== canonicalCh.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          return false;
        }
        const exAuthor = (existingR.authorName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const exRes = (existingR.resourceTitle || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        // If authors are different, NEVER merge
        if (authorKey && exAuthor && authorKey !== exAuthor) return false;
        // If resources are both present and completely different without substring overlap, DO NOT merge
        if (resKey && exRes && resKey !== exRes && !resKey.includes(exRes) && !exRes.includes(resKey)) return false;
        // If authors match, or resources overlap
        if (authorKey && exAuthor && authorKey === exAuthor) return true;
        if (resKey && exRes && (resKey.includes(exRes) || exRes.includes(resKey))) return true;
        return false;
      });
      if (candIdx >= 0) {
        existingIndex = candIdx;
      }
    }

    if (existingIndex !== undefined) {
      // Merge with existing item
      const existing = result[existingIndex];

      // Prefer the richer title
      const existingSubstantive = stripChapterMentions(distillSmartReadingTitle(existing.title));
      const newSubstantive = stripChapterMentions(distillSmartReadingTitle(r.title));

      const isNewRicher =
        newSubstantive.length > existingSubstantive.length &&
        !/^(overview|reading|readings|textbook|chapter\s*\d+)$/i.test(newSubstantive.trim());

      const mergedMediaType = (r.mediaType && r.mediaType !== 'textbook') ? r.mediaType : existing.mediaType;
      const mergedMediaTypeRaw = (r.mediaTypeRaw && r.mediaTypeRaw !== 'textbook') ? r.mediaTypeRaw : (existing.mediaTypeRaw || r.mediaTypeRaw);

      const exIsPureMod = Boolean(
        existing.moduleNumber &&
        (existing.weekNumber === null || existing.weekNumber === undefined || existing.weekId === 'none' || existing.weekNumber === 0)
      );
      const isPureModMerge = isPureModule || exIsPureMod;

      const merged: T = {
        ...existing,
        title: isNewRicher ? r.title : existing.title,
        authorName: existing.authorName || r.authorName,
        resourceTitle: existing.resourceTitle || r.resourceTitle,
        chapterText: canonicalCh || existing.chapterText || r.chapterText,
        pagesText: existing.pagesText || r.pagesText,
        moduleNumber: existing.moduleNumber ?? (r as any).moduleNumber ?? null,
        moduleMention: existing.moduleMention || (r as any).moduleMention || null,
        weekNumber: isPureModMerge ? null : (existing.weekNumber ?? (r as any).weekNumber ?? null),
        weekId: isPureModMerge ? 'none' : (existing.weekId || (r as any).weekId || null),
        dueDate: existing.dueDate || r.dueDate || null,
        dateRangeStr: existing.dateRangeStr || r.dateRangeStr || null,
        relevantTopics: existing.relevantTopics || r.relevantTopics || null,
        mediaType: mergedMediaType,
        mediaTypeRaw: mergedMediaTypeRaw,
        videoUrl: existing.videoUrl || r.videoUrl,
        isCompleted: Boolean(existing.isCompleted || r.isCompleted),
        // If one is not deleted, keep it active
        isDeleted: Boolean(existing.isDeleted && r.isDeleted)
      };

      result[existingIndex] = merged;
    } else {
      const idx = result.length;
      result.push({ ...r });
      seenKeys.set(intraWeekKey, idx);
      if (interWeekCloneKey) {
        seenKeys.set(interWeekCloneKey, idx);
      }
    }
  }

  return result;
}

/**
 * Extracts just the first few words of a document name/title (e.g. 3-4 words),
 * stripping file extensions and file-name artifacts so long raw document names
 * are presented cleanly.
 */
export function formatShortDocumentTitle(rawTitle?: string | null, maxWords: number = 4): string {
  if (!rawTitle) return 'Document';
  // Strip file extension (.pdf, .docx, etc.)
  let clean = rawTitle.replace(/\.[a-zA-Z0-9]{2,5}$/, '');
  // Replace underscores, dashes, and extra separators with spaces
  clean = clean.replace(/[-_]+/g, ' ');
  // Clean up bracketed artifacts e.g. [PDF] or (1)
  clean = clean.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ');
  // Split into words
  const words = clean.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(' ');
  }
  return words.slice(0, maxWords).join(' ');
}

/**
 * Extracts an explicit week number from free text (e.g. "Week 3", "W-3", "Module 4").
 */
export function extractWeekFromText(text?: string | null): number | null {
  if (!text) return null;
  const m = text.match(/\b(?:week|wk|w|module|mod|unit|session)\s*[:\-–#.]*\s*(\d{1,2})\b/i);
  if (m && m[1]) {
    const num = parseInt(m[1], 10);
    if (num >= 1 && num <= 52) return num;
  }
  return null;
}

/**
 * Derives and organizes the intended week number for a reading item.
 * Ensures the week is never auto-off (always >= 1).
 */
export function deriveWeekForReading(
  reading: Reading,
  course?: Course,
  earliestDate?: Date | null,
  allReadingsInCourse?: Reading[]
): number | null {
  // Pure curriculum module reading: preserve module status and NEVER force a week!
  if (
    (reading.moduleNumber && reading.moduleNumber > 0) &&
    (!reading.weekNumber || reading.weekNumber <= 0 || reading.weekId === 'none')
  ) {
    return null;
  }

  // 1. Existing positive weekNumber
  if (typeof reading.weekNumber === 'number' && reading.weekNumber > 0) {
    return reading.weekNumber;
  }

  // 2. weekId containing a positive integer (e.g. "w-3", "week-4")
  if (reading.weekId && reading.weekId !== 'none') {
    const m = reading.weekId.match(/\d+/);
    if (m) {
      const num = parseInt(m[0], 10);
      if (num > 0) return num;
    }
  }

  // 3. Explicit week or module mention in metadata fields
  const fromTopics = extractWeekFromText(reading.relevantTopics);
  if (fromTopics) return fromTopics;

  const fromDateRange = extractWeekFromText(reading.dateRangeStr);
  if (fromDateRange) return fromDateRange;

  const fromSummary = extractWeekFromText(reading.summaryText);
  if (fromSummary) return fromSummary;

  const fromTitle = extractWeekFromText(reading.title);
  if (fromTitle) return fromTitle;

  const fromChapter = extractWeekFromText(reading.chapterText);
  if (fromChapter) return fromChapter;

  // 4. Due date relative to earliest course date or calendar term
  if (reading.dueDate) {
    const d = parseSafeDate(reading.dueDate);
    if (d) {
      if (earliestDate && d.getTime() >= earliestDate.getTime()) {
        const diffWeeks = Math.floor((d.getTime() - earliestDate.getTime()) / (7 * 86400000));
        return Math.max(1, Math.min(course?.termWeeks || 16, diffWeeks + 1));
      }
      const derived = weekNumberForDate(d);
      if (derived >= 1 && derived <= (course?.termWeeks || 16)) {
        return derived;
      }
    }
  }

  // 5. Chapter heuristic (e.g. Chapter 3 -> Week 3)
  const canonicalCh = cleanChapterFromRaw(reading.chapterText || reading.title);
  if (canonicalCh) {
    const chMatch = canonicalCh.match(/^Chapter\s+(\d{1,2})$/i);
    if (chMatch && chMatch[1]) {
      const chNum = parseInt(chMatch[1], 10);
      if (chNum >= 1 && chNum <= (course?.termWeeks || 16)) {
        return chNum;
      }
    }
  }

  // 6. Sequential distribution among unassigned items in course
  if (allReadingsInCourse && allReadingsInCourse.length > 0) {
    const unassigned = allReadingsInCourse.filter(
      r => (!r.weekNumber || r.weekNumber <= 0) && (!r.weekId || !/\d+/.test(r.weekId))
    );
    const idx = unassigned.findIndex(r => r.id === reading.id);
    if (idx >= 0) {
      const termLen = course?.termWeeks || 10;
      return Math.max(1, Math.min(termLen, Math.floor(idx / 2) + 1));
    }
  }

  return 1;
}

/**
 * Derives and organizes the intended week number for an assignment.
 * Ensures the week is never auto-off (always >= 1).
 */
export function deriveWeekForAssignment(
  assignment: Assignment,
  course?: Course,
  earliestDate?: Date | null,
  allAssignmentsInCourse?: Assignment[]
): number {
  // 0. Continuous / semester-long items never belong to a single calendar week
  const titleLower = (assignment.title || '').toLowerCase();
  const notesLower = (assignment.noteText || '').toLowerCase();
  const instrLower = (assignment.fullInstructions || '').toLowerCase();
  const isContinuous =
    titleLower.includes('collaboration') ||
    titleLower.includes('participation') ||
    titleLower.includes('attendance') ||
    notesLower.includes('course of the semester') ||
    notesLower.includes('throughout the course') ||
    notesLower.includes('continuous') ||
    instrLower.includes('over the course of the semester') ||
    instrLower.includes('throughout the course');

  if (isContinuous) {
    return 0;
  }

  // 1. Existing positive weekNumber
  if (typeof assignment.weekNumber === 'number' && assignment.weekNumber > 0) {
    return assignment.weekNumber;
  }

  // Helper to check if a week is Reading Week / Break Week / No Classes
  const isBreakWeek = (wNum: number): boolean => {
    if (!course?.weeks) return false;
    const wk = course.weeks.find(w => w.weekNumber === wNum);
    if (!wk) return false;
    const t = (wk.theme || '').toLowerCase();
    return t.includes('reading week') || t.includes('no class') || t.includes('break') || t.includes('flex');
  };

  // 2. Explicit module or week mention in assignment fields
  const fromModule = extractWeekFromText(assignment.moduleMention);
  if (fromModule && !isBreakWeek(fromModule)) return fromModule;

  const fromTitle = extractWeekFromText(assignment.title);
  if (fromTitle && !isBreakWeek(fromTitle)) return fromTitle;

  const fromTopics = extractWeekFromText(assignment.relevantTopics);
  if (fromTopics && !isBreakWeek(fromTopics)) return fromTopics;

  const fromNotes = extractWeekFromText(assignment.noteText);
  if (fromNotes && !isBreakWeek(fromNotes)) return fromNotes;

  const fromInstructions = extractWeekFromText(assignment.fullInstructions);
  if (fromInstructions && !isBreakWeek(fromInstructions)) return fromInstructions;

  // 3. Due date relative to course schedule or term
  if (assignment.dueDate) {
    const d = parseSafeDate(assignment.dueDate);
    if (d) {
      if (earliestDate && d.getTime() >= earliestDate.getTime()) {
        const diffWeeks = Math.floor((d.getTime() - earliestDate.getTime()) / (7 * 86400000));
        const candidate = Math.max(1, Math.min(course?.termWeeks || 16, diffWeeks + 1));
        if (!isBreakWeek(candidate)) return candidate;
      }
      const derived = weekNumberForDate(d);
      if (derived >= 1 && derived <= (course?.termWeeks || 16) && !isBreakWeek(derived)) {
        return derived;
      }
    }
  }

  // 4. Milestone title keywords
  const termLen = course?.termWeeks || 10;
  if (titleLower.includes('midterm')) {
    const candidate = Math.max(1, Math.round(termLen / 2));
    return isBreakWeek(candidate) ? Math.max(1, candidate - 1) : candidate;
  }
  if (titleLower.includes('final') || titleLower.includes('capstone') || titleLower.includes('defense')) {
    return termLen;
  }
  if (titleLower.includes('presentation')) {
    const candidate = Math.max(1, termLen - 1);
    return isBreakWeek(candidate) ? Math.max(1, candidate - 1) : candidate;
  }

  // 5. Sequential spacing across course term (skipping break/reading weeks)
  if (allAssignmentsInCourse && allAssignmentsInCourse.length > 0) {
    const unassigned = allAssignmentsInCourse.filter(
      a => (!a.weekNumber || a.weekNumber <= 0) &&
        !((a.title || '').toLowerCase().includes('collaboration') ||
          (a.title || '').toLowerCase().includes('participation') ||
          (a.title || '').toLowerCase().includes('attendance'))
    );
    const idx = unassigned.findIndex(a => a.id === assignment.id);
    if (idx >= 0) {
      const activeWeeks = Array.from({ length: termLen }, (_, i) => i + 1).filter(w => !isBreakWeek(w));
      if (activeWeeks.length > 0) {
        const step = activeWeeks.length / (unassigned.length + 1);
        const activeIdx = Math.max(0, Math.min(activeWeeks.length - 1, Math.floor((idx + 1) * step) - 1));
        return activeWeeks[activeIdx];
      }
    }
  }

  return 1;
}

/**
 * Organizes and heals weeks across all readings and assignments:
 * - Turns ON weeks that were erroneously auto-turned off (weekNumber: 0).
 * - Preserves already-active weeks.
 * - Groups and distributes readings and assignments cleanly by week.
 */
export function healItemWeeks(
  courses: Course[],
  readings: Reading[],
  assignments: Assignment[]
): { readings: Reading[]; assignments: Assignment[] } {
  // Build fast course lookups
  const courseByCode = new Map<string, Course>();
  for (const c of courses) {
    if (c.courseCode) courseByCode.set(c.courseCode.toLowerCase().trim(), c);
    if (c.courseName) courseByCode.set(c.courseName.toLowerCase().trim(), c);
    if (c.id) courseByCode.set(c.id.toLowerCase().trim(), c);
  }

  // Find earliest dates per course group
  const earliestDateByCourse = new Map<string, Date>();
  for (const r of readings) {
    const code = (r.courseCode || 'default').toLowerCase().trim();
    const d = parseSafeDate(r.dueDate);
    if (d) {
      const prev = earliestDateByCourse.get(code);
      if (!prev || d.getTime() < prev.getTime()) earliestDateByCourse.set(code, d);
    }
  }
  for (const a of assignments) {
    const code = (a.courseCode || 'default').toLowerCase().trim();
    const d = parseSafeDate(a.dueDate);
    if (d) {
      const prev = earliestDateByCourse.get(code);
      if (!prev || d.getTime() < prev.getTime()) earliestDateByCourse.set(code, d);
    }
  }

  const healedReadings = readings.map(r => {
    // Dedicated module reading: preserve module status and do not assign week
    if (
      (r.moduleNumber && r.moduleNumber > 0) &&
      (!r.weekNumber || r.weekNumber <= 0 || r.weekId === 'none')
    ) {
      return {
        ...r,
        weekNumber: null,
        weekId: 'none'
      };
    }
    const code = (r.courseCode || 'default').toLowerCase().trim();
    const course = courseByCode.get(code);
    const earliestDate = earliestDateByCourse.get(code);
    const courseReadings = readings.filter(x => (x.courseCode || 'default').toLowerCase().trim() === code);
    const w = deriveWeekForReading(r, course, earliestDate, courseReadings);
    return {
      ...r,
      weekNumber: w ?? null,
      weekId: w ? `w-${w}` : 'none'
    };
  });

  const healedAssignments = assignments.map(a => {
    const code = (a.courseCode || 'default').toLowerCase().trim();
    const course = courseByCode.get(code);
    const earliestDate = earliestDateByCourse.get(code);
    const courseAssignments = assignments.filter(x => (x.courseCode || 'default').toLowerCase().trim() === code);
    const w = deriveWeekForAssignment(a, course, earliestDate, courseAssignments);
    return {
      ...a,
      weekNumber: w
    };
  });

  return { readings: healedReadings, assignments: healedAssignments };
}

/**
 * Smartly discovers genuine academic topics for a reading without duplicating
 * chapters, pages, week indicators, or repeating the reading title.
 * If no genuine topic exists, returns an empty array [].
 */
export function discoverReadingTopics(reading: Reading, courses: Course[] = []): string[] {
  const discovered: string[] = [];

  const isInvalidTopic = (raw: string): boolean => {
    if (!raw) return true;
    const str = raw.trim();
    if (str.length < 2) return true;

    // Reject week/module/unit indicators: e.g. "Week 1", "Wk 4", "Module 2", "Unit 3"
    if (/^(?:week|wk|module|mod|unit|lecture|session)\s*\d*$/i.test(str)) return true;

    // Reject chapter references: e.g. "Chapter 4", "Ch. 12", "Chap 3", "Section 2.1"
    if (/^(?:chapters?|chaps?\.?|chs?\.?|ch\.?|sections?|sec\.?)\s*\d+/i.test(str)) return true;

    // Reject page references: e.g. "pp. 12-45", "p. 30", "pages 10-20"
    if (/^(?:pp?\.?|pages?)\s*\d+/i.test(str)) return true;

    // Reject generic placeholder labels
    const lower = str.toLowerCase();
    const genericPlaceholders = [
      'reading', 'readings', 'assigned reading', 'assigned readings', 'core materials',
      'required reading', 'required readings', 'textbook', 'article', 'articles',
      'handout', 'handouts', 'lecture notes', 'notes', 'slides', 'tbd', 'none', 'n/a',
      'no reading', 'no readings', 'details', 'general'
    ];
    if (genericPlaceholders.includes(lower)) return true;

    // Reject if it matches or is contained in reading's own chapterText or pagesText
    if (reading.chapterText) {
      const cleanCh = cleanChapterFromRaw(reading.chapterText)?.toLowerCase().trim();
      if (cleanCh && (lower === cleanCh || lower.includes(cleanCh) || cleanCh.includes(lower))) return true;
    }
    if (reading.pagesText) {
      const cleanPg = reading.pagesText.toLowerCase().trim();
      if (cleanPg && (lower === cleanPg || lower.includes(cleanPg))) return true;
    }

    // Reject if it equals course code
    if (reading.courseCode && lower === reading.courseCode.toLowerCase().trim()) return true;

    return false;
  };

  // 1. First inspect candidates in relevantTopics
  if (reading.relevantTopics && reading.relevantTopics.trim().length > 0) {
    const rawTokens = reading.relevantTopics.split(/[,;\n]/).map(t => t.trim());
    for (const token of rawTokens) {
      if (!isInvalidTopic(token) && !discovered.some(d => d.toLowerCase() === token.toLowerCase())) {
        discovered.push(token);
      }
    }
  }

  // 2. If no valid topics discovered yet, attempt extraction from title if it contains a chapter: topic structure
  if (discovered.length === 0 && reading.title) {
    const chapterPrefixMatch = reading.title.match(/^(?:chapters?|chaps?\.?|chs?\.?|ch\.?)\s*\d+[:.\-–—]\s*(.+)$/i);
    if (chapterPrefixMatch && chapterPrefixMatch[1]) {
      const candidate = chapterPrefixMatch[1].trim();
      if (!isInvalidTopic(candidate)) {
        discovered.push(candidate);
      }
    }
  }

  // 3. If still empty, check if matched course syllabus has a theme/topic for this week
  if (discovered.length === 0 && reading.weekNumber && reading.weekNumber > 0 && courses.length > 0) {
    const matchedCourse = courses.find(
      c => (c.courseCode || c.courseName).toLowerCase() === (reading.courseCode || '').toLowerCase()
    );
    if (matchedCourse && Array.isArray((matchedCourse as any).syllabusData?.weeks)) {
      const weekObj = (matchedCourse as any).syllabusData.weeks.find(
        (w: any) => w.weekNumber === reading.weekNumber
      );
      if (weekObj?.theme && typeof weekObj.theme === 'string') {
        const cleanTheme = weekObj.theme.replace(/^Week\s*\d+[:.\s–-]+/i, '').trim();
        if (!isInvalidTopic(cleanTheme)) {
          discovered.push(cleanTheme);
        }
      }
    }
  }

  // 4. Return genuine topics only (or empty array if none)
  return discovered;
}

/**
 * Formats a suggested reading date into a clean pill label, e.g. "Suggested: Sep 16"
 * or "Suggested: Sep 14 – 20". Returns null if no valid date.
 */
export function formatSuggestedDatePill(dateInput?: string | Date | null, dateRangeStr?: string | null): string | null {
  if (dateInput) {
    const d = parseSafeDate(dateInput);
    if (d) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const m = monthNames[d.getMonth()];
      const day = d.getDate();
      return `Suggested: ${m} ${day}`;
    }
  }

  if (dateRangeStr && dateRangeStr.trim().length > 0) {
    return `Suggested: ${dateRangeStr.trim()}`;
  }

  return null;
}

/**
 * Sanitizes extracted rubric criterion titles by removing leaked table headers,
 * letter-spaced table text (e.g. "G r a d e  P o i n t s  %  o f  G r a d e"),
 * and broken line artifacts.
 */
export function cleanRubricCriterionName(rawName?: string | null): string {
  if (!rawName) return '';
  let name = rawName.trim();

  // 1. Strip letter-spaced table text like "G r a d e   P o i n t s   %   o f   G r a d e"
  name = name.replace(/\b(?:g\s+r\s+a\s+d\s+e\s+p\s+o\s+i\s+n\s+t\s+s\s+%\s+o\s+f\s+g\s+r\s+a\s+d\s+e)\b/gi, ' ');
  name = name.replace(/g\s*r\s*a\s*d\s*e\s*p\s*o\s*i\s*n\s*t\s*s\s*%\s*o\s*f\s*g\s*r\s*a\s*d\s*e/gi, ' ');
  name = name.replace(/g\s*r\s*a\s*d\s*e\s*p\s*o\s*i\s*n\s*t\s*s/gi, ' ');
  name = name.replace(/%\s*o\s*f\s*g\s*r\s*a\s*d\s*e/gi, ' ');
  name = name.replace(/c\s*r\s*i\s*t\s*e\s*r\s*i\s*a/gi, ' ');
  name = name.replace(/g\s*r\s*a\s*d\s*i\s*n\s*g/gi, ' ');

  // 2. Strip standard table header phrases
  name = name.replace(/\b(?:Grading\s+Criteria|Criteria\s+Grade\s+Points|Grade\s+Points|Criteria|%\s+of\s+Grade|%\s+of\s+Final\s+Grade)\b/gi, ' ');

  // 3. Strip orphaned "Concepts" if at the very beginning (from wrapped "Concepts Grade Points...")
  name = name.replace(/^\s*Concepts\s+/i, '');

  // 4. Strip known leaked assignment title prefixes/suffixes
  name = name.replace(/\b(?:Group\s+Facilitation\s+Presentation\/Project|Article\s+Analysis\s+Assignment|Peer-Review\s+Group\s+Report|Group\s+Therapy\s+Reflection\s+Paper|Research\s+Paper|Unique\s+Topics\s+in\s+Grief\s+Group\s+Presentation|Personal\s+Grief\s+Reflection\s+Assignment|Group\s+Sexuality\s+Research\s+Paper|Professionalism,\s*Collaboration,\s*and\s*Engagement)\b/gi, ' ');

  // 5. Clean leading and trailing punctuation, numbers, bullets, colons, dashes, pipes (preserve valid parens)
  name = name.replace(/^[\s•\-\*▪●:–—\d\.\)\(|~_§·]+|[\s•\-\*▪●:–—\d\.|~_§·]+$/g, '').trim();
  if (name.endsWith(')') && !name.includes('(')) {
    name = name.slice(0, -1).trim();
  }
  name = name.replace(/\s+/g, ' ').trim();

  // 6. If an unclosed paren exists, either close it or simplify
  if (/\bdemonstration\s*(?:\([^)]*)?$/i.test(name)) {
    name = 'Demonstration & Practice';
  } else if (/^cultural\s+competence(?:\s*\(.*)?$/i.test(name)) {
    name = 'Cultural Competence';
  } else if (name.includes('(') && !name.includes(')')) {
    name = `${name})`;
  }

  // 7. Repair common split / abbreviated phrases
  if (/^analysis\s+and\s+use\s+of\s+course(?:\s+concepts?)?$/i.test(name)) {
    name = 'Analysis and use of Course Concepts';
  }
  if (/^case\s+conceptualization\s*\/\s*treatment(?:\s+plan)?$/i.test(name)) {
    name = 'Case Conceptualization / Treatment Plan';
  }

  // 8. Length & sentence safeguard: criterion titles in rubrics are concise (e.g. 2-6 words)
  // If an entire sentence or instruction paragraph leaked into the name, distill it
  if (name.length > 55) {
    const sepMatch = name.match(/^([^:–—\n.]{3,45})[:–—\n.]/);
    if (sepMatch) {
      name = sepMatch[1].trim();
    } else {
      const words = name.split(/\s+/);
      if (words.length > 5) {
        name = words.slice(0, 5).join(' ');
      }
    }
  }

  name = name.replace(/^[\s•\-\*▪●:–—\d\.\)\(|~_§·]+|[\s•\-\*▪●:–—\d\.|~_§·]+$/g, '').trim();
  if (name.endsWith(')') && !name.includes('(')) {
    name = name.slice(0, -1).trim();
  }
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
}

/**
 * Validates whether a string is a genuine assignment title or an invalid instructional sentence / outcome fragment.
 * Prevents prompt lines like "examine and discuss the following aspects of the study:" or loose clinical terms like "treatment plan".
 */
export function isInvalidAssignmentTitle(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return true;
  const t = raw.trim();
  if (t.length < 3) return true;
  if (!/[a-zA-Z]{3,}/.test(t)) return true; // Purely numeric like "31"

  const lower = t.toLowerCase();

  // Purely boilerplate or metadata headers
  if (
    lower === 'item title' ||
    lower === 'assignment' ||
    lower === 'assignments' ||
    lower === 'deliverable' ||
    lower === 'deliverables' ||
    lower === 'reading' ||
    lower === 'readings' ||
    lower === 'textbook' ||
    lower === 'textbooks' ||
    lower === 'article' ||
    lower === 'articles' ||
    lower === 'video' ||
    lower === 'podcast' ||
    lower === 'tutorial' ||
    lower === 'other' ||
    lower === 'in_class' ||
    lower === 'in-class' ||
    lower === 'in class' ||
    lower === 'weight' ||
    lower === 'points' ||
    lower === 'points possible' ||
    lower === 'total points' ||
    lower === 'total points possible' ||
    lower === 'due date' ||
    lower === 'date' ||
    lower === 'sub-type' ||
    lower === 'subtype' ||
    lower === 'category' ||
    lower === 'title' ||
    lower === 'week' ||
    lower === 'module' ||
    lower === 'unit' ||
    lower === 'session' ||
    lower === 'n/a' ||
    lower === 'none' ||
    lower === 'handout' ||
    lower === 'lecture' ||
    lower === 'slides' ||
    lower === 'deck' ||
    lower === 'paper' ||
    lower === 'essay' ||
    lower === 'presentation' ||
    lower === 'grading scale' ||
    lower === 'grade scale' ||
    lower === 'letter grade' ||
    lower === 'letter grades' ||
    lower === 'gpa' ||
    lower === 'pass' ||
    lower === 'fail' ||
    lower === 'pass/fail' ||
    lower === 'satisfactory' ||
    lower === 'unsatisfactory' ||
    lower === 'honors' ||
    lower === 'credit' ||
    lower === 'no credit' ||
    lower === 'credit / no credit' ||
    lower === 'grade a' ||
    lower === 'grade b' ||
    lower === 'grade c' ||
    lower === 'grade d' ||
    lower === 'grade f' ||
    lower === 'late penalty' ||
    lower === 'late submission penalty' ||
    lower === 'penalty' ||
    lower === 'description weight' ||
    lower === 'description / weight' ||
    lower === 'description & weight' ||
    lower === 'description and weight' ||
    lower === 'description' ||
    lower === 'descriptions' ||
    lower === 'assessment item' ||
    lower === 'assessment items' ||
    lower === 'assessment title' ||
    lower === 'assessment titles' ||
    lower === 'assessment structure' ||
    lower === 'grade breakdown' ||
    lower === 'target format' ||
    lower === 'due module' ||
    lower === 'deliverable format' ||
    lower.startsWith('description weight') ||
    lower.startsWith('assessment item') ||
    lower.startsWith('assessment title') ||
    lower.startsWith('assessment structure') ||
    lower.startsWith('assignment description weight') ||
    (lower.includes('assignment description') && lower.includes('weight')) ||
    (lower.includes('description') && lower.includes('weight') && lower.includes('deliverable')) ||
    /^(?:assignment\s+|course\s+|assessment\s+|task\s+)?description(?:\s*(?:&|\/|and|-|–|—)?\s*weight)?$/i.test(lower) ||
    /^(?:weight|percentage)(?:\s*(?:&|\/|and|-|–|—)?\s*description)?$/i.test(lower) ||
    /^(?:assessment|evaluation|deliverable)\s+(?:title|name|item)\s+(?:weight|percentage)?/i.test(lower) ||
    /^(?:assessment|evaluation|grading|grade)\s+(?:structure|summary|breakdown|matrix|overview|schedule|rubric)/i.test(lower) ||
    /^(?:description|details|overview|format|target\s+due|target\s+format|deliverable\s+format)$/i.test(lower) ||
    /^description\s+weight\b/i.test(lower) ||
    /^(?:modules?|mod|weeks?|wk|unit|session)\s*\d+$/i.test(lower) ||
    lower.includes('total 100%') ||
    lower.includes('overview of required') ||
    lower.includes('course assignment details') ||
    lower.includes('course policies') ||
    lower.includes('late assignments') ||
    lower.includes('grading criteria') ||
    lower.includes('grade points') ||
    lower.includes('points possible') ||
    lower.includes('of final grade') ||
    lower.includes('3% of students') ||
    lower.includes('if submitted') ||
    lower.includes('points deducted') ||
    lower.includes('deducted if') ||
    lower.includes('hours after') ||
    lower.includes('days after') ||
    lower.includes('coursepal parser') ||
    lower.includes('mapping guide') ||
    lower.includes('maps with weight') ||
    lower.includes('maps to assignment') ||
    lower.includes('when parsing this syllabus') ||
    lower.includes('total course assessment') ||
    lower.includes('decimal grade scale') ||
    lower.includes('detailed assignment requirements') ||
    lower.includes('end of term cumulative') ||
    /^total\b/i.test(lower)
  ) {
    return true;
  }

  // Reject pure reading titles that contain reading keywords but lack any assignment/deliverable keyword
  const hasReadingKeyword = /\b(?:chapter|ch\.|textbook|readings?|required reading)\b/i.test(lower);
  const hasDeliverableKeyword = /\b(?:paper|report|exam|examination|quiz|midterm|final|project|homework|problem\s+set|lab|presentation|deliverable|brief|essay|critique|discussion\s+board|peer\s+review|case\s+study|assignment)\b/i.test(lower);
  if (hasReadingKeyword && !hasDeliverableKeyword) {
    return true;
  }

  // Imperative instructional prompts and sentence fragments (e.g. "examine and discuss the following aspects of the study:")
  if (
    /^(?:examine\s+and\s+discuss|discuss\s+the\s+following|examine\s+the\s+following|consider\s+the\s+following|analyze\s+the\s+following|review\s+the\s+following|describe\s+the\s+following|identify\s+the\s+following|explore\s+the\s+following|working\s+in\s+groups|students\s+will|students\s+are|in\s+small\s+groups|based\s+on\s+a\s+set\s+of|apply\s+theoretical\s+models|develop\s+and\s+implement|critically\s+examine|as\s+a\s+group)\b/i.test(lower) ||
    /(?:the following|aspects of the study|questions below|case study by)[:.]?$/i.test(lower)
  ) {
    return true;
  }

  // Learning outcome & course objective headers (e.g. 2.3 Application: ...)
  if (/^(?:\d+\.\d+|PO\s*\d+|PLO\s*\d+|LO\s*\d+)\b/i.test(t)) {
    return true;
  }

  // Isolated phrases that are clinical objectives/outcomes, in-class discussions, or calendar notes rather than assignment deliverables
  if (
    lower === 'treatment plan' ||
    lower === 'treatment plans' ||
    lower === 'treatment planning' ||
    lower === 'counselling theory' ||
    lower === 'rubric' ||
    lower === 'grading rubric' ||
    lower === 'overview' ||
    lower === 'grading criteria' ||
    lower === 'course assignment details' ||
    lower === 'in-class activity' ||
    lower === 'in class activity' ||
    lower === 'in-class conceptualization' ||
    lower === 'in class conceptualization' ||
    lower === 'case conceptualization activity' ||
    lower === 'family map paper' ||
    lower === 'class discussion' ||
    lower === 'group discussion' ||
    lower === 'discussion prompt' ||
    lower === 'weekly check-in' ||
    lower === 'check-in' ||
    lower === 'reading assignment' ||
    lower === 'reading due' ||
    lower === 'readings due' ||
    lower === 'textbook reading' ||
    lower === 'chapter reading' ||
    lower === 'tuition' ||
    lower === 'tuition due' ||
    lower === 'registration' ||
    lower === 'university holiday' ||
    lower === 'reading week' ||
    lower === 'spring break' ||
    lower === 'fall break' ||
    lower === 'no class' ||
    lower === 'reading day' ||
    lower === 'holiday' ||
    lower === 'prepare for class' ||
    lower.startsWith('--- page') ||
    lower.startsWith('page ')
  ) {
    return true;
  }

  // Purely dates or points
  if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(t)) return true;
  if (/^\d{1,4}\s*(?:pts|points|pt|%)\b/i.test(t)) return true;

  // Instructional sentences starting with action verbs
  const instructionalStarts = [
    'examine and discuss',
    'students will complete',
    'students are required',
    'please submit',
    'submit your',
    'refer to the',
    'based on the',
    'using the template',
    'in accordance with',
    'the goal of this',
    'this assignment requires'
  ];
  if (instructionalStarts.some(verb => lower.startsWith(verb))) return true;

  return false;
}

/**
 * Extracts the primary numerical chapter key for natural ascending numeric sorting of readings.
 */
export function getReadingChapterSortKey(r: { title?: string | null; chapterText?: string | null }): number {
  const chNums = parseChapterNumbers(`${r.chapterText || ''} ${r.title || ''}`);
  if (chNums.length > 0) {
    return chNums[0];
  }
  return 999999;
}

/**
 * Splits assignment instructions and descriptions into clean, readable paragraphs.
 * Breaks walls of text at section headers, bullet lists, double-newlines, or every few sentences
 * so it is effortless to read on mobile without giant unbroken blocks of text.
 */
export function splitInstructionsIntoParagraphs(raw?: string | null): string[] {
  if (!raw || !raw.trim()) return [];

  // Clean out carriage returns, pipe delimiters, and normalize
  let text = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\|{2,}/g, '\n\n')
    .trim();

  // 1. Separate explicit section headers into distinct paragraphs
  const sectionKeywords = [
    'Part\\s+\\d+', 'Section\\s+\\d+', 'Step\\s+\\d+', 'Phase\\s+\\d+',
    'Overview', 'Background', 'Description', 'Directions', 'Instructions',
    'Requirements', 'Guidelines', 'Format', 'Formatting', 'Submission',
    'Evaluation', 'Evaluation\\s+Criteria', 'Grading\\s+Criteria',
    'Framing\\s+Questions?', 'Prompt', 'Objectives', 'Purpose', 'Notes?',
    'Target\\s+Format', 'Target\\s+Due', 'Deliverable(?:\\s+Format)?', 'Assessment\\s+Structure'
  ].join('|');

  // Break before explicit section headers
  text = text.replace(
    new RegExp(`(?:^|[.!?:]|\\n)\\s*(${sectionKeywords})\\s*[:\\-–—]`, 'gi'),
    (match, header) => `\n\n${header.trim()}: `
  );

  // 2. Separate bullet lists or numbered items into distinct paragraphs
  text = text.replace(/([.!?:]|[a-zA-Z0-9])\s+(?=[•\-*▪●]\s+)/g, '$1\n\n');
  text = text.replace(/([.!?:]|[a-zA-Z0-9])\s+(?=\d+[\.)]\s+[A-Z])/g, '$1\n\n');

  // 3. Split by existing double/multiple newlines
  const rawBlocks = text.split(/\n\s*\n+/).map(b => b.trim()).filter(b => b.length > 0);
  const result: string[] = [];

  for (const block of rawBlocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let subBlock = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!subBlock) {
        subBlock = line;
      } else {
        const prevEnds = /[.!?:]$/.test(subBlock);
        const isBulletOrHeader =
          /^[•\-*▪●]|\b\d+[\.)]\s+|^(?:part\s+\d|section\s+\d|step\s+\d|phase\s+\d|overview|directions|instructions|requirements|format|submission|framing|evaluation|objectives|target|deliverable)\b/i.test(line);
        if (prevEnds || isBulletOrHeader) {
          result.push(subBlock);
          subBlock = line;
        } else if (subBlock.length > 70 && line.length > 20) {
          result.push(subBlock);
          subBlock = line;
        } else {
          subBlock += ' ' + line;
        }
      }
    }
    if (subBlock) result.push(subBlock);
  }

  // 4. Break paragraphs into clear, digestible sentences/paragraphs
  const finalParas: string[] = [];
  for (const p of result) {
    let cleanP = p.replace(/^[\s|~_§·]+|[\s|~_§·]+$/g, '').trim();
    if (!cleanP) continue;

    // Normalize bullet characters
    if (/^[-*▪●]\s+/.test(cleanP)) {
      cleanP = '• ' + cleanP.replace(/^[-*▪●]\s+/, '');
    }

    // If paragraph starts with an explicit section header followed by content, split header into its own item
    const headerInlineMatch = cleanP.match(
      /^((?:part\s+\d+|section\s+\d+|step\s+\d+|phase\s+\d+|overview|background|description|directions|instructions|requirements|guidelines|format|formatting|submission|evaluation|evaluation\s+criteria|grading\s+criteria|framing\s+questions?|prompt|objectives|purpose|notes?|target\s+format|target\s+due|deliverable(?:\s+format)?)[:\-–—])\s+(.+)$/i
    );
    if (headerInlineMatch) {
      finalParas.push(headerInlineMatch[1].trim());
      cleanP = headerInlineMatch[2].trim();
    }

    // Preserve headers and bullet points without breaking them into sentence chunks
    const isHeaderOnly = /^(?:part\s+\d+|section\s+\d+|step\s+\d+|phase\s+\d+|overview|background|description|directions|instructions|requirements|guidelines|format|formatting|submission|evaluation|evaluation\s+criteria|grading\s+criteria|framing\s+questions?|prompt|objectives|purpose|notes?|target\s+format|target\s+due|deliverable(?:\s+format)?)[:\-–—]?$/i.test(cleanP);
    const isBulletItem = /^[•\-*▪●]|\b\d+[\.)]\s+/.test(cleanP);

    if (isHeaderOnly || isBulletItem || cleanP.length < 120) {
      finalParas.push(cleanP);
      continue;
    }

    const sentences = cleanP.match(/[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g);
    if (sentences && sentences.length > 1) {
      for (const s of sentences) {
        const tr = s.trim();
        if (tr) {
          finalParas.push(tr);
        }
      }
    } else {
      finalParas.push(cleanP);
    }
  }

  return finalParas.filter(p => p.length > 0);
}

/**
 * Sanitizes upload status message to ensure it is simple, friendly, and NEVER contains 'AI'.
 */
export function cleanUploadStatusMessage(msg?: string | null): string {
  if (!msg) return 'Processing syllabus, please wait...';
  let cleaned = msg
    .replace(/\bAI\b/g, '')
    .replace(/\bGemini\b/gi, '')
    .replace(/\bArtificial Intelligence\b/gi, '')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!cleaned) return 'Processing syllabus, please wait...';
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned;
}
