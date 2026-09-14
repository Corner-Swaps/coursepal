import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  PanResponderGestureState,
  Dimensions
} from 'react-native';
import { haptics } from '../services/HapticsService';

const SCREEN_WIDTH = Dimensions.get('window').width;
// Half of the screen width threshold for delete
const HALFWAY_THRESHOLD = -SCREEN_WIDTH * 0.48;

export interface SwipeableRowProps {
  children?: React.ReactNode;
  onDelete: () => void;
  enabled?: boolean;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  onDelete,
  enabled = true
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const hasTriggeredHaptic = useRef(false);
  const isDeleting = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!enabled || isDeleting.current) return false;
        return (
          gestureState.dx < -10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4
        );
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (!enabled || isDeleting.current) return false;
        return (
          gestureState.dx < -10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4
        );
      },
      onPanResponderGrant: () => {
        hasTriggeredHaptic.current = false;
      },
      onPanResponderMove: (_, gestureState: PanResponderGestureState) => {
        if (!enabled || isDeleting.current) return;
        if (gestureState.dx <= 0) {
          // Allow sliding all the way across the screen
          translateX.setValue(gestureState.dx);

          // Haptic tick when passing the halfway deletion threshold
          if (gestureState.dx < HALFWAY_THRESHOLD && !hasTriggeredHaptic.current) {
            hasTriggeredHaptic.current = true;
            haptics.impactMedium();
          } else if (gestureState.dx >= HALFWAY_THRESHOLD && hasTriggeredHaptic.current) {
            hasTriggeredHaptic.current = false;
          }
        } else {
          // Prevent sliding to the right to avoid revealing background on left
          translateX.setValue(0);
        }
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderRelease: (_, gestureState: PanResponderGestureState) => {
        if (!enabled || isDeleting.current) return;
        const pastHalfway = gestureState.dx < HALFWAY_THRESHOLD;
        const fastFlick = gestureState.vx < -0.7;
        const shouldDelete = pastHalfway || fastFlick;

        if (shouldDelete) {
          isDeleting.current = true;
          haptics.notifySuccess();
          // Slide all the way off-screen smoothly before triggering deletion
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH - 60,
            duration: 200,
            useNativeDriver: true
          }).start(() => {
            onDelete();
            translateX.setValue(0);
            isDeleting.current = false;
            hasTriggeredHaptic.current = false;
          });
        } else {
          hasTriggeredHaptic.current = false;
          // Spring back smoothly to origin
          Animated.spring(translateX, {
            toValue: 0,
            bounciness: 6,
            speed: 16,
            useNativeDriver: true
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (isDeleting.current) return;
        hasTriggeredHaptic.current = false;
        // Never leave row stuck/frozen; spring back to 0
        Animated.spring(translateX, {
          toValue: 0,
          bounciness: 6,
          speed: 16,
          useNativeDriver: true
        }).start();
      }
    })
  ).current;

  // Fade in red backdrop as user begins swiping left
  const backdropOpacity = translateX.interpolate({
    inputRange: [-16, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp'
  });

  if (!enabled) {
    return <View>{children}</View>;
  }

  return (
    <View style={styles.container}>
      {/* Full crimson red backdrop revealed behind the sliding card (no trashcan icon) */}
      <Animated.View
        style={[
          styles.backdrop,
          { opacity: backdropOpacity }
        ]}
        pointerEvents="none"
      />

      {/* Front Swiping Card Content */}
      <Animated.View
        style={[
          styles.frontCard,
          { transform: [{ translateX }] }
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    borderRadius: 16
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D94033',
    borderRadius: 16
  },
  frontCard: {
    width: '100%',
    backgroundColor: 'transparent'
  }
});
