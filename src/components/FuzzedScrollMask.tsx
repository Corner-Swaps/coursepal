/**
 * FuzzedScrollMask & FuzzedScrollContainer
 * 1:1 match with Swift .fuzzedScrollEdges(top: 36, bottom: 85) from WeeklyDashboardView.swift:28-60
 *
 * Visual Mathematics:
 * - Top Fade (height = 36pt):
 *   - stop 0.00: transparent (0% opacity)
 *   - stop 0.45: black opacity 0.40
 *   - stop 1.00: black solid (100% opacity)
 * - Center: Full visibility
 * - Bottom Fade (height = 85pt):
 *   - stop 0.00: black solid (100% opacity)
 *   - stop 0.55: black opacity 0.40
 *   - stop 1.00: transparent (0% opacity)
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { CoursePalTheme } from '../constants/theme';

export interface FuzzedScrollEdgesProps {
  topHeight?: number; // Default: 36pt
  bottomHeight?: number; // Default: 85pt
  backgroundColor?: string; // Canvas color to fade into, defaults to CoursePalTheme.bgCanvas (#F2F5FA)
  style?: StyleProp<ViewStyle>;
}

export const FuzzedScrollTopFade: React.FC<{ height?: number; color?: string }> = ({
  height = 36,
  color = CoursePalTheme.bgCanvas
}) => {
  return (
    <View style={[styles.topOverlay, { height }]} pointerEvents="none" testID="fuzzed-scroll-top">
      <Svg width="100%" height={height}>
        <Defs>
          <SvgLinearGradient id="fuzzedTopGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="1.0" />
            <Stop offset="0.55" stopColor={color} stopOpacity="0.4" />
            <Stop offset="1.0" stopColor={color} stopOpacity="0.0" />
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height={height} fill="url(#fuzzedTopGradient)" />
      </Svg>
    </View>
  );
};

export const FuzzedScrollBottomFade: React.FC<{ height?: number; color?: string }> = ({
  height = 85,
  color = CoursePalTheme.bgCanvas
}) => {
  return (
    <View style={[styles.bottomOverlay, { height }]} pointerEvents="none" testID="fuzzed-scroll-bottom">
      <Svg width="100%" height={height}>
        <Defs>
          <SvgLinearGradient id="fuzzedBottomGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.0" />
            <Stop offset="0.30" stopColor={color} stopOpacity="0.20" />
            <Stop offset="0.55" stopColor={color} stopOpacity="0.55" />
            <Stop offset="0.80" stopColor={color} stopOpacity="0.88" />
            <Stop offset="1.0" stopColor={color} stopOpacity="1.0" />
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height={height} fill="url(#fuzzedBottomGradient)" />
      </Svg>
    </View>
  );
};

export interface FuzzedScrollContainerProps extends FuzzedScrollEdgesProps {
  children?: React.ReactNode;
}

export const FuzzedScrollContainer: React.FC<FuzzedScrollContainerProps> = ({
  children,
  topHeight = 36,
  bottomHeight = 85,
  backgroundColor = CoursePalTheme.bgCanvas,
  style
}) => {
  return (
    <View style={[styles.container, style]} testID="fuzzed-scroll-container">
      {children}
      {topHeight > 0 && <FuzzedScrollTopFade height={topHeight} color={backgroundColor} />}
      {bottomHeight > 0 && <FuzzedScrollBottomFade height={bottomHeight} color={backgroundColor} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden'
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40
  }
});
