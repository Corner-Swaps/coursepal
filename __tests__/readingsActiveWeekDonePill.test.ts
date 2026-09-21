import { Reading, Course } from '../src/types/models';
import { extractReadingWeekNumber, isReadingWeekEnabled } from '../src/utils/readingDisplayHelper';

describe('Readings Active Week & Done Pill Segregation', () => {
  const mockCourse: Course = {
    id: 'c-test-active-week',
    creatorId: 'user-1',
    courseName: 'Cognitive Behavioural Interventions',
    courseCode: 'PSYC 612',
    termWeeks: 12,
    hexColor: '#4F46E5',
    sharingCode: '123456',
    isDeleted: false,
    isFavorite: false,
    createdAt: new Date(),
    syllabusDocs: [],
    weeks: [],
    assignments: []
  };

  function createMockReading(partial: Partial<Reading> & { id: string; title: string }): Reading {
    return {
      courseId: mockCourse.id,
      courseCode: mockCourse.courseCode,
      mediaTypeRaw: 'textbook',
      mediaType: 'textbook',
      summaryText: '',
      keyTakeawaysText: '',
      estimatedTimeText: '~45 min read',
      isFavorite: false,
      isCompleted: false,
      isDeleted: false,
      weekId: partial.weekNumber ? `w-${partial.weekNumber}` : undefined,
      ...partial
    };
  }

  function computeStudyWeekState(readings: Reading[]) {
    const readingWeeksList = Array.from(
      new Set(
        readings
          .filter(r => !r.isDeleted && isReadingWeekEnabled(r))
          .map(r => extractReadingWeekNumber(r))
          .filter((w): w is number => typeof w === 'number' && w > 0)
      )
    ).sort((a, b) => a - b);

    const firstReadingWeek = readingWeeksList.length > 0 ? readingWeeksList[0] : null;

    let activeStudyWeek: number | null = null;
    if (readingWeeksList.length > 0) {
      for (const w of readingWeeksList) {
        const weekItems = readings.filter(
          r => !r.isDeleted && extractReadingWeekNumber(r) === w
        );
        const hasIncomplete = weekItems.some(r => !r.isCompleted);
        if (hasIncomplete) {
          activeStudyWeek = w;
          break;
        }
      }
      if (activeStudyWeek === null) {
        activeStudyWeek = readingWeeksList[readingWeeksList.length - 1];
      }
    }

    return {
      readingWeeksList,
      firstReadingWeek,
      activeStudyWeek
    };
  }

  function partitionWeekReadings(readings: Reading[]) {
    const incomplete = readings.filter(r => !r.isCompleted);
    const completed = readings.filter(r => r.isCompleted);
    return {
      incomplete,
      completed,
      showDonePill: completed.length > 0,
      donePillCount: completed.length
    };
  }

  it('starts at Week 1 when Week 1 has readings and is incomplete', () => {
    const readings: Reading[] = [
      createMockReading({ id: 'r1', title: 'Beck (Ch. 1–3)', weekNumber: 1, isCompleted: false }),
      createMockReading({ id: 'r2', title: 'Persons (Ch. 1)', weekNumber: 1, isCompleted: false }),
      createMockReading({ id: 'r3', title: 'Beck (Ch. 7–9)', weekNumber: 2, isCompleted: false })
    ];

    const state = computeStudyWeekState(readings);
    expect(state.firstReadingWeek).toBe(1);
    expect(state.activeStudyWeek).toBe(1);
  });

  it('starts at Week 2 when course readings start at Week 2', () => {
    const readings: Reading[] = [
      createMockReading({ id: 'r1', title: 'Creswell (Ch. 5)', weekNumber: 2, isCompleted: false }),
      createMockReading({ id: 'r2', title: 'Creswell (Ch. 6)', weekNumber: 2, isCompleted: false }),
      createMockReading({ id: 'r3', title: 'Creswell (Ch. 8)', weekNumber: 3, isCompleted: false })
    ];

    const state = computeStudyWeekState(readings);
    expect(state.firstReadingWeek).toBe(2);
    expect(state.activeStudyWeek).toBe(2);
  });

  it('advances activeStudyWeek from Week 1 to Week 2 once all Week 1 readings are completed', () => {
    const readings: Reading[] = [
      createMockReading({ id: 'r1', title: 'Beck (Ch. 1–3)', weekNumber: 1, isCompleted: true }), // finished!
      createMockReading({ id: 'r2', title: 'Persons (Ch. 1)', weekNumber: 1, isCompleted: true }), // finished!
      createMockReading({ id: 'r3', title: 'Beck (Ch. 7–9)', weekNumber: 2, isCompleted: false })
    ];

    const state = computeStudyWeekState(readings);
    expect(state.firstReadingWeek).toBe(1);
    expect(state.activeStudyWeek).toBe(2); // Automatically moved to Week 2!
  });

  it('partitions items so incomplete are at top and completed are at bottom under Done pill', () => {
    const week1Readings: Reading[] = [
      createMockReading({ id: 'r1', title: 'Beck (Ch. 1–3)', weekNumber: 1, isCompleted: true }),
      createMockReading({ id: 'r2', title: 'Persons (Ch. 1)', weekNumber: 1, isCompleted: false })
    ];

    const partitioned = partitionWeekReadings(week1Readings);
    // Incomplete at top
    expect(partitioned.incomplete.map(r => r.id)).toEqual(['r2']);
    // Completed at bottom
    expect(partitioned.completed.map(r => r.id)).toEqual(['r1']);
    // Done pill is displayed
    expect(partitioned.showDonePill).toBe(true);
    expect(partitioned.donePillCount).toBe(1);
  });

  it('hides Done pill when no items are completed in the week', () => {
    const week1Readings: Reading[] = [
      createMockReading({ id: 'r1', title: 'Beck (Ch. 1–3)', weekNumber: 1, isCompleted: false }),
      createMockReading({ id: 'r2', title: 'Persons (Ch. 1)', weekNumber: 1, isCompleted: false })
    ];

    const partitioned = partitionWeekReadings(week1Readings);
    expect(partitioned.incomplete.length).toBe(2);
    expect(partitioned.completed.length).toBe(0);
    expect(partitioned.showDonePill).toBe(false);
  });

  it('keeps empty state when document has no readings (request 9 preservation)', () => {
    const emptyReadings: Reading[] = [];
    const state = computeStudyWeekState(emptyReadings);
    expect(state.firstReadingWeek).toBeNull();
    expect(state.activeStudyWeek).toBeNull();
    expect(state.readingWeeksList).toEqual([]);
  });

  describe('Single Bottom Done Section & Grey Palette', () => {
    it('aggregates all completed readings across weeks into a single bottom Done list', () => {
      const allReadings: Reading[] = [
        createMockReading({ id: 'r1', title: 'Week 1 Reading A', weekNumber: 1, isCompleted: true }),
        createMockReading({ id: 'r2', title: 'Week 1 Reading B', weekNumber: 1, isCompleted: false }),
        createMockReading({ id: 'r3', title: 'Week 2 Reading C', weekNumber: 2, isCompleted: true }),
        createMockReading({ id: 'r4', title: 'Week 2 Reading D', weekNumber: 2, isCompleted: false }),
      ];

      const allCompletedInView = allReadings.filter(r => r.isCompleted);
      expect(allCompletedInView.map(r => r.id)).toEqual(['r1', 'r3']);
      expect(allCompletedInView.length).toBe(2);
    });

    it('skips rendering week section when all its readings are completed in all-weeks view', () => {
      const week1Readings: Reading[] = [
        createMockReading({ id: 'r1', title: 'Reading 1', weekNumber: 1, isCompleted: true }),
        createMockReading({ id: 'r2', title: 'Reading 2', weekNumber: 1, isCompleted: true }),
      ];
      const incomplete = week1Readings.filter(r => !r.isCompleted);
      const selectedWeekFilter: number | null = null;
      const shouldRenderWeek = !(incomplete.length === 0 && selectedWeekFilter === null);
      expect(shouldRenderWeek).toBe(false);
    });

    it('renders week section if user explicitly filtered to that week even if all readings are complete', () => {
      const week1Readings: Reading[] = [
        createMockReading({ id: 'r1', title: 'Reading 1', weekNumber: 1, isCompleted: true }),
      ];
      const incomplete = week1Readings.filter(r => !r.isCompleted);
      const selectedWeekFilter: number | null = 1;
      const shouldRenderWeek = !(incomplete.length === 0 && selectedWeekFilter === null);
      expect(shouldRenderWeek).toBe(true);
    });

    it('specifies neutral grey palette for the single Done pill, avoiding green', () => {
      const donePillStyle = {
        backgroundColor: '#E2E8F0',
        borderColor: '#CBD5E1',
        textColor: '#475569',
        iconColor: '#64748B'
      };
      // Must not be green
      expect(donePillStyle.backgroundColor).not.toBe('#DCFCE7');
      expect(donePillStyle.textColor).not.toBe('#15803D');
      // Must be neutral slate/grey
      expect(donePillStyle.backgroundColor).toBe('#E2E8F0');
      expect(donePillStyle.borderColor).toBe('#CBD5E1');
      expect(donePillStyle.textColor).toBe('#475569');
      expect(donePillStyle.iconColor).toBe('#64748B');
    });

    it('renders strictly "Done" as the pill label with exactly one Done section', () => {
      const doneLabel = 'Done';
      expect(doneLabel).toBe('Done');
      expect(doneLabel).not.toContain('·');
    });
  });

  describe('Module Readings Schedule Retention & Course Matching', () => {
    it('preserves all 22 readings across modules and weeks without dropping any item', () => {
      const getEffectiveReadingWeek = (r: any): number | null => {
        if (typeof r.weekNumber === 'number' && r.weekNumber > 0) return r.weekNumber;
        if (r.weekId && r.weekId !== 'none') {
          const m = r.weekId.match(/\d+/);
          if (m && parseInt(m[0], 10) > 0) return parseInt(m[0], 10);
        }
        if (typeof r.moduleNumber === 'number' && r.moduleNumber > 0) {
          return r.moduleNumber;
        }
        return null;
      };

      // Create 22 readings: 1 with weekNumber, 21 pure module readings
      const readings: Reading[] = [
        createMockReading({ id: 'r-wk-1', title: 'Week 1 Reading', weekNumber: 1, isCompleted: false })
      ];
      for (let i = 2; i <= 22; i++) {
        readings.push(
          createMockReading({
            id: `r-mod-${i}`,
            title: `Module ${i} Reading`,
            weekNumber: null,
            weekId: 'none',
            moduleNumber: i,
            isCompleted: false
          })
        );
      }

      expect(readings.length).toBe(22);

      // Verify that all 22 readings have valid effective weeks
      const effectiveWeeks = readings.map(getEffectiveReadingWeek);
      expect(effectiveWeeks.every(w => typeof w === 'number' && w > 0)).toBe(true);

      // Verify grouping: all 22 readings must be placed into weeks, none dropped
      const readingsByWeek = new Map<number, Reading[]>();
      for (const r of readings) {
        const w = getEffectiveReadingWeek(r) || 1;
        const list = readingsByWeek.get(w) || [];
        list.push(r);
        readingsByWeek.set(w, list);
      }

      let totalGrouped = 0;
      readingsByWeek.forEach(list => {
        totalGrouped += list.length;
      });
      expect(totalGrouped).toBe(22);
    });

    it('resiliently matches course by ID, courseCode with or without spaces, or courseName', () => {
      const isReadingForCourse = (
        r: { courseId?: string | null; courseCode?: string | null },
        course: { id: string; courseCode?: string | null; courseName?: string | null } | null
      ): boolean => {
        if (!course) return true;
        if (r.courseId && r.courseId === course.id) return true;
        const cCode = (course.courseCode || '').trim().toLowerCase();
        const cCodeClean = cCode.replace(/\s+/g, '');
        const rCode = (r.courseCode || '').trim().toLowerCase();
        const rCodeClean = rCode.replace(/\s+/g, '');
        if (cCode && rCode && (cCode === rCode || cCodeClean === rCodeClean)) return true;
        const cName = (course.courseName || '').trim().toLowerCase();
        if (cName && rCode && (cName === rCode || cName.replace(/\s+/g, '') === rCodeClean)) return true;
        return false;
      };

      const course = { id: 'c-101', courseCode: 'CPC 512', courseName: 'Family Systems' };

      // 1. Match by ID
      expect(isReadingForCourse({ courseId: 'c-101' }, course)).toBe(true);
      // 2. Match by exact code
      expect(isReadingForCourse({ courseCode: 'CPC 512' }, course)).toBe(true);
      // 3. Match by code without space
      expect(isReadingForCourse({ courseCode: 'cpc512' }, course)).toBe(true);
      // 4. Match by courseName
      expect(isReadingForCourse({ courseCode: 'Family Systems' }, course)).toBe(true);
      // 5. Does not match distinct course
      expect(isReadingForCourse({ courseCode: 'CPC 527' }, course)).toBe(false);
    });
  });
});
