import * as fs from 'fs';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

describe('Multi-Document Ingestion & Separation Diagnostics', () => {
  const files = [
    { name: 'cpc511.txt', label: 'CPC 511 Simple Syllabus' },
    { name: 'cpc524.txt', label: 'CPC 524 Simple Syllabus' },
    { name: 'critical_histories.txt', label: 'Critical Histories' },
    { name: 'research_syllabus.txt', label: 'Research Syllabus' },
    { name: 'socs_theory.txt', label: 'SOCS Theory' },
    { name: 'cpc527.txt', label: 'CPC 527 Simple Syllabus' },
  ];

  files.forEach(f => {
    const p = `/tmp/extracted_syllabi/${f.name}`;
    if (!fs.existsSync(p)) return;

    it(`parses and normalizes ${f.label}`, () => {
      const text = fs.readFileSync(p, 'utf8');
      console.log(`\n=================== ${f.label} (${text.length} chars) ===================`);
      const dto = LocalSyllabusParser.shared.parseText(text);
      console.log('DTO Code:', dto.courseCode, '| Name:', dto.courseName, '| Weeks:', dto.weeks?.length, '| Readings:', dto.readings?.length, '| Assigns:', dto.assignments?.length);

      const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      console.log('Normalized Code:', normalized.courseCode, '| Name:', normalized.courseName);
      console.log('Candidate Readings:', normalized.candidateReadings.length, '| Candidate Assigns:', normalized.candidateAssignments.length, '| Weeks:', normalized.weeks.length);

      const outcome = SyllabusImportManager.shared.determineImportOutcome({
        fileName: f.name,
        hasReadablePayload: true,
        isApiSuccess: Boolean(normalized.candidateAssignments.length || normalized.candidateReadings.length || normalized.weeks.length),
        isFallbackUsed: false,
        isPartial: normalized.isPartial,
        readingsCount: normalized.candidateReadings.length,
        assignmentsCount: normalized.candidateAssignments.length,
        saveSuccess: true
      });
      console.log('Outcome:', outcome.outcome, '| Success:', outcome.success, '| Message:', outcome.message);
    });
  });
});
