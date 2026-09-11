import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';

// Boilerplate generator to create massive academic document context (pages of institutional text)
function generateBoilerplate(paragraphsCount: number): string {
  const paragraphs = [
    `UNIVERSITY INSTITUTIONAL POLICIES AND ACADEMIC INTEGRITY
Students at the university are expected to adhere strictly to the academic integrity charter.
Plagiarism, collusion, unauthorized collaboration, and submission of duplicate work across multiple
classes are strictly prohibited under Faculty Senate Resolution 2024-81. Any suspected violation
will immediately be escalated to the Academic Conduct Board and Dean of Students.`,

    `TITLE IX AND NONDISCRIMINATION CLAUSE
The institution is committed to maintaining a learning environment free from discrimination,
harassment, and sexual misconduct in accordance with federal Title IX guidelines. Confidential
resources are available 24/7 via the Student Wellness Center and Campus Ombudsperson.`,

    `ACCESSIBILITY AND DISABILITY SUPPORT SERVICES
Students requiring academic accommodations must register with the Student Disability Resource Center (SDRC).
Accommodations cannot be granted retroactively and require official SDRC documentation submitted
within the first two weeks of the academic semester.`,

    `TECHNOLOGY REQUIREMENTS AND VIRTUAL CLASSROOM PROTOCOLS
All enrolled scholars must possess high-speed internet access capable of supporting synchronous
video seminars and high-definition recordings. Software requirements include Python 3.11+, LaTeX distribution,
and licensed institutional access to Brightspace, Canvas, and GitHub Enterprise.`,

    `LAND AND TERRITORIAL ACKNOWLEDGEMENT
We respectfully acknowledge that this campus resides upon the traditional, ancestral, and unceded
territories of indigenous nations who have stewarded these lands for millennia. We honor their
enduring heritage and ongoing stewardship.`
  ];

  let result = '';
  for (let i = 0; i < paragraphsCount; i++) {
    result += `\n\n[Section ${i + 1}.0 - Institutional Governance]\n${paragraphs[i % paragraphs.length]}\n`;
  }
  return result;
}

interface TestCase {
  name: string;
  generateDoc: () => { doc: string; expectedCourseCode: string; expectedAssignments: string[]; expectedReadings: string[] };
}

const testCases: TestCase[] = [
  // Test 1: Massive Clinical Psychology Syllabus with hidden clinical milestones
  {
    name: 'Test 1: CPC 527 Clinical Group Psychotherapy (Massive 500+ paragraph doc)',
    generateDoc: () => {
      const prefix = generateBoilerplate(60);
      const hiddenContent = `
COURSE DETAILS:
Course Code: CPC 527
Course Name: Advanced Clinical Group Psychotherapy
Instructor: Dr. Marcus Vance, Ph.D., ABPP
Term: Fall 2026 (12 Weeks)

SCHEDULE:
Week 1 (Sept 8): Therapeutic Factors in Dynamic Groups. Readings: Yalom Chapter 1, pp. 1-35.
Week 2 (Sept 15): Interpersonal Learning and the Group as Social Microcosm. Readings: Yalom Chapters 2 & 3.
Week 3 (Sept 22): Group Cohesiveness and Member Selection. Readings: Corey Chapter 4.
Week 4 (Sept 29): Initial Stage Norms and Boundary Formation. Readings: Corey Chapter 5.
Week 5 (Oct 6): Working Stage and Facilitation Techniques. Readings: Yalom Chapter 5, pp. 120-165.

EVALUATION & DELIVERABLES:
Assignment 1: Group Formulation Paper. Due October 14, 2026. Worth 25% (100 pts).
Assignment 2: Midterm Video Vignette Analysis. Due November 4, 2026. Worth 35% (100 pts).
Assignment 3: Final Clinical Integration Capstone. Due December 12, 2026. Worth 40% (100 pts).
`;
      const suffix = generateBoilerplate(60);
      return {
        doc: prefix + hiddenContent + suffix,
        expectedCourseCode: 'CPC 527',
        expectedAssignments: ['Group Formulation Paper', 'Midterm Video Vignette Analysis', 'Final Clinical Integration Capstone'],
        expectedReadings: ['Yalom Chapter 1', 'Yalom Chapters 2 & 3', 'Corey Chapter 4']
      };
    }
  },

  // Test 2: Massive Computer Science Neural Networks Syllabus (Assignments in tabular format)
  {
    name: 'Test 2: CS 482 Deep Learning & Neural Architectures (Hidden in tabular schedule)',
    generateDoc: () => {
      const prefix = generateBoilerplate(70);
      const hiddenContent = `
COURSE IDENTIFICATION:
CS 482: Deep Learning Systems
Instructor: Prof. Sarah Jenkins
Term: Spring 2026

WEEKLY MODULES:
Week 1 (Jan 12): Optimization and Backpropagation. Readings: Goodfellow Chapter 6.
Week 2 (Jan 19): Convolutional Networks for Vision. Readings: Goodfellow Chapter 9, pp. 330-370.
Week 3 (Jan 26): Attention Mechanisms and Transformers. Readings: Vaswani et al. Chapter 1.
Week 4 (Feb 2): Generative Adversarial Networks. Readings: Goodfellow Chapter 20.

ASSESSMENT SCHEME:
Assignment 1: Backprop from Scratch in NumPy (100 points, 20%). Due February 10, 2026.
Assignment 2: Vision Transformer Implementation (100 points, 30%). Due March 20, 2026.
Assignment 3: Research Paper Replication Project (100 points, 50%). Due April 25, 2026.
`;
      const suffix = generateBoilerplate(70);
      return {
        doc: prefix + hiddenContent + suffix,
        expectedCourseCode: 'CS 482',
        expectedAssignments: ['Backprop from Scratch in NumPy', 'Vision Transformer Implementation', 'Research Paper Replication Project'],
        expectedReadings: ['Goodfellow Chapter 6', 'Goodfellow Chapter 9']
      };
    }
  },

  // Test 3: Massive Molecular Biology Syllabus (Assignments split between narrative & rubric)
  {
    name: 'Test 3: BIO 310 Molecular Genetics & Recombinant DNA',
    generateDoc: () => {
      const prefix = generateBoilerplate(80);
      const hiddenContent = `
Course Code: BIO 310
Course Name: Molecular Genetics
Instructor: Dr. Robert Chen
Academic Term: Summer 2026

Schedule of Lectures and Readings:
Week 1 (May 4): DNA Replication Mechanics. Readings: Watson Chapter 5.
Week 2 (May 11): Transcription Regulation. Readings: Watson Chapter 7, pp. 210-250.
Week 3 (May 18): Translation and Ribosome Assembly. Readings: Watson Chapter 9.
Week 4 (May 25): CRISPR Cas9 Gene Editing. Readings: Doudna Chapter 3.

Grade Composition:
Assignment 1: PCR Primer Design Worksheet. Due May 28, 2026. Points: 50 pts (15%).
Assignment 2: Western Blot Data Analysis. Due June 18, 2026. Points: 100 pts (35%).
Assignment 3: CRISPR Gene Knockout Proposal. Due July 22, 2026. Points: 150 pts (50%).
`;
      const suffix = generateBoilerplate(80);
      return {
        doc: prefix + hiddenContent + suffix,
        expectedCourseCode: 'BIO 310',
        expectedAssignments: ['PCR Primer Design Worksheet', 'Western Blot Data Analysis', 'CRISPR Gene Knockout Proposal'],
        expectedReadings: ['Watson Chapter 5', 'Watson Chapter 7']
      };
    }
  },

  // Test 4: Massive Law & Ethics Syllabus with schedule buried at the very end
  {
    name: 'Test 4: LAW 704 Constitutional Law & Judicial Review (Schedule at end)',
    generateDoc: () => {
      const prefix = generateBoilerplate(120); // 120 paragraphs of legal boilerplate
      const hiddenContent = `
COURSE: LAW 704
TITLE: Constitutional Law Seminar
INSTRUCTOR: Justice Arthur Pendelton
SEMESTER: Fall 2026

SYLLABUS OF READINGS:
Week 1 (Sept 1): Judicial Review and Marbury v. Madison. Readings: Chemerinsky Chapter 1.
Week 2 (Sept 8): Commerce Clause and Federal Power. Readings: Chemerinsky Chapter 3, pp. 110-180.
Week 3 (Sept 15): Executive Authority and War Powers. Readings: Chemerinsky Chapter 4.

GRADED ASSIGNMENTS:
Assignment 1: Appellate Brief on Standing. Due October 5, 2026. 100 pts, 30%.
Assignment 2: Moot Court Oral Argument. Due November 12, 2026. 100 pts, 30%.
Assignment 3: Comprehensive Final Exam. Due December 15, 2026. 100 pts, 40%.
`;
      return {
        doc: prefix + hiddenContent,
        expectedCourseCode: 'LAW 704',
        expectedAssignments: ['Appellate Brief on Standing', 'Moot Court Oral Argument', 'Comprehensive Final Exam'],
        expectedReadings: ['Chemerinsky Chapter 1', 'Chemerinsky Chapter 3']
      };
    }
  },

  // Test 5: Massive Business Finance Syllabus with assignments buried in the middle of policies
  {
    name: 'Test 5: FIN 612 Corporate Valuation & Financial Modeling (Buried in middle)',
    generateDoc: () => {
      const prefix = generateBoilerplate(90);
      const hiddenContent = `
Course Identification:
Course Code: FIN 612
Course Title: Corporate Valuation
Instructor: Prof. David Sterling
Term: Winter 2026

WEEKLY SCHEDULE:
Week 1 (Jan 5): Discounted Cash Flow Foundations. Readings: Damodaran Chapter 2.
Week 2 (Jan 12): Cost of Capital and WACC Estimation. Readings: Damodaran Chapter 4, pp. 80-125.
Week 3 (Jan 19): Relative Valuation Multiples. Readings: Damodaran Chapter 7.
Week 4 (Jan 26): Mergers and Acquisitions Modeling. Readings: Rosenbaum Chapter 5.

GRADING & ASSIGNMENTS:
Assignment 1: DCF Valuation Model of Tech Sector Target. Due February 14, 2026. 100 pts (30%).
Assignment 2: LBO Leveraged Buyout Model. Due March 14, 2026. 100 pts (35%).
Assignment 3: M&A Pitch Deck & Valuation Defense. Due April 10, 2026. 100 pts (35%).
`;
      const suffix = generateBoilerplate(90);
      return {
        doc: prefix + hiddenContent + suffix,
        expectedCourseCode: 'FIN 612',
        expectedAssignments: ['DCF Valuation Model of Tech Sector Target', 'LBO Leveraged Buyout Model', 'M&A Pitch Deck & Valuation Defense'],
        expectedReadings: ['Damodaran Chapter 2', 'Damodaran Chapter 4']
      };
    }
  }
];

async function runMassiveDocumentTests() {
  console.log('================================================================');
  console.log('🚀 TESTING LOCAL SYLLABUS PARSER ON 5 MASSIVE DOCUMENTS');
  console.log('================================================================\n');

  let passedTests = 0;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`[Running] ${testCase.name}...`);

    const { doc, expectedCourseCode, expectedAssignments, expectedReadings } = testCase.generateDoc();
    const wordCount = doc.split(/\s+/).length;
    const charCount = doc.length;
    console.log(`   Document Size: ${charCount.toLocaleString()} characters, ${wordCount.toLocaleString()} words`);

    const startTime = Date.now();
    const result = LocalSyllabusParser.shared.parseText(doc);
    const durationMs = Date.now() - startTime;

    console.log(`   Parsed in ${durationMs}ms`);
    console.log(`   Extracted Course Code: "${result.courseCode}" | Name: "${result.courseName}"`);

    // Verify course code
    const extractedCode = result.courseCode || '';
    const codeMatches = extractedCode.toLowerCase().includes(expectedCourseCode.toLowerCase().replace(/\s+/g, '')) ||
                        extractedCode.toLowerCase() === expectedCourseCode.toLowerCase();

    // Verify assignments
    const parsedAssignments = result.assignments || [];
    console.log(`   Extracted Assignments (${parsedAssignments.length}):`);
    parsedAssignments.forEach(a => {
      console.log(`     - "${a.title}" | Due: ${a.dueDate || 'N/A'} | Weight: ${a.weightPercentage || 'N/A'}`);
    });

    // Check that every expected assignment was extracted
    const foundAssignments = expectedAssignments.filter(exp =>
      parsedAssignments.some(pa => pa.title.toLowerCase().includes(exp.toLowerCase().slice(0, 10)))
    );

    // Verify weeks and readings
    const parsedWeeks = result.weeks || [];
    const allReadings = parsedWeeks.flatMap(w => (w.readings || []).map(r => r.title));
    console.log(`   Extracted Weeks: ${parsedWeeks.length} | Readings (${allReadings.length}):`);
    allReadings.slice(0, 5).forEach(r => console.log(`     - "${r}"`));

    const foundReadings = expectedReadings.filter(exp =>
      allReadings.some(pr => pr.toLowerCase().includes(exp.toLowerCase().slice(0, 8)))
    );

    const isSuccess = parsedAssignments.length >= 3 && parsedWeeks.length >= 3 && foundAssignments.length >= 2;

    if (isSuccess) {
      console.log(`   ✅ ${testCase.name} PASSED!\n`);
      passedTests++;
    } else {
      console.error(`   ❌ ${testCase.name} FAILED: Expected deliverables not fully extracted.\n`);
    }
  }

  console.log('================================================================');
  console.log(`RESULTS: ${passedTests} / ${testCases.length} massive document tests passed!`);
  console.log('================================================================');

  if (passedTests === testCases.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runMassiveDocumentTests().catch(err => {
  console.error('Fatal error during massive document tests:', err);
  process.exit(1);
});
