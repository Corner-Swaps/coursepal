/**
 * Grade Weight Tracker & Grade Forecasting Calculations Unit Tests
 * Parity with native Swift GradeWeightTrackerView
 */

import {
  parseWeight,
  computeGradeWeights,
  calculateTargetGradeNeeded
} from '../src/utils/gradeWeightHelper';
import { Assignment } from '../src/types/models';

describe('GradeWeightTracker Helpers & Calculus', () => {
  describe('parseWeight', () => {
    it('extracts numerical percentages from weightPercentage string', () => {
      expect(parseWeight({ weightPercentage: '25%' })).toBe(25);
      expect(parseWeight({ weightPercentage: '12.5%' })).toBe(12.5);
      expect(parseWeight({ weightPercentage: '30 percent' })).toBe(30);
    });

    it('falls back to pointsPossible when weightPercentage is not provided', () => {
      expect(parseWeight({ pointsPossible: '100 Points' })).toBe(100);
      expect(parseWeight({ pointsPossible: '50 pts' })).toBe(50);
      expect(parseWeight({ pointsPossible: '75' })).toBe(75);
    });

    it('returns 0 when neither weight nor points are present or numeric', () => {
      expect(parseWeight({})).toBe(0);
      expect(parseWeight({ weightPercentage: 'N/A' })).toBe(0);
      expect(parseWeight({ pointsPossible: 'None' })).toBe(0);
    });
  });

  describe('computeGradeWeights', () => {
    const createMockAssignment = (
      id: string,
      weight: string,
      isCompleted: boolean,
      isDeleted: boolean = false
    ): Assignment => ({
      id,
      courseId: 'c1',
      title: `Assignment ${id}`,
      weightPercentage: weight,
      isCompleted,
      isDeleted,
      weekNumber: 1,
      isFavorite: false,
      rubricCriteria: []
    });

    it('aggregates total weight, completed weight, and remaining weight correctly', () => {
      const assignments: Assignment[] = [
        createMockAssignment('1', '20%', true),
        createMockAssignment('2', '30%', true),
        createMockAssignment('3', '25%', false),
        createMockAssignment('4', '25%', false)
      ];

      const summary = computeGradeWeights(assignments);
      expect(summary.totalWeight).toBe(100);
      expect(summary.completedWeight).toBe(50);
      expect(summary.remainingWeight).toBe(50);
      expect(summary.completionPercentage).toBe(50);
      expect(summary.completionRatio).toBe(0.5);
    });

    it('strictly ignores deleted assignments from all weight calculations', () => {
      const assignments: Assignment[] = [
        createMockAssignment('1', '40%', true),
        createMockAssignment('2', '60%', false),
        createMockAssignment('deleted-1', '50%', true, true),
        createMockAssignment('deleted-2', '50%', false, true)
      ];

      const summary = computeGradeWeights(assignments);
      expect(summary.totalWeight).toBe(100);
      expect(summary.completedWeight).toBe(40);
      expect(summary.remainingWeight).toBe(60);
      expect(summary.completionPercentage).toBe(40);
    });

    it('handles empty assignment lists gracefully', () => {
      const summary = computeGradeWeights([]);
      expect(summary.totalWeight).toBe(0);
      expect(summary.completedWeight).toBe(0);
      expect(summary.remainingWeight).toBe(0);
      expect(summary.completionPercentage).toBe(0);
      expect(summary.completionRatio).toBe(0);
    });

    it('handles 100% completion scenario where remaining weight reaches 0', () => {
      const assignments: Assignment[] = [
        createMockAssignment('1', '50%', true),
        createMockAssignment('2', '50%', true)
      ];

      const summary = computeGradeWeights(assignments);
      expect(summary.totalWeight).toBe(100);
      expect(summary.completedWeight).toBe(100);
      expect(summary.remainingWeight).toBe(0);
      expect(summary.completionPercentage).toBe(100);
    });
  });

  describe('calculateTargetGradeNeeded', () => {
    it('calculates the exact percentage required on remaining coursework for target grade', () => {
      // Completed 40% with 60% remaining, target is 90%
      // Required = (90 - 40) / 60 * 100 = 50 / 60 * 100 = 83.33 -> 83%
      const needed = calculateTargetGradeNeeded({
        desiredGrade: 90,
        completedWeight: 40,
        remainingWeight: 60,
        totalWeight: 100
      });
      expect(needed).toBe(83);
    });

    it('returns 0 if the student has already earned enough points to guarantee target grade', () => {
      // Completed 85%, target is 80%
      const needed = calculateTargetGradeNeeded({
        desiredGrade: 80,
        completedWeight: 85,
        remainingWeight: 15,
        totalWeight: 100
      });
      expect(needed).toBe(0);
    });

    it('returns null when there are no remaining deliverables left to score', () => {
      const needed = calculateTargetGradeNeeded({
        desiredGrade: 90,
        completedWeight: 88,
        remainingWeight: 0,
        totalWeight: 100
      });
      expect(needed).toBeNull();
    });

    it('correctly computes for courses where totalTrackedWeight is less than 100', () => {
      // Partial syllabus where only 70% total weight is defined:
      // Completed 30%, remaining 40%, target is 60%
      // Needed points = 60 - 30 = 30 points across 40% remaining -> 75%
      const needed = calculateTargetGradeNeeded({
        desiredGrade: 60,
        completedWeight: 30,
        remainingWeight: 40,
        totalWeight: 70
      });
      expect(needed).toBe(75);
    });
  });
});
