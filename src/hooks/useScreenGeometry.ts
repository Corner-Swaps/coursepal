/**
 * useScreenGeometry
 * Responsive screen geometry & safe area calculus.
 * Seamlessly supports Dynamic Island, Notch, Home Indicator, and diverse iPhone form factors.
 *
 * Inset Classification:
 * - Dynamic Island: insets.top >= 54
 * - Notch: 44 <= insets.top < 54
 * - Standard / Non-notch: insets.top < 44
 * - Home Indicator: insets.bottom >= 20
 */

import { useSafeAreaInsets, useSafeAreaFrame } from 'react-native-safe-area-context';

export interface ScreenGeometry {
  insets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  frame: {
    width: number;
    height: number;
  };
  // Device classification
  isDynamicIsland: boolean;
  hasNotch: boolean;
  hasHomeIndicator: boolean;
  isCompactWidth: boolean;
  isMaxDevice: boolean;

  // Exact UI layout clearance heights
  headerHeight: number;
  headerContentTop: number;
  tabBarHeight: number;
  tabBarBottomOffset: number;
  contentBottomPadding: number;
  modalTopPadding: number;
}

export function useScreenGeometry(): ScreenGeometry {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();

  const isDynamicIsland = insets.top >= 54;
  const hasNotch = insets.top >= 44 && insets.top < 54;
  const hasHomeIndicator = insets.bottom >= 20;

  const isCompactWidth = frame.width < 375;
  const isMaxDevice = frame.width >= 428;

  // Header heights
  const headerContentTop = Math.max(insets.top, 20);
  const headerHeight = headerContentTop + 44;

  // Tab bar metrics matching Swift MainTabView floating pill
  // Height of the tab pill bar is 56pt; center plus button rises 18pt above
  const tabBarHeight = 56;
  const tabBarBottomOffset = hasHomeIndicator ? Math.max(insets.bottom - 13, 10) : 16;
  const contentBottomPadding = tabBarHeight + tabBarBottomOffset + 24;

  // Modal sheet top safe clearance
  const modalTopPadding = isDynamicIsland ? 54 : hasNotch ? 44 : 24;

  return {
    insets,
    frame,
    isDynamicIsland,
    hasNotch,
    hasHomeIndicator,
    isCompactWidth,
    isMaxDevice,
    headerHeight,
    headerContentTop,
    tabBarHeight,
    tabBarBottomOffset,
    contentBottomPadding,
    modalTopPadding
  };
}
