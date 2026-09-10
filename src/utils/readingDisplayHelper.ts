/**
 * ReadingDisplayHelper
 * 1:1 parity with ReadingTitleCleaner and Swift WeeklyDashboardView formatting logic.
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

export function cleanChapterFromRaw(rawCh?: string | null): string | null {
  if (!rawCh || !rawCh.trim()) return null;
  let cleaned = repairChapterArtifacts(rawCh.trim());
  cleaned = cleaned.replace(/[()[\]]/g, '');
  const lower = cleaned.toLowerCase();

  if (lower.startsWith('chapter ')) {
    return 'Chapter ' + cleaned.slice(8).trim();
  } else if (lower.startsWith('chapters ')) {
    return 'Chapters ' + cleaned.slice(9).trim();
  } else if (lower.startsWith('ch. ')) {
    return 'Ch. ' + cleaned.slice(4).trim();
  } else if (lower.startsWith('chs. ')) {
    return 'Chs. ' + cleaned.slice(5).trim();
  }

  if (/^\d+[\s&,\-–\d]*$/.test(cleaned)) {
    if (cleaned.includes('-') || cleaned.includes('–') || cleaned.includes('&') || cleaned.includes(',')) {
      return `Chapters ${cleaned}`;
    } else {
      return `Chapter ${cleaned}`;
    }
  }

  if (cleaned.length > 0) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

export function stripChapterMentions(title: string): string {
  const healed = repairChapterArtifacts(title);
  const chapterPattern = /\s*[:\-–·•]?\s*\b(?:chapters?|chaps?\.?|chs?\.?)\s*(?:\d+[\s,&–\-]*(?:\b(?:and|to)\b\s*)?)+\s*[:\-–·•.]*\s*/gi;
  let stripped = healed.replace(chapterPattern, ' ').replace(/^[:;•·\-–—\s.]+|[:;•·\-–—\s.]+$/g, '');
  stripped = stripped.replace(/\s+/g, ' ').trim();
  if (!stripped) {
    return healed;
  }
  return stripped;
}

export function distillSmartReadingTitle(rawTitle: string): string {
  let title = (rawTitle || '').trim();
  if (!title) return 'Reading';

  title = repairChapterArtifacts(title);
  // Strip XML/HTML tags
  title = title.replace(/<[^>]+>/g, '');
  // Strip course code prefix like "CPC 527: "
  title = title.replace(/^[A-Z]{2,5}\s*\d{3,4}[A-Z]?\s*[:\-–.]*\s*/i, '');

  // Strip APA-style citation year e.g. "(2014)"
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

  // Strip imperative verbs at start
  title = title.replace(/^\s*(?:please\s+)?(?:review|read\s+and\s+review|read|study|complete\s+the\s+reading\s+of|complete\s+the\s+reading\s+on|complete\s+reading\s+of|complete\s+reading|complete|prepare\s+for|examine|access\s+and\s+read|consult)\s+(?:sample\s+|the\s+|all\s+|assigned\s+|required\s+)?/i, '');
  title = title.replace(/^\s*(?:required|assigned|weekly)\s+readings?\s*[:\-–]*\s*/i, '');
  title = title.replace(/^\s*readings?\s*[:\-–]*\s*/i, '');

  // If title has author + chapter mention e.g. "Corey Chapters 1 & 2 on the therapeutic..."
  const authorChMatch = title.match(/^([A-Z][a-zA-Z\s&,.\-–]+?)\s*[:\-–·•]?\s*\b(?:chapters?|chaps?\.?|chs?\.?)/i);
  if (authorChMatch && authorChMatch[1]) {
    const author = authorChMatch[1].replace(/^[ :;•·\-–—\t]+|[ :;•·\-–—\t]+$/g, '');
    if (author.length >= 2) {
      title = author;
    }
  }

  // If title is just an author + chapter without extra text (e.g. "Gehart chapters 4-10" or "Corey Ch. 1 & 2")
  const chPattern = /\s*[:\-–·•]?\s*\b(?:chapters?|chaps?\.?|chs?\.?)\s*(?:\d+[\s,&–\-]*(?:\b(?:and|to)\b\s*)?)+\s*[:\-–·•.]*\s*/gi;
  const chStripped = title.replace(chPattern, ' ').replace(/^[:;•·\-–—\s.]+|[:;•·\-–—\s.]+$/g, '').trim();
  if (chStripped.length >= 2) {
    title = chStripped;
  }

  if (title.toLowerCase() === 'articles' || title.toLowerCase() === 'article') {
    title = 'Required Articles';
  }

  return title || 'Reading';
}

export function formatDisplayTitleWithChapter(titleOrReading: string | { title: string; chapterText?: string | null }, chapterText?: string | null): string {
  if (typeof titleOrReading === 'object' && titleOrReading !== null) {
    return formatDisplayTitleWithChapter(titleOrReading.title, titleOrReading.chapterText);
  }
  const cleanTitle = distillSmartReadingTitle(titleOrReading);
  const ch = cleanChapterFromRaw(chapterText);
  if (!ch) {
    return cleanTitle;
  }

  const stripped = stripChapterMentions(cleanTitle);
  if (!stripped || stripped.toLowerCase() === ch.toLowerCase()) {
    return ch;
  }

  return `${ch} · ${stripped}`;
}

export function formatAuthorAndPagesSubtitle(
  authorOrReading?: string | { authorName?: string | null; pagesText?: string | null; resourceTitle?: string | null } | null,
  pagesText?: string | null,
  resourceTitle?: string | null
): string {
  if (typeof authorOrReading === 'object' && authorOrReading !== null) {
    return formatAuthorAndPagesSubtitle(
      authorOrReading.authorName,
      authorOrReading.pagesText,
      authorOrReading.resourceTitle
    );
  }
  const parts: string[] = [];
  if (resourceTitle && resourceTitle.trim()) {
    parts.push(resourceTitle.trim());
  }
  if (authorOrReading && authorOrReading.trim()) {
    parts.push(authorOrReading.trim());
  }
  if (pagesText && pagesText.trim()) {
    parts.push(pagesText.trim());
  }
  return parts.join(' · ');
}

export function formatWeekHeaderDate(date: Date): string {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  return `${dayName}, ${monthName} ${day}`;
}
