import { execSync } from 'child_process';
import path from 'path';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';

function extractTextFromPdf(fileName: string): string {
  const pdfPath = path.resolve(__dirname, `../src/assets/syllabi/${fileName}`);
  const pyScript = `import pypdf; r=pypdf.PdfReader('${pdfPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`).toString();
}

describe('CityU Syllabi Offline Local Parser Calibration Suite', () => {
  it('CPC 514: Extracts assignments, weights, due dates, media URLs, and full rubric criteria points', () => {
    const fullText = extractTextFromPdf('CPC514_Syllabus.pdf');
    const result = LocalSyllabusParser.shared.parseText(fullText);

    expect(result.courseCode).toBe('CPC 514');
    expect(result.courseName).toContain('Research Methods');
    expect(result.instructorName).toContain('Alireza');
    expect(result.instructorEmail).toBe('sedghitaromialireza@cityu.edu');

    // Verify all rubric criterion names are concise titles (never paragraph text)
    result.assignments?.forEach(a => {
      a.rubricCriteria?.forEach(c => {
        expect(c.criterionName.length).toBeLessThan(55);
      });
    });

    const a1 = result.assignments?.find(a => a.title.toLowerCase().includes('article analysis'));
    expect(a1).toBeDefined();
    expect(a1?.weightPercentage).toBe('20%');
    expect(a1?.rubricCriteria?.length).toBe(6);
    const a1TotalPoints = a1?.rubricCriteria?.reduce((sum, c) => sum + (c.points || 0), 0);
    expect(a1TotalPoints).toBe(100);

    const a2 = result.assignments?.find(a => a.title.toLowerCase().includes('discussion board'));
    expect(a2).toBeDefined();
    expect(a2?.weightPercentage).toBe('20%');
    expect(a2?.rubricCriteria?.length).toBe(4);
    expect(a2?.mediaUrl).toBe('https://presentationgeeks.com/blog/importance-of-presentation-feedback/');

    const a3 = result.assignments?.find(a => a.title.toLowerCase().includes('group report'));
    expect(a3).toBeDefined();
    expect(a3?.weightPercentage).toBe('10%');
    expect(a3?.rubricCriteria?.length).toBe(5);

    const a4 = result.assignments?.find(a => a.title.toLowerCase().includes('study design') || a.title.toLowerCase().includes('paper'));
    expect(a4).toBeDefined();
    expect(a4?.weightPercentage).toBe('40%');
    expect(a4?.rubricCriteria?.length).toBe(6);
    expect(a4?.dueDate).toMatch(/2026-09-06/);

    const a5 = result.assignments?.find(a => a.title.toLowerCase().includes('participation'));
    expect(a5).toBeDefined();
    expect(a5?.weightPercentage).toBe('10%');
    expect(a5?.rubricCriteria?.length).toBe(2);
  });

  it('CPC 523: Extracts course info, 4 assignments, and weekly schedule with video URLs', () => {
    const fullText = extractTextFromPdf('CPC523_Syllabus.pdf');
    const result = LocalSyllabusParser.shared.parseText(fullText);

    expect(result.courseCode).toBe('CPC 523');
    expect(result.courseName).toContain('Sexuality');
    expect(result.instructorEmail).toBe('gilbertmariepier@cityu.edu');

    expect(result.assignments?.length).toBe(4);
    result.assignments?.forEach(a => {
      a.rubricCriteria?.forEach(c => {
        expect(c.criterionName.length).toBeLessThan(55);
      });
    });
    const weights = result.assignments?.map(a => a.weightPercentage).sort();
    expect(weights).toEqual(['10%', '20%', '30%', '40%']);

    // Check weekly schedule & video links
    expect(result.weeks?.length).toBeGreaterThanOrEqual(10);
    const allReadings = (result.weeks || []).flatMap(w => w.readings || []);
    const videoReadings = allReadings.filter(r => r.videoUrl && r.videoUrl.startsWith('http'));
    expect(videoReadings.length).toBeGreaterThanOrEqual(3);
  });

  it('CPC 511: Extracts course info, 5 assignments, and external schedule notice', () => {
    const fullText = extractTextFromPdf('CPC511_Syllabus.pdf');
    const result = LocalSyllabusParser.shared.parseText(fullText);

    expect(result.courseCode).toBe('CPC 511');
    expect(result.courseName).toContain('Loss and Grief');
    expect(result.instructorName).toContain('Diana Morgan');
    expect(result.instructorEmail).toBe('morgandiana@cityu.edu');

    expect(result.assignments?.length).toBe(5);
    result.assignments?.forEach(a => {
      a.rubricCriteria?.forEach(c => {
        expect(c.criterionName.length).toBeLessThan(55);
      });
    });
    const weights = result.assignments?.map(a => a.weightPercentage).sort();
    expect(weights).toEqual(['10%', '10%', '20%', '30%', '30%']);

    // External schedule notice captured
    expect(result.externalScheduleNotice).toBeDefined();
    expect(result.externalScheduleNotice).toContain('Brightspace');
  });

  it('CPC 527: Extracts course info, assignments, and multi-author readings across pages', () => {
    const fullText = extractTextFromPdf('CPC527_Syllabus.pdf');
    const result = LocalSyllabusParser.shared.parseText(fullText);

    expect(result.courseCode).toBe('CPC 527');
    expect(result.courseName).toContain('Group Counselling');
    expect(result.assignments?.length).toBeGreaterThanOrEqual(3);
    result.assignments?.forEach(a => {
      a.rubricCriteria?.forEach(c => {
        expect(c.criterionName.length).toBeLessThan(55);
      });
    });

    const allReadings = (result.weeks || []).flatMap(w => w.readings || []);
    expect(allReadings.length).toBeGreaterThan(10);
    const coreyReadings = allReadings.filter(r => r.title.includes('Corey'));
    const yalomReadings = allReadings.filter(r => r.title.includes('Yalom'));
    expect(coreyReadings.length).toBeGreaterThan(0);
    expect(yalomReadings.length).toBeGreaterThan(0);
  });
});
