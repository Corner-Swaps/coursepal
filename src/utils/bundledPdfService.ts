import * as FileSystem from 'expo-file-system';
import bundledPdfData from './bundled_pdf_data.json';
import { renderPDFPages } from '../services/PDFTextExtractor';

export async function ensureBundledPdfFile(identifier: string): Promise<string | null> {
  try {
    if (!FileSystem.documentDirectory) return null;
    const syllabiDir = `${FileSystem.documentDirectory}syllabi/`;
    const dirInfo = await FileSystem.getInfoAsync(syllabiDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(syllabiDir, { intermediates: true });
    }

    const lower = (identifier || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    let key: 'psyc-612' | 'cpc-527' | null = null;
    let targetFileName = '';

    if (lower.includes('psyc') || lower.includes('612') || lower.includes('thorne') || lower.includes('cbt')) {
      key = 'psyc-612';
      targetFileName = 'PSYC612_Advanced_CBT_Interventions.pdf';
    } else if (lower.includes('527') || lower.includes('group') || lower.includes('murrin') || lower.includes('cpc527')) {
      key = 'cpc-527';
      targetFileName = 'CPC527_Group_Counselling_Syllabus.pdf';
    }

    if (!key) return null;
    const destPath = `${syllabiDir}${targetFileName}`;
    const fileInfo = await FileSystem.getInfoAsync(destPath);
    if (!fileInfo.exists) {
      const b64 = (bundledPdfData as Record<string, string>)[key];
      if (b64) {
        await FileSystem.writeAsStringAsync(destPath, b64, {
          encoding: FileSystem.EncodingType.Base64
        });
      }
    }
    return destPath;
  } catch (err) {
    console.warn('ensureBundledPdfFile error:', err);
    return null;
  }
}

export async function hydrateVaultDocWithRealPdf(doc: any): Promise<any> {
  const pdfUri = await ensureBundledPdfFile(doc.id || doc.courseCode || doc.title);
  if (pdfUri) {
    doc.rawFileDataUri = pdfUri;
    try {
      const pageResult = await renderPDFPages(pdfUri, 30);
      if (pageResult && pageResult.imageUris.length > 0) {
        doc.pageImages = pageResult.imageUris;
      }
    } catch (e) {
      // Non-blocking
    }
  }
  return doc;
}
