import * as FileSystem from 'expo-file-system';
import bundledPdfData from './bundled_pdf_data.json';
import { renderPDFPages } from '../services/PDFTextExtractor';

export async function ensureBundledPdfFile(...identifiers: (string | null | undefined)[]): Promise<string | null> {
  try {
    if (!FileSystem.documentDirectory) return null;
    const syllabiDir = `${FileSystem.documentDirectory}syllabi/`;
    const dirInfo = await FileSystem.getInfoAsync(syllabiDir);
    if (!dirInfo.exists && typeof FileSystem.makeDirectoryAsync === 'function') {
      await FileSystem.makeDirectoryAsync(syllabiDir, { intermediates: true });
    }

    const combined = identifiers
      .filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
      .join(' ');
    const lower = combined.toLowerCase().replace(/[^a-z0-9]/g, '');
    let key: string | null = null;
    let targetFileName = '';

    if (lower.includes('psyc612') || (lower.includes('612') && !lower.includes('800')) || lower.includes('thorne') || lower.includes('cbt')) {
      key = 'psyc-612';
      targetFileName = 'PSYC612_Advanced_CBT_Interventions.pdf';
    } else if (lower.includes('cpc527') || (lower.includes('527') && lower.includes('cpc')) || lower.includes('groupcounsel') || lower.includes('murrin')) {
      key = 'cpc-527';
      targetFileName = 'CPC527_Group_Counselling_Syllabus.pdf';
    } else if (lower.includes('cpc511') || (lower.includes('511') && !lower.includes('512') && lower.includes('cpc')) || lower.includes('lossandgrief') || lower.includes('dianamorgan')) {
      key = 'cpc-511';
      targetFileName = 'CPC511_Syllabus.pdf';
    } else if (lower.includes('cpc512') || (lower.includes('512') && lower.includes('cpc')) || lower.includes('familysystem') || lower.includes('gehart')) {
      key = 'cpc-512';
      targetFileName = 'CPC512_Syllabus.pdf';
    } else if (lower.includes('cpc514') || (lower.includes('514') && lower.includes('cpc')) || (lower.includes('researchmethods') && lower.includes('statistics')) || lower.includes('sedghi') || lower.includes('taromi')) {
      key = 'cpc-514';
      targetFileName = 'CPC514_Syllabus.pdf';
    } else if (lower.includes('cpc523') || (lower.includes('523') && lower.includes('cpc')) || lower.includes('psychopathology') || lower.includes('mariepier')) {
      key = 'cpc-523';
      targetFileName = 'CPC523_Syllabus.pdf';
    } else if (lower.includes('cs501') || (lower.includes('501') && !lower.includes('601'))) {
      key = 'cs-501';
      targetFileName = 'Syllabus_1_CS501.pdf';
    } else if (lower.includes('bio412') || lower.includes('412')) {
      key = 'bio-412';
      targetFileName = 'Syllabus_2_BIO412.pdf';
    } else if (lower.includes('law702') || lower.includes('702')) {
      key = 'law-702';
      targetFileName = 'Syllabus_3_LAW702.pdf';
    } else if (lower.includes('econ305') || lower.includes('305')) {
      key = 'econ-305';
      targetFileName = 'Syllabus_6_ECON305.pdf';
    } else if (lower.includes('phys601') || lower.includes('601')) {
      key = 'phys-601';
      targetFileName = 'Syllabus_7_PHYS601.pdf';
    } else if (lower.includes('hist210') || lower.includes('210')) {
      key = 'hist-210';
      targetFileName = 'Syllabus_8_HIST210.pdf';
    } else if (lower.includes('art150') || lower.includes('150')) {
      key = 'art-150';
      targetFileName = 'Syllabus_9_ART150.pdf';
    } else if (lower.includes('psych800') || lower.includes('psyc800') || (lower.includes('800') && !lower.includes('612'))) {
      key = 'psych-800';
      targetFileName = 'Syllabus_10_PSYCH800.pdf';
    } else if (lower.includes('prjsex2026') || lower.includes('prj_sex_2026') || lower.includes('prj-sex-2026')) {
      key = 'prj-sex-2026';
      targetFileName = 'PRJ_SEX_2026_Human_Sexuality_Syllabus.pdf';
    } else if (lower.includes('socs4890') || lower.includes('socs_4890') || lower.includes('socs-4890') || lower.includes('gs802') || (lower.includes('humansexuality') && (lower.includes('socialtheory') || lower.includes('foundations')))) {
      key = 'socs-4890';
      targetFileName = 'SOCS_4890_Human_Sexuality_Syllabus.pdf';
    } else if (lower.includes('sxst3010') || lower.includes('sxst_3010') || lower.includes('sxst-3010') || (lower.includes('criticalhistories') && lower.includes('sexuality'))) {
      key = 'sxst-3010';
      targetFileName = 'SXST_3010_Critical_Histories_Syllabus.pdf';
    }

    if (!key) return null;
    const destPath = `${syllabiDir}${targetFileName}`;
    const fileInfo = await FileSystem.getInfoAsync(destPath);
    if (!fileInfo.exists || (fileInfo.size !== undefined && fileInfo.size < 500)) {
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
  let pdfUri: string | null = null;

  // Step 1: ALWAYS prioritize the user's authentic uploaded document file
  if (doc.rawFileDataUri) {
    try {
      const info = await FileSystem.getInfoAsync(doc.rawFileDataUri);
      if (info.exists) {
        pdfUri = doc.rawFileDataUri;
      }
    } catch {}
  }

  // Step 2: ONLY if no user-uploaded file exists on disk, check for bundled sample PDF
  if (!pdfUri) {
    pdfUri = await ensureBundledPdfFile(doc.courseCode, doc.title, doc.id);
  }

  if (pdfUri) {
    doc.rawFileDataUri = pdfUri;
    try {
      if (!doc.pageImages || doc.pageImages.length === 0) {
        const pageResult = await renderPDFPages(pdfUri, 30);
        if (pageResult && pageResult.imageUris.length > 0) {
          doc.pageImages = pageResult.imageUris;
        }
      }
    } catch (e) {
      // Non-blocking
    }
  }
  return doc;
}
