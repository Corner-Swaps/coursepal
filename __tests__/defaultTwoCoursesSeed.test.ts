import { createDefaultCoursesSeed } from '../src/context/CoursePalContext';

describe('Default Fresh 2-Course Seed Calibration', () => {
  it('seeds exactly two courses: PSYC 612 and CPC 527', () => {
    const seed = createDefaultCoursesSeed();

    expect(seed.courses.length).toBe(2);
    const codes = seed.courses.map(c => c.courseCode);
    expect(codes).toEqual(['PSYC 612', 'CPC 527']);

    // Check PSYC 612 details
    const psyc = seed.courses.find(c => c.courseCode === 'PSYC 612');
    expect(psyc).toBeDefined();
    expect(psyc?.courseName).toBe('Advanced Cognitive Behavioural Interventions');
    expect(psyc?.instructorName).toBe('Aris Thorne, Ph.D., R.Psych.');
    expect(psyc?.instructorEmail).toBe('athorne@appliedpsych.edu');

    // Check assignments for PSYC 612
    const psycAssignments = seed.assignments.filter(a => a.courseCode === 'PSYC 612');
    expect(psycAssignments.length).toBe(4);
    expect(psycAssignments.map(a => a.title)).toEqual([
      'Comprehensive Clinical Case Formulation',
      'Simulated Dyadic Clinical Demonstration',
      'Critical Peer Supervision & Consultation',
      'Seminar Engagement & Clinical Reflexivity'
    ]);
    expect(psycAssignments.map(a => a.pointsPossible)).toEqual([
      null,
      null,
      null,
      null
    ]);
    expect(psycAssignments.map(a => a.weightPercentage)).toEqual([
      '35%',
      '30%',
      '15%',
      '20%'
    ]);

    // Check readings for PSYC 612
    const psycReadings = seed.readings.filter(r => r.courseCode === 'PSYC 612');
    expect(psycReadings.length).toBeGreaterThan(10);
    const week1Readings = psycReadings.filter(r => r.weekNumber === 1);
    expect(week1Readings.map(r => r.title)).toEqual(['Beck (Ch. 1–3)', 'Persons (Ch. 1)']);

    // Check CPC 527 details
    const cpc = seed.courses.find(c => c.courseCode === 'CPC 527');
    expect(cpc).toBeDefined();
    expect(cpc?.courseName).toContain('Group Counselling Psychology');
    expect(cpc?.instructorName).toBe('Kelsey Murrin');

    const cpcAssignments = seed.assignments.filter(a => a.courseCode === 'CPC 527');
    expect(cpcAssignments.length).toBeGreaterThan(0);

    const cpcReadings = seed.readings.filter(r => r.courseCode === 'CPC 527');
    expect(cpcReadings.length).toBeGreaterThan(0);
  });
});
