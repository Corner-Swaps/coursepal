/**
 * Grade Weight Calculation Helpers
 * Parity with native Swift GradeWeightTrackerView & academic grade forecasting
 */

import { Assignment } from '../types/models';

/**
 * Extracts a numeric percentage or point weight from an assignment
 */
export function parseWeight(a: Partial<Assignment>): number {
  if (a.weightPercentage) {
    const match = a.weightPercentage.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val >= 0) return val;
    }
  }
  if (a.pointsPossible) {
    const match = a.pointsPossible.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val >= 0) return val;
    }
  }
  return 0;
}

export interface GradeWeightSummary {
  totalWeight: number;
  completedWeight: number;
  remainingWeight: number;
  completionRatio: number;
  completionPercentage: number;
}

/**
 * Aggregates deliverables weights, completed weights, and remaining weights
 */
export function computeGradeWeights(assignments: Assignment[]): GradeWeightSummary {
  let total = 0;
  let completed = 0;

  for (const a of assignments) {
    if (a.isDeleted) continue;
    const w = parseWeight(a);
    total += w;
    if (a.isCompleted) {
      completed += w;
    }
  }

  const roundedTotal = Math.round(total);
  const roundedCompleted = Math.round(completed);
  const roundedRemaining = Math.max(0, roundedTotal - roundedCompleted);
  const completionRatio = roundedTotal > 0 ? Math.min(1.0, roundedCompleted / roundedTotal) : 0;
  const completionPercentage = Math.round(completionRatio * 100);

  return {
    totalWeight: roundedTotal,
    completedWeight: roundedCompleted,
    remainingWeight: roundedRemaining,
    completionRatio,
    completionPercentage
  };
}

/**
 * Calculates the required score percentage on the remaining assignments
 * to reach the desired target grade.
 * Returns null if no remaining deliverables exist.
 */
export function calculateTargetGradeNeeded(params: {
  desiredGrade: number;
  completedWeight: number;
  remainingWeight: number;
  totalWeight: number;
}): number | null {
  const { desiredGrade, completedWeight, remainingWeight, totalWeight } = params;
  if (remainingWeight <= 0) return null;

  if (totalWeight < 100) {
    const neededPoints = desiredGrade - completedWeight;
    if (neededPoints <= 0) return 0;
    const targetRatio = (neededPoints / remainingWeight) * 100;
    return Math.round(targetRatio);
  }

  const needed = ((desiredGrade - completedWeight) / remainingWeight) * 100;
  if (needed <= 0) return 0;
  return Math.round(needed);
}
