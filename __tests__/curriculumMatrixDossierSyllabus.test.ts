import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

describe('Curriculum Matrix & Modular Research Dossier Syllabus Suite (PRJ-SEX-2026-X)', () => {
  const pdfPath = path.resolve(__dirname, '../src/assets/syllabi/PRJ_SEX_2026_Human_Sexuality_Syllabus.pdf');
  let rawText = '';

  beforeAll(() => {
    if (fs.existsSync('/tmp/uploaded_syllabus_text.txt')) {
      rawText = fs.readFileSync('/tmp/uploaded_syllabus_text.txt', 'utf8');
    } else {
      const pyScript = `import pypdf; r=pypdf.PdfReader('${pdfPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
      rawText = execSync(`python3 -c "${pyScript}"`, { encoding: 'utf8' });
    }
  });

  it('correctly extracts course identity, code, and title without noise', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    expect(dto.courseName).toBe('Critical Perspectives on Human Sexuality & Society');
    expect(dto.courseCode).toBe('PRJ-SEX-2026-X');
    expect(dto.termWeeks).toBe(10);
  });

  it('extracts all 10 distinct weekly readings with authors, resources, and chapters', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    expect(dto.weeks).toBeDefined();
    expect(dto.weeks!.length).toBe(10);

    const week1Reading = dto.weeks![0].readings![0];
    expect(week1Reading.authorName).toBe('Michel Foucault');
    expect(week1Reading.resourceTitle).toContain('The History of Sexuality');
    expect(week1Reading.chapterText).toBe('Ch. 1 & 2');
    expect(week1Reading.pagesText).toBe('pp. 15–49');
    expect(week1Reading.weekNumber).toBe(1);

    const week2Reading = dto.weeks![1].readings![0];
    expect(week2Reading.authorName).toBe('Carole S. Vance');
    expect(week2Reading.resourceTitle).toContain('Pleasure and Danger');
    expect(week2Reading.chapterText).toBe('Ch. 1');
    expect(week2Reading.weekNumber).toBe(2);

    const week7Reading = dto.weeks![6].readings![0];
    expect(week7Reading.authorName).toBe('Judith Butler');
    expect(week7Reading.resourceTitle).toContain('Gender Trouble');
    expect(week7Reading.chapterText).toBe('Ch. 3');
    expect(week7Reading.weekNumber).toBe(7);

    const week10Reading = dto.weeks![9].readings![0];
    expect(week10Reading.authorName).toBe('Douglas Crimp');
    expect(week10Reading.resourceTitle).toContain('AIDS: Cultural Analysis');
    expect(week10Reading.weekNumber).toBe(10);
  });

  it('extracts all 10 weekly assignments with full titles, week due dates, and deliverable specifications', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    expect(dto.assignments).toBeDefined();
    expect(dto.assignments!.length).toBe(10);

    const expectedAssignments = [
      { num: 1, title: 'Discursive Field Mapping', week: 1, deliv: '1,500-word Critical Memo & Textual Deconstruction' },
      { num: 2, title: 'Policy Dilemma Case Analysis', week: 2, deliv: '1,200-word Comparative Review & Annotated Chart' },
      { num: 3, title: 'Historical Lexicon Archival Audit', week: 3, deliv: 'Primary Source Primary Dossier & Etymological Timeline' },
      { num: 4, title: 'Survey Methodology Evaluation', week: 4, deliv: '1,500-word Methodological Critique & Revised Survey Tool' },
      { num: 5, title: 'Autoethnographic Synthesis', week: 5, deliv: '1,500-word Reflective Autoethnography on Erotic Power' },
      { num: 6, title: 'Global Legal Comparative Dossier', week: 6, deliv: 'Comparative Legal Policy Matrix & 1,000-word Synthesis' },
      { num: 7, title: 'Semiotic Media Analysis', week: 7, deliv: '1,500-word Semiotic Breakdown of Pop Culture Artifacts' },
      { num: 8, title: 'UX & Algorithmic Architecture Audit', week: 8, deliv: 'Interface Design Teardown & Ethical Blueprint (1,200 words)' },
      { num: 9, title: 'Legislative Discourse Policy Brief', week: 9, deliv: '1,500-word Legislative Brief on Contested Legislation' },
      { num: 10, title: 'Culminating Capstone Research Proposal', week: 10, deliv: '3,000-word Integrated Research Thesis & Ethics Protocol' }
    ];

    expectedAssignments.forEach((exp, idx) => {
      const a = dto.assignments![idx];
      expect(a.assignmentNumber).toBe(exp.num);
      expect(a.title).toBe(exp.title);
      expect(a.weekNumber).toBe(exp.week);
      expect(a.noteText).toBe(exp.deliv);
      expect(a.fullInstructions).toContain(exp.deliv);
    });
  });

  it('extracts curriculum modules from the Page 5 Module Table with Zero Cross-Bleed', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    expect(dto.moduleReadings).toBeDefined();
    expect(dto.moduleReadings!.length).toBe(10);

    // All module readings have module numbers 1..10 and NO weekly due date (Zero Cross-Bleed Rule)
    dto.moduleReadings!.forEach(mr => {
      expect(mr.moduleNumber).toBeGreaterThanOrEqual(1);
      expect(mr.moduleNumber).toBeLessThanOrEqual(10);
      expect(mr.weekNumber).toBeUndefined();
    });

    // Verify themes for modules
    expect(dto.moduleReadings![0].relevantTopics).toBe('Discursive Regimes & Pleasure');
    expect(dto.moduleReadings![2].relevantTopics).toBe('Medicalization & Scalar Variance');
    expect(dto.moduleReadings![4].relevantTopics).toBe('Intersectionality & Decoloniality');
    expect(dto.moduleReadings![6].relevantTopics).toBe('Performativity & Platforms');
    expect(dto.moduleReadings![8].relevantTopics).toBe('Moral Panics & Biopolitical Crisis');
  });

  it('normalizes cleanly through SyllabusImportManager and deduplicates with zero data loss', () => {
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);

    expect(norm.candidateAssignments.length).toBe(10);
    expect(norm.weeks.length).toBe(10);

    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

    expect(cleanAssignments.length).toBe(10);
    expect(cleanReadings.length).toBeGreaterThanOrEqual(10);

    // Verify weekly readings have their weekNumber intact
    const weekReadings = cleanReadings.filter(r => r.weekNumber != null && r.weekNumber > 0);
    expect(weekReadings.length).toBe(10);

    // Verify module readings have their moduleNumber intact
    const modReadings = cleanReadings.filter(r => r.moduleNumber != null && r.moduleNumber > 0 && (r.weekNumber == null || r.weekNumber === 0));
    expect(modReadings.length).toBeGreaterThanOrEqual(10);
  });

  it('normalizes the AI schedule and course_details schema with 100% fidelity', () => {
    let aiRaw: any;
    if (fs.existsSync('/tmp/raw_gemini_response.txt')) {
      aiRaw = JSON.parse(fs.readFileSync('/tmp/raw_gemini_response.txt', 'utf8'));
    } else {
      aiRaw = {
        course_details: {
          title: 'Critical Perspectives on Human Sexuality & Society',
          program: 'Socio-Cultural & Gender Studies Framework',
          archival_reference: 'PRJ-SEX-2026-X',
          status: 'Active Research & Syllabi'
        },
        schedule: [
          {
            modules: '1 & 2',
            weeks: 'Weeks 1-2',
            unit: 'Theoretical Foundation & Epistemological Framework',
            core_theoretical_focus: 'Discursive Regimes & Pleasure',
            readings: [
              'Foucault, M. | The History of Sexuality, Vol. 1: An Introduction | Ch. 1 & 2 (pp. 15–49)',
              'Vance, C. S. | Pleasure and Danger: Exploring Female Sexuality | Ch. 1: "More Danger, More Pleasure"'
            ],
            assignments: [
              {
                title: 'Discursive Field Mapping',
                due: 'Week 1',
                deliverable: '1,500-word Critical Memo & Textual Deconstruction'
              },
              {
                title: 'Policy Dilemma Case Analysis',
                due: 'Week 2',
                deliverable: '1,200-word Comparative Review & Annotated Chart'
              }
            ]
          },
          {
            modules: '3 & 4',
            weeks: 'Weeks 3-4',
            unit: 'Historical & Empirical Methodologies',
            core_theoretical_focus: 'Medicalization & Scalar Variance',
            readings: [
              'Laqueur, T. | Making Sex: Body and Gender from the Greeks to Freud | Ch. 1 & 2 (pp. 1–62)',
              'Kinsey, A. C. et al. | Sexual Behavior in the Human Male | Ch. 4 (pp. 105–156)'
            ],
            assignments: [
              {
                title: 'Historical Lexicon Archival Audit',
                due: 'Week 3',
                deliverable: 'Primary Source Primary Dossier & Etymological Timeline'
              },
              {
                title: 'Survey Methodology Evaluation',
                due: 'Week 4',
                deliverable: '1,500-word Methodological Critique & Revised Survey Tool'
              }
            ]
          },
          {
            modules: '5 & 6',
            weeks: 'Weeks 5-6',
            unit: 'Structural Inequities & Legal Intersections',
            core_theoretical_focus: 'Intersectionality & Decoloniality',
            readings: [
              'Lorde, A. | Sister Outsider: Essays and Speeches | "Uses of the Erotic: The Erotic as Power"',
              'Somerville, S. | Queering the Color Line: Race and the Invention of Homosexuality | Ch. 1 (pp. 15–38)'
            ],
            assignments: [
              {
                title: 'Autoethnographic Synthesis',
                due: 'Week 5',
                deliverable: '1,500-word Reflective Autoethnography on Erotic Power'
              },
              {
                title: 'Global Legal Comparative Dossier',
                due: 'Week 6',
                deliverable: 'Comparative Legal Policy Matrix & 1,000-word Synthesis'
              }
            ]
          },
          {
            modules: '7 & 8',
            weeks: 'Weeks 7-8',
            unit: 'Contemporary Formations & Digital Spaces',
            core_theoretical_focus: 'Performativity & Platforms',
            readings: [
              'Butler, J. | Gender Trouble: Feminism and the Subversion of Identity | Ch. 3 (pp. 79–141)',
              'Noble, S. U. | Algorithms of Oppression | Ch. 2 (pp. 64–109)'
            ],
            assignments: [
              {
                title: 'Semiotic Media Analysis',
                due: 'Week 7',
                deliverable: '1,500-word Semiotic Breakdown of Pop Culture Artifacts'
              },
              {
                title: 'UX & Algorithmic Architecture Audit',
                due: 'Week 8',
                deliverable: 'Interface Design Teardown & Ethical Blueprint (1,200 words)'
              }
            ]
          },
          {
            modules: '9 & 10',
            weeks: 'Weeks 9-10',
            unit: 'Public Health, Stigma & Mobilization',
            core_theoretical_focus: 'Moral Panics & Biopolitical Crisis',
            readings: [
              'Rubin, G. | "Thinking Sex: Notes for a Radical Theory of the Politics of Sexuality" | pp. 267–319',
              'Crimp, D. | AIDS: Cultural Analysis/Cultural Activism | Introduction & Ch. 1 (pp. 3–16)'
            ],
            assignments: [
              {
                title: 'Legislative Discourse Policy Brief',
                due: 'Week 9',
                deliverable: '1,500-word Legislative Brief on Contested Legislation'
              },
              {
                title: 'Culminating Capstone Research Proposal',
                due: 'Week 10',
                deliverable: '3,000-word Integrated Research Thesis & Ethics Protocol'
              }
            ]
          }
        ],
        textbooks_and_key_authors: [
          { author: 'Foucault, M.', title: 'The History of Sexuality, Vol. 1: An Introduction' },
          { author: 'Vance, C. S.', title: 'Pleasure and Danger: Exploring Female Sexuality' },
          { author: 'Laqueur, T.', title: 'Making Sex: Body and Gender from the Greeks to Freud' },
          { author: 'Kinsey, A. C. et al.', title: 'Sexual Behavior in the Human Male' },
          { author: 'Lorde, A.', title: 'Sister Outsider: Essays and Speeches' },
          { author: 'Somerville, S.', title: 'Queering the Color Line: Race and the Invention of Homosexuality' },
          { author: 'Butler, J.', title: 'Gender Trouble: Feminism and the Subversion of Identity' },
          { author: 'Noble, S. U.', title: 'Algorithms of Oppression' },
          { author: 'Rubin, G.', title: 'Thinking Sex: Notes for a Radical Theory of the Politics of Sexuality' },
          { author: 'Crimp, D.', title: 'AIDS: Cultural Analysis/Cultural Activism' }
        ]
      };
    }

    const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(aiRaw, rawText);
    expect(norm.courseName).toBe('Critical Perspectives on Human Sexuality & Society');
    expect(norm.courseCode).toBe('PRJ-SEX-2026-X');
    expect(norm.termWeeks).toBe(10);
    expect(norm.candidateAssignments.length).toBe(10);
    expect(norm.weeks.length).toBe(10);
    expect(norm.textbooks.length).toBe(10);

    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

    expect(cleanAssignments.length).toBe(10);
    expect(cleanReadings.length).toBe(20);

    const weekReadings = cleanReadings.filter(r => r.weekNumber != null && r.weekNumber > 0);
    expect(weekReadings.length).toBe(10);

    const modReadings = cleanReadings.filter(r => r.moduleNumber != null && r.moduleNumber > 0 && (r.weekNumber == null || r.weekNumber === 0));
    expect(modReadings.length).toBe(10);

    // Verify first and last assignments have exact titles and deliverables
    expect(cleanAssignments[0].title).toBe('Discursive Field Mapping');
    expect(cleanAssignments[0].weekNumber).toBe(1);
    expect(cleanAssignments[0].noteText).toBe('1,500-word Critical Memo & Textual Deconstruction');

    expect(cleanAssignments[9].title).toBe('Culminating Capstone Research Proposal');
    expect(cleanAssignments[9].weekNumber).toBe(10);
    expect(cleanAssignments[9].noteText).toBe('3,000-word Integrated Research Thesis & Ethics Protocol');
  });
});
