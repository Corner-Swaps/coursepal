import {
  calculateConfettiParticlePosition,
  calculateConfettiAlpha,
  ConfettiParticleState
} from '../src/utils/mathPhysics';
import { ConfettiPhysics } from '../src/constants/physics';

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
});
