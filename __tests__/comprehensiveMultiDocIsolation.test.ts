import { Course, Reading, Assignment, VaultDocument } from '../src/types/models';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { isItemForDocument } from '../src/utils/readingDisplayHelper';

describe('Comprehensive Multi-Document Ingestion & Isolation', () => {
  const createReading = (partial: Partial<Reading>): Reading => ({
    id: 'r-default',
    title: 'Reading',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    summaryText: '',
    keyTakeawaysText: '',
    estimatedTimeText: '',
    isFavorite: false,
    isCompleted: false,
    isDeleted: false,
    weekNumber: 1,
    ...partial
  });

  it('isolates multiple documents in the same course and across different courses', () => {
    // Course 1
    const course1Id = 'c-cpc522';
    const doc1Id = 'vd-cpc522-syllabus';
    const doc2Id = 'vd-cpc522-schedule';

    const doc1: VaultDocument = {
      id: doc1Id,
      title: 'CPC 522 Fall 2026 Syllabus',
      category: 'Syllabi',
      fileSize: '1.2 MB',
      fileType: 'DOCX',
      courseCode: 'CPC 522',
      courseId: course1Id,
      uploadedAt: new Date()
    };

    const doc2: VaultDocument = {
      id: doc2Id,
      title: 'CPC 522 Fall 2026 Reading Schedule',
      category: 'Syllabi',
      fileSize: '1.4 MB',
      fileType: 'DOCX',
      courseCode: 'CPC 522',
      courseId: course1Id,
      uploadedAt: new Date()
    };

    const readingsDoc1: Reading[] = [
      createReading({
        id: 'r-1',
        title: 'Trauma Foundations & Theory',
        courseCode: 'CPC 522',
        courseId: course1Id,
        sourceDocumentId: doc1Id,
        sourceDocumentName: 'CPC_522_Fall_2026_Syllabus.docx',
        weekNumber: 1
      })
    ];

    const readingsDoc2: Reading[] = [
      createReading({
        id: 'r-2',
        title: 'Briere & Scott Ch. 1-2',
        courseCode: 'CPC 522',
        courseId: course1Id,
        sourceDocumentId: doc2Id,
        sourceDocumentName: 'CPC_522_Fall_2026_Reading_Schedule.docx',
        weekNumber: 1
      }),
      createReading({
        id: 'r-3',
        title: 'Courtois & Ford Ch. 1',
        courseCode: 'CPC 522',
        courseId: course1Id,
        sourceDocumentId: doc2Id,
        sourceDocumentName: 'CPC_522_Fall_2026_Reading_Schedule.docx',
        weekNumber: 1
      })
    ];

    const allVaultDocs = [doc1, doc2];
    const allReadings = [...readingsDoc1, ...readingsDoc2];

    // Document 1 readings must strictly contain r-1, and NEVER r-2 or r-3
    const doc1Items = allReadings.filter(r => isItemForDocument(r, doc1, allVaultDocs));
    expect(doc1Items.map(i => i.id)).toEqual(['r-1']);

    // Document 2 readings must strictly contain r-2 and r-3, and NEVER r-1
    const doc2Items = allReadings.filter(r => isItemForDocument(r, doc2, allVaultDocs));
    expect(doc2Items.map(i => i.id)).toEqual(['r-2', 'r-3']);
  });

  it('preserves existing readings from other documents during mergeReimportedCourse', () => {
    const courseId = 'c-cpc522';
    const doc1Id = 'vd-1';
    const doc2Id = 'vd-2';

    const existingCourse: Course = {
      id: courseId,
      courseCode: 'CPC 522',
      courseName: 'Psychology of Trauma',
      creatorId: 'user-1',
      courseDescription: '',
      instructorName: null,
      instructorEmail: null,
      officeHours: null,
      hexColor: '#3B82F6',
      termWeeks: 10,
      sharingCode: '123456',
      isDeleted: false,
      isFavorite: true,
      createdAt: new Date(),
      weeks: [],
      assignments: [],
      syllabusDocs: [],
      textbooks: []
    };

    const doc1: VaultDocument = {
      id: doc1Id,
      title: 'CPC 522 Syllabus',
      category: 'Syllabi',
      fileSize: '1.2 MB',
      fileType: 'DOCX',
      courseCode: 'CPC 522',
      courseId,
      uploadedAt: new Date()
    };

    const doc2: VaultDocument = {
      id: doc2Id,
      title: 'CPC 522 Reading Schedule',
      category: 'Syllabi',
      fileSize: '1.3 MB',
      fileType: 'DOCX',
      courseCode: 'CPC 522',
      courseId,
      uploadedAt: new Date()
    };

    const readingFromDoc1 = createReading({
      id: 'r-doc1-1',
      title: 'Overview of Diagnostic Systems',
      courseCode: 'CPC 522',
      courseId,
      sourceDocumentId: doc1Id,
      sourceDocumentName: 'CPC 522 Syllabus.docx',
      isCompleted: false, // NOT completed yet!
      isDeleted: false,
      weekNumber: 1
    });

    const newReadingFromDoc2 = createReading({
      id: 'r-doc2-1',
      title: 'Briere & Scott Principles of Trauma Therapy',
      courseCode: 'CPC 522',
      courseId,
      sourceDocumentId: doc2Id,
      sourceDocumentName: 'CPC 522 Reading Schedule.docx',
      isCompleted: false,
      isDeleted: false,
      weekNumber: 2
    });

    // Reconcile Document 2 into course
    const result = SyllabusImportManager.shared.mergeReimportedCourse({
      targetCourseId: courseId,
      existingCourses: [existingCourse],
      existingReadings: [readingFromDoc1],
      existingAssignments: [],
      existingVaultDocs: [doc1],
      newCourseData: { ...existingCourse },
      newReadings: [newReadingFromDoc2],
      newAssignments: [],
      newVaultDoc: doc2
    });

    // Both documents must be in updatedVaultDocs
    expect(result.updatedVaultDocs.length).toBe(2);
    expect(result.updatedVaultDocs.some(d => d.id === doc1Id)).toBe(true);
    expect(result.updatedVaultDocs.some(d => d.id === doc2Id)).toBe(true);

    // Both readings must be in updatedReadings (readingFromDoc1 MUST NOT BE DROPPED)
    expect(result.updatedReadings.length).toBe(2);
    expect(result.updatedReadings.some(r => r.id === 'r-doc1-1')).toBe(true);
    expect(result.updatedReadings.some(r => r.id === 'r-doc2-1')).toBe(true);
  });

  it('cleanDocumentTitle preserves distinguishing titles and does not collapse files into identical 4-word names', () => {
    const { cleanDocumentTitle } = require('../src/utils/readingDisplayHelper');
    const f1 = 'CPC 522 Fall 2026 Reading Schedule.pdf';
    const f2 = 'CPC 522 Fall 2026 Syllabus.pdf';
    const t1 = cleanDocumentTitle(f1);
    const t2 = cleanDocumentTitle(f2);

    expect(t1).toBe('CPC 522 Fall 2026 Reading Schedule');
    expect(t2).toBe('CPC 522 Fall 2026 Syllabus');
    expect(t1).not.toBe(t2);
  });
});
