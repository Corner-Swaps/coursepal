/**
 * BottomSheetPanContainer
 * Native-feeling iOS modal sheet container with fluid drag-to-dismiss PanResponder,
 * top indicator pill, rubber-band resistance, and spring dismiss/return physics.
 *
 * Visual & Touch Mechanics:
 * - Top Corners: UnevenRoundedRectangle topLeadingRadius 24, topTrailingRadius 24
 * - Indicator Pill: width 36pt, height 5pt, borderRadius 2.5pt, fill rgba(60, 60, 67, 0.28)
 * - Downward Drag: tracks dy directly
 * - Upward Overscroll: dampened with factor 0.25
 * - Dismiss Threshold: dy > 120pt OR vy > 1.2
 * - Return Spring: bounciness: 4, speed: 14
 */

import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  PanResponder,
  Animated,
  PanResponderGestureState,
  GestureResponderEvent
} from 'react-native';
import { CoursePalTheme } from '../constants/theme';
import { haptics } from '../services/HapticsService';

export interface BottomSheetPanContainerProps {
  children?: React.ReactNode;
  onDismiss: () => void;
  showIndicator?: boolean;
  dismissThreshold?: number;
  style?: StyleProp<ViewStyle>;
}

export const BottomSheetPanContainer: React.FC<BottomSheetPanContainerProps> = ({
  children,
  onDismiss,
  showIndicator = true,
  dismissThreshold = 120,
  style
}) => {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState: PanResponderGestureState) => {
        if (gestureState.dy > 0) {
          // Downward drag tracks linearly
          translateY.setValue(gestureState.dy);
        } else {
          // Upward drag with rubber-band resistance
          translateY.setValue(gestureState.dy * 0.25);
        }
      },
      onPanResponderRelease: (_, gestureState: PanResponderGestureState) => {
        if (gestureState.dy > dismissThreshold || gestureState.vy > 1.2) {
          // Dismiss sheet
          haptics.impactLight();
          Animated.timing(translateY, {
            toValue: 600,
            duration: 220,
            useNativeDriver: false
          }).start(() => {
            onDismiss();
          });
        } else {
          // Spring back
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 4,
            speed: 14,
            useNativeDriver: false
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          bounciness: 4,
          speed: 14,
          useNativeDriver: false
        }).start();
      }
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          transform: [{ translateY }]
        },
        style
      ]}
      testID="bottom-sheet-pan-container"
    >
      {/* Top Drag Handle Header with Hit-Slop */}
      <View
        {...panResponder.panHandlers}
        style={styles.dragHandleContainer}
        hitSlop={{ top: 16, bottom: 16, left: 24, right: 24 }}
        testID="bottom-sheet-drag-handle"
      >
        {showIndicator && <View style={styles.indicatorPill} />}
      </View>

      {/* Sheet Content */}
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: CoursePalTheme.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
    width: '100%',
    overflow: 'hidden'
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12
  },
  indicatorPill: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(60, 60, 67, 0.28)'
  },
  content: {
    flex: 1
  }
});
