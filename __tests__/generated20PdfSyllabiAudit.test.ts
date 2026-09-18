import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractTextWithNativePdfKit(pdfRelativePath: string): string {
  const fullPath = path.resolve(__dirname, pdfRelativePath);
  const swiftCmd = `swift -e '
import PDFKit
import Foundation
let url = URL(fileURLWithPath: "${fullPath}")
if let doc = PDFDocument(url: url), let str = doc.string {
    print(str)
}
'`;
  return execSync(swiftCmd).toString();
}

describe('20 Complex University Syllabi PDF Audit Suite', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures/generated_20_syllabi');

  it('01. AERO 540: Advanced Aerospace Propulsion & Rocketry', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/01_AERO540_AerospacePropulsion.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('AERO 540');
    expect(parsed.courseName).toMatch(/Aerospace Propulsion/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Rocket Combustion Chamber Design',
      'Supersonic Nozzle CFD Simulation',
      'Propulsion System Flight Test Capstone',
      'Engineering Seminar Technical Participation'
    ]);
    expect(parsed.assignments?.[0]?.weightPercentage).toBe('25%');
    expect(parsed.assignments?.[2]?.weightPercentage).toBe('35%');
    expect(parsed.assignments?.[3]?.weightPercentage).toBe('15%');
    expect(parsed.assignments?.[3]?.noteText).toMatch(/continuous/i);

    expect(parsed.weeks?.length).toBe(11);
    expect(parsed.weeks?.[0]?.theme).toMatch(/Thermodynamics of Rocket Propulsion/i);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Sutton (Ch. 1–3)');
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('NASA SP-8087 Specs');
    expect(parsed.weeks?.[7]?.readings?.map(r => r.title)).toContain('Jahn & Choueiri (2002)');
  });

  it('02. NEURO 610: Cognitive Neuroscience & Functional Neuroimaging', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/02_NEURO610_CognitiveNeuroscience.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('NEURO 610');
    expect(parsed.courseName).toMatch(/Cognitive Neuroscience/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'fMRI Preprocessing & GLM Analysis Lab',
      'Resting-State Functional Connectivity Project',
      'Neuroimaging Research Grant Proposal',
      'Journal Club Presentation'
    ]);
    expect(parsed.assignments?.[2]?.weightPercentage).toBe('35%');

    expect(parsed.weeks?.length).toBe(12);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Huettel (Ch. 1–2)');
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Ogawa et al. (1990)');
    expect(parsed.weeks?.[2]?.readings?.map(r => r.title)).toContain('SPM Documentation');
  });

  it('03. ARCH 320: History of Architecture and Urban Morphologies', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/03_ARCH320_HistoryOfArchitecture.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('ARCH 320');
    expect(parsed.courseName).toMatch(/History of Architecture/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Vernacular Architecture Field Analysis',
      'Comparative Urban Morphology Essay',
      'Studio Design Portfolio Capstone',
      'Sketchbook Submissions'
    ]);
    expect(parsed.assignments?.[2]?.weightPercentage).toBe('40%');

    expect(parsed.weeks?.length).toBe(12);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Vitruvius (Ch. 1–3)');
    expect(parsed.weeks?.[6]?.readings?.map(r => r.title)).toContain('Gropius (1935)');
    expect(parsed.weeks?.[6]?.readings?.map(r => r.title)).toContain('Curtis (Ch. 8)');
  });

  it('04. CRIM 415: Forensic Science and Criminal Jurisprudence', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/04_CRIM415_ForensicScience.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('CRIM 415');
    expect(parsed.courseName).toMatch(/Forensic Science/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Forensic Evidence Chain of Custody Report',
      'Mock Trial Expert Witness Testimony',
      'Comprehensive Criminal Law Exam',
      'Crime Scene Simulation Assessment'
    ]);
    expect(parsed.assignments?.[1]?.weightPercentage).toBe('35%');

    expect(parsed.weeks?.length).toBe(12);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Saferstein (Ch. 1–2)');
    expect(parsed.weeks?.[1]?.readings?.map(r => r.title)).toContain('FBI Crime Scene Documentation');
    expect(parsed.weeks?.[6]?.readings?.map(r => r.title)).toContain('NIST SP 800-72 Guidelines');
  });

  it('05. DATA 505: High-Performance Distributed Datastores', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/05_DATA505_DistributedDatastores.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('DATA 505');
    expect(parsed.courseName).toMatch(/Distributed Datastores/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Distributed Raft Consensus Engine',
      'LSM-Tree Key-Value Storage Engine',
      'Distributed Query Planner Capstone',
      'Code Review & Architecture Critique'
    ]);

    expect(parsed.weeks?.length).toBe(12);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Kleppmann (Ch. 3)');
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Graefe (2011)');
    expect(parsed.weeks?.[1]?.readings?.map(r => r.title)).toContain('RocksDB Architecture Specs');
    expect(parsed.weeks?.[7]?.readings?.map(r => r.title)).toContain('Kafka Core Architecture');
  });

  it('06. ANTH 220: Cultural Anthropology and Ethnographic Fieldwork', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/06_ANTH220_CulturalAnthropology.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('ANTH 220');
    expect(parsed.courseName).toMatch(/Cultural Anthropology/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Participant Observation Fieldwork Note',
      'Kinship System Structural Analysis',
      'Ethnographic Research Monograph',
      'Seminar Discussion Leadership'
    ]);
    expect(parsed.assignments?.[2]?.weightPercentage).toBe('35%');

    expect(parsed.weeks?.length).toBe(11);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Geertz (Ch. 1)');
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Malinowski (Ch. 1)');
    expect(parsed.weeks?.[3]?.readings?.map(r => r.title)).toContain('Mauss (1925)');
    expect(parsed.weeks?.[3]?.readings?.map(r => r.title)).toContain('Sahlins (Ch. 1)');
  });

  it('07. ASTR 301: Modern Astrophysics and Stellar Structure', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/07_ASTR301_StellarAstrophysics.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('ASTR 301');
    expect(parsed.courseName).toMatch(/Astrophysics/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Stellar Spectroscopy Lab',
      'Hydrostatic Equilibrium Numerical Model',
      'Final Observational Research Project',
      'Astrophysical Problem Sets'
    ]);

    expect(parsed.weeks?.length).toBe(12);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Carroll & Ostlie (Ch. 3)');
    expect(parsed.weeks?.[4]?.readings?.map(r => r.title)).toContain('Bethe (1939)');
    expect(parsed.weeks?.[7]?.readings?.map(r => r.title)).toContain('Chandrasekhar (1931)');
  });

  it('08. JOUR 450: Investigative Reporting and Media Law', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/08_JOUR450_InvestigativeJournalism.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('JOUR 450');
    expect(parsed.courseName).toMatch(/Investigative Reporting/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Public Records & FOIA Investigation',
      'Enterprise Feature Story',
      'Investigative Deep-Dive Project',
      'Newsroom Beat Reporting'
    ]);

    expect(parsed.weeks?.length).toBe(11);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Kovach & Rosenstiel (Ch. 1–3)');
    expect(parsed.weeks?.[1]?.readings?.map(r => r.title)).toContain('FOIA Compliance Specs');
    expect(parsed.weeks?.[5]?.readings?.map(r => r.title)).toContain('Lewis (1991)');
  });

  it('09. BIOE 530: Biomaterials Science and Regenerative Scaffolds', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/09_BIOE530_BiomaterialsTissue.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('BIOE 530');
    expect(parsed.courseName).toMatch(/Biomaterials/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Polymeric Biomaterial Characterization Lab',
      'Tissue Engineering Bioreactor Design',
      'FDA 510(k) Medical Device Regulatory Dossier',
      'Biosafety & Bioethics Quizzes'
    ]);

    expect(parsed.weeks?.length).toBe(11);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Ratner et al. (Ch. 1–3)');
    expect(parsed.weeks?.[1]?.readings?.map(r => r.title)).toContain('Langer (1990)');
    expect(parsed.weeks?.[7]?.readings?.map(r => r.title)).toContain('ASTM F136 Standards');
    expect(parsed.weeks?.[9]?.readings?.map(r => r.title)).toContain('FDA Device Guidance Specs');
  });

  it('10. FIN 620: Advanced Quantitative Financial Engineering', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/10_FIN620_QuantitativeFinance.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('FIN 620');
    expect(parsed.courseName).toMatch(/Quantitative Financial Engineering/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Stochastic Volatility & Heston Calibration',
      'Credit Risk & Copula Pricing Project',
      'Algorithmic Execution System Capstone',
      'Market Risk Quantitative Case Studies'
    ]);

    expect(parsed.weeks?.length).toBe(12);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Shreve (Ch. 1–3)');
    expect(parsed.weeks?.[2]?.readings?.map(r => r.title)).toContain('Black & Scholes (1973)');
    expect(parsed.weeks?.[5]?.readings?.map(r => r.title)).toContain('Heston (1993)');
    expect(parsed.weeks?.[8]?.readings?.map(r => r.title)).toContain('ISDA Credit Specs');
  });

  it('11. THEA 210: Playwriting and Narrative Dramaturgy', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/11_THEA210_PlaywritingDramaturgy.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('THEA 210');
    expect(parsed.courseName).toMatch(/Playwriting/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Ten-Minute Play Script',
      'Full Scene Dramaturgical Analysis',
      'Full-Length One-Act Play Manuscript',
      'Table Read Workshop Feedback'
    ]);

    expect(parsed.weeks?.length).toBe(11);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Aristotle (Ch. 1–6)');
    expect(parsed.weeks?.[1]?.readings?.map(r => r.title)).toContain('Stanislavski (Ch. 3–5)');
    expect(parsed.weeks?.[6]?.readings?.map(r => r.title)).toContain('Brecht (1948)');
  });

  it('12. MECH 480: Finite Element Analysis and Solid Mechanics', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/12_MECH480_FiniteElementAnalysis.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('MECH 480');
    expect(parsed.courseName).toMatch(/Finite Element Analysis/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      '1D Truss & Beam FEA Solver Implementation',
      '2D Plane Stress & Strain Ansys Analysis',
      'Non-Linear Crashworthiness Simulation Capstone',
      'Engineering Ethics & Safety Brief'
    ]);

    expect(parsed.weeks?.length).toBe(12);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Logan (Ch. 1–3)');
    expect(parsed.weeks?.[5]?.readings?.map(r => r.title)).toContain('Ansys Mechanical Documentation');
    expect(parsed.weeks?.[6]?.readings?.map(r => r.title)).toContain('Timoshenko & Woinowsky-Krieger (Ch. 4)');
  });

  it('13. POLI 560: Comparative Constitutional Systems', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/13_POLI560_ComparativeConstitutionalLaw.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('POLI 560');
    expect(parsed.courseName).toMatch(/Comparative Constitutional Systems/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Comparative Judicial Review Legal Memo',
      'Electoral System Reform Policy Brief',
      'Constitutional Drafting Capstone Project',
      'Socratic Seminar Discussion Leadership'
    ]);

    expect(parsed.weeks?.length).toBe(12);
    expect(parsed.weeks?.[1]?.readings?.map(r => r.title)).toContain('Kelsen (1942)');
    expect(parsed.weeks?.[1]?.readings?.map(r => r.title)).toContain('Bickel (1962)');
    expect(parsed.weeks?.[2]?.readings?.map(r => r.title)).toContain('Kommers & Miller (Ch. 2 & 3)');
  });

  it('14. LING 420: Computational Linguistics and Neural NLP', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/14_LING420_ComputationalLinguistics.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('LING 420');
    expect(parsed.courseName).toMatch(/Computational Linguistics/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'N-Gram Language Model & POS Tagger',
      'Transformer Self-Attention Decoder from Scratch',
      'Multilingual Information Extraction Project',
      'NLP Research Paper Presentation'
    ]);

    expect(parsed.weeks?.length).toBe(11);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Jurafsky & Martin (Ch. 2)');
    expect(parsed.weeks?.[2]?.readings?.map(r => r.title)).toContain('Mikolov et al. (2013)');
    expect(parsed.weeks?.[5]?.readings?.map(r => r.title)).toContain('Vaswani et al. (2017)');
    expect(parsed.weeks?.[6]?.readings?.map(r => r.title)).toContain('Devlin et al. (2018)');
  });

  it('15. PSYC 730: Clinical Neuropsychological Diagnostics', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/15_PSYC730_NeuropsychologicalAssessment.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('PSYC 730');
    expect(parsed.courseName).toMatch(/Neuropsychological/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'WAIS-IV Administration & Scoring Portfolio',
      'Neuropsychological Evaluation Report',
      'Diagnostic OSCE Clinical Simulation',
      'Ethics in Psychological Assessment'
    ]);

    expect(parsed.weeks?.length).toBe(11);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Groth-Marnat (Ch. 1)');
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('APA Standards');
    expect(parsed.weeks?.[2]?.readings?.some(r => r.title.includes('WAIS-IV Manual'))).toBe(true);
    expect(parsed.weeks?.[3]?.readings?.map(r => r.title)).toContain('Lezak et al. (Ch. 9 & 10)');
  });

  it('16. ENVR 405: Water Resources Engineering and Hydrology', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/16_ENVR405_WaterResourcesEngineering.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('ENVR 405');
    expect(parsed.courseName).toMatch(/Water Resources/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Watershed Delineation & Runoff Hydrograph Lab',
      'HEC-HMS Flood Inundation Model',
      'Sustainable Basin Water Management Plan',
      'Environmental Compliance Field Log'
    ]);

    expect(parsed.weeks?.length).toBe(12);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Chow, Maidment & Mays (Ch. 1–3)');
    expect(parsed.weeks?.[1]?.readings?.map(r => r.title)).toContain('Penman (1948)');
    expect(parsed.weeks?.[7]?.readings?.map(r => r.title)).toContain('HEC-HMS User Manual & Specs');
  });

  it('17. ECON 640: Advanced Macroeconomics and DSGE Modeling', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/17_ECON640_AdvancedMacroeconomics.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('ECON 640');
    expect(parsed.courseName).toMatch(/Macroeconomics/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Real Business Cycle (RBC) Dynare Simulation',
      'New Keynesian Monetary Policy Paper',
      'Empirical Macroeconometric Term Project',
      'Macro Research Seminar Presentations'
    ]);

    expect(parsed.weeks?.length).toBe(12);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Stokey, Lucas & Prescott (Ch. 1–4)');
    expect(parsed.weeks?.[3]?.readings?.map(r => r.title)).toContain('Kydland & Prescott (1982)');
    expect(parsed.weeks?.[4]?.readings?.map(r => r.title)).toContain('Dynare User Guide');
    expect(parsed.weeks?.[6]?.readings?.map(r => r.title)).toContain('Gali (Ch. 1–3)');
  });

  it('18. HIST 380: Cold War Geopolitics and the Nuclear Age', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/18_HIST380_ColdWarGeopolitics.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('HIST 380');
    expect(parsed.courseName).toMatch(/Cold War Geopolitics/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Primary Source Declassified Cable Analysis',
      'Historiographical Debate Essay',
      'Archival Research Monograph',
      'Weekly Diplomatic Cable Critique'
    ]);

    expect(parsed.weeks?.length).toBe(11);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Gaddis (Ch. 1 & 2)');
    expect(parsed.weeks?.[2]?.readings?.map(r => r.title)).toContain('NSC-68 Declassified Whitepaper');
    expect(parsed.weeks?.[3]?.readings?.map(r => r.title)).toContain('Stueck (Ch. 3–5)');
  });

  it('19. GENE 525: Epigenomics and Chromatin Biology', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/19_GENE525_EpigenomicsChromatin.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('GENE 525');
    expect(parsed.courseName).toMatch(/Epigenomics/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'ChIP-seq & ATAC-seq Bioinformatic Pipeline',
      'Epigenetic Disease Mutation Report',
      'Chromatin Architecture Grant Proposal',
      'Journal Article Critiques'
    ]);

    expect(parsed.weeks?.length).toBe(11);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Allis et al. (Ch. 1–3)');
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Bird (2002)');
    expect(parsed.weeks?.[1]?.readings?.map(r => r.title)).toContain('Jenuwein & Allis (2001)');
    expect(parsed.weeks?.[3]?.readings?.map(r => r.title)).toContain('ENCODE Specs');
  });

  it('20. PHIL 510: Mathematical Logic and Incompleteness', () => {
    const text = extractTextWithNativePdfKit('fixtures/generated_20_syllabi/20_PHIL510_MathematicalLogic.pdf');
    const parsed = LocalSyllabusParser.shared.parseText(text);

    expect(parsed.courseCode).toBe('PHIL 510');
    expect(parsed.courseName).toMatch(/Mathematical Logic/i);
    expect(parsed.assignments?.length).toBe(4);
    expect(parsed.assignments?.map(a => a.title)).toEqual([
      'Propositional & First-Order Proof Portfolio',
      'Computability & Turing Reduction Problem Set',
      'Incompleteness & Formal Systems Term Paper',
      'Logic Seminar Problem Presentations'
    ]);

    expect(parsed.weeks?.length).toBe(11);
    expect(parsed.weeks?.[0]?.readings?.map(r => r.title)).toContain('Enderton (Ch. 1 & 2)');
    expect(parsed.weeks?.[1]?.readings?.map(r => r.title)).toContain('Hodges (Ch. 1–3)');
    expect(parsed.weeks?.[2]?.readings?.map(r => r.title)).toContain('Gödel (1929)');
    expect(parsed.weeks?.[5]?.readings?.map(r => r.title)).toContain('Turing (1936)');
  });

  it('audits all 20 syllabi for zero delimiter leakage and end-to-end normalization', () => {
    const pdfFiles = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.pdf'));
    expect(pdfFiles.length).toBe(20);

    pdfFiles.forEach(file => {
      const text = extractTextWithNativePdfKit(`fixtures/generated_20_syllabi/${file}`);
      const parsed = LocalSyllabusParser.shared.parseText(text);

      expect(parsed.courseCode).toBeDefined();
      expect(parsed.courseCode!.length).toBeGreaterThanOrEqual(4);

      parsed.assignments?.forEach(a => {
        expect(a.title).not.toContain('|');
        expect(a.title.length).toBeGreaterThan(2);
        expect(a.title.length).toBeLessThan(100);
      });

      expect(parsed.weeks?.length).toBeGreaterThanOrEqual(10);
      parsed.weeks?.forEach(w => {
        expect(w.theme).toBeDefined();
        expect(w.theme).not.toContain('|');
        w.readings?.forEach(r => {
          expect(r.title).not.toContain('|');
          expect(r.title.length).toBeGreaterThan(1);
        });
      });

      const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(parsed, text);
      expect(normalized.courseCode).toBeDefined();
      expect(normalized.candidateAssignments.length).toBeGreaterThanOrEqual(3);
    });
  });
});
