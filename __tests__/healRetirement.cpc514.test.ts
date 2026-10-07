import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractPdf(assetName: string): string {
  const filePath = path.resolve(__dirname, '../src/assets/syllabi', assetName);
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });
}

describe('Heal Retirement: CPC 514', () => {
  it('locks genuine parsing for CPC 514 bundled asset without heal injection', () => {
    const rawText = extractPdf('CPC514_Syllabus.pdf');
    const parser = LocalSyllabusParser.shared;
    const importManager = SyllabusImportManager.shared;

    const dto = parser.parseText(rawText);
    const norm = importManager.normalizeAndValidateSyllabusPayload(dto, rawText);
    const cleanAssignments = importManager.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
    const cleanReadings = importManager.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

    console.log('CPC 514 DTO COURSE:', dto.courseCode, dto.courseName);
    console.log('CPC 514 ASSIGNMENTS:', cleanAssignments.map(a => ({ title: a.title, weight: a.weightPercentage })));
    console.log('CPC 514 READINGS COUNT:', cleanReadings.length);

    expect(dto.courseCode).toContain('CPC 514');

    // Genuine assignments from overview table: 5 items totaling 100%
    expect(cleanAssignments.length).toBe(5);
    const weights = cleanAssignments.map(a => parseInt(a.weightPercentage || '0', 10));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    expect(totalWeight).toBe(100);

    expect(cleanAssignments.some(a => /Research Article Analysis/i.test(a.title) && a.weightPercentage === '20%')).toBe(true);
    expect(cleanAssignments.some(a => /Peer Review Discussion/i.test(a.title) && a.weightPercentage === '20%')).toBe(true);
    expect(cleanAssignments.some(a => /Peer Review Group Report/i.test(a.title) && a.weightPercentage === '10%')).toBe(true);
    expect(cleanAssignments.some(a => /Research Study Design/i.test(a.title) && a.weightPercentage === '40%')).toBe(true);
    expect(cleanAssignments.some(a => /Attendance/i.test(a.title) && a.weightPercentage === '10%')).toBe(true);

    // Archetype D: External schedule notice / no weekly schedule in PDF -> 0 fabricated readings
    expect(cleanReadings.length).toBe(0);
  });
});
