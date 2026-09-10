/**
 * ContinuousProgressBar
 * 6pt capsule looping and indeterminate/determinate progress indicator.
 * 1:1 match with Swift ContinuousProgressBar from SyllabusRepositoryView.swift:1887
 *
 * Visual & Layout Mathematics:
 * - Frame: height 6pt, spans container width
 * - Track Capsule: fill Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.20), radius 3pt
 * - Progress Indicator: fill Color(red: 0.14, green: 0.44, blue: 0.96), radius 3pt
 * - Clamped width: max(6, containerWidth * animProgress)
 * - Animation: withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: false))
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, LayoutChangeEvent, Animated, Easing } from 'react-native';
import { CoursePalTheme } from '../constants/theme';

export interface ContinuousProgressBarProps {
  progress?: number; // 0.0 to 1.0 (clamped)
  animated?: boolean; // If true and progress is not provided, runs 1.8s easeInOut loop
  tintColor?: string;
  trackColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export const ContinuousProgressBar: React.FC<ContinuousProgressBarProps> = ({
  progress,
  animated = progress === undefined,
  tintColor = CoursePalTheme.accentBlue,
  trackColor = 'rgba(36, 112, 245, 0.20)',
  height = 6,
  style
}) => {
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [animProgress, setAnimProgress] = useState<number>(
    progress !== undefined ? Math.min(Math.max(progress, 0.0), 1.0) : 0.0
  );

  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (progress !== undefined) {
      setAnimProgress(Math.min(Math.max(progress, 0.0), 1.0));
      return;
    }

    if (animated) {
      const loop = Animated.loop(
        Animated.timing(animValue, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false
        })
      );

      const listenerId = animValue.addListener(({ value }) => {
        setAnimProgress(value);
      });

      loop.start();

      return () => {
        loop.stop();
        animValue.removeListener(listenerId);
      };
    }
  }, [progress, animated, animValue]);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const cornerRadius = height / 2;
  const barWidth = containerWidth > 0 ? Math.max(height, containerWidth * animProgress) : `${Math.max(4, Math.min(100, animProgress * 100))}%`;

  return (
    <View
      style={[
        styles.track,
        {
          height,
          borderRadius: cornerRadius,
          backgroundColor: trackColor
        },
        style
      ]}
      onLayout={onLayout}
      testID="continuous-progress-bar"
    >
      <View
        style={[
          styles.fill,
          {
            height,
            borderRadius: cornerRadius,
            backgroundColor: tintColor,
            width: barWidth as any
          }
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center'
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0
  }
});
