import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractTextFromPdf(filePath: string): string {
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

describe('Detailed Inspection of 4 Uploaded Syllabi', () => {
  const dir = '/Users/slava/.gemini/antigravity/brain/4c112012-49ab-441f-be67-4845c016c820/.user_uploaded';

  const files = [
    { label: 'CPC 511', file: 'media_1790272219828.pdf' },
    { label: 'CPC 524', file: 'media_1790272219842.pdf' },
    { label: 'CPC 527', file: 'media_1790272219847.pdf' },
    { label: 'DATA 630', file: 'media_1790272219853.pdf' },
  ];

  files.forEach(({ label, file }) => {
    it(`Inspects ${label} (${file})`, () => {
      const fullPath = path.join(dir, file);
      const text = extractTextFromPdf(fullPath);
      const dto = LocalSyllabusParser.shared.parseText(text);
      const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

      console.log(`\n=================== [${label}] ===================`);
      console.log('Course Code:', dto.courseCode, '| Course Name:', dto.courseName);
      console.log('DTO weeks count:', dto.weeks?.length || 0);
      console.log('Norm weeks count:', norm.weeks?.length || 0);
      if (norm.weeks && norm.weeks.length > 0) {
        console.log('Weeks breakdown:');
        norm.weeks.forEach((w: any) => console.log(`  Week ${w.weekNumber}: theme="${w.theme}", range="${w.dateRangeStr}", modMention="${w.moduleMention}", modNum="${w.moduleNumber}"`));
      }
      console.log('Clean Readings count:', cleanReadings.length);
      cleanReadings.slice(0, 10).forEach((r: any, i) => {
        console.log(`  R[${i}]: W${r.weekNumber || '-'} | Mod: ${r.moduleMention || r.moduleNumber || '-'} | Title: "${r.title}" | Ch: "${r.chapterText || ''}" | Due: "${r.dueDate || ''}"`);
      });
      console.log('Clean Assignments count:', cleanAssignments.length);
      cleanAssignments.forEach((a: any, i) => {
        console.log(`  A[${i}]: W${a.weekNumber || '-'} | Mod: ${a.moduleMention || a.moduleNumber || '-'} | Title: "${a.title}" | Due: "${a.dueDate || ''}" | Pts: "${a.pointsPossible || ''}" | Wt: "${a.weightPercentage || ''}"`);
      });
      expect(dto.courseCode).toBeTruthy();
    });
  });
});
