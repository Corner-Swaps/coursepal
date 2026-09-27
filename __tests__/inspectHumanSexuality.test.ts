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

    const critPath = require('path').resolve(__dirname, 'fixtures/Critical_Histories_of_Human_Sexuality_Syllabus.pdf');
    const pyScriptCrit = `import pypdf; r=pypdf.PdfReader('${critPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
    const textCrit = execSync(`python3 -c "${pyScriptCrit}"`, { encoding: 'utf8' });

    const dtoCrit = LocalSyllabusParser.shared.parseText(textCrit);
    const normCrit = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dtoCrit, textCrit);
    const cleanReadingsCrit = SyllabusImportManager.shared.deduplicateReadings(normCrit.candidateReadings, normCrit.textbooks, normCrit.termYear);
    const cleanAssignmentsCrit = SyllabusImportManager.shared.deduplicateAssignments(normCrit.candidateAssignments, normCrit.termYear, normCrit.weekDateMap);

    console.log('\n=== CRITICAL HISTORIES COURSE INFO ===');
    console.log('Code:', dtoCrit.courseCode);
    console.log('Name:', dtoCrit.courseName);
    console.log('Readings count:', cleanReadingsCrit.length);
    cleanReadingsCrit.forEach((r, i) => {
      console.log(`[Crit R${i+1}] Title: "${r.title}" | Wk: ${r.weekNumber} | Author: "${r.authorName}" | Ch: "${r.chapterText}"`);
    });
    console.log('Assignments count:', cleanAssignmentsCrit.length);
    cleanAssignmentsCrit.forEach((a, i) => {
      console.log(`[Crit A${i+1}] Title: "${a.title}" | Wk: ${a.weekNumber} | Mod: "${a.moduleMention}" | Pts: "${a.pointsPossible}" | Wt: "${a.weightPercentage}" | Due: "${a.dueDate}" | Note: "${a.noteText}" | Instructions: "${(a.fullInstructions || '').slice(0, 80)}"`);
    });

    const prjPath = require('path').resolve(__dirname, '../src/assets/syllabi/PRJ_SEX_2026_Human_Sexuality_Syllabus.pdf');
    const pyScriptPrj = `import pypdf; r=pypdf.PdfReader('${prjPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
    const textPrj = execSync(`python3 -c "${pyScriptPrj}"`, { encoding: 'utf8' });

    const dtoPrj = LocalSyllabusParser.shared.parseText(textPrj);
    const normPrj = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dtoPrj, textPrj);
    const cleanReadingsPrj = SyllabusImportManager.shared.deduplicateReadings(normPrj.candidateReadings, normPrj.textbooks, normPrj.termYear);
    const cleanAssignmentsPrj = SyllabusImportManager.shared.deduplicateAssignments(normPrj.candidateAssignments, normPrj.termYear, normPrj.weekDateMap);

    console.log('\n=== PRJ_SEX COURSE INFO ===');
    console.log('Code:', dtoPrj.courseCode);
    console.log('Name:', dtoPrj.courseName);
    console.log('Assignments count:', cleanAssignmentsPrj.length);
    cleanAssignmentsPrj.forEach((a, i) => {
      console.log(`[PRJ A${i+1}] Title: "${a.title}" | Wk: ${a.weekNumber} | Mod: "${a.moduleMention}" | Pts: "${a.pointsPossible}" | Wt: "${a.weightPercentage}" | Due: "${a.dueDate}" | Note: "${a.noteText}" | Instructions: "${(a.fullInstructions || '').slice(0, 80)}"`);
    });
  });
});
