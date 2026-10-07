export type BlockClassification = 'schedule-table' | 'topical-table' | 'prose' | 'not-a-syllabus';

export interface TableBlock {
  headers?: string[];
  rows: string[][];
}

const DATE_REGEX = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b|\b\d{1,2}\/\d{1,2}\b/i;
const SCHEDULE_COL_REGEX = /\b(week|session|class)\s*\d{1,2}\b/i;
const TOPICAL_HEADER_REGEX = /\b(modules?|topics?|themes?|contents?|related\s*readings?|competenc(y|ies))\b/i;
const MODULE_COL_REGEX = /\b(?:module|mod|unit)\s*0?\d{1,2}\b/i;

export function classifyBlock(block: TableBlock): BlockClassification {
  if (!block || !block.rows || block.rows.length === 0) {
    return 'prose';
  }

  const numRows = block.rows.length;
  let rowsWithDates = 0;
  let rowsWithScheduleNumber = 0;
  let rowsWithModuleNumber = 0;

  for (const row of block.rows) {
    const rowText = row.join(' ');
    if (DATE_REGEX.test(rowText)) {
      rowsWithDates++;
    }
    const firstCol = row[0] || '';
    if (SCHEDULE_COL_REGEX.test(firstCol) || SCHEDULE_COL_REGEX.test(rowText)) {
      rowsWithScheduleNumber++;
    }
    if (MODULE_COL_REGEX.test(firstCol) || MODULE_COL_REGEX.test(rowText)) {
      rowsWithModuleNumber++;
    }
  }

  const dateRatio = rowsWithDates / numRows;
  const scheduleRatio = rowsWithScheduleNumber / numRows;
  const headersText = (block.headers || []).join(' ');
  const firstRowText = (block.rows[0] || []).join(' ');
  const hasRequiredHeader = /\b(?:required|core|foundational|mandatory)\b/i.test(headersText) ||
    /\b(?:required|core|foundational|mandatory)\b/i.test(firstRowText);
  const hasTopicalHeader = (TOPICAL_HEADER_REGEX.test(headersText) || TOPICAL_HEADER_REGEX.test(firstRowText)) && !hasRequiredHeader;

  // 1. Explicit rule: dateless module / topical tables (e.g. headers "Modules | Topics | Related Readings", Module 1–10, no dates)
  // MUST route to topical-table class per Layer 2 spec ONLY when supplementary, NEVER when required/core/foundational!
  if (rowsWithScheduleNumber === 0 && dateRatio < 0.20 && !hasRequiredHeader && (hasTopicalHeader || rowsWithModuleNumber > 0)) {
    return 'topical-table';
  }

  // 2. Explicit rule: a table with week/session numbers, calendar dates, or required module readings is a schedule-table
  if (dateRatio >= 0.50 || scheduleRatio >= 0.50 || rowsWithScheduleNumber > 0 || hasRequiredHeader) {
    return 'schedule-table';
  }

  // 3. Topical table: headers contain theme/topic/module keywords AND <20% of rows contain dates
  if (hasTopicalHeader && dateRatio < 0.20) {
    return 'topical-table';
  }

  // 4. Fallback: table with neither dates nor week numbers is topical or metadata
  if (hasTopicalHeader || (!hasRequiredHeader && rowsWithModuleNumber > 0)) {
    return 'topical-table';
  }

  return 'prose';
}

export function classifyDocument(text: string): 'syllabus' | 'not-a-syllabus' {
  if (!text || text.trim().length === 0) {
    return 'not-a-syllabus';
  }

  const lower = text.toLowerCase();

  // Safety record / incident / non-syllabus gate
  const nonSyllabusMarkers = [
    'daily safety audit',
    'dispatch report',
    'incident notification',
    'worksafebc',
    'osha compliance',
    'crane operator daily log',
    'jobsite staging area',
    'pre-operational machinery inspection'
  ];

  if (nonSyllabusMarkers.some(marker => lower.includes(marker))) {
    return 'not-a-syllabus';
  }

  return 'syllabus';
}
