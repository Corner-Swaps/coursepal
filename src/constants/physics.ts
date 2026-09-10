/**
 * Mathematical Physics Constants
 * Extracted 1:1 from ConfettiCelebrationView and NeuralDocumentService
 */

export const ConfettiPhysics = {
  particleCount: 85,
  totalDurationSeconds: 3.2,
  fadeStartSeconds: 2.2,
  gravityMin: 550,
  gravityMax: 850,
  speedMin: 260,
  speedMax: 620,
  launchAngleMin: -0.85 * Math.PI, // -153 degrees
  launchAngleMax: -0.15 * Math.PI, // -27 degrees
  wobbleSpeedMin: 4.0,
  wobbleSpeedMax: 10.0,
  wobbleAmplitudeMin: 15,
  wobbleAmplitudeMax: 35,
  rotationSpeedMin: -8.0,
  rotationSpeedMax: 8.0,
  cullingMargin: 40
} as const;

export const NeuralProjectionConstants = {
  vectorDimension: 64,
  matrixRows: 300,
  initialSeed: 42n,
  lcgMultiplier: 6364136223846793005n,
  lcgIncrement: 1442695040888963407n
} as const;

export const AnimationCurves = {
  springStandard: { damping: 0.8, response: 0.3 },
  springValidation: { damping: 0.8, response: 0.45 },
  springCard: { damping: 0.82, response: 0.35 },
  springBounce: { damping: 0.75, response: 0.25 },
  continuousShimmerDuration: 1800,
  continuousRingDuration: 3200
} as const;
