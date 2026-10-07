import { ensureBundledPdfFile, hydrateVaultDocWithRealPdf } from '../src/utils/bundledPdfService';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import cityuSyllabi from '../src/utils/cityu_syllabi_texts.json';
import { VaultDocument, Course, Reading, Assignment } from '../src/types/models';

describe('Document Loading & Syllabi Vault Verification', () => {
  describe('ensureBundledPdfFile token matching', () => {
    it('matches CPC 514 with various identifier formats', async () => {
      const byCode = await ensureBundledPdfFile('CPC 514');
      expect(byCode).toContain('CPC514_Syllabus.pdf');

      const byTitle = await ensureBundledPdfFile('Research Methods and Statistics');
      expect(byTitle).toContain('CPC514_Syllabus.pdf');

      const byFile = await ensureBundledPdfFile('CPC514_Syllabus.pdf');
      expect(byFile).toContain('CPC514_Syllabus.pdf');

      const byInstructor = await ensureBundledPdfFile('Alireza Sedghi Taromi');
      expect(byInstructor).toContain('CPC514_Syllabus.pdf');
    });

    it('matches despite leading random UUIDs by scanning subsequent vararg tokens', async () => {
      const matched = await ensureBundledPdfFile(
        'vd-177402840-syllabus',
        'CPC 514 Syllabus',
        'c-cpc-514-active'
      );
      expect(matched).toContain('CPC514_Syllabus.pdf');
    });

    it('matches CPC 512, CPC 527, and PSYC 612 reliably', async () => {
      const cpc512 = await ensureBundledPdfFile('vd-cpc-512', 'CPC 512 Family Systems', 'cpc-512');
      expect(cpc512).toContain('CPC512_Syllabus.pdf');

      const cpc527 = await ensureBundledPdfFile('vd-cpc-527', 'CPC 527 Group Counselling', 'cpc-527');
      expect(cpc527).toContain('CPC527_Group_Counselling_Syllabus.pdf');

      const psyc612 = await ensureBundledPdfFile('vd-psyc-612', 'PSYC 612 Advanced CBT', 'psyc-612');
      expect(psyc612).toContain('PSYC612_Advanced_CBT_Interventions.pdf');
    });

    it('returns null for completely unrelated / unknown tokens', async () => {
      const unknown = await ensureBundledPdfFile('random-doc-12345', 'Underwater Basket Weaving 101');
      expect(unknown).toBeNull();
    });
  });

  describe('hydrateVaultDocWithRealPdf', () => {
    it('attaches rawFileDataUri and page images for a vault document', async () => {
      const mockDoc: VaultDocument = {
        id: 'vd-cpc-514-syllabus',
        title: 'CPC 514 Syllabus',
        category: 'Syllabi',
        fileSize: '300 KB',
        fileType: 'PDF',
        courseCode: 'CPC 514',
        courseId: 'c-cpc-514-active',
        fileContent: 'Research Methods and Statistics Syllabus',
        docColorHex: '#2563EB',
        rawFileDataUri: null,
        pageImages: null,
        uploadedAt: new Date()
      };

      const hydrated = await hydrateVaultDocWithRealPdf(mockDoc);
      expect(hydrated.rawFileDataUri).toBeDefined();
      expect(hydrated.rawFileDataUri).toContain('CPC514_Syllabus.pdf');
    });
  });

  describe('SyllabusImportManager deduplication preserves distinct peer review items', () => {
    it('does not merge Discussion Board (20%) into Group Report (10%)', () => {
      const localDto = LocalSyllabusParser.shared.parseText(cityuSyllabi.cpc514);
      const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(localDto, cityuSyllabi.cpc514);

      const deduplicated = SyllabusImportManager.shared.deduplicateAssignments(
        normalized.candidateAssignments,
        normalized.termYear,
        normalized.weekDateMap
      );

      const discussionBoard = deduplicated.find(a => /discussion\s*board/i.test(a.title));
      const groupReport = deduplicated.find(a => /group\s*report/i.test(a.title));

      expect(discussionBoard).toBeDefined();
      expect(groupReport).toBeDefined();
      expect(discussionBoard?.weightPercentage).toBe('20%');
      expect(groupReport?.weightPercentage).toBe('10%');
    });
  });
});
