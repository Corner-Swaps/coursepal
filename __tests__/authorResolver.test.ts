import {
  resolveFullAuthorName,
  invertLastNameFirst,
  mineFullNameFromDocumentText,
  enrichAuthorsInReadings,
  enrichAuthorsInTextbooks
} from '../src/utils/authorResolver';

describe('AuthorResolver Comprehensive Unit Tests', () => {
  describe('Canonical Academic Scholar Registry Resolution', () => {
    it('resolves engineering and MLOps scholars to full names', () => {
      expect(resolveFullAuthorName('Huyen')).toBe('Chip Huyen');
      expect(resolveFullAuthorName('Kleppmann')).toBe('Martin Kleppmann');
      expect(resolveFullAuthorName('Li et al.')).toBe('Shen Li et al.');
      expect(resolveFullAuthorName('Rajbhandari et al.')).toBe('Samyam Rajbhandari et al.');
      expect(resolveFullAuthorName('Shoeybi et al.')).toBe('Mohammad Shoeybi et al.');
      expect(resolveFullAuthorName('Dettmers et al.')).toBe('Tim Dettmers et al.');
      expect(resolveFullAuthorName('Hu et al.')).toBe('Edward Hu et al.');
      expect(resolveFullAuthorName('Burns et al.')).toBe('Brendan Burns et al.');
      expect(resolveFullAuthorName('Stoica et al.')).toBe('Ion Stoica et al.');
    });

    it('resolves humanities and gender studies scholars to full names', () => {
      expect(resolveFullAuthorName('Foucault, M.')).toBe('Michel Foucault');
      expect(resolveFullAuthorName('Vance, C. S.')).toBe('Carole S. Vance');
      expect(resolveFullAuthorName('Katz, J. N.')).toBe('Jonathan Ned Katz');
      expect(resolveFullAuthorName('Kinsey, A. et al.')).toBe('Alfred Kinsey et al.');
      expect(resolveFullAuthorName('Lorde, A.')).toBe('Audre Lorde');
      expect(resolveFullAuthorName('Lugones, M.')).toBe('María Lugones');
      expect(resolveFullAuthorName('Butler, J.')).toBe('Judith Butler');
      expect(resolveFullAuthorName('Mowlaboccus, S.')).toBe('Sharif Mowlaboccus');
      expect(resolveFullAuthorName('Rubin, G.')).toBe('Gayle Rubin');
      expect(resolveFullAuthorName('Crimp, D.')).toBe('Douglas Crimp');
    });

    it('resolves research methods and clinical neurosciences scholars', () => {
      expect(resolveFullAuthorName('Creswell, J.W., & Creswell. J. D.')).toBe('John W. Creswell & J. David Creswell');
      expect(resolveFullAuthorName('Creswell & Creswell')).toBe('John W. Creswell & J. David Creswell');
      expect(resolveFullAuthorName('Lezak et al.')).toBe('Muriel D. Lezak et al.');
      expect(resolveFullAuthorName('Groth-Marnat')).toBe('Gary Groth-Marnat');
      expect(resolveFullAuthorName('Cummings & Mega')).toBe('Jeffrey L. Cummings & Michael S. Mega');
      expect(resolveFullAuthorName('Stuss & Benson')).toBe('Donald T. Stuss & D. Frank Benson');
      expect(resolveFullAuthorName('Luria')).toBe('Alexander R. Luria');
    });

    it('resolves CBT and counselling scholars', () => {
      expect(resolveFullAuthorName('Beck')).toBe('Judith S. Beck');
      expect(resolveFullAuthorName('Persons')).toBe('Jacqueline B. Persons');
      expect(resolveFullAuthorName('Linehan')).toBe('Marsha M. Linehan');
      expect(resolveFullAuthorName('Gehart')).toBe('Diane R. Gehart');
      expect(resolveFullAuthorName('Wada, K., & Fellner, K. D.')).toBe('Kaori Wada & Karlee D. Fellner');
    });
  });

  describe('Inversion Normalization', () => {
    it('inverts Last, First into First Last', () => {
      expect(invertLastNameFirst('Foucault, Michel')).toBe('Michel Foucault');
      expect(invertLastNameFirst('Lorde, Audre')).toBe('Audre Lorde');
      expect(invertLastNameFirst('Gehart, Diane R.')).toBe('Diane R. Gehart');
    });

    it('handles multiple authors with ampersand', () => {
      expect(invertLastNameFirst('Smith, John & Doe, Jane')).toBe('John Smith & Jane Doe');
    });
  });

  describe('Document Context Full Name Mining', () => {
    it('mines full author name from document body when only surname/initial is cited', () => {
      const docText = `
        Unit IV: Performativity, Digital Spaces, & Biopolitics
        Judith Butler's theory of gender performativity disrupted the concept of an essential core identity.
        Reading 07: Butler, J. | Gender Trouble
      `;
      const mined = mineFullNameFromDocumentText('Butler, J.', docText);
      expect(mined).toBe('Judith Butler');
    });

    it('mines full name with et al. preserved', () => {
      const docText = `
        Alfred Kinsey revolutionized sexology through large-scale quantitative data collection.
        Reading 04: Kinsey, A. et al.
      `;
      const mined = mineFullNameFromDocumentText('Kinsey, A. et al.', docText);
      expect(mined).toBe('Alfred Kinsey et al.');
    });
  });

  describe('enrichAuthorsInReadings & enrichAuthorsInTextbooks', () => {
    it('enriches reading deliverables with full author names', () => {
      const readings = [
        { id: 'r1', title: 'Huyen (Ch. 1–3)', authorName: 'Huyen' } as any,
        { id: 'r2', title: 'Kleppmann (Ch. 1)', authorName: null } as any,
      ];
      const enriched = enrichAuthorsInReadings(readings);
      expect(enriched[0].authorName).toBe('Chip Huyen');
      expect(enriched[1].authorName).toBe('Martin Kleppmann');
    });

    it('enriches textbooks with full author names', () => {
      const textbooks = [
        { title: 'Research Design', authorName: 'Creswell, J.W., & Creswell. J. D.' } as any,
      ];
      const enriched = enrichAuthorsInTextbooks(textbooks);
      expect(enriched[0].authorName).toBe('John W. Creswell & J. David Creswell');
    });
  });
});
