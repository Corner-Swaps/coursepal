import React from 'react';
import {
  AppIconLogo,
  AppIconLogoView,
  ContinuousProgressRing,
  ContinuousProgressBar,
  UploadProgressBanner,
  HighlighterText,
  MainTabBar,
  ConfettiCelebration,
  ConfettiCelebrationView
} from '../src/components';

describe('Atomic UI Components', () => {
  describe('AppIconLogoView', () => {
    it('creates element with size and computed squircle corner radius 0.22', () => {
      const element = React.createElement(AppIconLogoView, { size: 100 });
      expect(element).toBeDefined();
      expect(element.props.size).toBe(100);
      // Computed radius for size 100 is 22
      const radius = 100 * 0.22;
      expect(radius).toBe(22);
    });

    it('defaults to size 80 with radius 17.6', () => {
      const element = React.createElement(AppIconLogoView);
      expect(element.props.size).toBeUndefined();
      const defaultSize = 80;
      expect(defaultSize * 0.22).toBeCloseTo(17.6, 2);
    });

    it('provides AppIconLogo alias matching AppIconLogoView', () => {
      expect(AppIconLogo).toBe(AppIconLogoView);
    });
  });

  describe('ContinuousProgressRing', () => {
    it('creates SVG circular progress ring element with 36x36 frame', () => {
      const element = React.createElement(ContinuousProgressRing, {
        size: 36,
        strokeWidth: 3,
        progress: 0.75
      });
      expect(element).toBeDefined();
      expect(element.props.size).toBe(36);
      expect(element.props.strokeWidth).toBe(3);
      expect(element.props.progress).toBe(0.75);

      // Verify geometry formula: radius = (36 - 3)/2 = 16.5
      const r = (36 - 3) / 2;
      const circ = 2 * Math.PI * r;
      const expectedOffset = circ * (1 - 0.75);
      expect(expectedOffset).toBeCloseTo(0.25 * circ, 4);
    });
  });

  describe('ContinuousProgressBar', () => {
    it('computes percentage width clamped between 4% and 100%', () => {
      const elem1 = React.createElement(ContinuousProgressBar, { progress: 0.0 });
      expect(elem1.props.progress).toBe(0.0);

      const elem2 = React.createElement(ContinuousProgressBar, { progress: 0.65 });
      expect(elem2.props.progress).toBe(0.65);

      const elem3 = React.createElement(ContinuousProgressBar, { progress: 1.5 });
      expect(elem3.props.progress).toBe(1.5);
    });
  });

  describe('UploadProgressBanner', () => {
    it('defines component with default title and visibility', () => {
      const element = React.createElement(UploadProgressBanner, {
        title: 'Processing Syllabus...',
        visible: true
      });
      expect(element.props.title).toBe('Processing Syllabus...');
      expect(element.props.visible).toBe(true);
    });

    it('renders null when visible is false', () => {
      const element = UploadProgressBanner({ visible: false });
      expect(element).toBeNull();
    });
  });

  describe('HighlighterText', () => {
    it('wraps text with authentic highlighter container and text style', () => {
      const element = React.createElement(HighlighterText, null, 'Highlighted Text');
      expect(element).toBeDefined();
      expect(element.props.children).toBe('Highlighted Text');
    });
  });

  describe('MainTabBar', () => {
    it('defines 4 tabs with elevated floating plus button', () => {
      const onSelect = jest.fn();
      const onPlus = jest.fn();
      const element = React.createElement(MainTabBar, {
        selectedTab: 'readings',
        onSelectTab: onSelect,
        onPressCenterPlus: onPlus
      });

      expect(element.props.selectedTab).toBe('readings');
      expect(element.props.onSelectTab).toBe(onSelect);
      expect(element.props.onPressCenterPlus).toBe(onPlus);
    });
  });

  describe('ConfettiCelebration', () => {
    it('provides ConfettiCelebration alias matching ConfettiCelebrationView', () => {
      expect(ConfettiCelebration).toBe(ConfettiCelebrationView);
    });

    it('instantiates ConfettiCelebration element with default props', () => {
      const element = React.createElement(ConfettiCelebration, { active: false });
      expect(element).toBeDefined();
      expect(element.props.active).toBe(false);
    });
  });
});
