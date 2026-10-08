import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { cleanAcademicWeekTheme, cleanChapterFromRaw, formatDisplayTitleWithChapter, parseChapterNumbers } from '../src/utils/readingDisplayHelper';

describe('CPC 522 Psychology of Trauma Syllabus Ingestion', () => {
  const cpc522SampleMarkdown = `COURSE SCHEDULE - CPC 522: FALL 2026: PSYCHOLOGY OF TRAUMA

| SESSION/DATE | MODULE(S), TOPICS AND ASSIGNMENTS | READINGS |
| --- | --- | --- |
| 1 October 2 | Introductions; Discussion of assignments; defining trauma; theory; historical; Interpersonal Neurobiology; neuroscience – brain and nervous system | Chapters 1 and 2 in textbook; Chapter 1 in Courtois and Ford book |
| 2 October 9 | Violence, systems, & language – discourse analysis. Colonialism and Western Psychiatry Discussion about the research paper. | Coates and Wade articles (2004, 2007); Joseph P. Gone (2021); Linklater (2014) Chapter 1, pp. 19-50 |
| 3 October 16 | Assessment and diagnostic issues | Chapter 3 and pages 205-208 in textbook; Chapters 1, 2, 5 in Tedeschi et al. |
| 4 October 23 | Affect regulation theory and Polyvagal theory | Article by Allan Schore; Ron’s article on the SAND website: “The feeling of safety in relationship”; Ron and C. DeJong’s (2014) article in Insights into Clinical Counseling |
| 5 October 30 | Treatment generally and Cognitive-Behavioural Therapy (CBT) | Chapters 4, 5 and 7 in textbook; Chapters 3, 4 in Tedeschi et al. |
| 6 November 6 | Somatic Psychotherapies<br>Language and Violence Analysis/Psychotherapy for Trauma Paper DUE by Midnight November 15 | Chapter 6 in textbook; Chapter 19 by Pat Ogden and Janina Fisher in Lanius, Paulson, and Corrigan’s (2014) Neurobiology and treatment of traumatic dissociation, pages 399-422. |
| November 9-13 | READING BREAK! | No Readings! |
| 7 November 20 | GROUP PRESENTATIONS and PEER GROUP REVIEWS | No Readings! |
| 8 November 27 | GROUP PRESENTATIONS and PEER GROUP REVIEWS | No Readings! |
| 9 December 4 | Attachment & Co-regulation; Posttraumatic Growth, Neuroplasticity, Mindfulness; Mirror neurons | Chapters 8, 9, 12 in textbook; Any article on attachment “styles”; Ron’s article in BC Psychologist (2016); Chapters 7 and 10 in Tedeschi et al. |
| 10 December 11 | Ethics and boundary issues; Transference and countertransference; Vicarious traumatization; Models of self-care; Self-regulation for counsellors; Review of and feedback on course | Courtois and Ford book Chapters 9 and 10 |

REQUIRED TEXTBOOKS :
Briere, J.N., and Scott, C. (2025). Principles of trauma therapy: A guide to symptoms, evaluation, and treatment. 3rd Edition. Sage Publications Ltd., London.
Tedeschi, R.G., and Moore, B.A. (2020). Transformed by trauma: Stories of posttraumatic growth. Boulder Crest.
Linklater, R. (2014). Decolonizing trauma work: Indigenous stories and strategies. Fernwood Publishing. (ISBN:978-1552666586).
`;

  it('correctly parses course code and course title', () => {
    const lines = LocalSyllabusParser.shared.lexerReconstituteLines(cpc522SampleMarkdown);
    console.log('Reconstituted lines count:', lines.length);
    lines.forEach((l, i) => console.log(`L${i}:`, JSON.stringify(l)));
    const heuristicAssigns = LocalSyllabusParser.shared.extractAssignmentsWithPointsHeuristic(lines, 2026, 'CPC 522');
    console.log('Heuristic assigns count:', heuristicAssigns.length);
    heuristicAssigns.forEach(a => console.log('  H_A:', a.title, 'Wk:', a.weekNumber, 'Due:', a.dueDate));
    const schedResult = LocalSyllabusParser.shared.extractWeeklyScheduleAndReadings(lines, cpc522SampleMarkdown, 2026, 'Psychology of Trauma', 'CPC 522');
    console.log('Schedule assigns count:', schedResult.scheduleAssignments?.length);
    schedResult.scheduleAssignments?.forEach(a => console.log('  S_A:', a.title, 'Wk:', a.weekNumber, 'Due:', a.dueDate));

    const dto = LocalSyllabusParser.shared.parseText(cpc522SampleMarkdown);
    expect(dto.courseCode).toBe('CPC 522');
    expect(dto.courseName).toBe('Psychology of Trauma');
    expect(dto.weeks?.length).toBe(10);
    expect(dto.assignments?.length).toBe(1);
    expect(dto.assignments?.[0].title).toBe('Language and Violence Analysis/Psychotherapy for Trauma Paper');
    expect(dto.assignments?.[0].weekNumber).toBe(6);
    expect(dto.assignments?.[0].dueDate).toBe('2026-11-15');
    expect(dto.textbooks?.length).toBe(3);
  });

  it('correctly extracts and parses the actual binary .docx file end-to-end', () => {
    const fs = require('fs');
    const docxPath = fs.existsSync('/tmp/CoursePal_Device_Docs_Current/syllabi/1790528226564_CPC_522_Fall_2026_Reading_Schedule__1_.docx')
      ? '/tmp/CoursePal_Device_Docs_Current/syllabi/1790528226564_CPC_522_Fall_2026_Reading_Schedule__1_.docx'
      : '/tmp/CoursePal_Device_Docs_PostDeploy3/syllabi/1790522818720_CPC_522_Fall_2026_Reading_Schedule__1_.docx';
    if (!fs.existsSync(docxPath)) {
      console.warn('Docx file not found at:', docxPath);
      return;
    }
    const { extractTextFromDocxBytes } = require('../src/services/DocxTextExtractor');
    const bytes = fs.readFileSync(docxPath);
    const md = extractTextFromDocxBytes(bytes);
    console.log('MD Week 4 line:', md.split('\n').find((l: string) => l.includes('October 23') || l.includes('Polyvagal')));
    const dto = LocalSyllabusParser.shared.parseText(md);
    console.log('DTO Week 4 obj:', dto.weeks?.find(w => w.weekNumber === 4));
    console.log('End-to-End DTO courseCode:', dto.courseCode);
    console.log('End-to-End DTO courseName:', dto.courseName);
    console.log('End-to-End DTO weeks count:', dto.weeks?.length);
    console.log('End-to-End DTO assignments count:', dto.assignments?.length);
    dto.assignments?.forEach(a => console.log('  E2E Assign:', a.title, 'Wk:', a.weekNumber, 'Due:', a.dueDate));
    console.log('End-to-End DTO textbooks count:', dto.textbooks?.length);

    expect(dto.courseCode).toBe('CPC 522');
    expect(dto.courseName).toBe('Psychology of Trauma');
    expect(dto.weeks?.length).toBe(10);
    expect(dto.assignments?.length).toBe(1);
    expect(dto.assignments?.[0].title).toBe('Language and Violence Analysis/Psychotherapy for Trauma Paper');
    expect(dto.assignments?.[0].weekNumber).toBe(6);
    expect(dto.assignments?.[0].dueDate).toBe('2026-11-15');
    expect(dto.textbooks?.length).toBe(3);
  });

  it('runs full SyllabusImportManager pipeline from binary .docx file and asserts normalized Course structure', () => {
    const fs = require('fs');
    const docxPath = fs.existsSync('/tmp/CoursePal_Device_Docs_Current/syllabi/1790528226564_CPC_522_Fall_2026_Reading_Schedule__1_.docx')
      ? '/tmp/CoursePal_Device_Docs_Current/syllabi/1790528226564_CPC_522_Fall_2026_Reading_Schedule__1_.docx'
      : '/tmp/CoursePal_Device_Docs_PostDeploy3/syllabi/1790522818720_CPC_522_Fall_2026_Reading_Schedule__1_.docx';
    if (!fs.existsSync(docxPath)) return;
    const { extractTextFromDocxBytes } = require('../src/services/DocxTextExtractor');
    const bytes = fs.readFileSync(docxPath);
    const rawText = extractTextFromDocxBytes(bytes);
    const dto = LocalSyllabusParser.shared.parseText(rawText);
    console.log('DTO week 3 readings:', dto.weeks?.find(w => w.weekNumber === 3)?.readings);

    const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);
    console.log('Normalized candidate readings for week 3:', normalized.candidateReadings.filter((r: any) => r.weekNumber === 3));
    const cleanReadingsList = SyllabusImportManager.shared.deduplicateReadings(
      normalized.candidateReadings,
      normalized.textbooks,
      normalized.termYear
    );
    const cleanAssignmentsList = SyllabusImportManager.shared.deduplicateAssignments(
      normalized.candidateAssignments,
      normalized.termYear,
      normalized.weekDateMap,
      (normalized.weeks as any)
    );

    console.log('--- PIPELINE RESULTS ---');
    console.log('Normalized Course Code:', normalized.courseCode);
    console.log('Normalized Course Name:', normalized.courseName);
    console.log('Normalized Weeks Count:', normalized.weeks.length);
    normalized.weeks.forEach(w => console.log(`  W${w.weekNumber}: ${w.theme} (${w.dateRangeStr}) - ${(w as any).readings?.length || 0} readings`));
    console.log('Clean Assignments Count:', cleanAssignmentsList.length);
    cleanAssignmentsList.forEach(a => console.log(`  A: ${a.title} | Wk: ${a.weekNumber} | Due: ${a.dueDate}`));
    console.log('Clean Readings Count:', cleanReadingsList.length);
    cleanReadingsList.forEach(r => console.log(`  R: ${r.title} | Wk: ${r.weekNumber} | Ch: ${r.chapterText} | Pg: ${r.pagesText}`));
    console.log('Textbooks Count:', normalized.textbooks?.length);
    normalized.textbooks?.forEach(t => console.log(`  T: ${t.title} | ${t.authorName}`));

    // Assert Course Identity
    expect(normalized.courseCode).toBe('CPC 522');
    expect(normalized.courseName).toBe('Psychology of Trauma');

    // Assert 10 Weeks with precise dates
    expect(normalized.weeks.length).toBe(10);
    expect(cleanAcademicWeekTheme(normalized.weeks[0].theme)).toMatch(/^Defining trauma/);
    expect(cleanAcademicWeekTheme(normalized.weeks[0].theme)).not.toContain(' – ');
    expect(cleanAcademicWeekTheme(normalized.weeks[0].theme)).not.toContain('Introductions');
    expect(normalized.weeks[0].dateRangeStr).toContain('Oct 2, 2026');
    expect(normalized.weeks[1].dateRangeStr).toContain('Oct 9, 2026');
    expect(normalized.weeks[2].dateRangeStr).toContain('Oct 16, 2026');
    expect(normalized.weeks[3].dateRangeStr).toContain('Oct 23, 2026');
    expect(normalized.weeks[4].dateRangeStr).toContain('Oct 30, 2026');
    expect(normalized.weeks[5].dateRangeStr).toContain('Nov 6, 2026');
    expect(normalized.weeks[5].theme).toContain('Somatic Psychotherapies');
    expect(normalized.weeks[6].dateRangeStr).toContain('Nov 20, 2026');
    expect(normalized.weeks[7].dateRangeStr).toContain('Nov 27, 2026');
    expect(normalized.weeks[8].dateRangeStr).toContain('Dec 4, 2026');
    expect(normalized.weeks[9].dateRangeStr).toContain('Dec 11, 2026');

    // Assert EXACTLY 1 genuine assignment, zero phantom assignments
    expect(cleanAssignmentsList.length).toBe(1);
    expect(cleanAssignmentsList[0].title).toBe('Language and Violence Analysis/Psychotherapy for Trauma Paper');
    expect(cleanAssignmentsList[0].weekNumber).toBe(6);
    // Assert 10 Modules mapped to the 10 Sessions
    expect(normalized.weeks[0].moduleNumber).toBe(1);
    expect(normalized.weeks[5].moduleNumber).toBe(6);
    expect(normalized.weeks[9].moduleNumber).toBe(10);
    expect(cleanAssignmentsList[0].moduleNumber).toBe(6);
    expect(cleanReadingsList.every(r => typeof r.moduleNumber === 'number' && r.moduleNumber >= 1 && r.moduleNumber <= 10)).toBe(true);

    // Assert Textbooks
    expect(normalized.textbooks.length).toBe(3);
    expect(normalized.textbooks[0].authorName).toContain('Briere');
    expect(normalized.textbooks[1].authorName).toContain('Tedeschi');
    expect(normalized.textbooks[2].authorName).toContain('Linklater');

    // Generate pristine, complete CoursePal_AutoBackup_Clean.json for device deployment
    const courseId = 'c-1790543041391-pdjz';
    const docId = 'vd-1790543041391-kfhz';
    const nowIso = new Date().toISOString();

    const courseWeeks = normalized.weeks.map(w => ({
      id: `w-${w.weekNumber}`,
      weekNumber: w.weekNumber,
      theme: cleanAcademicWeekTheme(w.theme) || `Week ${w.weekNumber}`,
      startDate: w.startDate || null,
      dateRangeStr: w.dateRangeStr || null,
      moduleNumber: w.moduleNumber || null,
      moduleMention: w.moduleMention || null,
      courseId,
      readings: []
    }));

    const finalReadings = cleanReadingsList.map((r, idx) => ({
      ...r,
      id: `r-1790543041391-${idx}`,
      courseId,
      courseCode: 'CPC 522',
      sourceDocumentId: docId,
      sourceDocumentName: 'CPC 522 Fall 2026 Reading Schedule (1).docx',
      docColorHex: '#DC2626',
      weekId: r.weekNumber ? `w-${r.weekNumber}` : undefined,
      isCompleted: false,
      isDeleted: false,
      isFavorite: false
    }));

    const finalAssignments = cleanAssignmentsList.map((a, idx) => ({
      ...a,
      id: `a-1790543041392-${idx}`,
      courseId,
      courseCode: 'CPC 522',
      sourceDocumentId: docId,
      sourceDocumentName: 'CPC 522 Fall 2026 Reading Schedule (1).docx',
      docColorHex: '#DC2626',
      isCompleted: false,
      isDeleted: false,
      isFavorite: false
    }));

    const finalCourse = {
      id: courseId,
      creatorId: 'user-self',
      courseName: 'Psychology of Trauma',
      courseCode: 'CPC 522',
      courseDescription: '',
      instructorName: null,
      instructorEmail: null,
      officeHours: null,
      externalScheduleNotice: null,
      gradingScale: null,
      gradingScaleRows: null,
      hexColor: '#DC2626',
      termWeeks: 10,
      sharingCode: '334021',
      isDeleted: false,
      isFavorite: true,
      createdAt: nowIso,
      weeks: courseWeeks,
      assignments: finalAssignments,
      syllabusDocs: [],
      textbooks: normalized.textbooks
    };

    const vaultDoc = {
      id: docId,
      title: 'CPC 522 Fall 2026 Reading Schedule',
      category: 'Syllabi',
      fileSize: '0.0 MB',
      fileType: 'DOCX',
      courseCode: 'CPC 522',
      courseId,
      fileContent: rawText,
      docColorHex: '#DC2626',
      rawFileDataUri: 'file:///var/mobile/Containers/Data/Application/3573EFDB-3A94-43E6-A1D7-C75889D2F49D/Documents/syllabi/1790543041102_CPC_522_Fall_2026_Reading_Schedule__1_.docx',
      pageImages: [
        'file:///var/mobile/Containers/Data/Application/3573EFDB-3A94-43E6-A1D7-C75889D2F49D/Library/Caches/CoursePal_Rendered_Pages/doc_page_2629C372-A420-4704-9E69-924732D9ED9C_0.jpg',
        'file:///var/mobile/Containers/Data/Application/3573EFDB-3A94-43E6-A1D7-C75889D2F49D/Library/Caches/CoursePal_Rendered_Pages/doc_page_2629C372-A420-4704-9E69-924732D9ED9C_1.jpg'
      ],
      uploadedAt: nowIso
    };

    const cleanBackup = {
      version: 5,
      timestamp: Date.now(),
      courses: [finalCourse],
      readings: finalReadings,
      assignments: finalAssignments,
      vaultDocs: [vaultDoc],
      hasAcceptedTerms: true,
      diagnosticRecord: {
        importId: `diag-${Date.now()}-cpc522`,
        appBuildVersion: '2.0.0 (Build 42)',
        documentHash: '00000000531c8efb',
        receivedByteCount: 23000,
        parserSource: 'LOCAL_DETERMINISTIC',
        providerModel: 'on-device-engine',
        responseStatus: 'SUCCESS',
        fallbackReason: null,
        extractedCounts: {
          assignments: finalAssignments.length,
          readings: finalReadings.length,
          weeks: courseWeeks.length,
          textbooks: normalized.textbooks.length
        },
        saveOutcome: 'SAVED_TO_DISK',
        timestamp: nowIso
      }
    };

    fs.writeFileSync('/tmp/CoursePal_AutoBackup_Clean.json', JSON.stringify(cleanBackup, null, 2), 'utf8');
    console.log('Successfully wrote /tmp/CoursePal_AutoBackup_Clean.json with 10 weeks, 16 readings, 1 assignment!');
  });

  describe('CPC 522 Phone Findings (Bugs 1-4)', () => {
    describe('Bug 1: Chapter list truncation', () => {
      it('parses chapter numbers from "Chapters 1 and 2 in textbook" as {1, 2}', () => {
        const chInfo = LocalSyllabusParser.shared.extractChapterAndPages('Chapters 1 and 2 in textbook');
        const nums = parseChapterNumbers(chInfo.chapter || '');
        expect(nums).toEqual([1, 2]);
      });

      it('parses chapter numbers from "Chapters 4, 5 and 7 in textbook" as {4, 5, 7}', () => {
        const chInfo = LocalSyllabusParser.shared.extractChapterAndPages('Chapters 4, 5 and 7 in textbook');
        const nums = parseChapterNumbers(chInfo.chapter || '');
        expect(nums).toEqual([4, 5, 7]);
      });

      it('keeps green: "Chapters 7 and 10" -> {7, 10}', () => {
        const chInfo = LocalSyllabusParser.shared.extractChapterAndPages('Chapters 7 and 10');
        expect(parseChapterNumbers(chInfo.chapter || '')).toEqual([7, 10]);
      });

      it('keeps green: "Chapters 1, 2, 5" -> {1, 2, 5}', () => {
        const chInfo = LocalSyllabusParser.shared.extractChapterAndPages('Chapters 1, 2, 5');
        expect(parseChapterNumbers(chInfo.chapter || '')).toEqual([1, 2, 5]);
      });

      it('keeps green: "Chapters 8, 9, 12" -> {8, 9, 12}', () => {
        const chInfo = LocalSyllabusParser.shared.extractChapterAndPages('Chapters 8, 9, 12');
        expect(parseChapterNumbers(chInfo.chapter || '')).toEqual([8, 9, 12]);
      });

      it('ensures "(2004, 2007)" must never become chapters', () => {
        expect(cleanChapterFromRaw('(2004, 2007)')).toBeNull();
        expect(cleanChapterFromRaw('2004, 2007')).toBeNull();
      });

      it('ensures full import pipeline extracts {1, 2} for Week 1 textbook and {4, 5, 7} for Week 5 textbook', () => {
        const dto = LocalSyllabusParser.shared.parseText(cpc522SampleMarkdown);
        const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, cpc522SampleMarkdown);
        const clean = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

        const w1Tb = clean.find(r => r.weekNumber === 1 && r.title.toLowerCase().includes('textbook'));
        expect(w1Tb).toBeDefined();
        expect(parseChapterNumbers(w1Tb?.chapterText || '')).toEqual([1, 2]);

        const w5Tb = clean.find(r => r.weekNumber === 5 && r.title.toLowerCase().includes('textbook'));
        expect(w5Tb).toBeDefined();
        expect(parseChapterNumbers(w5Tb?.chapterText || '')).toEqual([4, 5, 7]);
      });
    });

    describe('Bug 2: Coates and Wade articles year display', () => {
      it('reading titled "Coates and Wade articles (2004, 2007)" with null chapterText does not render "(Ch. 2004, 2007)"', () => {
        const reading = {
          title: 'Coates and Wade articles (2004, 2007)',
          chapterText: null,
          authorName: 'Coates & Wade articles',
          resourceTitle: 'Coates and Wade articles'
        };
        const display = formatDisplayTitleWithChapter(reading as any);
        expect(display).not.toContain('Ch.');
        expect(display).not.toContain('(Ch. 2004, 2007)');
        expect(display).toBe('Coates and Wade articles (2004, 2007)');

        const dto = LocalSyllabusParser.shared.parseText(cpc522SampleMarkdown);
        const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, cpc522SampleMarkdown);
        const clean = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

        const coatesReading = clean.find(r => r.weekNumber === 2 && r.title.toLowerCase().includes('coates'));
        expect(coatesReading).toBeDefined();
        const pipeDisplay = formatDisplayTitleWithChapter(coatesReading!);
        expect(pipeDisplay).not.toContain('Ch.');
        expect(pipeDisplay).not.toContain('(Ch. 2004, 2007)');
      });

      it('ensures 4-digit years 1800-2099 never get a "Ch." prefix in formatDisplayTitleWithChapter', () => {
        const display = formatDisplayTitleWithChapter({
          title: 'Smith and Jones report (1998, 2002)',
          chapterText: null,
          authorName: 'Smith & Jones',
          resourceTitle: 'Smith and Jones report'
        } as any);
        expect(display).not.toContain('Ch.');
      });
    });

    describe('Bug 3: Courtois and Ford book Chapters 9 and 10 display', () => {
      it('removes dangling "· and" from "Courtois and Ford book Chapters 9 and 10"', () => {
        const res1 = formatDisplayTitleWithChapter({
          title: 'Courtois and Ford book Chapters 9 and 10',
          chapterText: 'Chapters 9 & 10',
          authorName: 'Courtois & Ford'
        } as any);
        expect(res1).not.toMatch(/·\s*and\b/i);
        expect(res1).not.toMatch(/\band\s*$/i);
        expect(res1).toBe('Courtois & Ford (Ch. 9 & 10)');

        const res2 = formatDisplayTitleWithChapter('Courtois and Ford book Chapters 9 and 10');
        expect(res2).not.toMatch(/·\s*and\b/i);
        expect(res2).not.toMatch(/\band\s*$/i);
      });
    });

    describe('Bug 4: Ogden & Fisher author credit', () => {
      it('credits Ogden & Fisher for Chapter 19 by Pat Ogden and Janina Fisher in Lanius, Paulson, and Corrigan\'s (2014)', () => {
        const dto = LocalSyllabusParser.shared.parseText(cpc522SampleMarkdown);
        const norm = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, cpc522SampleMarkdown);
        const clean = SyllabusImportManager.shared.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

        const ogdenReading = clean.find(r => r.weekNumber === 6 && (r.title.includes('19') || (r.chapterText && r.chapterText.includes('19'))));
        expect(ogdenReading).toBeDefined();
        expect(ogdenReading?.authorName).toBe('Ogden & Fisher');
        expect(ogdenReading?.chapterText).toMatch(/Chapter 19/i);
      });
    });
  });
});
