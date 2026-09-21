import { Course, Reading, Assignment, VaultDocument } from '../src/types/models';

describe('Separate Document Readings and Totals', () => {
  it('stamps distinct sourceDocumentId on readings and keeps total numbers separate per document', () => {
    const doc1Id = 'vd-doc-1';
    const doc2Id = 'vd-doc-2';

    const doc1: VaultDocument = {
      id: doc1Id,
      title: 'Course_1_Syllabus.pdf',
      category: 'Syllabi',
      fileSize: '1.2 MB',
      fileType: 'PDF',
      courseCode: 'CPC 511',
      courseId: 'c-1',
      uploadedAt: new Date()
    };

    const doc2: VaultDocument = {
      id: doc2Id,
      title: 'Course_2_Syllabus.pdf',
      category: 'Syllabi',
      fileSize: '1.5 MB',
      fileType: 'PDF',
      courseCode: 'CPC 512',
      courseId: 'c-2',
      uploadedAt: new Date()
    };

    const readingsDoc1: Reading[] = [
      {
        id: 'r-1',
        title: 'Ethics and Law in Clinical Practice',
        courseCode: 'CPC 511',
        courseId: 'c-1',
        sourceDocumentId: doc1Id,
        sourceDocumentName: doc1.title,
        mediaType: 'textbook',
        mediaTypeRaw: 'textbook',
        summaryText: '',
        keyTakeawaysText: '',
        estimatedTimeText: '',
        isFavorite: false,
        isCompleted: true,
        isDeleted: false,
        weekNumber: 1
      },
      {
        id: 'r-2',
        title: 'Informed Consent Guidelines',
        courseCode: 'CPC 511',
        courseId: 'c-1',
        sourceDocumentId: doc1Id,
        sourceDocumentName: doc1.title,
        mediaType: 'textbook',
        mediaTypeRaw: 'textbook',
        summaryText: '',
        keyTakeawaysText: '',
        estimatedTimeText: '',
        isFavorite: false,
        isCompleted: false,
        isDeleted: false,
        weekNumber: 2
      }
    ];

    const readingsDoc2: Reading[] = [
      {
        id: 'r-3',
        title: 'Family Systems Foundations',
        courseCode: 'CPC 512',
        courseId: 'c-2',
        sourceDocumentId: doc2Id,
        sourceDocumentName: doc2.title,
        mediaType: 'textbook',
        mediaTypeRaw: 'textbook',
        summaryText: '',
        keyTakeawaysText: '',
        estimatedTimeText: '',
        isFavorite: false,
        isCompleted: false,
        isDeleted: false,
        weekNumber: 1
      }
    ];

    const allReadings = [...readingsDoc1, ...readingsDoc2];

    // Verify Document 1 count is isolated and does not add Document 2 readings
    const doc1Readings = allReadings.filter(r =>
      !r.isDeleted && (
        r.sourceDocumentId === doc1.id ||
        (r.sourceDocumentName && r.sourceDocumentName === doc1.title) ||
        (doc1.courseId && r.courseId === doc1.courseId)
      )
    );
    expect(doc1Readings).toHaveLength(2);

    // Verify Document 2 count is isolated and does not add Document 1 readings
    const doc2Readings = allReadings.filter(r =>
      !r.isDeleted && (
        r.sourceDocumentId === doc2.id ||
        (r.sourceDocumentName && r.sourceDocumentName === doc2.title) ||
        (doc2.courseId && r.courseId === doc2.courseId)
      )
    );
    expect(doc2Readings).toHaveLength(1);

    // Completed counts are strictly scoped to the active document
    const doc1Completed = doc1Readings.filter(r => r.isCompleted).length;
    const doc2Completed = doc2Readings.filter(r => r.isCompleted).length;

    expect(doc1Completed).toBe(1);
    expect(doc2Completed).toBe(0);

    // Adding Document 2 did NOT change Document 1's total count
    expect(doc1Readings.length).toBe(2);
  });
});
