/**
 * SlideUpModal
 * Authentic Apple-standard slide-up bottom sheet modal with:
 * - Fluid spring entrance animation (translateY: offscreen -> 0)
 * - Smooth stationary backdrop dimming (opacity: 0 -> 1)
 * - Drag-to-dismiss PanResponder with 1:1 finger tracking and rubber banding
 * - Smooth slide-down exit animation (translateY: 0 -> offscreen)
 * - Light haptic feedback on dismiss
 * - useNativeDriver: true for 120Hz ProMotion smoothness
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
  Dimensions,
  Easing,
  StyleProp,
  ViewStyle
} from 'react-native';
import { haptics } from '../services/HapticsService';

export interface SlideUpModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  showDragHandle?: boolean;
  testID?: string;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DEFAULT_SHEET_OFFSET = Math.max(500, SCREEN_HEIGHT * 0.65);

export const SlideUpModal: React.FC<SlideUpModalProps> = ({
  visible,
  onClose,
  children,
  contentStyle,
  showDragHandle = true,
  testID
}) => {
  const [isRendered, setIsRendered] = useState<boolean>(visible);
  const translateY = useRef(new Animated.Value(DEFAULT_SHEET_OFFSET)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isDismissing = useRef<boolean>(false);

  // Trigger entrance when visible becomes true
  useEffect(() => {
    if (visible) {
      isDismissing.current = false;
      setIsRendered(true);
      translateY.setValue(DEFAULT_SHEET_OFFSET);
      backdropOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 28,
          mass: 0.85,
          stiffness: 280,
          useNativeDriver: true
        })
      ]).start();
    } else if (isRendered && !isDismissing.current) {
      // Parent changed visible to false, animate down
      triggerDismiss();
    }
  }, [visible]);

  const triggerDismiss = (callback?: () => void) => {
    if (isDismissing.current) return;
    isDismissing.current = true;

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: DEFAULT_SHEET_OFFSET,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(() => {
      setIsRendered(false);
      isDismissing.current = false;
      if (callback) {
        callback();
      } else {
        onClose();
      }
    });
  };

  // PanResponder for drag-to-dismiss on the sheet / drag handle
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture intentional downward drag
        return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          // Downward drag tracks finger 1:1
          translateY.setValue(gestureState.dy);
        } else {
          // Upward overscroll has rubber-band dampening
          translateY.setValue(gestureState.dy * 0.2);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.8) {
          // Exceeded dismiss threshold
          haptics.impactLight();
          triggerDismiss();
        } else {
          // Spring back to rest position
          Animated.spring(translateY, {
            toValue: 0,
            damping: 26,
            stiffness: 280,
            useNativeDriver: true
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          damping: 26,
          stiffness: 280,
          useNativeDriver: true
        }).start();
      }
    })
  ).current;

  if (!isRendered) return null;

  return (
    <View
      style={styles.outerContainer}
      testID={testID}
      pointerEvents={isDismissing.current ? 'none' : 'box-none'}
    >
      {/* Stationary Dimmed Backdrop that Fades In / Out */}
      <TouchableWithoutFeedback onPress={() => triggerDismiss()}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity
            }
          ]}
          testID="slide-up-modal-backdrop"
        />
      </TouchableWithoutFeedback>

      {/* Sheet Card Translating Up / Down */}
      <Animated.View
        style={[
          styles.modalCard,
          contentStyle,
          {
            transform: [{ translateY }]
          }
        ]}
        testID="slide-up-modal-card"
      >
        {/* Drag Handle Touch Area with PanResponder */}
        <View
          {...panResponder.panHandlers}
          style={styles.dragHandleContainer}
          hitSlop={{ top: 16, bottom: 16, left: 32, right: 32 }}
          testID="slide-up-drag-handle"
        >
          {showDragHandle && <View style={styles.dragHandlePill} />}
        </View>

        {/* Modal Content */}
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.38)'
  },
  modalCard: {
    backgroundColor: '#F2F5FA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 14
  },
  dragHandlePill: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#C7D1E0'
  }
});
