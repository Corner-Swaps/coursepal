import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import cityuSyllabi from '../src/utils/cityu_syllabi_texts.json';

describe('CPC 527 Local Pipeline Verification', () => {
  const text = cityuSyllabi.cpc527;

  test('LocalSyllabusParser parseText on CPC 527 text', () => {
    const result = LocalSyllabusParser.shared.parseText(text);
    console.log('Result courseCode:', result.courseCode);
    console.log('Result courseName:', result.courseName);
    console.log('Assignments:', result.assignments?.map(a => `${a.title} (${a.weightPercentage || a.pointsPossible})`));
    console.log('Weeks:', result.weeks?.length);
    console.log('Readings on weeks:');
    result.weeks?.forEach(w => console.log(`Week ${w.weekNumber} (${w.startDate}):`, w.readings?.map(r => r.title)));

    const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(result, text);
    expect(normalized.candidateAssignments.length).toBe(4);
    expect(normalized.candidateReadings.length).toBe(15);

    const cleanReadings = SyllabusImportManager.shared.deduplicateReadings(
      normalized.candidateReadings,
      normalized.textbooks,
      normalized.termYear
    );
    const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(
      normalized.candidateAssignments,
      normalized.termYear,
      normalized.weekDateMap
    );

    expect(cleanAssignments.length).toBe(4);
    expect(cleanReadings.length).toBeGreaterThanOrEqual(11);
    console.log('Final cleanAssignments count:', cleanAssignments.length);
    console.log('Final cleanReadings count:', cleanReadings.length);
    cleanAssignments.forEach(a => console.log(' -> Clean Assign:', a.title, a.weightPercentage, a.dueDate));
  });
});
