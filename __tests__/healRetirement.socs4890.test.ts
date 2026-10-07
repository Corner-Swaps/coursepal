import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractPdf(assetName: string): string {
  const filePath = path.resolve(__dirname, '../src/assets/syllabi', assetName);
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });
}

describe('Heal Retirement: SOCS 4890', () => {
  it('locks genuine parsing for SOCS 4890 bundled asset without heal injection', () => {
    const rawText = extractPdf('SOCS_4890_Human_Sexuality_Syllabus.pdf');
    const parser = LocalSyllabusParser.shared;
    const importManager = SyllabusImportManager.shared;

    const dto = parser.parseText(rawText);
    const norm = importManager.normalizeAndValidateSyllabusPayload(dto, rawText);
    const cleanAssignments = importManager.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
    const cleanReadings = importManager.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

    console.log('SOCS 4890 DTO COURSE:', dto.courseCode, dto.courseName);
    console.log('SOCS 4890 ASSIGNMENTS COUNT:', cleanAssignments.length);
    console.log('SOCS 4890 ASSIGNMENTS:', cleanAssignments.map(a => ({ title: a.title, weight: a.weightPercentage })));
    console.log('SOCS 4890 READINGS COUNT:', cleanReadings.length);
    console.log('SOCS 4890 WEEKS COUNT:', norm.weeks?.length);

    expect(dto.courseCode).toContain('SOCS');

    expect(cleanAssignments.length).toBe(10);
    expect(cleanReadings.length).toBe(20);
    expect(norm.weeks?.length).toBe(10);
  });
});
