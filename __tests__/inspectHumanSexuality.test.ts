import * as fs from 'fs';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

describe('Exact Inspect of Human Sexuality Syllabus Extraction', () => {
  it('Inspects all fields extracted', () => {
    const fixturePath = require('path').resolve(__dirname, 'fixtures/Syllabus_and_Curriculum_Human_Sexuality_and_Social_Theory.pdf');
    const pyScript = `import pypdf; r=pypdf.PdfReader('${fixturePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
    const text = execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });

    const dto = LocalSyllabusParser.shared.parseText(text);
    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

    console.log('\n=== COURSE INFO ===');
    console.log('Code:', dto.courseCode);
    console.log('Name:', dto.courseName);
    console.log('Description:', dto.courseDescription);
    console.log('Instructor:', dto.instructorName);
    console.log('Weeks count:', norm.weeks?.length);

    console.log('\n=== WEEKS ===');
    norm.weeks?.forEach(w => {
      console.log(`Week ${w.weekNumber}: Theme="${w.theme}", Dates="${w.dateRangeStr || w.startDate}"`);
    });

    console.log('\n=== READINGS (' + cleanReadings.length + ') ===');
    cleanReadings.forEach((r, i) => {
      console.log(`[R${i+1}] Title: "${r.title}" | Author: "${r.authorName}" | Resource: "${r.resourceTitle}" | Ch: "${r.chapterText}" | Wk: ${r.weekNumber} | Mod: "${r.moduleMention}" | Due: "${r.dueDate}"`);
    });

    console.log('\n=== ASSIGNMENTS (' + cleanAssignments.length + ') ===');
    cleanAssignments.forEach((a, i) => {
      console.log(`[A${i+1}] Title: "${a.title}" | Wk: ${a.weekNumber} | Mod: "${a.moduleMention}" | Pts: "${a.pointsPossible}" | Wt: "${a.weightPercentage}" | Due: "${a.dueDate}" | Instructions: "${(a.fullInstructions || '').slice(0, 80)}"`);
    });
  });
});
