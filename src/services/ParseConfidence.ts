export const LOW_CONFIDENCE_THRESHOLD = 60;

export interface ParseSignals {
  weightTotal: number;
  rowsParsedRatio: number;
  junkRate: number;
  dateCoverage: number;
  gateFired: boolean;
  assignmentsCount?: number;
}

export function scoreParse(signals: ParseSignals): number {
  if (signals.gateFired) {
    return 0;
  }

  let score = 100;

  // 1. Weight anomalies: > 105% or 0% when assignments exist (-45 to ensure < 60 threshold)
  const hasAssignments = signals.assignmentsCount === undefined || signals.assignmentsCount > 0;
  if (signals.weightTotal > 105 || (signals.weightTotal === 0 && hasAssignments)) {
    score -= 45;
  }

  // 2. Table row conversion efficiency: < 50% rows parsed into items (-25)
  if (signals.rowsParsedRatio < 0.50) {
    score -= 25;
  }

  // 3. High junk/fragment rate (-20)
  if (signals.junkRate >= 0.50) {
    score -= 20;
  } else if (signals.junkRate > 0) {
    score -= Math.round(signals.junkRate * 15);
  }

  // 4. Low date coverage: < 50% of weeks have dates (-15)
  if (signals.dateCoverage < 0.50) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}
