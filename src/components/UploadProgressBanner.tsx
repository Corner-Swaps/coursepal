/**
 * UploadProgressBanner
 * Floating global status banner for background OCR and syllabus parsing.
 * 1:1 match with Swift MainTabView floating upload banner
 */

import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  StyleProp
} from 'react-native';
import { CoursePalTheme } from '../constants/theme';
import { Typography } from '../constants/typography';

export interface UploadProgressBannerProps {
  title?: string;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const UploadProgressBanner: React.FC<UploadProgressBannerProps> = ({
  title = 'Processing Syllabus...',
  visible = true,
  style
}) => {
  if (!visible) return null;

  return (
    <View style={[styles.container, style]} testID="upload-progress-banner">
      <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
      <Text style={styles.text}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CoursePalTheme.accentBlue,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6
  },
  spinner: {
    marginRight: 8
  },
  text: {
    ...Typography.cpDescriptionMedium,
    color: '#FFFFFF',
    fontWeight: '600'
  }
});
