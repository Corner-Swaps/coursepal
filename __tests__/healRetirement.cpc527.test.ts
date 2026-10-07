import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractPdf(assetName: string): string {
  const filePath = path.resolve(__dirname, '../src/assets/syllabi', assetName);
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });
}

describe('Heal Retirement: CPC 527', () => {
  it('locks genuine parsing for CPC 527 bundled asset without heal injection', () => {
    const rawText = extractPdf('CPC527_Syllabus.pdf');
    const parser = LocalSyllabusParser.shared;
    const importManager = SyllabusImportManager.shared;

    const dto = parser.parseText(rawText);
    const norm = importManager.normalizeAndValidateSyllabusPayload(dto, rawText);
    const cleanAssignments = importManager.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
    const cleanReadings = importManager.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

    console.log('CPC 527 DTO COURSE:', dto.courseCode, dto.courseName);
    console.log('CPC 527 ASSIGNMENTS:', cleanAssignments.map(a => ({ title: a.title, weight: a.weightPercentage })));
    console.log('CPC 527 READINGS COUNT:', cleanReadings.length);
    console.log('CPC 527 WEEKS COUNT:', norm.weeks?.length);

    expect(dto.courseCode).toContain('CPC 527');

    // Assignments from document: 25%, 10%, 40%, 25% (total 100%)
    expect(cleanAssignments.length).toBeGreaterThanOrEqual(4);
    const weights = cleanAssignments.map(a => parseInt(a.weightPercentage || '0', 10));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    expect(totalWeight).toBe(100);

    // Readings: has weekly readings from genuine schedule table
    expect(cleanReadings.length).toBeGreaterThanOrEqual(8);
  });
});
