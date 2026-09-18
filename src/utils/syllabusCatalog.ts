/**
 * Pre-Bundled Academic Syllabus Catalog & Sample Text Definitions
 * Enables instant offline syllabus imports, live document simulation, and automated testing.
 */

import cityuSyllabi from './cityu_syllabi_texts.json';

export interface BundledSyllabusItem {
  id: string;
  courseCode: string;
  courseName: string;
  instructorName: string;
  instructorEmail: string;
  department: string;
  fileName: string;
  fileSize: string;
  hexColor: string;
  rawText: string;
}

export const BundledSyllabiCatalog: BundledSyllabusItem[] = [
  {
    id: 'psyc-612',
    courseCode: 'PSYC 612',
    courseName: 'Advanced Cognitive Behavioural Interventions',
    instructorName: 'Dr. Aris Thorne, Ph.D., R.Psych.',
    instructorEmail: 'athorne@appliedpsych.edu',
    department: 'Department of Applied Psychology & Behavioural Sciences',
    fileName: 'PSYC612_Advanced_CBT_Interventions.pdf',
    fileSize: '410 KB',
    hexColor: '#4F46E5',
    rawText: `COURSE SYLLABUS & SCHEMA
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
`
  },
  {
    id: 'cpc-514',
    courseCode: 'CPC 514',
    courseName: 'Research Methods and Statistics',
    instructorName: 'Dr. Alireza Sedghi Taromi, PhD',
    instructorEmail: 'sedghitaromialireza@cityu.edu',
    department: 'School of Health & Social Sciences',
    fileName: 'CPC514_Research_Methods_Syllabus.pdf',
    fileSize: '300 KB',
    hexColor: '#2563EB',
    rawText: cityuSyllabi.cpc514
  },
  {
    id: 'cpc-523',
    courseCode: 'CPC 523',
    courseName: 'Psychology of Sexuality and Human Development',
    instructorName: 'Marie-Pier Gilbert',
    instructorEmail: 'gilbertmariepier@cityu.edu',
    department: 'School of Health & Social Sciences',
    fileName: 'CPC523_Human_Sexuality_Syllabus.pdf',
    fileSize: '265 KB',
    hexColor: '#7C3AED',
    rawText: cityuSyllabi.cpc523
  },
  {
    id: 'cpc-511',
    courseCode: 'CPC 511',
    courseName: 'Psychology of Loss and Grief',
    instructorName: 'Diana Morgan',
    instructorEmail: 'morgandiana@cityu.edu',
    department: 'School of Health and Social Sciences',
    fileName: 'CPC511_Loss_and_Grief_Syllabus.pdf',
    fileSize: '320 KB',
    hexColor: '#EC4899',
    rawText: cityuSyllabi.cpc511
  },
  {
    id: 'cpc-527',
    courseCode: 'CPC 527',
    courseName: 'Group Counselling Psychology',
    instructorName: 'Kelsey Murrin',
    instructorEmail: 'murrinkelsey@cityu.edu',
    department: 'School of Health and Social Sciences',
    fileName: 'CPC527_Group_Counselling_Syllabus.pdf',
    fileSize: '480 KB',
    hexColor: '#059669',
    rawText: cityuSyllabi.cpc527
  },
  {
    id: 'cs-501',
    courseCode: 'CS 501',
    courseName: 'Machine Learning & Neural Algorithms',
    instructorName: 'Dr. Andrew Ng',
    instructorEmail: 'andrew.ng@stanford.edu',
    department: 'Department of Computer Science',
    fileName: 'CS501_Machine_Learning_Syllabus.pdf',
    fileSize: '310 KB',
    hexColor: '#EA580C',
    rawText: `CS 501: Machine Learning & Neural Algorithms
Department of Computer Science
Instructor: Dr. Andrew Ng
Email: andrew.ng@stanford.edu

Grading Breakdown:
Programming Problem Set 1: Gradient Descent (20%) - Due Oct 12, 2026
Programming Problem Set 2: Neural Networks & Backprop (25%) - Due Nov 2, 2026
Midterm Examination (25%) - Due Nov 16, 2026
Final Course Capstone Project (30%) - Due Dec 14, 2026
Total 100%

Week 1 Oct 5th
Linear Regression, Cost Functions and Gradient Descent
Required:
Bishop Chapter 1 — Introduction to Statistical Learning
Bishop Chapter 3 — Linear Models for Regression

Week 2 Oct 12th
Logistic Regression, Classification and Regularization
Required:
Bishop Chapter 4 — Linear Models for Classification

Week 3 Oct 19th
Deep Feedforward Neural Networks and Optimization
Required:
Goodfellow Chapter 6 — Deep Feedforward Networks
Goodfellow Chapter 8 — Optimization for Training Deep Models`
  },
  {
    id: 'cpc-510',
    courseCode: 'CPC 510',
    courseName: 'Theoretical Foundations of Psychotherapy',
    instructorName: 'Dr. Sarah Jenkins, PhD',
    instructorEmail: 'jenkins.s@cityu.edu',
    department: 'School of Health & Social Sciences',
    fileName: 'CPC511_Theoretical_Foundations_Syllabus.pdf',
    fileSize: '340 KB',
    hexColor: '#0284C7',
    rawText: `CPC 511: Theoretical Foundations of Psychotherapy
Faculty of Counselling Psychology
Instructor: Dr. Sarah Jenkins, PhD
Email: jenkins.s@cityu.edu

Grading Breakdown:
Theoretical Orientation Comparative Paper (35%) - Due July 19, 2026
Case Conceptualization Portfolio (40%) - Due August 16, 2026
In-Class Clinical Dialogue (25%) - Due September 6, 2026
Total 100%

Week 1 July 5th
Psychoanalytic and Psychodynamic Traditions
Required:
Freud Chapter 2 — Topographical and Structural Models of Mind
Mitchell Chapter 1 — Relational Concepts in Psychoanalysis

Week 2 July 12th
Humanistic, Person-Centered, and Gestalt Modalities
Required:
Rogers Chapter 3 — The Necessary and Sufficient Conditions
Perls Chapter 4 — Gestalt Therapy Verbatim

Week 3 July 19th
Existential Psychotherapy and Meaning-Making
Required:
Yalom Chapter 2 — Death, Freedom, and Isolation in Clinical Care`
  },
  {
    id: 'cpc-512',
    courseCode: 'CPC 512',
    courseName: 'Counselling Skills & Clinical Interviewing',
    instructorName: 'Prof. David Vance, MA, RCC',
    instructorEmail: 'vancedavid@cityu.edu',
    department: 'School of Health & Social Sciences',
    fileName: 'CPC512_Counselling_Skills_Syllabus.pdf',
    fileSize: '290 KB',
    hexColor: '#10B981',
    rawText: `CPC 512: Counselling Skills & Clinical Interviewing
School of Health & Social Sciences
Faculty: Prof. David Vance, MA, RCC
Email: vancedavid@cityu.edu

Required Assignments:
Micro-Skills Video Recording 1 (25%) - Due July 21, 2026 (100 Points)
Micro-Skills Video Recording 2 (35%) - Due August 18, 2026 (100 Points)
Clinical Assessment Report (30%) - Due September 8, 2026 (100 Points)
Active Attendance & Peer Practice (10%) - Due September 15, 2026 (100 Points)
Total 100%

Week 1 July 7th
Attending Behaviors and Primary Empathy
Required:
Ivey Chapter 1 — Intentional Interviewing and Counselling
Ivey Chapter 3 — Attending Behavior and Nonverbal Cues

Week 2 July 14th
Questions, Openings, and Observation Competencies
Required:
Ivey Chapter 4 — Questions: Opening Communication
Ivey Chapter 5 — Observation Skills in Therapeutic Dialogue

Week 3 July 21st
Reflecting Feelings and Emotion Regulation
Required:
Ivey Chapter 7 — Reflecting Feelings: A Foundation of Empathy`
  },
  {
    id: 'bio-412',
    courseCode: 'BIO 412',
    courseName: 'Molecular Genetics & Recombinant DNA',
    instructorName: 'Dr. Aris Thorne, DSc',
    instructorEmail: 'thorne.aris@biology.edu',
    department: 'Department of Biological Sciences',
    fileName: 'Syllabus_2_BIO412.pdf',
    fileSize: '410 KB',
    hexColor: '#16A34A',
    rawText: `BIO 412: Molecular Genetics & Recombinant DNA
Department of Biological Sciences
Instructor: Dr. Aris Thorne, DSc
Email: thorne.aris@biology.edu

Assignments and Assessment:
Lab Practical Report 1: CRISPR Gene Editing (25%) - Due October 14, 2026
Midterm Examination (30%) - Due November 4, 2026
Genomics Research Presentation (20%) - Due November 25, 2026
Final Comprehensive Exam (25%) - Due December 16, 2026
Total 100%

Week 1 Oct 6th
DNA Replication, Repair, and Recombination Machinery
Required:
Watson Chapter 8 — The Mechanisms of DNA Replication
Watson Chapter 9 — Homologous Recombination and Repair

Week 2 Oct 13th
Transcription Regulation and RNA Processing
Required:
Watson Chapter 12 — Mechanisms of Transcription in Eukaryotes
Watson Chapter 13 — RNA Splicing and Ribozyme Kinetics

Week 3 Oct 20th
CRISPR-Cas9 Technologies and Molecular Cloning
Required:
Doudna Chapter 3 — A Crack in Creation: Gene Editing Paradigms`
  },
  {
    id: 'law-702',
    courseCode: 'LAW 702',
    courseName: 'Constitutional Law & Civil Liberties',
    instructorName: 'Prof. Helen Montgomery, JD',
    instructorEmail: 'montgomery.h@lawschool.edu',
    department: 'Faculty of Law',
    fileName: 'Syllabus_3_LAW702.pdf',
    fileSize: '380 KB',
    hexColor: '#B45309',
    rawText: `LAW 702: Constitutional Law & Civil Liberties
Faculty of Law
Instructor: Prof. Helen Montgomery, JD
Email: montgomery.h@lawschool.edu

Grading Scheme:
Appellate Moot Court Brief (30%) - Due October 20, 2026 (100 Points)
Judicial Analysis Paper (30%) - Due November 17, 2026 (100 Points)
Final Proctored Examination (40%) - Due December 15, 2026 (100 Points)
Total 100%

Week 1 Oct 8th
Judicial Review and Separation of Powers
Required:
Chemerinsky Chapter 1 — Historical Foundations of Judicial Review
Marbury v. Madison — Selected Judicial Opinions pp. 45-68

Week 2 Oct 15th
Federalism, Commerce Clause, and Sovereign Immunity
Required:
Chemerinsky Chapter 3 — The Federal Commerce Power and Economic Regulation
McCulloch v. Maryland — Statutory Review pp. 110-132

Week 3 Oct 22nd
Equal Protection and Fundamental Liberties
Required:
Chemerinsky Chapter 9 — Equal Protection Clause and Strict Scrutiny`
  },
  {
    id: 'econ-305',
    courseCode: 'ECON 305',
    courseName: 'Intermediate Macroeconomics & Monetary Policy',
    instructorName: 'Dr. Gregory Sterling, PhD',
    instructorEmail: 'gsterling@econ.edu',
    department: 'Department of Economics',
    fileName: 'Syllabus_6_ECON305.pdf',
    fileSize: '320 KB',
    hexColor: '#2563EB',
    rawText: `ECON 305: Intermediate Macroeconomics & Monetary Policy
Department of Economics
Instructor: Dr. Gregory Sterling, PhD
Email: gsterling@econ.edu

Grading and Requirements:
Problem Set 1: IS-LM Equilibrium (20%) - Due October 16, 2026
Monetary Policy Central Bank Simulation (25%) - Due November 6, 2026
Midterm Examination (25%) - Due November 20, 2026
Final Empirical Macro Report (30%) - Due December 18, 2026
Total 100%

Week 1 Oct 9th
Aggregate Demand, Consumption, and the IS Curve
Required:
Mankiw Chapter 3 — National Income: Where It Comes From and Where It Goes
Mankiw Chapter 10 — Building the IS-LM Model

Week 2 Oct 16th
Money Supply, Central Banking, and the LM Curve
Required:
Mankiw Chapter 11 — Aggregate Demand in the Open Economy
Mankiw Chapter 12 — The Monetary Transmission Mechanism

Week 3 Oct 23rd
Inflation Dynamics, Phillips Curve, and Rational Expectations
Required:
Mankiw Chapter 14 — Aggregate Supply and the Short-Run Tradeoff`
  },
  {
    id: 'phys-601',
    courseCode: 'PHYS 601',
    courseName: 'Quantum Mechanics & Wave Dynamics',
    instructorName: 'Dr. Marcus Vance, PhD',
    instructorEmail: 'vance.m@physics.edu',
    department: 'Department of Physics',
    fileName: 'Syllabus_7_PHYS601.pdf',
    fileSize: '450 KB',
    hexColor: '#7C3AED',
    rawText: `PHYS 601: Quantum Mechanics & Wave Dynamics
Department of Physics
Instructor: Dr. Marcus Vance, PhD
Email: vance.m@physics.edu

Course Evaluation:
Problem Set 1: Wave Packets & Uncertainty (20%) - Due October 15, 2026
Problem Set 2: Harmonic Oscillator & Dirac Notation (25%) - Due November 5, 2026
Midterm Exam (25%) - Due November 19, 2026
Final Quantum Computing Capstone (30%) - Due December 17, 2026
Total 100%

Week 1 Oct 7th
Wave-Particle Duality and the Schrödinger Equation
Required:
Griffiths Chapter 1 — The Wave Function and Probability Current
Griffiths Chapter 2 — Time-Independent Schrödinger Equation

Week 2 Oct 14th
Formalism: Hilbert Space and Dirac Notation
Required:
Griffiths Chapter 3 — Quantum Formalism and Hermitian Operators
Sakurai Chapter 1 — Fundamental Concepts of State Vectors

Week 3 Oct 21st
Quantum Harmonic Oscillator and Creation Operators
Required:
Griffiths Chapter 2.3 — The Harmonic Oscillator: Algebraic Method`
  },
  {
    id: 'hist-210',
    courseCode: 'HIST 210',
    courseName: 'Modern World History & Global Revolutions',
    instructorName: 'Dr. Claire Laurent',
    instructorEmail: 'laurent.c@history.edu',
    department: 'Department of History',
    fileName: 'Syllabus_8_HIST210.pdf',
    fileSize: '315 KB',
    hexColor: '#D97706',
    rawText: `HIST 210: Modern World History & Global Revolutions
Department of History
Instructor: Dr. Claire Laurent
Email: laurent.c@history.edu

Grading Scheme:
Primary Source Archival Analysis (25%) - Due October 18, 2026
Midterm Essay Examination (30%) - Due November 8, 2026
Comparative Revolution Research Paper (35%) - Due December 6, 2026
Historical Seminar Participation (10%) - Due December 13, 2026
Total 100%

Week 1 Oct 11th
The Enlightenment and Atlantic Revolutionary Waves
Required:
Palmer Chapter 1 — The Age of the Democratic Revolution
Rousseau — The Social Contract: Selected Passages pp. 1-35

Week 2 Oct 18th
The Industrial Revolution and Global Economic Shifts
Required:
Hobsbawm Chapter 2 — The Industrial Revolution in Global Context
Marx & Engels — The Communist Manifesto Sections 1 & 2

Week 3 Oct 25th
Imperialism, Resistance, and Modern Anti-Colonial Struggles
Required:
Fanon Chapter 1 — Concerning Violence in The Wretched of the Earth`
  },
  {
    id: 'art-150',
    courseCode: 'ART 150',
    courseName: 'Italian Renaissance Art & Architectural Form',
    instructorName: 'Prof. Camilla Rossi',
    instructorEmail: 'rossi.camilla@finearts.edu',
    department: 'Department of Art History',
    fileName: 'Syllabus_9_ART150.pdf',
    fileSize: '395 KB',
    hexColor: '#E11D48',
    rawText: `ART 150: Italian Renaissance Art & Architectural Form
Department of Art History
Instructor: Prof. Camilla Rossi
Email: rossi.camilla@finearts.edu

Assessment Breakdown:
Visual Iconography Critique (30%) - Due October 22, 2026
Museum Field Research Paper (35%) - Due November 19, 2026
Final Visual Slide Examination (35%) - Due December 17, 2026
Total 100%

Week 1 Oct 8th
Giotto, the Arena Chapel, and the Dawn of Renaissance Naturalism
Required:
Vasari Chapter 2 — Lives of the Most Excellent Painters: Giotto
Hartt Chapter 3 — Florence and the Origins of Renaissance Humanism

Week 2 Oct 15th
Linear Perspective and Quattrocento Innovation
Required:
Alberti — On Painting: Book 1 Mathematical Perspective
Hartt Chapter 6 — Brunelleschi, Donatello, and Masaccio

Week 3 Oct 22nd
The High Renaissance: Leonardo, Michelangelo, and Raphael
Required:
Hartt Chapter 15 — The High Renaissance in Florence and Rome`
  },
  {
    id: 'psych-800',
    courseCode: 'PSYCH 800',
    courseName: 'Advanced Cognitive Neuroscience & Brain Imaging',
    instructorName: 'Dr. Jonathan Blake, PhD',
    instructorEmail: 'jblake@neuroscience.edu',
    department: 'Institute of Brain & Cognitive Sciences',
    fileName: 'Syllabus_10_PSYCH800.pdf',
    fileSize: '430 KB',
    hexColor: '#4F46E5',
    rawText: `PSYCH 800: Advanced Cognitive Neuroscience & Brain Imaging
Institute of Brain & Cognitive Sciences
Instructor: Dr. Jonathan Blake, PhD
Email: jblake@neuroscience.edu

Grading Policy:
fMRI Methodology Literature Critique (25%) - Due October 21, 2026
Experimental Design Proposal (35%) - Due November 18, 2026
Final Neuroimaging Capstone Presentation (30%) - Due December 9, 2026
Journal Club Discussion Leadership (10%) - Due December 16, 2026
Total 100%

Week 1 Oct 7th
Functional Neuroanatomy and Principles of fMRI BOLD Signals
Required:
Gazzaniga Chapter 2 — Structure and Functions of the Nervous System
Huettel Chapter 6 — From Neuronal Activity to Blood Oxygenation (BOLD)

Week 2 Oct 14th
Prefrontal Cortex and Executive Function Architecture
Required:
Gazzaniga Chapter 12 — Cognitive Control and Goal-Directed Behavior
Miller & Cohen — An Integrative Theory of Prefrontal Cortex Function

Week 3 Oct 21st
Memory Systems: Hippocampal Circuits and Consolidation
Required:
Gazzaniga Chapter 9 — Learning and Memory Systems
Squire & Alvarez — Retrograde Amnesia and Memory Consolidation`
  }
];
