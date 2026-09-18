import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

describe('Random Syllabi Universal Stress Test Suite', () => {
  // Test 1: Pure Point-Based Course (No percentages, 1000 Total Points)
  it('handles pure point grading systems (e.g. 1000 points total) without fabricating percentages', () => {
    const syllabusText = `
      Stanford University - Department of Computer Science
      CS 106B: Programming Abstractions
      Instructor: Dr. Julie Zelenski (zelenski@cs.stanford.edu)
      Autumn Quarter 2026

      Course Description:
      Advanced software engineering principles, data structures, and algorithmic analysis in C++.

      Grading Criteria:
      Assignment 1: Game of Life - 100 Points
      Assignment 2: ADTs and Mazes - 150 Points
      Assignment 3: Recursion and Backtracking - 150 Points
      Midterm Examination - 250 Points
      Final Project: Priority Queue Simulator - 350 Points
      TOTAL: 1000 Points

      Course Schedule:
      Week 1 (Sep 21): C++ Fundamentals & Strings
      Required: Chapter 1 & 2 in Programming Abstractions in C++
      Week 2 (Sep 28): Collections and ADTs
      Required: Chapter 3 & 4
      Due: Assignment 1: Game of Life
      Week 5 (Oct 19): Midterm Review
      Due: Midterm Examination
    `;

    const parsed = LocalSyllabusParser.shared.parseText(syllabusText);
    expect(parsed.courseCode).toBe('CS 106B');
    expect(parsed.courseName).toContain('Programming Abstractions');
    expect(parsed.instructorEmail).toBe('zelenski@cs.stanford.edu');

    const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(parsed, syllabusText);
    expect(normalized.candidateAssignments.length).toBe(5);

    // Verify point extraction
    const a1 = normalized.candidateAssignments.find(a => (a.title || '').toLowerCase().includes('game of life'));
    expect(a1).toBeDefined();
    expect(a1?.pointsPossible).toBe('100 Points');
    expect(a1?.title).not.toContain('|||');
    expect(a1?.title).not.toContain('|');

    const midterm = normalized.candidateAssignments.find(a => (a.title || '').toLowerCase().includes('midterm'));
    expect(midterm).toBeDefined();
    expect(midterm?.pointsPossible).toBe('250 Points');

    const finalProj = normalized.candidateAssignments.find(a => (a.title || '').toLowerCase().includes('priority queue'));
    expect(finalProj).toBeDefined();
    expect(finalProj?.pointsPossible).toBe('350 Points');
  });

  // Test 2: Graduate Seminar with 0 Assignments (Pure Discussion & Readings)
  it('handles reading seminars with 0 assignments without inventing fake deliverables', () => {
    const syllabusText = `
      Columbia University - Department of Philosophy
      PHIL 8200: Advanced Seminar in Epistemology
      Instructor: Prof. Akeel Bilgrami (ab123@columbia.edu)
      Spring 2026

      Course Overview:
      This is a doctoral reading colloquium. There are no written examinations or papers.
      Assessment is based purely on seminar discussion and verbal leadership.

      Weekly Schedule:
      Week 1 (Jan 19): Foundationalism and Coherentism
      Required: Sellars, Empiricism and the Philosophy of Mind, Ch. 1-3
      Week 2 (Jan 26): Epistemic Justification
      Required: BonJour, The Structure of Empirical Knowledge, Ch. 4
      Week 3 (Feb 02): Internalism vs Externalism
      Required: Goldman, What is Justified Belief?, pp. 1-25
    `;

    const parsed = LocalSyllabusParser.shared.parseText(syllabusText);
    expect(parsed.courseCode).toBe('PHIL 8200');
    expect(parsed.courseName).toContain('Epistemology');

    const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(parsed, syllabusText);
    // MUST NOT invent any assignments
    expect(normalized.candidateAssignments.length).toBe(0);
    // Readings must be extracted
    expect(normalized.candidateReadings.length).toBeGreaterThanOrEqual(3);
  });

  // Test 3: Compound Scheme with Explicit Section Headers and Points
  it('extracts deliverables with distinct titles, explicit points, and weights from section details', () => {
    const syllabusText = `
      University of Washington - College of Engineering
      EE 215: Fundamentals of Electrical Engineering
      Instructor: Dr. James Peckol (peckol@uw.edu)
      Fall 2026

      Course Evaluation:
      Laboratory Experiments (20%) - 100 Points
      Homework Problem Sets (25%) - 200 Points
      Midterm Exam (25%) - 100 Points
      Final Comprehensive Examination (30%) - 150 Points
      TOTAL 100%

      Weekly Schedule:
      Week 1 (Sep 30): Circuit Theorems
      Week 4 (Oct 21): Operational Amplifiers
      Due: Midterm Exam
    `;

    const parsed = LocalSyllabusParser.shared.parseText(syllabusText);
    expect(parsed.courseCode).toBe('EE 215');
    expect(parsed.courseName).toContain('Electrical Engineering');

    const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(parsed, syllabusText);
    expect(normalized.candidateAssignments.length).toBe(4);

    const lab = normalized.candidateAssignments.find(a => (a.title || '').toLowerCase().includes('laboratory'));
    expect(lab?.weightPercentage).toBe('20%');
    expect(lab?.pointsPossible).toBe('100 Points');

    const hw = normalized.candidateAssignments.find(a => (a.title || '').toLowerCase().includes('homework'));
    expect(hw?.weightPercentage).toBe('25%');
    expect(hw?.pointsPossible).toBe('200 Points');

    const finalExam = normalized.candidateAssignments.find(a => (a.title || '').toLowerCase().includes('final comprehensive'));
    expect(finalExam?.weightPercentage).toBe('30%');
    expect(finalExam?.pointsPossible).toBe('150 Points');
  });

  // Test 4: Syllabus with Extreme Policy Text & Deductions that must NOT become assignments
  it('filters out late policy deductions, attendance rules, and Title IX statements', () => {
    const syllabusText = `
      UC Berkeley - Department of History
      HIST 100: Historical Research Methods
      Instructor: Prof. Mary Thomas (mthomas@berkeley.edu)

      Course Policies:
      Late Assignments:
      -1 point if submitted within 24 hours
      -5 points if submitted within 48 hours
      -10 points if submitted 3 days after deadline
      Attendance is strictly mandatory. Students with more than 2 absences will fail.
      Academic integrity is strictly enforced according to campus code.

      Grading Scheme:
      Archival Research Paper (50%)
      Oral Presentation (20%)
      Weekly Critical Memos (30%)
      Total 100%
    `;

    const parsed = LocalSyllabusParser.shared.parseText(syllabusText);
    expect(parsed.courseCode).toBe('HIST 100');

    const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(parsed, syllabusText);
    expect(normalized.candidateAssignments.length).toBe(3);

    const titles = normalized.candidateAssignments.map(a => (a.title || '').toLowerCase());
    expect(titles.some(t => t.includes('archival research'))).toBe(true);
    expect(titles.some(t => t.includes('oral presentation'))).toBe(true);
    expect(titles.some(t => t.includes('weekly critical'))).toBe(true);

    // Ensure late policy deductions never became assignments
    expect(titles.some(t => t.includes('-1 point') || t.includes('submitted within') || t.includes('late assignment'))).toBe(false);
  });

  // Test 5: Accelerated 7-Week Block Syllabus
  it('handles 7-week accelerated block format with weekly modules', () => {
    const syllabusText = `
      Western Governors University
      MGT 600: Strategic Leadership
      Instructor: Dr. Robert Vance (rvance@wgu.edu)

      Module 1 (Jan 05 - Jan 11): Executive Decision Making
      Readings: Harvard Business Review Cases
      Deliverable 1: Case Analysis Memo (25%)

      Module 3 (Jan 19 - Jan 25): Organizational Change
      Deliverable 2: Change Management Strategy (35%)

      Module 7 (Feb 16 - Feb 22): Capstone Project
      Deliverable 3: Final Executive Portfolio (40%)
    `;

    const parsed = LocalSyllabusParser.shared.parseText(syllabusText);
    expect(parsed.courseCode).toBe('MGT 600');

    const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(parsed, syllabusText);
    expect(normalized.candidateAssignments.length).toBe(3);
    expect(normalized.candidateAssignments.every(a => !(a.title || '').includes('|||'))).toBe(true);
  });

  // Test 6: STEM / MIT Format with Grade Cutoffs and Problem Sets
  it('handles STEM syllabi with letter grade scales without turning grade scales into assignments', () => {
    const syllabusText = `
      Massachusetts Institute of Technology - Department of Mechanical Engineering
      2.001: Mechanics and Materials I
      Instructor: Prof. Simona Socrate (socrate@mit.edu)
      Fall Term 2026

      GRADING POLICY:
      Problem Sets (5 total): 25% (250 Points)
      Design Challenge: 15% (150 Points)
      Midterm Exam: 30% (300 Points)
      Final Exam: 30% (300 Points)
      TOTAL: 100% (1000 Points)

      GRADING SCALE:
      A: 900 - 1000 Points
      B: 800 - 899 Points
      C: 700 - 799 Points
      D: 600 - 699 Points
      F: Below 600 Points

      SCHEDULE & DELIVERABLES:
      Week 1 (Sep 09): Stress and Strain Tensors
      Week 4 (Sep 30): Torsion in Circular Shafts
      Due: Design Challenge (150 Points) on Oct 02
      Week 8 (Oct 28): Midterm Review
      Due: Midterm Exam (300 Points) on Oct 30
      Week 14 (Dec 09): Final Review
      Due: Final Exam (300 Points) on Dec 11
    `;

    const parsed = LocalSyllabusParser.shared.parseText(syllabusText);
    expect(parsed.courseCode).toBe('2.001');
    expect(parsed.courseName).toContain('Mechanics and Materials');

    const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(parsed, syllabusText);
    expect(normalized.candidateAssignments.length).toBe(4);

    const titles = normalized.candidateAssignments.map(a => (a.title || '').toLowerCase());
    // Grade scale cutoffs MUST NOT be assignments
    expect(titles.some(t => t.includes('900 - 1000') || t.includes('grade scale') || t.includes('below 600'))).toBe(false);

    const design = normalized.candidateAssignments.find(a => (a.title || '').toLowerCase().includes('design challenge'));
    expect(design).toBeDefined();
    expect(design?.weightPercentage).toBe('15%');
    expect(design?.pointsPossible).toBe('150 Points');
  });

  // Test 7: Nursing / Medical Clinical Syllabus with OSCE and Quizzes
  it('handles clinical health science courses with simulation rubrics and quizzes', () => {
    const syllabusText = `
      Johns Hopkins School of Nursing
      NR 310: Adult Health Assessment & Clinical Practicum
      Instructor: Dr. Angela McNelis (amcnelis@jhu.edu)
      Semester: Fall 2026

      EVALUATION AND ASSESSMENTS:
      Pharmacology Drug Calculation Quiz - 50 Points
      OSCE Clinical Simulation Exam - 100 Points
      Comprehensive Patient Care Plan - 150 Points
      Clinical Preceptor Performance Evaluation - 100 Points
      Total: 400 Points

      CLINICAL SCHEDULE:
      Week 1 (Sep 02): Health History Interviewing
      Week 3 (Sep 16): Cardiovascular and Pulmonary Assessment
      Due: Pharmacology Drug Calculation Quiz
      Week 7 (Oct 14): In-Patient Simulation Lab
      Due: OSCE Clinical Simulation Exam
      Week 11 (Nov 11): Complex Cases
      Due: Comprehensive Patient Care Plan
    `;

    const parsed = LocalSyllabusParser.shared.parseText(syllabusText);
    expect(parsed.courseCode).toBe('NR 310');
    expect(parsed.courseName).toContain('Adult Health Assessment');

    const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(parsed, syllabusText);
    expect(normalized.candidateAssignments.length).toBe(4);

    const osce = normalized.candidateAssignments.find(a => (a.title || '').toLowerCase().includes('osce'));
    expect(osce?.pointsPossible).toBe('100 Points');

    const carePlan = normalized.candidateAssignments.find(a => (a.title || '').toLowerCase().includes('patient care plan'));
    expect(carePlan?.pointsPossible).toBe('150 Points');
  });

  // Test 8: Law School Seminar with Single 100% Term Paper
  it('handles law school seminar with a single 100% substantial paper', () => {
    const syllabusText = `
      Harvard Law School
      LAW 940: Seminar on First Amendment Jurisprudence
      Prof. Noah Feldman (nfeldman@law.harvard.edu)
      Fall 2026

      COURSE REQUIREMENTS & GRADING:
      Substantial Supervised Research Paper: 100%
      Due Date: Friday, December 11, 2026 at 5:00 PM.
      Late submissions will not be accepted without Dean's approval.

      SEMINAR READINGS:
      Week 1: Free Speech in the Digital Age
      Required: Tribe, American Constitutional Law, pp. 200-245
      Week 2: Defamation and Libel
      Required: New York Times v. Sullivan (376 U.S. 254)
    `;

    const parsed = LocalSyllabusParser.shared.parseText(syllabusText);
    expect(parsed.courseCode).toBe('LAW 940');
    expect(parsed.courseName).toContain('First Amendment Jurisprudence');

    const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(parsed, syllabusText);
    expect(normalized.candidateAssignments.length).toBe(1);

    const paper = normalized.candidateAssignments[0];
    expect(paper.title).toContain('Substantial Supervised Research Paper');
    expect(paper.weightPercentage).toBe('100%');
    expect(paper.title).not.toContain('|||');
  });

  // Test 9: Art & Design Studio with Crits and Portfolios
  it('handles studio art course with critiques and exhibition portfolios', () => {
    const syllabusText = `
      Rhode Island School of Design
      ID 201: Industrial Design Studio I
      Instructor: Prof. Ayako Takase (atakase@risd.edu)
      Fall 2026

      GRADING AND DELIVERABLES:
      1. Form & Material Exploration Study (20%) - 50 Points
      2. Midterm Studio Critique Model (30%) - 100 Points
      3. User Ergonomics Research Deck (20%) - 50 Points
      4. Final Working Prototype & Portfolio (30%) - 150 Points

      STUDIO SCHEDULE:
      Week 1 (Sep 14): Rapid Prototyping in Foam
      Week 6 (Oct 19): Midterm Crits
      Due: Midterm Studio Critique Model
      Week 12 (Nov 30): Production Detailing
      Due: Final Working Prototype & Portfolio
    `;

    const parsed = LocalSyllabusParser.shared.parseText(syllabusText);
    expect(parsed.courseCode).toBe('ID 201');
    expect(parsed.courseName).toContain('Industrial Design Studio');

    const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(parsed, syllabusText);
    expect(normalized.candidateAssignments.length).toBe(4);

    const crit = normalized.candidateAssignments.find(a => (a.title || '').toLowerCase().includes('midterm studio critique'));
    expect(crit?.weightPercentage).toBe('30%');
    expect(crit?.pointsPossible).toBe('100 Points');
  });

  // Test 10: Messy Table Layout with pipes and mixed whitespace
  it('handles messy table layouts with pipe delimiters without letting pipes leak into titles', () => {
    const syllabusText = `
      University of Michigan
      EECS 482: Introduction to Operating Systems
      Fall 2026 | Prof. Peter Chen (pmchen@umich.edu)

      | Assignment | Weight | Max Points | Due Date |
      | Project 1: Thread Library | 15% | 100 pts | Oct 02, 2026 |
      | Project 2: Virtual Memory | 20% | 100 pts | Oct 23, 2026 |
      | Project 3: File System | 20% | 100 pts | Nov 20, 2026 |
      | Midterm Exam | 20% | 80 pts | Oct 28, 2026 |
      | Final Exam | 25% | 120 pts | Dec 14, 2026 |
    `;

    const parsed = LocalSyllabusParser.shared.parseText(syllabusText);
    expect(parsed.courseCode).toBe('EECS 482');

    const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(parsed, syllabusText);
    expect(normalized.candidateAssignments.length).toBe(5);

    normalized.candidateAssignments.forEach(a => {
      expect(a.title).not.toContain('|');
      expect(a.title).not.toContain('|||');
      expect(a.pointsPossible).toBeDefined();
      expect(a.weightPercentage).toBeDefined();
    });
  });
});
