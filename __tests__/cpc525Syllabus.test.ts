import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

export const CPC_525_TEXT = `CityUniversity in Canada
CPC 525: Testing And Assessment 
School of Health and Social Sciences 
Credits: 3 
Grading Type: Decimal 
Faculty Information 
Sarah Fisher 
Email: fishersarah@cityu.edu 
For additional information, see the "Meet your Instructor" page in the course. 
Course Catalog Description 
This course presents a survey of assessment techniques and instruments for 
personality, intelligence, achievement, interest, and aptitude. Students learn to 
incorporate test results into written reports, conduct mental status examinations, 
perform assessment interviews, and write detailed case conceptualization reports 
integrating quantitative and qualitative assessments. Prerequisites: CPC 514 
Statistics and Research or equivalent or substantial experience and facility with 
quantitative analysis. 

Course Assignments and Grading 
The grades earned for the course will be derived using CityU’s decimal grading 
system, based on the following:

Overview of Required Assignments % of Final Grade Due Date
Pre Course Survey 2.5% Oct 5th
Test Overview Group Report 20% Nov 2nd
Case Assessment PART 1: The Report 30% Nov 19th
Case Assessment PART 1: Peer Feedback 10% Dec 3rd
Case Assessment PART 1: Skills Evaluation 37.5% Dec 17th
TOTAL 100%

Course Assignment Details
Introductory Survey (2.5%) DUE: October 5th 2026 @ Midnight
This is a participation grade. Please complete the following survey to allow me to 
tailor the contents of the course to the cohorts experience level. Include your City 
University email when completing the survey so I can give you your participation 
grade. The survey can be found here: https://forms.gle/VdQ5pZrxi8vATNvX9

Test Overview Group Assignment (20%) DUE: November 2nd 2026 @ Midnight
In small groups, students will review a Level A, B, or C psychological test approved 
by the instructor.

Test Overview Group Assignment
Components Points % of Grade
Organization and Coherence 10 10%
Tools & Techniques 20 20%
Research and use of Course Concepts 20 20%
Critical Evaluation Skills 20 20%
Professional Ethics and Cultural Competence 20 20%
APA 10 10%
TOTAL 100 100%

Case Assessment 3 Part Assignment: Overview
This is an assignment that will be completed in 3 parts. Students will conduct an 
intake interview with a “client”, lasting 50-60 minutes.

Case Assessment PART 1: The Report (30%) DUE: November 19 2026
Students will conduct a formal intake assessment and develop a comprehensive 
case evaluation.

Case Assessment Report 
Grading Criteria Points % of Grade
Case Conceptualization 10 10%
Risk Assessment 20 20%
Tools & Techniques 20 20%
Professional Ethics 20 20%
Cultural Competence 20 20%
Organization and Coherence 10 10%
TOTAL 100 100%

Case Assessment PART 2: Peer Feedback Evaluation (10%) Due: December 3rd 2026 at Midnight 
The peer observer will watch the video recording of another student’s session and 
record a live transcript of feedback for the student counsellor.

Peer Feedback Evaluation
Components Points % of Grade
Focused, Objective, Accurate 30 30%
Actionable, Clear, Respectful 30 30%
Consolidative 10 10%
Constructive 10 10%
Concrete 10 10%
Considerate 10 10%
TOTAL 100 100%

Case Assessment PART 3: Skills Evaluation (37.5%) DUE: December 17 2026
Part 3 of this assignment consists of an annotated transcript, video section, and reflection.

Skills Evaluation
Components Points % of Grade
Organization and Coherence 10 10%
Identification of Skills and Opportunities 20 20%
Interviewing Skills Evaluation and Application 20 20%
Reflection 40 40%
APA 10 10%
TOTAL 100 100%

Course Schedule 
Course Schedule 
Week Modules Topics Readings 
10/1/26 Week 1 Introduction 
CPA Positional Paper on Psychological Assessments (All readings on BrightSpace) 
10/8/26 Week 2 Psychometrics 
-Conducting Psychological Assessments - The Hypothesis Testing Model (Pages 15 to 24) 
-Making Sense of Test Score Validity in Counselling Assessment (Lenz, 2025) 
10/15/26 Week 3 Intake Assessments 
-The Gift of Therapy Chapters 69, 14, 15, 16 (8 pages total); -Assessments Text Chapter 8 (Pages 137 to 166) OR Intakes for Depression Guide (Dobson, 2024) 
10/22/26 Week 4 Case Conceptualizations 
-Case Conceptualizations (Zubernis & Snyder, 2017) 
-(Optional) Textbook pages 129 to 137 (Communicating Results) 
10/29/26 Week 5 Work Block Week None 
11/5/26 Week 6 Suicide Risk Assessments 
-Risk Assessment (van Rijn, 2015) 
-Talking and Ticking Boxes (Reeves, 2016) 
11/12/26 Week 7 Reading Week None 
11/19/26 Week 8 Screening Part 1 
-The Skilled Helper Pages 105-120 (Egan & Reese, 2020) 
-The Gift of Therapy Chapter 2 (Yalom, 2002) 
11/26/26 Week 9 Self Harm and DV Risk Assessment 
-Working With Risk - Self Harm (Reeves, 2016) 
-Safety Planning Accross Culture and Community (Sections 1.1.3, 1.2, 1.3.1-1.3.4, 1.3.6) (10 pages) (EVA BC, 2013) 
12/3/26 Week 10 Performance and Outcome Assessments 
-Podcast Episode: Using Deliberate Practice to Improve Therapy Results 
-The Gift of Therapy Chapters 9, 10, 20, 27, 33, and 66 (18 pages) 
12/10/26 Week 11 Screening Part 2 
-Textbook Chapter 12 (Pages 236-266) 
-Textbook Chapter 9 (Pages 167-191) 
12/17/26 Week 12 Cultural Assessments and Mature Minors 
-Cultural Concepts of Distress (DSM-V-TR, 2022) 
-Guideline for Assessing the Capacity of Minors (NBASW, 2022) 
Reminder to submit End of Course Evaluations.`;

describe('CPC 525 Testing And Assessment Parser Audit', () => {
  it('parses course identity, instructor, assignments, rubrics, and weekly schedule', () => {
    const recon = LocalSyllabusParser.shared.lexerReconstituteLines(CPC_525_TEXT);
    const wk6Idx = recon.findIndex(l => l.includes('Week 6'));
    console.log('>>> RECON WK6:', recon.slice(wk6Idx, wk6Idx + 5));
    const rawA = (LocalSyllabusParser.shared as any).extractAssignmentsWithPointsHeuristic(recon, 2026, 'CPC 525');
    console.log('>>> RAW ASSIGNMENTS COUNT:', rawA.length);
    rawA.forEach((a: any) => console.log(`>>> RAWA: "${a.title}" due=${a.dueDate} wt=${a.weightPercentage} rubrics=${a.rubricCriteria?.length}`));
    const dto = LocalSyllabusParser.shared.parseText(CPC_525_TEXT);
    console.log('--- CPC 525 DTO ---');
    console.log('Code:', dto.courseCode, 'Name:', dto.courseName);
    console.log('Faculty:', dto.instructorName, 'Email:', dto.instructorEmail);
    console.log('Weeks count:', dto.weeks?.length);
    dto.weeks?.forEach(w => {
      console.log(`  Wk ${w.weekNumber}: date="${w.dateRangeStr || w.startDate}" theme="${w.theme}" readings=`, w.readings?.map(r => r.title));
    });
    console.log('Assignments count:', dto.assignments?.length);
    dto.assignments?.forEach(a => {
      console.log(`  Assign: "${a.title}" due=${a.dueDate} wt=${a.weightPercentage} rubrics=${a.rubricCriteria?.length}`);
    });

    const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, CPC_525_TEXT);
    console.log('--- NORMALIZED ---');
    console.log('Normalized weeks count:', normalized.weeks?.length);
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(
      normalized.candidateAssignments,
      normalized.termYear,
      normalized.weekDateMap,
      normalized.weeks as any
    );
    console.log('Clean assignments count:', cleanAssignments.length);
    cleanAssignments.forEach((a: any) => {
      console.log(`  Clean Assign: "${a.title}" due=${a.dueDate} wt=${a.weightPercentage} rubrics=${a.rubricCriteria?.length}`);
    });

    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(
      normalized.candidateReadings,
      normalized.textbooks,
      normalized.termYear
    );
    console.log('Clean readings count:', cleanReadings.length);
    cleanReadings.forEach((r: any) => {
      console.log(`  Clean Reading: wk=${r.weekNumber} date="${r.dueDate}" title="${r.title}"`);
    });
    expect(dto.courseCode).toBe('CPC 525');
    expect(dto.courseName).toBe('Testing And Assessment');
    expect(dto.instructorName).toBe('Sarah Fisher');
    expect(dto.instructorEmail).toBe('fishersarah@cityu.edu');

    // Strict Rule: 5 Genuine Assignments
    expect(cleanAssignments).toHaveLength(5);
    const assign1 = cleanAssignments.find(a => a.title.includes('Survey'));
    expect(assign1).toBeDefined();
    expect(assign1?.weightPercentage).toBe('2.5%');

    const assign2 = cleanAssignments.find(a => a.title.includes('Test Overview'));
    expect(assign2).toBeDefined();
    expect(assign2?.weightPercentage).toBe('20%');
    expect(assign2?.rubricCriteria?.length).toBe(6);

    const assign3 = cleanAssignments.find(a => a.title.includes('PART 1'));
    expect(assign3).toBeDefined();
    expect(assign3?.weightPercentage).toBe('30%');
    expect(assign3?.rubricCriteria?.length).toBe(6);

    const assign4 = cleanAssignments.find(a => a.title.includes('PART 2'));
    expect(assign4).toBeDefined();
    expect(assign4?.weightPercentage).toBe('10%');
    expect(assign4?.rubricCriteria?.length).toBe(6);

    const assign5 = cleanAssignments.find(a => a.title.includes('PART 3'));
    expect(assign5).toBeDefined();
    expect(assign5?.weightPercentage).toBe('37.5%');
    expect(assign5?.rubricCriteria?.length).toBe(5);

    // Strict Rule: Decimal Percentage Weights sum to 100%
    const totalWeight = cleanAssignments.reduce((acc, a) => {
      const num = parseFloat((a.weightPercentage || '0').replace(/%/g, ''));
      return acc + num;
    }, 0);
    expect(totalWeight).toBeCloseTo(100, 2);

    // Strict Rule: 12 Calendar Weeks, zero fabricated readings on breaks
    expect(normalized.weeks).toHaveLength(12);
    const week5 = normalized.weeks?.find(w => w.weekNumber === 5);
    expect(week5).toBeDefined();
    const week5Readings = cleanReadings.filter(r => r.weekNumber === 5);
    expect(week5Readings).toHaveLength(0);

    const week7 = normalized.weeks?.find(w => w.weekNumber === 7);
    expect(week7).toBeDefined();
    const week7Readings = cleanReadings.filter(r => r.weekNumber === 7);
    expect(week7Readings).toHaveLength(0);

    // Check reading deliverables are mapped to valid weeks
    expect(cleanReadings.length).toBeGreaterThanOrEqual(16);
    cleanReadings.forEach(r => {
      expect(r.weekNumber).toBeGreaterThanOrEqual(1);
      expect(r.weekNumber).toBeLessThanOrEqual(12);
      expect(r.weekNumber).not.toBe(5);
      expect(r.weekNumber).not.toBe(7);
      expect(r.title).toBeTruthy();
    });
  });
});
