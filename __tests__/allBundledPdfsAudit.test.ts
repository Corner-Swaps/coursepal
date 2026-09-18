import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

function extractTextFromPdf(filePath: string): string {
  const pyScript = `import pypdf; r=pypdf.PdfReader('${filePath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
  return execSync(`python3 -c "${pyScript}"`).toString();
}

describe('All Bundled Syllabi Comprehensive Audit', () => {
  const syllabiDir = path.resolve(__dirname, '../src/assets/syllabi');
  const files = fs.readdirSync(syllabiDir).filter(f => f.endsWith('.pdf'));

  files.forEach(fileName => {
    it(`audits parsing of ${fileName}`, () => {
      const fullPath = path.join(syllabiDir, fileName);
      const text = extractTextFromPdf(fullPath);
      expect(text.length).toBeGreaterThan(50);

      const parsed = LocalSyllabusParser.shared.parseText(text);

      // Verify course identity
      expect(parsed.courseCode).toBeDefined();
      expect(parsed.courseCode!.length).toBeGreaterThanOrEqual(3);

      // Check no pipes or delimiter artifacts in titles or notes
      parsed.assignments?.forEach(a => {
        expect(a.title).not.toContain('|||');
        expect(a.title).not.toContain('|');
        expect(a.title.length).toBeGreaterThan(2);
        if (a.noteText) {
          expect(a.noteText).not.toContain('|||');
        }
      });

      // Verify normalization through SyllabusImportManager
      const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(parsed, text);
      expect(normalized.courseCode).toBeDefined();
      normalized.candidateAssignments.forEach(ca => {
        expect(ca.title).not.toContain('|||');
        expect(ca.title).not.toContain('|');
      });
    });
  });
});
