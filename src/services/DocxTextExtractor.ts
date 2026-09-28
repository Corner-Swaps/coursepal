/**
 * DocxTextExtractor
 * Pure TypeScript/JavaScript Microsoft Word (.docx) document extractor.
 * Unpacks the .docx ZIP archive, extracts word/document.xml, and converts
 * both tabular data (<w:tbl>) and text paragraphs (<w:p>) into clean Markdown.
 */

import pako from 'pako';

export function isDocx(fileNameOrPath: string): boolean {
  if (!fileNameOrPath) return false;
  const lower = fileNameOrPath.toLowerCase();
  return lower.endsWith('.docx') || lower.includes('.docx?') || lower.includes('.docx#');
}

/**
 * Decodes standard XML entities
 */
function decodeXmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extracts all text from <w:t> elements inside an XML snippet
 */
function extractTextFromSnippet(xmlSnippet: string, delimiter: string = ' '): string {
  if (!xmlSnippet) return '';
  const pMatches = xmlSnippet.match(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi);
  if (pMatches && pMatches.length > 0) {
    return pMatches.map(pSnippet => {
      const textMatches = pSnippet.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi) || [];
      return decodeXmlEntities(textMatches.map(m => m.replace(/<[^>]+>/g, '')).join(''));
    }).filter(t => t.trim().length > 0).join(delimiter);
  }
  const textMatches = xmlSnippet.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi) || [];
  const text = textMatches.map(m => m.replace(/<[^>]+>/g, '')).join('');
  return decodeXmlEntities(text);
}

/**
 * Fast, pure JavaScript UTF-8 decoder that works in Hermes and browser runtimes
 * without requiring the global TextDecoder object.
 */
function uint8ArrayToUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    try {
      return new TextDecoder('utf-8').decode(bytes);
    } catch {}
  }
  let i = 0;
  const len = bytes.length;
  const chunkLimit = 8192;
  const chunks: string[] = [];
  let chunk = '';
  while (i < len) {
    const c = bytes[i++];
    if (c < 128) {
      chunk += String.fromCharCode(c);
    } else if (c > 191 && c < 224) {
      chunk += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
    } else if (c > 223 && c < 240) {
      chunk += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
    } else {
      const c2 = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      chunk += String.fromCharCode(0xd800 + ((c2 - 0x10000) >> 10));
      chunk += String.fromCharCode(0xdc00 + ((c2 - 0x10000) & 1023));
    }
    if (chunk.length >= chunkLimit) {
      chunks.push(chunk);
      chunk = '';
    }
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks.join('');
}

const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const b64lookup = new Uint8Array(256);
for (let bIdx = 0; bIdx < b64chars.length; bIdx++) b64lookup[b64chars.charCodeAt(bIdx)] = bIdx;

/**
 * Pure TypeScript Base64 to Uint8Array decoder (runs anywhere: Hermes, iOS, Android, Node).
 */
function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const cleanB64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = cleanB64.length;
  const byteLen = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(byteLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const enc1 = b64lookup[cleanB64.charCodeAt(i)];
    const enc2 = b64lookup[cleanB64.charCodeAt(i + 1)];
    const enc3 = b64lookup[cleanB64.charCodeAt(i + 2)];
    const enc4 = b64lookup[cleanB64.charCodeAt(i + 3)];
    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (i + 2 < len && cleanB64[i + 2] !== '=') bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    if (i + 3 < len && cleanB64[i + 3] !== '=') bytes[p++] = ((enc3 & 3) << 6) | enc4;
  }
  return bytes.subarray(0, p);
}

/**
 * Parses paragraphs in Column 0 to identify individual sessions or break markers.
 */
function parseCol0Sessions(paras: string[]): string[] {
  const months = /^(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i;
  const isBreak = (t: string) => /reading\s*break|break|recess/i.test(t) || /^[A-Za-z]+\s+\d{1,2}\s*[-–—]\s*\d{1,2}$/i.test(t);
  const isDigit = (t: string) => /^\d{1,2}$/.test(t.trim());

  interface SessionAcc {
    isBreak?: boolean;
    text?: string;
    parts?: string[];
  }

  const sessions: SessionAcc[] = [];
  let curSession: SessionAcc | null = null;

  for (let i = 0; i < paras.length; i++) {
    const p = paras[i].trim();
    if (!p) continue;
    const prevP = i > 0 ? paras[i - 1].trim() : '';
    const isPrevMonth = months.test(prevP);

    if (isBreak(p)) {
      if (curSession) sessions.push(curSession);
      curSession = { text: p, isBreak: true };
      sessions.push(curSession);
      curSession = null;
    } else if (isDigit(p) && !isPrevMonth) {
      if (curSession) sessions.push(curSession);
      curSession = { parts: [p] };
    } else {
      if (curSession) {
        if (!curSession.parts) curSession.parts = [];
        curSession.parts.push(p);
      } else {
        curSession = { parts: [p] };
      }
    }
  }
  if (curSession) sessions.push(curSession);

  return sessions.map(s => {
    if (s.isBreak) return s.text || '';
    return s.parts ? s.parts.join(' ') : '';
  }).filter(s => s.length > 0);
}

/**
 * Partitions content paragraphs in non-date columns across detected sessions.
 */
function partitionParas(paras: string[], numSessions: number, col0Sessions: string[]): string[] {
  if (paras.length === 0) return Array(numSessions).fill('');
  if (paras.length === numSessions) return paras;

  if (paras.length < numSessions) {
    const res = Array(numSessions).fill('');
    for (let i = 0; i < paras.length; i++) res[i] = paras[i];
    return res;
  }

  const isBreakSession = col0Sessions.map(s => /reading\s*break|break|recess|[-–—]/i.test(s) && !/^\d+\s+[A-Za-z]/i.test(s));

  // Merge trailing continuation lines (ending in punctuation like ; or ,)
  const mergedParas: string[] = [];
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    if (mergedParas.length > 0 && /[,;–—&]\s*$/i.test(mergedParas[mergedParas.length - 1])) {
      mergedParas[mergedParas.length - 1] += ' ' + p;
    } else {
      mergedParas.push(p);
    }
  }

  if (mergedParas.length === numSessions) {
    return mergedParas;
  }

  // If 2 sessions and session 2 is a break, assign last paragraph to break
  if (numSessions === 2 && isBreakSession[1]) {
    return [
      mergedParas.slice(0, mergedParas.length - 1).join('<br>'),
      mergedParas[mergedParas.length - 1]
    ];
  }

  // Sequential distribution with lookahead
  const res: string[][] = Array.from({ length: numSessions }, () => []);
  let curBucket = 0;
  for (let i = 0; i < mergedParas.length; i++) {
    res[curBucket].push(mergedParas[i]);
    const remainingParas = mergedParas.length - 1 - i;
    const remainingBuckets = numSessions - 1 - curBucket;
    if (remainingBuckets > 0 && remainingParas >= remainingBuckets) {
      curBucket++;
    }
  }
  return res.map(b => b.join('<br>'));
}

/**
 * Parses word/document.xml content into structured Markdown (tables + paragraphs)
 */
export function parseDocxXmlToMarkdown(documentXml: string): string {
  if (!documentXml) return '';

  // Remove field instruction text (e.g. PAGE, NUMPAGES, HYPERLINK boilerplate)
  let cleanedXml = documentXml.replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/gi, '');

  const lines: string[] = [];
  const blockRegex = /<(w:tbl|w:p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRegex.exec(cleanedXml)) !== null) {
    const tag = blockMatch[1];
    const blockContent = blockMatch[2];

    if (tag === 'w:tbl') {
      // Process table rows
      const rowRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/gi;
      let rowMatch: RegExpExecArray | null;
      let isFirstRow = true;

      while ((rowMatch = rowRegex.exec(blockContent)) !== null) {
        const rowContent = rowMatch[1];
        const cellRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/gi;
        let cellMatch: RegExpExecArray | null;
        const rawCellsParas: string[][] = [];

        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
          const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
          let pMatch: RegExpExecArray | null;
          const paras: string[] = [];
          while ((pMatch = pRegex.exec(cellMatch[1])) !== null) {
            const tMatches = pMatch[1].match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi) || [];
            const text = tMatches
              .map(m => m.replace(/<[^>]+>/g, ''))
              .join('')
              .replace(/(\d{1,2})(?=[A-Za-z])/g, '$1 ')
              .trim();
            if (text.length > 0) {
              paras.push(decodeXmlEntities(text));
            }
          }
          rawCellsParas.push(paras);
        }

        if (rawCellsParas.length === 0) continue;

        const col0Paras = rawCellsParas[0] || [];
        const col0Sessions = parseCol0Sessions(col0Paras);

        if (col0Sessions.length > 1 && !isFirstRow) {
          // Multi-session row: split into separate table rows
          const numSessions = col0Sessions.length;
          const colPartitions = rawCellsParas.map((cParas, cIdx) => {
            if (cIdx === 0) return col0Sessions;
            return partitionParas(cParas, numSessions, col0Sessions);
          });

          for (let sIdx = 0; sIdx < numSessions; sIdx++) {
            const sCells = colPartitions.map(col => (col[sIdx] || '').replace(/\s+/g, ' ').trim());
            lines.push(`| ${sCells.join(' | ')} |`);
          }
        } else {
          const cells = rawCellsParas.map((paras, ci) => {
            if (ci === 0 && col0Sessions.length === 1) {
              return col0Sessions[0].replace(/\s+/g, ' ').trim();
            }
            return paras.join('<br>').replace(/\s+/g, ' ').trim();
          });

          if (cells.length > 0) {
            lines.push(`| ${cells.join(' | ')} |`);
            if (isFirstRow) {
              lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
              isFirstRow = false;
            }
          }
        }
      }
      lines.push('');
    } else if (tag === 'w:p') {
      // Process paragraph
      const pText = extractTextFromSnippet(blockContent).replace(/\s+/g, ' ').trim();
      if (pText.length > 0) {
        lines.push(pText);
      }
    }
  }

  return lines.join('\n').trim();
}

/**
 * Extracts plain text and Markdown tables from raw binary Uint8Array of a .docx file.
 */
export function extractTextFromDocxBytes(bytes: Uint8Array): string {
  if (!bytes || bytes.length < 30) return '';

  const len = bytes.length;
  let pos = 0;
  let documentXml: string | null = null;

  while (pos + 30 <= len) {
    // Check for ZIP local file header signature: PK\x03\x04
    if (bytes[pos] === 0x50 && bytes[pos + 1] === 0x4B && bytes[pos + 2] === 0x03 && bytes[pos + 3] === 0x04) {
      const compMethod = bytes[pos + 8] | (bytes[pos + 9] << 8);
      const compSize =
        (bytes[pos + 18] | (bytes[pos + 19] << 8) | (bytes[pos + 20] << 16) | (bytes[pos + 21] << 24)) >>> 0;
      const uncompSize =
        (bytes[pos + 22] | (bytes[pos + 23] << 8) | (bytes[pos + 24] << 16) | (bytes[pos + 25] << 24)) >>> 0;
      const nameLen = bytes[pos + 26] | (bytes[pos + 27] << 8);
      const extraLen = bytes[pos + 28] | (bytes[pos + 29] << 8);

      if (pos + 30 + nameLen > len) break;

      // Read file name
      let fileName = '';
      for (let i = 0; i < nameLen; i++) {
        fileName += String.fromCharCode(bytes[pos + 30 + i]);
      }

      const dataOffset = pos + 30 + nameLen + extraLen;

      if (fileName === 'word/document.xml') {
        if (dataOffset + compSize <= len) {
          const fileSlice = bytes.subarray(dataOffset, dataOffset + compSize);
          if (compMethod === 0) {
            // Uncompressed
            documentXml = uint8ArrayToUtf8(fileSlice);
          } else if (compMethod === 8) {
            // Deflated
            try {
              const inflated = pako.inflateRaw(fileSlice);
              documentXml = uint8ArrayToUtf8(inflated);
            } catch (inflateErr) {
              console.warn('DocxTextExtractor inflate error:', inflateErr);
              try {
                const inflated2 = pako.inflate(fileSlice);
                documentXml = uint8ArrayToUtf8(inflated2);
              } catch (inflateErr2) {
                console.warn('DocxTextExtractor fallback inflate error:', inflateErr2);
              }
            }
          }
        }
        break;
      }

      pos = dataOffset + compSize;
    } else {
      pos++;
    }
  }

  if (!documentXml) return '';
  return parseDocxXmlToMarkdown(documentXml);
}

/**
 * Extracts plain text and Markdown tables from a base64-encoded string of a .docx file.
 */
export function extractTextFromDocxBase64(base64: string): string {
  if (!base64 || base64.length < 40) return '';
  const bytes = base64ToUint8Array(base64);
  return extractTextFromDocxBytes(bytes);
}
