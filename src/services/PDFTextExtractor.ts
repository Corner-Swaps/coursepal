import { NativeModules, Platform, Linking, Share } from 'react-native';

const PDFTextExtractor = NativeModules?.PDFTextExtractor;

/**
 * Decodes standard PDF literal string escape sequences:
 * octal (\040), standard escapes (\n, \r, \t, \b, \f), and parentheses.
 */
export function decodePDFString(raw: string): string {
  return raw
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\/g, '');
}

/**
 * Pure-TypeScript PDF text stream parser.
 * Extracts plain text from uncompressed / standard PDF streams (BT...ET blocks,
 * Tj and TJ operators, hex strings, and metadata strings).
 * Used as an instant on-device extraction fallback for Android and offline environments.
 */
export function extractTextFromPDFContent(content: string): string {
  if (!content || content.length === 0) return '';

  const trimmed = content.trim();
  const isPdf = trimmed.startsWith('%PDF-') || /BT[\s\S]*?ET/.test(content) || /[\x00-\x08\x0E-\x1F]/.test(content.slice(0, 200));

  // If already clean plain text or non-PDF, return directly
  if (!isPdf) {
    return trimmed;
  }

  const extractedLines: string[] = [];

  // Match text blocks between BT (Begin Text) and ET (End Text)
  const btEtRegex = /BT[\s\S]*?ET/g;
  let match: RegExpExecArray | null;

  while ((match = btEtRegex.exec(content)) !== null) {
    const block = match[0];
    const lineChunks: string[] = [];

    // 1. Match [(...)] TJ array syntax (kerning text arrays)
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = tjMatch[1];
      const strMatches = inner.match(/\((?:[^()\\]|\\.)*\)/g);
      if (strMatches) {
        const combined = strMatches
          .map(s => decodePDFString(s.slice(1, -1)))
          .join('');
        if (combined.trim()) lineChunks.push(combined);
      }
    }

    // 2. Match single string (text) Tj or ' or "
    const tjSingleRegex = /\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")/g;
    let singleMatch: RegExpExecArray | null;
    while ((singleMatch = tjSingleRegex.exec(block)) !== null) {
      const decoded = decodePDFString(singleMatch[1]);
      if (decoded.trim()) lineChunks.push(decoded);
    }

    // 3. Match hex strings <48656c6c6f> Tj
    const hexRegex = /<([0-9a-fA-F]+)>\s*Tj/g;
    let hexMatch: RegExpExecArray | null;
    while ((hexMatch = hexRegex.exec(block)) !== null) {
      const hex = hexMatch[1];
      let str = '';
      for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substring(i, i + 2), 16);
        if (code >= 32 && code <= 126) str += String.fromCharCode(code);
      }
      if (str.trim()) lineChunks.push(str);
    }

    if (lineChunks.length > 0) {
      extractedLines.push(lineChunks.join(' '));
    }
  }

  // Fallback: If BT/ET blocks did not yield text (e.g. metadata or stream objects), extract readable string literals
  if (extractedLines.join('\n').trim().length < 50) {
    const literalStringRegex = /\(((?:[A-Z0-9a-z\s,.\-–:;/'"&()!?]{4,}))\)/g;
    let litMatch: RegExpExecArray | null;
    const litChunks: string[] = [];
    while ((litMatch = literalStringRegex.exec(content)) !== null) {
      const s = litMatch[1].trim();
      if (!s.startsWith('Font') && !s.startsWith('Identity') && !s.startsWith('Adobe') && s.length > 3) {
        litChunks.push(s);
      }
    }
    if (litChunks.length > 0) {
      return litChunks.join(' ').replace(/\s{2,}/g, ' ').trim();
    }
  }

  return extractedLines
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts plain text from a local PDF or image file via Apple Vision OCR.
 * Runs 100% on-device neural text recognition on the Apple Neural Engine.
 */
export async function extractTextViaVision(fileUri: string): Promise<string> {
  if (!fileUri) return '';
  if (Platform.OS === 'ios' && PDFTextExtractor?.extractTextViaVision) {
    try {
      const text = await PDFTextExtractor.extractTextViaVision(fileUri);
      if (typeof text === 'string' && text.trim().length > 20) {
        return text.trim();
      }
    } catch (err) {
      console.warn('PDFTextExtractor extractTextViaVision error:', err);
    }
  }
  return '';
}

/**
 * Extracts plain text from a local PDF file.
 * - If native module is available (iOS native PDFKit + Vision OCR, or Android native module), runs on-device.
 * - Automatically falls back to on-device Apple Vision OCR if raw text is sparse or missing (scanned PDFs).
 * - Otherwise (e.g. Android or offline), loads the file and executes pure-TypeScript stream extraction.
 */
export async function extractTextFromPDF(fileUri: string): Promise<string> {
  if (!fileUri) return '';

  // 1. Try native module if available (PDFKit with built-in Apple Vision OCR fallback)
  if (PDFTextExtractor?.extractText) {
    try {
      const text = await PDFTextExtractor.extractText(fileUri);
      if (typeof text === 'string' && text.trim().length > 20) {
        return text.trim();
      }
    } catch (err) {
      console.warn('PDFTextExtractor native error:', err);
    }
  }

  // 2. Explicit Apple Vision OCR pass if initial native extract returned sparse text
  if (Platform.OS === 'ios' && PDFTextExtractor?.extractTextViaVision) {
    try {
      const visionText = await PDFTextExtractor.extractTextViaVision(fileUri);
      if (typeof visionText === 'string' && visionText.trim().length > 20) {
        return visionText.trim();
      }
    } catch (visionErr) {
      console.warn('PDFTextExtractor direct vision OCR error:', visionErr);
    }
  }

  // 3. Cross-platform pure-TS extraction fallback
  try {
    const FileSystem = require('expo-file-system');
    if (FileSystem && FileSystem.readAsStringAsync) {
      let rawContent = '';
      try {
        rawContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType?.UTF8 || 'utf8'
        });
      } catch {
        // Fallback: read base64 and convert
        const b64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType?.Base64 || 'base64'
        });
        if (b64) {
          rawContent = Buffer.from(b64, 'base64').toString('latin1');
        }
      }

      if (rawContent && rawContent.length > 0) {
        // If content is a docx (or PK zip archive)
        if (fileUri.toLowerCase().includes('.docx') || rawContent.startsWith('PK\x03\x04')) {
          const { extractTextFromDocxBytes } = require('./DocxTextExtractor');
          const bytes = new Uint8Array(Buffer.from(rawContent, 'latin1'));
          const docxText = extractTextFromDocxBytes(bytes);
          if (docxText && docxText.trim().length > 20) {
            return docxText.trim();
          }
        }
        const parsedText = extractTextFromPDFContent(rawContent);
        if (parsedText && parsedText.trim().length > 20) {
          return parsedText.trim();
        }
      }
    }
  } catch (fallbackErr) {
    console.warn('PDFTextExtractor fallback error:', fallbackErr);
  }

  return '';
}

export { isDocx, extractTextFromDocxBytes, extractTextFromDocxBase64, parseDocxXmlToMarkdown } from './DocxTextExtractor';

export interface RenderedPDFResult {
  pageCount: number;
  imageUris: string[];
  base64Pages: string[];
}

/**
 * Renders individual pages of a PDF into high-resolution JPEG photos.
 * Used for both visual document preview and direct multimodal Gemini Vision reading.
 */
export async function renderPDFPages(fileUri: string, maxPages: number = 12): Promise<RenderedPDFResult> {
  if (PDFTextExtractor?.renderPDFPages) {
    try {
      const res = await PDFTextExtractor.renderPDFPages(fileUri, maxPages);
      return {
        pageCount: res?.pageCount || 0,
        imageUris: Array.isArray(res?.imageUris) ? res.imageUris : [],
        base64Pages: Array.isArray(res?.base64Pages) ? res.base64Pages : []
      };
    } catch (err) {
      console.warn('PDFTextExtractor renderPDFPages error:', err);
    }
  }

  // Graceful fallback when native renderer is not compiled (e.g. Android JS runtime)
  return { pageCount: 0, imageUris: [], base64Pages: [] };
}

/**
 * Opens a local document file directly in the device's native document viewer:
 * - On iOS: Apple's native Quick Look previewer (QLPreviewController).
 * - On Android: Resolves content URI via FileSystem.getContentUriAsync and triggers
 *   system viewer / share sheet so user's default PDF viewer (Google Drive PDF viewer,
 *   Samsung Notes, Adobe Acrobat) displays the document.
 */
export async function openNativeDocumentViewer(fileUri: string): Promise<boolean> {
  if (!fileUri) return false;

  // On iOS, call native Quick Look module if available
  if (Platform.OS === 'ios' && PDFTextExtractor?.openQuickLook) {
    try {
      const res = await PDFTextExtractor.openQuickLook(fileUri);
      return Boolean(res);
    } catch (err) {
      console.warn('PDFTextExtractor openQuickLook error:', err);
    }
  }

  // On Android (or non-iOS fallback), open with native viewer
  try {
    const FileSystem = require('expo-file-system');
    let targetUri = fileUri;

    if (Platform.OS === 'android' && FileSystem?.getContentUriAsync) {
      try {
        targetUri = await FileSystem.getContentUriAsync(fileUri);
      } catch {
        targetUri = fileUri;
      }
    }

    const canOpen = await Linking.canOpenURL(targetUri).catch(() => false);
    if (canOpen) {
      await Linking.openURL(targetUri);
      return true;
    }

    await Share.share({
      title: 'Course Syllabus',
      url: targetUri
    });
    return true;
  } catch (err) {
    console.warn('openNativeDocumentViewer error:', err);
    return false;
  }
}

/**
 * Backward-compatible alias for openNativeDocumentViewer.
 */
export const openDocumentQuickLook = openNativeDocumentViewer;

