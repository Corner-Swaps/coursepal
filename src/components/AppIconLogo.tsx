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
  testID?: string;
}

export type AppIconLogoViewProps = AppIconLogoProps;

export const AppIconLogo: React.FC<AppIconLogoProps> = ({
  size = 80,
  style,
  testID = 'app-icon-logo-view'
}) => {
  const borderRadius = size * 0.22;
  const shadowRadius = Math.max(2, size * 0.1);
  const shadowHeight = Math.max(1, Math.round(size * 0.04));

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          shadowRadius,
          shadowOffset: { width: 0, height: shadowHeight }
        },
        style
      ]}
      testID={testID}
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
