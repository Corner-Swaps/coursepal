import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractPdf(assetName: string): string {
  const filePath = path.resolve(__dirname, '../src/assets/syllabi', assetName);
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });
}

describe('Heal Retirement: PRJ-SEX', () => {
  it('locks genuine parsing for PRJ-SEX bundled asset without heal injection', () => {
    const rawText = extractPdf('PRJ_SEX_2026_Human_Sexuality_Syllabus.pdf');
    const parser = LocalSyllabusParser.shared;
    const importManager = SyllabusImportManager.shared;

    const dto = parser.parseText(rawText);
    const norm = importManager.normalizeAndValidateSyllabusPayload(dto, rawText);
    const cleanAssignments = importManager.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
    const cleanReadings = importManager.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

    console.log('PRJ-SEX DTO COURSE:', dto.courseCode, dto.courseName);
    console.log('PRJ-SEX ASSIGNMENTS COUNT:', cleanAssignments.length);
    console.log('PRJ-SEX ASSIGNMENTS:', cleanAssignments.map(a => ({ title: a.title, weight: a.weightPercentage })));
    console.log('PRJ-SEX READINGS COUNT:', cleanReadings.length);
    console.log('PRJ-SEX WEEKS COUNT:', norm.weeks?.length);

    expect(dto.courseCode).toContain('PRJ');

    // Genuine assignments from document: 10 assignments (document specifies no % weights, honest null)
    expect(cleanAssignments.length).toBe(10);
    cleanAssignments.forEach(a => {
      expect(a.weightPercentage).toBeNull();
    });

    // Readings mapped to weeks (post-reconciler week mapped output, no module axis)
    expect(cleanReadings.length).toBeGreaterThanOrEqual(10);
    cleanReadings.forEach(r => {
      // Under no-modules decision, readings are mapped into weeks
      expect(r.weekNumber).toBeDefined();
    });
  });
});
