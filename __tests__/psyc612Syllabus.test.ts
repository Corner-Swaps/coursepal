import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';

describe('PSYC 612 Parsing Diagnostic', () => {
  it('parses PSYC 612 syllabus accurately', () => {
    const testDoc = `COURSE SYLLABUS & SCHEMA
PSYC 612: Advanced Cognitive Behavioural Interventions
Department of Applied Psychology & Behavioural Sciences • Graduate Studies
INSTRUCTOR
Dr. Aris Thorne, Ph.D., R.Psych.
athorne@appliedpsych.edu
COURSE DETAILS
Credits: 3.0
Grading: Decimal / Percentage
Term: Fall 2026
OFFICE HOURS
Tuesdays 2:00 PM – 4:00 PM PST
Virtual Clinical Supervision Suite

COURSE CATALOG DESCRIPTION
This graduate-level seminar provides a rigorous, experiential examination of cognitive-behavioral interventions with a core emphasis on contemporary third-wave modalities, including Acceptance and Commitment Therapy (ACT), Dialectical Behaviour Therapy (DBT) core skills, and standard Beckian longitudinal case conceptualization. Students will participate actively as both clinicians and reflective peers through clinical role-plays, dyadic live demonstrations, exposure protocol design, and behavioural experiment construction.

PROGRAM LEARNING OUTCOMES & ETHICAL STANDARDS
• PLO 1 (Clinical Formulation): Synthesize presenting psychological symptomatology into comprehensive, culturally-responsive cognitive case conceptualizations.
• PLO 2 (Intervention Execution): Demonstrate therapeutic attunement, cognitive restructuring, defusion techniques, and distress tolerance training in clinical simulations.
• PLO 3 (Supervisory Reflexivity): Conduct structured peer supervision using validated evaluative frameworks while recognizing transference and power dynamics.
• PLO 4 (Ethical Boundaries): Apply jurisdictional legal standards and professional ethics codes governing client privacy, risk mitigation, and documented consent.

COURSE ASSIGNMENTS & GRADING SUMMARY
ASSESSMENT TITLE WEIGHT TARGET DUE DELIVERABLE FORMAT
Comprehensive Clinical Case Formulation 35% Module 05 7–9 Page Formal Report (APA 7th)
Simulated Dyadic Clinical Demonstration 30% Modules 07–08 45-Minute Live Simulation & Recording
Critical Peer Supervision & Consultation 15% Module 09 Structured CTRS Evaluation Matrix
Seminar Engagement & Clinical Reflexivity 20% Continuous Weekly Prompts & 2-Page Reflection Log
Total Course Assessment 100% End of Term Cumulative Decimal Grade Scale
PSYC 612: Advanced Cognitive Behavioural Interventions — Syllabus 1

DETAILED ASSIGNMENT REQUIREMENTS
1. Comprehensive Clinical Case Formulation (35%)
Students select an assigned complex client dossier and formulate a biopsychosocial assessment and Beckian longitudinal diagram. Submissions must detail predispositions, precipitating stressors, maintenance cycles, and an evidence-informed 12-week stepped-care plan. A minimum of six peer-reviewed empirical studies from the past 5 years is mandatory.

2. Simulated Dyadic Clinical Demonstration (30%)
Working in assigned dyads, each student conducts a 45-minute clinical intervention role-playing a designated therapeutic impasse (e.g., exposure avoidance, cognitive fusion, or severe affective dysregulation). Students are evaluated on empathetic presence, Socratic dialogue, and intervention fidelity.

3. Critical Peer Supervision & Consultation (15%)
Adopting a supervisory role, students analyze a peer dyad's recorded demonstration utilizing the Cognitive Therapy Rating Scale (CTRS). Feedback must be delivered via a standardized consultation rubric focusing on pacing, collaborative empiricism, and specific actionable recommendations.

4. Seminar Engagement & Clinical Reflexivity (20%)
Evaluated through prepared contributions in small-group break-out clinics, active listening, adherence to classroom confidentiality, and a closing 2-page personal reflexivity log documenting therapist self-regulation and countertransference insights.

WEEKLY TERM SCHEDULE & ASSIGNED READINGS
TIMELINE MODULE CORE TOPIC FOCUS REQUIRED LITERATURE
Week 01 Module 01 Cognitive Case Conceptualization Frameworks Beck (Ch. 1–3); Persons (Ch. 1)
Week 02 Module 02 Socratic Dialogue & Cognitive Restructuring Beck (Ch. 7–9); Clark (Ch. 4)
Week 03 Module 03 Behavioural Experiments & Exposure Design Craske & Barlow (Ch. 2 & 5)
Week 04 Module 04 Acceptance & Mindfulness Architecture (ACT) Hayes et al. (Ch. 3–5)
Week 05 Module 05 Distress Tolerance & Emotion Regulation (DBT) Linehan (Ch. 6–8)
Week 06 Module 06 Mid-Term Clinical Review & Dyad Setup Clinical Dossier Packets
Week 07 Module 07 Live Dyadic Demonstrations: Cohort A CTRS Manual & Scoring Guides
Week 08 Module 08 Live Dyadic Demonstrations: Cohort B CTRS Manual & Scoring Guides
Week 09 Module 09 Supervision Lab & Consultation Exchange Peer Consultation Protocol Sheets
Week 10 Module 10 Culturally Responsive Adaptation in CBT Hays (Ch. 2 & 7); Indigenous Perspectives
Week 11 Module 11 Relapse Prevention, Termination & Closings Beck (Ch. 18); Canadian Code of Ethics

Extension & Late Policy: Extensions must be requested in writing at least 48 hours in advance of the deadline. Late assignments without an approved extension are subject to a 1-point deduction per day for the first 10 days, followed by 5 points per day thereafter.

COURSEPAL PARSER & APPLICATION MAPPING GUIDE
When parsing this syllabus into the CoursePal schema extractor, the document components are designed to populate across the following native app views:

ASSIGNMENTS & WEIGHTS VIEW
• Case Formulation: Maps to Assignment tab with weight: 35%, tagged as written report due Module 05.
• Dyadic Demonstration: Maps with weight: 30%, flagged as live experiential presentation across Modules 07–08.
• Peer Supervision: Maps with weight: 15%, due Module 09.
• Engagement: Maps with weight: 20%, identified as continuous weekly engagement.

READING LIST & RESOURCES SCREEN
• Extracts weekly chapters into actionable checkboxes (e.g., Beck Ch. 1–3, Linehan Ch. 6–8, CTRS Manual).
• Sorts readings chronologically per module milestone.

TIMELINE & NOTIFICATION ENGINE
• Builds a 11-module calendar timeline with weekly lecture reminder cards.
• Triggers automated 48-hour deadline alert rules honoring the syllabus extension policy.
`;

    const res = LocalSyllabusParser.shared.parseText(testDoc);

    expect(res.courseCode).toBe('PSYC 612');
    expect(res.courseName).toBe('Advanced Cognitive Behavioural Interventions');
    expect(res.instructorName).toBe('Aris Thorne, Ph.D., R.Psych.');
    expect(res.instructorEmail).toBe('athorne@appliedpsych.edu');

    expect(res.assignments?.length).toBe(4);
    const titles = res.assignments?.map(a => a.title);
    expect(titles).toEqual([
      'Comprehensive Clinical Case Formulation',
      'Simulated Dyadic Clinical Demonstration',
      'Critical Peer Supervision & Consultation',
      'Seminar Engagement & Clinical Reflexivity'
    ]);

    const weights = res.assignments?.map(a => a.weightPercentage);
    expect(weights).toEqual(['35%', '30%', '15%', '20%']);

    const weeks = res.assignments?.map(a => a.weekNumber);
    expect(weeks).toEqual([5, 7, 9, 1]);

    const dueDates = res.assignments?.map(a => a.dueDate);
    expect(dueDates).toEqual(['2026-10-08', '2026-10-22', '2026-11-05', '2026-09-10']);

    const points = res.assignments?.map(a => a.pointsPossible);
    expect(points).toEqual(['35 Points', '30 Points', '15 Points', '20 Points']);

    res.assignments?.forEach(a => {
      expect(a.noteText).not.toContain('Ch. 2 & 5');
    });

    expect(res.weeks?.length).toBe(11);
    expect(res.weeks?.every(w => !!w.startDate && !!w.dateRangeStr)).toBe(true);

    const week1 = res.weeks?.find(w => w.weekNumber === 1);
    expect(week1?.theme).toBe('MODULE 01: Cognitive Case Conceptualization Frameworks');
    expect(week1?.readings?.map(r => r.title)).toEqual(['Beck (Ch. 1–3)', 'Persons (Ch. 1)']);
    expect(week1?.readings?.[0]?.authorName).toBe('Beck');
    expect(week1?.readings?.[0]?.chapterText).toBe('Chapters 1–3');
    expect(week1?.readings?.[1]?.authorName).toBe('Persons');

    const week4 = res.weeks?.find(w => w.weekNumber === 4);
    expect(week4?.theme).toBe('MODULE 04: Acceptance & Mindfulness Architecture (ACT)');
    expect(week4?.readings?.[0]?.authorName).toBe('Hayes et al.');
    expect(week4?.readings?.[0]?.chapterText).toBe('Chapters 3–5');

    const week6 = res.weeks?.find(w => w.weekNumber === 6);
    expect(week6?.theme).toBe('MODULE 06: Mid-Term Clinical Review & Dyad Setup');
    expect(week6?.readings?.[0]?.title).toBe('Clinical Dossier Packets');

    const week7 = res.weeks?.find(w => w.weekNumber === 7);
    expect(week7?.readings?.[0]?.title).toBe('CTRS Manual & Scoring Guides');

    const week9 = res.weeks?.find(w => w.weekNumber === 9);
    expect(week9?.readings?.[0]?.title).toBe('Peer Consultation Protocol Sheets');

    const week10 = res.weeks?.find(w => w.weekNumber === 10);
    expect(week10?.readings?.map(r => r.title)).toEqual(['Hays (Ch. 2 & 7)', 'Indigenous Perspectives']);

    const week11 = res.weeks?.find(w => w.weekNumber === 11);
    expect(week11?.readings?.map(r => r.title)).toEqual(['Beck (Ch. 18)', 'Canadian Code of Ethics']);
  });

  it('parses real PDF extracted text for PSYC 612 accurately', () => {
    const fs = require('fs');
    if (!fs.existsSync('/tmp/psyc612_real.txt')) return;
    const realText = fs.readFileSync('/tmp/psyc612_real.txt', 'utf8');
    const lines = LocalSyllabusParser.shared.lexerReconstituteLines(realText);
    const assignStart = lines.findIndex(l => l.includes('COURSE ASSIGNMENTS & GRADING SUMMARY'));
    console.log('RECONSTITUTED LINES AROUND ASSIGNMENTS:');
    lines.slice(assignStart, assignStart + 25).forEach((l, idx) => console.log(`${idx}: [${l}]`));

    const res = LocalSyllabusParser.shared.parseText(realText);

    expect(res.courseCode).toBe('PSYC 612');
    expect(res.courseName).toBe('Advanced Cognitive Behavioural Interventions');
    expect(res.instructorName).toBe('Aris Thorne, Ph.D., R.Psych.');
    expect(res.instructorEmail).toBe('athorne@appliedpsych.edu');

    expect(res.assignments?.length).toBe(4);
    expect(res.assignments?.map(a => a.title)).toEqual([
      'Comprehensive Clinical Case Formulation',
      'Simulated Dyadic Clinical Demonstration',
      'Critical Peer Supervision & Consultation',
      'Seminar Engagement & Clinical Reflexivity'
    ]);
    expect(res.assignments?.map(a => a.weightPercentage)).toEqual(['35%', '30%', '15%', '20%']);
    expect(res.assignments?.map(a => a.weekNumber)).toEqual([5, 7, 9, 1]);
    expect(res.assignments?.map(a => a.dueDate)).toEqual(['2026-10-08', '2026-10-22', '2026-11-05', '2026-09-10']);

    expect(res.weeks?.length).toBe(11);
    expect(res.weeks?.every(w => !!w.startDate && !!w.dateRangeStr)).toBe(true);

    const week1 = res.weeks?.find(w => w.weekNumber === 1);
    expect(week1?.theme).toBe('MODULE 01: Cognitive Case Conceptualization Frameworks');
    expect(week1?.readings?.map(r => r.title)).toEqual(['Beck (Ch. 1–3)', 'Persons (Ch. 1)']);

    const week2 = res.weeks?.find(w => w.weekNumber === 2);
    expect(week2?.theme).toBe('MODULE 02: Socratic Dialogue & Cognitive Restructuring');

    const week3 = res.weeks?.find(w => w.weekNumber === 3);
    expect(week3?.theme).toBe('MODULE 03: Behavioural Experiments & Exposure Design');

    const week5 = res.weeks?.find(w => w.weekNumber === 5);
    expect(week5?.theme).toBe('MODULE 05: Distress Tolerance & Emotion Regulation (DBT)');

    const week9 = res.weeks?.find(w => w.weekNumber === 9);
    expect(week9?.theme).toBe('MODULE 09: Supervision Lab & Consultation Exchange');

    const week10 = res.weeks?.find(w => w.weekNumber === 10);
    expect(week10?.theme).toBe('MODULE 10: Culturally Responsive Adaptation in CBT');
    expect(week10?.readings?.map(r => r.title)).toEqual(['Hays (Ch. 2 & 7)', 'Indigenous Perspectives']);

    const week11 = res.weeks?.find(w => w.weekNumber === 11);
    expect(week11?.theme).toBe('MODULE 11: Relapse Prevention, Termination & Closings');
    expect(week11?.readings?.map(r => r.title)).toEqual(['Beck (Ch. 18)', 'Canadian Code of Ethics']);
  });

  it('parses native iOS PDFKit extracted text for PSYC 612', () => {
    const fs = require('fs');
    if (!fs.existsSync('/tmp/psyc612_pdfkit.txt')) return;
    const pdfkitText = fs.readFileSync('/tmp/psyc612_pdfkit.txt', 'utf8');
    const res = LocalSyllabusParser.shared.parseText(pdfkitText);

    expect(res.courseCode).toBe('PSYC 612');
    expect(res.courseName).toBe('Advanced Cognitive Behavioural Interventions');
    expect(res.instructorName).toBe('Aris Thorne, Ph.D., R.Psych.');
    expect(res.instructorEmail).toBe('athorne@appliedpsych.edu');
    expect(res.officeHours).toBe('Tuesdays 2:00 PM – 4:00 PM PST');
    expect(res.courseDescription).toContain('third-wave modalities');

    expect(res.assignments?.length).toBe(4);
    expect(res.assignments?.map(a => a.title)).toEqual([
      'Comprehensive Clinical Case Formulation',
      'Simulated Dyadic Clinical Demonstration',
      'Critical Peer Supervision & Consultation',
      'Seminar Engagement & Clinical Reflexivity'
    ]);
    expect(res.assignments?.map(a => a.weightPercentage)).toEqual(['35%', '30%', '15%', '20%']);
    expect(res.assignments?.map(a => a.weekNumber)).toEqual([5, 7, 9, 1]);
    expect(res.assignments?.map(a => a.dueDate)).toEqual(['2026-10-08', '2026-10-22', '2026-11-05', '2026-09-10']);

    expect(res.weeks?.length).toBe(11);
    expect(res.weeks?.every(w => !!w.startDate && !!w.dateRangeStr)).toBe(true);

    const week1 = res.weeks?.find(w => w.weekNumber === 1);
    expect(week1?.theme).toBe('MODULE 01: Cognitive Case Conceptualization Frameworks');
    expect(week1?.readings?.map(r => r.title)).toEqual(['Beck (Ch. 1–3)', 'Persons (Ch. 1)']);

    const week2 = res.weeks?.find(w => w.weekNumber === 2);
    expect(week2?.theme).toBe('MODULE 02: Socratic Dialogue & Cognitive Restructuring');

    const week3 = res.weeks?.find(w => w.weekNumber === 3);
    expect(week3?.theme).toBe('MODULE 03: Behavioural Experiments & Exposure Design');

    const week4 = res.weeks?.find(w => w.weekNumber === 4);
    expect(week4?.theme).toBe('MODULE 04: Acceptance & Mindfulness Architecture (ACT)');

    const week5 = res.weeks?.find(w => w.weekNumber === 5);
    expect(week5?.theme).toBe('MODULE 05: Distress Tolerance & Emotion Regulation (DBT)');

    const week6 = res.weeks?.find(w => w.weekNumber === 6);
    expect(week6?.theme).toBe('MODULE 06: Mid-Term Clinical Review & Dyad Setup');
    expect(week6?.readings?.[0]?.title).toBe('Clinical Dossier Packets');

    const week7 = res.weeks?.find(w => w.weekNumber === 7);
    expect(week7?.theme).toContain('Live Dyadic Demonstrations: Cohort A');
    expect(week7?.readings?.[0]?.title).toBe('CTRS Manual & Scoring Guides');

    const week8 = res.weeks?.find(w => w.weekNumber === 8);
    expect(week8?.theme).toContain('Live Dyadic Demonstrations: Cohort B');
    expect(week8?.readings?.[0]?.title).toBe('CTRS Manual & Scoring Guides');

    const week9 = res.weeks?.find(w => w.weekNumber === 9);
    expect(week9?.theme).toBe('MODULE 09: Supervision Lab & Consultation Exchange');
    expect(week9?.readings?.[0]?.title).toBe('Peer Consultation Protocol Sheets');

    const week10 = res.weeks?.find(w => w.weekNumber === 10);
    expect(week10?.theme).toBe('MODULE 10: Culturally Responsive Adaptation in CBT');
    expect(week10?.readings?.map(r => r.title)).toEqual(['Hays (Ch. 2 & 7)', 'Indigenous Perspectives']);

    const week11 = res.weeks?.find(w => w.weekNumber === 11);
    expect(week11?.theme).toBe('MODULE 11: Relapse Prevention, Termination & Closings');
    expect(week11?.readings?.map(r => r.title)).toEqual(['Beck (Ch. 18)', 'Canadian Code of Ethics']);
  });
});
