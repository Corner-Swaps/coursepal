import * as fs from 'fs';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

describe('Inspect User Uploaded Files Parsing', () => {
  const files = [
    { name: 'DATA 630', file: '/tmp/media_1790272219853.pdf.txt' },
    { name: 'CPC 527', file: '/tmp/media_1790272219847.pdf.txt' },
    { name: 'CPC 524', file: '/tmp/media_1790272219842.pdf.txt' },
    { name: 'CPC 511', file: '/tmp/media_1790272219828.pdf.txt' },
    { name: 'Human Sexuality', file: '/tmp/media_1790289747188.pdf.txt' },
    { name: 'CPC 514', file: '/tmp/media_1790267826623.pdf.txt' }
  ];

  files.forEach(({ name, file }) => {
    it(`parses ${name} correctly`, () => {
      if (!fs.existsSync(file)) {
        console.warn(`File not found: ${file}`);
        return;
      }
      const rawText = fs.readFileSync(file, 'utf-8');
      const parsed = LocalSyllabusParser.shared.parseText(rawText);
      const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(parsed, rawText);
      const readings = SyllabusImportManager.shared.deduplicateReadings(
        normalized.candidateReadings,
        normalized.textbooks,
        normalized.termYear
      );
      const assignments = SyllabusImportManager.shared.deduplicateAssignments(
        normalized.candidateAssignments,
        normalized.termYear,
        normalized.weekDateMap
      );

      console.log(`\n========================================`);
      console.log(`PARSED: ${name}`);
      console.log(`Course Code: ${parsed.courseCode}`);
      console.log(`Course Name: ${parsed.courseName}`);
      console.log(`Term Weeks: ${parsed.termWeeks}`);
      console.log(`Weeks Count: ${parsed.weeks?.length || 0}`);
      console.log(`Candidate Readings Count: ${readings.length}`);
      console.log(`Candidate Assignments Count: ${assignments.length}`);
      console.log(`Readings list:`);
      readings.forEach((r, idx) => {
        console.log(`  [R${idx + 1}] W:${r.weekNumber || 'N/A'} M:${r.moduleNumber || 'N/A'} Title: "${r.title}" | Author: "${r.authorName || 'N/A'}"`);
      });
      console.log(`Assignments list:`);
      assignments.forEach((a, idx) => {
        console.log(`  [A${idx + 1}] Title: "${a.title}" | Wk: ${a.weekNumber} | SchedWks: ${JSON.stringify(a.scheduledWeeks)} | Num: ${a.assignmentNumber} | Note: "${a.noteText}" | Due: ${a.dueDate || 'N/A'} | Weight: ${a.weightPercentage || 'N/A'} | Points: ${a.pointsPossible || 'N/A'}`);
      });
    });
  });
});
