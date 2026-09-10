/**
 * HighlighterText
 * Authentic textbook highlight mark with yellow translucent ink and rounded padding.
 * 1:1 match with Swift HighlighterInk
 */

import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle, StyleProp } from 'react-native';
import { HighlighterInk } from '../constants/theme';
import { Typography } from '../constants/typography';

export interface HighlighterTextProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export const HighlighterText: React.FC<HighlighterTextProps> = ({
  children,
  style,
  containerStyle
}) => {
  return (
    <View style={[styles.container, containerStyle]} testID="highlighter-text-container">
      <Text style={[styles.text, style]}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: HighlighterInk.color,
    borderRadius: HighlighterInk.cornerRadius,
    paddingHorizontal: HighlighterInk.paddingX,
    paddingVertical: HighlighterInk.paddingY,
    alignSelf: 'flex-start'
  },
  text: {
    ...Typography.cpDescriptionMedium,
    color: '#121C33'
  }
});
