import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractPdf(assetName: string): string {
  const filePath = path.resolve(__dirname, '../src/assets/syllabi', assetName);
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });
}

describe('Heal Retirement: SXST 3010', () => {
  it('locks genuine parsing for SXST 3010 bundled asset without heal injection', () => {
    const rawText = extractPdf('SXST_3010_Critical_Histories_Syllabus.pdf');
    const parser = LocalSyllabusParser.shared;
    const importManager = SyllabusImportManager.shared;

    const dto = parser.parseText(rawText);
    const norm = importManager.normalizeAndValidateSyllabusPayload(dto, rawText);
    const cleanAssignments = importManager.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
    const cleanReadings = importManager.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

    console.log('SXST 3010 DTO COURSE:', dto.courseCode, dto.courseName);
    console.log('SXST 3010 ASSIGNMENTS COUNT:', cleanAssignments.length);
    console.log('SXST 3010 ASSIGNMENTS:', cleanAssignments.map(a => ({ title: a.title, weight: a.weightPercentage })));
    console.log('SXST 3010 READINGS COUNT:', cleanReadings.length);
    console.log('SXST 3010 WEEKS COUNT:', norm.weeks?.length);

    expect(dto.courseCode).toContain('SXST');

    // Assignments from document: exactly 10 totaling 100%
    expect(cleanAssignments.length).toBe(10);
    const weights = cleanAssignments.map(a => parseInt(a.weightPercentage || '0', 10));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    expect(totalWeight).toBe(100);

    // Readings from document: 20 readings across 10 weeks
    expect(cleanReadings.length).toBe(20);
    expect(norm.weeks?.length).toBe(10);
  });
});
