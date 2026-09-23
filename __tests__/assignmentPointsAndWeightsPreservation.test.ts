import { sanitizeAssignment } from '../src/context/CoursePalContext';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { Assignment } from '../src/types/models';

describe('Assignment Points & Weight Percentage Preservation', () => {
  it('preserves both points and weights when points equal weight percentage (100-point course scale)', () => {
    const rawAssignment: any = {
      id: 'a-1',
      title: 'Case Conceptualization',
      pointsPossible: '20 Points',
      weightPercentage: '20%',
      weekNumber: 10,
      rubricCriteria: []
    };

    const sanitized = sanitizeAssignment(rawAssignment);
    expect(sanitized.pointsPossible).toBe('20 Points');
    expect(sanitized.weightPercentage).toBe('20%');
  });

  it('normalizes numeric weight and points in deduplicateAssignments', () => {
    const rawCandidates: any[] = [
      {
        title: 'Midterm Exam',
        weight: 25,
        points: 100,
        weekNumber: 6
      },
      {
        title: 'Final Project',
        weight_percentage: 0.4,
        pointsPossible: '400',
        weekNumber: 12
      }
    ];

    const deduplicated = SyllabusImportManager.shared.deduplicateAssignments(rawCandidates);
    expect(deduplicated.length).toBe(2);

    const midterm = deduplicated.find(a => a.title.includes('Midterm'));
    expect(midterm?.weightPercentage).toBe('25%');
    expect(midterm?.pointsPossible).toBe('100 Points');

    const finalProj = deduplicated.find(a => a.title.includes('Final'));
    expect(finalProj?.weightPercentage).toBe('40%');
    expect(finalProj?.pointsPossible).toBe('400 Points');
  });

  it('preserves null pointsPossible on model while allowing UI to resolve rubric points', () => {
    const rawAssignment: any = {
      id: 'a-rubric',
      title: 'Family Mapping Paper',
      weightPercentage: '30%',
      pointsPossible: null,
      weekNumber: 5,
      rubricCriteria: [
        { criterionName: 'Genogram Structure', points: 10 },
        { criterionName: 'Theoretical Analysis', points: 20 },
        { criterionName: 'Scholarly Sources', points: 20 },
        { criterionName: 'Clinical Ethics', points: 20 },
        { criterionName: 'Cultural Competence', points: 20 },
        { criterionName: 'Reflective Synthesis', points: 10 }
      ]
    };

    const sanitized = sanitizeAssignment(rawAssignment);
    expect(sanitized.weightPercentage).toBe('30%');
    expect(sanitized.pointsPossible).toBeNull();

    // UI resolves points dynamically from rubric sum for pill display:
    const rubricSum = (sanitized.rubricCriteria || []).reduce((sum, c) => sum + (c.points || 0), 0);
    const resolvedPointsForDisplay = sanitized.pointsPossible ? sanitized.pointsPossible : `${rubricSum} pts`;
    expect(resolvedPointsForDisplay).toBe('100 pts');
  });

  it('extracts weight and points from noteText and instructions when missing from top-level fields', () => {
    const rawCandidate: any = {
      title: 'In-Class Case Presentation',
      noteText: 'In-class case presentation worth 20% of final grade · 100 points total',
      weekNumber: 5
    };

    const deduplicated = SyllabusImportManager.shared.deduplicateAssignments([rawCandidate]);
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].weightPercentage).toBe('20%');
    expect(deduplicated[0].pointsPossible).toBe('100 Points');
  });

  it('preserves weightPercentage during course reimport reconciliation', () => {
    const existingAssignments: Assignment[] = [
      {
        id: 'a-exist-1',
        title: 'Research Essay',
        weekNumber: 4,
        isCompleted: true,
        isDeleted: false,
        isFavorite: false,
        courseId: 'c-test',
        weightPercentage: '30%',
        pointsPossible: '100 Points',
        rubricCriteria: []
      }
    ];

    const newAssignments: Assignment[] = [
      {
        id: 'a-new-1',
        title: 'Research Essay',
        weekNumber: 4,
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        courseId: 'c-test',
        weightPercentage: null, // AI omitted weight on reimport
        pointsPossible: '100 Points',
        rubricCriteria: []
      }
    ];

    const result = SyllabusImportManager.shared.mergeReimportedCourse({
      targetCourseId: 'c-test',
      existingCourses: [{ id: 'c-test', courseName: 'Test Course', courseCode: 'TEST 101' } as any],
      existingReadings: [],
      existingAssignments,
      existingVaultDocs: [],
      newCourseData: {} as any,
      newReadings: [],
      newAssignments,
      newVaultDoc: {} as any
    });

    const reconciled = result.updatedAssignments.find(a => a.title === 'Research Essay');
    expect(reconciled?.weightPercentage).toBe('30%');
    expect(reconciled?.pointsPossible).toBe('100 Points');
    expect(reconciled?.isCompleted).toBe(true);
  });
});
