import * as fs from 'fs';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

describe('User Scratch Diagnostic', () => {
  it('Parses CalPolyHumboldt', () => {
    if (!fs.existsSync('/tmp/humboldt_text.txt')) return;
    const text = fs.readFileSync('/tmp/humboldt_text.txt', 'utf8');
    const dto = LocalSyllabusParser.shared.parseText(text);
    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

    console.log('\n--- CAL POLY HUMBOLDT DIAGNOSTIC ---');
    console.log('Course Code:', dto.courseCode);
    console.log('Course Name:', dto.courseName);
    console.log('DTO Weeks:', dto.weeks?.length);
    console.log('Clean Readings:', cleanReadings.length);
    console.log('Clean Assignments:', cleanAssignments.length);
    cleanReadings.forEach((r, i) => console.log(`  R[${i}]: "${r.title}" | "${r.authorName}"`));
    cleanAssignments.forEach((a, i) => console.log(`  A[${i}]: "${a.title}" | "${a.pointsPossible}" | "${a.weightPercentage}"`));
  });
});
