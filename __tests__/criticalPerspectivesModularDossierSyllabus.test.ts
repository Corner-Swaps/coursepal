import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { formatDisplayTitleWithChapter, formatAuthorAndPagesSubtitle } from '../src/utils/readingDisplayHelper';

describe('Critical Perspectives Modular Dossier Syllabus Ingestion Verification', () => {
  const pyScript = `import pypdf; r=pypdf.PdfReader('/Users/slava/.gemini/antigravity/brain/4c112012-49ab-441f-be67-4845c016c820/.user_uploaded/media_1790289747188.pdf'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  const rawText = execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });
  const rawTextPDFKit = require('fs').readFileSync('/tmp/pdfkit_extracted.txt', 'utf8');

  it('correctly parses course identity, code, and termWeeks on Native PDFKit extraction', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawTextPDFKit);
    expect(dto.courseCode).toBe('PRJ-SEX-2026-X');
    expect(dto.courseName).toBe('Critical Perspectives on Human Sexuality & Society');
    expect(dto.termWeeks).toBe(10);
    expect(dto.weeks?.length).toBe(10);
    expect(dto.moduleReadings?.length).toBe(10);
    expect(dto.assignments?.length).toBe(10);
  });

  it('correctly parses course identity, code, and termWeeks', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    expect(dto.courseCode).toBe('PRJ-SEX-2026-X');
    expect(dto.courseName).toBe('Critical Perspectives on Human Sexuality & Society');
    expect(dto.termWeeks).toBe(10);
  });

  it('extracts all 10 distinct weekly readings for weeks 1 through 10 with substantive titles', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    expect(dto.weeks).toBeDefined();
    expect(dto.weeks?.length).toBe(10);

    // Week 1: Michel Foucault
    const w1 = dto.weeks?.find(w => w.weekNumber === 1);
    expect(w1?.theme).toBe('Foundational Discourse');
    const r1 = w1?.readings?.[0];
    expect(r1?.authorName).toBe('Michel Foucault');
    expect(r1?.title).toContain('The History of Sexuality');
    expect(r1?.chapterText).toBe('Ch. 1 & 2');
    expect(r1?.pagesText).toBe('pp. 15–49');

    // Week 2: Carole S. Vance
    const w2 = dto.weeks?.find(w => w.weekNumber === 2);
    expect(w2?.theme).toBe('Social Constructionism');
    const r2 = w2?.readings?.[0];
    expect(r2?.authorName).toBe('Carole S. Vance');
    expect(r2?.title).toBe('Pleasure and Danger: Exploring Female Sexuality');
    expect(r2?.chapterText).toBe('Ch. 1');

    // Week 3: Jonathan Ned Katz
    const w3 = dto.weeks?.find(w => w.weekNumber === 3);
    expect(w3?.theme).toBe('The Invention of Heterosexuality');
    const r3 = w3?.readings?.[0];
    expect(r3?.authorName).toBe('Jonathan Ned Katz');
    expect(r3?.title).toBe('The Invention of Heterosexuality');
    expect(r3?.chapterText).toBe('Ch. 2 & 3');

    // Week 4: Alfred Kinsey et al.
    const w4 = dto.weeks?.find(w => w.weekNumber === 4);
    expect(w4?.theme).toBe('The Kinsey Paradigm & Continuum');
    const r4 = w4?.readings?.[0];
    expect(r4?.authorName).toBe('Alfred Kinsey et al.');
    expect(r4?.title).toBe('Sexual Behavior in the Human Male & Female');
    expect(r4?.chapterText).toBe('Selected Excerpts on the Kinsey Scale');

    // Week 5: Audre Lorde
    const w5 = dto.weeks?.find(w => w.weekNumber === 5);
    expect(w5?.theme).toBe('Black Feminist Erotic Thought');
    const r5 = w5?.readings?.[0];
    expect(r5?.authorName).toBe('Audre Lorde');
    expect(r5?.title).toBe('Uses of the Erotic: The Erotic as Power');
    expect(r5?.resourceTitle).toBe('Sister Outsider: Essays and Speeches');

    // Week 6: María Lugones
    const w6 = dto.weeks?.find(w => w.weekNumber === 6);
    expect(w6?.theme).toBe('Decolonial Queerness');
    const r6 = w6?.readings?.[0];
    expect(r6?.authorName).toBe('María Lugones');
    expect(r6?.title).toContain('Heterosexualism and the Colonial');
    expect(r6?.resourceTitle).toBe('Hypatia');

    // Week 7: Judith Butler
    const w7 = dto.weeks?.find(w => w.weekNumber === 7);
    expect(w7?.theme).toBe('Gender Performativity & Drag');
    const r7 = w7?.readings?.[0];
    expect(r7?.authorName).toBe('Judith Butler');
    expect(r7?.title).toBe('Gender Trouble: Feminism and the Subversion of Identity');
    expect(r7?.chapterText).toBe('Ch. 3');

    // Week 8: Sharif Mowlaboccus
    const w8 = dto.weeks?.find(w => w.weekNumber === 8);
    expect(w8?.theme).toBe('Algorithmic Intimacy & Platforms');
    const r8 = w8?.readings?.[0];
    expect(r8?.authorName).toBe('Sharif Mowlaboccus');
    expect(r8?.title).toBe('Digital Sexualities: Social Relations and Digital Space');
    expect(r8?.chapterText).toBe('Ch. 4');

    // Week 9: Gayle Rubin
    const w9 = dto.weeks?.find(w => w.weekNumber === 9);
    expect(w9?.theme).toBe('Moral Panics & Hierarchies');
    const r9 = w9?.readings?.[0];
    expect(r9?.authorName).toBe('Gayle Rubin');
    expect(r9?.title).toBe('Thinking Sex: Notes for a Radical Theory of the Politics of Sexuality');
    expect(r9?.resourceTitle).toBe('Pleasure and Danger');

    // Week 10: Douglas Crimp
    const w10 = dto.weeks?.find(w => w.weekNumber === 10);
    expect(w10?.theme).toBe('Biopolitics, AIDS & Activism');
    const r10 = w10?.readings?.[0];
    expect(r10?.authorName).toBe('Douglas Crimp');
    expect(r10?.title).toBe('Mourning and Militancy');
    expect(r10?.resourceTitle).toBe('AIDS: Cultural Analysis/Cultural Activism');
  });

  it('extracts all 10 distinct thematic research modules without bleeding to weeks', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    expect(dto.moduleReadings).toBeDefined();
    expect(dto.moduleReadings?.length).toBe(10);

    const m1 = dto.moduleReadings?.find(m => m.moduleNumber === 1);
    expect(m1?.title).toContain('The History of Sexuality');
    expect(m1?.relevantTopics).toBe('Discursive Regimes & Pleasure');
    expect(m1?.moduleMention).toBe('Module 1');
    expect(m1?.authorName).toBe('Michel Foucault');
    expect(m1?.chapterText).toBe('Ch. 1 & 2');
    expect(m1?.summaryText).toContain('Discourse Mapping');
    expect(m1?.weekNumber).toBeUndefined();

    const m2 = dto.moduleReadings?.find(m => m.moduleNumber === 2);
    expect(m2?.title).toBe('Pleasure and Danger: Exploring Female Sexuality');
    expect(m2?.relevantTopics).toBe('Discursive Regimes & Pleasure');
    expect(m2?.authorName).toBe('Carole S. Vance');
    expect(m2?.chapterText).toBe('Ch. 1');
    expect(m2?.summaryText).toContain('Policy Review');

    const m5 = dto.moduleReadings?.find(m => m.moduleNumber === 5);
    expect(m5?.title).toBe('Uses of the Erotic: The Erotic as Power');
    expect(m5?.relevantTopics).toBe('Intersectionality & Decoloniality');
    expect(m5?.authorName).toBe('Audre Lorde');
    expect(m5?.summaryText).toContain('Autoethnography');

    const m6 = dto.moduleReadings?.find(m => m.moduleNumber === 6);
    expect(m6?.title).toContain('Heterosexualism and the Colonial');
    expect(m6?.relevantTopics).toBe('Intersectionality & Decoloniality');
    expect(m6?.authorName).toBe('María Lugones');
    expect(m6?.summaryText).toContain('Global Legal Dossier');

    const m10 = dto.moduleReadings?.find(m => m.moduleNumber === 10);
    expect(m10?.title).toBe('Mourning and Militancy');
    expect(m10?.relevantTopics).toBe('Moral Panics & Biopolitical Crisis');
    expect(m10?.authorName).toBe('Douglas Crimp');
    expect(m10?.summaryText).toContain('Capstone Thesis');
  });

  it('extracts all 10 assignments with honest weights and null points', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    expect(dto.assignments).toBeDefined();
    expect(dto.assignments?.length).toBe(10);

    const a1 = dto.assignments?.find(a => a.assignmentNumber === 1);
    expect(a1?.title).toBe('Discursive Field Mapping');
    expect(a1?.weekNumber).toBe(1);
    expect(a1?.pointsPossible).toBeNull();
    expect(a1?.noteText).toContain('1,500-word Critical Memo');

    const a5 = dto.assignments?.find(a => a.assignmentNumber === 5);
    expect(a5?.title).toBe('Autoethnographic Synthesis');
    expect(a5?.weekNumber).toBe(5);
    expect(a5?.noteText).toContain('1,500-word Reflective Autoethnography');

    const a10 = dto.assignments?.find(a => a.assignmentNumber === 10);
    expect(a10?.title).toBe('Culminating Capstone Research Proposal');
    expect(a10?.weekNumber).toBe(10);
    expect(a10?.noteText).toContain('3,000-word Integrated Research Thesis');
  });

  it('formats display titles without bare chapter mangling or subtitle truncation', () => {
    const titleWeek5 = formatDisplayTitleWithChapter(
      'Uses of the Erotic: The Erotic as Power',
      null,
      'Sister Outsider: Essays and Speeches',
      'Critical Perspectives on Human Sexuality & Society',
      'Audre Lorde'
    );
    expect(titleWeek5).toBe('Uses of the Erotic: The Erotic as Power');

    const titleWeek8 = formatDisplayTitleWithChapter(
      'Digital Sexualities: Social Relations and Digital Space',
      'Ch. 4: App Culture and Space',
      'Digital Sexualities: Social Relations and Digital Space',
      'Critical Perspectives on Human Sexuality & Society',
      'Sharif Mowlaboccus'
    );
    expect(titleWeek8).toContain('Digital Sexualities');
    expect(titleWeek8).toContain('Chapter 4');
    expect(titleWeek8).not.toContain('Chapter 4 – A');

    const titleWeek7 = formatDisplayTitleWithChapter(
      'Gender Trouble: Feminism and the Subversion of Identity',
      'Ch. 3: Bodily Inscriptions',
      'Gender Trouble: Feminism and the Subversion of Identity',
      'Critical Perspectives on Human Sexuality & Society',
      'Judith Butler'
    );
    expect(titleWeek7).toContain('Gender Trouble');
    expect(titleWeek7).toContain('Chapter 3');
  });

  it('normalizes and deduplicates cleanly through SyllabusImportManager with zero cross-bleed', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

    expect(norm.weeks?.length).toBe(10);
    expect(cleanReadings.length).toBe(20); // 10 weekly readings + 10 thematic research modules
    expect(cleanAssignments.length).toBe(10);

    const weekReadings = cleanReadings.filter(r => (r.weekNumber || 0) > 0);
    expect(weekReadings.length).toBe(10);
    weekReadings.forEach(r => expect(r.moduleNumber).toBeFalsy());

    const modReadings = cleanReadings.filter(r => (r.moduleNumber || 0) > 0);
    expect(modReadings.length).toBe(10);
    modReadings.forEach(r => expect(r.weekNumber).toBeFalsy());
  });

  it('normalizes and deduplicates cleanly through SyllabusImportManager with zero cross-bleed on PDFKit text', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawTextPDFKit);
    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawTextPDFKit);
    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

    expect(dto.courseCode).toBe('PRJ-SEX-2026-X');
    expect(dto.courseName).toBe('Critical Perspectives on Human Sexuality & Society');
    expect(norm.weeks?.length).toBe(10);

    const weekReadings = cleanReadings.filter(r => (r.weekNumber || 0) > 0);
    const modReadings = cleanReadings.filter(r => (r.moduleNumber || 0) > 0);

    expect(weekReadings.length).toBe(10);
    expect(modReadings.length).toBe(10);
    expect(cleanAssignments.length).toBe(10);

    // Verify all 10 weeks have readings with valid titles and authors
    for (let w = 1; w <= 10; w++) {
      const r = weekReadings.find(wr => wr.weekNumber === w);
      expect(r).toBeDefined();
      expect(r?.authorName).toBeTruthy();
      expect(r?.title).toBeTruthy();
      expect(r?.moduleNumber).toBeFalsy();
    }

    // Verify all 10 modules have readings with valid titles, authors, and summary target
    for (let m = 1; m <= 10; m++) {
      const mr = modReadings.find(mr => mr.moduleNumber === m);
      expect(mr).toBeDefined();
      expect(mr?.authorName).toBeTruthy();
      expect(mr?.title).toBeTruthy();
      expect(mr?.summaryText).toContain('Applied Deliverable Target:');
      expect(mr?.weekNumber).toBeFalsy();
    }

    // Verify all 10 assignments
    for (let a = 1; a <= 10; a++) {
      const asg = cleanAssignments.find(ca => ca.weekNumber === a);
      expect(asg).toBeDefined();
      expect(asg?.pointsPossible).toBeNull();
      expect(asg?.noteText).toBeTruthy();
    }
  });
});

