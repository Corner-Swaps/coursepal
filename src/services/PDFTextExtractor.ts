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
