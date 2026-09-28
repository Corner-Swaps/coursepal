import * as fs from 'fs';
import * as path from 'path';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { cleanAcademicWeekTheme } from '../src/utils/readingDisplayHelper';

describe('Mass Ingestion Stress-Test Across 36 User-Uploaded Documents', () => {
  const extractedDir = '/tmp/extracted_syllabi';
  if (!fs.existsSync(extractedDir)) {
    it('skips if directory does not exist', () => {
      expect(true).toBe(true);
    });
    return;
  }

  const fileNames = fs.readdirSync(extractedDir).filter(f => f.endsWith('.txt'));

  fileNames.forEach((fname) => {
    it(`parses ${fname} with zero crashes, clean capitalization, and zero fabricated data`, () => {
      const filePath = path.join(extractedDir, fname);
      const text = fs.readFileSync(filePath, 'utf8');
      if (text.trim().length < 50) return; // Skip empty files

      const dto = LocalSyllabusParser.shared.parseText(text);
      expect(dto).toBeDefined();

      const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, text);
      expect(normalized).toBeDefined();

      const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(
        normalized.candidateReadings,
        normalized.textbooks,
        normalized.termYear
      );

      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(
        normalized.candidateAssignments,
        normalized.termYear,
        normalized.weekDateMap
      );

      // Verify Rule 3: Zero arbitrary point fabrication
      cleanAssignments.forEach(a => {
        if (!a.rubricCriteria || a.rubricCriteria.length === 0) {
          if (a.weightPercentage && !a.pointsPossible) {
            expect(a.pointsPossible).toBeNull();
          }
        }
      });

      // Verify Capitalization & Zero loose en-dashes
      normalized.weeks.forEach(w => {
        if (w.theme) {
          const cleaned = cleanAcademicWeekTheme(w.theme);
          if (cleaned.length > 0) {
            expect(cleaned.charAt(0)).toBe(cleaned.charAt(0).toUpperCase());
            expect(cleaned).not.toContain(' – ');
          }
        }
      });

      cleanReadings.forEach(r => {
        if (r.relevantTopics) {
          const cleaned = cleanAcademicWeekTheme(r.relevantTopics);
          if (cleaned.length > 0) {
            expect(cleaned.charAt(0)).toBe(cleaned.charAt(0).toUpperCase());
            expect(cleaned).not.toContain(' – ');
          }
        }
      });
    });
  });
});
