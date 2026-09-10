/**
 * ContinuousProgressRing
 * 36pt × 36pt animated circular progress indicator.
 * 1:1 match with Swift ContinuousProgressRing from MainTabView.swift:1803
 *
 * Visual & Layout Mathematics:
 * - Frame: 36pt x 36pt
 * - Track Circle: strokeWidth 3pt, Color(red: 0.14, green: 0.44, blue: 0.96).opacity(0.2)
 * - Animated Arc: strokeWidth 3pt, lineCap: round, Color(red: 0.14, green: 0.44, blue: 0.96)
 * - Rotation: -90 degrees (starts at 12 o'clock)
 * - Animation: withAnimation(.linear(duration: 3.2).repeatForever(autoreverses: false))
 * - Center Icon: doc.fill, size 13pt bold, Color(red: 0.14, green: 0.44, blue: 0.96)
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Animated, Easing } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { CoursePalTheme } from '../constants/theme';

export interface ContinuousProgressRingProps {
  size?: number;
  strokeWidth?: number;
  progress?: number; // 0.0 to 1.0 for determinate mode
  animated?: boolean; // If true and progress is not fixed, runs 3.2s continuous loop
  tintColor?: string;
  trackColor?: string;
  showIcon?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const ContinuousProgressRing: React.FC<ContinuousProgressRingProps> = ({
  size = 36,
  strokeWidth = 3,
  progress,
  animated = progress === undefined,
  tintColor = CoursePalTheme.accentBlue,
  trackColor = 'rgba(36, 112, 245, 0.20)',
  showIcon = true,
  style
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const [currentProgress, setCurrentProgress] = useState<number>(
    progress !== undefined ? Math.min(Math.max(progress, 0.0), 1.0) : 0.0
  );

  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (progress !== undefined) {
      setCurrentProgress(Math.min(Math.max(progress, 0.0), 1.0));
      return;
    }

    if (animated) {
      const loop = Animated.loop(
        Animated.timing(animValue, {
          toValue: 1,
          duration: 3200,
          easing: Easing.linear,
          useNativeDriver: false
        })
      );

      const listenerId = animValue.addListener(({ value }) => {
        setCurrentProgress(value);
      });

      loop.start();

      return () => {
        loop.stop();
        animValue.removeListener(listenerId);
      };
    }
  }, [progress, animated, animValue]);

  const strokeDashoffset = circumference * (1 - currentProgress);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size
        },
        style
      ]}
      testID="continuous-progress-ring"
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background Track Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Foreground Progress Arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={tintColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />

        {/* Centered Document Glyph */}
        {showIcon && (
          <Path
            d={`M${size / 2 - 3.5} ${size / 2 - 5} h5 l3 3 v7 h-8 z`}
            fill={tintColor}
          />
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center'
  }
});
