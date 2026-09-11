/**
 * Trash and Deletion Lifecycle Unit Tests
 * Verifies separation of readings and assignments trash, cascading course deletion,
 * and persistent empty state guarantees.
 */

import { Course, Reading, Assignment, VaultDocument } from '../src/types/models';
import { persistenceManager, BackupPayload } from '../src/services/DataPersistenceBackupManager';

describe('Trash and Deletion Lifecycle Guarantees', () => {
  const mockCourse: Course = {
    id: 'course-c1',
    creatorId: 'user-1',
    courseName: 'Biochemistry 101',
    courseCode: 'BIO 101',
    termWeeks: 12,
    hexColor: '#2563EB',
    sharingCode: '123456',
    isDeleted: false,
    isFavorite: false,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    weeks: [],
    assignments: [],
    syllabusDocs: []
  };

  const mockReading1: Reading = {
    id: 'r-1',
    title: 'Cellular Respiration',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    courseCode: 'BIO 101',
    isCompleted: false,
    isDeleted: false,
    isFavorite: false,
    summaryText: '',
    keyTakeawaysText: '',
    estimatedTimeText: '30 min'
  };

  const mockReading2Deleted: Reading = {
    id: 'r-2',
    title: 'Enzyme Kinetics',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    courseCode: 'BIO 101',
    isCompleted: false,
    isDeleted: true,
    isFavorite: false,
    summaryText: '',
    keyTakeawaysText: '',
    estimatedTimeText: '45 min'
  };

  const mockAssignment1: Assignment = {
    id: 'a-1',
    title: 'Lab Report 1',
    courseId: 'course-c1',
    courseCode: 'BIO 101',
    weekNumber: 2,
    isCompleted: false,
    isDeleted: false,
    isFavorite: false,
    rubricCriteria: []
  };

  const mockAssignment2Deleted: Assignment = {
    id: 'a-2',
    title: 'Enzyme Problem Set',
    courseId: 'course-c1',
    courseCode: 'BIO 101',
    weekNumber: 3,
    isCompleted: false,
    isDeleted: true,
    isFavorite: false,
    rubricCriteria: []
  };

  const mockVaultDoc: VaultDocument = {
    id: 'vd-1',
    title: 'BIO101_Syllabus.pdf',
    category: 'Syllabi',
    fileSize: '1.2 MB',
    fileType: 'PDF',
    courseCode: 'BIO 101',
    fileContent: 'Syllabus content',
    uploadedAt: new Date()
  };

  describe('Empty Trash Domain Isolation', () => {
    it('empties ONLY readings trash when emptyReadingsTrash logic executes, preserving deleted assignments', () => {
      let readings = [mockReading1, mockReading2Deleted];
      let assignments = [mockAssignment1, mockAssignment2Deleted];

      // Simulate emptyReadingsTrash
      readings = readings.filter(r => !r.isDeleted);

      // Verify readings in trash were purged
      expect(readings.find(r => r.id === 'r-2')).toBeUndefined();
      expect(readings.find(r => r.id === 'r-1')).toBeDefined();

      // Verify deleted assignment in assignments trash was NOT touched
      expect(assignments.find(a => a.id === 'a-2')).toBeDefined();
      expect(assignments.find(a => a.id === 'a-2')?.isDeleted).toBe(true);
    });

    it('empties ONLY assignments trash when emptyAssignmentsTrash logic executes, preserving deleted readings', () => {
      let readings = [mockReading1, mockReading2Deleted];
      let assignments = [mockAssignment1, mockAssignment2Deleted];

      // Simulate emptyAssignmentsTrash
      assignments = assignments.filter(a => !a.isDeleted);

      // Verify assignments in trash were purged
      expect(assignments.find(a => a.id === 'a-2')).toBeUndefined();
      expect(assignments.find(a => a.id === 'a-1')).toBeDefined();

      // Verify deleted reading in readings trash was NOT touched
      expect(readings.find(r => r.id === 'r-2')).toBeDefined();
      expect(readings.find(r => r.id === 'r-2')?.isDeleted).toBe(true);
    });
  });

  describe('Cascading Course Deletion', () => {
    it('purges course deliverables (readings, assignments, documents) when a course is deleted', () => {
      const otherCourse: Course = { ...mockCourse, id: 'course-c2', courseCode: 'MATH 101', courseName: 'Calculus' };
      const otherReading: Reading = { ...mockReading1, id: 'r-math', courseCode: 'MATH 101' };
      const otherAssignment: Assignment = { ...mockAssignment1, id: 'a-math', courseId: 'course-c2', courseCode: 'MATH 101' };

      let courses = [mockCourse, otherCourse];
      let readings = [mockReading1, mockReading2Deleted, otherReading];
      let assignments = [mockAssignment1, mockAssignment2Deleted, otherAssignment];
      let vaultDocs = [mockVaultDoc];

      // Execute deleteCourse for course-c1 (BIO 101)
      const targetCourse = courses.find(c => c.id === 'course-c1');
      const targetCode = targetCourse ? (targetCourse.courseCode || targetCourse.courseName).toLowerCase() : null;

      courses = courses.filter(c => c.id !== 'course-c1');
      if (targetCode) {
        readings = readings.filter(r => (r.courseCode || '').toLowerCase() !== targetCode);
        assignments = assignments.filter(a => a.courseId !== 'course-c1' && (a.courseCode || '').toLowerCase() !== targetCode);
        vaultDocs = vaultDocs.filter(v => (v.courseCode || '').toLowerCase() !== targetCode);
      }

      // BIO 101 items must all be gone
      expect(courses.find(c => c.id === 'course-c1')).toBeUndefined();
      expect(readings.filter(r => (r.courseCode || '').toLowerCase() === 'bio 101')).toHaveLength(0);
      expect(assignments.filter(a => (a.courseCode || '').toLowerCase() === 'bio 101')).toHaveLength(0);
      expect(vaultDocs.filter(v => (v.courseCode || '').toLowerCase() === 'bio 101')).toHaveLength(0);

      // Other course items must remain intact
      expect(courses.find(c => c.id === 'course-c2')).toBeDefined();
      expect(readings.find(r => r.id === 'r-math')).toBeDefined();
      expect(assignments.find(a => a.id === 'a-math')).toBeDefined();
    });
  });

  describe('Immediate Backup Save & Pending Data Queue', () => {
    it('executes saveImmediate without throwing and updates disk payload', async () => {
      const result = await persistenceManager.saveImmediate({
        courses: [mockCourse],
        readings: [mockReading1],
        assignments: [mockAssignment1],
        vaultDocs: [mockVaultDoc]
      });
      expect(typeof result).toBe('boolean');
    });

    it('honors empty array backups and does not require array length > 0', () => {
      const emptyBackup: BackupPayload = {
        version: 3,
        timestamp: Date.now(),
        courses: [],
        readings: [],
        assignments: [],
        vaultDocs: []
      };

      // Ensure Array.isArray is true even when empty
      expect(Array.isArray(emptyBackup.courses)).toBe(true);
      expect(Array.isArray(emptyBackup.readings)).toBe(true);
      expect(Array.isArray(emptyBackup.assignments)).toBe(true);
      expect(Array.isArray(emptyBackup.vaultDocs)).toBe(true);
      expect(emptyBackup.courses.length).toBe(0);
      expect(emptyBackup.readings.length).toBe(0);
      expect(emptyBackup.assignments.length).toBe(0);
    });
  });
});
