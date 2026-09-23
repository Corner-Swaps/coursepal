import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractTextFromPdf(filePath: string): string {
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

describe('User Syllabi Comprehensive Audit: 100% Full Author Names & Offline Execution', () => {
  const userUploadedDir = '/Users/slava/.gemini/antigravity/brain/4c112012-49ab-441f-be67-4845c016c820/.user_uploaded';

  it('1. Audits DATA 630 (media_1790163839403.pdf) with Full Author Names', () => {
    const pdfPath = path.join(userUploadedDir, 'media_1790163839403.pdf');
    const text = extractTextFromPdf(pdfPath);
    const dto = LocalSyllabusParser.shared.parseText(text);

    expect(dto.courseCode).toBe('DATA 630');
    expect(dto.courseName).toContain('Scalable Machine Learning Systems');
    expect(dto.instructorName).toContain('Marcus Vance');

    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

    expect(cleanReadings.length).toBeGreaterThan(0);
    const authors = cleanReadings.map(r => r.authorName).filter(Boolean);
    expect(authors.some(a => a === 'Chip Huyen')).toBe(true);
    expect(authors.some(a => a === 'Martin Kleppmann')).toBe(true);
    expect(authors.some(a => a === 'Shen Li et al.' || a?.includes('Li et al.'))).toBe(true);
    expect(authors.some(a => a === 'Samyam Rajbhandari et al.')).toBe(true);
    expect(authors.some(a => a === 'Mohammad Shoeybi et al.')).toBe(true);

    // Verify course title is not a media stub
    expect(norm.courseName).not.toContain('media_');
  });

  it('2. Audits NEUR 740 (media_1790163839404.pdf) with Full Author Names', () => {
    const pdfPath = path.join(userUploadedDir, 'media_1790163839404.pdf');
    const text = extractTextFromPdf(pdfPath);
    const dto = LocalSyllabusParser.shared.parseText(text);

    expect(dto.courseCode).toBe('NEUR 740');
    expect(dto.courseName).toContain('Neuropsychological Assessment');
    expect(dto.instructorName).toContain('Elena Vance');

    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

    expect(cleanReadings.length).toBeGreaterThan(0);
    const authors = cleanReadings.map(r => r.authorName).filter(Boolean);

    // Verify FULL names of clinical authors
    expect(authors.some(a => a === 'Muriel D. Lezak et al.' || a?.includes('Lezak'))).toBe(true);
    expect(authors.some(a => a === 'Gary Groth-Marnat')).toBe(true);
    expect(authors.some(a => a === 'Jeffrey L. Cummings & Michael S. Mega')).toBe(true);
    expect(authors.some(a => a === 'Alexander R. Luria')).toBe(true);

    // Verify textbooks do not have pure chapter titles like '(Ch. 6)'
    norm.textbooks.forEach(tb => {
      expect(tb.title).not.toMatch(/^\(?\s*ch(?:apter)?s?\.?\s*[\d\s&,\-–—]+\s*\)?$/i);
    });
  });

  it('3. Audits PSYC 612 (media_1790163839405.pdf) with Full Author Names', () => {
    const pdfPath = path.join(userUploadedDir, 'media_1790163839405.pdf');
    const text = extractTextFromPdf(pdfPath);
    const dto = LocalSyllabusParser.shared.parseText(text);

    expect(dto.courseCode).toBe('PSYC 612');
    expect(dto.courseName).toContain('Advanced Cognitive Behavioural Interventions');
    expect(dto.instructorName).toContain('Aris Thorne');

    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

    expect(cleanReadings.length).toBeGreaterThan(0);
    const authors = cleanReadings.map(r => r.authorName).filter(Boolean);

    // Verify FULL names of CBT authors
    expect(authors.some(a => a === 'Judith S. Beck')).toBe(true);
    expect(authors.some(a => a === 'Jacqueline B. Persons')).toBe(true);
    expect(authors.some(a => a === 'Marsha M. Linehan')).toBe(true);
  });

  it('4. Audits CPC 514 (media_1790163839447.pdf) with Full Author Names & Rubric', () => {
    const pdfPath = path.join(userUploadedDir, 'media_1790163839447.pdf');
    const text = extractTextFromPdf(pdfPath);
    const dto = LocalSyllabusParser.shared.parseText(text);

    expect(dto.courseCode).toBe('CPC 514');
    expect(dto.courseName).toBe('Research Methods and Statistics');
    expect(dto.instructorName).toContain('Taromi');
    expect(dto.externalScheduleNotice).toBeDefined();

    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);

    // Verify Creswell textbook extracted with FULL authors
    expect(norm.textbooks.length).toBeGreaterThan(0);
    const creswell = norm.textbooks.find(t => t.authorName?.toLowerCase().includes('creswell') || t.title.toLowerCase().includes('creswell') || t.title.toLowerCase().includes('research design'));
    expect(creswell).toBeDefined();
    expect(creswell?.authorName).toBe('John W. Creswell & J. David Creswell');

    // Verify key assignments and rubric points
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
    expect(cleanAssignments.length).toBeGreaterThanOrEqual(4);
    const studyDesign = cleanAssignments.find(a => a.title?.toLowerCase().includes('study design'));
    expect(studyDesign).toBeDefined();
    expect(studyDesign?.weightPercentage).toBe('40%');
  });

  it('5. Audits PRJ-SEX-2026-X (media_1790105675747.pdf) with Full Author Names', () => {
    const pdfPath = path.join(userUploadedDir, 'media_1790105675747.pdf');
    const text = extractTextFromPdf(pdfPath);
    const dto = LocalSyllabusParser.shared.parseText(text);

    expect(dto.courseCode).toBe('PRJ-SEX-2026-X');
    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

    expect(cleanReadings.length).toBe(20);
    const authors = cleanReadings.map(r => r.authorName).filter(Boolean);

    // Verify FULL names of humanities & gender studies authors
    expect(authors.some(a => a === 'Michel Foucault')).toBe(true);
    expect(authors.some(a => a === 'Carole S. Vance')).toBe(true);
    expect(authors.some(a => a === 'Jonathan Ned Katz')).toBe(true);
    expect(authors.some(a => a === 'Alfred Kinsey et al.')).toBe(true);
    expect(authors.some(a => a === 'Audre Lorde')).toBe(true);
    expect(authors.some(a => a === 'María Lugones')).toBe(true);
    expect(authors.some(a => a === 'Judith Butler')).toBe(true);
    expect(authors.some(a => a === 'Sharif Mowlaboccus')).toBe(true);
    expect(authors.some(a => a === 'Gayle Rubin')).toBe(true);
    expect(authors.some(a => a === 'Douglas Crimp')).toBe(true);
  });
});
