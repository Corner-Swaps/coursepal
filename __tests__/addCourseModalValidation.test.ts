import fs from 'fs';
import path from 'path';

describe('AddCourseModal Validation & HIG Cleanliness Suite', () => {
  const modalFilePath = path.join(__dirname, '../src/components/modals/AddCourseModal.tsx');
  let modalSource: string;

  beforeAll(() => {
    modalSource = fs.readFileSync(modalFilePath, 'utf8');
  });

  describe('AddCourseModal Navigation Bar & Redundancy Elimination', () => {
    it('does NOT contain a redundant Save button in the main modal navigation bar', () => {
      // The main nav bar should only have Cancel and the Title, plus symmetrical spacer
      const navBarMatch = modalSource.match(/<View style=\{styles\.navBar\}>([\s\S]*?)<\/View>/);
      expect(navBarMatch).not.toBeNull();
      const navBarContent = navBarMatch![1];
      expect(navBarContent).toContain('Cancel');
      expect(navBarContent).toContain('Create New Course');
      expect(navBarContent).not.toContain('>Save<');
    });

    it('uses a symmetrical spacer to keep the title centered per Apple HIG', () => {
      expect(modalSource).toContain('<View style={[styles.navButton, styles.actionButton]} />');
    });

    it('directly imports syllabus on file selection without needing a Save button', () => {
      expect(modalSource).toContain('importSyllabusDocument({');
      expect(modalSource).toContain('fileName: asset.name');
    });

    it('directly imports syllabus on vault document selection without needing a Save button', () => {
      expect(modalSource).toContain('handleDoneVaultSelection');
      expect(modalSource).toContain('const chosen = vaultDocs.filter');
    });
  });

  describe('AddCourseModal Copy & HIG Verification', () => {
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
  });
});
