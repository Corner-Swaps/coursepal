import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';

describe('Universal Stress Test Suite: 25 Diverse Syllabi & Complex Layouts', () => {
  const parser = LocalSyllabusParser.shared;

  // -------------------------------------------------------------
  // 1. DATA 630 (MLOps & Distributed Systems)
  // -------------------------------------------------------------
  it('01. DATA 630: Scalable Machine Learning Systems (Multi-column deinterleave + academic citations)', () => {
    const raw = `
COURSE SYLLABUS
DATA 630: Scalable Machine Learning Systems & Cloud AI Architectures
Dr. Marcus Vance | mvance@eng.cloudtech.edu

COURSE ASSIGNMENTS & WEIGHT DISTRIBUTION
ASSIGNMENT DESCRIPTION WEIGHT DUE MODULE DELIVERABLE FORMAT
Distributed Training Benchmark Project 30% Module 05 GitHub Repo, Profiling Logs & Whitepaper
Production Inference Microservice & Load Test 25% Module 08 Containerized Service, Benchmark Dashboard
Automated End-to-End MLOps Pipeline Capstone 30% Module 11 Live Production Deployment & Pitch
Architecture Seminar & Code Reviews 15% Continuous Bi-Weekly Lab Code Reviews

WEEKLY TERM SCHEDULE & READING REQUIREMENTS
TIMELINE MODULE TECHNICAL TOPIC FOCUS ASSIGNED READINGS & DOCS
Week 01 Module 01 ML Systems Architecture & Data Ingestion Huyen (Ch. 1–3); Kleppmann (Ch. 1)
Week 02 Module 02 Feature Engineering at Scale & Feature Stores Huyen (Ch. 4 & 5); Feast Architecture Specs
Week 03 Module 03 Distributed Data-Parallel Training (DDP & Horovod) PyTorch Distributed Docs; Li et al. (2020)
Week 04 Module 04 Model Parallelism & ZeRO Rajbhandari et al. (2020); Shoeybi et al. (Megatron)
Week 05 Module 05 Model Compression & Quantization Dettmers et al. (QLoRA); Hu et al. (LoRA)
Week 06 Module 06 Serving Infrastructure & Continuous Batching vLLM Technical Paper; Triton User Guide
Week 07 Module 07 Container Orchestration for ML Burns et al. (Ch. 4–6); Kubeflow Operator Docs
Week 08 Module 08 Monitoring & Data Drift Detection Huyen (Ch. 8 & 9); Evidently AI Whitepaper
Week 09 Module 09 Workflow Orchestration with Airflow Huyen (Ch. 6); Apache Airflow Core Architecture
Week 10 Module 10 Cost Governance & Spot Instances Cloud AI Pricing Guides; Stoica et al. (Ray Paper)
Week 11 Module 11 Final Capstone Showcase & Demos Industry System Architecture Whitepapers
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('DATA 630');
    expect(res.assignments?.length).toBe(4);
    expect(res.weeks?.length).toBe(11);
    expect(res.weeks?.[1]?.readings?.map(r => r.title)).toContain('Feast Architecture Specs');
    expect(res.weeks?.[2]?.readings?.map(r => r.title)).toContain('Li et al. (2020)');
    expect(res.weeks?.[3]?.readings?.map(r => r.title)).toContain('Shoeybi et al. (Megatron)');
  });

  // -------------------------------------------------------------
  // 2. CS 501 (Algorithms & Data Structures)
  // -------------------------------------------------------------
  it('02. CS 501: Advanced Algorithms & Complexity (Hidden modules in weeks)', () => {
    const raw = `
Course Code: CS 501
Course Title: Advanced Algorithms and Computational Complexity
Instructor: Prof. Ada Lovelace (ada@cs.univ.edu)

Grading Breakdown:
Problem Set 1 (15%) - Due Week 3
Problem Set 2 (15%) - Due Week 6
Midterm Examination (30%) - Due Week 8
Final Algorithmic Research Project (40%) - Due Week 12

Weekly Outline:
Week 1 (Module 1): Asymptotic Analysis & Recurrences - Cormen (Ch. 1–3)
Week 2 (Module 2): Divide and Conquer Algorithms - Cormen (Ch. 4); Kleinberg (Ch. 2)
Week 3 (Module 3): Dynamic Programming & Memoization - Cormen (Ch. 15)
Week 4 (Module 4): Greedy Algorithms & Matroids - Cormen (Ch. 16)
Week 5 (Module 5): Amortized Analysis & Splay Trees - Tarjan (1985)
Week 6 (Module 6): Graph Algorithms & Max-Flow - Cormen (Ch. 26)
Week 7 (Module 7): Linear Programming Duality - Vazirani (Ch. 12)
Week 8 (Module 8): NP-Completeness & Reductions - Garey & Johnson (Ch. 1–2)
Week 9 (Module 9): Approximation Algorithms - Williamson & Shmoys (Ch. 1)
Week 10 (Module 10): Randomized Algorithms - Motwani & Raghavan (Ch. 1–2)
Week 11 (Module 11): Online Algorithms & Competitive Analysis - Borodin (Ch. 3)
Week 12 (Module 12): Streaming Algorithms & Sketching - Muthukrishnan (2005)
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('CS 501');
    expect(res.assignments?.length).toBe(4);
    expect(res.weeks?.length).toBe(12);
    expect(res.weeks?.[0]?.theme).toMatch(/Asymptotic Analysis/i);
    expect(res.weeks?.[4]?.readings?.map(r => r.title)).toContain('Tarjan (1985)');
  });

  // -------------------------------------------------------------
  // 3. LAW 702 (Constitutional Law & Civil Liberties)
  // -------------------------------------------------------------
  it('03. LAW 702: Constitutional Jurisprudence (Case citations & statutory modules)', () => {
    const raw = `
LAW 702: Advanced Constitutional Law: Equal Protection and Due Process
Professor Elena Kagan (kagan@law.juris.edu)

Assessments:
Judicial Brief Analysis 25% Due Week 04 Written Case Brief
Appellate Oral Argument 35% Due Week 09 Live Simulation Moot Court
Comprehensive Final Exam 40% Due Week 14 Proctored Bar-Style Examination

Schedule of Seminars:
Week 01: Judicial Review and Federal Power - Chemerinsky (Ch. 1–2); Marbury v. Madison
Week 02: Commerce Clause and Federalism - Chemerinsky (Ch. 3); McCulloch v. Maryland
Week 03: Executive Powers and War Powers - Chemerinsky (Ch. 4); Youngstown Sheet & Tube
Week 04: Substantive Due Process Foundations - Tribe (Ch. 8); Lochner v. New York
Week 05: Modern Due Process and Privacy - Chemerinsky (Ch. 8); Griswold v. Connecticut
Week 06: Equal Protection: Strict Scrutiny - Chemerinsky (Ch. 9); Brown v. Board of Education
Week 07: Equal Protection: Gender & Intermediate Scrutiny - Tribe (Ch. 16); United States v. Virginia
Week 08: First Amendment: Free Speech Doctrine - Sullivan & Gunther (Ch. 11)
Week 09: First Amendment: Commercial Speech & Defamation - New York Times Co. v. Sullivan
Week 10: Freedom of Religion: Establishment Clause - Chemerinsky (Ch. 12); Lemon v. Kurtzman
Week 11: Freedom of Religion: Free Exercise Clause - Employment Division v. Smith
Week 12: Second Amendment Jurisprudence - District of Columbia v. Heller
Week 13: Voting Rights and Gerrymandering - Tribe (Ch. 13); Rucho v. Common Cause
Week 14: Contemporary Constitutional Challenges - Recent Supreme Court Precedents
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('LAW 702');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(14);
    expect(res.weeks?.[0]?.readings?.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------
  // 4. MED 801 (Clinical Pharmacotherapy)
  // -------------------------------------------------------------
  it('04. MED 801: Advanced Clinical Pharmacotherapy (Clinical protocols & OSCE simulation)', () => {
    const raw = `
MED 801: Principles of Clinical Pharmacotherapy & Drug Metabolism
Department of Clinical Pharmacology

Assignments & Evaluations:
Clinical Case Formulation 30% Due Week 04 Formal Medical Case Report
OSCE Simulation Demonstration 30% Due Week 08 Clinical Patient Encounter
Pharmacology Mastery Exam 40% Due Week 10 Comprehensive Written Board Exam

Term Schedule:
Week 01 Module 01: Pharmacokinetics and Bioavailability - Brunton (Ch. 1–2)
Week 02 Module 02: Autonomic Nervous System Agents - Brunton (Ch. 8–11)
Week 03 Module 03: Cardiovascular Pharmacotherapy - Katzung (Ch. 12 & 13)
Week 04 Module 04: Renin-Angiotensin Antagonists - Clinical Practice Guidelines
Week 05 Module 05: Antimicrobial Therapy & Resistance - Brunton (Ch. 48–52)
Week 06 Module 06: Chemotherapeutic Regimens - Katzung (Ch. 54 & 55)
Week 07 Module 07: Neuropharmacology & Psychotropics - Brunton (Ch. 14–17)
Week 08 Module 08: Endocrine and Metabolic Regulators - Katzung (Ch. 41 & 42)
Week 09 Module 09: Toxicology and Adverse Drug Reactions - FDA Safety Bulletins
Week 10 Module 10: Personalized Pharmacogenomics - Nature Reviews Genetics (2021)
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('MED 801');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(10);
  });

  // -------------------------------------------------------------
  // 5. MBA 620 (Strategic Management & Corporate Innovation)
  // -------------------------------------------------------------
  it('05. MBA 620: Corporate Strategy (Case studies & continuous participation)', () => {
    const raw = `
School of Graduate Business
MBA 620: Global Strategic Management
Instructor: Prof. Michael Porter | mporter@hbs.edu

Assignments:
Competitive Landscape Brief (25%) - Due Week 4
Mergers & Acquisitions Valuation (35%) - Due Week 8
Executive Boardroom Pitch (25%) - Due Week 10
Continuous Seminar Case Engagement (15%) - Continuous

Class Schedule:
Week 1: Industry Structure and Five Forces - Porter (1979); HBS Case 9-798-084
Week 2: Resource-Based View and Core Competencies - Barney (1991); Prahalad & Hamel (1990)
Week 3: Cost Leadership vs. Differentiation Strategies - Porter (Ch. 2–3)
Week 4: Platform Ecosystems and Network Effects - Cusumano et al. (Ch. 1)
Week 5: Blue Ocean Strategy and Value Innovation - Kim & Mauborgne (Ch. 1–3)
Week 6: Corporate Diversification and Conglomerates - HBS Case 9-399-012
Week 7: Strategic Alliances and Joint Ventures - Dyer & Singh (1998)
Week 8: Cross-Border Strategy & Emerging Markets - Khanna et al. (2005)
Week 9: Disruptive Innovation and Incumbent Response - Christensen (Ch. 1–2)
Week 10: Digital Transformation and Final Presentations - Industry Retrospectives
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('MBA 620');
    expect(res.assignments?.length).toBe(4);
    expect(res.weeks?.length).toBe(10);
    const continuousAssign = res.assignments?.find(a => a.title.includes('Seminar Case Engagement'));
    expect(continuousAssign?.weightPercentage).toBe('15%');
  });

  // -------------------------------------------------------------
  // 6. PHYS 601 (Quantum Mechanics & Particle Physics)
  // -------------------------------------------------------------
  it('06. PHYS 601: Quantum Mechanics (Sakurai readings & problem sets)', () => {
    const raw = `
PHYS 601 - Quantum Mechanics I
Fall Semester 2026 • 4 Credits

Grading:
Weekly Problem Sets (30%) - Due Continuous
Midterm Exam (30%) - Due Week 6 (100 Points)
Final Research Project & Oral Defense (40%) - Due Week 12 (100 Points)

Syllabus Calendar:
Week 1: Fundamental Concepts & Ket Space - Sakurai (Ch. 1.1–1.4)
Week 2: Quantum Dynamics & Time Evolution - Sakurai (Ch. 2.1–2.3)
Week 3: Path Integrals & Propagators - Feynman & Hibbs (Ch. 2)
Week 4: Angular Momentum & Spin Operators - Sakurai (Ch. 3.1–3.3)
Week 5: Addition of Angular Momenta & Clebsch-Gordan - Sakurai (Ch. 3.5)
Week 6: Symmetries, Conservation Laws & Parity - Sakurai (Ch. 4.1–4.2)
Week 7: Time-Independent Perturbation Theory - Sakurai (Ch. 5.1–5.3)
Week 8: Variational Method & WKB Approximation - Griffiths (Ch. 7 & 8)
Week 9: Time-Dependent Perturbation & Fermi Golden Rule - Sakurai (Ch. 5.5–5.7)
Week 10: Scattering Theory & Partial Waves - Sakurai (Ch. 6.1–6.3)
Week 11: Identical Particles & Second Quantization - Sakurai (Ch. 6.4)
Week 12: Relativistic Quantum Mechanics & Dirac Equation - Sakurai (Ch. 7)
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('PHYS 601');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(12);
    expect(res.weeks?.[0]?.readings?.map(r => r.title)).toContain('Sakurai (Ch. 1.1–1.4)');
  });

  // -------------------------------------------------------------
  // 7. BIO 412 (Molecular Genetics & Genomics)
  // -------------------------------------------------------------
  it('07. BIO 412: Molecular Genetics (NCBI docs & journal papers)', () => {
    const raw = `
Department of Molecular Biology
BIO 412: Molecular Genetics and Functional Genomics

Course Deliverables:
Lab Report 1: CRISPR Gene Editing (20%) - Due Week 3
Lab Report 2: RNA-Seq Differential Expression (25%) - Due Week 7
Genomic Research Manuscript (35%) - Due Week 11
Laboratory Practical Exam (20%) - Due Week 12

Weekly Term Outline:
Week 1: DNA Structure, Topology, and Chromatin Architecture - Watson et al. (Ch. 1–3)
Week 2: Mechanisms of DNA Replication & Repair - Alberts et al. (Ch. 5)
Week 3: Transcription Regulation & RNA Processing - Alberts et al. (Ch. 6)
Week 4: CRISPR-Cas Systems & Genome Editing - Doudna & Charpentier (2014)
Week 5: High-Throughput Next-Generation Sequencing - NCBI Sequence Read Archive Docs
Week 6: Transcriptomics & Single-Cell RNA-Seq - Macosko et al. (2015)
Week 7: Epigenetic Modifications & DNA Methylation - Alberts et al. (Ch. 8)
Week 8: Non-Coding RNAs & Riboswitches - Nature Reviews Genetics (2020)
Week 9: Proteomics and Mass Spectrometry - Aebersold & Mann (2016)
Week 10: Metagenomics & Microbiome Dynamics - Human Microbiome Project Specs
Week 11: Synthetic Biology & Metabolic Engineering - Keasling (2010)
Week 12: Capstone Presentations & Lab Practical Exam - Final Showcase
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('BIO 412');
    expect(res.assignments?.length).toBe(4);
    expect(res.weeks?.length).toBe(12);
    expect(res.weeks?.[4]?.readings?.map(r => r.title)).toContain('NCBI Sequence Read Archive Docs');
  });

  // -------------------------------------------------------------
  // 8. HIST 210 (Early Modern European History)
  // -------------------------------------------------------------
  it('08. HIST 210: Early Modern History (Primary source readings)', () => {
    const raw = `
HIST 210: Renaissance and Reformation in Europe
Department of History

Grading Scheme:
Primary Source Analysis (25%) - Due Week 4
Historiographical Essay (35%) - Due Week 9
Final Take-Home Examination (40%) - Due Week 12

Course Schedule:
Week 1: Introduction to the Early Modern World - Wiesner-Hanks (Ch. 1)
Week 2: Italian Renaissance Humanism - Petrarca (Selections); Machiavelli (The Prince)
Week 3: Printing Press and Information Revolution - Eisenstein (Ch. 1–2)
Week 4: Northern Humanism and Christian Reform - Erasmus (Praise of Folly)
Week 5: Martin Luther and the Protestant Reformation - Luther (95 Theses)
Week 6: Calvinism and the Radical Reformation - Calvin (Institutes, Book IV)
Week 7: The Catholic Reformation & Council of Trent - O'Malley (Ch. 2–3)
Week 8: Wars of Religion & Peace of Westphalia - Wiesner-Hanks (Ch. 9)
Week 9: Scientific Revolution Foundations - Galileo (Sidereus Nuncius)
Week 10: Witchcraft and Popular Belief - Levack (Ch. 1–4)
Week 11: Absolutism and Constitutional Monarchy - Hobbes (Leviathan, Ch. 17–18)
Week 12: Reflections on the Early Modern Era - Wiesner-Hanks (Ch. 12)
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('HIST 210');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(12);
  });

  // -------------------------------------------------------------
  // 9. PHIL 301 (Ethics & Political Philosophy)
  // -------------------------------------------------------------
  it('09. PHIL 301: Normative Ethics & Justice (Philosophical texts)', () => {
    const raw = `
PHIL 301: Classical and Contemporary Moral Theory
Philosophy Faculty

Assessment Weights:
Midterm Argumentative Essay 30% Due Week 5
Peer Review Workshop 15% Due Week 8
Final Philosophical Thesis 40% Due Week 11
Seminar Discussion Contributions 15% Continuous

Weekly Reading Schedule:
Week 01: Utilitarianism Foundations - Bentham (Ch. 1–4); Mill (Utilitarianism, Ch. 2)
Week 02: Rule Utilitarianism & Objections - Smart & Williams (1973)
Week 03: Kantian Deontology - Kant (Groundwork for the Metaphysics of Morals, Sec. 1)
Week 04: The Categorical Imperative - Kant (Groundwork, Sec. 2); O'Neill (1985)
Week 05: Aristotelian Virtue Ethics - Aristotle (Nicomachean Ethics, Book I & II)
Week 06: Contemporary Virtue Theory - Foot (Virtues and Vices); MacIntyre (After Virtue)
Week 07: Social Contract Theory - Hobbes (Leviathan); Rawls (A Theory of Justice, Ch. 1)
Week 08: Libertarian Justice and Rights - Nozick (Anarchy, State, and Utopia, Ch. 7)
Week 09: Feminist Ethics of Care - Gilligan (In a Different Voice); Noddings (Caring)
Week 10: Environmental & Animal Ethics - Singer (Animal Liberation); Regan (1983)
Week 11: Moral Relativism vs. Realism - Harman & Thomson (Moral Relativism)
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('PHIL 301');
    expect(res.assignments?.length).toBe(4);
    expect(res.weeks?.length).toBe(11);
  });

  // -------------------------------------------------------------
  // 10. ECON 305 (Econometrics & Empirical Methods)
  // -------------------------------------------------------------
  it('10. ECON 305: Econometrics (Wooldridge chapters & empirical projects)', () => {
    const raw = `
ECON 305: Applied Econometrics and Data Analysis
School of Economics

Grading Plan:
Empirical Problem Set 1 (15%) - Due Week 3
Empirical Problem Set 2 (15%) - Due Week 7
Stata/R Replication Project (30%) - Due Week 10
Comprehensive Final Exam (40%) - Due Week 12

Course Schedule:
Week 1: Nature of Econometrics & Economic Data - Wooldridge (Ch. 1)
Week 2: Simple Linear Regression Model - Wooldridge (Ch. 2)
Week 3: Multiple Regression Analysis: Estimation - Wooldridge (Ch. 3)
Week 4: Multiple Regression Analysis: Inference - Wooldridge (Ch. 4)
Week 5: OLS Asymptotics & Consistency - Wooldridge (Ch. 5)
Week 6: Qualitative Information & Dummy Variables - Wooldridge (Ch. 7)
Week 7: Heteroskedasticity and Robust Standard Errors - Wooldridge (Ch. 8)
Week 8: Model Specification and Measurement Error - Wooldridge (Ch. 9)
Week 9: Instrumental Variables & Two-Stage Least Squares - Wooldridge (Ch. 15); Angrist (1991)
Week 10: Panel Data Methods & Fixed Effects - Wooldridge (Ch. 13 & 14)
Week 11: Difference-in-Differences and Causal Inference - Card & Krueger (1994)
Week 12: Review and Empirical Project Presentations - Term Wrap-up
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('ECON 305');
    expect(res.assignments?.length).toBe(4);
    expect(res.weeks?.length).toBe(12);
  });

  // -------------------------------------------------------------
  // 11. CYBER 520 (Network Security & Cryptography)
  // -------------------------------------------------------------
  it('11. CYBER 520: Network Security & Applied Cryptography (RFC specs)', () => {
    const raw = `
CYBER 520: Applied Cryptography and Network Security
Center for Cybersecurity

Assignments:
Cryptanalysis Lab 1 (25%) - Due Week 04
Network Penetration Testing Report (35%) - Due Week 08
Zero-Knowledge Proof Implementation (40%) - Due Week 12

Schedule:
Week 01: Classical Ciphers & Shannon Secrecy - Katz & Lindell (Ch. 1–2)
Week 02: Block Ciphers & AES Architecture - NIST FIPS 197 Specs
Week 03: Hash Functions & Message Authentication - Katz & Lindell (Ch. 5)
Week 04: Public Key Cryptography & RSA - Rivest et al. (1978)
Week 05: Elliptic Curve Cryptography - RFC 7748 (Curve25519)
Week 06: TLS 1.3 Protocol & Key Exchange - RFC 8446 Architecture Specs
Week 07: Web Security & Cross-Site Vulnerabilities - OWASP Top 10 Guidelines
Week 08: Network Firewalls & Intrusion Detection - Snort Rule Documentation
Week 09: Kerberos & Identity Federation - RFC 4120 Specs
Week 10: Zero-Knowledge Proofs & zk-SNARKs - Boneh & Shoup (Ch. 14)
Week 11: Post-Quantum Cryptography - NIST PQC Standards
Week 12: Final Capstone Security Audit - Whitepaper Submission
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('CYBER 520');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(12);
    expect(res.weeks?.[4]?.readings?.map(r => r.title)).toContain('RFC 7748 (Curve25519)');
  });

  // -------------------------------------------------------------
  // 12. ART 150 (Modern Art History & Visual Culture)
  // -------------------------------------------------------------
  it('12. ART 150: Modern Art History (Museum research paper)', () => {
    const raw = `
ART 150: History of Modern Art: 1860 to Present
Visual Arts Department

Grading:
Visual Analysis Paper (25%) - Due Week 3
Museum Field Research Paper (35%) - Due Week 8 (100 Points)
Final Slide Identification Exam (40%) - Due Week 10 (100 Points)

Syllabus Schedule:
Week 1: Manet and the Birth of Modernism - Arnason & Mansfield (Ch. 1)
Week 2: Impressionism and the Painting of Modern Life - Clark (Ch. 2)
Week 3: Post-Impressionism & Symbolism - Arnason (Ch. 3–4)
Week 4: Cubism and the Deconstruction of Space - Picasso & Braque Selected Texts
Week 5: Futurism, Dada, and the Anti-Art Movement - Tzara (Dada Manifesto)
Week 6: Surrealism and the Unconscious - Breton (Manifesto of Surrealism)
Week 7: Abstract Expressionism & New York School - Greenberg (1961)
Week 8: Pop Art and Consumer Culture - Arnason (Ch. 14)
Week 9: Minimalism, Conceptual Art & Land Art - Krauss (1979)
Week 10: Contemporary Art & Globalization - Foster et al. (Ch. 25)
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('ART 150');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(10);
  });

  // -------------------------------------------------------------
  // 13. NURS 402 (Community Health & Epidemiology)
  // -------------------------------------------------------------
  it('13. NURS 402: Community Health Nursing (Field assessment reports)', () => {
    const raw = `
NURS 402: Community Health Nursing and Population Wellness
School of Nursing

Assessments:
Windshield Community Survey 25% Due Week 3
Family Health Assessment Portfolio 35% Due Week 7
Epidemiological Intervention Plan 40% Due Week 10

Weekly Units:
Week 01 Module 1: Determinants of Health & Public Health Systems - Stanhope (Ch. 1–3)
Week 02 Module 2: Epidemiological Principles & Outbreak Investigation - Gordis (Ch. 2–4)
Week 03 Module 3: Vulnerable Populations & Health Disparities - Stanhope (Ch. 20–22)
Week 04 Module 4: Environmental Health & Toxicology - WHO Guidelines for Healthy Environments
Week 05 Module 5: Infectious Disease Surveillance & Vaccine Policy - CDC Morbidity Reports
Week 06 Module 6: Chronic Disease Management in Communities - Stanhope (Ch. 28)
Week 07 Module 7: Disaster Preparedness & Triage Protocols - FEMA ICS Manual
Week 08 Module 8: Mental Health & Substance Use in Communities - Stanhope (Ch. 31)
Week 09 Module 9: Global Health & Sustainable Development Goals - WHO World Health Report
Week 10 Module 10: Final Intervention Showcase & Synthesis - Capstone Posters
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('NURS 402');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(10);
  });

  // -------------------------------------------------------------
  // 14. PSYC 612 (Multicultural Family Therapy)
  // -------------------------------------------------------------
  it('14. PSYC 612: Diversity & Family Systems (Multi-author book chapters)', () => {
    const raw = `
PSYC 612: Diversity and Culture in Counselling Psychology
School of Behavioural Sciences

Grading Policy:
Cultural Self-Reflection Paper (30%) - Due Week 4
Cross-Cultural Case Formulation (35%) - Due Week 8
Final Diversity Synthesis Exam (35%) - Due Week 10

Course Schedule:
Week 1: Foundations of Multicultural Counselling - Sue & Sue (Ch. 1–3)
Week 2: Acculturation, Racial Identity, and Privilege - Helms (Ch. 4 & 5)
Week 3: Indigenous Healing and Decolonizing Practices - Duran (Ch. 1–2)
Week 4: Counseling Immigrant and Refugee Families - Falicov (Ch. 6)
Week 5: Gender Identity and Sexual Diversity in Therapy - Bieschke (Ch. 2 & 3)
Week 6: Religious and Spiritual Competence in Psychology - Richards & Bergin (Ch. 4)
Week 7: Disability Culture and Ableism - Olkin (Ch. 1–3)
Week 8: Social Justice Advocacy and Ethical Protocols - CCPA Code of Ethics
Week 9: Intersectional Feminist Therapy - Enns (Ch. 5 & 6)
Week 10: Cultural Humility and Competency Showcase - Final Presentations
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('PSYC 612');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(10);
  });

  // -------------------------------------------------------------
  // 15. ENV 310 (Climate Systems & Environmental Policy)
  // -------------------------------------------------------------
  it('15. ENV 310: Climate Dynamics & Global Environmental Policy', () => {
    const raw = `
ENV 310: Global Climate Systems and Ecological Governance
Department of Environmental Sciences

Grading:
Carbon Footprint Audit (20%) - Due Week 3
Policy Memo on Renewable Transitions (35%) - Due Week 7
Climate Impact Modeling Project (45%) - Due Week 11

Weekly Modules:
Week 01: The Earth's Energy Budget & Greenhouse Effect - Archer (Ch. 1–3)
Week 02: Carbon Cycle and Ocean Acidification - IPCC AR6 Working Group I
Week 03: Paleoclimatology & Ice Core Records - Ruddiman (Ch. 4–6)
Week 04: Climate Feedbacks and Tipping Points - Lenton et al. (2019)
Week 05: Extreme Weather Attribution & Climate Modeling - Nature Climate Change (2021)
Week 06: International Environmental Agreements: Paris & Kyoto - UNFCCC Guidelines
Week 07: Carbon Pricing, Cap-and-Trade, and Border Adjustments - Nordhaus (Ch. 1–3)
Week 08: Renewable Energy Integration & Smart Grids - Jacobson (2020)
Week 09: Nature-Based Solutions & Reforestation - Griscom et al. (2017)
Week 10: Climate Justice and Indigenous Sovereignty - Whyte (2018)
Week 11: Final Project Presentations & Policy Synthesis - Term Review
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('ENV 310');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(11);
  });

  // -------------------------------------------------------------
  // 16. SOC 205 (Sociological Theory & Research Design)
  // -------------------------------------------------------------
  it('16. SOC 205: Classical and Modern Sociological Perspectives', () => {
    const raw = `
SOC 205: Classical and Modern Sociological Perspectives
Department of Sociology

Deliverables:
Theoretical Comparative Paper (30%) - Due Week 5
Field Ethnography Journal (30%) - Due Week 9
Comprehensive Synthesis Exam (40%) - Due Week 12

Weekly Calendar:
Week 1: Enlightenment and Sociological Foundations - Giddens (Ch. 1)
Week 2: Karl Marx: Historical Materialism - Marx & Engels (The German Ideology)
Week 3: Karl Marx: Capital and Alienation - Marx (Capital, Vol. 1, Ch. 1)
Week 4: Emile Durkheim: Social Facts and Anomie - Durkheim (The Rules of Sociological Method)
Week 5: Emile Durkheim: Religion and Solidarity - Durkheim (Elementary Forms)
Week 6: Max Weber: Rationalization and the Iron Cage - Weber (The Protestant Ethic)
Week 7: Max Weber: Bureaucracy and Authority - Weber (Economy and Society)
Week 8: W.E.B. Du Bois: Double Consciousness - Du Bois (The Souls of Black Folk)
Week 9: Symbolic Interactionism - Mead (Mind, Self, and Society)
Week 10: Structural Functionalism vs. Conflict Theory - Parsons & Merton Selected Readings
Week 11: Michel Foucault: Power, Knowledge, and Discipline - Foucault (Discipline and Punish)
Week 12: Pierre Bourdieu: Cultural Capital and Habitus - Bourdieu (Distinction)
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('SOC 205');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(12);
  });

  // -------------------------------------------------------------
  // 17. CHEM 201 (Organic Chemistry & Reaction Mechanisms)
  // -------------------------------------------------------------
  it('17. CHEM 201: Organic Chemistry I (Vollhardt chapters & lab notebooks)', () => {
    const raw = `
CHEM 201: Organic Chemistry I - Structure and Reactivity
Department of Chemistry

Evaluation:
Laboratory Notebook & Technique 20% Due Continuous
Midterm Exam I 25% Due Week 04
Midterm Exam II 25% Due Week 08
Final Cumulative Examination 30% Due Week 11

Class Schedule:
Week 01: Structure, Bonding, and Molecular Orbitals - Vollhardt (Ch. 1)
Week 02: Alkanes, Conformations, and Stereochemistry - Vollhardt (Ch. 2 & 3)
Week 03: Alkyl Halides and Nucleophilic Substitution (SN1/SN2) - Vollhardt (Ch. 6)
Week 04: Elimination Reactions (E1/E2) - Vollhardt (Ch. 7)
Week 05: Alkenes: Structure and Electrophilic Addition - Vollhardt (Ch. 11)
Week 06: Alkynes and Synthesis Strategies - Vollhardt (Ch. 12)
Week 07: Alcohols, Ethers, and Epoxides - Vollhardt (Ch. 8 & 9)
Week 08: Nuclear Magnetic Resonance (NMR) Spectroscopy - Silverstein (Ch. 3–5)
Week 09: Infrared (IR) and Mass Spectrometry - Silverstein (Ch. 1 & 2)
Week 10: Conjugated Systems and Pericyclic Reactions - Vollhardt (Ch. 14)
Week 11: Aromaticity and Electrophilic Aromatic Substitution - Vollhardt (Ch. 15 & 16)
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('CHEM 201');
    expect(res.assignments?.length).toBe(4);
    expect(res.weeks?.length).toBe(11);
  });

  // -------------------------------------------------------------
  // 18. ROBO 450 (Autonomous Robotics & ROS2 Architecture)
  // -------------------------------------------------------------
  it('18. ROBO 450: Mobile Robotics & Autonomous Navigation (ROS2 specs)', () => {
    const raw = `
ROBO 450: Autonomous Mobile Robots & SLAM Architectures
Robotics Engineering Institute

Assignments:
Kinematic Simulator Benchmark 25% Due Week 03
LIDAR SLAM Navigation Node 35% Due Week 07
Autonomous Maze Navigation Capstone 40% Due Week 10

Term Schedule:
Week 01 Module 1: Mobile Robot Kinematics & Coordinate Frames - Siegwart (Ch. 1–2)
Week 02 Module 2: Actuators, Encoders, and Odometry - Thrun et al. (Ch. 2)
Week 03 Module 3: Robot Operating System 2 (ROS2) Architecture - ROS2 Humble Core Specs
Week 04 Module 4: LIDAR, Sonar, and Range Sensing - Siegwart (Ch. 4)
Week 05 Module 5: Extended Kalman Filter Localization - Thrun et al. (Ch. 3)
Week 06 Module 6: Particle Filter Localization (Monte Carlo) - Thrun et al. (Ch. 8)
Week 07 Module 7: Simultaneous Localization and Mapping (SLAM) - Durrant-Whyte & Bailey (2006)
Week 08 Module 8: Graph-SLAM & Loop Closure Detection - Grisetti et al. (2010)
Week 09 Module 9: Motion Planning: A*, Dijkstra, and RRT* - LaValle (Ch. 5 & 7)
Week 10 Module 10: Final Autonomous Maze Competition - Live Arena Demos
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('ROBO 450');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(10);
    expect(res.weeks?.[2]?.readings?.map(r => r.title)).toContain('ROS2 Humble Core Specs');
  });

  // -------------------------------------------------------------
  // 19. LIT 205 (World Literature & Postcolonialism)
  // -------------------------------------------------------------
  it('19. LIT 205: Postcolonial Literature & Diaspora Narratives', () => {
    const raw = `
LIT 205: Voices of Empire and Independence in World Literature
English & Comparative Literature Department

Assessments:
Close Reading Paper (25%) - Due Week 4
Comparative Literary Essay (35%) - Due Week 9
Final Portfolio & Reflection (40%) - Due Week 12

Reading Schedule:
Week 1: Empire, Culture, and the Canon - Said (Culture and Imperialism, Ch. 1)
Week 2: Chinua Achebe - Things Fall Apart
Week 3: Language and Decolonization - Ngũgĩ wa Thiong'o (Decolonising the Mind)
Week 4: Frantz Fanon - Black Skin, White Masks (Ch. 1 & 4)
Week 5: Jean Rhys - Wide Sargasso Sea
Week 6: Salman Rushdie - Midnight's Children (Book I)
Week 7: Hybridity and Mimicry in Postcolonial Theory - Bhabha (The Location of Culture)
Week 8: Arundhati Roy - The God of Small Things
Week 9: Derek Walcott - Omeros (Selections)
Week 10: Chimamanda Ngozi Adichie - Half of a Yellow Sun
Week 11: Subaltern Studies & Diaspora - Spivak (1988); Hall (1990)
Week 12: Final Synthesis and Portfolio Workshop - Review
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('LIT 205');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(12);
  });

  // -------------------------------------------------------------
  // 20. FIN 401 (Corporate Finance & Asset Valuation)
  // -------------------------------------------------------------
  it('20. FIN 401: Advanced Corporate Finance & Asset Pricing', () => {
    const raw = `
FIN 401: Corporate Finance and Capital Markets
Finance Department

Coursework:
Financial Modeling Case 1 (25%) - Due Week 04
LBO Valuation Model (35%) - Due Week 08
Comprehensive Financial Assessment (40%) - Due Week 11

Class Schedule:
Week 01: Time Value of Money & Capital Budgeting - Berk & DeMarzo (Ch. 3–5)
Week 02: Discounted Cash Flow (DCF) Valuation - Damodaran (Ch. 1–3)
Week 03: Risk and Return: The Capital Asset Pricing Model (CAPM) - Fama & French (2004)
Week 04: Multi-Factor Asset Pricing Models - Berk & DeMarzo (Ch. 13)
Week 05: Capital Structure: Modigliani-Miller Theorems - Modigliani & Miller (1958)
Week 06: Debt Financing, Bankruptcy, and Financial Distress - Berk & DeMarzo (Ch. 16)
Week 07: Payout Policy: Dividends and Share Repurchases - Berk & DeMarzo (Ch. 17)
Week 08: Mergers, Acquisitions, and Corporate Governance - Bruner (Ch. 1–4)
Week 09: Options and Financial Derivatives - Hull (Ch. 1–3)
Week 10: Real Options in Capital Budgeting - Dixit & Pindyck (Ch. 1)
Week 11: Private Equity and Venture Capital - Gompers & Lerner (2001)
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('FIN 401');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(11);
  });

  // -------------------------------------------------------------
  // 21. EDUC 501 (Educational Psychology & Instructional Design)
  // -------------------------------------------------------------
  it('21. EDUC 501: Educational Psychology & Cognitive Learning', () => {
    const raw = `
EDUC 501: Learning Theories and Instructional Psychology
School of Education

Assignments:
Lesson Plan Analysis (25%) - Due Week 3
Classroom Observation Report (35%) - Due Week 7
Curriculum Unit Capstone (40%) - Due Week 10

Weekly Schedule:
Week 01: Cognitive Development Theories - Piaget (1952); Vygotsky (1978)
Week 02: Information Processing & Working Memory - Baddeley (2000)
Week 03: Behavioral and Social Learning Theories - Bandura (1977); Skinner (1953)
Week 04: Constructivism and Problem-Based Learning - Bruner (1966)
Week 05: Motivation in Education: Self-Determination Theory - Ryan & Deci (2000)
Week 06: Metacognition & Self-Regulated Learning - Zimmerman (2002)
Week 07: Universal Design for Learning (UDL) - Meyer et al. (Ch. 1–3)
Week 08: Assessment for Learning vs. Assessment of Learning - Black & Wiliam (1998)
Week 09: Cultural Responsiveness in Instruction - Gay (Ch. 2 & 3)
Week 10: Capstone Project Showcase & Teaching Philosophy - Review
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('EDUC 501');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(10);
  });

  // -------------------------------------------------------------
  // 22. MUS 240 (Music Theory & Form Analysis)
  // -------------------------------------------------------------
  it('22. MUS 240: Chromatic Harmony and Form Analysis', () => {
    const raw = `
MUS 240: Advanced Tonal Harmony and Formal Analysis
Conservatory of Music

Assessment:
Harmony Assignment 1 (20%) - Due Week 3
Sonata Form Analysis Paper (30%) - Due Week 7
Original Composition in Classical Style (30%) - Due Week 10
Ear Training & Dictation Quizzes (20%) - Continuous

Schedule:
Week 1: Secondary Dominants and Leading-Tone Chords - Kostka & Payne (Ch. 16–17)
Week 2: Modulation Techniques to Closely Related Keys - Kostka (Ch. 18)
Week 3: Binary and Ternary Formal Structures - Caplin (Ch. 1–3)
Week 4: Modal Mixture and the Neapolitan Sixth Chord - Kostka (Ch. 20)
Week 5: Augmented Sixth Chords (Italian, French, German) - Kostka (Ch. 21)
Week 6: Sonata-Allegro Form: Exposition and Development - Hepokoski & Darcy (Ch. 1–4)
Week 7: Rondo and Sonata-Rondo Forms - Caplin (Ch. 10)
Week 8: Theme and Variations - Selected Mozart and Beethoven Scores
Week 9: Chromatic Enharmonicism and Late Romanticism - Kostka (Ch. 24)
Week 10: Original Composition Performances & Class Review
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('MUS 240');
    expect(res.assignments?.length).toBe(4);
    expect(res.weeks?.length).toBe(10);
  });

  // -------------------------------------------------------------
  // 23. LING 300 (Syntax and Linguistic Analysis)
  // -------------------------------------------------------------
  it('23. LING 300: Generative Syntax and Phrase Structure', () => {
    const raw = `
LING 300: Generative Syntax and Linguistic Theory
Department of Linguistics

Grading:
Syntax Problem Set 1 (20%) - Due Week 3
Syntax Problem Set 2 (25%) - Due Week 6
Research Term Paper (35%) - Due Week 10
Midterm Exam (20%) - Due Week 5

Syllabus:
Week 01: Universal Grammar and Language Faculty - Carnie (Ch. 1); Chomsky (1965)
Week 02: Parts of Speech and Constituency Tests - Carnie (Ch. 2 & 3)
Week 03: X-bar Theory: Heads, Complements, and Specifiers - Carnie (Ch. 6)
Week 04: Functional Categories (DP, TP, CP) - Carnie (Ch. 7)
Week 05: Theta Theory and Case Assignment - Carnie (Ch. 8 & 9)
Week 06: Head-to-Head Movement and Aux-Inversion - Carnie (Ch. 10)
Week 07: DP Movement (Passives and Raising) - Carnie (Ch. 11)
Week 08: Wh-Movement and Locality Constraints - Carnie (Ch. 12)
Week 09: Binding Theory (Principles A, B, C) - Carnie (Ch. 5)
Week 10: Minimalist Program Foundations - Chomsky (1995); Radford (Ch. 1)
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('LING 300');
    expect(res.assignments?.length).toBe(4);
    expect(res.weeks?.length).toBe(10);
  });

  // -------------------------------------------------------------
  // 24. POL 420 (International Relations & Global Security)
  // -------------------------------------------------------------
  it('24. POL 420: International Relations & Grand Strategy', () => {
    const raw = `
POL 420: Contemporary International Relations and Grand Strategy
Department of Political Science

Assignments:
Policy Brief on Geopolitical Deterrence (25%) - Due Week 4
Crisis Simulation Negotiation (35%) - Due Week 8
Strategic Assessment Whitepaper (40%) - Due Week 11

Weekly Schedule:
Week 01: Realism and the Balance of Power - Waltz (1979); Mearsheimer (2001)
Week 02: Liberal Institutionalism & Interdependence - Keohane (1984)
Week 03: Constructivism and Norm Dynamics - Wendt (1992); Finnemore (1996)
Week 04: Nuclear Deterrence and Arms Control - Schelling (Arms and Influence)
Week 05: Great Power Rivalry & Power Transitions - Allison (Destined for War)
Week 06: Cyber Warfare and Critical Infrastructure - Singer & Friedman (2014)
Week 07: Non-State Actors, Insurgency & Terrorism - Kilcullen (2009)
Week 08: Economic Statecraft and Sanctions - Drezner (1999); Farrell & Newman (2019)
Week 09: Climate Security and Resource Scarcity - Busby (2021)
Week 10: Regional Security in the Indo-Pacific - Selected CRS Reports
Week 11: Final Strategy Presentations & Wrap-up
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('POL 420');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(11);
  });

  // -------------------------------------------------------------
  // 25. PUBH 550 (Epidemiology and Public Health Data)
  // -------------------------------------------------------------
  it('25. PUBH 550: Epidemiology Methods & Outbreak Analytics', () => {
    const raw = `
PUBH 550: Epidemiological Study Design and Surveillance
School of Public Health

Grading:
Cohort Analysis Exercise 25% Due Week 03 (100 Points)
Outbreak Case Study Report 35% Due Week 07 (100 Points)
Final Epidemiological Study Proposal 40% Due Week 11 (100 Points)

Term Schedule:
Week 01: Introduction to Epidemiology & Disease Causation - Rothman (Ch. 1–2)
Week 02: Measures of Disease Frequency (Incidence & Prevalence) - Gordis (Ch. 3)
Week 03: Cross-Sectional and Ecologic Studies - Rothman (Ch. 6)
Week 04: Cohort Studies: Design and Analysis - Gordis (Ch. 8)
Week 05: Case-Control Studies & Odds Ratios - Gordis (Ch. 9 & 10)
Week 06: Randomized Clinical Trials & Ethical Protocols - Rothman (Ch. 7)
Week 07: Bias, Confounding, and Effect Modification - Rothman (Ch. 11 & 12)
Week 08: Screening and Diagnostic Testing Accuracy - Gordis (Ch. 5)
Week 09: Infectious Disease Surveillance & Contact Tracing - CDC Guidelines
Week 10: Environmental and Occupational Epidemiology - Checkoway et al. (Ch. 2)
Week 11: Final Grant Proposal Presentations - Term Wrap-up
    `;
    const res = parser.parseText(raw);
    expect(res.courseCode).toBe('PUBH 550');
    expect(res.assignments?.length).toBe(3);
    expect(res.weeks?.length).toBe(11);
  });
});
