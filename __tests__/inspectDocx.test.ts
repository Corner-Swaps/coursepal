
import * as fs from 'fs';
import { extractTextFromDocxBytes } from '../src/services/DocxTextExtractor';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

const p = '/Users/slava/.gemini/antigravity/brain/4c112012-49ab-441f-be67-4845c016c820/.user_uploaded/media_1790267826626.docx';
const describeIf = fs.existsSync(p) ? describe : describe.skip;

describeIf('Test Docx', () => {
  it('extracts and parses media_1790267826626.docx', () => {
    const buf = fs.readFileSync(p);
    const text = extractTextFromDocxBytes(new Uint8Array(buf));
    console.log('Extracted docx text length:', text.length);
    console.log('--- DOCX TEXT START ---');
    console.log(text.slice(0, 1000));
    console.log('--- DOCX TEXT END ---');
    const parsed: any = LocalSyllabusParser.shared.parseText(text);
    console.log('Course Code:', parsed.courseCode);
    console.log('Course Name:', parsed.courseName);
    console.log('Weeks:', parsed.weeks?.length);
    console.log('Assignments:', parsed.assignments?.length);
    console.log('Readings:');
    parsed.weeks?.forEach((w: any) => {
      w.readings?.forEach((r: any) => console.log('  Week reading:', r.title, '|', r.authorName));
    });
    parsed.moduleReadings?.forEach((r: any) => console.log('  Module reading:', r.title, '|', r.authorName));
  });
});
