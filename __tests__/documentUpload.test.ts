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
});
