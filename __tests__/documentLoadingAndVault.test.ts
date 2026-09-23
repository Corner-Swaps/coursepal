import { ensureBundledPdfFile, hydrateVaultDocWithRealPdf } from '../src/utils/bundledPdfService';
import { healCanonicalCPC514, healCanonicalCPC512, healCanonicalCPC527 } from '../src/context/CoursePalContext';
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

  describe('healCanonicalCPC514 5-Assignment & Vault Extraction', () => {
    it('produces all 5 canonical assignments without dropping Assignment 2', () => {
      const result = healCanonicalCPC514([], [], [], []);
      expect(result.courses.length).toBe(1);
      const cpc514 = result.courses[0];
      expect(cpc514.courseCode).toBe('CPC 514');

      // Verify all 5 assignments are preserved
      expect(result.assignments.length).toBe(5);

      const titles = result.assignments.map(a => a.title);
      expect(titles.some(t => t.includes('Research Article Analysis'))).toBe(true);
      expect(titles.some(t => t.includes('Peer Review Discussion Board Activity'))).toBe(true);
      expect(titles.some(t => t.includes('Peer Review Group Report'))).toBe(true);
      expect(titles.some(t => t.includes('Research Study Design'))).toBe(true);
      expect(titles.some(t => t.includes('Attendance'))).toBe(true);

      // Verify weight percentages total 100%
      const weights = result.assignments.map(a => a.weightPercentage);
      expect(weights).toEqual(['20%', '20%', '10%', '40%', '10%']);

      // Check VaultDocument registration
      expect(result.vaultDocs.length).toBe(1);
      const vaultDoc = result.vaultDocs[0];
      expect(vaultDoc.title).toBe('CPC 514 Syllabus');
      expect(vaultDoc.courseCode).toBe('CPC 514');
      expect(vaultDoc.rawFileDataUri).toContain('CPC514_Syllabus.pdf');
    });
  });

  describe('healCanonicalCPC512 and healCanonicalCPC527 Vault Document Registration', () => {
    it('registers canonical VaultDocument for CPC 512', () => {
      const dummy512Course: Course = {
        id: 'c-cpc-512-test',
        creatorId: 'user',
        courseName: 'Family Systems Therapy',
        courseCode: 'CPC 512',
        courseDescription: 'Family Systems Therapy',
        instructorName: 'Diane R. Gehart',
        instructorEmail: null,
        hexColor: '#EF4444',
        termWeeks: 12,
        sharingCode: 'CPC512',
        isDeleted: false,
        isFavorite: true,
        createdAt: new Date(),
        weeks: [],
        assignments: [],
        syllabusDocs: []
      };

      const result = healCanonicalCPC512([dummy512Course], [], [], []);
      expect(result.vaultDocs.length).toBe(1);
      const doc = result.vaultDocs[0];
      expect(doc.courseCode).toBe('CPC 512');
      expect(doc.rawFileDataUri).toContain('CPC512_Syllabus.pdf');
    });

    it('registers canonical VaultDocument for CPC 527', () => {
      const dummy527Course: Course = {
        id: 'c-cpc-527-test',
        creatorId: 'user',
        courseName: 'Group Counselling',
        courseCode: 'CPC 527',
        courseDescription: 'Group Counselling',
        instructorName: 'Kelsey Murrin',
        instructorEmail: null,
        hexColor: '#059669',
        termWeeks: 12,
        sharingCode: 'CPC527',
        isDeleted: false,
        isFavorite: true,
        createdAt: new Date(),
        weeks: [],
        assignments: [],
        syllabusDocs: []
      };

      const result = healCanonicalCPC527([dummy527Course], [], [], []);
      expect(result.vaultDocs.length).toBe(1);
      const doc = result.vaultDocs[0];
      expect(doc.courseCode).toBe('CPC 527');
      expect(doc.rawFileDataUri).toContain('CPC527_Group_Counselling_Syllabus.pdf');
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
