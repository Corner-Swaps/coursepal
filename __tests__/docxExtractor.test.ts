import fs from 'fs';
import {
  isDocx,
  parseDocxXmlToMarkdown,
  extractTextFromDocxBytes,
  extractTextFromDocxBase64
} from '../src/services/DocxTextExtractor';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';

describe('DocxTextExtractor (Microsoft Word .docx Support)', () => {
  it('correctly identifies .docx file names and URIs', () => {
    expect(isDocx('syllabus.docx')).toBe(true);
    expect(isDocx('file:///var/mobile/syllabi/course.docx')).toBe(true);
    expect(isDocx('CPC 512 Reading and Assignment Schedule Summer 26.docx')).toBe(true);
    expect(isDocx('syllabus.pdf')).toBe(false);
    expect(isDocx('document.txt')).toBe(false);
  });

  it('converts sample Word XML tables and paragraphs into clean Markdown', () => {
    const sampleXml = `
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>CPC 512: Family Systems Therapy</w:t></w:r></w:p>
          <w:tbl>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Week</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Topics</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Readings</w:t></w:r></w:p></w:tc>
            </w:tr>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Week 1</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Introduction</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Gehart Chapters 1-3</w:t></w:r></w:p></w:tc>
            </w:tr>
          </w:tbl>
        </w:body>
      </w:document>
    `;

    const md = parseDocxXmlToMarkdown(sampleXml);
    expect(md).toContain('CPC 512: Family Systems Therapy');
    expect(md).toContain('| Week | Topics | Readings |');
    expect(md).toContain('| Week 1 | Introduction | Gehart Chapters 1-3 |');
  });

  const realDocxPath = '/Users/slava/Downloads/CPC 512 Reading and Assignment Schedule Summer 26.docx';

  if (fs.existsSync(realDocxPath)) {
    it('extracts real CPC 512 .docx document from user downloads', () => {
      const buffer = fs.readFileSync(realDocxPath);
      const bytes = new Uint8Array(buffer);
      const extracted = extractTextFromDocxBytes(bytes);

      expect(extracted.length).toBeGreaterThan(1000);
      expect(extracted).toContain('CPC 512: Family Systems');
      // Table 1 (Modules)
      expect(extracted).toContain('Systems Theory and the History of Family Therapy');
      expect(extracted).toContain('Gehart (Chapters 1-3)');
      // Table 2 (Weeks)
      expect(extracted).toContain('Week 1');
      expect(extracted).toContain('Gehart chapters 1-3');
      expect(extracted).toContain('Week 2');
      expect(extracted).toContain('Gehart chapter 5');
      expect(extracted).toContain('Week 3');
      expect(extracted).toContain('Gehart chapters 5 & 7');
      expect(extracted).toContain('Due: Family Mapping Papers');
    });

    it('extracts text from base64 encoding of real .docx', () => {
      const buffer = fs.readFileSync(realDocxPath);
      const base64 = buffer.toString('base64');
      const extracted = extractTextFromDocxBase64(base64);

      expect(extracted).toContain('CPC 512');
      expect(extracted).toContain('Gehart');
    });

    it('feeds extracted .docx Markdown cleanly into LocalSyllabusParser', () => {
      const buffer = fs.readFileSync(realDocxPath);
      const bytes = new Uint8Array(buffer);
      const extracted = extractTextFromDocxBytes(bytes);

      const parsed = LocalSyllabusParser.shared.parseText(extracted);

      expect(parsed.courseCode).toBe('CPC 512');
      expect(parsed.weeks?.length).toBe(12);

      const w1 = parsed.weeks?.find(w => w.weekNumber === 1);
      expect(w1?.readings?.some(r => r.title.toLowerCase().includes('gehart') || /1[-–]3/.test(r.title))).toBe(true);
      expect(w1?.moduleMention).toBe('Module 1');

      const w2 = parsed.weeks?.find(w => w.weekNumber === 2);
      expect(w2?.readings?.some(r => /chapter 5/i.test(r.chapterText || r.title))).toBe(true);
      expect(w2?.moduleMention).toBe('Module 2');

      const w3 = parsed.weeks?.find(w => w.weekNumber === 3);
      expect(w3?.readings?.some(r => /5\s*&\s*7/.test(r.title) || (r.title.includes('Chapter 5') && r.title.includes('7')))).toBe(true);
      expect(w3?.moduleMention).toBe('Module 3');

      const w5 = parsed.weeks?.find(w => w.weekNumber === 5);
      expect(w5?.readings?.some(r => /4[-–]10/.test(r.title))).toBe(true);
      expect(w5?.moduleMention).toBe('Module 5');
      expect(w5?.dateRangeStr).toContain('Jul 30');

      // Verify Table 1 distinct module readings
      expect(parsed.moduleReadings?.length).toBe(10);
      const m2 = parsed.moduleReadings?.find(m => m.moduleNumber === 2);
      expect(m2?.title).toContain('Chapter 2');
      expect(m2?.relevantTopics).toContain('Family of Origin');
      expect(m2?.moduleMention).toBe('Module 2');
      expect(m2?.dueDate).toBeNull();
      expect(m2?.dateRangeStr).toBeNull();

      const m3 = parsed.moduleReadings?.find(m => m.moduleNumber === 3);
      expect(m3?.title).toMatch(/11[-–]15/);
      expect(m3?.relevantTopics).toContain('Diverse Populations');
      expect(m3?.dueDate).toBeNull();
      expect(m3?.dateRangeStr).toBeNull();

      const w6 = parsed.weeks?.find(w => w.weekNumber === 6);
      expect(w6?.readings?.length).toBe(0);

      // Verify Family Mapping Papers assignment was extracted from Week 5
      const mappingPaper = parsed.assignments?.find(a => /Family Mapping/i.test(a.title));
      expect(mappingPaper).toBeDefined();
      expect(mappingPaper?.weekNumber).toBe(5);

      // Verify In-Class Case Conceptualization assignment was extracted from Week 10
      const caseConcept = parsed.assignments?.find(a => /Case Conceptualization/i.test(a.title));
      expect(caseConcept).toBeDefined();
      expect(caseConcept?.weekNumber).toBe(10);
      expect(caseConcept?.weightPercentage).toBe('20%');

      // Verify date ranges and themes preserved on weeks
      expect(w1?.dateRangeStr).toMatch(/Jul 2\s*[-–]\s*Jul 3/);
      expect(w1?.theme).toContain('Creating a caring community');

      // Verify reading titles are clean without parenthesized artifacts like '( 3)'
      for (const wk of parsed.weeks || []) {
        for (const r of wk.readings || []) {
          expect(r.title).not.toMatch(/\(\s*\d+\s*\)\s*[-–]/);
        }
      }
    });
  }
});
