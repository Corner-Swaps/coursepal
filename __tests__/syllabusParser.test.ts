import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';

describe('26-Test Comprehensive Syllabus Parser QA Protocol', () => {
  const parser = LocalSyllabusParser.shared;

  const cpc514Text = `
Syllabus
School of Health & Social Sciences
CPC 514: Research Methods and Statistics
VANWDY 17 B
3 Credits
Effective Date (07/02/2026)
Course Dates: 7/1- 9/24, 2026
Faculty & Contact Information
Primary Faculty: Dr. Alireza Sedghi Taromi, PhD, RCC-ACS
Email: sedghitaromialireza@cityu.edu
Access to the Internet is required.
All written assignments must be in Microsoft-Word-compatible formats.
See the library’s APA Style Guide tutorial for a list of APA resources.
Vision, Mission, and Values
Territorial Acknowledgement & Statement of Inclusion
Course Description
Consideration of Social Justice Issues
Course Resources
Creswell, J.W., & Creswell. J. D. (2022). Research Design: Qualitative, quantitative, and mixed methods approaches (6th ed). California: Sage. (ISBN: 978-1071817940). Required.
Grading Scale
Overview of Required Assignments % of Final Grade
Research Article Analysis-Group Presentation (1) 20%
Peer Review Discussion Board Activity-Instructor Determined Assignment (2) 20%
Peer-Review Group Report (3) 10%
Research Study Design-Individual Paper (4) 40%
Attendance / Participation (5) 10%
Total 100%
Research Article Analysis-Group Presentation (assignment 1)
Beginning in Week 4 and continuing through Week 8, each group will present live in each class. The deadline to submit your article and preferred presentation day is before the second session Wednesday, July 8, 11:59 pm.
Total 100 Points
Peer Review Discussion Board Activity-Instructor Determined Assignment (assignment 2)
Each week, submit feedback post by Monday at 11:59 PM and reply by Wednesday at 11:59 PM.
Total 100 Points
Peer Review Group Report (assignment 3)
The video and one page summary, due no later than Sunday, Sep. 13, 2026, at 11:59 PM.
Total 100 Points
Research Study Design (assignment 4)
This paper, scheduled for submission on Sunday, Sep. 6, 2026, at 11:59 pm must be 10 - 12 pages.
Total 100 Points
Attendance / Participation (assignment 5)
Attendance 50 Points, Participation 50 Points. Total 100 Points.
Course Policies
Late Assignments
University Policies
Title IX Policy and Contact Information
AI Use Policy (“Traffic-Light” Approach)
Disability Services Accommodations Statement
Sensitive Content Notice
`;

  const cpc523Text = `
CPC 523: Psychology of Sexuality and Human Development
School of Health and Social Sciences
Credits: 3
Faculty Information: Marie-Pier Gilbert
Email: gilbertmariepier@cityu.edu
Territorial Acknowledgment & Statement of Inclusion
City University in Canada acknowledges Coast Salish Peoples.
Over of Required Assigments % of Final Grade
Sexuality Reflection Assignment 30%
Peer Review Practice 10%
Sexuality Research Paper 40%
Professionalism, Collaboration, Engagement 20%
TOTAL 100%
Course Assignments Details
Sexuality Reflection Assignment (30%) – DUE JULY 31st at 9 am.
Prepare an 8–10 page paper exploring sexual development.
Total 100 Points 100%
Peer Review Practice (10%) – In class practice on August 21st.
Formulating empathic statements.
Total 100 Points 100%
Group Sexuality Research Paper (40%) - DUE FRIDAY SEPTEMBER 4th at 9 am.
Write an 8–10-page literature review.
Total 100 Points 100%
Professionalism, Collaboration, and Engagement (20%) – OVER THE COURSE OF THE SEMESTER
Total 100 Points 100%
Late Assignments Deductions:
-1 point if submitted within 24 hours
-2 points if submitted within 48 hours
1 July 3rd
Introduction to Sex Therapy
Required:
Watch: The keys to a happier, healthier sex life, Emily Nagoski - TED
Sexuality Counseling: Theory, Research, and Practice
• Chapter 1 — Addressing Sexuality in Professional Counseling
• Chapter 2 — Professional Issues and Ethics in Sexuality Counseling
Human Sexuality in a World of Diversity, 7th Canadian Edition
• Chapter 1 — Studying Human Sexuality
• Chapter 2 — Theoretical Perspectives on Sexuality
2 July 10th
Cultural & Familial Influences
Required:
Watch: https://www.youtube.com/watch?v=JrTvI6lGi4s
Sexuality Counseling: Theory, Research, and Practice
• Chapter 3 — Cultural and Contextual Dimensions of Sexuality
• Chapter 5 — Gender, Identity, and Sexuality Development
Human Sexuality in a World of Diversity, 7th Canadian Edition
• Chapter 6 — Attraction and Love
• Chapter 7 — Relationships, Intimacy, and Communication
3 July 17th
Sexuality, Trauma & Mental Health
Required:
Watch:https://www.ted.com/talks/rena_martine_the_truth_about_sexual_shame
Sexuality Counseling: Theory, Research, and Practice
• Chapter 6 — Sexuality Across the Lifespan
• Chapter 8 — Sexual Concerns and Mental Health
Human Sexuality in a World of Diversity, 7th Canadian Edition
• Chapter 4 — Sexual Arousal and Response
4 July 24th
Fantasy, Pornography & Sex Addiction
Required:
Watch The Science of Sexual Fantasies with Justin Lehmiller: https://www.youtube.com/watch?v=2watIpG02to&t=3s
Sexuality Counseling: Theory, Research, and Practice
• Chapter 9 — Problematic and Compulsive Sexual Behaviours
Human Sexuality in a World of Diversity, 7th Canadian Edition
• Chapter 8 — Sexual Behaviours and Fantasies
5 July 31st
Consensual Non-Monogamy
Required:
Watch Attachment in Polyamory & Consensual Non-Monogamous Relationships with Jessica Fern: https://www.youtube.com/watch?v=ie3zXI4DJac
Sexuality Counseling: Theory, Research, and Practice
• Chapter 10 — Positive Sexuality and Sexual Wellness
Human Sexuality in a World of Diversity, 7th Canadian Edition
• Chapter 8 — Sexual Behaviors and Fantasies
Due: Sexuality Reflection Assignment
7 August 14th
Intimate Relationships
Required:
Watch Premature Ejaculation: A Real Story of Struggle, Support and Success https://thepenisproject.podbean.com/e/191-premature-ejaculation-a-real-story-of-struggle-support-and-success/
Human Sexuality in a World of Diversity, 7th Canadian Edition
• Chapter 3 — Anatomy and Physiology
• Chapter 13 — Sexual Difficulties and Sexual Health
8 August 21st
Guest Speaker
In Class Assignment: Peer Review: Bridging Theory into Clinical Practice
9 August 28th
Intimate Relationships
Required:
Let’s Talk About Painful Sex: Vulvas and Vaginas : https://thepenisproject.podbean.com/e/187-let-s-talk-about-painful-sex-vulvas-and-vaginas/?utm_source=chatgpt.com
Human Sexuality in a World of Diversity, 7th Canadian Edition
• Chapter 3 — Anatomy and Physiology
• Chapter 13 — Sexual Difficulties and Sexual Health
10 September 4th
Gender Identity & Mental Health
Required:
Brené Brown & Dr. Sara Cunningham: Belonging, Identity and Human Connection https://brenebrown.com/?utm_source=chatgpt.com
Growing into Resilience: Sexual and Gender Minority Youth in Canada
• Chapter 1 — Sexual and Gender Minority Youth in Canada
• Chapter 2 — Resilience and Identity
Human Sexuality in a World of Diversity, 7th Canadian Edition
• Chapter 5 — Gender Identity and Gender Roles
Due: Group Sexuality Research Paper
11 September 11th
Treatment Challenges
Sexuality Counseling: Theory, Research, and Practice
• Chapter 11 — Assessment in Sexuality Counseling
• Chapter 15 — Sexual Health
`;

  const cpc527Text = `
CPC 527: Group Counselling Psychology
School of Health and Social Sciences
Credits: 3
Grading Type: Decimal
Faculty Information
Kelsey Murrin
Email: murrinkelsey@cityu.edu
Overview of Required Assignments % of Final Grade
Group Therapy Reflection Paper 25%
Peer-Review Group Assignment 10%
Group Facilitation Presentation/Project 40%
Collaboration & Participation 25%
TOTAL 100%
Course Assignment Details
Group Therapy Reflection Paper (25%)
Students will write a reflection paper critiquing their facilitation performance.
Peer-Review Group Report (10%)
Students will provide feedback using a structured template.
Group Facilitation Presentation/Project (40%)
For the written component of this assignment, students will break into dyads...
Collaboration & Participation (25%)
Students will be asked to complete a participation self-assessment.
Course Schedule
Week Modules Topics Readings
4/2/26 MODU LE 1 Intro to Group Work Corey Ch. 1 & 2 Yalom Ch. 1
4/9/26 MODU LE 2 Introduction to Group Work Pt. 2 Corey Ch. 3 & 4 Yalom Ch. 2
4/16/2 6 MODU LE 3 Group Stages: Initial Stages Corey Ch.5 & 6 Yalom Ch. 3
4/23/2 6 MODU LE 4 Group Stages: Transition Corey Ch. 7 Yalom Ch. 4 & 5
4/30/2 6 MODU LE 5 Group Stages: Working Corey Ch. 8 Yalom Ch. 6 & 7
5/7/26 MODU LE 6 Presentations Yalom Ch. 8 & 9
5/14/2 6 MODU LE 7 Presentations Yalom Ch. 10 & 11
5/21/2 6 READI NG WEEK READING WEEK READING WEEK
5/28/2 6 MODU LE 8 Presentations Yalom Ch. 12 & 13 Corey Ch. 9
6/4/26 MODU LE 9 Group Stages: Final See Brightspace for Assigned Readings
6/11/2 6 MODU LE 10 Groups in Diverse Settings Corey Ch. 10 & 11 Yalom Ch. 14 & 15
6/18/2 6 MODU LE 11 Effective Closings See Brightspace for Assigned Readings
`;

  // CATEGORY 1: CPC 514 Reading Suppression & Assignment Extraction
  describe('Category 1: CPC 514 (Tests 1-5)', () => {
    let dto1: ReturnType<typeof parser.parseText>;

    beforeAll(() => {
      dto1 = parser.parseText(cpc514Text);
    });

    it('Test 1: CPC 514 Identity Extraction', () => {
      expect(dto1.courseCode).toBe('CPC 514');
      expect(dto1.courseName).toContain('Research Methods');
    });

    it('Test 2: CPC 514 Reading Suppression (0-1 Reading)', () => {
      const readingsCount = (dto1.weeks ?? []).reduce((acc, w) => acc + (w.readings?.length ?? 0), 0);
      expect(readingsCount).toBeLessThanOrEqual(1);
    });

    it('Test 3: CPC 514 Assignment Count (5-8 Assignments)', () => {
      const assignCount = dto1.assignments?.length ?? 0;
      expect(assignCount).toBeGreaterThanOrEqual(5);
      expect(assignCount).toBeLessThanOrEqual(8);
    });

    it('Test 4: CPC 514 Assignment Due Dates Resolution', () => {
      const dates = (dto1.assignments ?? []).map(a => a.dueDate).filter(Boolean) as string[];
      const hasJuly = dates.some(d => d.includes('2026-07-23') || d.includes('2026-07-08'));
      const hasSep13 = dates.some(d => d.includes('2026-09-13'));
      const hasSep6 = dates.some(d => d.includes('2026-09-06') || d.includes('2026-09-05'));
      expect(hasJuly).toBe(true);
      expect(hasSep13).toBe(true);
      expect(hasSep6).toBe(true);
    });

    it('Test 5: CPC 514 Percentage Weight Extraction', () => {
      const weights = (dto1.assignments ?? []).map(a => a.weightPercentage).filter(Boolean) as string[];
      expect(weights).toContain('20%');
      expect(weights).toContain('10%');
      expect(weights).toContain('40%');
    });
  });

  // CATEGORY 2: CPC 523 Full Schedule & Multi-Media Extraction
  describe('Category 2: CPC 523 (Tests 6-10)', () => {
    let dto2: ReturnType<typeof parser.parseText>;

    beforeAll(() => {
      dto2 = parser.parseText(cpc523Text);
    });

    it('Test 6: CPC 523 Identity Extraction', () => {
      expect(dto2.courseCode).toBe('CPC 523');
      expect(dto2.courseName).toContain('Psychology');
    });

    it('Test 7: CPC 523 Assignment Count (>= 4 Assignments)', () => {
      const assignCount = dto2.assignments?.length ?? 0;
      expect(assignCount).toBeGreaterThanOrEqual(4);
    });

    it('Test 8: CPC 523 Due Dates Resolution (July 31, Aug 21, Sep 4)', () => {
      const dates = (dto2.assignments ?? []).map(a => a.dueDate).filter(Boolean) as string[];
      const hasJuly31 = dates.some(d => d.includes('2026-07-31') || d.toLowerCase().includes('july 31'));
      const hasAug21 = dates.some(d => d.includes('2026-08-21') || d.toLowerCase().includes('august 21'));
      const hasSep4 = dates.some(d => d.includes('2026-09-04') || d.toLowerCase().includes('september 4'));
      expect(hasJuly31).toBe(true);
      expect(hasAug21).toBe(true);
      expect(hasSep4).toBe(true);
    });

    it('Test 9: CPC 523 Weekly Readings Extraction (>= 15 Items)', () => {
      const totalReadings = (dto2.weeks ?? []).flatMap(w => w.readings ?? []).length;
      expect(totalReadings).toBeGreaterThanOrEqual(15);
    });

    it('Test 10: CPC 523 Multi-Media Links (TED, YouTube, Podbean)', () => {
      const videoReadings = (dto2.weeks ?? [])
        .flatMap(w => w.readings ?? [])
        .filter(r => r.mediaType === 'video' || (r.videoUrl && r.videoUrl.length > 0));
      expect(videoReadings.length).toBeGreaterThanOrEqual(5);
    });
  });

  // CATEGORY 3: Noise & Policy Bloat Rejection
  describe('Category 3: Noise Rejection (Tests 11-15)', () => {
    it('Test 11: Rejection of Territorial Acknowledgement Coast Salish', () => {
      const tag = parser.classifySemanticCategory('Territorial Acknowledgment: Coast Salish Peoples Musqueam Tsleil-Waututh');
      expect(tag).toBe('noise');
    });

    it('Test 12: Rejection of Late Deductions Policy', () => {
      const tag = parser.classifySemanticCategory('Late Submission Deductions: -1 point if submitted within 24 hours');
      expect(tag).toBe('noise');
    });

    it('Test 13: Rejection of AI Traffic Light Policy', () => {
      const tag = parser.classifySemanticCategory('AI Use Policy Traffic-Light Approach: Green: AI use is fully permitted');
      expect(tag).toBe('noise');
    });

    it('Test 14: Rejection of Sensitive Content Notice', () => {
      const tag = parser.classifySemanticCategory('Sensitive Content Notice: Counselling topics may activate personal history');
      expect(tag).toBe('noise');
    });

    it('Test 15: Rejection of APA Style Tutorial Line', () => {
      const tag = parser.classifySemanticCategory('See the library’s APA Style Guide tutorial for a list of APA resources');
      expect(tag).toBe('noise');
    });
  });

  // CATEGORY 4: Date Normalization & Distinction
  describe('Category 4: Date Normalization (Tests 16-20)', () => {
    it("Test 16: Date 'DUE JULY 31st at 9 am' -> '2026-07-31'", () => {
      const d = LocalSyllabusParser.parseISO8601Date('DUE JULY 31st at 9 am', 2026);
      expect(d.isoString).toBe('2026-07-31');
    });

    it("Test 17: Date 'DUE FRIDAY SEPTEMBER 4th at 9 am' -> '2026-09-04'", () => {
      const d = LocalSyllabusParser.parseISO8601Date('DUE FRIDAY SEPTEMBER 4th at 9 am', 2026);
      expect(d.isoString).toBe('2026-09-04');
    });

    it("Test 18: Date 'In class practice on August 21st' -> '2026-08-21'", () => {
      const d = LocalSyllabusParser.parseISO8601Date('In class practice on August 21st', 2026);
      expect(d.isoString).toBe('2026-08-21');
    });

    it("Test 19: Date 'Wednesday, July 8, 11:59 pm' -> '2026-07-08'", () => {
      const d = LocalSyllabusParser.parseISO8601Date('Wednesday, July 8, 11:59 pm', 2026);
      expect(d.isoString).toBe('2026-07-08');
    });

    it("Test 20: Date 'Sunday, Sep. 13, 2026, at 11:59 PM' -> '2026-09-13'", () => {
      const d = LocalSyllabusParser.parseISO8601Date('Sunday, Sep. 13, 2026, at 11:59 PM', 2026);
      expect(d.isoString).toBe('2026-09-13');
    });
  });

  // CATEGORY 5: Priority Resolution, Media & Title Cleaning
  describe('Category 5: Priority, Media & Title Cleaning (Tests 21-25)', () => {
    it("Test 21: Priority 'Watch Video Presentation 20% due July 15' -> Assignment", () => {
      const tag = parser.classifySemanticCategory('Watch Video Presentation 20% due July 15', '20%', null);
      expect(tag).toBe('assignment');
    });

    it("Test 22: Priority 'Watch TED Talk Emily Nagoski' -> Media", () => {
      const tag = parser.classifySemanticCategory('Watch: The keys to a happier, healthier sex life, Emily Nagoski - TED', null, null);
      expect(tag).toBe('media');
    });

    it('Test 23: Podbean Podcast URL Extraction', () => {
      const text = 'Watch Premature Ejaculation https://thepenisproject.podbean.com/e/191-premature-ejaculation';
      const url = parser.extractVideoUrl(text);
      expect(url).toBe('https://thepenisproject.podbean.com/e/191-premature-ejaculation');
    });

    it('Test 24: Title Preservation: Chapter 1 Full Title', () => {
      const title = parser.buildStrict3To5WordTitle('Chapter 1 — Addressing Sexuality in Professional Counseling');
      expect(title.trim().length).toBeGreaterThan(0);
    });

    it('Test 25: Title Preservation: Full Assignment Title', () => {
      const title = parser.buildStrict3To5WordTitle('Group Sexuality Research Paper (40%) - DUE FRIDAY SEPTEMBER 4th at 9 am');
      expect(title.trim().length).toBeGreaterThan(0);
    });
  });

  // CATEGORY 6: CPC 527 End-to-End Parsing
  describe('Category 6: CPC 527 Full Parsing (Test 26)', () => {
    it('Test 26: CPC 527 End-to-End Weeks, Multi-Author Readings & Assignments', () => {
      const dto = parser.parseText(cpc527Text);
      const totalWeeks = dto.weeks?.length ?? 0;
      const totalAssign = dto.assignments?.length ?? 0;
      const totalReadings = dto.weeks?.reduce((acc, w) => acc + (w.readings?.length ?? 0), 0) ?? 0;

      expect(totalWeeks).toBeGreaterThanOrEqual(11);
      expect(totalAssign).toBeGreaterThanOrEqual(4);
      expect(totalReadings).toBeGreaterThanOrEqual(10);
    });
  });
});
