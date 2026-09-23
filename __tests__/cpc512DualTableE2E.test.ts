import { healCanonicalCPC512 } from '../src/context/CoursePalContext';
import { Course, Reading } from '../src/types/models';

describe('CPC 512 Dual Table Structure (Modules vs Weeks Separation)', () => {
  const mockCpcCourse: any = {
    id: 'c-cpc512-test',
    courseName: 'Family Systems Approaches to Counselling',
    courseCode: 'CPC 512',
    termWeeks: 12,
    weeks: []
  };

  it('heals CPC 512 with both 10 pure curriculum module readings (Table 1) and 12 weekly schedule readings (Table 2)', () => {
    const { courses, readings } = healCanonicalCPC512([mockCpcCourse], [], []);
    const cpcReadings = readings.filter(r =>
      r.courseId ? r.courseId === mockCpcCourse.id : (r.courseCode || '').replace(/\s+/g, '') === 'CPC512'
    );

    // 1. Check dedicated curriculum module readings (Table 1)
    const pureModuleReadings = cpcReadings.filter(
      r => r.moduleNumber && (!r.weekNumber || r.weekNumber === 0)
    );
    expect(pureModuleReadings.length).toBe(10);

    const expectedModules = [
      { modNum: 1, chapter: 'Chapters 1–3', theme: 'Systems Theory and the History of Family Therapy' },
      { modNum: 2, chapter: 'Chapter 2', theme: 'Family of Origin/ Genograms' },
      { modNum: 3, chapter: 'Chapters 11–15', theme: 'Diverse Populations and Family Therapy Case Conceptualization and Application' },
      { modNum: 4, chapter: 'Chapter 7', theme: 'Bowen Family Systems' },
      { modNum: 5, chapter: 'Chapter 5', theme: 'Structural Family Therapy' },
      { modNum: 6, chapter: 'Chapter 4', theme: 'Strategic Family Therapy' },
      { modNum: 7, chapter: 'Chapter 6', theme: 'Experiential Family Therapy' },
      { modNum: 8, chapter: 'Chapter 7', theme: 'Psychoanalytic Family Therapy' },
      { modNum: 9, chapter: 'Chapter 8', theme: 'Cognitive Behavioural Family Therapy Clinical issues in Family Counselling' },
      { modNum: 10, chapter: 'Chapter 10', theme: 'Social Constructionist Family Therapy Future Research and Critiques' }
    ];

    expectedModules.forEach(em => {
      const reading = pureModuleReadings.find(r => r.moduleNumber === em.modNum);
      expect(reading).toBeDefined();
      expect(reading?.chapterText).toBe(em.chapter);
      expect(reading?.relevantTopics).toBe(em.theme);
      expect(reading?.weekNumber).toBeUndefined();
      expect(reading?.dueDate).toBeNull();
      expect(reading?.dateRangeStr).toBeNull();
    });

    // 2. Check weekly schedule readings (Table 2)
    const weeklyReadings = cpcReadings.filter(r => (r.weekNumber || 0) > 0);
    expect(weeklyReadings.length).toBe(12);

    // Week 1: Chapters 1-3
    const w1 = weeklyReadings.filter(r => r.weekNumber === 1);
    expect(w1.length).toBe(1);
    expect(w1[0].chapterText).toBe('Chapters 1–3');
    expect(w1[0].dateRangeStr).toBe('Jul 2 – Jul 3');

    // Week 2: Chapter 5 + Articles on Canvas
    const w2 = weeklyReadings.filter(r => r.weekNumber === 2);
    expect(w2.length).toBe(2);
    expect(w2.some(r => r.chapterText === 'Chapter 5')).toBe(true);
    expect(w2.some(r => (r.title || '').includes('Articles'))).toBe(true);

    // Week 3: Chapters 5 & 7
    const w3 = weeklyReadings.filter(r => r.weekNumber === 3);
    expect(w3.length).toBe(1);
    expect(w3[0].chapterText).toBe('Chapters 5 & 7');

    // Week 4: Chapter 7
    const w4 = weeklyReadings.filter(r => r.weekNumber === 4);
    expect(w4.length).toBe(1);
    expect(w4[0].chapterText).toBe('Chapter 7');

    // Week 5: Chapters 4-10
    const w5 = weeklyReadings.filter(r => r.weekNumber === 5);
    expect(w5.length).toBe(1);
    expect(w5[0].chapterText).toBe('Chapters 4–10');
    expect(w5[0].title).toBe('Chapters 4–10');
    expect(w5[0].title).not.toContain('·');
    expect(w5[0].title).not.toContain('Presentation');

    // Week 6: Reading Week (0 readings)
    const w6 = weeklyReadings.filter(r => r.weekNumber === 6);
    expect(w6.length).toBe(0);

    // Week 7: Chapters 4-10
    const w7 = weeklyReadings.filter(r => r.weekNumber === 7);
    expect(w7.length).toBe(1);
    expect(w7[0].chapterText).toBe('Chapters 4–10');
    expect(w7[0].title).toBe('Chapters 4–10');
    expect(w7[0].title).not.toContain('·');
    expect(w7[0].title).not.toContain('Presentation');

    // Week 8: Chapters 4-10
    const w8 = weeklyReadings.filter(r => r.weekNumber === 8);
    expect(w8.length).toBe(1);
    expect(w8[0].chapterText).toBe('Chapters 4–10');
    expect(w8[0].title).toBe('Chapters 4–10');
    expect(w8[0].title).not.toContain('·');
    expect(w8[0].title).not.toContain('Presentation');

    // Week 9: Chapter 11
    const w9 = weeklyReadings.filter(r => r.weekNumber === 9);
    expect(w9.length).toBe(1);
    expect(w9[0].chapterText).toBe('Chapter 11');

    // Week 10: Chapter 11 + Review Sample Cases
    const w10 = weeklyReadings.filter(r => r.weekNumber === 10);
    expect(w10.length).toBe(2);
    expect(w10.some(r => r.chapterText === 'Chapter 11')).toBe(true);
    expect(w10.some(r => (r.title || '').includes('Review Sample'))).toBe(true);

    // Week 11: Chapter 8
    const w11 = weeklyReadings.filter(r => r.weekNumber === 11);
    expect(w11.length).toBe(1);
    expect(w11[0].chapterText).toBe('Chapter 8');

    // Week 12: Flex Week (0 readings)
    const w12 = weeklyReadings.filter(r => r.weekNumber === 12);
    expect(w12.length).toBe(0);
  });

  it('verifies that Modules and Weeks have completely different chapters and organizations', () => {
    const { readings } = healCanonicalCPC512([mockCpcCourse], [], []);
    const cpcReadings = readings.filter(r =>
      r.courseId ? r.courseId === mockCpcCourse.id : (r.courseCode || '').replace(/\s+/g, '') === 'CPC512'
    );

    const mod2 = cpcReadings.find(r => r.moduleNumber === 2 && !r.weekNumber);
    const week2 = cpcReadings.filter(r => r.weekNumber === 2);
    // Module 2 is Chapter 2, while Week 2 is Chapter 5!
    expect(mod2?.chapterText).toBe('Chapter 2');
    expect(week2[0]?.chapterText).toBe('Chapter 5');

    const mod3 = cpcReadings.find(r => r.moduleNumber === 3 && !r.weekNumber);
    const week3 = cpcReadings.find(r => r.weekNumber === 3);
    // Module 3 is Chapters 11-15, while Week 3 is Chapters 5 & 7!
    expect(mod3?.chapterText).toBe('Chapters 11–15');
    expect(week3?.chapterText).toBe('Chapters 5 & 7');

    const mod5 = cpcReadings.find(r => r.moduleNumber === 5 && !r.weekNumber);
    const week5 = cpcReadings.find(r => r.weekNumber === 5);
    // Module 5 is Chapter 5, while Week 5 is Chapters 4-10!
    expect(mod5?.chapterText).toBe('Chapter 5');
    expect(week5?.chapterText).toBe('Chapters 4–10');

    const mod8 = cpcReadings.find(r => r.moduleNumber === 8 && !r.weekNumber);
    const week8 = cpcReadings.find(r => r.weekNumber === 8);
    // Module 8 is Chapter 7, while Week 8 is Chapters 4-10!
    expect(mod8?.chapterText).toBe('Chapter 7');
    expect(week8?.chapterText).toBe('Chapters 4–10');

    const mod9 = cpcReadings.find(r => r.moduleNumber === 9 && !r.weekNumber);
    const week9 = cpcReadings.find(r => r.weekNumber === 9);
    // Module 9 is Chapter 8, while Week 9 is Chapter 11!
    expect(mod9?.chapterText).toBe('Chapter 8');
    expect(week9?.chapterText).toBe('Chapter 11');

    const mod10 = cpcReadings.find(r => r.moduleNumber === 10 && !r.weekNumber);
    const week10 = cpcReadings.filter(r => r.weekNumber === 10);
    // Module 10 is Chapter 10, while Week 10 is Chapter 11!
    expect(mod10?.chapterText).toBe('Chapter 10');
    expect(week10[0]?.chapterText).toBe('Chapter 11');
  });

  it('groups modules strictly using dedicated module readings without weekly schedule bleed-through', () => {
    const { readings } = healCanonicalCPC512([mockCpcCourse], [], []);
    const sourceList = readings.filter(r =>
      r.courseId ? r.courseId === mockCpcCourse.id : (r.courseCode || '').replace(/\s+/g, '') === 'CPC512'
    );

    // Simulate ReadingsScreen.tsx groupedModules logic
    const courseDedicatedModules = new Set<string>();
    for (const r of sourceList) {
      if (r.moduleNumber && (!r.weekNumber || r.weekNumber === 0)) {
        const cKey = r.courseId || (r.courseCode || '').replace(/\s+/g, '').toUpperCase();
        if (cKey) courseDedicatedModules.add(cKey);
      }
    }

    const readingsByMod = new Map<number, Reading[]>();
    for (const r of sourceList) {
      const rCourseKey = r.courseId || (r.courseCode || '').replace(/\s+/g, '').toUpperCase();
      const hasDedicatedModules = courseDedicatedModules.has(rCourseKey);

      if (hasDedicatedModules && r.weekNumber && r.weekNumber > 0) {
        continue;
      }

      const mNum = r.moduleNumber;
      if (mNum) {
        const list = readingsByMod.get(mNum) || [];
        list.push(r);
        readingsByMod.set(mNum, list);
      }
    }

    // Every module 1..10 must have exactly 1 reading (the canonical module reading), never weekly readings
    for (let m = 1; m <= 10; m++) {
      const mList = readingsByMod.get(m) || [];
      expect(mList.length).toBe(1);
      expect(mList[0].weekNumber).toBeUndefined();
    }

    // Module 2 must contain ONLY Chapter 2 (NOT Chapter 5 or Articles)
    const m2List = readingsByMod.get(2) || [];
    expect(m2List[0].chapterText).toBe('Chapter 2');
    expect(m2List[0].title).toBe('Gehart (Chapter 2)');

    // Module 3 must contain ONLY Chapters 11-15 (NOT Chapters 5 & 7)
    const m3List = readingsByMod.get(3) || [];
    expect(m3List[0].chapterText).toBe('Chapters 11–15');
    expect(m3List[0].title).toBe('Gehart (Chapters 11–15)');

    // Module 6 must contain ONLY Chapter 4 (NOT Chapters 4-10)
    const m6List = readingsByMod.get(6) || [];
    expect(m6List[0].chapterText).toBe('Chapter 4');
    expect(m6List[0].title).toBe('Gehart (Chapter 4)');
  });

  it('groups weeks strictly using weekly readings without pure module bleed-through', () => {
    const { readings } = healCanonicalCPC512([mockCpcCourse], [], []);
    const activeReadings = readings.filter(r =>
      r.courseId ? r.courseId === mockCpcCourse.id : (r.courseCode || '').replace(/\s+/g, '') === 'CPC512'
    );

    // Simulate ReadingsScreen.tsx groupedWeeks logic
    const readingsByWeek = new Map<number, Reading[]>();
    for (const r of activeReadings) {
      const isPureModule = Boolean(r.moduleNumber && (!r.weekNumber || r.weekNumber === 0));
      if (isPureModule) continue;

      const w = r.weekNumber;
      if (w && w > 0) {
        const list = readingsByWeek.get(w) || [];
        list.push(r);
        readingsByWeek.set(w, list);
      }
    }

    // Pure module readings must NOT be in weeks view
    for (let w = 1; w <= 12; w++) {
      const wList = readingsByWeek.get(w) || [];
      wList.forEach(r => {
        expect(r.weekNumber).toBe(w);
      });
    }

    // Week 2 has Chapter 5 and Articles on Canvas
    const w2List = readingsByWeek.get(2) || [];
    expect(w2List.length).toBe(2);
    expect(w2List.some(r => r.chapterText === 'Chapter 5')).toBe(true);
    expect(w2List.some(r => (r.title || '').includes('Articles'))).toBe(true);

    // Week 3 has Chapters 5 & 7
    const w3List = readingsByWeek.get(3) || [];
    expect(w3List.length).toBe(1);
    expect(w3List[0].chapterText).toBe('Chapters 5 & 7');
  });
});
