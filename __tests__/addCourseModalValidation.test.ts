import fs from 'fs';
import path from 'path';

describe('AddCourseModal Validation & HIG Cleanliness Suite', () => {
  const modalFilePath = path.join(__dirname, '../src/components/modals/AddCourseModal.tsx');
  let modalSource: string;

  beforeAll(() => {
    modalSource = fs.readFileSync(modalFilePath, 'utf8');
  });

  describe('Pure Validation Predicate Logic', () => {
    const computeCanSave = (
      courseName: string,
      courseDescription: string,
      attachedFileName: string | null,
      selectedVaultDocIds: string[]
    ) => {
      const hasSyllabusSource = !!(attachedFileName && attachedFileName.length > 0) || selectedVaultDocIds.length > 0;
      return hasSyllabusSource || (courseName.trim().length > 0 && courseDescription.trim().length > 0);
    };

    it('disallows save when no fields are filled', () => {
      expect(computeCanSave('', '', null, [])).toBe(false);
    });

    it('disallows save when ONLY course name is filled without class material or description', () => {
      expect(computeCanSave('CPC 527', '', null, [])).toBe(false);
      expect(computeCanSave('   Biology 101   ', '', null, [])).toBe(false);
    });

    it('disallows save when ONLY course description is filled without name or class material', () => {
      expect(computeCanSave('', 'Introduction to Counselling', null, [])).toBe(false);
    });

    it('allows save when class material is uploaded by itself without name or description', () => {
      expect(computeCanSave('', '', 'CPC527_Syllabus.pdf', [])).toBe(true);
    });

    it('allows save when document is selected from vault by itself without name or description', () => {
      expect(computeCanSave('', '', null, ['vault-doc-1'])).toBe(true);
    });

    it('allows save when course name AND class material are provided', () => {
      expect(computeCanSave('CPC 527', '', 'CPC527_Syllabus.pdf', [])).toBe(true);
      expect(computeCanSave('CPC 527', '', null, ['vault-doc-1'])).toBe(true);
    });

    it('allows save for manual courses when BOTH course name AND description are filled', () => {
      expect(computeCanSave('CPC 527', 'Group Counselling Psychology', null, [])).toBe(true);
    });
  });

  describe('AddCourseModal Code & HIG Copy Verification', () => {
    it('does NOT contain "(2 Saved)" or "({vaultDocs.length} Saved)" badge', () => {
      expect(modalSource).not.toContain('Saved)');
      expect(modalSource).not.toContain('{vaultDocs.length} Saved');
      expect(modalSource).not.toContain('2 Saved');
    });

    it('labels vault picker as "Choose Document from Vault" without "Saved"', () => {
      expect(modalSource).toContain('Choose Document from Vault');
      expect(modalSource).not.toContain('Choose Saved Document from Vault');
    });

    it('labels Section 5 header cleanly as "Choose Vault Document" without count in parentheses', () => {
      expect(modalSource).toContain('<Text style={styles.sectionHeader}>Choose Vault Document</Text>');
      expect(modalSource).not.toContain('Choose Vault Document (');
    });

    it('binds disabled={!canSave} to the Save button TouchableOpacity', () => {
      expect(modalSource).toContain('disabled={!canSave}');
    });

    it('applies styles.saveTextDisabled when !canSave', () => {
      expect(modalSource).toContain('!canSave && styles.saveTextDisabled');
    });

    it('allows importSyllabusDocument to parse title automatically if courseName is empty', () => {
      expect(modalSource).toContain('preserveCourseTitle: isGenericCourseName || !trimmedName ? undefined : trimmedName');
    });
  });
});
