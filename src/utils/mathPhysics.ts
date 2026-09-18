/**
 * Mathematical Physics & Vector Calculations
 * 1:1 match with Swift ConfettiCelebrationView and NeuralDocumentService
 */

import { ConfettiPhysics } from '../constants/physics';

export interface ConfettiParticleState {
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  gravity: number;
  wobbleSpeed: number;
  wobbleAmplitude: number;
  rotationSpeed: number;
  initialRotation: number;
}

/**
 * Computes instantaneous particle position and rotation given elapsed seconds.
 * 1:1 match with Swift ConfettiCelebrationView canvas loop.
 */
export function calculateConfettiParticlePosition(
  particle: ConfettiParticleState,
  elapsedSeconds: number
): { x: number; y: number; rotation: number } {
  const t = elapsedSeconds;
  const x = particle.startX + particle.vx * t + Math.sin(t * particle.wobbleSpeed) * particle.wobbleAmplitude;
  const y = particle.startY + particle.vy * t + 0.5 * particle.gravity * t * t;
  const rotation = particle.initialRotation + particle.rotationSpeed * t;
  return { x, y, rotation };
}

/**
 * Computes alpha fade envelope (1.0 -> 0.0) between 2.2s and 3.2s.
 */
export function calculateConfettiAlpha(elapsedSeconds: number): number {
  if (elapsedSeconds >= ConfettiPhysics.totalDurationSeconds) {
    return 0.0;
  }
  if (elapsedSeconds < ConfettiPhysics.fadeStartSeconds) {
    return 1.0;
  }
  return Math.max(0.0, 1.0 - (elapsedSeconds - ConfettiPhysics.fadeStartSeconds) / 1.0);
}
