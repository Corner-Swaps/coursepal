import { NativeModules, Platform } from 'react-native';

const PDFTextExtractor = NativeModules?.PDFTextExtractor;

/**
 * Extracts plain text from a local PDF file using iOS native PDFKit.
 * Runs in milliseconds on-device with zero network latency.
 */
export async function extractTextFromPDF(fileUri: string): Promise<string> {
  if (Platform.OS !== 'ios' || !PDFTextExtractor) {
    return '';
  }
  try {
    const text = await PDFTextExtractor.extractText(fileUri);
    return typeof text === 'string' ? text.trim() : '';
  } catch (err) {
    console.warn('PDFTextExtractor error:', err);
    return '';
  }
}

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
  if (Platform.OS !== 'ios' || !PDFTextExtractor || !PDFTextExtractor.renderPDFPages) {
    return { pageCount: 0, imageUris: [], base64Pages: [] };
  }
  try {
    const res = await PDFTextExtractor.renderPDFPages(fileUri, maxPages);
    return {
      pageCount: res?.pageCount || 0,
      imageUris: Array.isArray(res?.imageUris) ? res.imageUris : [],
      base64Pages: Array.isArray(res?.base64Pages) ? res.base64Pages : []
    };
  } catch (err) {
    console.warn('PDFTextExtractor renderPDFPages error:', err);
    return { pageCount: 0, imageUris: [], base64Pages: [] };
  }
}

/**
 * Opens a local document file directly in Apple's native Quick Look previewer.
 * Provides native pinch-to-zoom, page thumbnails, text search, and printing.
 */
export async function openDocumentQuickLook(fileUri: string): Promise<boolean> {
  if (Platform.OS !== 'ios' || !PDFTextExtractor || !PDFTextExtractor.openQuickLook) {
    return false;
  }
  try {
    const res = await PDFTextExtractor.openQuickLook(fileUri);
    return Boolean(res);
  } catch (err) {
    console.warn('PDFTextExtractor openQuickLook error:', err);
    return false;
  }
}
