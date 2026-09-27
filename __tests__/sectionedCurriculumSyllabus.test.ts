import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractTextFromPdf(filePath: string): string {
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

describe('Sectioned Curriculum & Practicum Syllabus Ingestion Suite (Human Sexuality & Social Theory)', () => {
  const pdfPath = path.resolve(__dirname, 'fixtures/Syllabus_and_Curriculum_Human_Sexuality_and_Social_Theory.pdf');
  let rawText: string;
  let dto: any;
  let norm: any;
  let cleanReadings: any[];
  let cleanAssignments: any[];

  beforeAll(() => {
    rawText = extractTextFromPdf(pdfPath);
    dto = LocalSyllabusParser.shared.parseText(rawText);
    norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);
    cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
  });

  test('001: Extracts correct Course Code SOCS-4890 / GS-802', () => {
    expect(dto.courseCode).toContain('SOCS-4890');
    expect(dto.courseCode).toContain('GS-802');
  });

  test('002: Extracts correct Course Name Human Sexuality: Critical Foundations, Theory & Practice', () => {
    expect(dto.courseName).toContain('Human Sexuality');
    expect(dto.courseName).toContain('Theory & Practice');
  });

  test('003: Populates exactly 10 calendar weeks', () => {
    expect(dto.weeks?.length).toBe(10);
    expect(norm.weeks?.length).toBe(10);
  });

  test('004: Extracts exactly 10 distinct weekly readings (never just 1)', () => {
    const weeklyReadings = cleanReadings.filter(r => r.weekNumber != null);
    expect(weeklyReadings.length).toBe(10);
  });

  test('005: Week 1 reading is Foucault: The History of Sexuality, Vol. 1', () => {
    const r1 = cleanReadings.find(r => r.weekNumber === 1);
    expect(r1).toBeDefined();
    expect(r1.title).toContain('The History of Sexuality');
    expect(r1.authorName).toContain('Michel Foucault');
    expect(r1.chapterText).toContain('Part One');
  });

  test('006: Week 2 reading is Butler: Gender Trouble', () => {
    const r2 = cleanReadings.find(r => r.weekNumber === 2);
    expect(r2).toBeDefined();
    expect(r2.title).toContain('Gender Trouble');
    expect(r2.authorName).toContain('Judith Butler');
  });

  test('007: Week 3 reading is Sedgwick: Epistemology of the Closet', () => {
    const r3 = cleanReadings.find(r => r.weekNumber === 3);
    expect(r3).toBeDefined();
    expect(r3.title).toContain('Epistemology of the Closet');
    expect(r3.authorName).toContain('Eve Kosofsky Sedgwick');
  });

  test('008: Week 4 reading is Rubin: Thinking Sex', () => {
    const r4 = cleanReadings.find(r => r.weekNumber === 4);
    expect(r4).toBeDefined();
    expect(r4.title).toContain('Thinking Sex');
    expect(r4.authorName).toContain('Gayle S. Rubin');
  });

  test('009: Week 5 reading is Collins: Black Sexual Politics', () => {
    const r5 = cleanReadings.find(r => r.weekNumber === 5);
    expect(r5).toBeDefined();
    expect(r5.title).toContain('Black Sexual Politics');
    expect(r5.authorName).toContain('Patricia Hill Collins');
  });

  test('010: Week 6 reading is Stoler: Race and the Education of Desire', () => {
    const r6 = cleanReadings.find(r => r.weekNumber === 6);
    expect(r6).toBeDefined();
    expect(r6.title).toContain('Race and the Education of Desire');
    expect(r6.authorName).toContain('Ann Laura Stoler');
  });

  test('011: Week 7 reading is Clare: Exile and Pride', () => {
    const r7 = cleanReadings.find(r => r.weekNumber === 7);
    expect(r7).toBeDefined();
    expect(r7.title).toContain('Exile and Pride');
    expect(r7.authorName).toContain('Eli Clare');
  });

  test('012: Week 8 reading is Katz: The Invention of Heterosexuality', () => {
    const r8 = cleanReadings.find(r => r.weekNumber === 8);
    expect(r8).toBeDefined();
    expect(r8.title).toContain('The Invention of Heterosexuality');
    expect(r8.authorName).toContain('Jonathan Ned Katz');
  });

  test('013: Week 9 reading is Muñoz: Cruising Utopia', () => {
    const r9 = cleanReadings.find(r => r.weekNumber === 9);
    expect(r9).toBeDefined();
    expect(r9.title).toContain('Cruising Utopia');
    expect(r9.authorName).toContain('José Esteban Muñoz');
  });

  test('014: Week 10 reading is Boyce et al.: Intimate Disconnections', () => {
    const r10 = cleanReadings.find(r => r.weekNumber === 10);
    expect(r10).toBeDefined();
    expect(r10.title).toContain('Intimate Disconnections');
    expect(r10.authorName).toContain('Paul Boyce');
  });

  test('015: Extracts exactly 10 distinct curriculum module readings', () => {
    expect(dto.moduleReadings?.length).toBe(10);
    const m7 = dto.moduleReadings.find((m: any) => m.moduleNumber === 7);
    expect(m7.title).toBe('Kinship Systems & Affective Economies');
    const m9 = dto.moduleReadings.find((m: any) => m.moduleNumber === 9);
    expect(m9.title).toBe('Algorithmic Desires & Screen Intimacy');
  });

  test('016: Extracts exactly 10 practicum assignments with genuine points and due weeks', () => {
    expect(cleanAssignments.length).toBe(10);
    const a1 = cleanAssignments.find(a => a.assignmentNumber === 1);
    expect(a1.title).toBe('Discourse Analysis');
    expect(a1.pointsPossible?.toLowerCase()).toBe('100 pts');
    expect(a1.weekNumber).toBe(1);

    const a5 = cleanAssignments.find(a => a.assignmentNumber === 5);
    expect(a5.title).toBe('Intersectional Archive Audit');
    expect(a5.pointsPossible?.toLowerCase()).toBe('150 pts');
    expect(a5.weekNumber).toBe(6);

    const a10 = cleanAssignments.find(a => a.assignmentNumber === 10);
    expect(a10.title).toBe('Capstone Futurities Project');
    expect(a10.pointsPossible?.toLowerCase()).toBe('300 pts');
    expect(a10.weekNumber).toBe(10);
  });

  test('017: Correctly processes native PDFKit extracted layout without mangled authors or titles', () => {
    const pdfkitText = extractTextFromPdf(pdfPath);
    const pDto = LocalSyllabusParser.shared.parseText(pdfkitText);
    const pNorm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(pDto, pdfkitText);
    const pReadings = SyllabusImportManager.shared.deduplicateReadings(pNorm.candidateReadings, pNorm.textbooks, pNorm.termYear);
    const pAssignments = SyllabusImportManager.shared.deduplicateAssignments(pNorm.candidateAssignments, pNorm.termYear, pNorm.weekDateMap);

    expect(pReadings.length).toBe(20);
    expect(pReadings.filter(r => (r.weekNumber || 0) > 0).length).toBe(10);
    expect(pReadings.filter(r => !r.weekNumber && (r.moduleNumber || 0) > 0).length).toBe(10);
    expect(pAssignments.length).toBe(10);

    // Verify authors are clean and never contain garbage tokens
    for (const r of pReadings.filter(r => (r.weekNumber || 0) > 0)) {
      expect(r.authorName).toBeDefined();
      expect(r.authorName).not.toContain('Closet Author');
      expect(r.authorName).not.toContain('Labor Sex');
      expect(r.authorName).not.toContain('and politics');
      expect(r.authorName).not.toContain('Vintage Books');
      expect(r.title).not.toContain('Author:');
    }

    // Verify Assignment 10 note does not contain page footer
    const a10 = pAssignments.find(a => a.assignmentNumber === 10);
    expect(a10).toBeDefined();
    expect(a10?.noteText).not.toContain('Page 5');
  });
});
