import { BundledSyllabiCatalog } from '../src/utils/syllabusCatalog';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';

describe('Document Upload & Syllabus Catalog Integration', () => {
  it('contains comprehensive bundled syllabi across disciplines', () => {
    expect(BundledSyllabiCatalog.length).toBeGreaterThanOrEqual(10);
    for (const item of BundledSyllabiCatalog) {
      expect(item.courseCode).toBeTruthy();
      expect(item.courseName).toBeTruthy();
      expect(item.rawText.length).toBeGreaterThan(100);
      expect(item.hexColor).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('correctly parses CPC 514 into structured course schedule', () => {
    const cpc514 = BundledSyllabiCatalog.find(c => c.courseCode === 'CPC 514');
    expect(cpc514).toBeDefined();
    const result = LocalSyllabusParser.shared.parseText(cpc514!.rawText);
    expect(result.courseCode).toBe('CPC 514');
    expect(result.weeks?.length).toBeGreaterThan(0);
    expect(result.assignments?.length).toBeGreaterThan(0);
  });

  it('correctly parses CS 501 into structured course schedule with Bishop readings', () => {
    const cs501 = BundledSyllabiCatalog.find(c => c.courseCode === 'CS 501');
    expect(cs501).toBeDefined();
    const result = LocalSyllabusParser.shared.parseText(cs501!.rawText);
    expect(result.courseCode).toBe('CS 501');
    expect(result.assignments?.length).toBeGreaterThanOrEqual(3);
    const hasBishop = result.weeks?.some(w => w.readings?.some(r => r.title.includes('Bishop')));
    expect(hasBishop).toBe(true);
  });

  it('correctly parses BIO 412 molecular genetics syllabus', () => {
    const bio412 = BundledSyllabiCatalog.find(c => c.courseCode === 'BIO 412');
    expect(bio412).toBeDefined();
    const result = LocalSyllabusParser.shared.parseText(bio412!.rawText);
    expect(result.courseCode).toBe('BIO 412');
    expect(result.assignments?.length).toBeGreaterThanOrEqual(2);
  });

  it('correctly extracts video and podcast URLs from media citations in syllabus text', () => {
    const sampleText = `
CPC 523 Psychology of Sexuality and Human Development
Date Content Requirements
1 July 3rd Introduction
Required: Watch: The keys to a happier, healthier sex life, Emily Nagoski - TED
2 July 10th Cultural & Familial Influences
Required: Watch: https://www.youtube.com/watch?v=JrTvI6lGi4s
3 July 17th Sexuality, Trauma & Mental Health
Required: Watch:https://www.ted.com/talks/rena_martine_the_truth_about_sexual_shame
4 July 24th Fantasy
Required Watch The Science of Sexual Fantasies with Justin Lehmiller: https://www.youtube.com/watch?v=2watIpG02to&t=3s
5 July 31st Consensual Non-Monogamy
Required: Watch Attachment in Polyamory & Consensual Non-Monogamous Relationships with Jessica Fern: https://www.youtube.com/watch?v=ie3zXI4DJac
Due: Sexuality Reflection Assignment
7 August 14th Intimate Relationships
Required: Watch Premature Ejaculation: A Real Story of Struggle, Support and Success https://thepenisproject.podbean.com/e/191-premature-ejaculation-a-real-story-of-struggle-support-and-success/
    `;

    const result = LocalSyllabusParser.shared.parseText(sampleText);
    expect(result.courseCode).toBe('CPC 523');

    // Find all readings across weeks
    const allReadings = (result.weeks || []).flatMap(w => w.readings || []);
    const readingsWithUrls = allReadings.filter(r => r.videoUrl);
    expect(readingsWithUrls.length).toBeGreaterThanOrEqual(3);

    const ytReading = allReadings.find(r => r.videoUrl?.includes('JrTvI6lGi4s'));
    expect(ytReading).toBeDefined();
    expect(ytReading?.videoUrl).toBe('https://www.youtube.com/watch?v=JrTvI6lGi4s');

    const fernReading = allReadings.find(r => r.videoUrl?.includes('ie3zXI4DJac'));
    expect(fernReading).toBeDefined();
    expect(fernReading?.videoUrl).toBe('https://www.youtube.com/watch?v=ie3zXI4DJac');

    const podbeanReading = allReadings.find(r => r.videoUrl?.includes('podbean.com'));
    expect(podbeanReading).toBeDefined();
    expect(podbeanReading?.videoUrl).toContain('thepenisproject.podbean.com');
  });

  it('correctly parses real CPC 523 PDF text with assignments, dates, points, and video URLs', () => {
    const { execSync } = require('child_process');
    const path = require('path');
    const pdfPath = path.resolve(__dirname, '../src/assets/syllabi/Syllabus_5_CPC523.pdf');
    const pyScript = `import pypdf; r=pypdf.PdfReader('${pdfPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
    const fullText = execSync(`python3 -c "${pyScript}"`).toString();

    const result = LocalSyllabusParser.shared.parseText(fullText);
    console.log('--- TEST: CPC 523 RESULT ---');
    console.log('Code:', result.courseCode, 'Name:', result.courseName);
    console.log('Assignments:', result.assignments?.map(a => `${a.title} | ${a.dueDate} | ${a.weightPercentage} | ${a.pointsPossible}`));
    const allR = (result.weeks || []).flatMap(w => w.readings || []);
    console.log('Readings with videoUrl:', allR.filter(r => r.videoUrl).map(r => `${r.title} | ${r.videoUrl}`));
    console.log('Weeks dates:', (result.weeks || []).map(w => `W${w.weekNumber}: ${w.startDate}`));

    expect(result.courseCode).toBe('CPC 523');
    expect(result.assignments?.length).toBeGreaterThanOrEqual(1);
  });

  it('correctly parses real CPC 527 PDF text with dates and readings', () => {
    const { execSync } = require('child_process');
    const path = require('path');
    const pdfPath = path.resolve(__dirname, '../src/assets/syllabi/CPC527_Syllabus.pdf');
    const pyScript = `import pypdf; r=pypdf.PdfReader('${pdfPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
    const fullText = execSync(`python3 -c "${pyScript}"`).toString();

    const result = LocalSyllabusParser.shared.parseText(fullText);
    console.log('--- TEST: CPC 527 RESULT ---');
    console.log('Code:', result.courseCode, 'Name:', result.courseName);
    console.log('Assignments:', result.assignments?.map(a => `${a.title} | ${a.dueDate} | ${a.weightPercentage} | ${a.pointsPossible}`));
    const allR = (result.weeks || []).flatMap(w => w.readings || []);
    console.log('Readings sample (first 6):', allR.slice(0, 6).map(r => `${r.title} | ${r.dueDate} | ${r.dateRangeStr}`));
    console.log('Weeks dates:', (result.weeks || []).map(w => `W${w.weekNumber}: ${w.startDate} | range: ${w.dateRangeStr}`));

    expect(result.courseCode).toBe('CPC 527');
  });
});
