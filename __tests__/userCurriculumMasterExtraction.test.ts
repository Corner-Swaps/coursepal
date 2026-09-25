import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';

describe('User Master Extraction Table & Detailed Itemized Breakdown Test', () => {
  const fullText = `# Gender, Sexuality, and Power: Critical Frameworks (GSP 401)
Department of Interdisciplinary Cultural Studies
Credits: 4.0 Units • Course Level: Advanced Seminar

## Master Extraction Table
| Module | Module Title | Assigned Reading | Assignment Deliverable |
| 01 | Foundations of Social Constructionism | Jeffrey Weeks — Sexuality and Its Discontents (Ch. 1) | Historical Genealogies of Norms (Analytical Memo) |
| 02 | The Biopolitical Apparatus & Power | Michel Foucault — The History of Sexuality, Vol. 1 (Pt. 2 & 4) | Discourse Analysis: Institutional Confessions |
| 03 | Performativity, Discourse, & Gender | Judith Butler — Gender Trouble (Ch. 1 & Conclusion) | Subversive Repetition Case Study |
| 04 | Queer Spatiality & Alternative Temporalities | Jack Halberstam — In a Queer Time and Place (Ch. 1) | Spatial/Temporal Archive Mapping |
| 05 | Intersectional Erotics & Power Politics | Audre Lorde — Sister Outsider ("Uses of the Erotic") | Epistemic Erotic Audit |
| 06 | Decolonial Gender & Modernity | María Lugones — "Heterosexualism and the Colonial / Modern Gender System" | Decolonial Framework Analysis |
| 07 | Chosen Kinship & Social Reproduction | Kath Weston — Families We Choose (Ch. 2 & 5) | Alternative Kinship Network Diagram |
| 08 | Algorithmic Desire & Digital Architectures | Safiya Umoja Noble — Algorithms of Oppression (Ch. 2) | Algorithmic Audit & Interface Teardown |
| 09 | Homonormativity & Neoliberal Inclusion | Lisa Duggan — The Twilight of Equality? (Ch. 3) | Commodification Critique & Policy Brief |
| 10 | Abolitionist Futures & Mutual Aid | Dean Spade — Normal Life: Administrative Violence & Trans Politics (Ch. 2 & 4) | Grassroots Mutual Aid Infrastructure Blueprint |

## Detailed Itemized Breakdown
Module 01: Foundations of Social Constructionism
Reading: Jeffrey Weeks — Sexuality and Its Discontents (Ch. 1)
Assignment: Historical Genealogies of Norms — Analytical Memo, 1,500 words

Module 02: The Biopolitical Apparatus & Power
Reading: Michel Foucault — The History of Sexuality, Vol. 1 (Pt. 2 & 4)
Assignment: Discourse Analysis of Institutional Confessions — Comparative Textual Analysis

Module 03: Performativity, Discourse, & Gender
Reading: Judith Butler — Gender Trouble (Ch. 1 & Conclusion)
Assignment: Subversive Repetition Case Study — Cultural Critique Case Study

Module 04: Queer Spatiality & Alternative Temporalities
Reading: Jack Halberstam — In a Queer Time and Place (Ch. 1)
Assignment: Spatial/Temporal Archive Mapping — Spatial Analysis Project

Module 05: Intersectional Erotics & Power Politics
Reading: Audre Lorde — Sister Outsider ("Uses of the Erotic")
Assignment: Epistemic Erotic Audit — Reflective Essay, 1,200 words

Module 06: Decolonial Gender & Modernity
Reading: María Lugones — "Heterosexualism and the Colonial / Modern Gender System"
Assignment: Decolonial Framework Analysis — Critical Review

Module 07: Chosen Kinship & Social Reproduction
Reading: Kath Weston — Families We Choose (Ch. 2 & 5)
Assignment: Alternative Kinship Network Diagram — Relational Mapping Diagram

Module 08: Algorithmic Desire & Digital Architectures
Reading: Safiya Umoja Noble — Algorithms of Oppression (Ch. 2)
Assignment: Algorithmic Audit & Interface Teardown — Digital Platform Evaluation

Module 09: Homonormativity & Neoliberal Inclusion
Reading: Lisa Duggan — The Twilight of Equality? (Ch. 3)
Assignment: Commodification Critique & Policy Brief — Policy Paper

Module 10: Abolitionist Futures & Mutual Aid
Reading: Dean Spade — Normal Life: Administrative Violence & Trans Politics (Ch. 2 & 4)
Assignment: Grassroots Mutual Aid Infrastructure Blueprint — Tactical Framework
`;

  const runonText = `Master Extraction TableModuleModule TitleAssigned ReadingAssignment Deliverable01Foundations of Social ConstructionismJeffrey Weeks — Sexuality and Its Discontents (Ch. 1)Historical Genealogies of Norms (Analytical Memo)02The Biopolitical Apparatus & PowerMichel Foucault — The History of Sexuality, Vol. 1 (Pt. 2 & 4)Discourse Analysis: Institutional Confessions03Performativity, Discourse, & GenderJudith Butler — Gender Trouble (Ch. 1 & Conclusion)Subversive Repetition Case Study04Queer Spatiality & Alternative TemporalitiesJack Halberstam — In a Queer Time and Place (Ch. 1)Spatial/Temporal Archive Mapping05Intersectional Erotics & Power PoliticsAudre Lorde — Sister Outsider ("Uses of the Erotic")Epistemic Erotic Audit06Decolonial Gender & ModernityMaría Lugones — "Heterosexualism and the Colonial / Modern Gender System"Decolonial Framework Analysis07Chosen Kinship & Social ReproductionKath Weston — Families We Choose (Ch. 2 & 5)Alternative Kinship Network Diagram08Algorithmic Desire & Digital ArchitecturesSafiya Umoja Noble — Algorithms of Oppression (Ch. 2)Algorithmic Audit & Interface Teardown09Homonormativity & Neoliberal InclusionLisa Duggan — The Twilight of Equality? (Ch. 3)Commodification Critique & Policy Brief10Abolitionist Futures & Mutual AidDean Spade — Normal Life: Administrative Violence & Trans Politics (Ch. 2 & 4)Grassroots Mutual Aid Infrastructure Blueprint`;

  it('parses full document with both Master Table and Detailed Breakdown cleanly with exact 10:10:10 mapping', () => {
    const dto = LocalSyllabusParser.shared.parseText(fullText);

    expect(dto.courseName).toBe('Gender, Sexuality, and Power: Critical Frameworks');
    expect(dto.courseCode).toBe('GSP 401');

    // Zero Fabricated Weeks: purely in modules
    expect(dto.weeks).toHaveLength(0);
    expect(dto.termWeeks).toBeNull();
    // 10 Assignments
    expect(dto.assignments).toHaveLength(10);
    // 10 Module Readings
    expect(dto.moduleReadings).toHaveLength(10);

    // Rule 1: Zero Cross-Bleed Rule
    dto.moduleReadings?.forEach((mr, idx) => {
      expect(mr.weekNumber).toBeUndefined();
      expect(mr.moduleNumber).toBe(idx + 1);
      expect(mr.moduleMention).toBe(`Module ${idx + 1}`);
      expect(mr.chapterText).toBeTruthy();
    });

    // Rule 3: Zero Fabricated Points & Zero Fabricated Weeks
    dto.assignments?.forEach((a, idx) => {
      expect(a.pointsPossible).toBeNull();
      expect(a.assignmentNumber).toBe(idx + 1);
      expect(a.weekNumber).toBeUndefined();
      expect(a.moduleMention).toBe(`Module ${idx + 1}`);
      if (idx < 5) {
        expect(a.weightPercentage).toBe('5%');
      } else if (idx < 9) {
        expect(a.weightPercentage).toBe('8.75%');
      } else {
        expect(a.weightPercentage).toBe('40%');
      }
    });

    // Verify Readings across Modules
    const m1Reading = dto.moduleReadings![0];
    expect(m1Reading.authorName).toBe('Jeffrey Weeks');
    expect(m1Reading.chapterText).toMatch(/Ch(?:apter|\.)?\s*1/i);

    const m2Reading = dto.moduleReadings![1];
    expect(m2Reading.authorName).toBe('Michel Foucault');
    expect(m2Reading.chapterText).toMatch(/Pt\.?\s*2|Part\s*(?:Two|2)/i);

    const m3Reading = dto.moduleReadings![2];
    expect(m3Reading.authorName).toBe('Judith Butler');

    const m4Reading = dto.moduleReadings![3];
    expect(m4Reading.authorName).toBe('Jack Halberstam');

    const m5Reading = dto.moduleReadings![4];
    expect(m5Reading.authorName).toBe('Audre Lorde');

    const m6Reading = dto.moduleReadings![5];
    expect(m6Reading.authorName).toBe('María Lugones');

    const m7Reading = dto.moduleReadings![6];
    expect(m7Reading.authorName).toBe('Kath Weston');

    const m8Reading = dto.moduleReadings![7];
    expect(m8Reading.authorName).toBe('Safiya Umoja Noble');

    const m9Reading = dto.moduleReadings![8];
    expect(m9Reading.authorName).toBe('Lisa Duggan');

    const m10Reading = dto.moduleReadings![9];
    expect(m10Reading.authorName).toBe('Dean Spade');

    // Verify Assignment Titles and Deliverable Notes
    expect(dto.assignments![0].title).toBe('Historical Genealogies of Norms');
    expect(dto.assignments![0].noteText).toBe('Analytical Memo, 1,500 words');

    expect(dto.assignments![1].title).toBe('Discourse Analysis of Institutional Confessions');
    expect(dto.assignments![1].noteText).toBe('Comparative Textual Analysis');

    expect(dto.assignments![2].title).toBe('Subversive Repetition Case Study');
    expect(dto.assignments![2].noteText).toBe('Cultural Critique Case Study');

    expect(dto.assignments![9].title).toBe('Grassroots Mutual Aid Infrastructure Blueprint');
    expect(dto.assignments![9].noteText).toBe('Tactical Framework');
  });

  it('parses raw run-on single-line string without newlines (mobile paste / OCR) with 100% fidelity', () => {
    const dto = LocalSyllabusParser.shared.parseText(runonText);

    expect(dto.weeks).toHaveLength(0);
    expect(dto.termWeeks).toBeNull();
    expect(dto.assignments).toHaveLength(10);
    expect(dto.moduleReadings).toHaveLength(10);

    // Verify all 10 module numbers
    for (let i = 1; i <= 10; i++) {
      const assign = dto.assignments!.find(a => a.assignmentNumber === i);
      expect(assign).toBeDefined();
      expect(assign!.pointsPossible).toBeNull();
      expect(assign!.noteText).toBeTruthy();
      expect(assign!.weekNumber).toBeUndefined();
      expect(assign!.moduleMention).toBe(`Module ${i}`);

      const modReading = dto.moduleReadings!.find(m => m.moduleNumber === i);
      expect(modReading).toBeDefined();
      expect(modReading!.weekNumber).toBeUndefined();
      expect(modReading!.moduleMention).toBe(`Module ${i}`);
    }

    expect(dto.moduleReadings![0].authorName).toBe('Jeffrey Weeks');
    expect(dto.moduleReadings![1].authorName).toBe('Michel Foucault');
    expect(dto.moduleReadings![2].authorName).toBe('Judith Butler');
    expect(dto.moduleReadings![3].authorName).toBe('Jack Halberstam');
    expect(dto.moduleReadings![4].authorName).toBe('Audre Lorde');
    expect(dto.moduleReadings![5].authorName).toBe('María Lugones');
    expect(dto.moduleReadings![6].authorName).toBe('Kath Weston');
    expect(dto.moduleReadings![7].authorName).toBe('Safiya Umoja Noble');
    expect(dto.moduleReadings![8].authorName).toBe('Lisa Duggan');
    expect(dto.moduleReadings![9].authorName).toBe('Dean Spade');
  });
});
