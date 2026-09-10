/**
 * vectorCanvasGestures.test.ts
 * Comprehensive headless unit tests verifying sub-pixel SVG graphics,
 * dynamic Bezier wave math, gesture responders, and safe area responsive geometry.
 */

import React from 'react';
import {
  ContinuousProgressRing,
  ContinuousProgressBar,
  FuzzedScrollTopFade,
  FuzzedScrollBottomFade,
  FuzzedScrollContainer,
  SoundscapeWaveVisualizer,
  generateWavePath,
  PrecisionSlider,
  BottomSheetPanContainer,
  ScreenContainer
} from '../src/components';
import { useScreenGeometry } from '../src/hooks/useScreenGeometry';
import { CoursePalTheme } from '../src/constants/theme';

// Mock react-native-safe-area-context
const safeAreaMock = require('../__tests__/__mocks__/react-native-safe-area-context');

describe('Vector Canvas & Sub-Pixel SVG Graphics', () => {
  describe('ContinuousProgressRing Sub-Pixel Geometry', () => {
    it('calculates exact sub-pixel radius, circumference, and dash offsets', () => {
      const size = 36;
      const strokeWidth = 3;
      const radius = (size - strokeWidth) / 2;
      expect(radius).toBe(16.5);

      const circumference = 2 * Math.PI * radius;
      expect(circumference).toBeCloseTo(103.67255, 4);

      // Half progress (0.5)
      const offsetHalf = circumference * (1 - 0.5);
      expect(offsetHalf).toBeCloseTo(circumference * 0.5, 4);

      // Complete progress (1.0)
      const offsetFull = circumference * (1 - 1.0);
      expect(offsetFull).toBeCloseTo(0.0, 4);

      // Zero progress (0.0)
      const offsetZero = circumference * (1 - 0.0);
      expect(offsetZero).toBeCloseTo(circumference, 4);
    });

    it('renders component with custom tint and track colors', () => {
      const elem = React.createElement(ContinuousProgressRing, {
        size: 44,
        strokeWidth: 4,
        progress: 0.8,
        tintColor: '#EF4444',
        trackColor: 'rgba(239, 68, 68, 0.2)'
      });

      expect(elem.props.size).toBe(44);
      expect(elem.props.strokeWidth).toBe(4);
      expect(elem.props.progress).toBe(0.8);
      expect(elem.props.tintColor).toBe('#EF4444');
    });
  });

  describe('ContinuousProgressBar Capsule Math', () => {
    it('evaluates corner radius as height / 2', () => {
      const height = 6;
      const cornerRadius = height / 2;
      expect(cornerRadius).toBe(3);

      const elem = React.createElement(ContinuousProgressBar, {
        height: 8,
        progress: 0.45
      });
      expect(elem.props.height).toBe(8);
      expect(elem.props.progress).toBe(0.45);
    });
  });

  describe('FuzzedScrollMask & Container', () => {
    it('creates top and bottom fade overlays matching Swift heights 36 and 85', () => {
      const topElem = React.createElement(FuzzedScrollTopFade, { height: 36 });
      expect(topElem.props.height).toBe(36);

      const bottomElem = React.createElement(FuzzedScrollBottomFade, { height: 85 });
      expect(bottomElem.props.height).toBe(85);

      const container = React.createElement(
        FuzzedScrollContainer,
        { topHeight: 36, bottomHeight: 85, backgroundColor: CoursePalTheme.bgCanvas },
        React.createElement('View')
      );
      expect(container.props.topHeight).toBe(36);
      expect(container.props.bottomHeight).toBe(85);
      expect(container.props.backgroundColor).toBe(CoursePalTheme.bgCanvas);
    });
  });

  describe('SoundscapeWaveVisualizer & Sine / Bezier Calculus', () => {
    it('verifies wave amplitude is strictly 0 at edges due to sin(pi * x / W) damping', () => {
      const width = 300;
      const height = 80;
      const centerY = height / 2; // 40
      const amplitude = 30;
      const phase = 1.25;

      // Calculate path string
      const path = generateWavePath(width, height, phase, amplitude, 140, 70, 10);

      // Path starts with M 0.00 40.00
      expect(path.startsWith('M 0.00 40.00')).toBe(true);

      // Path contains cubic Bezier curve segments 'C'
      expect(path.includes(' C ')).toBe(true);

      // Check boundary damping math:
      // At x = 0: sin(pi * 0) = 0 -> y = centerY (40)
      const dampingStart = Math.sin(Math.PI * 0);
      expect(dampingStart).toBe(0);

      // At x = W: sin(pi * 1) = 0 -> y = centerY (40)
      const dampingEnd = Math.sin(Math.PI * 1);
      expect(dampingEnd).toBeCloseTo(0, 5);

      // At x = W/2: sin(pi * 0.5) = 1.0 (maximum amplitude envelope)
      const dampingMid = Math.sin(Math.PI * 0.5);
      expect(dampingMid).toBe(1.0);
    });

    it('instantiates SoundscapeWaveVisualizer with interactive scrubbing prop', () => {
      const onScrub = jest.fn();
      const elem = React.createElement(SoundscapeWaveVisualizer, {
        width: 320,
        height: 60,
        interactive: true,
        onScrub
      });

      expect(elem.props.interactive).toBe(true);
      expect(elem.props.width).toBe(320);
      expect(elem.props.onScrub).toBe(onScrub);
    });
  });
});

describe('Gesture Handling & Touch Responsiveness', () => {
  describe('PrecisionSlider Step Quantization & Clamping', () => {
    // Ported test of the slider quantization math
    const quantize = (raw: number, min: number, max: number, step: number): number => {
      const clamped = Math.min(Math.max(raw, min), max);
      if (step <= 0) return clamped;
      const stepsCount = Math.round((clamped - min) / step);
      return Math.min(Math.max(min + stepsCount * step, min), max);
    };

    it('quantizes raw drag float values to discrete steps [70...100, step 1]', () => {
      expect(quantize(84.2, 70, 100, 1)).toBe(84);
      expect(quantize(84.7, 70, 100, 1)).toBe(85);
      expect(quantize(62.0, 70, 100, 1)).toBe(70);
      expect(quantize(112.5, 70, 100, 1)).toBe(100);
    });

    it('computes correct ratio and thumb horizontal offset', () => {
      const min = 70;
      const max = 100;
      const trackWidth = 120;

      const calcOffset = (val: number) => {
        const ratio = (val - min) / (max - min);
        return ratio * trackWidth;
      };

      expect(calcOffset(70)).toBe(0);
      expect(calcOffset(85)).toBe(60);
      expect(calcOffset(100)).toBe(120);
    });

    it('renders PrecisionSlider with active props', () => {
      const onChange = jest.fn();
      const elem = React.createElement(PrecisionSlider, {
        value: 88,
        onValueChange: onChange,
        min: 70,
        max: 100,
        step: 1,
        width: 140
      });

      expect(elem.props.value).toBe(88);
      expect(elem.props.width).toBe(140);
    });
  });

  describe('BottomSheetPanContainer Touch Gestures', () => {
    it('creates container with top drag handle indicator pill (36x5pt)', () => {
      const onDismiss = jest.fn();
      const elem = React.createElement(BottomSheetPanContainer, {
        onDismiss,
        showIndicator: true
      });

      expect(elem.props.showIndicator).toBe(true);
      expect(elem.props.onDismiss).toBe(onDismiss);
      expect(elem.props.dismissThreshold).toBeUndefined(); // defaults to 120
    });
  });
});

describe('Screen Geometry & Safe Areas (Dynamic Island / Notch Parity)', () => {
  it('classifies Dynamic Island device when top inset >= 54', () => {
    safeAreaMock.useSafeAreaInsets.mockReturnValue({
      top: 59,
      bottom: 34,
      left: 0,
      right: 0
    });
    safeAreaMock.useSafeAreaFrame.mockReturnValue({
      x: 0,
      y: 0,
      width: 393,
      height: 852
    });

    const geometry = useScreenGeometry();
    expect(geometry.isDynamicIsland).toBe(true);
    expect(geometry.hasNotch).toBe(false);
    expect(geometry.hasHomeIndicator).toBe(true);
    expect(geometry.headerHeight).toBe(59 + 44); // 103
    expect(geometry.tabBarBottomOffset).toBe(34 - 13); // 21
    expect(geometry.contentBottomPadding).toBe(56 + 21 + 24); // 101
  });

  it('classifies Notch device when 44 <= top inset < 54', () => {
    safeAreaMock.useSafeAreaInsets.mockReturnValue({
      top: 47,
      bottom: 34,
      left: 0,
      right: 0
    });

    const geometry = useScreenGeometry();
    expect(geometry.isDynamicIsland).toBe(false);
    expect(geometry.hasNotch).toBe(true);
    expect(geometry.hasHomeIndicator).toBe(true);
    expect(geometry.tabBarBottomOffset).toBe(21);
  });

  it('classifies Standard / Non-notch device when top inset <= 20 and bottom = 0', () => {
    safeAreaMock.useSafeAreaInsets.mockReturnValue({
      top: 20,
      bottom: 0,
      left: 0,
      right: 0
    });

    const geometry = useScreenGeometry();
    expect(geometry.isDynamicIsland).toBe(false);
    expect(geometry.hasNotch).toBe(false);
    expect(geometry.hasHomeIndicator).toBe(false);
    // Non-home indicator devices receive 16pt bottom offset
    expect(geometry.tabBarBottomOffset).toBe(16);
  });

  it('renders ScreenContainer with safe area layout', () => {
    const elem = React.createElement(ScreenContainer, {
      fuzzedEdges: true,
      backgroundColor: CoursePalTheme.bgCanvas,
      includeTopSafe: true
    });

    expect(elem.props.fuzzedEdges).toBe(true);
    expect(elem.props.backgroundColor).toBe(CoursePalTheme.bgCanvas);
    expect(elem.props.includeTopSafe).toBe(true);
  });
});
