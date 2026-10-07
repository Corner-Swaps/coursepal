export interface WordBox {
  text: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextLine {
  words: WordBox[];
  text: string;
  yTop: number;
  yBottom: number;
  xLeft: number;
  xRight: number;
}

export interface TableCell {
  text: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface TableGrid {
  rows: number;
  cols: number;
  cells: TableCell[];
}

export interface PageLayout {
  pageNumber: number;
  lines: TextLine[];
  tables: TableGrid[];
  columnCount: 1 | 2;
}

export function validatePageLayout(val: any): boolean {
  if (!Array.isArray(val) || val.length === 0) return false;
  return val.every(item =>
    item &&
    typeof item.pageNumber === 'number' &&
    typeof item.width === 'number' &&
    typeof item.height === 'number' &&
    Array.isArray(item.observations) &&
    item.observations.every((obs: any) =>
      obs &&
      typeof obs.text === 'string' &&
      typeof obs.confidence === 'number' &&
      obs.box &&
      typeof obs.box.x === 'number' &&
      typeof obs.box.y === 'number' &&
      typeof obs.box.w === 'number' &&
      typeof obs.box.h === 'number'
    )
  );
}

function wordsOverlapVertically(w1: WordBox, w2: WordBox): boolean {
  const top1 = w1.y;
  const bottom1 = w1.y + w1.h;
  const top2 = w2.y;
  const bottom2 = w2.y + w2.h;

  const overlapTop = Math.max(top1, top2);
  const overlapBottom = Math.min(bottom1, bottom2);
  const overlap = overlapBottom - overlapTop;
  if (overlap <= 0) return false;

  const minHeight = Math.min(w1.h, w2.h);
  return overlap >= 0.5 * minHeight;
}

export function reconstructPage(observations: WordBox[], pageNumber: number = 1): PageLayout {
  if (!observations || observations.length === 0) {
    return {
      pageNumber,
      lines: [],
      tables: [],
      columnCount: 1
    };
  }

  // 1. Group words into lines, respecting column gutters (left vs right of page)
  const sortedWords = [...observations].sort((a, b) => a.y - b.y || a.x - b.x);
  const lineWordGroups: WordBox[][] = [];

  for (const word of sortedWords) {
    let placed = false;
    for (const group of lineWordGroups) {
      const overlaps = group.some(w => wordsOverlapVertically(w, word));
      if (overlaps) {
        // Check if there is an artificial gutter jump (e.g. one in left column, one in right column with a gap > 0.25)
        const crossesGutter = group.some(w => {
          const isWLeft = (w.x + w.w) <= 0.52;
          const isWordRight = word.x >= 0.48;
          const isWordLeft = (word.x + word.w) <= 0.52;
          const isWRight = w.x >= 0.48;
          return (isWLeft && isWordRight && (word.x - (w.x + w.w) > 0.20)) ||
                 (isWordLeft && isWRight && (w.x - (word.x + word.w) > 0.20));
        });

        if (!crossesGutter) {
          group.push(word);
          placed = true;
          break;
        }
      }
    }
    if (!placed) {
      lineWordGroups.push([word]);
    }
  }

  // Build TextLine objects
  const rawLines: TextLine[] = lineWordGroups.map(words => {
    words.sort((a, b) => a.x - b.x);
    const text = words.map(w => w.text).join(' ');
    const yTop = Math.min(...words.map(w => w.y));
    const yBottom = Math.max(...words.map(w => w.y + w.h));
    const xLeft = Math.min(...words.map(w => w.x));
    const xRight = Math.max(...words.map(w => w.x + w.w));
    return { words, text, yTop, yBottom, xLeft, xRight };
  });

  // Sort lines top to bottom by yTop
  rawLines.sort((a, b) => a.yTop - b.yTop);

  // 2. Check for 2-column layout
  const leftColLines = rawLines.filter(l => l.xRight <= 0.52);
  const rightColLines = rawLines.filter(l => l.xLeft >= 0.48);

  let columnCount: 1 | 2 = 1;
  let lines: TextLine[] = rawLines;

  if (leftColLines.length >= 4 && rightColLines.length >= 4) {
    columnCount = 2;
    leftColLines.sort((a, b) => a.yTop - b.yTop);
    rightColLines.sort((a, b) => a.yTop - b.yTop);
    lines = [...leftColLines, ...rightColLines];
  }

  // 3. Table detection
  const tables: TableGrid[] = [];

  // Find column left edges
  const sortedByX = [...observations].sort((a, b) => a.x - b.x);
  const distinctCols: number[] = [];

  for (const w of sortedByX) {
    const existing = distinctCols.find(c => Math.abs(c - w.x) <= 0.04);
    if (existing === undefined) {
      distinctCols.push(w.x);
    }
  }

  // If there is an obvious large gap between adjacent columns, infer missing column (e.g. empty cell)
  const expandedCols: number[] = [];
  for (let i = 0; i < distinctCols.length; i++) {
    expandedCols.push(distinctCols[i]);
    if (i + 1 < distinctCols.length) {
      const gap = distinctCols[i + 1] - distinctCols[i];
      if (gap >= 0.40) {
        // Insert intermediate column
        expandedCols.push(distinctCols[i] + gap / 2);
      }
    }
  }
  expandedCols.sort((a, b) => a - b);

  if (expandedCols.length >= 2) {
    // Find row bands from words
    const yTops: number[] = [];
    const sortedByY = [...observations].sort((a, b) => a.y - b.y);

    for (const w of sortedByY) {
      const existing = yTops.find(y => Math.abs(y - w.y) <= 0.025);
      if (existing === undefined) {
        yTops.push(w.y);
      }
    }
    yTops.sort((a, b) => a - b);

    if (yTops.length >= 1) {
      const numRows = yTops.length;
      const numCols = expandedCols.length;
      const cells: TableCell[] = [];

      for (let r = 0; r < numRows; r++) {
        const rowY = yTops[r];
        const nextRowY = r + 1 < numRows ? yTops[r + 1] : 1.0;

        for (let c = 0; c < numCols; c++) {
          const colX = expandedCols[c];

          // Check if already covered by cell above with rowSpan > 1
          const coveredByAbove = cells.find(existing => existing.col === c && existing.row === r - 1 && existing.rowSpan > 1);
          if (coveredByAbove) {
            continue;
          }

          // Find words matching this (row, col)
          const matchingWords = observations.filter(w => {
            const matchesCol = Math.abs(w.x - colX) <= 0.05;
            const matchesRow = Math.abs(w.y - rowY) <= 0.025;
            return matchesCol && matchesRow;
          });

          let rowSpan = 1;
          let colSpan = 1;
          let cellText = '';

          if (matchingWords.length > 0) {
            cellText = matchingWords.map(w => w.text).join(' ');
            const wordMaxY = Math.max(...matchingWords.map(w => w.y + w.h));
            if (r + 1 < numRows && wordMaxY >= (nextRowY + 0.01)) {
              rowSpan = 2;
            }
          }

          cells.push({
            text: cellText,
            row: r,
            col: c,
            rowSpan,
            colSpan
          });
        }
      }

      if (cells.length > 0) {
        tables.push({
          rows: numRows,
          cols: numCols,
          cells
        });
      }
    }
  }

  return {
    pageNumber,
    lines,
    tables,
    columnCount
  };
}
