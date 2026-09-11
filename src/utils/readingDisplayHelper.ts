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

  if (!hasChapterKeyword && !isPureNumbers) {
    // Not a chapter! Prevents dates, years, or topic titles from being misidentified as chapters
    return null;
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

  if (title.toLowerCase() === 'articles' || title.toLowerCase() === 'article') {
    title = 'Required Articles';
  }

  return title || 'Reading';
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
  courseName?: string | null
): string {
  let rawTitle = '';
  let rawCh: string | null | undefined = chapterText;
  let authorName: string | null | undefined = null;
  let resTitle: string | null | undefined = resourceTitle;

  if (typeof titleOrReading === 'object' && titleOrReading !== null) {
    rawTitle = titleOrReading.title || '';
    if (!rawCh) rawCh = titleOrReading.chapterText;
    authorName = titleOrReading.authorName;
    if (!resTitle) resTitle = titleOrReading.resourceTitle;
  } else {
    rawTitle = titleOrReading || '';
  }

  // Detect chapter candidate from either chapterText or rawTitle
  const chapterCandidate = rawCh || rawTitle;
  const canonicalChapter = cleanChapterFromRaw(chapterCandidate);

  // Extract substantive topic by stripping all chapter mentions and noise
  let substantiveTitle = stripChapterMentions(deduplicateRepeatedPhrases(distillSmartReadingTitle(rawTitle)));

  if (canonicalChapter) {
    // 1. Strip leading list numbers, e.g. "3. Family Therapy...", "3: overview", "10."
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

  // Check if substantive title matches or overlaps the textbook or course name
  const isBookOrCourseName =
    normSubstantive.length === 0 ||
    (normRes.length > 0 && (normSubstantive === normRes || normRes.includes(normSubstantive) || normSubstantive.includes(normRes))) ||
    (normCourse.length > 0 && (normSubstantive === normCourse || normCourse.includes(normSubstantive) || normSubstantive.includes(normCourse)));

  if (canonicalChapter && isBookOrCourseName) {
    return canonicalChapter;
  }

  // If no substantive title remains, or it duplicates the chapter, return ONLY the chapter
  if (
    !substantiveTitle ||
    (canonicalChapter && substantiveTitle.toLowerCase() === canonicalChapter.toLowerCase()) ||
    substantiveTitle.toLowerCase() === 'reading' ||
    (substantiveTitle.toLowerCase() === 'assigned readings' && canonicalChapter)
  ) {
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
    let cleanRes = stripChapterMentions(deduplicateRepeatedPhrases(resource.trim()));
    cleanRes = cleanRes.replace(/^[:;•·\-–—\s.]+|[:;•·\-–—\s.]+$/g, '').trim();

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
    cleanRes = cleanRes.replace(/^[:;•·\-–—\s.]+|[:;•·\-–—\s.]+$/g, '').trim();

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
    let cleanAuth = stripChapterMentions(author.trim());
    cleanAuth = cleanAuth.replace(/^[:;•·\-–—\s.]+|[:;•·\-–—\s.]+$/g, '').trim();
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
    let cleanPg = pages.trim();
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
export function parseSafeDate(rawDate?: Date | string | number | null): Date | null {
  if (!rawDate) return null;
  if (rawDate instanceof Date) {
    return isNaN(rawDate.getTime()) ? null : rawDate;
  }
  const parsed = new Date(rawDate);
  return isNaN(parsed.getTime()) ? null : parsed;
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
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = d.toLocaleDateString('en-US', { month: 'long' });
  const day = d.getDate();
  return `${dayName}, ${monthName} ${day}`;
}

