import { isGenericToken, isStubOrFileName } from '../src/context/CoursePalContext';
import { Course, VaultDocument } from '../src/types/models';

describe('Multi-Course & Subsequent Document Upload Ingestion Suite', () => {
  describe('1. isGenericToken & isStubOrFileName Calibration', () => {
    it('correctly classifies generic tokens and file stub names', () => {
      // Must be identified as generic
      expect(isGenericToken('Syllabus')).toBe(true);
      expect(isGenericToken('syllabus')).toBe(true);
      expect(isGenericToken('Syllabus 1')).toBe(true);
      expect(isGenericToken('Syllabus_2')).toBe(true);
      expect(isGenericToken('Course')).toBe(true);
      expect(isGenericToken('Document')).toBe(true);
      expect(isGenericToken('doc')).toBe(true);
      expect(isGenericToken('media_1790105675747')).toBe(true);
      expect(isGenericToken('new')).toBe(true);
      expect(isGenericToken('new course')).toBe(true);
      expect(isGenericToken('reading')).toBe(true);
      expect(isGenericToken('assignment')).toBe(true);
      expect(isGenericToken('crs')).toBe(true);
      expect(isGenericToken('gen 101')).toBe(true);
      expect(isGenericToken('')).toBe(true);
      expect(isGenericToken(null)).toBe(true);
      expect(isGenericToken(undefined)).toBe(true);

      // Real course codes must NEVER be classified as generic
      expect(isGenericToken('CPC 512')).toBe(false);
      expect(isGenericToken('CPC512')).toBe(false);
      expect(isGenericToken('DATA 630')).toBe(false);
      expect(isGenericToken('NEUR 740')).toBe(false);
      expect(isGenericToken('BIO 412')).toBe(false);
      expect(isGenericToken('CS 501')).toBe(false);
      expect(isGenericToken('PSYC 612')).toBe(false);
      expect(isGenericToken('LAW 702')).toBe(false);
      expect(isGenericToken('Family Systems Approaches')).toBe(false);
    });

    it('correctly classifies stub or file names', () => {
      expect(isStubOrFileName('course_syllabus')).toBe(true);
      expect(isStubOrFileName('my_syllabus.pdf')).toBe(true);
      expect(isStubOrFileName('media_12345')).toBe(true);
      expect(isStubOrFileName('Family Systems Approaches to Counselling')).toBe(false);
      expect(isStubOrFileName('Research Methods and Statistics')).toBe(false);
    });
  });

  describe('2. Multi-Course Target Matching (Zero Over-Matching)', () => {
    const existingCourses: Course[] = [
      {
        id: 'c-course-1',
        creatorId: 'user-self',
        courseName: 'First Course',
        courseCode: undefined, // generic/unspecified
        courseDescription: 'First syllabus uploaded',
        hexColor: '#2563EB',
        termWeeks: 10,
        sharingCode: '111111',
        isDeleted: false,
        isFavorite: true,
        createdAt: new Date(),
        weeks: [],
        assignments: [],
        syllabusDocs: []
      }
    ];

    const existingVaultDocs: VaultDocument[] = [
      {
        id: 'vd-1',
        title: 'Syllabus',
        category: 'Syllabi',
        fileSize: '1.2 MB',
        fileType: 'PDF',
        courseId: 'c-course-1',
        uploadedAt: new Date()
      }
    ];

    it('does NOT match existing course when candidate code is generic fallback', () => {
      // Suppose file 2 is named "Syllabus_Fall.pdf"
      const fileName2 = 'Syllabus_Fall.pdf';
      const rawFallback2 = fileName2.replace(/\.[^/.]+$/, '').trim();
      const codeMatch2 = rawFallback2.match(/\b([A-Z]{2,6}\s*\d{2,4}[A-Z]?)\b/i);
      const extractedCode2 = codeMatch2 ? codeMatch2[1].toUpperCase().replace(/\s+/g, ' ') : undefined;
      const fallbackCode2 = extractedCode2 || (isGenericToken(rawFallback2) ? undefined : rawFallback2.slice(0, 8).toUpperCase());

      // Because "Syllabus_Fall" is generic, fallbackCode must NOT become "SYLLABUS"
      expect(isGenericToken('Syllabus Fall')).toBe(true);
      expect(fallbackCode2).toBeUndefined();

      // Target course search simulation
      const candidateCode = (fallbackCode2 || '').replace(/\s+/g, '').toUpperCase();
      const candidateName = 'Course Syllabus'.trim().toLowerCase();

      const matchedCourse = existingCourses.find(c => {
        const cCode = (c.courseCode || '').replace(/\s+/g, '').toUpperCase();
        if (candidateCode && cCode && !isGenericToken(candidateCode) && !isGenericToken(cCode) && candidateCode === cCode) return true;

        const cName = (c.courseName || '').trim().toLowerCase();
        if (candidateName && cName && !isGenericToken(candidateName) && !isGenericToken(cName)) {
          if (candidateName === cName) return true;
        }

        return false;
      });

      // Crucial: Must be undefined (NOT match Course 1)!
      expect(matchedCourse).toBeUndefined();
    });

    it('matches target course ONLY when genuine, non-generic course codes match', () => {
      const realCourses: Course[] = [
        {
          id: 'c-data-630',
          creatorId: 'user-self',
          courseName: 'Scalable Machine Learning Systems',
          courseCode: 'DATA 630',
          hexColor: '#7C3AED',
          termWeeks: 12,
          sharingCode: '222222',
          isDeleted: false,
          isFavorite: true,
          createdAt: new Date(),
          weeks: [],
          assignments: [],
          syllabusDocs: []
        }
      ];

      // Re-uploading DATA 630 should match
      const candidateCode = 'DATA 630'.replace(/\s+/g, '').toUpperCase();
      const matched = realCourses.find(c => {
        const cCode = (c.courseCode || '').replace(/\s+/g, '').toUpperCase();
        return candidateCode && cCode && !isGenericToken(candidateCode) && !isGenericToken(cCode) && candidateCode === cCode;
      });

      expect(matched).toBeDefined();
      expect(matched?.id).toBe('c-data-630');

      // Uploading NEUR 740 should NOT match DATA 630
      const candidateCode2 = 'NEUR 740'.replace(/\s+/g, '').toUpperCase();
      const matched2 = realCourses.find(c => {
        const cCode = (c.courseCode || '').replace(/\s+/g, '').toUpperCase();
        return candidateCode2 && cCode && !isGenericToken(candidateCode2) && !isGenericToken(cCode) && candidateCode2 === cCode;
      });

      expect(matched2).toBeUndefined();
    });
  });

  describe('3. Deduplication Preservation Across Multiple Syllabi', () => {
    it('preserves distinct courses even when course codes or names share generic tokens', () => {
      const cleanCourses: Course[] = [
        {
          id: 'c-1',
          creatorId: 'user-self',
          courseName: 'First Course',
          courseCode: undefined,
          hexColor: '#2563EB',
          termWeeks: 10,
          sharingCode: '100001',
          isDeleted: false,
          isFavorite: true,
          createdAt: new Date(),
          weeks: [],
          assignments: [],
          syllabusDocs: []
        },
        {
          id: 'c-2',
          creatorId: 'user-self',
          courseName: 'Second Course',
          courseCode: undefined,
          hexColor: '#059669',
          termWeeks: 12,
          sharingCode: '100002',
          isDeleted: false,
          isFavorite: true,
          createdAt: new Date(),
          weeks: [],
          assignments: [],
          syllabusDocs: []
        }
      ];

      const deduplicatedCourses: Course[] = [];
      const seenCourseKeys = new Map<string, Course>();
      for (const c of cleanCourses) {
        const codeKey = (c.courseCode || '').replace(/\s+/g, '').toUpperCase();
        const nameKey = (c.courseName || '').trim().toLowerCase();
        const validCodeKey = codeKey && !isGenericToken(codeKey) ? codeKey : '';
        const validNameKey = nameKey && !isGenericToken(nameKey) ? nameKey : '';
        const key = validCodeKey || validNameKey;
        if (key) {
          if (seenCourseKeys.has(key)) {
            continue;
          }
          seenCourseKeys.set(key, c);
        }
        deduplicatedCourses.push(c);
      }

      // Both courses must be preserved!
      expect(deduplicatedCourses).toHaveLength(2);
      expect(deduplicatedCourses[0].id).toBe('c-1');
      expect(deduplicatedCourses[1].id).toBe('c-2');
    });

    it('preserves vault documents for different courses even if both are titled "Syllabus"', () => {
      const cleanVaultDocs: VaultDocument[] = [
        {
          id: 'vd-1',
          title: 'Syllabus',
          category: 'Syllabi',
          fileSize: '1.2 MB',
          fileType: 'PDF',
          courseId: 'c-1',
          uploadedAt: new Date()
        },
        {
          id: 'vd-2',
          title: 'Syllabus',
          category: 'Syllabi',
          fileSize: '1.4 MB',
          fileType: 'PDF',
          courseId: 'c-2',
          uploadedAt: new Date()
        }
      ];

      const seenDocs = new Set<string>();
      const result = cleanVaultDocs.filter(vd => {
        const safeCode = vd.courseCode && !isGenericToken(vd.courseCode) ? vd.courseCode.toUpperCase() : '';
        const docKey = `${vd.courseId || safeCode || 'doc'}_${(vd.title || '').toLowerCase()}`;
        if (seenDocs.has(docKey)) return false;
        seenDocs.add(docKey);
        return true;
      });

      // Both documents must be retained because they belong to different courses!
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('vd-1');
      expect(result[1].id).toBe('vd-2');
    });
  });

  describe('4. Stale Pending Upload Job Discard Validation', () => {
    it('discards pending jobs older than 3 minutes', () => {
      const now = Date.now();
      const freshJob = {
        fileName: 'Syllabus_Recent.pdf',
        timestamp: now - 30 * 1000 // 30s ago
      };
      const staleJob = {
        fileName: 'Syllabus_Old.pdf',
        timestamp: now - 5 * 60 * 1000 // 5m ago
      };

      const isStale = (job: { fileName?: string; timestamp?: number }) => {
        const ageMs = now - (job.timestamp || 0);
        return ageMs > 180000 || !job.timestamp;
      };

      expect(isStale(freshJob)).toBe(false);
      expect(isStale(staleJob)).toBe(true);
      expect(isStale({ fileName: 'NoTimestamp.pdf' })).toBe(true);
    });
  });
});
