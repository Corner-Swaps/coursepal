/**
 * Universal 100% Resilience Test Suite
 * Validates on-device multi-disciplinary scholar resolution, bidirectional reference mining,
 * multilingual academic syntax (Spanish, French, German), 2D horizontal grid matrix parsing,
 * and universal unstructured prose deliverables fallback.
 */

import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { resolveFullAuthorName, mineFullNameFromDocumentText } from '../src/utils/authorResolver';
import { AssignmentDTO } from '../src/types/models';

describe('Universal 100% Ingestion & Organization Resilience', () => {
  const parser = LocalSyllabusParser.shared;

  describe('Component 1: Multi-Disciplinary Scholar Resolution (250+ Canonical Scholars)', () => {
    test('resolves canonical Mathematics & Physics scholars', () => {
      expect(resolveFullAuthorName('Stewart (Ch. 1-3)')).toBe('James Stewart');
      expect(resolveFullAuthorName('Spivak (Ch. 5)')).toBe('Michael Spivak');
      expect(resolveFullAuthorName('Strang (Ch. 2)')).toBe('Gilbert Strang');
      expect(resolveFullAuthorName('Rudin (Ch. 4)')).toBe('Walter Rudin');
      expect(resolveFullAuthorName('Halliday & Resnick (Ch. 10)')).toBe('David Halliday & Robert Resnick');
      expect(resolveFullAuthorName('Griffiths (Ch. 6)')).toBe('David J. Griffiths');
      expect(resolveFullAuthorName('Feynman (Vol. 1, Ch. 3)')).toBe('Richard Feynman');
    });

    test('resolves canonical Life Sciences & Chemistry scholars', () => {
      expect(resolveFullAuthorName('Campbell & Reece (Ch. 1)')).toBe('Neil A. Campbell & Jane B. Reece');
      expect(resolveFullAuthorName('Alberts (Ch. 8)')).toBe('Bruce Alberts');
      expect(resolveFullAuthorName('Lehninger (Ch. 3)')).toBe('Albert L. Lehninger');
      expect(resolveFullAuthorName('Zumdahl (Ch. 4)')).toBe('Steven S. Zumdahl');
      expect(resolveFullAuthorName('Clayden (Ch. 12)')).toBe('Jonathan Clayden');
      expect(resolveFullAuthorName('Atkins (Ch. 7)')).toBe('Peter Atkins');
    });

    test('resolves canonical Computer Science, AI & Engineering scholars', () => {
      expect(resolveFullAuthorName('Cormen (CLRS Ch. 4)')).toBe('Thomas H. Cormen');
      expect(resolveFullAuthorName('Russell & Norvig (Ch. 3)')).toBe('Stuart Russell & Peter Norvig');
      expect(resolveFullAuthorName('Knuth (Vol. 1)')).toBe('Donald Knuth');
      expect(resolveFullAuthorName('Tanenbaum (Ch. 2)')).toBe('Andrew S. Tanenbaum');
      expect(resolveFullAuthorName('Hennessy & Patterson (Ch. 5)')).toBe('John L. Hennessy & David A. Patterson');
      expect(resolveFullAuthorName('Goodfellow (Ch. 6)')).toBe('Ian Goodfellow');
      expect(resolveFullAuthorName('Bishop (Ch. 1)')).toBe('Christopher M. Bishop');
      expect(resolveFullAuthorName('Jurafsky & Martin (Ch. 2)')).toBe('Daniel Jurafsky & James H. Martin');
    });

    test('resolves canonical Economics, Business & Finance scholars', () => {
      expect(resolveFullAuthorName('Mankiw (Ch. 1-4)')).toBe('N. Gregory Mankiw');
      expect(resolveFullAuthorName('Krugman & Wells (Ch. 5)')).toBe('Paul Krugman & Robin Wells');
      expect(resolveFullAuthorName('Porter (Ch. 2)')).toBe('Michael E. Porter');
      expect(resolveFullAuthorName('Damodaran (Ch. 10)')).toBe('Aswath Damodaran');
      expect(resolveFullAuthorName('Brealey, Myers & Allen (Ch. 3)')).toBe('Richard A. Brealey & Stewart C. Myers');
      expect(resolveFullAuthorName('Varian (Ch. 8)')).toBe('Hal R. Varian');
    });

    test('resolves canonical Philosophy, Sociology & Political Theory scholars', () => {
      expect(resolveFullAuthorName('Rawls (Sec. 1-4)')).toBe('John Rawls');
      expect(resolveFullAuthorName('Weber (Ch. 1)')).toBe('Max Weber');
      expect(resolveFullAuthorName('Durkheim (Ch. 2)')).toBe('Émile Durkheim');
      expect(resolveFullAuthorName('Foucault (Ch. 3)')).toBe('Michel Foucault');
      expect(resolveFullAuthorName('Habermas (Ch. 5)')).toBe('Jürgen Habermas');
      expect(resolveFullAuthorName('Kant (Critique)')).toBe('Immanuel Kant');
      expect(resolveFullAuthorName('Nietzsche (Genealogy)')).toBe('Friedrich Nietzsche');
    });

    test('resolves canonical Medicine, Psychology, & Law scholars', () => {
      expect(resolveFullAuthorName('Guyton & Hall (Ch. 15)')).toBe('Arthur C. Guyton & John E. Hall');
      expect(resolveFullAuthorName('Kandel (Ch. 12)')).toBe('Eric R. Kandel');
      expect(resolveFullAuthorName('Freud (Ch. 1)')).toBe('Sigmund Freud');
      expect(resolveFullAuthorName('Piaget (Ch. 4)')).toBe('Jean Piaget');
      expect(resolveFullAuthorName('Vygotsky (Ch. 6)')).toBe('Lev Vygotsky');
      expect(resolveFullAuthorName('Kahneman & Tversky (1979)')).toBe('Daniel Kahneman & Amos Tversky');
      expect(resolveFullAuthorName('Beck (Ch. 1-3)')).toBe('Judith S. Beck');
      expect(resolveFullAuthorName('Linehan (Ch. 5)')).toBe('Marsha M. Linehan');
      expect(resolveFullAuthorName('Blackstone (Commentaries)')).toBe('William Blackstone');
      expect(resolveFullAuthorName('Dworkin (Ch. 2)')).toBe('Ronald Dworkin');
    });
  });

  describe('Component 1 (Cont.): Bidirectional Bibliographic Reference Mining', () => {
    test('mines inverted bibliography reference entries: LastName, FirstName [Middle] (Year)', () => {
      const documentText = `
        Course Readings:
        Week 1: Kowalski (2021)
        
        References:
        Kowalski, Janusz A. (2021). Deep Learning Systems and Architectures. MIT Press.
        Al-Mansoor, Tariq H. (2023). Quantum Information Theory. Cambridge.
      `;

      expect(mineFullNameFromDocumentText('Kowalski', documentText)).toBe('Janusz A. Kowalski');
      expect(mineFullNameFromDocumentText('Al-Mansoor', documentText)).toBe('Tariq H. Al-Mansoor');
    });

    test('mines multi-token European surnames with prefixes (van der, von, de)', () => {
      const documentText = `
        Selected Bibliography:
        van der Waals, Johannes D. (1873). On the Continuity of the Gaseous and Liquid States.
        von Neumann, John (1944). Theory of Games and Economic Behavior.
        de Beauvoir, Simone (1949). The Second Sex.
      `;

      expect(mineFullNameFromDocumentText('van der Waals', documentText)).toBe('Johannes D. van der Waals');
      expect(mineFullNameFromDocumentText('von Neumann', documentText)).toBe('John von Neumann');
      expect(mineFullNameFromDocumentText('de Beauvoir', documentText)).toBe('Simone de Beauvoir');
    });

    test('mines "by Dr. First Last" prose mentions', () => {
      const documentText = `
        Textbook Information:
        The primary text for this seminar is Advanced Neurobiology by Dr. Helena Rostova.
      `;

      expect(mineFullNameFromDocumentText('Rostova', documentText)).toBe('Helena Rostova');
    });
  });

  describe('Component 2: Multilingual Academic Syntax Engine', () => {
    test('parses a Spanish syllabus cleanly with localized schedule, chapters, pages, and points', () => {
      const spanishSyllabus = `
        BIOL 201: Biología Molecular y Celular
        Semestre de Primavera 2025
        
        Evaluación y Calificación:
        - Tarea 1: Ensayo de Enzimas (15%) - Fecha de entrega: 15 de marzo de 2025
        - Examen Parcial (30 puntos) - 10 de abril de 2025
        - Proyecto Final de Investigación (55%) - 20 de mayo de 2025
        
        Calendario de Sesiones:
        Semana 1 - 15 de marzo de 2025 - Estructura de la Membrana
        Campbell y Reece Capítulo 1-3
        
        Semana 2 - 22 de marzo de 2025 - Metabolismo y Energía
        Alberts Cap. 4 Páginas 45-90
        
        Semana 3 - 29 de marzo de 2025 - Genética y Replicación
        Lehninger Capítulos 5 y 6
      `;

      const course = parser.parseText(spanishSyllabus);
      if (!course) throw new Error('Expected course to be parsed');
      const weeks = course.weeks ?? [];
      const assignments = course.assignments ?? [];

      expect(course.courseCode).toBe('BIOL 201');
      expect(assignments.length).toBeGreaterThanOrEqual(3);

      const assign1 = assignments.find((a: AssignmentDTO) => a.title.toLowerCase().includes('ensayo') || a.title.toLowerCase().includes('tarea 1'));
      expect(assign1).toBeDefined();
      expect(assign1?.dueDate).toBe('2025-03-15');

      const assign2 = assignments.find((a: AssignmentDTO) => a.title.toLowerCase().includes('examen parcial'));
      expect(assign2).toBeDefined();
      expect(assign2?.pointsPossible).toBe('30 Points');

      expect(weeks.length).toBe(3);
      expect(weeks[0]?.weekNumber).toBe(1);
      expect(weeks[0]?.readings.length).toBeGreaterThanOrEqual(1);
      expect(weeks[0]?.readings[0]?.authorName).toBe('Neil A. Campbell & Jane B. Reece');
      expect(weeks[1]?.readings[0]?.authorName).toBe('Bruce Alberts');
      expect(weeks[2]?.readings[0]?.authorName).toBe('Albert L. Lehninger');
    });

    test('parses a French syllabus cleanly with localized week markers, chapters, and dates', () => {
      const frenchSyllabus = `
        LITT 305: Littérature Comparée et Théorie Critique
        Session d'Hiver 2025
        
        Modalités d'Évaluation:
        - Devoir 1: Commentaire de Texte (20%) - 15 février 2025
        - Examen Final (40%) - 20 avril 2025
        
        Programme Hebdomadaire:
        Semaine 1 - 15 janvier 2025 - Introduction à la Théorie
        Foucault Chapitre 1 Pages 10-45
        
        Semaine 2 - 22 janvier 2025 - Analyse Sociologique
        Bourdieu Chapitre 2
      `;

      const course = parser.parseText(frenchSyllabus);
      if (!course) throw new Error('Expected course to be parsed');
      const weeks = course.weeks ?? [];
      const assignments = course.assignments ?? [];

      expect(course.courseCode).toBe('LITT 305');
      expect(assignments.length).toBeGreaterThanOrEqual(2);

      const devoir1 = assignments.find((a: AssignmentDTO) => a.title.toLowerCase().includes('devoir 1') || a.title.toLowerCase().includes('commentaire'));
      expect(devoir1).toBeDefined();
      expect(devoir1?.dueDate).toBe('2025-02-15');

      expect(weeks.length).toBe(2);
      expect(weeks[0]?.readings.length).toBeGreaterThanOrEqual(1);
      expect(weeks[0]?.readings[0]?.authorName).toBe('Michel Foucault');
      expect(weeks[1]?.readings[0]?.authorName).toBe('Pierre Bourdieu');
    });

    test('parses a German syllabus cleanly with Woche, Kapitel, Seiten, and Punkte', () => {
      const germanSyllabus = `
        INF 102: Theoretische Informatik
        Sommersemester 2025
        
        Leistungsnachweis und Prüfungsleistungen:
        - Übungsblatt 1 (10 Punkte) - 20. April 2025
        - Klausur (90 Punkte) - 15. Juli 2025
        
        Vorlesungsplan:
        Woche 1 - 10. April 2025 - Formale Sprachen und Automaten
        Sipser Kapitel 1 Seiten 12-48
        
        Woche 2 - 17. April 2025 - Berechenbarkeit
        Cormen Kapitel 3 Seiten 50-80
      `;

      const course = parser.parseText(germanSyllabus);
      if (!course) throw new Error('Expected course to be parsed');
      const weeks = course.weeks ?? [];
      const assignments = course.assignments ?? [];

      expect(course.courseCode).toBe('INF 102');
      expect(assignments.length).toBeGreaterThanOrEqual(2);

      const klausur = assignments.find((a: AssignmentDTO) => a.title.toLowerCase().includes('klausur'));
      expect(klausur).toBeDefined();
      expect(klausur?.pointsPossible).toBe('90 Points');
      expect(klausur?.dueDate).toBe('2025-07-15');

      expect(weeks.length).toBe(2);
      expect(weeks[0]?.readings[0]?.authorName).toBe('Michael Sipser');
      expect(weeks[1]?.readings[0]?.authorName).toBe('Thomas H. Cormen');
    });
  });

  describe('Component 3: Horizontal 2D Grid / Matrix Schedule Parsing', () => {
    test('transposes horizontal calendar week column headers cleanly into structured weeks', () => {
      const gridSyllabus = `
        DATA 450: Machine Learning Engineering
        Term: Spring 2025
        
        Course Evaluation:
        - Homework Assignments (40%)
        - Midterm Exam (30%)
        - Final Project (30%)
        
        Course Schedule Matrix:
        | Week / Dimension | Week 1 | Week 2 | Week 3 |
        | Dates | Jan 15, 2025 | Jan 22, 2025 | Jan 29, 2025 |
        | Lecture Topic | Supervised Learning Fundamentals | Deep Neural Architectures | Attention Mechanisms |
        | Required Readings | Russell & Norvig Ch. 3 | Goodfellow Ch. 6 | Jurafsky & Martin Ch. 10 |
        | Deliverables | Homework 1 | Quiz 1 | Midterm Project Proposal |
      `;

      const course = parser.parseText(gridSyllabus);
      if (!course) throw new Error('Expected course to be parsed');
      const weeks = course.weeks ?? [];

      expect(weeks.length).toBe(3);

      expect(weeks[0]?.weekNumber).toBe(1);
      expect(weeks[0]?.startDate).toBe('2025-01-15');
      expect(weeks[0]?.theme).toBe('Supervised Learning Fundamentals');
      expect(weeks[0]?.readings.length).toBe(1);
      expect(weeks[0]?.readings[0]?.authorName).toBe('Stuart Russell & Peter Norvig');

      expect(weeks[1]?.weekNumber).toBe(2);
      expect(weeks[1]?.startDate).toBe('2025-01-22');
      expect(weeks[1]?.theme).toBe('Deep Neural Architectures');
      expect(weeks[1]?.readings[0]?.authorName).toBe('Ian Goodfellow');

      expect(weeks[2]?.weekNumber).toBe(3);
      expect(weeks[2]?.startDate).toBe('2025-01-29');
      expect(weeks[2]?.theme).toBe('Attention Mechanisms');
      expect(weeks[2]?.readings[0]?.authorName).toBe('Daniel Jurafsky & James H. Martin');
    });
  });

  describe('Component 3 (Cont.): Universal Unstructured Deliverables Fallback', () => {
    test('extracts deliverables from completely unformatted prose without tables', () => {
      const unstructuredProseSyllabus = `
        HIST 420: The Cold War and International Order
        Spring 2025
        Professor: Dr. Arthur Pendelton
        
        Welcome to History 420. Throughout this term, students are expected to complete several critical milestones.
        
        First, the Historiographical Essay is due on February 14, 2025, worth 25% of your final grade.
        Second, a Midterm Examination will take place on March 20, 2025, worth 50 points.
        Third, the Primary Source Research Paper must be submitted by April 25, 2025 (40%).
        Finally, students must complete the Oral Presentation by May 5, 2025 (20 points).
        
        Course Policies:
        Please review academic integrity regulations carefully.
      `;

      const course = parser.parseText(unstructuredProseSyllabus);
      if (!course) throw new Error('Expected course to be parsed');
      const assignments = course.assignments ?? [];

      expect(course.courseCode).toBe('HIST 420');
      expect(assignments.length).toBe(4);

      const essay = assignments.find((a: AssignmentDTO) => a.title.toLowerCase().includes('historiographical essay'));
      expect(essay).toBeDefined();
      expect(essay?.dueDate).toBe('2025-02-14');
      expect(essay?.weightPercentage).toBe('25%');

      const midterm = assignments.find((a: AssignmentDTO) => a.title.toLowerCase().includes('midterm examination'));
      expect(midterm).toBeDefined();
      expect(midterm?.dueDate).toBe('2025-03-20');
      expect(midterm?.pointsPossible).toBe('50 Points');

      const research = assignments.find((a: AssignmentDTO) => a.title.toLowerCase().includes('primary source research'));
      expect(research).toBeDefined();
      expect(research?.dueDate).toBe('2025-04-25');
      expect(research?.weightPercentage).toBe('40%');

      const pres = assignments.find((a: AssignmentDTO) => a.title.toLowerCase().includes('oral presentation'));
      expect(pres).toBeDefined();
      expect(pres?.dueDate).toBe('2025-05-05');
      expect(pres?.pointsPossible).toBe('20 Points');
    });
  });
});
