import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractPdf(assetName: string): string {
  const filePath = path.resolve(__dirname, '../src/assets/syllabi', assetName);
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });
}

describe('Heal Retirement: CPC 512', () => {
  it('locks genuine parsing for CPC 512 bundled asset without heal injection', () => {
    const rawText = extractPdf('CPC512_Syllabus.pdf');
    const parser = LocalSyllabusParser.shared;
    const importManager = SyllabusImportManager.shared;

    const dto = parser.parseText(rawText);
    const norm = importManager.normalizeAndValidateSyllabusPayload(dto, rawText);
    const cleanAssignments = importManager.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
    const cleanReadings = importManager.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

    console.log('CPC 512 DTO ASSIGNMENTS:', (dto.assignments || []).map(a => ({ title: a.title, weight: a.weightPercentage })));
    console.log('CPC 512 CLEAN ASSIGNMENTS:', cleanAssignments.map(a => ({ title: a.title, weight: a.weightPercentage })));
    console.log('CPC 512 CLEAN READINGS COUNT:', cleanReadings.length);

    // Course identity
    expect(dto.courseCode).toContain('CPC 512');

    // Genuine assignments from overview table: 5 items totaling 100%
    expect(cleanAssignments.length).toBe(5);
    const weights = cleanAssignments.map(a => parseInt(a.weightPercentage || '0', 10));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    expect(totalWeight).toBe(100);

    expect(cleanAssignments.some(a => /Genogram/i.test(a.title) && a.weightPercentage === '30%')).toBe(true);
    expect(cleanAssignments.some(a => /Peer Review/i.test(a.title) && a.weightPercentage === '10%')).toBe(true);
    expect(cleanAssignments.some(a => /Assessment and Intervention/i.test(a.title) && a.weightPercentage === '20%')).toBe(true);
    expect(cleanAssignments.some(a => /Collaboration/i.test(a.title) && a.weightPercentage === '20%')).toBe(true);
    expect(cleanAssignments.some(a => /Case Conceptualization/i.test(a.title) && a.weightPercentage === '20%')).toBe(true);

    // Honest behavior: CPC512_Syllabus.pdf has no schedule table or reading list
    // (states "The list of required textbooks is available through CityU Library")
    // It must NEVER invent 10 fake module readings or 12 fake weekly readings.
    expect(cleanReadings.length).toBe(0);
  });
});
