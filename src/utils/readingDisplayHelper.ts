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
  // Strip complete parenthesized year or edition like (2014), (4th ed.)
  s = s.replace(/\s*\(\s*(?:\d{4}|[a-z0-9\s.,]+ed\.?|[a-z\s]+)\s*\)/gi, ' ').trim();
  // If there is an unclosed '(' or unstarted ')'
  const openCount = (s.match(/\(/g) || []).length;
  const closeCount = (s.match(/\)/g) || []).length;
  if (openCount !== closeCount) {
    s = s.replace(/[()]/g, ' ');
  }
  // Strip leading and trailing punctuation brackets/quotes/dashes/bullets
  s = s.replace(/^[:;•·\-–—~`!@#$%^&*()[\]{}<>,?'"\s.]+|[:;•·\-–—~`!@#$%^&*()[\]{}<>,?'"\s.]+$/g, '').trim();
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
  // Check if string is purely digits/connectors e.g. "12", "12 & 13", "1-4", "1, 2"
  const isPureNumbers = /^\d+[\s&,\-–andto\d]*$/i.test(cleaned);
  // Check if string starts with a leading chapter number e.g. "7 Experiential Family Therapy" or "7: Overview"
  const leadingNumMatch = cleaned.match(/^(\d{1,2})(?:[:.\s–-]+|\s+)(?!jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec\b)[A-Za-z]/i);

  if (!hasChapterKeyword && !isPureNumbers && !leadingNumMatch) {
    // Not a chapter! Prevents dates, years, or topic titles from being misidentified as chapters
    return null;
  }

  if (leadingNumMatch && !hasChapterKeyword) {
    return `Chapter ${leadingNumMatch[1]}`;
  }

  // Extract all digit groups with connectors e.g. "12 & 13", "1, 2", "1-4", "12"
  const digitsMatch = cleaned.match(/\b\d+[\s&,\-–andto\d]*\b/i);
  if (digitsMatch) {
    let numPart = digitsMatch[0].trim();
    // Normalize connectors: replace "and" with "&", "-" with en-dash "–"
    numPart = numPart
      .replace(/\band\b/gi, '&')
      .replace(/\s*-\s*/g, '–')
      .replace(/\s*–\s*/g, '–')
      .replace(/\s+/g, ' ');
    // Clean trailing/leading connectors
    numPart = numPart.replace(/^[,&–\s]+|[,&–\s]+$/g, '').trim();

    const isPlural = numPart.includes('&') || numPart.includes('–') || numPart.includes(',') || /\bto\b/i.test(numPart);
    return isPlural ? `Chapters ${numPart}` : `Chapter ${numPart}`;
  }

  // If chapter keyword exists without digits (e.g. "Chapter One", "Chapter IV")
  const keywordMatch = cleaned.match(/\b(?:chapters?)\s+([A-Za-z]+)\b/i);
  if (keywordMatch) {
    const wordPart = keywordMatch[1].trim();
    return `Chapter ${wordPart.charAt(0).toUpperCase() + wordPart.slice(1)}`;
  }

  return null;
}

/**
 * Strips all chapter mentions, numbers, and connecting symbols from text.
 */
export function stripChapterMentions(text: string): string {
  if (!text) return '';
  const healed = repairChapterArtifacts(text);
  // Matches "Chapter 1 · Ch. 1", "Chapters 12 & 13", "Ch. 12", "Ch 1 & 2", etc.
  const chapterPattern = /\s*[:\-–·•]?\s*\b(?:chapters?|chaps?\.?|chs?\.?|ch\.?)\s*(?:\d+[\s,&–\-]*(?:\b(?:and|to)\b\s*)?)*[:\-–·•.]*\s*/gi;
  let stripped = healed.replace(chapterPattern, ' ');
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

export function deduplicateRepeatedPhrases(text: string): string {
  if (!text) return '';
  let str = text.trim();
  const parts = str.split(/\s*[:\-–·]\s*/);
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

  rawTitle = cleanMultilineTitle(rawTitle);

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

    // 3. If substantiveTitle is purely numbers/punctuation, discard it
    if (/^[\d\s:.\-–—]+$/.test(substantiveTitle)) {
      substantiveTitle = '';
    }

    // 4. Strip textbook/generic noise words
    substantiveTitle = substantiveTitle.replace(/\b(?:textbooks?|readings?|required|optional)\b/gi, '').trim();
    substantiveTitle = substantiveTitle.replace(/^[:;•·\-–—\s.]+|[:;•·\-–—\s.]+$/g, '').trim();
  }

  // If author is inside substantive title (e.g. "Gehart" or "Corey" or "Yalom"), strip it
  if (authorName && authorName.trim()) {
    const authParts = authorName.trim().split(/[\s,&]+/).filter(w => w.length >= 3);
    for (const ap of authParts) {
      const reg = new RegExp(`\\b${ap}\\b`, 'gi');
      substantiveTitle = substantiveTitle.replace(reg, '').trim();
    }
    substantiveTitle = substantiveTitle.replace(/^[:;•·\-–—\s.]+|[:;•·\-–—\s.]+$/g, '').trim();
  }

  // Sanitize any dangling brackets/parens/colons in substantive title
  substantiveTitle = sanitizeDanglingPunctuation(substantiveTitle);

  // If substantive title is just a truncated fragment like "overview" or "an overview"
  if (
    substantiveTitle.toLowerCase() === 'overview' ||
    substantiveTitle.toLowerCase() === 'an overview' ||
    substantiveTitle.toLowerCase() === 'introduction'
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
    if (authorName && authorName.trim()) {
      const authParts = authorName.trim().split(/[\s,&]+/).filter(w => w.length >= 3);
      for (const ap of authParts) {
        clean = clean.replace(new RegExp(`\\b${ap}\\b`, 'gi'), '').trim();
      }
    }
    clean = sanitizeDanglingPunctuation(clean);
    const lowerClean = clean.toLowerCase();
    const cleanAlpha = lowerClean.replace(/[^a-z0-9]/g, '');
    const isOverviewStutter =
      lowerClean === 'family therapy: an overview' || lowerClean.endsWith('an overview');
    const isJustCourse =
      normCourse.length > 0 &&
      (cleanAlpha === normCourse || (normCourse.length > 5 && cleanAlpha.startsWith(normCourse)));
    const isJustNumbersOrChapter =
      /^(?:chapters?|chps?\.?|chs?\.?|ch\b\.?)?\s*[\d\s&,\.\-–—]+$/i.test(clean);
    if (
      clean.length > 0 &&
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
  const isBookOrCourseName =
    normSubstantive.length === 0 ||
    (normRes.length > 0 && (normSubstantive === normRes || normRes.includes(normSubstantive) || normSubstantive.includes(normRes))) ||
    (normCourse.length > 0 && (normSubstantive === normCourse || normCourse.includes(normSubstantive) || normSubstantive.includes(normCourse)));

  if (canonicalChapter && isBookOrCourseName) {
    if (cleanResForTitle) {
      return `${cleanResForTitle} · ${canonicalChapter}`;
    }
    return canonicalChapter;
  }

  // If no substantive title remains, or it duplicates the chapter, return Book Title · Chapter or ONLY the chapter
  if (
    !substantiveTitle ||
    (canonicalChapter && substantiveTitle.toLowerCase() === canonicalChapter.toLowerCase()) ||
    substantiveTitle.toLowerCase() === 'reading' ||
    (substantiveTitle.toLowerCase() === 'assigned readings' && canonicalChapter)
  ) {
    if (canonicalChapter && cleanResForTitle) {
      return `${cleanResForTitle} · ${canonicalChapter}`;
    }
    return canonicalChapter || distillSmartReadingTitle(rawTitle);
  }

  // If there is both a chapter and a distinct substantive title, combine them cleanly
  if (canonicalChapter) {
    return `${canonicalChapter} · ${substantiveTitle}`;
  }

  return substantiveTitle;
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

  const parts: string[] = [];

  // 1. Clean Resource / Textbook Title (strip any chapter mentions)
  if (resource && resource.trim()) {
    let cleanRes = sanitizeDanglingPunctuation(stripChapterMentions(deduplicateRepeatedPhrases(resource.trim())));

    // Discard pure digits / colons (e.g. "4: 10" or "3" or "10")
    if (/^[\d\s:.\-–—]+$/.test(cleanRes)) {
      cleanRes = '';
    }

    // Strip author name if contained inside cleanRes (e.g. "overview Gehart 3" -> "overview 3")
    if (author && author.trim()) {
      const authParts = author.trim().split(/[\s,&]+/).filter(w => w.length >= 3);
      for (const ap of authParts) {
        const reg = new RegExp(`\\b${ap}\\b`, 'gi');
        cleanRes = cleanRes.replace(reg, '').trim();
      }
    }

    // Strip stray numbers from cleanRes (e.g. "overview 3" -> "overview")
    cleanRes = cleanRes.replace(/^\d+[:.\s–-]+|[:.\s–-]+\d+$/g, '').trim();
    cleanRes = sanitizeDanglingPunctuation(cleanRes);

    // Discard fragments like "overview" or "an overview"
    if (cleanRes.toLowerCase() === 'overview' || cleanRes.toLowerCase() === 'an overview') {
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

  // 2. Clean Author (strip any chapter mentions)
  if (author && author.trim()) {
    let cleanAuth = sanitizeDanglingPunctuation(stripChapterMentions(author.trim()));
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

  return parts.join(' · ');
}

/**
 * Safely parses any date input (string, Date, number, null, undefined) into a valid Date object or null.
 * Protects against runtime crashes from .getFullYear() or .toLocaleDateString() on unparsed strings or invalid values.
 */
export function parseSafeDate(rawDate?: Date | string | number | null, fallbackYear: number = 2026): Date | null {
  if (!rawDate) return null;
  if (rawDate instanceof Date) {
    return isNaN(rawDate.getTime()) ? null : rawDate;
  }
  if (typeof rawDate === 'number') {
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? null : d;
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
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const direct = new Date(str);
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
  return /[-–—]|(\bto\b)|(\bbetween\b)/i.test(s) && /\d+/.test(s);
}

/**
 * Normalizes a date range string to a clean, concise format (e.g. "Sep 1 – Sep 5" or "Sep 1 – 5").
 */
export function cleanDateRangeDisplay(rangeStr: string): string {
  let s = rangeStr.trim();
  // Strip leading prefixes
  s = s.replace(/^between\s+/i, '').replace(/^suggested:\s*/i, '').replace(/^suggested reading:\s*/i, '');
  // Remove year if present, e.g. ", 2026" or " 2026"
  s = s.replace(/,?\s*\b20\d{2}\b/g, '').trim();
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
    return `Suggested: ${cleanRange}`;
  }

  // 2. If fallbackWeekDateStr is a genuine date range from the document
  if (fallbackWeekDateStr && isDateRangeString(fallbackWeekDateStr)) {
    const cleanRange = cleanDateRangeDisplay(fallbackWeekDateStr);
    return `Suggested: ${cleanRange}`;
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
    const clean = dateRangeStr.trim().replace(/,?\s*\b20\d{2}\b/g, '').trim();
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
    const clean = fallbackWeekDateStr.replace(/^suggested:\s*/i, '').trim();
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
    rawType === 'article' ||
    rawType === 'paper' ||
    rawType === 'article / paper' ||
    rawType === 'article/paper' ||
    rawType.includes('article') ||
    rawType.includes('paper')
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
    /\b(?:journal article|research paper)\b/i.test(combined) ||
    /\b(?:article|paper)\b/i.test(res) ||
    (/\b(?:article|paper)\b/i.test(title) && !/\b(?:chapter|chs?\.?|chap\.?|textbook)\b/i.test(title))
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
 * Deduplicates and consolidates reading items:
 * 1. Merges intra-week duplicate chapter cards (e.g. "Chapters 1-3" + "overview Gehart").
 * 2. Consolidates identical inter-week range clones that share the exact same chapter, author, and due date.
 * 3. Preserves completion status and chooses the most descriptive title and metadata.
 */
export function deduplicateReadingsList<T extends MinimalReadingItem>(
  readings: T[],
  courses?: { id?: string; courseCode?: string | null; courseName?: string | null }[]
): T[] {
  if (!readings || readings.length <= 1) return readings;

  const result: T[] = [];
  const seenKeys = new Map<string, number>(); // key -> index in result

  for (const r of readings) {
    if (isGenericPlaceholderReadingTitle(r.title)) continue;
    const weekNum = extractReadingWeekNumber(r) ?? 0;
    const matchedCourse = courses?.find(
      c => (c.courseCode || c.courseName || '').toLowerCase() === (r.courseCode || '').toLowerCase()
    );
    const courseKey = (matchedCourse?.courseCode || matchedCourse?.courseName || r.courseCode || 'default')
      .trim()
      .toLowerCase();

    const canonicalCh = cleanChapterFromRaw(r.chapterText || r.title);
    const displayTitle = formatDisplayTitleWithChapter(
      r.title,
      r.chapterText,
      r.resourceTitle,
      matchedCourse?.courseName
    );
    const normTitle = displayTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dateStr = r.dueDate ? (typeof r.dueDate === 'string' ? r.dueDate : (r.dueDate instanceof Date ? r.dueDate.toISOString() : String(r.dueDate))) : '';
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

    // Primary intra-week key (same course, same week, same book, and same chapter OR same title)
    const intraWeekKey = canonicalCh
      ? `intra_${courseKey}_w${weekNum}_bk_${bookKey}_ch_${canonicalCh.toLowerCase().replace(/[^a-z0-9]/g, '')}`
      : `intra_${courseKey}_w${weekNum}_bk_${bookKey}_t_${normTitle}`;

    // Inter-week clone key: same course, same book, same chapter, and identical non-empty due date
    const interWeekCloneKey = (canonicalCh && dateStr)
      ? `inter_${courseKey}_bk_${bookKey}_ch_${canonicalCh.toLowerCase().replace(/[^a-z0-9]/g, '')}_d_${dateStr}`
      : null;

    let existingIndex = seenKeys.get(intraWeekKey) ?? (interWeekCloneKey ? seenKeys.get(interWeekCloneKey) : undefined);

    if (existingIndex === undefined && canonicalCh) {
      const candIdx = result.findIndex(existingR => {
        const exWeek = extractReadingWeekNumber(existingR) ?? 0;
        if (exWeek !== weekNum) return false;
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

      const merged: T = {
        ...existing,
        title: isNewRicher ? r.title : existing.title,
        authorName: existing.authorName || r.authorName,
        resourceTitle: existing.resourceTitle || r.resourceTitle,
        chapterText: canonicalCh || existing.chapterText || r.chapterText,
        pagesText: existing.pagesText || r.pagesText,
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
): number {
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
  // 1. Existing positive weekNumber
  if (typeof assignment.weekNumber === 'number' && assignment.weekNumber > 0) {
    return assignment.weekNumber;
  }

  // 2. Explicit module or week mention in assignment fields
  const fromModule = extractWeekFromText(assignment.moduleMention);
  if (fromModule) return fromModule;

  const fromTitle = extractWeekFromText(assignment.title);
  if (fromTitle) return fromTitle;

  const fromTopics = extractWeekFromText(assignment.relevantTopics);
  if (fromTopics) return fromTopics;

  const fromNotes = extractWeekFromText(assignment.noteText);
  if (fromNotes) return fromNotes;

  const fromInstructions = extractWeekFromText(assignment.fullInstructions);
  if (fromInstructions) return fromInstructions;

  // 3. Due date relative to course schedule or term
  if (assignment.dueDate) {
    const d = parseSafeDate(assignment.dueDate);
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

  // 4. Milestone title keywords
  const titleLower = (assignment.title || '').toLowerCase();
  const termLen = course?.termWeeks || 10;
  if (titleLower.includes('midterm')) {
    return Math.max(1, Math.round(termLen / 2));
  }
  if (titleLower.includes('final') || titleLower.includes('capstone') || titleLower.includes('defense')) {
    return termLen;
  }
  if (titleLower.includes('presentation')) {
    return Math.max(1, termLen - 1);
  }

  // 5. Sequential spacing across course term
  if (allAssignmentsInCourse && allAssignmentsInCourse.length > 0) {
    const unassigned = allAssignmentsInCourse.filter(
      a => !a.weekNumber || a.weekNumber <= 0
    );
    const idx = unassigned.findIndex(a => a.id === assignment.id);
    if (idx >= 0) {
      const step = termLen / (unassigned.length + 1);
      return Math.max(1, Math.min(termLen, Math.round((idx + 1) * step)));
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
    const code = (r.courseCode || 'default').toLowerCase().trim();
    const course = courseByCode.get(code);
    const earliestDate = earliestDateByCourse.get(code);
    const courseReadings = readings.filter(x => (x.courseCode || 'default').toLowerCase().trim() === code);
    const w = deriveWeekForReading(r, course, earliestDate, courseReadings);
    return {
      ...r,
      weekNumber: w,
      weekId: `w-${w}`
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


