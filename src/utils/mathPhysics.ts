/**
 * Mathematical Physics & Vector Calculations
 * 1:1 match with Swift ConfettiCelebrationView and NeuralDocumentService
 */

import { ConfettiPhysics, NeuralProjectionConstants } from '../constants/physics';

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

/**
 * Generates deterministic 300x64 random projection matrix using 64-bit LCG.
 * 1:1 match with Swift NeuralDocumentService.generateProjectionMatrix()
 */
export function generateNeuralProjectionMatrix(): number[][] {
  const rows = NeuralProjectionConstants.matrixRows;
  const dim = NeuralProjectionConstants.vectorDimension;
  const matrix: number[][] = [];

  let seed: bigint = NeuralProjectionConstants.initialSeed;
  const mult = NeuralProjectionConstants.lcgMultiplier;
  const inc = NeuralProjectionConstants.lcgIncrement;
  const mod64 = 0xFFFFFFFFFFFFFFFFn;

  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < dim; c++) {
      seed = (seed * mult + inc) & mod64;
      const mod1000 = Number(seed % 1000n);
      const val = (mod1000 / 1000.0 - 0.5) * 2.0;
      row.push(val);
    }
    matrix.push(row);
  }

  return matrix;
}

/**
 * Calculates cosine similarity between two equal-length numeric vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0.0;
  }

  let dot = 0.0;
  let normA = 0.0;
  let normB = 0.0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0.0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
