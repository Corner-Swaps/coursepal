import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractTextFromPdf(filePath: string): string {
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

const userUploadedDir = '/Users/slava/.gemini/antigravity/brain/4c112012-49ab-441f-be67-4845c016c820/.user_uploaded';

describe('Audit Attached Documents Suite', () => {
  it('Audits CPC 511 (Psychology of Loss and Grief)', () => {
    const text = extractTextFromPdf(path.join(userUploadedDir, 'media_1790266914963.pdf'));
    const dto = LocalSyllabusParser.shared.parseText(text);

    console.log('--- CPC 511 ---');
    console.log('Course Name:', dto.courseName);
    console.log('Course Code:', dto.courseCode);
    console.log('Assignments count:', dto.assignments?.length);
    dto.assignments?.forEach(a => {
      console.log(` • Assignment: "${a.title}" | Due: ${a.dueDate || 'Wk ' + a.weekNumber} | Weight: ${a.weightPercentage} | Pts: ${a.pointsPossible}`);
    });
    console.log('Weeks count:', dto.weeks?.length);
    console.log('Textbooks count:', dto.textbooks?.length);
    dto.textbooks?.forEach(t => console.log(` • Textbook: "${t.title}" by ${t.authorName}`));

    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
    console.log('Clean assignments:', cleanAssignments.length);
    console.log('Clean readings:', cleanReadings.length);
  });

  it('Audits CPC 524 (Psychopathology and Psychopharmacology)', () => {
    const text = extractTextFromPdf(path.join(userUploadedDir, 'media_1790266914971.pdf'));
    const dto = LocalSyllabusParser.shared.parseText(text);

    console.log('--- CPC 524 ---');
    console.log('Course Name:', dto.courseName);
    console.log('Course Code:', dto.courseCode);
    console.log('Assignments count:', dto.assignments?.length);
    dto.assignments?.forEach(a => {
      console.log(` • Assignment: "${a.title}" | Due: ${a.dueDate || 'Wk ' + a.weekNumber} | Weight: ${a.weightPercentage} | Pts: ${a.pointsPossible}`);
    });
    console.log('Weeks count:', dto.weeks?.length);
    dto.weeks?.forEach(w => {
      console.log(` • Week ${w.weekNumber} (${w.dateRangeStr}): Theme="${w.theme}", Readings=${w.readings?.length || 0}`);
      w.readings?.forEach(r => {
        console.log(`    - Reading: "${r.authorName}" | "${r.resourceTitle || r.title}" | Ch: ${r.chapterText || 'N/A'}`);
      });
    });

    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
    console.log('Clean assignments:', cleanAssignments.length);
    console.log('Clean readings:', cleanReadings.length);
  });

  it('Audits CPC 527 (Group Counselling Psychology)', () => {
    const text = extractTextFromPdf(path.join(userUploadedDir, 'media_1790266914980.pdf'));
    const dto = LocalSyllabusParser.shared.parseText(text);

    console.log('--- CPC 527 ---');
    console.log('Course Name:', dto.courseName);
    console.log('Course Code:', dto.courseCode);
    console.log('Assignments count:', dto.assignments?.length);
    dto.assignments?.forEach(a => {
      console.log(` • Assignment: "${a.title}" | Due: ${a.dueDate || 'Wk ' + a.weekNumber} | Weight: ${a.weightPercentage} | Pts: ${a.pointsPossible}`);
    });
    console.log('Weeks count:', dto.weeks?.length);
    dto.weeks?.forEach(w => {
      console.log(` • Week ${w.weekNumber} (${w.dateRangeStr}): Theme="${w.theme}", Readings=${w.readings?.length || 0}`);
      w.readings?.forEach(r => {
        console.log(`    - Reading: "${r.authorName}" | "${r.resourceTitle || r.title}" | Ch: ${r.chapterText || 'N/A'}`);
      });
    });

    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
    console.log('Clean assignments:', cleanAssignments.length);
    console.log('Clean readings:', cleanReadings.length);
  });

  it('Audits CPC 514 (Research Methods and Statistics)', () => {
    const text = extractTextFromPdf(path.join(userUploadedDir, 'media_1790266914990.pdf'));
    const dto = LocalSyllabusParser.shared.parseText(text);

    console.log('--- CPC 514 ---');
    console.log('Course Name:', dto.courseName);
    console.log('Course Code:', dto.courseCode);
    console.log('Assignments count:', dto.assignments?.length);
    dto.assignments?.forEach(a => {
      console.log(` • Assignment: "${a.title}" | Due: ${a.dueDate || 'Wk ' + a.weekNumber} | Weight: ${a.weightPercentage} | Pts: ${a.pointsPossible}`);
    });
    console.log('Weeks count:', dto.weeks?.length);
    console.log('Textbooks count:', dto.textbooks?.length);

    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
    console.log('Clean assignments:', cleanAssignments.length);
    console.log('Clean readings:', cleanReadings.length);
  });

  it('Audits CPC 512 Dual-Table Syllabus (Family Systems Approaches to Counselling)', () => {
    const text = `School of Health & Social Sciences
CPC 512: Family Systems Approaches to Counselling
The following modules and topics will be integrated throughout the duration of our learning experience together: 
| Modules   | Topics   | Related Readings    |
| Module 1   | Systems Theory and the History of Family Therapy   | Gehart (Chapters 1-3)   |
| Module 2   | Family of Origin/ Genograms   | Gehart (Chapter 2)   |
| Module 3   | Diverse Populations and Family Therapy Case Conceptualization and Application   | Gehart (Chapters 11-15)   |
| Module 4   | Bowen Family Systems   | Gehart (Chapter 7)   |
| Module 5   | Structural Family Therapy   | Gehart (Chapter 5)   |
| Module 6   | Strategic Family Therapy   | Gehart (Chapter 4)   |
| Module 7   | Experiential Family Therapy   | Gehart (Chapter 6)   |
| Module 8   | Psychoanalytic Family Therapy   | Gehart (Chapter 7)   |
| Module 9   | Cognitive Behavioural Family Therapy  Clinical issues in Family Counselling   | Gehart (Chapter 8)   |
| Module 10   | Social Constructionist Family Therapy  Future Research and Critiques   | Gehart (Chapter 10)   |
*Nichols & Davis Readings = Related but Not Required*
course Schedule – *No ClassEs DURING Reading Week (August 6-7) 
Please note that this schedule can change based on the discretion of faculty and/or student learning.
| Course Session/Date   | Topics, Modules, and Assignments   | Readings   |
| Week 1  July 2/3   | Creating a caring community   Introduction to Family Systems   Course overview    | Gehart chapters 1-3   |
| Week 2  July 9/10   | Introduction to Systems Thinking  Introduction to Mapping Tools    | Gehart chapter 5  Articles    |
| Week 3  July 16/17   | From Theory to Practice   Structural Family Systems    | Gehart chapters 5 & 7   |
| Week 4  July 23/24   | Evidence Based Practice and Empirically Supported Models (TBD)     | Gehart chapter 7   |
| Week 5  July 30/31   | Evidenced-Based Practice and Empirically Supported Models  (group presentations)   | Gehart chapters 4-10  Due: Family Mapping Papers   |
| Week 6  August 6/7   | READING WEEK    | No classes    |
| Week 7  August 13/14   | Evidence Based Practice and Empirically Supported Models  (group presentations)   | Gehart chapters 4-10   |
| Week 8  August 20/21   | Evidence Based Practice and Empirically Supported Models  (group presentations)   | Gehart Chapters 4-10   |
| Week 9  August 27/28   | Case Conceptualization    | Gehart Chapter 11    |
| Week 10  September 3/4   |  Case Conceptualization   *Students will complete an in-class case conceptualization worth 20% of their final mark   | Gehart chapter 11  Review sample comprehensive exam cases in Van General Course Shell    |
| Week 11  September 10/11    | Feedback Case Conceptualizations  Addressing Clinical Issues   Counselling Practice    | Gehart chapters 8   |
| Week 12  September 17/18   | Flex Week    |  |`;

    const dto = LocalSyllabusParser.shared.parseText(text);
    console.log('--- CPC 512 ---');
    console.log('Course Name:', dto.courseName);
    console.log('Course Code:', dto.courseCode);
    console.log('Weeks count:', dto.weeks?.length);
    console.log('Module readings count:', dto.moduleReadings?.length);
    console.log('Assignments count:', dto.assignments?.length);
    dto.weeks?.forEach(w => {
      console.log(` • Week ${w.weekNumber} (${w.dateRangeStr}): Theme="${w.theme}", Readings=${w.readings?.length || 0}`);
      w.readings?.forEach(r => console.log(`    - Reading: "${r.authorName}" | "${r.resourceTitle || r.title}" | Ch: ${r.chapterText || 'N/A'}`));
    });

    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
    console.log('Clean assignments:', cleanAssignments.length);
    console.log('Clean readings:', cleanReadings.length);
  });
});

