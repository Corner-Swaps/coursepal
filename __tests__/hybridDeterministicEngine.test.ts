import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { BundledSyllabiCatalog } from '../src/utils/syllabusCatalog';
import { execSync } from 'child_process';
import * as path from 'path';

describe('Hybrid Deterministic-First Engine Guarantees', () => {
  it('extracts PRJ-SEX syllabus with 100% fidelity without relying on remote AI', () => {
    const pdfPath = path.resolve(__dirname, '../src/assets/syllabi/PRJ_SEX_2026_Human_Sexuality_Syllabus.pdf');
    const pyScript = `import pypdf; r=pypdf.PdfReader('${pdfPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
    const rawText = execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });

    const localDto = LocalSyllabusParser.shared.parseText(rawText);
    expect(localDto.courseName).toBe('Critical Perspectives on Human Sexuality & Society');
    expect(localDto.courseCode).toBe('PRJ-SEX-2026-X');
    expect(localDto.weeks?.length).toBe(10);
    expect(localDto.assignments?.length).toBe(10);
    expect(localDto.moduleReadings?.length).toBe(10);

    const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(localDto, rawText);
    expect(normalized.weeks.length).toBe(10);
    expect(normalized.candidateAssignments.length).toBe(10);
    expect(normalized.candidateReadings.length).toBe(20);

    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(normalized.candidateReadings, normalized.textbooks, normalized.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(normalized.candidateAssignments, normalized.termYear, normalized.weekDateMap);

    expect(cleanAssignments.length).toBe(10);
    expect(cleanReadings.length).toBe(20);

    // 10 weekly readings (all have weekNumber: 1..10)
    const weekReadings = cleanReadings.filter(r => r.weekNumber != null && r.weekNumber > 0);
    expect(weekReadings.length).toBe(10);
    for (let w = 1; w <= 10; w++) {
      expect(weekReadings.some(r => r.weekNumber === w)).toBe(true);
    }

    // 10 module readings (all have moduleNumber: 1..10, weekNumber: null)
    const moduleReadings = cleanReadings.filter(r => r.moduleNumber != null && r.moduleNumber > 0 && (r.weekNumber == null || r.weekNumber === 0));
    expect(moduleReadings.length).toBe(10);
    for (let m = 1; m <= 10; m++) {
      expect(moduleReadings.some(r => r.moduleNumber === m)).toBe(true);
    }

    // Verify authors are clean full names (not book titles)
    expect(weekReadings[0].authorName).toBe('Michel Foucault');
    expect(weekReadings[1].authorName).toBe('Carole S. Vance');
    expect(weekReadings[2].authorName).toBe('Jonathan Ned Katz');
    expect(weekReadings[3].authorName).toContain('Kinsey');
    expect(weekReadings[4].authorName).toBe('Audre Lorde');
    expect(weekReadings[5].authorName).toBe('María Lugones');
    expect(weekReadings[6].authorName).toBe('Judith Butler');
  });
});
