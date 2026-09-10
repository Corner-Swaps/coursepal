/**
 * AppIconLogoView
 * Authentic Apple squircle application icon with border overlay and elevation shadow.
 * 1:1 match with Swift AppIconLogoView
 */

import React from 'react';
import { View, Image, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { ImageAssets } from '../assets';

export interface AppIconLogoProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export type AppIconLogoViewProps = AppIconLogoProps;

export const AppIconLogo: React.FC<AppIconLogoProps> = ({
  size = 80,
  style
}) => {
  const borderRadius = size * 0.22;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius
        },
        style
      ]}
      testID="app-icon-logo-view"
    >
      <Image
        source={ImageAssets.appLogo}
        style={{
          width: size,
          height: size,
          borderRadius
        }}
        resizeMode="cover"
      />
      <View
        style={[
          styles.borderOverlay,
          {
            borderRadius
          }
        ]}
        pointerEvents="none"
      />
    </View>
  );
};

export const AppIconLogoView = AppIconLogo;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)'
  }
});
