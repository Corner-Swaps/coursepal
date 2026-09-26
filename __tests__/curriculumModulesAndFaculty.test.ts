import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { extractAllModuleNumbers } from '../src/utils/readingDisplayHelper';
import { FacultyExtractor } from '../src/services/FacultyExtractor';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';

describe('Curriculum Modules and Faculty Robustness', () => {
  describe('extractAllModuleNumbers', () => {
    it('extracts module ranges correctly', () => {
      expect(extractAllModuleNumbers('Modules 01 – 02')).toEqual([1, 2]);
      expect(extractAllModuleNumbers('Module 1-3')).toEqual([1, 2, 3]);
      expect(extractAllModuleNumbers('Modules 7 & 8')).toEqual([7, 8]);
      expect(extractAllModuleNumbers('Module 9 and 10')).toEqual([9, 10]);
      expect(extractAllModuleNumbers('Module 4')).toEqual([4]);
      expect(extractAllModuleNumbers({ moduleNumber: 5 })).toEqual([5]);
      expect(extractAllModuleNumbers({ moduleMention: 'Module 6' })).toEqual([6]);
    });
  });

  describe('FacultyExtractor', () => {
    it('correctly validates names with academic titles', () => {
      expect(FacultyExtractor.isValidFacultyName('Dr. Evelyn Vance')).toBe(true);
      expect(FacultyExtractor.isValidFacultyName('Professor Arthur Miller')).toBe(true);
      expect(FacultyExtractor.isValidFacultyName('Seyedmohammad Kalantar & Dawn Percher')).toBe(true);
      expect(FacultyExtractor.isValidFacultyName('Dr. Alireza Sedghi Taromi, PhD, RCC-ACS')).toBe(true);
      expect(FacultyExtractor.isValidFacultyName('Renee Hock, M.A.')).toBe(true);
    });

    it('rejects lone titles without instructor names', () => {
      expect(FacultyExtractor.isValidFacultyName('Associate Professor')).toBe(false);
      expect(FacultyExtractor.isValidFacultyName('Instructor of Record')).toBe(false);
      expect(FacultyExtractor.isValidFacultyName('Course Overview')).toBe(false);
    });

    it('resolves canonical faculty for recognized syllabi', () => {
      const sexCourse = FacultyExtractor.extractFaculty('PRJ-SEX-2026-X Critical Perspectives on Human Sexuality');
      expect(sexCourse.name).toBe('Dr. Evelyn Vance');

      const cpc512 = FacultyExtractor.extractFaculty('CPC 512 Family Systems Practice');
      expect(cpc512.name).toContain('Renee Hock');

      const cpc524 = FacultyExtractor.extractFaculty('CPC 524 Psychopathology & Psychopharmacology');
      expect(cpc524.name).toContain('Seyedmohammad Kalantar');
    });
  });

  describe('Curriculum Matrix Syllabi Modules', () => {
    it('populates all 10 canonical modules for curriculum courses', () => {
      const pdfPath = path.resolve(__dirname, '../src/assets/syllabi/PRJ_SEX_2026_Human_Sexuality_Syllabus.pdf');
      if (fs.existsSync(pdfPath)) {
        const pyScript = `import pypdf; r=pypdf.PdfReader('${pdfPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
        const text = execSync(`python3 -c "${pyScript}"`).toString();
        const dto = LocalSyllabusParser.shared.parseText(text);
        expect(dto).not.toBeNull();
        const allReadings = (dto.readings || []).concat(dto.moduleReadings || []);
        const modNums = new Set();
        allReadings.forEach((r: any) => {
          extractAllModuleNumbers(r).forEach(n => modNums.add(n));
        });
        for (let i = 1; i <= 10; i++) {
          expect(modNums.has(i)).toBe(true);
        }
      }
    });
  });
});
