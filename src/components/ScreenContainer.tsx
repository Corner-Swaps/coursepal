/**
 * ScreenContainer
 * Responsive root screen container providing sub-pixel safe area layout,
 * customizable background canvas, and optional fuzzed scroll edge masks.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, StatusBar } from 'react-native';
import { CoursePalTheme } from '../constants/theme';
import { useScreenGeometry } from '../hooks/useScreenGeometry';
import { FuzzedScrollContainer } from './FuzzedScrollMask';

export interface ScreenContainerProps {
  children?: React.ReactNode;
  backgroundColor?: string;
  includeTopSafe?: boolean;
  includeBottomSafe?: boolean;
  fuzzedEdges?: boolean;
  statusBarStyle?: 'dark-content' | 'light-content';
  style?: StyleProp<ViewStyle>;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  backgroundColor = CoursePalTheme.bgCanvas,
  includeTopSafe = true,
  includeBottomSafe = false,
  fuzzedEdges = false,
  statusBarStyle = 'dark-content',
  style
}) => {
  const { insets } = useScreenGeometry();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
    paddingTop: includeTopSafe ? insets.top : 0,
    paddingBottom: includeBottomSafe ? insets.bottom : 0
  };

  const content = fuzzedEdges ? (
    <FuzzedScrollContainer backgroundColor={backgroundColor} style={styles.flex}>
      {children}
    </FuzzedScrollContainer>
  ) : (
    children
  );

  return (
    <View style={[containerStyle, style]} testID="screen-container">
      <StatusBar barStyle={statusBarStyle} backgroundColor="transparent" translucent />
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1
  }
});
