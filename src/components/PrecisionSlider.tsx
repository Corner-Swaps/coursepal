/**
 * PrecisionSlider
 * 1:1 match with SwiftUI Slider(value:in:step:) from GradeWeightTrackerView.swift:127
 *
 * Visual & Touch Mechanics:
 * - Track Height: 5pt capsule, borderRadius: 2.5pt
 * - Inactive Track: #E3E8F0 (borderSlate)
 * - Active Track: courseColor (e.g. #2470F5)
 * - Thumb: 24pt circle, fill #FFFFFF, border 0.5pt solid rgba(0,0,0,0.08), shadow radius 4pt, y: 2pt
 * - Hit-Slop: 14pt vertical & horizontal buffer
 * - PanResponder: fluid drag tracking, step quantization, boundary clamping
 * - Haptic Tick: triggers selection haptic on integer step change
 * - Thumb Scale: springs to 1.15x when dragging
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent,
  Animated
} from 'react-native';
import { CoursePalTheme } from '../constants/theme';
import { haptics } from '../services/haptics';

export interface PrecisionSliderProps {
  value: number;
  onValueChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  tintColor?: string;
  trackColor?: string;
  width?: number | string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const PrecisionSlider: React.FC<PrecisionSliderProps> = ({
  value,
  onValueChange,
  min = 70,
  max = 100,
  step = 1,
  tintColor = CoursePalTheme.accentBlue,
  trackColor = CoursePalTheme.borderSlate,
  width = 120,
  disabled = false,
  style
}) => {
  const [trackWidth, setTrackWidth] = useState<number>(typeof width === 'number' ? width : 120);
  const thumbScale = useRef(new Animated.Value(1.0)).current;
  const lastSteppedValue = useRef<number>(value);

  // Sync external value
  useEffect(() => {
    lastSteppedValue.current = value;
  }, [value]);

  const quantizeValue = (raw: number): number => {
    const clamped = Math.min(Math.max(raw, min), max);
    if (step <= 0) return clamped;
    const stepsCount = Math.round((clamped - min) / step);
    return Math.min(Math.max(min + stepsCount * step, min), max);
  };

  const calculateValueFromPosition = (xPos: number): number => {
    if (trackWidth <= 0) return min;
    const ratio = Math.min(Math.max(xPos / trackWidth, 0), 1);
    const rawVal = min + ratio * (max - min);
    return quantizeValue(rawVal);
  };

  const handleTouch = (xPos: number) => {
    const newVal = calculateValueFromPosition(xPos);
    if (newVal !== lastSteppedValue.current) {
      lastSteppedValue.current = newVal;
      haptics.throttledSelection(35);
      onValueChange(newVal);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        Animated.spring(thumbScale, {
          toValue: 1.18,
          friction: 6,
          useNativeDriver: false
        }).start();

        const xPos = evt.nativeEvent.locationX;
        handleTouch(xPos);
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const fraction = (lastSteppedValue.current - min) / (max - min);
        const currentX = fraction * trackWidth;
        const newX = currentX + gestureState.dx;
        handleTouch(newX);
      },
      onPanResponderRelease: () => {
        Animated.spring(thumbScale, {
          toValue: 1.0,
          friction: 6,
          useNativeDriver: false
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(thumbScale, {
          toValue: 1.0,
          friction: 6,
          useNativeDriver: false
        }).start();
      }
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const layoutWidth = e.nativeEvent.layout.width;
    if (layoutWidth > 0) {
      setTrackWidth(layoutWidth);
    }
  };

  const currentRatio = max > min ? Math.min(Math.max((value - min) / (max - min), 0), 1) : 0;
  const thumbOffset = currentRatio * trackWidth;

  return (
    <View
      style={[
        styles.touchContainer,
        typeof width === 'number' ? { width } : { flex: 1 },
        style
      ]}
      onLayout={onLayout}
      {...panResponder.panHandlers}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      testID="precision-slider"
    >
      {/* Background Track */}
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        {/* Active Track Fill */}
        <View
          style={[
            styles.activeTrack,
            {
              width: thumbOffset,
              backgroundColor: tintColor
            }
          ]}
        />
      </View>

      {/* Floating Animated Thumb */}
      <Animated.View
        style={[
          styles.thumb,
          {
            left: Math.max(0, Math.min(thumbOffset - 12, trackWidth - 24)),
            transform: [{ scale: thumbScale }]
          }
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  touchContainer: {
    height: 36,
    justifyContent: 'center',
    position: 'relative'
  },
  track: {
    height: 5,
    borderRadius: 2.5,
    width: '100%',
    overflow: 'hidden',
    position: 'relative'
  },
  activeTrack: {
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3.5,
    elevation: 3
  }
});
