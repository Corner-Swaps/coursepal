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
function extractTextFromSnippet(xmlSnippet: string): string {
  if (!xmlSnippet) return '';
  const pMatches = xmlSnippet.match(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi);
  if (pMatches && pMatches.length > 0) {
    return pMatches.map(pSnippet => {
      const textMatches = pSnippet.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi) || [];
      return decodeXmlEntities(textMatches.map(m => m.replace(/<[^>]+>/g, '')).join(''));
    }).filter(t => t.trim().length > 0).join(' ');
  }
  const textMatches = xmlSnippet.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi) || [];
  const text = textMatches.map(m => m.replace(/<[^>]+>/g, '')).join('');
  return decodeXmlEntities(text);
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
        const cells: string[] = [];

        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
          const cellText = extractTextFromSnippet(cellMatch[1]).replace(/\s+/g, ' ').trim();
          cells.push(cellText);
        }

        if (cells.length > 0) {
          lines.push(`| ${cells.join(' | ')} |`);
          if (isFirstRow) {
            lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
            isFirstRow = false;
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
            documentXml = new TextDecoder('utf-8').decode(fileSlice);
          } else if (compMethod === 8) {
            // Deflated
            try {
              const inflated = pako.inflateRaw(fileSlice);
              documentXml = new TextDecoder('utf-8').decode(inflated);
            } catch (inflateErr) {
              console.warn('DocxTextExtractor inflate error:', inflateErr);
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
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return extractTextFromDocxBytes(bytes);
}
