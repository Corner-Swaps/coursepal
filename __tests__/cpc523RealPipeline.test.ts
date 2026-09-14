import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import fs from 'fs';
import path from 'path';

describe('CPC 523 Real Syllabus End-to-End Pipeline Verification', () => {
  let syllabusText: string;

  beforeAll(() => {
    // Read cached extraction or run pypdf extraction on the real PDF
    const cachedPath = '/tmp/cpc523_extracted.txt';
    if (fs.existsSync(cachedPath)) {
      syllabusText = fs.readFileSync(cachedPath, 'utf8');
    } else {
      const { execSync } = require('child_process');
      const pdfPath = '/Users/slava/Downloads/Syllabus - CPC 523 MP[38].pdf';
      const pyScript = `import pypdf; r=pypdf.PdfReader('${pdfPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
      syllabusText = execSync(`python3 -c "${pyScript}"`).toString();
    }
  });

  test('Course Identity: extracts CPC 523 and Psychology of Sexuality', () => {
    const result = LocalSyllabusParser.shared.parseText(syllabusText);
    expect(result.courseCode).toBe('CPC 523');
    expect(result.courseName).toContain('Sexuality');
  });

  test('Table Row Mapping: Week 5 maps July 31st with Chapters 10 and 8', () => {
    const result = LocalSyllabusParser.shared.parseText(syllabusText);
    const week5 = result.weeks?.find(w => w.weekNumber === 5);
    expect(week5).toBeDefined();
    expect(week5?.startDate).toBe('Jul 31');

    const week5Readings = (week5?.readings || []).map(r => r.title);
    expect(week5Readings.some(t => t.includes('Chapter 10'))).toBe(true);
    expect(week5Readings.some(t => t.includes('Chapter 8'))).toBe(true);
  });

  test('Table Row Mapping: Week 6 is reading week with 0 readings', () => {
    const result = LocalSyllabusParser.shared.parseText(syllabusText);
    const week6 = result.weeks?.find(w => w.weekNumber === 6);
    expect(week6).toBeDefined();
    expect(week6?.readings?.length || 0).toBe(0);
  });

  test('Table Row Mapping: Week 9 maps August 28th with Chapters 3 and 13', () => {
    const result = LocalSyllabusParser.shared.parseText(syllabusText);
    const week9 = result.weeks?.find(w => w.weekNumber === 9);
    expect(week9).toBeDefined();
    expect(week9?.startDate).toBe('Aug 28');

    const week9Readings = (week9?.readings || []).map(r => r.title);
    expect(week9Readings.some(t => t.includes('Chapter 3'))).toBe(true);
    expect(week9Readings.some(t => t.includes('Chapter 13'))).toBe(true);
  });

  test('Rubric Extraction: Extracts all 6 genuine criteria (10/20/25/15/20/10 points)', () => {
    const result = LocalSyllabusParser.shared.parseText(syllabusText);
    const paper = result.assignments?.find(a => a.title.toLowerCase().includes('research paper'));
    expect(paper).toBeDefined();
    expect(paper?.rubricCriteria?.length).toBe(6);

    const points = paper?.rubricCriteria?.map(c => c.points);
    expect(points).toEqual([10, 20, 25, 15, 20, 10]);

    const names = paper?.rubricCriteria?.map(c => c.criterionName);
    expect(names?.[0]).toContain('Organization');
    expect(names?.[1]).toContain('Evidence');
    expect(names?.[2]).toContain('Analysis');
    expect(names?.[3]).toContain('Ethics');
    expect(names?.[4]).toContain('Cultural');
    expect(names?.[5]).toContain('APA');
  });

  test('Eliminate Fabricated Defaults: missing points or dates remain undefined without 100 Points/25% defaults', () => {
    const result = LocalSyllabusParser.shared.parseText(syllabusText);
    const peerReview = result.assignments?.find(a => a.title.toLowerCase().includes('peer review'));
    expect(peerReview).toBeDefined();
    // In the syllabus, Peer Review has 10% weight but no individual points specified
    expect(peerReview?.pointsPossible).toBeUndefined();
    expect(peerReview?.weightPercentage).toBe('10%');

    // Feed through SyllabusImportManager to verify candidate creation doesn't inject fabricated defaults
    const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(result, syllabusText);
    const candPeerReview = normalized.candidateAssignments.find((a: any) => (a.title || '').toLowerCase().includes('peer review'));
    expect(candPeerReview?.pointsPossible).toBeUndefined();
    expect(candPeerReview?.weightPercentage).toBe('10%');
  });
});
