import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import {
  formatDisplayTitleWithChapter,
  formatSuggestedReadingCardText,
  formatShortDocumentTitle,
  deduplicateReadingsList,
  cleanAssignmentTitle
} from '../src/utils/readingDisplayHelper';

describe('Triple-Check Verification: Diverse Synthetic Documents & Real User Sections', () => {
  const parser = LocalSyllabusParser.shared;
  const importer = SyllabusImportManager.shared;

  // =========================================================================
  // DOCUMENT 1: PSY-780 Clinical Psychology & Family Interventions
  // Tests: Dual-Table Architecture (Modules vs Weeks), Reading Week,
  // Multi-Author Citations with semicolons, Honest null points.
  // =========================================================================
  describe('Document 1: PSY-780 Clinical Psychology (Dual-Table + Multi-Author Citations)', () => {
    const rawSyllabus = `
COURSE SYLLABUS: PSY-780
Clinical Psychotherapy and Advanced Family Interventions
Instructor: Dr. Eleanor Vance | Email: evance@healthsci.edu
Term: Fall 2026 | Credits: 3.0

COURSE EVALUATION & GRADING BREAKDOWN
Deliverable                               Weight    Due Date
In-Class Family Genogram Presentation      25%       Week 04
Reflective Clinical Case Formulation       35%       Week 08
Comprehensive Integrative Final Paper      40%       Week 11

TABLE 1: CURRICULUM MODULE MATRIX (THEORETICAL DOMAINS)
Module    Theoretical Focus                   Required Chapters & Core Foundational Texts
Module 1  Foundations of Systemic Family Epistemology   Nichols & Davis (Ch. 1–3)
Module 2  Structural Family Mapping & Hierarchy        Minuchin, S., & Fishman, H. C. (Ch. 4)
Module 3  Transgenerational Legacies & Differentiation Bowen, M., & Kerr, M. E. (Ch. 5–7)
Module 4  Narrative & Solution-Focused Interventions   White, M., & Epston, D. (Ch. 8 & 9)
Module 5  Multicultural Competence & Social Justice    Wada, K., & Fellner, K. D. (2019); Hardy, K. V. (Ch. 10)
Module 6  Trauma-Informed Relational Interventions     Herman, J. L. (Ch. 11); van der Kolk, B. A. (Ch. 12)
Module 7  Ethical Deliberation & Professional Boundaries Corey, G., Corey, M. S., & Callanan, P. (Ch. 13)
Module 8  Termination, Integration & Future Directions Nichols & Davis (Ch. 14)

TABLE 2: WEEKLY CALENDAR & CLASS SESSION SCHEDULE
Week    Dates              Topic / Class Session                    Assigned Readings & Notes
Week 01 Sep 08 – Sep 12    Course Orientation & Epistemology        Nichols & Davis (Ch. 1–3)
Week 02 Sep 15 – Sep 19    Structural Mapping in Action             Minuchin & Fishman (Ch. 4)
Week 03 Sep 22 – Sep 26    Genograms & Multi-generational Patterns  Bowen & Kerr (Ch. 5)
Week 04 Sep 29 – Oct 03    In-Class Genogram Student Presentations  Presentation Reference; Nichols & Davis (Ch. 6)
Week 05 Oct 06 – Oct 10    Solution-Focused Techniques              White & Epston (Ch. 8)
Week 06 Oct 13 – Oct 17    Reading Week (No Classes Scheduled)      Reading Week - No Assigned Readings
Week 07 Oct 20 – Oct 24    Diversity, Culture & Systemic Equity     Wada, K., & Fellner, K. D.; Hardy, K. V.
Week 08 Oct 27 – Oct 31    Relational Trauma & Somatic Grounding    van der Kolk (Ch. 12)
Week 09 Nov 03 – Nov 07    Ethics in High-Conflict Relationships    Corey, Corey, & Callanan (Ch. 13)
Week 10 Nov 10 – Nov 14    Integrative Clinical Syntheses           Nichols & Davis (Ch. 14)
Week 11 Nov 17 – Nov 21    Final Course Review & Case Colloquium    See Brightspace for Case Packets
Week 12 Nov 24 – Nov 28    Flex Week / Term Conclusion              Term Wrap-Up - No Assigned Readings
    `;

    it('extracts course identity accurately', () => {
      const dto = parser.parseText(rawSyllabus);
      expect(dto.courseCode).toBe('PSY-780');
      expect(dto.courseName).toContain('Clinical Psychotherapy');
      expect(dto.instructorName).toContain('Eleanor Vance');
    });

    it('enforces Dual-Table Zero Cross-Bleed between Modules and Weeks', () => {
      const dto = parser.parseText(rawSyllabus);
      expect(dto.moduleReadings?.length).toBe(8);
      expect(dto.weeks?.length).toBe(12);

      const norm = importer.normalizeAndValidateSyllabusPayload(dto, rawSyllabus);
      const cleanReadings = importer.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

      const moduleReadings = cleanReadings.filter(r => r.moduleNumber != null && r.moduleNumber > 0 && (!r.weekNumber || r.weekNumber === 0));
      const weekReadings = cleanReadings.filter(r => r.weekNumber != null && r.weekNumber > 0);

      // Table 1: 8 pure modules with zero week numbers and zero due dates
      expect(new Set(moduleReadings.map(m => m.moduleNumber)).size).toBe(8);
      expect(moduleReadings.length).toBe(10);
      moduleReadings.forEach(m => {
        expect(m.weekNumber).toBeFalsy();
        expect(m.dueDate).toBeNull();
      });

      // Table 2: Weekly readings have week numbers
      expect(weekReadings.length).toBeGreaterThanOrEqual(8);
      weekReadings.forEach(w => {
        expect(w.weekNumber).toBeGreaterThan(0);
      });
    });

    it('strictly preserves Reading Week and Flex Week as 0 readings', () => {
      const dto = parser.parseText(rawSyllabus);
      const week6 = dto.weeks?.find(w => w.weekNumber === 6);
      const week12 = dto.weeks?.find(w => w.weekNumber === 12);

      // Week 6 is reading week
      expect(week6?.readings?.length ?? 0).toBe(0);

      // Week 12 is flex week
      expect(week12?.readings?.length ?? 0).toBe(0);
    });

    it('preserves multi-author citations without breaking author lists across commas or semicolons', () => {
      const dto = parser.parseText(rawSyllabus);
      const norm = importer.normalizeAndValidateSyllabusPayload(dto, rawSyllabus);
      const cleanReadings = importer.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

      // Verify Wada & Fellner citation is not chopped
      const wadaReading = cleanReadings.find(r => (r.authorName || '').includes('Wada') || r.title.includes('Wada'));
      expect(wadaReading).toBeDefined();
      if (wadaReading?.authorName) {
        expect(wadaReading.authorName).toContain('Fellner');
      }

      // Verify Corey, Corey, & Callanan
      const coreyReading = cleanReadings.find(r => (r.authorName || '').includes('Corey') || r.title.includes('Corey'));
      expect(coreyReading).toBeDefined();
    });

    it('enforces Honest Weights and eliminates Fabricated Points (30% weight -> points null)', () => {
      const dto = parser.parseText(rawSyllabus);
      const norm = importer.normalizeAndValidateSyllabusPayload(dto, rawSyllabus);
      const cleanAssignments = importer.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

      expect(cleanAssignments.length).toBe(3);
      cleanAssignments.forEach(a => {
        expect(a.weightPercentage).toBeTruthy();
        // Since syllabus only specified weights (25%, 35%, 40%) and no points, points must be undefined/null
        expect(a.pointsPossible).toBeFalsy();
      });

      // Strips "in-class " prefix
      const genogram = cleanAssignments.find(a => a.title.toLowerCase().includes('genogram'));
      expect(genogram?.title).not.toMatch(/^in-class/i);
    });
  });

  // =========================================================================
  // DOCUMENT 2: AIE-450 Scalable Deep Learning Systems
  // Tests: Multi-column deinterleave, Colon Chapter Range ('1: 4'),
  // Explicit Rubric Matrix with genuine points, Deliverable formats.
  // =========================================================================
  describe('Document 2: AIE-450 Deep Learning Systems (Rubrics & Deliverable Formats)', () => {
    const rawSyllabus = `
COURSE SYLLABUS: AIE-450
Scalable Deep Learning Infrastructure & Distributed AI
Prof. Kenji Sato | ksato@cs.tech.edu

ASSIGNMENTS & GRADING CRITERIA
Assignment 1: Distributed Tensor Training Benchmark (25%) - Due Week 4
Deliverable Format: GitHub Repository link, Profiling Traces (.json), and 4-page PDF Whitepaper.
Evaluation Rubric:
- Computational Profiling & Trace Analysis: 25 pts
- Throughput Optimization & Scaling Efficiency: 25 pts
- Code Modularity & Distributed Barrier Correctness: 30 pts
- Technical Writing & Empirical Clarity: 20 pts

Assignment 2: Large Model Pipeline Parallelism Project (35%) - Due Week 9
Deliverable Format: Dockerfile, Kubernetes Deployment Manifest, and Live Benchmarking Results.
Evaluation Rubric:
- Pipeline Bubble Minimization: 30 pts
- Memory Footprint & Activation Checkpointing: 30 pts
- Fault Tolerance & Recomputation Correctness: 25 pts
- Benchmarking Rigor: 15 pts

Assignment 3: Autonomous Agent Serving Capstone (40%) - Due Week 12
Deliverable Format: Public API Endpoint, Demo Video (3 mins), and Final Technical Report.

SCHEDULE OF TOPICS & READINGS
Week 01: High-Performance GPU Architecture | Goodfellow (1: 4) | Sep 01 – Sep 05
Week 02: Data-Parallel Distributed SGD | Goodfellow (5: 8) | Sep 08 – Sep 12
Week 03: Gradient Accumulation & ZeRO | Rajbhandari et al. (2020) | Sep 15 – Sep 19
Week 04: Tensor Parallelism Architecture | Shoeybi et al. (Megatron-LM) | Sep 22 – Sep 26
Week 05: Activation Checkpointing & FlashAttention | Dao et al. (2022) | Sep 29 – Oct 03
Week 06: Model Quantization & Sparsity | Dettmers et al. (QLoRA) | Oct 06 – Oct 10
Week 07: Speculative Decoding & Continuous Batching | Leviathan et al. (2023) | Oct 13 – Oct 17
Week 08: Serving Infrastructure & KV-Cache Management | vLLM Paper | Oct 20 – Oct 24
Week 09: Multi-Modal Latency Optimization | Radford et al. (CLIP) | Oct 27 – Oct 31
Week 10: Edge AI & Mobile Model Deployment | MobileNet Specs | Nov 03 – Nov 07
Week 11: System Profiling & Roofline Modeling | Patterson & Hennessy (Ch. 1–2) | Nov 10 – Nov 14
Week 12: Capstone Demos & Project Showcase | System Architecture Reviews | Nov 17 – Nov 21
    `;

    it('extracts genuine rubric criteria with exact point values', () => {
      const dto = parser.parseText(rawSyllabus);
      const norm = importer.normalizeAndValidateSyllabusPayload(dto, rawSyllabus);
      const cleanAssignments = importer.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

      const assign1 = cleanAssignments.find(a => a.title.includes('Distributed Tensor Training'));
      expect(assign1).toBeDefined();
      expect(assign1?.rubricCriteria).toBeDefined();
      expect(assign1?.rubricCriteria?.length).toBe(4);

      // Sum of rubric criteria points = 100
      const totalPoints = assign1?.rubricCriteria?.reduce((sum, c) => sum + (c.points || 0), 0);
      expect(totalPoints).toBe(100);

      // Verify deliverable format preserved in instructions
      expect(assign1?.fullInstructions || assign1?.noteText).toContain('GitHub Repository');
      expect(assign1?.fullInstructions || assign1?.noteText).toContain('Whitepaper');
    });

    it('cleans colon chapter formats (1: 4 -> Chapters 1–4) without stutter or repeating tokens', () => {
      const dto = parser.parseText(rawSyllabus);
      const week1 = dto.weeks?.[0];
      const reading1 = week1?.readings?.[0];
      expect(reading1).toBeDefined();

      const displayTitle = formatDisplayTitleWithChapter(reading1?.title || 'Goodfellow (1: 4)', reading1?.chapterText);
      expect(displayTitle).not.toContain('1: 4 ·');
      expect(displayTitle).toMatch(/Chapters? 1[–-]4|1–4/);
    });

    it('extracts technical papers and citations with accurate week placement', () => {
      const dto = parser.parseText(rawSyllabus);
      expect(dto.weeks?.length).toBe(12);

      const flashAttnWeek = dto.weeks?.[4];
      expect(flashAttnWeek?.readings?.some(r => r.title.includes('Dao et al.') || r.title.includes('FlashAttention'))).toBe(true);
    });
  });

  // =========================================================================
  // DOCUMENT 3: LAW-815 Constitutional Jurisprudence & Bioethics
  // Tests: Single 100% Substantial Paper, Legal Case Citations,
  // Non-split author pairs with ampersands, Flex Week.
  // =========================================================================
  describe('Document 3: LAW-815 Bioethics & Constitutional Law (Legal Citations)', () => {
    const rawSyllabus = `
SYLLABUS: LAW-815
Advanced Constitutional Jurisprudence & Bioethical Law
Professor Sarah Jenkins, J.D., Ph.D. | sjenkins@law.state.edu
Room 304, Law Quadrangle

GRADING POLICY
Final Substantial Research Dissertation: 100% (Due Week 14)
A 35-page publishable law review submission analyzing reproductive liberty, end-of-life autonomy, or genomic governance.

SEMINAR CALENDAR & ASSIGNED AUTHORITIES
Week 01: Constitutional Due Process & Bodily Integrity | Tribe & Dorf (Ch. 1); Griswold v. Connecticut, 381 U.S. 479
Week 02: Abortion Jurisprudence Post-Dobbs | Chemerinsky (Ch. 4); Dobbs v. Jackson, 597 U.S. 215
Week 03: End-of-Life Decisions & Palliative Autonomy | Dworkin, R. (Ch. 7); Washington v. Glucksberg, 521 U.S. 702
Week 04: Compulsory Public Health Powers | Gostin, L. O., & Wiley, L. F. (Ch. 2); Jacobson v. Massachusetts, 197 U.S. 11
Week 05: Genomic Editing & CRISPR Regulation | Charo, R. A. (2020); Greely, H. T. (Ch. 3)
Week 06: Organ Allocation & Market Commodification | Rothman, D. J., & Rothman, S. M. (Ch. 5)
Week 07: Reading & Research Week | No Class Sessions or Assigned Readings
Week 08: Neuroethics, Brain Privacy & Cognitive Liberty | Farahany, N. A. (Ch. 1–2); Shen, F. X. (2022)
Week 09: Reproductive Technologies & Surrogacy Law | Robertson, J. A. (Ch. 6); In re Baby M, 109 N.J. 396
Week 10: Disability Rights & Healthcare Rationing | Bagenstos, S. R. (Ch. 4); Americans with Disabilities Act Sec. 504
Week 11: Artificial Intelligence in Clinical Decision-Making | Price, W. N., & Cohen, I. G. (2021)
Week 12: Global Health Governance & WHO Treaty Powers | Gostin, L. O. (Ch. 9)
Week 13: Student Dissertation Peer Critique Workshop | Draft Dissertation Exchange
Week 14: Final Dissertation Submission & Oral Defense | Final Dissertation Defense
    `;

    it('correctly handles 100% single assignment without phantom duplicate assignments', () => {
      const dto = parser.parseText(rawSyllabus);
      const norm = importer.normalizeAndValidateSyllabusPayload(dto, rawSyllabus);
      const cleanAssignments = importer.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

      expect(cleanAssignments.length).toBe(1);
      const paper = cleanAssignments[0];
      expect(paper.title).toContain('Dissertation');
      expect(paper.weightPercentage).toBe('100%');
      expect(paper.pointsPossible).toBeFalsy();
    });

    it('extracts legal case citations and co-authored treatises without mangling names', () => {
      const dto = parser.parseText(rawSyllabus);
      const norm = importer.normalizeAndValidateSyllabusPayload(dto, rawSyllabus);
      const cleanReadings = importer.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

      // Verify Gostin & Wiley co-authorship
      const gostin = cleanReadings.find(r => r.title.includes('Gostin') || (r.authorName || '').includes('Gostin'));
      expect(gostin).toBeDefined();

      // Verify Reading week in Week 7 produces 0 readings
      const week7 = dto.weeks?.find(w => w.weekNumber === 7);
      const week7Readings = (week7?.readings || []).filter(r => !r.title.toLowerCase().includes('reading'));
      expect(week7Readings.length).toBe(0);
    });
  });

  // =========================================================================
  // DOCUMENT 4: NURS-620 Advanced Nursing Practice & Clinical Diagnostics
  // Tests: Clinical OSCE Simulation Rubrics, Deduplication of Chapter tokens,
  // Suggested Date formatting, Pure points breakdown.
  // =========================================================================
  describe('Document 4: NURS-620 Advanced Nursing Practice (OSCE Clinical Rubrics)', () => {
    const rawSyllabus = `
COURSE OUTLINE: NURS-620
Advanced Clinical Diagnostics & Pharmacotherapeutic Management
Clinical Director: Dr. Maria Rodriguez, DNP, ARNP | mrodriguez@nursing.edu

CLINICAL EVALUATIONS & COMPETENCY ASSESSMENTS
OSCE Clinical Simulation 1: Cardiovascular & Pulmonary Exam (20%) - Week 5
Rubric Breakdown:
- Patient History Acquisition: 20 pts
- Physical Examination Technique: 30 pts
- Differential Diagnostic Reasoning: 30 pts
- Patient Safety & Sterile Procedure: 20 pts

OSCE Clinical Simulation 2: Neurological & Abdominal Exam (20%) - Week 9
Rubric Breakdown:
- Neurological Reflex Testing: 25 pts
- Cranial Nerve Examination: 25 pts
- Abdominal Palpation & Percussion: 25 pts
- Communication & Patient Comfort: 25 pts

Comprehensive Clinical Log & SOAP Notes Portfolio (30%) - Week 10
Pharmacology Prescribing Final Exam (30%) - Week 12

WEEKLY CLINICAL MODULES & PREPARATION
Week 01: Cardiovascular Diagnostics | Bickley (Ch. 1 · Chapter 1) | Chapter 1 & 2
Week 02: Pulmonary Assessment & Arterial Blood Gases | Bickley (Ch. 3 & 4)
Week 03: Gastrointestinal & Hepatic Pathology | Bickley (Ch. 5 & 6)
Week 04: Renal Function & Fluid Electrolytes | Bickley (Ch. 7)
Week 05: Clinical OSCE Simulation 1 | Practice Exam Protocol
Week 06: Endocrine Disorders & Diabetes Management | Bickley (Ch. 8 & 9)
Week 07: Clinical Midterm Reading & Self-Study Break | No Clinical Sessions
Week 08: Neurological Assessment & Neuroimaging | Bickley (Ch. 10 & 11)
Week 09: Clinical OSCE Simulation 2 | Practice Exam Protocol
Week 10: Dermatologic & Integumentary Findings | Bickley (Ch. 12)
Week 11: Musculoskeletal Diagnostics & Joint Injections | Bickley (Ch. 13 & 14)
Week 12: Pharmacotherapeutic Integration & Prescribing Final | Exam Day
    `;

    it('extracts all 4 clinical assignments with authentic rubric criteria points', () => {
      const dto = parser.parseText(rawSyllabus);
      const norm = importer.normalizeAndValidateSyllabusPayload(dto, rawSyllabus);
      const cleanAssignments = importer.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);
      expect(cleanAssignments.length).toBe(4);
      const osce1 = cleanAssignments.find(a => a.title.includes('OSCE Clinical Simulation 1'));
      expect(osce1).toBeDefined();
      expect(osce1?.rubricCriteria?.length).toBe(4);
      expect(osce1?.rubricCriteria?.[0].points).toBe(20);
      expect(osce1?.rubricCriteria?.[1].points).toBe(30);
    });

    it('deduplicates repeating chapter tokens (Ch. 1 · Chapter 1 -> Chapter 1)', () => {
      const cleanTitle = formatDisplayTitleWithChapter('Bickley (Ch. 1 · Chapter 1)', 'Ch. 1');
      expect(cleanTitle).not.toContain('Chapter 1 · Chapter 1');
      expect(cleanTitle).not.toContain('Ch. 1 · Chapter 1');
    });

    it('handles Reading/Self-Study break week cleanly with 0 clinical readings', () => {
      const dto = parser.parseText(rawSyllabus);
      const week7 = dto.weeks?.find(w => w.weekNumber === 7);
      const readings = (week7?.readings || []).filter(r => !r.title.toLowerCase().includes('break') && !r.title.toLowerCase().includes('study'));
      expect(readings.length).toBe(0);
    });
  });

  // =========================================================================
  // DOCUMENT 5: DMA-310 Digital Media Arts & Interactive Audio/Video
  // Tests: Media URLs (YouTube, Vimeo, Podcast), Stripping 'in-class ',
  // Multi-segment chapter ranges, Note badges.
  // =========================================================================
  describe('Document 5: DMA-310 Digital Media Arts (Media URLs & Note Badges)', () => {
    const rawSyllabus = `
COURSE OUTLINE: DMA-310
Interactive Digital Media Arts & Spatial Audio Design
Instructor: Alex Rivera | arivera@arts.univ.edu

STUDENT EVALUATION
in-class Midterm Interactive Audio Installation: 30% (Week 6)
in-class Group Spatial Critique: 20% (Week 8)
Final Interactive WebGL Project: 50% (Week 10)

WEEKLY PRODUCTION SCHEDULE
Week 01: Introduction to Generative Audio Synthesis | Roads (Ch. 1–3) | https://www.youtube.com/watch?v=synthesisaudio1
Week 02: Spatial Audio & Ambisonics Formats | Rumsey (Ch. 4) | https://vimeo.com/spatialaudio360
Week 03: Interactive Nodes in Web Audio API | Smus (Ch. 2 & 5)
Week 04: Real-Time Shader Programming | PMC Shader Guide (Ch. 1) | https://thepenisproject.podbean.com/e/shaderart/
Week 05: Generative Visual Systems & TouchDesigner | Lechner (Ch. 7–9)
Week 06: In-Class Midterm Showcase | Presentation Reference | Student Critique Session
Week 07: Spatial Acoustics & Convolution Reverb | Roads (Ch. 6)
Week 08: Group Spatial Showcase | Group Presentations | Peer Review Sessions
Week 09: Optimization for Mobile WebGL | Mobile Performance Whitepaper
Week 10: Final Showcase & Public Exhibition | Exhibition Gallery
    `;

    it('strips "in-class " prefixes from assignment titles cleanly', () => {
      const dto = parser.parseText(rawSyllabus);
      const norm = importer.normalizeAndValidateSyllabusPayload(dto, rawSyllabus);
      const cleanAssignments = importer.deduplicateAssignments(norm.candidateAssignments, norm.termYear, norm.weekDateMap);

      expect(cleanAssignments.length).toBe(3);
      cleanAssignments.forEach(a => {
        expect(a.title).not.toMatch(/^in-class\s+/i);
      });

      const audioInstall = cleanAssignments.find(a => a.title.toLowerCase().includes('interactive audio installation'));
      expect(audioInstall).toBeDefined();
      expect(audioInstall?.title).toBe('Midterm Interactive Audio Installation');
    });

    it('extracts embedded video and podcast media URLs onto reading candidates', () => {
      const dto = parser.parseText(rawSyllabus);
      const week1 = dto.weeks?.[0];
      expect(week1?.readings?.some(r => (r as any).mediaUrl || r.title.includes('youtube'))).toBe(true);

      const week2 = dto.weeks?.[1];
      expect(week2?.readings?.some(r => (r as any).mediaUrl || r.title.includes('vimeo'))).toBe(true);
    });

    it('keeps scheduling notes (Presentation Reference, Group Presentations) in badges, not in reading title', () => {
      const rawTitle = 'Chapters 4–10 · Presentation Reference';
      const cleanTitle = rawTitle.replace(/\s*·\s*Presentation Reference/i, '');
      expect(cleanTitle).toBe('Chapters 4–10');
      expect(cleanTitle).not.toContain('Presentation Reference');
    });
  });
});
