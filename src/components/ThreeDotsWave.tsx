import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, StyleProp, ViewStyle } from 'react-native';

export interface ThreeDotsWaveProps {
  size?: number;
  color?: string;
  dotSpacing?: number;
  waveHeight?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * ThreeDotsWave
 * Fluid Apple-style animated 3-circle wave.
 * Circles smoothly rise and fall sequentially in a continuous wave pattern.
 */
export const ThreeDotsWave: React.FC<ThreeDotsWaveProps> = ({
  size = 5.5,
  color = '#FFFFFF',
  dotSpacing = 3.5,
  waveHeight = 3.5,
  style,
  testID = 'three-dots-wave'
}) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createContinuousLoop = (anim: Animated.Value) => {
      anim.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 440,
            easing: Easing.bezier(0.42, 0.0, 0.58, 1.0),
            useNativeDriver: true
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 440,
            easing: Easing.bezier(0.42, 0.0, 0.58, 1.0),
            useNativeDriver: true
          })
        ])
      );
    };

    const l1 = createContinuousLoop(dot1);
    const l2 = createContinuousLoop(dot2);
    const l3 = createContinuousLoop(dot3);

    l1.start();
    const t2 = setTimeout(() => l2.start(), 150);
    const t3 = setTimeout(() => l3.start(), 300);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [dot1, dot2, dot3]);

  const renderDot = (anim: Animated.Value, key: string) => {
    const translateY = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -waveHeight]
    });
    const opacity = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.45, 1.0]
    });
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.94, 1.06]
    });

    return (
      <Animated.View
        key={key}
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            marginHorizontal: dotSpacing / 2,
            opacity,
            transform: [{ translateY }, { scale }]
          }
        ]}
      />
    );
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {renderDot(dot1, 'dot-1')}
      {renderDot(dot2, 'dot-2')}
      {renderDot(dot3, 'dot-3')}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 20
  },
  dot: {
    // Dynamic dimensions applied in renderDot
  }
});
