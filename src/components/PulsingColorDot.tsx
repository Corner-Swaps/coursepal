import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

interface PulsingColorDotProps {
  color: string;
  isPulsing: boolean;
  size?: number;
}

export const PulsingColorDot: React.FC<PulsingColorDotProps> = ({
  color,
  isPulsing,
  size = 8
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const haloAnim = useRef(new Animated.Value(1)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isPulsing) {
      pulseAnim.setValue(1);
      haloAnim.setValue(1);
      haloOpacity.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.35,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ]),
        Animated.sequence([
          Animated.parallel([
            Animated.timing(haloAnim, {
              toValue: 2.3,
              duration: 1500,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true
            }),
            Animated.sequence([
              Animated.timing(haloOpacity, {
                toValue: 0.55,
                duration: 350,
                easing: Easing.linear,
                useNativeDriver: true
              }),
              Animated.timing(haloOpacity, {
                toValue: 0,
                duration: 1150,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true
              })
            ])
          ])
        ])
      ])
    );

    animation.start();
    return () => {
      animation.stop();
    };
  }, [isPulsing, pulseAnim, haloAnim, haloOpacity]);

  const containerSize = size * 2.4;

  return (
    <View style={[styles.container, { width: containerSize, height: containerSize }]}>
      {isPulsing && (
        <Animated.View
          style={[
            styles.halo,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity: haloOpacity,
              transform: [{ scale: haloAnim }]
            }
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            transform: [{ scale: isPulsing ? pulseAnim : 1 }]
          }
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  halo: {
    position: 'absolute'
  },
  dot: {
    zIndex: 1
  }
});
