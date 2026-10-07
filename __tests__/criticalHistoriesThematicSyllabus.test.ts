import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { Reading, Assignment } from '../src/types/models';

describe('Critical Histories Syllabus Ingestion Verification', () => {
  const pyScript = `import pypdf; r=pypdf.PdfReader('__tests__/fixtures/Critical_Histories_of_Human_Sexuality_Syllabus.pdf'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  const rawText = execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });

  it('correctly parses course identity, code, instructor, and termWeeks', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    expect(dto.courseCode).toBe('SXST-3010');
    expect(dto.courseName).toBe('Critical Histories & Contemporary Perspectives on Human Sexuality');
    expect(dto.instructorName).toBe('Dr. Evelyn Vance');
    expect(dto.termWeeks).toBe(10);
    expect(dto.courseDescription).toContain('investigates sexuality not as an innate biological constant');
  });

  it('extracts all 10 distinct weekly readings for weeks 1 through 10', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    expect(dto.weeks).toBeDefined();
    expect(dto.weeks?.length).toBe(10);

    // Week 1: Havelock Ellis
    const w1 = dto.weeks?.find(w => w.weekNumber === 1);
    expect(w1?.theme).toBe('The Emergence of Modern Western Sexology');
    expect(w1?.readings?.length).toBe(1);
    const r1 = w1?.readings?.[0];
    expect(r1?.authorName).toBe('Havelock Ellis');
    expect(r1?.title).toContain('Studies in the Psychology of Sex');
    expect(r1?.chapterText).toBe('Ch. 1 & 4');
    expect(r1?.pagesText).toBe('pp. 1–45');
    expect(r1?.moduleNumber).toBeUndefined();

    // Week 2: Michel Foucault
    const w2 = dto.weeks?.find(w => w.weekNumber === 2);
    expect(w2?.theme).toBe('The Repressive Hypothesis and Discursive Production');
    const r2 = w2?.readings?.[0];
    expect(r2?.authorName).toBe('Michel Foucault');
    expect(r2?.title).toContain('The History of Sexuality');
    expect(r2?.chapterText).toContain('Ch. 1–2');
    expect(r2?.pagesText).toBe('pp. 17–49');

    // Week 3: Gayle Rubin
    const w3 = dto.weeks?.find(w => w.weekNumber === 3);
    expect(w3?.theme).toBe('Stratification and the Limits of Tolerance');
    const r3 = w3?.readings?.[0];
    expect(r3?.authorName).toBe('Gayle Rubin');
    expect(r3?.title).toContain('Thinking Sex');
    expect(r3?.chapterText).toContain('The Charmed Circle');
    expect(r3?.pagesText).toBe('pp. 267–319');

    // Week 4: Susan Stryker
    const w4 = dto.weeks?.find(w => w.weekNumber === 4);
    expect(w4?.theme).toBe('Transgender Genealogies and Bodily Autonomy');
    const r4 = w4?.readings?.[0];
    expect(r4?.authorName).toBe('Susan Stryker');
    expect(r4?.title).toContain('Transgender History');
    expect(r4?.title).toContain('A Hundred Years of Transgender History');
    expect(r4?.chapterText).toContain('Chapter 2');
    expect(r4?.pagesText).toBe('pp. 45–90');
    expect(r4?.summaryText).toContain('street resistance');
    expect(r4?.summaryText).not.toContain('WEEKLY COURSE READINGS');
    expect(r4?.summaryText).not.toContain('Page 1');

    // Week 5: Audre Lorde
    const w5 = dto.weeks?.find(w => w.weekNumber === 5);
    const r5 = w5?.readings?.[0];
    expect(r5?.authorName).toBe('Audre Lorde');
    expect(r5?.title).toContain('Uses of the Erotic: The Erotic as Power');
    expect(r5?.resourceTitle).toContain('Sister Outsider: Essays and Speeches');
    expect(r5?.pagesText).toBe('pp. 53–59');

    // Week 6: Adrienne Rich
    const w6 = dto.weeks?.find(w => w.weekNumber === 6);
    const r6 = w6?.readings?.[0];
    expect(r6?.authorName).toBe('Adrienne Rich');
    expect(r6?.title).toContain('Compulsory Heterosexuality and Lesbian Existence');
    expect(r6?.resourceTitle).toContain('Signs, Vol. 5, No. 4');
    expect(r6?.pagesText).toBe('pp. 631–660');

    // Week 7: Jack Halberstam
    const w7 = dto.weeks?.find(w => w.weekNumber === 7);
    const r7 = w7?.readings?.[0];
    expect(r7?.authorName).toBe('Jack Halberstam');
    expect(r7?.title).toContain('In a Queer Time and Place');
    expect(r7?.chapterText).toContain('Ch. 1');
    expect(r7?.pagesText).toBe('pp. 1–21');

    // Week 8: Kath Weston
    const w8 = dto.weeks?.find(w => w.weekNumber === 8);
    const r8 = w8?.readings?.[0];
    expect(r8?.authorName).toBe('Kath Weston');
    expect(r8?.title).toContain('Families We Choose');
    expect(r8?.chapterText).toContain('Ch. 4');
    expect(r8?.pagesText).toBe('pp. 103–136');

    // Week 9: Susanna Paasonen
    const w9 = dto.weeks?.find(w => w.weekNumber === 9);
    const r9 = w9?.readings?.[0];
    expect(r9?.authorName).toBe('Susanna Paasonen');
    expect(r9?.title).toContain('Carnal Resonance');
    expect(r9?.chapterText).toContain('Ch. 3');
    expect(r9?.pagesText).toBe('pp. 77–112');

    // Week 10: Robert McRuer
    const w10 = dto.weeks?.find(w => w.weekNumber === 10);
    const r10 = w10?.readings?.[0];
    expect(r10?.authorName).toBe('Robert McRuer');
    expect(r10?.title).toContain('Crip Theory');
    expect(r10?.chapterText).toContain('Ch. 1');
    expect(r10?.pagesText).toBe('pp. 1–32');
  });

  it('extracts all 10 distinct thematic research modules without bleeding to weeks', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    expect(dto.moduleReadings).toBeDefined();
    expect(dto.moduleReadings?.length).toBe(10);

    const m1 = dto.moduleReadings?.find(m => m.moduleNumber === 1);
    expect(m1?.title).toBe('Medicalization & Diagnostic Power');
    expect(m1?.moduleMention).toBe('Module 1');
    expect(m1?.weekNumber).toBeUndefined();
    expect(m1?.summaryText).toContain('DSM pathology revisions');

    const m5 = dto.moduleReadings?.find(m => m.moduleNumber === 5);
    expect(m5?.title).toBe('Black Queer Studies & Decoloniality');

    const m10 = dto.moduleReadings?.find(m => m.moduleNumber === 10);
    expect(m10?.title).toBe('Technoculture & Synthetic Desires');
  });

  it('extracts all 10 assignments with honest weights totaling 100% and null points', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    expect(dto.assignments).toBeDefined();
    expect(dto.assignments?.length).toBe(10);

    // Assignment 1: Précis (Week 2, 5%)
    const a1 = dto.assignments?.find(a => a.assignmentNumber === 1);
    expect(a1?.title).toBe('Précis');
    expect(a1?.weekNumber).toBe(2);
    expect(a1?.weightPercentage).toBe('5%');
    expect(a1?.pointsPossible).toBeNull();
    expect(a1?.fullInstructions).toContain('500-word critical précis');

    // Assignment 4: Midterm Essay (Week 5, 15%)
    const a4 = dto.assignments?.find(a => a.assignmentNumber === 4);
    expect(a4?.title).toBe('Midterm Essay');
    expect(a4?.weekNumber).toBe(5);
    expect(a4?.weightPercentage).toBe('15%');

    // Assignment 10: Capstone Essay (Exam Week / 10, 20%)
    const a10 = dto.assignments?.find(a => a.assignmentNumber === 10);
    expect(a10?.title).toBe('Capstone Essay');
    expect(a10?.weightPercentage).toBe('20%');
    expect(a10?.dueDate).toContain('2026-12-14');

    const totalWeight = dto.assignments?.reduce((sum, a) => sum + (parseInt(a.weightPercentage || '0', 10) || 0), 0);
    expect(totalWeight).toBe(100);
  });

  it('normalizes and deduplicates cleanly through SyllabusImportManager with zero cross-bleed', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

    expect(norm.weeks?.length).toBe(10);
    expect(cleanReadings.length).toBe(20); // 10 weekly readings + 10 thematic research modules
    expect(cleanAssignments.length).toBe(10);

    console.log('\n--- CLEAN READINGS (WEEKS) ---');
    cleanReadings.filter(r => (r.weekNumber || 0) > 0).forEach(r => {
      console.log(`W${r.weekNumber} Title: "${r.title}" | Author: "${r.authorName}" | Chapter: "${r.chapterText}" | Resource: "${r.resourceTitle}"`);
    });

    console.log('\n--- CLEAN READINGS (MODULES) ---');
    cleanReadings.filter(r => (r.moduleNumber || 0) > 0).forEach(r => {
      console.log(`M${r.moduleNumber} Title: "${r.title}" | Author: "${r.authorName}" | Summary: "${r.summaryText}"`);
    });

    console.log('\n--- CLEAN ASSIGNMENTS ---');
    cleanAssignments.forEach(a => {
      console.log(`A${a.assignmentNumber || a.weekNumber} Title: "${a.title}" | Weight: "${a.weightPercentage}" | Points: "${a.pointsPossible}" | Note: "${a.noteText}" | Due: "${a.dueDate}"`);
    });

    // Check zero cross-bleed: 10 readings have weekNumber > 0 and no moduleNumber
    const weekReadings = cleanReadings.filter(r => (r.weekNumber || 0) > 0);
    expect(weekReadings.length).toBe(10);
    weekReadings.forEach(r => expect(r.moduleNumber).toBeFalsy());

    // Check zero cross-bleed: 10 module readings have moduleNumber > 0 and no weekNumber
    const modReadings = cleanReadings.filter(r => (r.moduleNumber || 0) > 0);
    expect(modReadings.length).toBe(10);
    modReadings.forEach(r => expect(r.weekNumber).toBeFalsy());

    // Check assignment 10 due date
    const capstone = cleanAssignments.find(a => a.assignmentNumber === 10);
    expect(capstone?.dueDate ? (typeof capstone.dueDate === 'string' ? capstone.dueDate : capstone.dueDate.toISOString()) : null).toContain('2026-12-14');
  });
});

