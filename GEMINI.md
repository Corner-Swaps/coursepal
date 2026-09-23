# CoursePal Architectural & Parsing Guidelines (System Memory)

## 1. Dual-Table Syllabus Architecture (Modules vs. Weeks)
When a course syllabus contains both a curriculum/topic module table and a calendar schedule table (such as CPC 512):
- **Table 1: Overarching Curriculum Modules**
  - Defines the core theoretical modules of the course curriculum (e.g., Module 1: Chapters 1–3, Module 2: Chapter 2, Module 3: Chapters 11–15, Module 4: Chapter 7, Module 5: Chapter 5, Module 6: Chapter 4, Module 7: Chapter 6, Module 8: Chapter 7, Module 9: Chapter 8, Module 10: Chapter 10).
  - Populated as pure module readings with: `moduleNumber: 1..10`, `moduleMention: 'Module X'`, `relevantTopics: [Module Topic]`, `chapterText: [Chapter]`, and `weekNumber: undefined`.
  - Curriculum modules have no weekly calendar due dates (`dueDate: null`, `dateRangeStr: null`).
- **Table 2: Weekly Calendar Schedule**
  - Defines the weekly class sessions by date (e.g., Week 1: Chapters 1–3, Week 2: Chapter 5 & Articles, Week 3: Chapters 5 & 7, Week 4: Chapter 7, Week 5: Chapters 4–10, Week 6: Reading Week [0 readings], Week 7: Chapters 4–10, Week 8: Chapters 4–10, Week 9: Chapter 11, Week 10: Chapter 11 & Review Cases, Week 11: Chapter 8, Week 12: Flex Week [0 readings]).
  - Populated with: `weekNumber: 1..12`, `dateRangeStr: [Dates]`.
- **Zero Cross-Bleed Rule**:
  - The **Modules** view must display strictly the curriculum module readings. Never bleed calendar weekly readings into modules when dedicated module readings exist for the course.
  - The **Weeks** view must display strictly the calendar weekly schedule readings. Never bleed pure module readings into the calendar weeks view.

## 2. Citation & Chapter Formatting
- Semicolons and commas separating multiple citations must be parsed with author-aware lookarounds to never split author lists (e.g., `"Wada, K., & Fellner, K. D."`).
- Clean assignment titles by stripping prefixes like `in-class ` and capitalizing appropriately.
- Preserve sections as `Sections 1 & 3` or `Sec. X` without repeating section tokens.
- Deduplicate repeated chapter tokens across separators (e.g., avoid `Chapter 1 · Chapter 1`).

## 3. Strict Elimination of Fabricated Data
- If an assignment only lists a grade weight (e.g., `30%`), `pointsPossible` must remain `null`—never fabricate arbitrary point values like `100 pts`.
- Genuine points from rubrics (e.g., 10, 20, 30) should always be mapped accurately to `rubricCriteria`.
- Breaks, flex weeks, and reading weeks must never have artificial assignments or readings attached.

## 4. System & Widget Guarantee
- The notification and home-screen widget snapshot must ensure fair representation across upcoming `'assignment'`, `'reading'`, and `'module'` items, prioritizing urgent deadlines (`overdue`, `today`, `tomorrow`).

## 5. UI & Tone Constraints
- Never reference "AI", "Gemini", or model internals in user-facing UI labels, descriptions, or tooltips.
- Adhere strictly to Apple Human Interface Guidelines (HIG), fluid animations, and squircle aesthetics.

## 6. Weekly Schedule Reading Cleanliness & Note Badges
- In weekly schedule views, never concatenate or repeat session topics, themes, or presentation notes in reading titles.
- Scheduling notes such as `Presentation Reference` (Week 5) or `Group Presentations` (Weeks 7 & 8) must reside exclusively in pill badges, never appended with separators (` · `) onto the reading title.

## 7. Universal Syllabus Archetypes & Pattern Calibration
The ingestion pipeline is calibrated against four canonical academic document archetypes:

### Archetype A: Technical & Engineering MLOps Syllabi (e.g., DATA 630)
- **Header & Title**: Course code and title may contain ampersands and compound engineering topics (`DATA 630: Scalable Machine Learning Systems & Cloud AI Architectures`).
- **Program Learning Outcomes**: Outlines such as `PLO 1 (Distributed Infrastructure)` through `PLO 4` represent competencies, never course assignments.
- **Continuous Deliverables**: Recurring seminar evaluations (`Architecture Seminar & Code Reviews`) must be mapped as assignments with their honest weight (`15%`) and `noteText: 'Continuous · ...'`.
- **Engineering Docs & Whitepapers**: Architectural specifications (`Feast Architecture Specs`, `PyTorch Distributed Docs`, `Kubeflow Operator Docs`, `Apache Airflow Core Architecture`, `vLLM Technical Paper`, `Evidently AI Whitepaper`) must be cataloged as distinct reading tasks, preserving author/tool identity.
- **Author Citations with Years**: Formats like `Li et al. (2020)`, `Rajbhandari et al. (2020)`, `Shoeybi et al. (Megatron)`, `Dettmers et al. (QLoRA)`, and `Hu et al. (LoRA)` must be parsed cleanly as readings.

### Archetype B: Clinical Neurosciences & Practicum Syllabi (e.g., NEUR 740)
- **Institutional Subtitle Boundaries**: Multiline course headers (e.g., `NEUR 740: Neuropsychological Assessment & Cognitive Rehabilitation` followed by `Department of Clinical Neurosciences...`) must terminate at the course title without absorbing department, school, or term labels.
- **Clinical Testing Protocols**: Standardized manuals and protocols (`Lab Testing Manual & Scoring Protocols`, `APA Division 40 Ethics Guidelines`) are valid reading deliverables.
- **Multi-Author Semicolon Citations**: Semicolon-delimited clinical citations (`Lezak et al. (Ch. 1–3); Luria (Ch. 2)`, `Cummings & Mega (Ch. 5–7); Petersen (Ch. 4)`) must be cleanly split into separate readings without severing `et al.` or author surnames.
- **Deliverable Formats**: Notes like `10–12 Page Full Diagnostic Report & Table`, `60-Minute Live Practical Exam in Testing Lab`, and `8-Page Compensatory Strategy Blueprint` must be preserved in assignment metadata without premature truncation.

### Archetype C: Applied Psychology & Experiential Seminars (e.g., PSYC 612)
- **Parenthesized Modalities in Topics**: Topic strings with parenthesized modalities (`Acceptance & Mindfulness Architecture (ACT)`) must not be truncated by citation lookaheads.
- **Cohort-Split Sessions**: Schedule entries split by cohort (`Live Dyadic Demonstrations: Cohort A`, `Live Dyadic Demonstrations: Cohort B`) must preserve cohort designations in session themes.
- **Clinical Packets & Rating Scales**: Non-book clinical materials (`Clinical Dossier Packets`, `CTRS Manual & Scoring Guides`, `Peer Consultation Protocol Sheets`) must be preserved as readings.
- **Target Due Modules**: Assignments mapped across module spans (`Modules 07–08`) must preserve the module range.

### Archetype D: Multi-Page Administrative Syllabi with Rubrics (e.g., CPC 514)
- **Cover Page Isolation**: Isolate course identity (`CPC 514: Research Methods and Statistics`) from administrative section codes (`VANWDY 17 B`) and course date spans.
- **Assignment Overview vs. Detailed Breakdown**: Reconcile overview summary tables (weights: 20%, 20%, 10%, 40%, 10%) with subsequent detailed assignment sections across multiple pages.
- **Genuine Rubric Point Extraction**: When assignments feature dedicated rubric criteria tables (e.g., 6 criteria totaling 100 points), map every criterion name and exact point value directly to `rubricCriteria`.
- **External Schedule Recognition**: When syllabi state that weekly schedules are distributed on learning management systems (Brightspace, Canvas, Moodle), recognize the notice and refrain from fabricating phantom readings.
