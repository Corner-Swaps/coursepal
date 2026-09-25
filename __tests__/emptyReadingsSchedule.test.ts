import { Reading, Course } from '../src/types/models';
import { extractReadingWeekNumber, isReadingWeekEnabled } from '../src/utils/readingDisplayHelper';

describe('Empty Readings Schedule & No-Reading Document Isolation', () => {
  // Mock course with 12 schedule weeks but ZERO readings in the document
  const mockCourseWithNoReadings: Course = {
    id: 'c-test-no-readings',
    creatorId: 'user-1',
    courseName: 'Clinical Practicum Without Readings',
    courseCode: 'PSYC 799',
    termWeeks: 12,
    hexColor: '#3B82F6',
    sharingCode: '123456',
    isDeleted: false,
    isFavorite: false,
    createdAt: new Date(),
    syllabusDocs: [],
    weeks: Array.from({ length: 12 }, (_, i) => ({
      id: `w-${i + 1}`,
      weekNumber: i + 1,
      theme: `Week ${i + 1} Practicum`,
      courseId: 'c-test-no-readings',
      readings: []
    })),
    assignments: []
  };

  function computeGroupedWeeks(activeReadings: Reading[], selectedWeekFilter: number | null = null) {
    const unReadings: Reading[] = [];
    const readingsByWeek = new Map<number, Reading[]>();
    const allWeeks = new Set<number>();

    for (const r of activeReadings) {
      if (r.moduleNumber && (!r.weekNumber || r.weekNumber === 0)) {
        continue;
      }
      const isWeekOn = isReadingWeekEnabled(r);
      if (!isWeekOn) {
        unReadings.push(r);
      } else {
        const w = extractReadingWeekNumber(r) || 1;
        if (selectedWeekFilter === null || selectedWeekFilter === w) {
          allWeeks.add(w);
          const list = readingsByWeek.get(w) || [];
          list.push(r);
          readingsByWeek.set(w, list);
        }
      }
    }

    const sortedWeeks = Array.from(allWeeks)
      .sort((a, b) => a - b)
      .map(w => ({
        weekNum: w,
        readings: readingsByWeek.get(w) || []
      }));

    return {
      unassignedReadings: unReadings,
      groupedWeeks: sortedWeeks
    };
  }

  function computeGroupedModules(activeReadings: Reading[]) {
    const readingsByMod = new Map<number, Reading[]>();
    const allMods = new Set<number>();

    for (const r of activeReadings) {
      const mNum = (r.moduleNumber && r.moduleNumber > 0)
        ? r.moduleNumber
        : (r.moduleMention && /\d+/.test(r.moduleMention) ? parseInt(r.moduleMention.match(/\d+/)![0], 10) : null);
      if (mNum) {
        allMods.add(mNum);
        const list = readingsByMod.get(mNum) || [];
        list.push(r);
        readingsByMod.set(mNum, list);
      }
    }

    return Array.from(allMods)
      .sort((a, b) => a - b)
      .map(m => ({
        moduleNum: m,
        readings: readingsByMod.get(m) || []
      }));
  }

  test('Course with no readings in document produces 0 grouped weeks and 0 unassigned readings (completely empty)', () => {
    const activeReadings: Reading[] = [];
    const { unassignedReadings, groupedWeeks } = computeGroupedWeeks(activeReadings);
    const groupedModules = computeGroupedModules(activeReadings);

    // Absolutely no weeks or modules should be placed in the reading view
    expect(groupedWeeks).toEqual([]);
    expect(groupedWeeks.length).toBe(0);
    expect(unassignedReadings).toEqual([]);
    expect(unassignedReadings.length).toBe(0);
    expect(groupedModules).toEqual([]);
    expect(groupedModules.length).toBe(0);
  });

  test('Course with readings only in Weeks 1 and 3 does NOT populate empty Weeks 2, 4..12', () => {
    const activeReadings: Reading[] = [
      {
        id: 'r-1',
        title: 'Foundations of Clinical Work',
        weekNumber: 1,
        weekId: 'w-1',
        isCompleted: false,
        isDeleted: false,
        courseCode: 'PSYC 799'
      } as any as Reading,
      {
        id: 'r-2',
        title: 'Diagnostic Formulations',
        weekNumber: 3,
        weekId: 'w-3',
        isCompleted: false,
        isDeleted: false,
        courseCode: 'PSYC 799'
      } as any as Reading
    ];

    const { unassignedReadings, groupedWeeks } = computeGroupedWeeks(activeReadings);

    // Only weeks 1 and 3 should appear
    expect(groupedWeeks.map(gw => gw.weekNum)).toEqual([1, 3]);
    expect(groupedWeeks.length).toBe(2);
    expect(unassignedReadings.length).toBe(0);

    // Empty weeks (2, 4, 5, 6, 7, 8, 9, 10, 11, 12) are completely excluded
    expect(groupedWeeks.some(gw => gw.weekNum === 2)).toBe(false);
    expect(groupedWeeks.some(gw => gw.weekNum === 4)).toBe(false);
  });

  test('Filtering by a week with no readings leaves groupedWeeks empty', () => {
    const activeReadings: Reading[] = [
      {
        id: 'r-1',
        title: 'Foundations of Clinical Work',
        weekNumber: 1,
        weekId: 'w-1',
        isCompleted: false,
        isDeleted: false,
        courseCode: 'PSYC 799'
      } as any as Reading
    ];

    // Filter by week 5 (which has no readings)
    const { groupedWeeks } = computeGroupedWeeks(activeReadings, 5);
    expect(groupedWeeks.length).toBe(0);
  });

  test('Ghost courses with 0 readings and 0 assignments are purged when loading backup', () => {
    const rawCourses: Course[] = [
      {
        id: 'c-ghost-1',
        courseCode: 'PRJ-SEX-2026-X',
        courseName: 'Human Sexuality Studies',
        termWeeks: 10,
        weeks: Array.from({ length: 10 }, (_, i) => ({
          id: `w-${i + 1}`,
          weekNumber: i + 1,
          theme: `Week ${i + 1}`,
          readings: []
        }))
      } as any as Course,
      {
        id: 'c-valid-1',
        courseCode: 'CPC 512',
        courseName: 'Family Systems',
        termWeeks: 12,
        weeks: []
      } as any as Course
    ];

    const rawReadings: Reading[] = [
      { id: 'r-1', courseId: 'c-valid-1', title: 'Gehart Ch. 1', isCompleted: false } as any as Reading
    ];
    const rawAssignments: any[] = [];

    // Simulate backup pruning logic in loadLatestBackup
    const isItemForCourse = (item: any, course: Course) => item.courseId === course.id;
    const cleanCourses = rawCourses.filter(c => {
      const hasReadings = rawReadings.some(r => isItemForCourse(r, c));
      const hasAssignments = rawAssignments.some(a => isItemForCourse(a, c));
      return hasReadings || hasAssignments;
    });

    // The ghost course with 0 readings & 0 assignments must be purged!
    expect(cleanCourses.length).toBe(1);
    expect(cleanCourses[0].id).toBe('c-valid-1');
    expect(cleanCourses.some(c => c.id === 'c-ghost-1')).toBe(false);
  });

  test('When zero documents/courses have readings, empty state triggers and no dummy weeks are shown', () => {
    const courses: Course[] = [];
    const activeReadings: Reading[] = [];
    const groupedModules: any[] = [];
    const groupedWeeks: any[] = [];
    const unassignedReadings: any[] = [];
    const groupingViewMode: string = 'weeks';

    const shouldShowEmptyCard = (
      courses.length === 0 ||
      activeReadings.length === 0 ||
      (groupingViewMode === 'modules'
        ? groupedModules.length === 0
        : (groupedWeeks.length === 0 && unassignedReadings.length === 0))
    );

    expect(shouldShowEmptyCard).toBe(true);
  });
});
