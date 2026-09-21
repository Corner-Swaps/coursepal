import { sanitizeAssignment, healCanonicalCPC512 } from '../src/context/CoursePalContext';
import { deriveWeekForAssignment, healItemWeeks, formatDisplayTitleWithChapter } from '../src/utils/readingDisplayHelper';

describe('CPC 512 Schedule & Points Refinements Verification', () => {
  describe('Point Fabrication Elimination', () => {
    it('does not fabricate points from weightPercentage in sanitizeAssignment', () => {
      const sanitized = sanitizeAssignment({
        id: 'test-assign-1',
        title: 'Family Mapping Papers',
        weightPercentage: '30%',
        pointsPossible: null,
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        courseCode: 'CPC 512',
        weekNumber: 5,
        rubricCriteria: []
      });

      expect(sanitized.pointsPossible).toBeNull();
      expect(sanitized.weightPercentage).toBe('30%');
    });

    it('preserves genuine points when explicitly specified', () => {
      const sanitized = sanitizeAssignment({
        id: 'test-assign-2',
        title: 'Quiz 1',
        weightPercentage: '10%',
        pointsPossible: '50 Points',
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        courseCode: 'CPC 512',
        weekNumber: 2,
        rubricCriteria: []
      });

      expect(sanitized.pointsPossible).toBe('50 Points');
      expect(sanitized.weightPercentage).toBe('10%');
    });
  });

  describe('Continuous Deliverables & Reading Week Protection', () => {
    it('recognizes Collaboration as a semester-long item (weekNumber: 0) and never schedules it to Week 6', () => {
      const collabAssign: any = {
        id: 'a-cpc512-collaboration',
        title: 'Collaboration',
        weightPercentage: '20%',
        noteText: 'Over the course of the semester',
        weekNumber: 0,
        dueDate: null
      };

      const derivedWeek = deriveWeekForAssignment(collabAssign);
      expect(derivedWeek).toBe(0);
    });

    it('never schedules assignments to break weeks or reading weeks during sequential distribution', () => {
      const mockCourse: any = {
        id: 'c-test',
        courseCode: 'CPC 512',
        termWeeks: 12,
        weeks: [
          { weekNumber: 1, theme: 'Intro' },
          { weekNumber: 2, theme: 'Systems' },
          { weekNumber: 3, theme: 'Structural' },
          { weekNumber: 4, theme: 'Evidence Based' },
          { weekNumber: 5, theme: 'Evidence Based' },
          { weekNumber: 6, theme: 'Reading Week – No Class' },
          { weekNumber: 7, theme: 'Evidence Based' },
          { weekNumber: 8, theme: 'Evidence Based' },
          { weekNumber: 9, theme: 'Case Conceptualization' },
          { weekNumber: 10, theme: 'Case Conceptualization' },
          { weekNumber: 11, theme: 'Feedback' },
          { weekNumber: 12, theme: 'Flex Week' }
        ]
      };

      const unassignedPaper: any = {
        id: 'paper-1',
        title: 'Special Project',
        weekNumber: 0
      };

      const derived = deriveWeekForAssignment(unassignedPaper, mockCourse, null, [unassignedPaper]);
      // Must NOT be week 6 (Reading Week)
      expect(derived).not.toBe(6);
      expect(derived).not.toBe(12);
    });
  });

  describe('Canonical CPC 512 Seed Integrity', () => {
    const mockCpcCourse: any = {
      id: 'c-cpc512-test',
      courseCode: 'CPC 512',
      courseName: 'Family Systems Theory and Practice',
      termWeeks: 12,
      weeks: []
    };

    it('heals CPC 512 assignments with weight percentage and null pointsPossible', () => {
      const { assignments } = healCanonicalCPC512([mockCpcCourse], [], []);
      const cpcAssignments = assignments.filter(a =>
        a.courseId ? a.courseId === mockCpcCourse.id : (a.courseCode || '').replace(/\s+/g, '') === 'CPC512'
      );

      // Verify Family Mapping Papers
      const familyMapping = cpcAssignments.find(a => a.title.includes('Family Mapping'));
      expect(familyMapping).toBeDefined();
      expect(familyMapping?.weightPercentage).toBe('30%');
      expect(familyMapping?.pointsPossible).toBeNull();
      expect(familyMapping?.weekNumber).toBe(5);

      // Verify Assessment & Intervention Presentation
      const presentation = cpcAssignments.find(a => a.title.includes('Presentation'));
      expect(presentation).toBeDefined();
      expect(presentation?.weightPercentage).toBe('20%');
      expect(presentation?.pointsPossible).toBeNull();
      expect(presentation?.scheduledWeeks).toEqual([5, 7, 8]);

      // Verify Collaboration is semester-long (week 0, no due date)
      const collaboration = cpcAssignments.find(a => a.title.includes('Collaboration'));
      expect(collaboration).toBeDefined();
      expect(collaboration?.weightPercentage).toBe('20%');
      expect(collaboration?.pointsPossible).toBeNull();
      expect(collaboration?.weekNumber).toBe(0);
      expect(collaboration?.dueDate).toBeNull();

      // Verify Week 6 in course has 0 assignments
      const week6Assignments = cpcAssignments.filter(a => a.weekNumber === 6);
      expect(week6Assignments.length).toBe(0);
    });

    it('heals CPC 512 weekly schedule readings cleanly without concatenating themes onto chapter titles', () => {
      const { readings } = healCanonicalCPC512([mockCpcCourse], [], []);
      const cpcWeeklyReadings = readings.filter(r =>
        (r.courseId ? r.courseId === mockCpcCourse.id : (r.courseCode || '').replace(/\s+/g, '') === 'CPC512') &&
        (r.weekNumber || 0) > 0
      );

      // Week 4 reading must NOT have theme concatenated in title
      const week4Reading = cpcWeeklyReadings.find(r => r.weekNumber === 4);
      expect(week4Reading).toBeDefined();
      expect(week4Reading?.title).toBe('Chapter 7');
      expect(week4Reading?.title).not.toContain('Evidence Based Practice');

      // Week 5 reading must NOT have theme concatenated in title
      const week5Reading = cpcWeeklyReadings.find(r => r.weekNumber === 5);
      expect(week5Reading).toBeDefined();
      expect(week5Reading?.title).toBe('Chapters 4–10');
      expect(week5Reading?.title).not.toContain('Evidenced-Based Practice');

      // Week 6 is reading week: must have 0 readings
      const week6Readings = cpcWeeklyReadings.filter(r => r.weekNumber === 6);
      expect(week6Readings.length).toBe(0);
    });

    it('heals CPC 512 with all 10 modules intact, including Module 6 for Week 7', () => {
      const { courses, readings } = healCanonicalCPC512([mockCpcCourse], [], []);
      const cpcReadings = readings.filter(r =>
        r.courseId ? r.courseId === mockCpcCourse.id : (r.courseCode || '').replace(/\s+/g, '') === 'CPC512'
      );

      // Verify all 10 modules are present in readings
      for (let m = 1; m <= 10; m++) {
        const modReadings = cpcReadings.filter(r => r.moduleNumber === m);
        expect(modReadings.length).toBeGreaterThan(0);
      }

      // Explicitly verify Module 6 is attached to Week 7 reading (Strategic Family Therapy)
      const week7Reading = cpcReadings.find(r => r.weekNumber === 7);
      expect(week7Reading).toBeDefined();
      expect(week7Reading?.moduleNumber).toBe(6);
      expect(week7Reading?.moduleMention).toBe('Module 6');

      // Verify course weeks have module numbers mapped
      const cpcCourse = courses.find(c => c.id === mockCpcCourse.id);
      expect(cpcCourse).toBeDefined();
      const week7 = cpcCourse?.weeks.find(w => w.weekNumber === 7);
      expect(week7?.moduleNumber).toBe(6);
      expect(week7?.moduleMention).toBe('Module 6');

      const week11 = cpcCourse?.weeks.find(w => w.weekNumber === 11);
      expect(week11?.moduleNumber).toBe(10);
    });
  });
});
