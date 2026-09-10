/**
 * SoundscapeWaveVisualizer
 * Dynamic SVG multi-harmonic audio wave visualizer with exact sine/bezier math,
 * edge amplitude damping, and interactive touch scrubbing.
 *
 * Mathematical Physics:
 * - Damping window: D(x) = sin(pi * x / W), where D(0) = 0 and D(W) = 0
 * - Primary harmonic: y_1(x) = centerY + A * [0.65 * sin(2pi*x/lambda_1 + phi) + 0.35 * sin(2pi*x/lambda_2 - 0.5*phi)] * D(x)
 * - Secondary harmonic: y_2(x) = centerY + 0.6 * A * sin(2pi*x/lambda_3 + 1.2*phi) * D(x)
 * - Cubic Bezier spline generation for sub-pixel smooth curves
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Animated,
  Easing
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { CoursePalTheme } from '../constants/theme';
import { haptics } from '../services/HapticsService';

export interface SoundscapeWaveVisualizerProps {
  width?: number;
  height?: number;
  isPlaying?: boolean;
  intensity?: number; // 0.0 to 1.0
  color?: string;
  secondaryColor?: string;
  interactive?: boolean;
  onScrub?: (fraction: number) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pure mathematical curve generator for wave points and SVG path string
 */
export function generateWavePath(
  width: number,
  height: number,
  phase: number,
  amplitude: number,
  wavelength1: number = 140,
  wavelength2: number = 70,
  stepPx: number = 6
): string {
  const centerY = height / 2;
  const points: { x: number; y: number }[] = [];

  for (let x = 0; x <= width; x += stepPx) {
    const normX = Math.min(Math.max(x / width, 0), 1);
    // Sine damping window D(x) = sin(pi * normX)
    const damping = Math.sin(Math.PI * normX);

    const term1 = 0.65 * Math.sin((2 * Math.PI * x) / wavelength1 + phase);
    const term2 = 0.35 * Math.sin((2 * Math.PI * x) / wavelength2 - 0.5 * phase);
    const y = centerY + amplitude * (term1 + term2) * damping;

    points.push({ x, y });
  }

  // Ensure last point is exactly at width
  if (points.length > 0 && points[points.length - 1].x < width) {
    points.push({ x: width, y: centerY });
  }

  if (points.length === 0) return `M 0 ${centerY} L ${width} ${centerY}`;

  // Build smooth cubic Bezier path
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cp1x = (curr.x + (next.x - curr.x) / 3).toFixed(2);
    const cp1y = curr.y.toFixed(2);
    const cp2x = (curr.x + ((next.x - curr.x) * 2) / 3).toFixed(2);
    const cp2y = next.y.toFixed(2);
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  return d;
}

export const SoundscapeWaveVisualizer: React.FC<SoundscapeWaveVisualizerProps> = ({
  width = 300,
  height = 80,
  isPlaying = true,
  intensity = 0.65,
  color = CoursePalTheme.accentBlue,
  secondaryColor = 'rgba(36, 112, 245, 0.35)',
  interactive = false,
  onScrub,
  style
}) => {
  const [phase, setPhase] = useState<number>(0);
  const animPhase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isPlaying) return;

    const anim = Animated.loop(
      Animated.timing(animPhase, {
        toValue: 2 * Math.PI,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: false
      })
    );

    const listenerId = animPhase.addListener(({ value }) => {
      setPhase(value);
    });

    anim.start();

    return () => {
      anim.stop();
      animPhase.removeListener(listenerId);
    };
  }, [isPlaying, animPhase]);

  const maxAmplitude = (height / 2) * 0.8 * Math.min(Math.max(intensity, 0.1), 1.0);

  const primaryPath = useMemo(() => {
    return generateWavePath(width, height, phase, maxAmplitude, 140, 75, 6);
  }, [width, height, phase, maxAmplitude]);

  const secondaryPath = useMemo(() => {
    return generateWavePath(width, height, phase * 1.3 + Math.PI / 4, maxAmplitude * 0.65, 110, 55, 6);
  }, [width, height, phase, maxAmplitude]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => interactive,
      onMoveShouldSetPanResponder: () => interactive,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        haptics.selection();
        const touchX = evt.nativeEvent.locationX;
        const fraction = Math.min(Math.max(touchX / width, 0), 1);
        if (onScrub) onScrub(fraction);
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const touchX = Math.min(Math.max(gestureState.x0 + gestureState.dx, 0), width);
        const fraction = touchX / width;
        if (onScrub) onScrub(fraction);
      }
    })
  ).current;

  return (
    <View
      style={[styles.container, { width, height }, style]}
      {...(interactive ? panResponder.panHandlers : {})}
      testID="soundscape-wave-visualizer"
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="primaryWaveGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="0.5" stopColor={color} stopOpacity="1.0" />
            <Stop offset="1" stopColor={color} stopOpacity="0.3" />
          </LinearGradient>
        </Defs>

        {/* Secondary Harmonic Wave */}
        <Path
          d={secondaryPath}
          fill="none"
          stroke={secondaryColor}
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Primary Dynamic Wave */}
        <Path
          d={primaryPath}
          fill="none"
          stroke="url(#primaryWaveGrad)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  }
});
