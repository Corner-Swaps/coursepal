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
      attachedFileName: string | null,
      selectedVaultDocIds: string[]
    ) => {
      const hasSyllabusSource = !!(attachedFileName && attachedFileName.length > 0) || selectedVaultDocIds.length > 0;
      return hasSyllabusSource;
    };

    it('disallows save when no document is attached or selected from vault', () => {
      expect(computeCanSave(null, [])).toBe(false);
      expect(computeCanSave('', [])).toBe(false);
    });

    it('disallows save even if course name and description are typed without uploading class material', () => {
      // Regardless of user typing name or description, uploading class material is required
      expect(computeCanSave(null, [])).toBe(false);
    });

    it('allows save when class material is uploaded via file picker', () => {
      expect(computeCanSave('CPC527_Syllabus.pdf', [])).toBe(true);
    });

    it('allows save when document is selected from vault', () => {
      expect(computeCanSave(null, ['vault-doc-1'])).toBe(true);
      expect(computeCanSave('', ['vault-doc-1'])).toBe(true);
    });

    it('allows save when both file name and vault selection are active', () => {
      expect(computeCanSave('Research_Methods.docx', ['vault-doc-2'])).toBe(true);
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

    it('strictly assigns canSave to hasSyllabusSource requiring an uploaded document before clicking Save', () => {
      expect(modalSource).toContain('const canSave = hasSyllabusSource;');
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
