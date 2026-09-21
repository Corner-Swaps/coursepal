import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import {
  formatDisplayTitleWithChapter,
  formatAuthorAndPagesSubtitle,
  formatSuggestedReadingCardText
} from '../src/utils/readingDisplayHelper';

describe('CPC 512 Real Syllabus Schedule Calibration', () => {
  const cpc512Text = `
CityUniversity | CityU.edu of Seattle
School of Health & Social Sciences
CPC 512: Family Systems Approaches to Counselling

course Schedule – *No ClassEs DURING Reading Week (August 6-7)
Please note that this schedule can change based on the discretion of faculty and/or student learning.

Course Session/Date\tTopics, Modules, and Assignments\tReadings
Week 1 July 2/3\tCreating a caring community
Introduction to Family Systems
Course overview\tGehart chapters 1-3

Week 2 July 9/10\tIntroduction to Systems Thinking
Introduction to Mapping Tools\tGehart chapter 5
Articles

Week 3 July 16/17\tFrom Theory to Practice
Structural Family Systems\tGehart chapters 5 & 7

Week 4 July 23/24\tEvidence Based Practice and Empirically Supported Models (TBD)\tGehart chapter 7

Week 5 July 30/31\tEvidenced-Based Practice and Empirically Supported Models
(group presentations)\tGehart chapters 4-10
Due: Family Mapping Papers

Week 6 August 6/7\tREADING WEEK\tNo classes

Week 7 August 13/14\tEvidence Based Practice and Empirically Supported Models
(group presentations)\tGehart chapters 4-10

Week 8 August 20/21\tEvidence Based Practice and Empirically Supported Models
(group presentations)\tGehart Chapters 4-10

Week 9 August 27/28\tCase Conceptualization\tGehart Chapter 11

Week 10 September 3/4\tCase Conceptualization
*Students will complete an in-class case conceptualization worth 20% of their final mark\tGehart chapter 11
• Review sample comprehensive exam cases in Van General Course Shell

Week 11 September 10/11\t• Feedback Case Conceptualizations
• Addressing Clinical Issues
• Counselling Practice\tGehart chapters 8

Week 12 September 17/18\tFlex Week\t

The following modules and topics will be integrated throughout the duration of our learning experience together:

Modules\tTopics\tRelated Readings
Module 1\tSystems Theory and the History of Family Therapy\tGehart (Chapters 1-3)
Module 2\tFamily of Origin/ Genograms\tGehart (Chapter 2)
Module 3\tDiverse Populations and Family Therapy Case Conceptualization and Application\tGehart (Chapters 11-15)
Module 4\tBowen Family Systems\tGehart (Chapter 7)
Module 5\tStructural Family Therapy\tGehart (Chapter 5)
Module 6\tStrategic Family Therapy\tGehart (Chapter 4)
Module 7\tExperiential Family Therapy\tGehart (Chapter 6)
Module 8\tPsychoanalytic Family Therapy\tGehart (Chapter 7)
Module 9\tCognitive Behavioural Family Therapy
Clinical issues in Family Counselling\tGehart (Chapter 8)
Module 10\tSocial Constructionist Family Therapy
Future Research and Critiques\tGehart (Chapter 10)

*NICHOLS & DAVIS READINGS = RELATED BUT NOT REQUIRED*
`;

  it('correctly extracts course identity, 12 calendar weeks, and embedded assignments', () => {
    const result = LocalSyllabusParser.shared.parseText(cpc512Text);

    expect(result.courseCode).toBe('CPC 512');
    expect(result.courseName).toBe('Family Systems Approaches to Counselling');

    // Exactly 12 weeks from the weekly schedule (not inflated to 16 by the secondary module table)
    expect(result.weeks).toBeDefined();
    expect(result.weeks?.length).toBe(12);

    // Week 1 has dates July 2 and readings Chapters 1-3
    const w1 = result.weeks?.find(w => w.weekNumber === 1);
    expect(w1).toBeDefined();
    expect(w1?.readings?.some(r => r.title.toLowerCase().includes('gehart') || r.title.toLowerCase().includes('chapter'))).toBe(true);

    // Theme should not leak trailing slash dates like "/10" or "/24"
    const w2 = result.weeks?.find(w => w.weekNumber === 2);
    expect(w2?.theme).not.toMatch(/^\s*\/\d+/);

    // Week 6 is reading week
    const w6 = result.weeks?.find(w => w.weekNumber === 6);
    expect(w6?.theme?.toLowerCase()).toContain('reading week');
    expect(w6?.readings?.length).toBe(0);

    // Assignments extracted: Family Mapping Papers and In-Class Case Conceptualization (20%)
    const assignments = result.assignments || [];
    const mappingPapers = assignments.find(a => /Family Mapping/i.test(a.title));
    expect(mappingPapers).toBeDefined();

    const caseConceptualization = assignments.find(a => /Case Conceptualization/i.test(a.title));
    expect(caseConceptualization).toBeDefined();
    expect(caseConceptualization?.weightPercentage).toBe('20%');
  });

  it('correctly extracts assignment rubrics, total points (100 pts), and instructions from CPC 512 syllabus', () => {
    const syllabusText = `
CityUniversity of Seattle
CPC 512: Family Systems Therapy Cohort 17B – Thursday (PM)

Course Assignments and Grading

The grades earned for the course will be derived using CityU’s decimal grading system, based on the following:

| Overview of Required Assignments | % of Final Grade |
| Genogram/Family Mapping Paper | 30% |
| Peer Review Group Report | 10% |
| Assessment and Intervention Presentation/Project | 20% |
| Collaboration | 20% |
| Case Conceptualization | 20% |
| Total | 100% |  |

Course Assignment Details

Genogram and Family Mapping Paper  Understanding the influence of one’s family of origin is a critical professional competency for developing therapists.

For the first part of this assignment, students who are able will create a family genogram of three to four generations.

| Grading Criteria | Grade Points |
| Genogram/Alternative Map | 10 Points |
| Evidence and Support (Scholarly Sources) | 20 Points |
| Analysis and use of Course Concepts | 20 Points |
| Professional Ethics | 20 Points |
| Cultural Competence | 20 Points |
| Self-Awareness | 10 Points |
| Total | 100 Points |

Peer Review Group Report

Peer review is a core academic activity in which colleagues support one another’s professional development.

| Grading Criteria | Grade Points |
| Organization and Coherence | 10 Points |
| Evidence and Support | 20 Points |
| Analysis and Use of Course Concepts | 20 Points |
| Evaluating Information | 20 Points |
| Self-Reflection | 20 Points |
| Participation | 10 Points |
| Total | 100 Points |

Assessment and Intervention Presentation/Project

Working in small groups, students will present a practical intervention.

| Grading Criteria | Grade Points |
| Organization and Coherence | 10 Points |
| Diversity & Collaboration | 20 Points |
| Analysis and use of Course Concepts | 20 Points |
| Professional Ethics | 20 Points |
| Cultural Competence | 20 Points |
| Oral Presentation | 10 Points |
| Total | 100 Points |

Collaboration

Students may earn marks for collaboration throughout the course.

| Grading Criteria | Grade Points |
| Communication | 30 Points |
| Self Reflection & Compassion | 30 Points |
| Self-Awareness & Self-Regulation | 40 Points |
| Total | 100 Points |

Case Conceptualization

Working in groups, students will complete a case conceptualization based on a set of framing questions.

| Grading Criteria | Grade Points |
| Case Analysis and Theoretical Approach | 20 Points |
| Evidence and Support | 20 Points |
| Analysis and use of Course Concepts | 20 Points |
| Professional Ethics | 20 Points |
| Cultural Competence | 20 Points |
| Total | 100 Points |
`;

    const result = LocalSyllabusParser.shared.parseText(syllabusText);
    expect(result.assignments?.length).toBe(5);

    for (const a of result.assignments || []) {
      // Every assignment has 100 points
      expect(a.pointsPossible).toBe('100 Points');
      expect(a.totalPoints).toBe(100);
      expect(a.points).toBe(100);

      // Rubrics populated
      expect(a.rubricCriteria).toBeDefined();
      expect(a.rubricCriteria!.length).toBeGreaterThanOrEqual(3);

      const sum = a.rubricCriteria!.reduce((s, c) => s + (c.points || 0), 0);
      expect(sum).toBe(100);

      // No weird leading pipe or punctuation artifacts in titles or criteria
      expect(a.title).not.toMatch(/^[|•\-*▪●:·~_§ \t\n–—]/);
      for (const crit of a.rubricCriteria!) {
        expect(crit.criterionName).not.toMatch(/^[|•\-*▪●:·~_§ \t\n–—]/);
      }
    }

    const genogram = result.assignments?.find(a => /Genogram/i.test(a.title));
    expect(genogram?.rubricCriteria?.length).toBe(6);
    expect(genogram?.rubricCriteria?.some(c => c.criterionName === 'Evidence and Support (Scholarly Sources)')).toBe(true);
    expect(genogram?.rubricCriteria?.some(c => c.criterionName === 'Genogram/Alternative Map' && c.points === 10)).toBe(true);

    // Requirement: Triple check that in the points breakdown downstairs, the title's first letter is capitalized
    for (const a of result.assignments || []) {
      for (const crit of a.rubricCriteria || []) {
        expect(/^[A-Z]/.test(crit.criterionName)).toBe(true);
      }
    }
  });

  it('triple checks chapters are in order and suggested dates follow the recommended chapters', () => {
    const result = LocalSyllabusParser.shared.parseText(cpc512Text);
    const weeks = result.weeks || [];
    expect(weeks.length).toBe(12);

    // Week 1 reading: Gehart chapters 1-3, suggested date: Jul 2 – Jul 3
    const w1Reading = weeks[0]?.readings?.[0];
    expect(w1Reading).toBeDefined();
    expect(w1Reading?.title).toMatch(/1[-–]3/);
    expect(w1Reading?.dateRangeStr).toBe('Jul 2 – Jul 3');
    expect(weeks[0]?.moduleNumber).toBe(1);

    // Week 2 reading: Gehart Chapter 5 & Articles from Table 2, suggested date: Jul 9 – Jul 10
    const w2Reading = weeks[1]?.readings?.find(r => /chapter 5/i.test(r.chapterText || r.title));
    expect(w2Reading).toBeDefined();
    expect(w2Reading?.dateRangeStr).toBe('Jul 9 – Jul 10');
    expect(weeks[1]?.moduleNumber).toBe(2);

    // Week 3 reading: Gehart Chapters 5 & 7 from Table 2, suggested date: Jul 16 – Jul 17
    const w3Reading = weeks[2]?.readings?.[0];
    expect(w3Reading).toBeDefined();
    expect(w3Reading?.title).toMatch(/5\s*&\s*7/);
    expect(w3Reading?.dateRangeStr).toBe('Jul 16 – Jul 17');
    expect(weeks[2]?.moduleNumber).toBe(3);

    // Week 4 reading: Gehart Chapter 7 from Table 2, suggested date: Jul 23 – Jul 24
    const w4Reading = weeks[3]?.readings?.[0];
    expect(w4Reading).toBeDefined();
    expect(w4Reading?.title).toMatch(/chapter 7/i);
    expect(w4Reading?.dateRangeStr).toBe('Jul 23 – Jul 24');
    expect(weeks[3]?.moduleNumber).toBe(4);

    // Week 5 reading: Gehart Chapters 4–10 from Table 2, suggested date: Jul 30 – Jul 31
    const w5Reading = weeks[4]?.readings?.[0];
    expect(w5Reading).toBeDefined();
    expect(w5Reading?.title).toMatch(/4[-–]10/);
    expect(w5Reading?.dateRangeStr).toBe('Jul 30 – Jul 31');
    expect(weeks[4]?.moduleNumber).toBe(5);

    // Week 6: Reading Week (0 readings)
    const w6 = weeks[5];
    expect(w6?.theme?.toLowerCase()).toContain('reading week');
    expect(w6?.readings?.length).toBe(0);

    // Week 7 reading: Gehart Chapters 4–10 from Table 2, suggested date: Aug 13 – Aug 14
    const w7Reading = weeks[6]?.readings?.[0];
    expect(w7Reading).toBeDefined();
    expect(w7Reading?.title).toMatch(/4[-–]10/);
    expect(w7Reading?.dateRangeStr).toBe('Aug 13 – Aug 14');
    expect(weeks[6]?.moduleNumber).toBe(6);

    // Week 8 reading: Gehart Chapters 4–10 from Table 2, suggested date: Aug 20 – Aug 21
    const w8Reading = weeks[7]?.readings?.[0];
    expect(w8Reading).toBeDefined();
    expect(w8Reading?.title).toMatch(/4[-–]10/);
    expect(w8Reading?.dateRangeStr).toBe('Aug 20 – Aug 21');
    expect(weeks[7]?.moduleNumber).toBe(7);

    // Week 9 reading: Gehart Chapter 11 from Table 2, suggested date: Aug 27 – Aug 28
    const w9Reading = weeks[8]?.readings?.[0];
    expect(w9Reading).toBeDefined();
    expect(w9Reading?.title).toMatch(/chapter 11/i);
    expect(w9Reading?.dateRangeStr).toBe('Aug 27 – Aug 28');
    expect(weeks[8]?.moduleNumber).toBe(8);

    // Week 10 reading: Gehart Chapter 11 from Table 2, suggested date: Sep 3 – Sep 4
    const w10Reading = weeks[9]?.readings?.find(r => /chapter 11/i.test(r.title));
    expect(w10Reading).toBeDefined();
    expect(w10Reading?.dateRangeStr).toBe('Sep 3 – Sep 4');
    expect(weeks[9]?.moduleNumber).toBe(9);

    // Week 11 reading: Gehart Chapter 8 from Table 2, suggested date: Sep 10 – Sep 11
    const w11Reading = weeks[10]?.readings?.[0];
    expect(w11Reading).toBeDefined();
    expect(w11Reading?.title).toMatch(/chapters?\s*8/i);
    expect(w11Reading?.dateRangeStr).toBe('Sep 10 – Sep 11');
    expect(weeks[10]?.moduleNumber).toBe(10);

    // Week 12: Flex Week (0 readings)
    const w12 = weeks[11];
    expect(w12?.theme?.toLowerCase()).toContain('flex week');
    expect(w12?.readings?.length).toBe(0);

    // Verify distinct Table 1 Canonical Modules
    const modReadings = result.moduleReadings || [];
    expect(modReadings.length).toBe(10);

    const m1 = modReadings.find(m => m.moduleNumber === 1);
    expect(m1?.title).toMatch(/1[-–]3/);
    expect(m1?.relevantTopics).toContain('Systems Theory');

    const m2 = modReadings.find(m => m.moduleNumber === 2);
    expect(m2?.title).toContain('Chapter 2');
    expect(m2?.relevantTopics).toContain('Family of Origin');

    const m3 = modReadings.find(m => m.moduleNumber === 3);
    expect(m3?.title).toMatch(/11[-–]15/);
    expect(m3?.relevantTopics).toContain('Diverse Populations');

    const m5 = modReadings.find(m => m.moduleNumber === 5);
    expect(m5?.title).toContain('Chapter 5');
    expect(m5?.relevantTopics).toContain('Structural');

    // Dates advance chronologically matching the weeks
    const dates = weeks.map(w => w.dateRangeStr).filter(Boolean);
    expect(dates).toContain('Jul 2 – Jul 3');
    expect(dates).toContain('Jul 9 – Jul 10');
    expect(dates).toContain('Jul 16 – Jul 17');
    expect(dates).toContain('Jul 23 – Jul 24');
    expect(dates).toContain('Jul 30 – Jul 31');
    expect(dates).toContain('Aug 13 – Aug 14');
  });

  it('parses the modules table from the user screenshot', () => {
    const screenshotText = `
School of Health & Social Sciences
CPC 512: Family Systems Approaches to Counselling

The following modules and topics will be integrated throughout the duration of our learning experience together:

Modules\tTopics\tRelated Readings
Module 1\tSystems Theory and the History of Family Therapy\tGehart (Chapters 1-3)
Module 2\tFamily of Origin/ Genograms\tGehart (Chapter 2)
Module 3\tDiverse Populations and Family Therapy Case Conceptualization and Application\tGehart (Chapters 11-15)
Module 4\tBowen Family Systems\tGehart (Chapter 7)
Module 5\tStructural Family Therapy\tGehart (Chapter 5)
Module 6\tStrategic Family Therapy\tGehart (Chapter 4)
Module 7\tExperiential Family Therapy\tGehart (Chapter 6)
Module 8\tPsychoanalytic Family Therapy\tGehart (Chapter 7)
Module 9\tCognitive Behavioural Family Therapy Clinical issues in Family Counselling\tGehart (Chapter 8)
Module 10\tSocial Constructionist Family Therapy Future Research and Critiques\tGehart (Chapter 10)

*NICHOLS & DAVIS READINGS = RELATED BUT NOT REQUIRED*
`;
    const result = LocalSyllabusParser.shared.parseText(screenshotText);
    console.log('--- SCREENSHOT PARSE RESULT ---');
    console.log('Course:', result.courseCode, result.courseName);
    console.log('Weeks:', result.weeks?.length);
    result.weeks?.forEach(w => {
      w.readings?.forEach(r => {
        const title = formatDisplayTitleWithChapter(r, r.chapterText, r.resourceTitle, result.courseName, r.authorName);
        const sub = formatAuthorAndPagesSubtitle(r.authorName, r.pagesText, r.resourceTitle, title, result.courseName);
        const dateText = formatSuggestedReadingCardText(r.dueDate, r.dateRangeStr, w.startDate);
        const bottomText = sub && dateText ? `${sub} – ${dateText}` : (sub || dateText);
        console.log(`CARD W${w.weekNumber}:`);
        console.log(`  TITLE:  "${title}"`);
        console.log(`  SUB:    "${sub}"`);
        console.log(`  DATE:   "${dateText}"`);
        console.log(`  BOTTOM: "${bottomText}"`);
      });
    });

    console.log('Assignments:', result.assignments);
  });

  it('parses CPC512_Syllabus.pdf and checks assignments, rubrics, and breakdown', () => {
    const { execSync } = require('child_process');
    const pyScript = `import pypdf; r=pypdf.PdfReader('src/assets/syllabi/CPC512_Syllabus.pdf'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
    const fullText = execSync(`python3 -c "${pyScript}"`).toString();
    const lines = fullText.split(/\r?\n/);
    console.log('Total lines in CPC512_Syllabus.pdf:', lines.length);
    for (let i = 0; i < lines.length; i++) {
      if (/Genogram|Peer Review|Assessment and Intervention|Collaboration|Case Conceptualization|Grading Criteria/i.test(lines[i])) {
        console.log(`line ${i}: ${JSON.stringify(lines[i])}`);
      }
    }
    const result = LocalSyllabusParser.shared.parseText(fullText);

    console.log('=== CPC512_Syllabus.pdf PARSE ===');
    console.log('Course:', result.courseCode, result.courseName);
    console.log('Assignments count:', result.assignments?.length);
    result.assignments?.forEach(a => {
      console.log(`  [Assignment] "${a.title}" | pts: ${a.points} | wt: ${a.weightPercentage} | due: ${a.dueDate}`);
      if (a.rubricCriteria && a.rubricCriteria.length > 0) {
        console.log(`    Rubric criteria (${a.rubricCriteria.length} items):`);
        a.rubricCriteria.forEach(rc => {
          console.log(`      - "${rc.criterionName}": ${rc.points} pts`);
        });
      } else {
        console.log(`    (NO rubric criteria)`);
      }
    });

    expect(result.assignments?.length).toBe(5);
    for (const a of result.assignments || []) {
      expect(a.pointsPossible).toBe('100 Points');
      expect(a.points).toBe(100);
      expect(a.totalPoints).toBe(100);
      expect(a.rubricCriteria).toBeDefined();
      expect(a.rubricCriteria!.length).toBeGreaterThanOrEqual(3);
      const sum = a.rubricCriteria!.reduce((acc, c) => acc + (c.points || 0), 0);
      expect(sum).toBe(100);
    }

    const genogram = result.assignments?.find(a => /Genogram/i.test(a.title));
    expect(genogram?.rubricCriteria?.length).toBe(6);

    const peerReview = result.assignments?.find(a => /Peer Review/i.test(a.title));
    expect(peerReview?.rubricCriteria?.length).toBe(6);

    const presentation = result.assignments?.find(a => /Assessment and Intervention/i.test(a.title));
    expect(presentation?.rubricCriteria?.length).toBe(6);

    const collaboration = result.assignments?.find(a => /Collaboration/i.test(a.title));
    expect(collaboration?.rubricCriteria?.length).toBe(3);

    const caseConc = result.assignments?.find(a => /Case Conceptualization/i.test(a.title));
    expect(caseConc?.rubricCriteria?.length).toBe(5);
  });

  it('preserves all 10 modules without merging Module 4 and Module 8, and protects pure module readings in healItemWeeks', () => {
    const { healItemWeeks, deduplicateReadingsList } = require('../src/utils/readingDisplayHelper');

    const canonicalModules = [
      { modNum: 1, chapter: 'Chapters 1–3', title: 'Chapters 1–3 · Systems Theory and the History of Family Therapy', theme: 'Systems Theory' },
      { modNum: 2, chapter: 'Chapter 2', title: 'Chapter 2 · Family of Origin/ Genograms', theme: 'Family of Origin' },
      { modNum: 3, chapter: 'Chapters 11–15', title: 'Chapters 11–15 · Diverse Populations', theme: 'Diverse Populations' },
      { modNum: 4, chapter: 'Chapter 7', title: 'Chapter 7 · Bowen Family Systems', theme: 'Bowen Family Systems' },
      { modNum: 5, chapter: 'Chapter 5', title: 'Chapter 5 · Structural Family Therapy', theme: 'Structural Family Therapy' },
      { modNum: 6, chapter: 'Chapter 4', title: 'Chapter 4 · Strategic Family Therapy', theme: 'Strategic Family Therapy' },
      { modNum: 7, chapter: 'Chapter 6', title: 'Chapter 6 · Experiential Family Therapy', theme: 'Experiential Family Therapy' },
      { modNum: 8, chapter: 'Chapter 7', title: 'Chapter 7 · Psychoanalytic Family Therapy', theme: 'Psychoanalytic Family Therapy' },
      { modNum: 9, chapter: 'Chapter 8', title: 'Chapter 8 · Cognitive Behavioural Family Therapy', theme: 'Cognitive Behavioural' },
      { modNum: 10, chapter: 'Chapter 10', title: 'Chapter 10 · Social Constructionist Family Therapy', theme: 'Social Constructionist' }
    ];

    const rawReadings: any[] = [];
    canonicalModules.forEach(cm => {
      rawReadings.push({
        id: `r-mod-${cm.modNum}`,
        title: cm.title,
        authorName: 'Diane R. Gehart',
        resourceTitle: null,
        chapterText: cm.chapter,
        courseCode: 'CPC 512',
        courseId: 'c-cpc512',
        relevantTopics: cm.theme,
        weekId: 'none',
        weekNumber: null,
        moduleNumber: cm.modNum,
        moduleMention: `Module ${cm.modNum}`
      });
    });

    // 1. healItemWeeks MUST NOT assign week numbers to module readings
    const { readings: healed } = healItemWeeks(
      [{ id: 'c-cpc512', courseCode: 'CPC 512', termWeeks: 12 }],
      rawReadings,
      []
    );

    healed.forEach((r: any) => {
      expect(r.weekNumber).toBeNull();
      expect(r.weekId).toBe('none');
      expect(r.moduleNumber).toBeGreaterThan(0);
    });

    // 2. deduplicateReadingsList MUST NOT merge Module 4 and Module 8
    const deduped = deduplicateReadingsList(healed, [{ id: 'c-cpc512', courseCode: 'CPC 512' }]);
    expect(deduped.length).toBe(10);

    const mod4 = deduped.find((r: any) => r.moduleNumber === 4);
    const mod8 = deduped.find((r: any) => r.moduleNumber === 8);
    expect(mod4).toBeDefined();
    expect(mod8).toBeDefined();
    expect(mod4?.title).toContain('Bowen');
    expect(mod8?.title).toContain('Psychoanalytic');
  });

  it('verifies group presentations are scheduled across Weeks 5, 7, and 8 with 6 rubric criteria', () => {
    const combinedSyllabus = `
CityUniversity of Seattle
CPC 512: Family Systems Approaches to Counselling

Course Schedule
Week 1 July 2/3\tIntroduction to Family Systems\tGehart chapters 1-3
Week 5 July 30/31\tEvidenced-Based Practice and Empirically Supported Models (group presentations)\tGehart chapters 4-10\nDue: Family Mapping Papers
Week 6 August 6/7\tREADING WEEK\tNo classes
Week 7 August 13/14\tEvidence Based Practice and Empirically Supported Models (group presentations)\tGehart chapters 4-10
Week 8 August 20/21\tEvidence Based Practice and Empirically Supported Models (group presentations)\tGehart Chapters 4-10
Week 10 September 3/4\tCase Conceptualization\tGehart chapter 11

Course Assignments and Grading
| Overview of Required Assignments | % of Final Grade |
| Genogram/Family Mapping Paper | 30% |
| Peer Review Group Report | 10% |
| Assessment and Intervention Presentation/Project | 20% |
| Collaboration | 20% |
| Case Conceptualization | 20% |
| Total | 100% |

Assessment and Intervention Presentation/Project
Working in small groups, students will present a practical intervention from one theoretical perspective used for assessment and treatment in family therapy. The presentation will introduce central themes and concepts related to the theory chosen. Each group will also present a video or in-class role-play demonstrating the application of the theory in the form of a simulated family therapy intervention. Students will facilitate a class discussion to critically examine the therapeutic perspectives explored.

Grading Criteria Grade Points
Organization and Coherence 10 Points
Diversity & Collaboration 20 Points
Analysis and use of Course Concepts 20 Points
Professional Ethics 20 Points
Cultural Competence 20 Points
Oral Presentation 10 Points
Total 100 Points
`;

    const parsed = LocalSyllabusParser.shared.parseText(combinedSyllabus);
    const presentation = parsed.assignments?.find(a => /presentation/i.test(a.title));

    expect(presentation).toBeDefined();
    expect(presentation?.title).toBe('Assessment and Intervention Presentation/Project');
    expect(presentation?.weightPercentage).toBe('20%');
    expect(presentation?.pointsPossible).toBe('100 Points');
    expect(presentation?.rubricCriteria?.length).toBe(6);

    // Verify scheduledWeeks contains 5, 7, and 8
    expect(presentation?.scheduledWeeks).toEqual([5, 7, 8]);
    expect(presentation?.noteText).toContain('Weeks 5, 7, 8');

    // Verify weekly assignment filtering across Weeks 5, 7, and 8
    const assignments = parsed.assignments || [];
    const getWeekAssignments = (wNum: number) => assignments.filter(a => {
      if (a.weekNumber === wNum) return true;
      if (Array.isArray(a.scheduledWeeks) && a.scheduledWeeks.includes(wNum)) return true;
      const note = a.noteText || '';
      if (/presentation/i.test(a.title) || /presentation/i.test(note)) {
        const m = note.match(/Weeks?\s*([\d,\s&–-]+)/i);
        if (m) {
          const weeks = m[1].match(/\d+/g)?.map(n => parseInt(n, 10)) || [];
          if (weeks.includes(wNum)) return true;
        }
      }
      return false;
    });

    const w5 = getWeekAssignments(5);
    const w7 = getWeekAssignments(7);
    const w8 = getWeekAssignments(8);

    expect(w5.some(a => /presentation/i.test(a.title))).toBe(true);
    expect(w7.some(a => /presentation/i.test(a.title))).toBe(true);
    expect(w8.some(a => /presentation/i.test(a.title))).toBe(true);
  });
});




