/**
 * AuthorResolver
 *
 * Dedicated engine for resolving academic citations and author mentions into
 * clean, complete full author names (e.g. "Judith Butler" instead of "Butler, J.",
 * "Chip Huyen" instead of "Huyen", "Michel Foucault" instead of "Foucault, M.",
 * "John W. Creswell & J. David Creswell" instead of "Creswell, J.W., & Creswell. J. D.").
 *
 * Features:
 * 1. Canonical Academic Scholar Registry across Engineering, Psychology, Neuroscience,
 *    Humanities, and Research Methods.
 * 2. Inversion Normalization: Transforms "Last, First [M.]" into natural "First [M.] Last".
 * 3. Document-Context Full Name Mining: Discovers full names appearing in syllabus text
 *    when only a surname or initial is cited in schedule tables.
 */

import { ReadingDTO, TextbookResource } from '../types/models';

/**
 * Canonical registry of widely cited academic scholars across course domains.
 * Keys are normalized lowercase alphanumeric tokens of surnames / common citation stems.
 */
const CANONICAL_SCHOLAR_REGISTRY: Record<string, string> = {
  // Engineering, Distributed Systems & MLOps (DATA 630 & CS)
  'huyen': 'Chip Huyen',
  'chiphuyen': 'Chip Huyen',
  'kleppmann': 'Martin Kleppmann',
  'martinkleppmann': 'Martin Kleppmann',
  'burnsetal': 'Brendan Burns et al.',
  'burns': 'Brendan Burns',
  'brendanburns': 'Brendan Burns',
  'brendanburnsetal': 'Brendan Burns et al.',
  'stoicaetal': 'Ion Stoica et al.',
  'stoica': 'Ion Stoica',
  'ionstoica': 'Ion Stoica',
  'ionstoicaetal': 'Ion Stoica et al.',
  'lietal': 'Shen Li et al.',
  'shenli': 'Shen Li',
  'shenlietal': 'Shen Li et al.',
  'rajbhandarietal': 'Samyam Rajbhandari et al.',
  'rajbhandari': 'Samyam Rajbhandari',
  'samyamrajbhandari': 'Samyam Rajbhandari',
  'samyamrajbhandarietal': 'Samyam Rajbhandari et al.',
  'shoeybietal': 'Mohammad Shoeybi et al.',
  'shoeybi': 'Mohammad Shoeybi',
  'mohammadshoeybi': 'Mohammad Shoeybi',
  'mohammadshoeybietal': 'Mohammad Shoeybi et al.',
  'dettmersetal': 'Tim Dettmers et al.',
  'dettmers': 'Tim Dettmers',
  'timdettmers': 'Tim Dettmers',
  'timdettmersetal': 'Tim Dettmers et al.',
  'huetal': 'Edward Hu et al.',
  'edwardhu': 'Edward Hu',
  'edwardhuetal': 'Edward Hu et al.',
  'goodfellowetal': 'Ian Goodfellow, Yoshua Bengio & Aaron Courville',
  'goodfellow': 'Ian Goodfellow',
  'vaswanietal': 'Ashish Vaswani et al.',
  'devlinetal': 'Jacob Devlin et al.',
  'brownetal': 'Tom B. Brown et al.',
  'russellnorvig': 'Stuart Russell & Peter Norvig',
  'russell': 'Stuart Russell',
  'tanenbaum': 'Andrew S. Tanenbaum',
  'silberschatzetal': 'Abraham Silberschatz, Peter B. Galvin & Greg Gagne',
  'hennessypatterson': 'John L. Hennessy & David A. Patterson',
  'cormenetal': 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest & Clifford Stein',
  'cormen': 'Thomas H. Cormen',
  'thomascormen': 'Thomas H. Cormen',

  // Humanities, Gender Studies & Critical Social Inquiry (PRJ-SEX-2026-X)
  'foucaultm': 'Michel Foucault',
  'foucault': 'Michel Foucault',
  'michelfoucault': 'Michel Foucault',
  'vancecs': 'Carole S. Vance',
  'vance': 'Carole S. Vance',
  'carolesvance': 'Carole S. Vance',
  'carolevance': 'Carole S. Vance',
  'katzjn': 'Jonathan Ned Katz',
  'katz': 'Jonathan Ned Katz',
  'jonathannedkatz': 'Jonathan Ned Katz',
  'jonathankatz': 'Jonathan Ned Katz',
  'kinseyaetal': 'Alfred Kinsey et al.',
  'kinseyetal': 'Alfred Kinsey et al.',
  'kinsey': 'Alfred Kinsey',
  'alfredkinsey': 'Alfred Kinsey',
  'lordea': 'Audre Lorde',
  'lorde': 'Audre Lorde',
  'audrelorde': 'Audre Lorde',
  'lugonesm': 'María Lugones',
  'lugones': 'María Lugones',
  'marialugones': 'María Lugones',
  'butlerj': 'Judith Butler',
  'butler': 'Judith Butler',
  'judithbutler': 'Judith Butler',
  'mowlaboccuss': 'Sharif Mowlaboccus',
  'mowlaboccus': 'Sharif Mowlaboccus',
  'sharifmowlaboccus': 'Sharif Mowlaboccus',
  'rubing': 'Gayle Rubin',
  'rubin': 'Gayle Rubin',
  'gaylerubin': 'Gayle Rubin',
  'crimpd': 'Douglas Crimp',
  'crimp': 'Douglas Crimp',
  'douglascrimp': 'Douglas Crimp',
  'sedgwickek': 'Eve Kosofsky Sedgwick',
  'sedgwick': 'Eve Kosofsky Sedgwick',
  'evekosofskysedgwick': 'Eve Kosofsky Sedgwick',
  'hooksb': 'bell hooks',
  'bellhooks': 'bell hooks',
  'ahmeds': 'Sara Ahmed',
  'ahmed': 'Sara Ahmed',
  'saraahmed': 'Sara Ahmed',
  'halberstamj': 'Jack Halberstam',
  'halberstam': 'Jack Halberstam',
  'jackhalberstam': 'Jack Halberstam',
  'preciadop': 'Paul B. Preciado',
  'preciado': 'Paul B. Preciado',

  // Research Methods & Statistics (CPC 514)
  'creswelljwcreswelld': 'John W. Creswell & J. David Creswell',
  'creswellcreswell': 'John W. Creswell & J. David Creswell',
  'creswell': 'John W. Creswell & J. David Creswell',
  'johnwcreswell': 'John W. Creswell & J. David Creswell',
  'field': 'Andy Field',
  'andyfield': 'Andy Field',
  'tabachnickfidell': 'Barbara G. Tabachnick & Linda S. Fidell',
  'cohen': 'Jacob Cohen',
  'andrewfhayes': 'Andrew F. Hayes',
  'hayesetal': 'Steven C. Hayes et al.',
  'stevenchayes': 'Steven C. Hayes',
  'stevenhayes': 'Steven C. Hayes',
  'hayes': 'Steven C. Hayes',

  // Clinical Neurosciences & Practicum (NEUR 740)
  'lezaketal': 'Muriel D. Lezak et al.',
  'lezak': 'Muriel D. Lezak',
  'murieldlezak': 'Muriel D. Lezak',
  'grothmarnat': 'Gary Groth-Marnat',
  'marnat': 'Gary Groth-Marnat',
  'garygrothmarnat': 'Gary Groth-Marnat',
  'cummingsmega': 'Jeffrey L. Cummings & Michael S. Mega',
  'cummings': 'Jeffrey L. Cummings',
  'stussbenson': 'Donald T. Stuss & D. Frank Benson',
  'stuss': 'Donald T. Stuss',
  'luria': 'Alexander R. Luria',
  'alexanderluria': 'Alexander R. Luria',
  'petersen': 'Ronald C. Petersen',
  'kolbwhishaw': 'Bryan Kolb & Ian Q. Whishaw',
  'gazzanigaetal': 'Michael S. Gazzaniga et al.',
  'kandeletal': 'Eric R. Kandel et al.',
  'kandel': 'Eric R. Kandel',
  'erickandel': 'Eric R. Kandel',
  'heilmanvalenstein': 'Kenneth M. Heilman & Edward Valenstein',
  'mesulam': 'M.-Marsel Mesulam',
  'damasio': 'Antonio Damasio',

  // CBT, Counselling & Clinical Psychology (CPC 511, CPC 512, CPC 523, CPC 527, PSYC 612)
  'gehart': 'Diane R. Gehart',
  'dianergehart': 'Diane R. Gehart',
  'beck': 'Judith S. Beck',
  'judithsbeck': 'Judith S. Beck',
  'aarontbeck': 'Aaron T. Beck',
  'persons': 'Jacqueline B. Persons',
  'jacquelinebpersons': 'Jacqueline B. Persons',
  'linehan': 'Marsha M. Linehan',
  'marshamlinehan': 'Marsha M. Linehan',
  'barlow': 'David H. Barlow',
  'davidhbarlow': 'David H. Barlow',
  'yalomleszcz': 'Irvin D. Yalom & Molyn Leszcz',
  'yalom': 'Irvin D. Yalom',
  'irvindyalom': 'Irvin D. Yalom',
  'corey': 'Gerald Corey',
  'geraldcorey': 'Gerald Corey',
  'wadakfellnerkd': 'Kaori Wada & Karlee D. Fellner',
  'wadafellner': 'Kaori Wada & Karlee D. Fellner',
  'madduxwinstead': 'James E. Maddux & Barbara A. Winstead',
  'maddux': 'James E. Maddux & Barbara A. Winstead',
  'winstead': 'James E. Maddux & Barbara A. Winstead',
  'jamesemaddux': 'James E. Maddux & Barbara A. Winstead',
  'prestonetal': 'John D. Preston, John H. O’Neal & Mary C. Talaga',
  'prestononealtalaga': 'John D. Preston, John H. O’Neal & Mary C. Talaga',
  'preston': 'John D. Preston, John H. O’Neal & Mary C. Talaga',
  'talaga': 'John D. Preston, John H. O’Neal & Mary C. Talaga',
  'neilrcarlson': 'Neil R. Carlson',
  'americanpsychiatricassociation': 'American Psychiatric Association',
  'apa': 'American Psychiatric Association',
  'worldhealthorganization': 'World Health Organization',
  'who': 'World Health Organization',
  'whoicd': 'World Health Organization',
  'stahl': 'Stephen M. Stahl',
  'nichols': 'Michael P. Nichols',
  'mcgoldrick': 'Monica McGoldrick',
  'minuchin': 'Salvador Minuchin',
  'bowen': 'Murray Bowen',
  'satir': 'Virginia Satir',
  'whiteepston': 'Michael White & David Epston',
  'deshazer': 'Steve de Shazer',
  'suesue': 'Derald Wing Sue & David Sue',

  // Mathematics & Calculus
  'stewart': 'James Stewart',
  'jamesstewart': 'James Stewart',
  'spivak': 'Michael Spivak',
  'michaelspivak': 'Michael Spivak',
  'strang': 'Gilbert Strang',
  'gilbertstrang': 'Gilbert Strang',
  'rudin': 'Walter Rudin',
  'walterrudin': 'Walter Rudin',
  'apostol': 'Tom M. Apostol',
  'anton': 'Howard Anton',
  'larson': 'Ron Larson',
  'boycediprima': 'William E. Boyce & Richard C. DiPrima',

  // Physics & Astronomy
  'hallidayresnick': 'David Halliday & Robert Resnick',
  'halliday': 'David Halliday',
  'resnick': 'Robert Resnick',
  'serwayjewett': 'Raymond A. Serway & John W. Jewett',
  'serway': 'Raymond A. Serway',
  'giancoli': 'Douglas C. Giancoli',
  'douglasgiancoli': 'Douglas C. Giancoli',
  'griffiths': 'David J. Griffiths',
  'davidjgriffiths': 'David J. Griffiths',
  'davidgriffiths': 'David J. Griffiths',
  'feynman': 'Richard Feynman',
  'richardfeynman': 'Richard Feynman',
  'carrollostlie': 'Bradley W. Carroll & Dale A. Ostlie',
  'tiplermosca': 'Paul A. Tipler & Gene Mosca',
  'purcell': 'Edward M. Purcell',
  'sakurai': 'J. J. Sakurai',

  // Chemistry & Materials Science
  'zumdahl': 'Steven S. Zumdahl',
  'stevenszumdahl': 'Steven S. Zumdahl',
  'brownlemay': 'Theodore L. Brown & H. Eugene LeMay',
  'chang': 'Raymond Chang',
  'raymondchang': 'Raymond Chang',
  'atkins': 'Peter Atkins',
  'peteratkins': 'Peter Atkins',
  'clayden': 'Jonathan Clayden',
  'jonathanclayden': 'Jonathan Clayden',
  'vollhardtschore': 'K. Peter C. Vollhardt & Neil E. Schore',
  'callister': 'William D. Callister',
  'williamdcallister': 'William D. Callister',
  'silberberg': 'Martin S. Silberberg',
  'mcmurry': 'John E. McMurry',
  'johnmcmurry': 'John E. McMurry',

  // Biology, Genetics & Biochemistry
  'campbellreece': 'Neil A. Campbell & Jane B. Reece',
  'campbell': 'Neil A. Campbell',
  'neilcampbell': 'Neil A. Campbell',
  'albertsetal': 'Bruce Alberts et al.',
  'alberts': 'Bruce Alberts',
  'brucealberts': 'Bruce Alberts',
  'lodishetal': 'Harvey Lodish et al.',
  'lodish': 'Harvey Lodish',
  'voetvoet': 'Donald Voet & Judith G. Voet',
  'lehninger': 'Albert L. Lehninger',
  'nelsoncox': 'David L. Nelson & Michael M. Cox',
  'gilbert': 'Scott F. Gilbert',
  'scottfgilbert': 'Scott F. Gilbert',
  'krebs': 'Jocelyn E. Krebs',
  'watsonetal': 'James D. Watson et al.',

  // Computer Science & Algorithms
  'knuth': 'Donald Knuth',
  'donaldknuth': 'Donald Knuth',
  'bishop': 'Christopher M. Bishop',
  'christopherbishop': 'Christopher M. Bishop',
  'jurafskymartin': 'Daniel Jurafsky & James H. Martin',
  'jurafsky': 'Daniel Jurafsky',
  'mitchell': 'Tom M. Mitchell',
  'tommitchell': 'Tom M. Mitchell',
  'sedgewickwayne': 'Robert Sedgewick & Kevin Wayne',
  'sedgewick': 'Robert Sedgewick',
  'sipser': 'Michael Sipser',
  'michaelsipser': 'Michael Sipser',
  'abelsonsussman': 'Harold Abelson & Gerald Jay Sussman',
  'fowler': 'Martin Fowler',
  'martinfowler': 'Martin Fowler',
  'suttonbarto': 'Richard S. Sutton & Andrew G. Barto',

  // Economics, Business, Finance & Management
  'mankiw': 'N. Gregory Mankiw',
  'ngregorymankiw': 'N. Gregory Mankiw',
  'gregmankiw': 'N. Gregory Mankiw',
  'krugmanwells': 'Paul Krugman & Robin Wells',
  'krugman': 'Paul Krugman',
  'paulkrugman': 'Paul Krugman',
  'porter': 'Michael E. Porter',
  'michaeleporter': 'Michael E. Porter',
  'michaelporter': 'Michael E. Porter',
  'kotlerkeller': 'Philip Kotler & Kevin Lane Keller',
  'kotler': 'Philip Kotler',
  'philipkotler': 'Philip Kotler',
  'brealeymyers': 'Richard A. Brealey & Stewart C. Myers',
  'brealeymyersallen': 'Richard A. Brealey & Stewart C. Myers',
  'brealey': 'Richard A. Brealey',
  'damodaran': 'Aswath Damodaran',
  'aswathdamodaran': 'Aswath Damodaran',
  'varian': 'Hal R. Varian',
  'halvarian': 'Hal R. Varian',
  'pindyckrubinfeld': 'Robert S. Pindyck & Daniel L. Rubinfeld',
  'stiglitz': 'Joseph E. Stiglitz',
  'josephstiglitz': 'Joseph E. Stiglitz',
  'friedman': 'Milton Friedman',
  'miltonfriedman': 'Milton Friedman',
  'keynes': 'John Maynard Keynes',
  'johnmaynardkeynes': 'John Maynard Keynes',
  'adamsmith': 'Adam Smith',
  'ricardo': 'David Ricardo',
  'piketty': 'Thomas Piketty',
  'thomaspiketty': 'Thomas Piketty',

  // Philosophy, Political Theory & Sociology
  'rawls': 'John Rawls',
  'johnrawls': 'John Rawls',
  'habermas': 'Jürgen Habermas',
  'jurgenhabermas': 'Jürgen Habermas',
  'arendt': 'Hannah Arendt',
  'hannaharendt': 'Hannah Arendt',
  'weber': 'Max Weber',
  'maxweber': 'Max Weber',
  'durkheim': 'Émile Durkheim',
  'emiledurkheim': 'Émile Durkheim',
  'marxengels': 'Karl Marx & Friedrich Engels',
  'marx': 'Karl Marx',
  'karlmarx': 'Karl Marx',
  'bourdieu': 'Pierre Bourdieu',
  'pierrebourdieu': 'Pierre Bourdieu',
  'giddens': 'Anthony Giddens',
  'anthonygiddens': 'Anthony Giddens',
  'locke': 'John Locke',
  'johnlocke': 'John Locke',
  'hobbes': 'Thomas Hobbes',
  'thomashobbes': 'Thomas Hobbes',
  'machiavelli': 'Niccolò Machiavelli',
  'niccolomachiavelli': 'Niccolò Machiavelli',
  'rousseau': 'Jean-Jacques Rousseau',
  'jeanjacquesrousseau': 'Jean-Jacques Rousseau',
  'plato': 'Plato',
  'aristotle': 'Aristotle',
  'kant': 'Immanuel Kant',
  'immanuelkant': 'Immanuel Kant',
  'nietzsche': 'Friedrich Nietzsche',
  'friedrichnietzsche': 'Friedrich Nietzsche',
  'descartes': 'René Descartes',
  'renedescartes': 'René Descartes',
  'hume': 'David Hume',
  'davidhume': 'David Hume',
  'chomsky': 'Noam Chomsky',
  'noamchomsky': 'Noam Chomsky',
  'geertz': 'Clifford Geertz',
  'goffman': 'Erving Goffman',

  // Psychology, Psychiatry & Neuroscience (Extended)
  'freud': 'Sigmund Freud',
  'sigmundfreud': 'Sigmund Freud',
  'jung': 'Carl Jung',
  'carljung': 'Carl Jung',
  'piaget': 'Jean Piaget',
  'jeanpiaget': 'Jean Piaget',
  'vygotsky': 'Lev Vygotsky',
  'levvygotsky': 'Lev Vygotsky',
  'skinner': 'B. F. Skinner',
  'bfskinner': 'B. F. Skinner',
  'bandura': 'Albert Bandura',
  'albertbandura': 'Albert Bandura',
  'kahnemantversky': 'Daniel Kahneman & Amos Tversky',
  'kahneman': 'Daniel Kahneman',
  'danielkahneman': 'Daniel Kahneman',
  'tversky': 'Amos Tversky',
  'sapolsky': 'Robert M. Sapolsky',
  'robertsapolsky': 'Robert M. Sapolsky',
  'bearconnorsparadiso': 'Mark F. Bear, Barry W. Connors & Michael A. Paradiso',
  'bear': 'Mark F. Bear',
  'carlson': 'Neil R. Carlson',
  'festinger': 'Leon Festinger',
  'milgram': 'Stanley Milgram',
  'zimbardo': 'Philip Zimbardo',
  'seligman': 'Martin E. P. Seligman',

  // Medicine, Anatomy & Health Sciences
  'guytonhall': 'Arthur C. Guyton & John E. Hall',
  'hallguyton': 'Arthur C. Guyton & John E. Hall',
  'guyton': 'Arthur C. Guyton',
  'robbins': 'Vinay Kumar, Abul K. Abbas & Jon C. Aster',
  'robbinsandcotran': 'Vinay Kumar, Abul K. Abbas & Jon C. Aster',
  'faucietal': 'Anthony S. Fauci et al.',
  'bickley': 'Lynn S. Bickley',
  'katzung': 'Bertram G. Katzung',
  'netter': 'Frank H. Netter',
  'franknetter': 'Frank H. Netter',
  'moore': 'Keith L. Moore',
  'costanzo': 'Linda S. Costanzo',

  // Law, Jurisprudence & Research Methods
  'blackstone': 'William Blackstone',
  'posner': 'Richard A. Posner',
  'richardposner': 'Richard A. Posner',
  'dworkin': 'Ronald Dworkin',
  'ronalddworkin': 'Ronald Dworkin',
  'scalia': 'Antonin Scalia',
  'antoninscalia': 'Antonin Scalia',
  'hart': 'H. L. A. Hart',
  'trochim': 'William M. K. Trochim',
  'neuman': 'W. Lawrence Neuman',
  'babbie': 'Earl Babbie',
  'gravetterwallnau': 'Frederick J. Gravetter & Larry B. Wallnau'
};

/**
 * Inverts an author name formatted as "Surname, Firstname [M.]" into "Firstname [M.] Surname".
 * Handles multiple authors joined by "&" or "and".
 */
export function invertLastNameFirst(authorStr: string): string {
  if (!authorStr || !authorStr.includes(',')) return authorStr;

  // Split multiple authors separated by "&" or "and" (while respecting semicolons)
  const segments = authorStr.split(/\s*(?:&|\band\b|;)\s*/);
  if (segments.length > 1) {
    const invertedParts = segments.map(seg => invertSingleAuthor(seg.trim())).filter(p => p.length > 0);
    return invertedParts.join(' & ');
  }

  return invertSingleAuthor(authorStr);
}

function invertSingleAuthor(singleStr: string): string {
  const commaIdx = singleStr.indexOf(',');
  if (commaIdx === -1) return singleStr;

  const lastName = singleStr.slice(0, commaIdx).trim();
  let firstPart = singleStr.slice(commaIdx + 1).trim();

  // If there's "et al.", extract it
  let hasEtAl = false;
  if (/\bet\s+al\.?/i.test(singleStr)) {
    hasEtAl = true;
    firstPart = firstPart.replace(/\bet\s+al\.?/i, '').trim();
  }

  // Ensure firstPart has at least one letter and lastName has at least one letter
  if (lastName.length > 0 && firstPart.length > 0 && /^[A-Z]/i.test(lastName) && /^[A-Z]/i.test(firstPart)) {
    const combined = `${firstPart} ${lastName}`.replace(/\s+/g, ' ').trim();
    return hasEtAl ? `${combined} et al.` : combined;
  }

  return singleStr;
}

/**
 * Mines raw syllabus text to find a full name corresponding to a surname or initials.
 * Example: if author is "Butler, J." and the text mentions "Judith Butler", returns "Judith Butler".
 */
export function mineFullNameFromDocumentText(surnameOrInitial: string, documentText: string): string | null {
  if (!surnameOrInitial || !documentText || documentText.length < 50) return null;

  const cleanedTarget = surnameOrInitial.replace(/^(?:by|author:?|reading:?)\s*/i, '').trim();
  
  // Extract multi-token surname prefixes like van der, von, de la, de, du, le, la, etc.
  const prefixMatch = cleanedTarget.match(/^(?:(?:van\s+der|van\s+de|van\s+den|van|von|de\s+la|de\s+le|de|da|di|del|dos|du|d'|le|la|st\.)\s+)?/i);
  const prefixStr = prefixMatch && prefixMatch[0] ? prefixMatch[0].trim() : '';

  const withoutPrefix = prefixStr ? cleanedTarget.slice(prefixMatch![0].length).trim() : cleanedTarget;
  const lastNameMatch = withoutPrefix.match(/([A-Z][a-zA-Z'–-]+)(?:\s*,|\s+et\s+al|\s*$)/i);
  if (!lastNameMatch) return null;

  const rootLastName = lastNameMatch[1];
  if (rootLastName.length < 3 || /^(?:the|and|for|with|from|week|unit|page|module)$/i.test(rootLastName)) {
    return null;
  }

  const escapedRoot = rootLastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const counts: Record<string, number> = {};
  const excludedWords = /^(?:University|Department|Graduate|School|College|Course|Program|Syllabus|Associate|Assistant|Professor|Doctor|Primary|Instructor|Faculty|Chapter|Section|Lecture|Required|Spring|Fall|Summer|Winter|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Assignment|Deliverable|Evaluation|Overview|Introduction|Review|Reading|Paper|Project)\b/i;

  // Pattern 1: Natural order "Firstname [Middle] Lastname" (e.g. "Judith Butler", "Simone de Beauvoir", "Johannes D. van der Waals")
  const naturalRegex = new RegExp(`\\b([A-Z][a-z]{2,15}(?:\\s+[A-Z]\\.?)?)\\s+((?:(?:van\\s+der|van\\s+de|van\\s+den|van|von|de\s+la|de\\s+le|de|da|di|del|dos|du|d'|le|la|st\\.)\\s+)?${escapedRoot})\\b`, 'gi');
  let match: RegExpExecArray | null;

  while ((match = naturalRegex.exec(documentText)) !== null) {
    const candidate = `${match[1].trim()} ${match[2].trim()}`;
    if (!excludedWords.test(match[1].trim())) {
      counts[candidate] = (counts[candidate] || 0) + 1;
    }
  }

  // Pattern 2: Bibliographic inverted order "Lastname, Firstname [M.]" in references (e.g. "Butler, Judith", "Kowalski, Janusz A.", "van der Waals, Johannes D.")
  const biblioRegex = new RegExp(`\\b((?:(?:van\\s+der|van\\s+de|van\\s+den|van|von|de\\s+la|de\\s+le|de|da|di|del|dos|du|d'|le|la|st\\.)\\s+)?${escapedRoot})\\s*,\\s*([A-Z][a-z]{2,15}(?:\\s+[A-Z]\\.?)?)(?=[\\s,;()]|$)`, 'gi');
  while ((match = biblioRegex.exec(documentText)) !== null) {
    const matchedSurname = match[1].trim();
    const firstName = match[2].trim();
    if (!excludedWords.test(firstName) && !/^(?:Vol|Ed|Pp|Ch)\b/i.test(firstName)) {
      const candidate = `${firstName} ${matchedSurname}`;
      counts[candidate] = (counts[candidate] || 0) + 3; // higher confidence from references list
    }
  }

  // Pattern 3: "by [Dr.] Firstname Lastname" (e.g. "by Dr. Helena Rostova")
  const byRegex = new RegExp(`\\bby\\s+(?:Dr\\.?\\s+)?([A-Z][a-z]{2,15}(?:\\s+[A-Z]\\.?)?)\\s+((?:(?:van\\s+der|van\\s+de|van\\s+den|van|von|de\\s+la|de\\s+le|de|da|di|del|dos|du|d'|le|la|st\\.)\\s+)?${escapedRoot})\\b`, 'gi');
  while ((match = byRegex.exec(documentText)) !== null) {
    const candidate = `${match[1].trim()} ${match[2].trim()}`;
    if (!excludedWords.test(match[1].trim())) {
      counts[candidate] = (counts[candidate] || 0) + 4;
    }
  }

  const entries = Object.entries(counts);
  if (entries.length > 0) {
    entries.sort((a, b) => b[1] - a[1]);
    const bestCandidate = entries[0][0];
    if (/\bet\s+al/i.test(surnameOrInitial)) {
      return `${bestCandidate} et al.`;
    }
    return bestCandidate;
  }

  return null;
}

/**
 * Resolves a candidate author string into a complete, human-readable full name.
 *
 * @param candidateAuthor The raw author citation (e.g. "Huyen", "Butler, J.", "Creswell, J.W., & Creswell. J. D.")
 * @param rawTextContext Optional syllabus document text to enable contextual name mining.
 */
export function resolveFullAuthorName(
  candidateAuthor: string | null | undefined,
  rawTextContext?: string | null
): string | null {
  if (!candidateAuthor) return null;

  let cleaned = candidateAuthor
    .replace(/^[:;•·\-–—\s,.]+|[:;•·\-–—\s,.]+$/g, '')
    .replace(/^(?:author:?|by:?|reading:?)\s*/i, '')
    .trim();

  if (!cleaned || cleaned.length < 2) return null;

  // Filter out invalid placeholder tokens
  if (/^(?:required|watch|read|reading|readings|author|null|undefined|none|see brightspace|tbd|various)$/i.test(cleaned)) {
    return null;
  }

  // Strip trailing citation parentheticals (e.g. "(Ch. 1-3)", "(Vol. 1)", "(Sec. 1-4)", "(Critique)", "(1979)")
  // and trailing chapter/section references
  cleaned = cleaned
    .replace(/\s*\([^)]*(?:ch(?:apter)?s?|sec(?:tion)?s?|vol(?:ume)?|clrs|cap[íi]tulo|kapitel|pp?\.?|pages?|\d{4}|critique|genealogy|commentaries|megatron|qlora|lora)[^)]*\)\s*$/i, '')
    .replace(/\s*\(\s*\d{1,4}\s*(?:-\s*\d{1,4})?\s*\)\s*$/i, '')
    .replace(/\s*(?:chapters?|chs?\.?|chps?\.?|chap\.?|sections?|sec\.?|cap[íi]tulos?|cap\.?|kapitels?|kap\.?)\s*[:\-–—.]*\s*[\d\s&,\-–\+toyund]+$/i, '')
    .replace(/\s*(?:pp?\.?|pages?|seiten?|p[áa]ginas?)\s*[:\-–—.]*\s*[\d\s&,\-–\+to]+$/i, '')
    .replace(/\s*\([^)]+\)\s*$/i, '')
    .trim();

  // 1. Direct match in canonical registry using normalized key
  const rawNormKey = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normKey = cleaned.toLowerCase()
    .replace(/\b(?:and|und|et|y)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

  if (CANONICAL_SCHOLAR_REGISTRY[rawNormKey]) {
    return CANONICAL_SCHOLAR_REGISTRY[rawNormKey];
  }
  if (CANONICAL_SCHOLAR_REGISTRY[normKey]) {
    return CANONICAL_SCHOLAR_REGISTRY[normKey];
  }

  // 1b. Resilient domain pattern shortcuts for canonical academic scholars
  if (normKey.includes('creswell')) {
    return 'John W. Creswell & J. David Creswell';
  }
  if (normKey.includes('grothmarnat') || (normKey.includes('groth') && normKey.includes('marnat')) || normKey === 'marnat') {
    return 'Gary Groth-Marnat';
  }
  if (normKey.includes('lezak')) {
    return normKey.includes('etal') ? 'Muriel D. Lezak et al.' : 'Muriel D. Lezak';
  }
  if (normKey.includes('cummings') && normKey.includes('mega')) {
    return 'Jeffrey L. Cummings & Michael S. Mega';
  }
  if (normKey.includes('stuss') && normKey.includes('benson')) {
    return 'Donald T. Stuss & D. Frank Benson';
  }
  if (normKey.includes('yalom') && normKey.includes('leszcz')) {
    return 'Irvin D. Yalom & Molyn Leszcz';
  }
  if (normKey.includes('wada') && normKey.includes('fellner')) {
    return 'Kaori Wada & Karlee D. Fellner';
  }
  if (normKey.includes('maddux') || normKey.includes('winstead')) {
    return 'James E. Maddux & Barbara A. Winstead';
  }
  if (normKey.includes('preston') || normKey.includes('talaga')) {
    return 'John D. Preston, John H. O’Neal & Mary C. Talaga';
  }
  if (normKey.includes('carlson') && !normKey.includes('carlsonw')) {
    return 'Neil R. Carlson';
  }
  if (normKey.includes('dsm') || (normKey.includes('american') && normKey.includes('psychiatric'))) {
    return 'American Psychiatric Association';
  }
  if (normKey === 'who' || normKey === 'whoicd' || (normKey.includes('who') && normKey.includes('icd')) || (normKey.includes('world') && normKey.includes('health') && normKey.includes('organization'))) {
    return 'World Health Organization';
  }
  if (normKey.includes('foucault')) {
    return 'Michel Foucault';
  }
  if (normKey.includes('butler') && !normKey.includes('brendan')) {
    return 'Judith Butler';
  }
  if (normKey.includes('kleppmann')) {
    return 'Martin Kleppmann';
  }
  if (normKey.includes('huyen')) {
    return 'Chip Huyen';
  }
  if (normKey.includes('lorde')) {
    return 'Audre Lorde';
  }
  if (normKey.includes('lugones')) {
    return 'María Lugones';
  }
  if (normKey.includes('mowlaboccus')) {
    return 'Sharif Mowlaboccus';
  }
  if (normKey.includes('crimp')) {
    return 'Douglas Crimp';
  }
  if (normKey.includes('gehart')) {
    return 'Diane R. Gehart';
  }
  if (normKey.includes('rajbhandari')) {
    return 'Samyam Rajbhandari et al.';
  }
  if (normKey.includes('shoeybi')) {
    return 'Mohammad Shoeybi et al.';
  }
  if (normKey.includes('dettmers')) {
    return 'Tim Dettmers et al.';
  }

  // 2. Check individual authors if multi-author string (e.g. "Huyen (Ch. 1–3); Kleppmann (Ch. 1)")
  if (/\bet\s+al\.?$/i.test(cleaned) && !cleaned.includes('&')) {
    const etAlStem = cleaned.replace(/\bet\s+al\.?$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const etAlKey = `${etAlStem}etal`;
    if (CANONICAL_SCHOLAR_REGISTRY[etAlKey]) {
      return CANONICAL_SCHOLAR_REGISTRY[etAlKey];
    }
    if (CANONICAL_SCHOLAR_REGISTRY[etAlStem]) {
      return `${CANONICAL_SCHOLAR_REGISTRY[etAlStem]} et al.`;
    }
  }

  // Check compound author pair like "Cummings & Mega" or "Yalom & Leszcz"
  if (cleaned.includes('&') || cleaned.toLowerCase().includes(' and ')) {
    const pairParts = cleaned.split(/\s*(?:&|\band\b)\s*/);
    const resolvedParts = pairParts.map(p => {
      const partKey = p.toLowerCase().replace(/[^a-z0-9]/g, '');
      return CANONICAL_SCHOLAR_REGISTRY[partKey] || invertLastNameFirst(p.trim());
    });
    const combined = resolvedParts.join(' & ');
    const combinedKey = combined.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (CANONICAL_SCHOLAR_REGISTRY[combinedKey]) {
      return CANONICAL_SCHOLAR_REGISTRY[combinedKey];
    }
    if (resolvedParts.some(p => p.length > 2)) {
      return combined;
    }
  }

  // 3. Document-context full name mining if raw document text is available
  if (rawTextContext && rawTextContext.length > 50) {
    const mined = mineFullNameFromDocumentText(cleaned, rawTextContext);
    if (mined) {
      return mined;
    }
  }

  // 4. Invert "Last, First" format (e.g. "Foucault, Michel" -> "Michel Foucault")
  if (cleaned.includes(',')) {
    const inverted = invertLastNameFirst(cleaned);
    const invertedKey = inverted.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (CANONICAL_SCHOLAR_REGISTRY[invertedKey]) {
      return CANONICAL_SCHOLAR_REGISTRY[invertedKey];
    }
    if (inverted !== cleaned) {
      return inverted;
    }
  }

  // 5. Fallback: return cleaned string with proper academic punctuation
  if (/\bet\s+al\.?$/i.test(cleaned)) {
    return cleaned.replace(/\bet\s+al\.?$/i, 'et al.').trim();
  }
  return cleaned;
}

/**
 * Enriches an array of reading objects with resolved full author names.
 */
export function enrichAuthorsInReadings<T extends { title?: string; authorName?: string | null; author?: string | null; authors?: string | null }>(
  readings: T[],
  rawText?: string | null
): T[] {
  return readings.map(r => {
    let author = r.authorName || r.author || r.authors;
    if (!author) {
      // Check title for citation like "Beck (Ch. 1–3)" or "Lezak et al. (Ch. 1–3)"
      const m = (r.title || '').match(/^([A-Z][a-zA-Z\s.&'–-]+?(?:\s+et\s+al\.?)?)\s*\(\s*(?:ch(?:apter)?s?\.?|pp?\.?|\d|[A-Za-z0-9])/i);
      if (m && m[1].trim().length > 1 && !/^(?:chapter|reading|week|module|unit|required|study|optional)/i.test(m[1].trim())) {
        author = m[1].trim();
      }
    }

    const resolved = resolveFullAuthorName(author, rawText);
    if (resolved && resolved !== r.authorName) {
      return { ...r, authorName: resolved };
    }
    return r;
  });
}

/**
 * Enriches an array of textbook objects with resolved full author names.
 */
export function enrichAuthorsInTextbooks<T extends { title: string; authorName?: string | null; author?: string | null; authors?: string | null }>(
  textbooks: T[],
  rawText?: string | null
): T[] {
  return textbooks.map(tb => {
    const rawAuthor = tb.authorName || tb.author || tb.authors;
    const resolved = resolveFullAuthorName(rawAuthor, rawText);
    if (resolved && resolved !== tb.authorName) {
      return { ...tb, authorName: resolved };
    }
    return tb;
  });
}
