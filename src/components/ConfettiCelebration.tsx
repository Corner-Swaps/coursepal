/**
 * ConfettiCelebrationView
 * 85-particle celebration canvas with ballistic trajectory, sinusoidal wobble, and alpha fade.
 * 1:1 match with Swift ConfettiCelebrationView
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, StyleProp, ViewStyle } from 'react-native';
import { ConfettiPalette } from '../constants/theme';
import { ConfettiPhysics } from '../constants/physics';
import {
  calculateConfettiParticlePosition,
  calculateConfettiAlpha,
  ConfettiParticleState
} from '../utils/mathPhysics';

export interface ConfettiCelebrationProps {
  active?: boolean;
  onFinished?: () => void;
  style?: StyleProp<ViewStyle>;
}

export type ConfettiCelebrationViewProps = ConfettiCelebrationProps;

interface ParticleInstance {
  id: number;
  color: string;
  width: number;
  height: number;
  borderRadius: number;
  physics: ConfettiParticleState;
}

export const ConfettiCelebration: React.FC<ConfettiCelebrationProps> = ({
  active = true,
  onFinished,
  style
}) => {
  const [particles, setParticles] = useState<ParticleInstance[]>([]);
  const [elapsed, setElapsed] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      setElapsed(0);
      return;
    }

    const { width: W, height: H } = Dimensions.get('window');
    const newParticles: ParticleInstance[] = [];

    for (let i = 0; i < ConfettiPhysics.particleCount; i++) {
      const color = ConfettiPalette[i % ConfettiPalette.length];
      const startX = (0.15 + Math.random() * 0.70) * W;
      const startY = (0.25 + Math.random() * 0.20) * H;
      const launchAngle = ConfettiPhysics.launchAngleMin + Math.random() * (ConfettiPhysics.launchAngleMax - ConfettiPhysics.launchAngleMin);
      const speed = ConfettiPhysics.speedMin + Math.random() * (ConfettiPhysics.speedMax - ConfettiPhysics.speedMin);
      const gravity = ConfettiPhysics.gravityMin + Math.random() * (ConfettiPhysics.gravityMax - ConfettiPhysics.gravityMin);
      const wobbleSpeed = ConfettiPhysics.wobbleSpeedMin + Math.random() * (ConfettiPhysics.wobbleSpeedMax - ConfettiPhysics.wobbleSpeedMin);
      const wobbleAmplitude = ConfettiPhysics.wobbleAmplitudeMin + Math.random() * (ConfettiPhysics.wobbleAmplitudeMax - ConfettiPhysics.wobbleAmplitudeMin);
      const rotationSpeed = ConfettiPhysics.rotationSpeedMin + Math.random() * (ConfettiPhysics.rotationSpeedMax - ConfettiPhysics.rotationSpeedMin);
      const initialRotation = Math.random() * 2 * Math.PI;

      const shapeType = i % 3;
      let width = 8;
      let height = 8;
      let borderRadius = 1.5;

      if (shapeType === 0) {
        width = 7 + Math.random() * 5;
        height = 6 + Math.random() * 4;
        borderRadius = 1.5;
      } else if (shapeType === 1) {
        const dia = 6 + Math.random() * 4;
        width = dia;
        height = dia;
        borderRadius = dia / 2;
      } else {
        width = 12 + Math.random() * 6;
        height = 4 + Math.random() * 2;
        borderRadius = 1.0;
      }

      newParticles.push({
        id: i,
        color,
        width,
        height,
        borderRadius,
        physics: {
          startX,
          startY,
          vx: Math.cos(launchAngle) * speed,
          vy: Math.sin(launchAngle) * speed,
          gravity,
          wobbleSpeed,
          wobbleAmplitude,
          rotationSpeed,
          initialRotation
        }
      });
    }

    setParticles(newParticles);
    startTimeRef.current = Date.now();

    const updateFrame = () => {
      if (!startTimeRef.current) return;
      const now = Date.now();
      const dt = (now - startTimeRef.current) / 1000.0;
      setElapsed(dt);

      if (dt < ConfettiPhysics.totalDurationSeconds) {
        frameRef.current = requestAnimationFrame(updateFrame);
      } else {
        onFinished?.();
      }
    };

    frameRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [active, onFinished]);

  if (!active || particles.length === 0) return null;

  const alpha = calculateConfettiAlpha(elapsed);
  if (alpha <= 0.0) return null;

  const { width: screenW, height: screenH } = Dimensions.get('window');

  return (
    <View style={[styles.canvas, { opacity: alpha }, style]} pointerEvents="none" testID="confetti-celebration-view">
      {particles.map(p => {
        const { x, y, rotation } = calculateConfettiParticlePosition(p.physics, elapsed);

        // Culling
        if (
          x < -ConfettiPhysics.cullingMargin ||
          x > screenW + ConfettiPhysics.cullingMargin ||
          y > screenH + ConfettiPhysics.cullingMargin
        ) {
          return null;
        }

        return (
          <View
            key={p.id}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: p.width,
              height: p.height,
              backgroundColor: p.color,
              borderRadius: p.borderRadius,
              transform: [{ rotate: `${rotation}rad` }]
            }}
          />
        );
      })}
    </View>
  );
};

export const ConfettiCelebrationView = ConfettiCelebration;

const styles = StyleSheet.create({
  canvas: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999
  }
});
