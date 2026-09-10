import {
  calculateConfettiParticlePosition,
  calculateConfettiAlpha,
  generateNeuralProjectionMatrix,
  cosineSimilarity,
  ConfettiParticleState
} from '../src/utils/mathPhysics';
import { ConfettiPhysics, NeuralProjectionConstants } from '../src/constants/physics';

describe('Mathematical Physics & Neural Calculations', () => {
  describe('Confetti Physics Trajectory', () => {
    const mockParticle: ConfettiParticleState = {
      startX: 200,
      startY: 500,
      vx: 150,
      vy: -400,
      gravity: 700,
      wobbleSpeed: 6.0,
      wobbleAmplitude: 20,
      rotationSpeed: 4.0,
      initialRotation: 0.5
    };

    it('evaluates exact origin and rotation at t = 0', () => {
      const pos = calculateConfettiParticlePosition(mockParticle, 0);
      expect(pos.x).toBe(200);
      expect(pos.y).toBe(500);
      expect(pos.rotation).toBe(0.5);
    });

    it('evaluates ballistic trajectory with sinusoidal wobble at t = 1.0s', () => {
      const t = 1.0;
      const expectedX = 200 + 150 * 1.0 + Math.sin(6.0) * 20;
      const expectedY = 500 + (-400) * 1.0 + 0.5 * 700 * 1.0 * 1.0;
      const expectedRot = 0.5 + 4.0 * 1.0;

      const pos = calculateConfettiParticlePosition(mockParticle, t);
      expect(pos.x).toBeCloseTo(expectedX, 5);
      expect(pos.y).toBeCloseTo(expectedY, 5);
      expect(pos.rotation).toBeCloseTo(expectedRot, 5);
    });

    it('evaluates parabolic gravity curve at t = 2.0s', () => {
      const t = 2.0;
      const expectedY = 500 + (-400) * 2.0 + 0.5 * 700 * (2.0 * 2.0);
      const pos = calculateConfettiParticlePosition(mockParticle, t);
      expect(pos.y).toBeCloseTo(expectedY, 5);
    });

    describe('calculateConfettiAlpha envelope', () => {
      it('retains 1.0 opacity before fade start (t < 2.2s)', () => {
        expect(calculateConfettiAlpha(0)).toBe(1.0);
        expect(calculateConfettiAlpha(1.0)).toBe(1.0);
        expect(calculateConfettiAlpha(2.19)).toBe(1.0);
      });

      it('linearly interpolates from 1.0 to 0.0 between 2.2s and 3.2s', () => {
        expect(calculateConfettiAlpha(2.2)).toBe(1.0);
        expect(calculateConfettiAlpha(2.7)).toBeCloseTo(0.5, 4);
        expect(calculateConfettiAlpha(2.95)).toBeCloseTo(0.25, 4);
      });

      it('drops to 0.0 opacity at or after 3.2s', () => {
        expect(calculateConfettiAlpha(3.2)).toBe(0.0);
        expect(calculateConfettiAlpha(3.5)).toBe(0.0);
        expect(calculateConfettiAlpha(10.0)).toBe(0.0);
      });
    });
  });

  describe('Neural Random Projection Matrix', () => {
    it('generates a 300x64 projection matrix matching Swift NeuralDocumentService specs', () => {
      const matrix = generateNeuralProjectionMatrix();
      expect(matrix).toHaveLength(NeuralProjectionConstants.matrixRows); // 300
      for (const row of matrix) {
        expect(row).toHaveLength(NeuralProjectionConstants.vectorDimension); // 64
      }
    });

    it('bounds all projected weights strictly within [-1.0, 1.0]', () => {
      const matrix = generateNeuralProjectionMatrix();
      for (const row of matrix) {
        for (const val of row) {
          expect(val).toBeGreaterThanOrEqual(-1.0);
          expect(val).toBeLessThanOrEqual(1.0);
        }
      }
    });

    it('generates completely deterministic pseudo-random values with seed 42n', () => {
      const matrix1 = generateNeuralProjectionMatrix();
      const matrix2 = generateNeuralProjectionMatrix();

      expect(matrix1[0][0]).toBe(matrix2[0][0]);
      expect(matrix1[100][32]).toBe(matrix2[100][32]);
      expect(matrix1[299][63]).toBe(matrix2[299][63]);
    });
  });

  describe('Vector Cosine Similarity', () => {
    it('returns 1.0 for identical vectors', () => {
      const vec = [0.2, 0.8, -0.4, 0.1];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 6);
    });

    it('returns -1.0 for exact opposite vectors', () => {
      const vecA = [1.0, 2.0, 3.0];
      const vecB = [-1.0, -2.0, -3.0];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1.0, 6);
    });

    it('returns 0.0 for orthogonal vectors', () => {
      const vecA = [1.0, 0.0, 0.0];
      const vecB = [0.0, 1.0, 0.0];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0.0, 6);
    });

    it('returns 0.0 for zero vectors or mismatched lengths', () => {
      expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0.0);
      expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0.0);
      expect(cosineSimilarity([], [])).toBe(0.0);
    });

    it('computes accurate cosine similarity for typical embedding vectors', () => {
      const vecA = [0.5, 0.5, 0.5, 0.5];
      const vecB = [0.5, 0.5, 0.0, 0.0];
      // dot = 0.25 + 0.25 = 0.5
      // normA = sqrt(4 * 0.25) = 1.0
      // normB = sqrt(2 * 0.25) = sqrt(0.5)
      // cos = 0.5 / sqrt(0.5) = sqrt(0.5) ≈ 0.70710678
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(Math.SQRT1_2, 6);
    });
  });
});
