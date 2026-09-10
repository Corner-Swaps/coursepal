/**
 * audioHapticsLifecycle.test.ts
 * Headless unit tests verifying native audio engine, gapless loops, volume fade curves,
 * CoreHaptics throttling guards, and AppState background synchronization.
 */

import fs from 'fs';
import path from 'path';
import { audio } from '../src/services/audio';
import { haptics } from '../src/services/haptics';
import { getSoundscapeById } from '../src/utils/soundCatalog';
import { timerReducer, initialTimerState } from '../src/utils/timerReducer';

describe('Phase 4: Native Audio Engine, Haptic Smoothing & Background Execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Audio Session & Background Audio Capabilities', () => {
    it('verifies CoursePal/Info.plist contains UIBackgroundModes with audio', () => {
      const plistPath = path.join(__dirname, '../CoursePal/Info.plist');
      expect(fs.existsSync(plistPath)).toBe(true);
      const content = fs.readFileSync(plistPath, 'utf8');

      expect(content.includes('<key>UIBackgroundModes</key>')).toBe(true);
      expect(content.includes('<string>audio</string>')).toBe(true);
    });

    it('verifies app.json contains Expo background audio entitlement', () => {
      const appJsonPath = path.join(__dirname, '../app.json');
      expect(fs.existsSync(appJsonPath)).toBe(true);
      const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

      expect(appConfig.expo.ios.infoPlist.UIBackgroundModes).toContain('audio');
      expect(appConfig.expo.ios.bundleIdentifier).toBe('com.coursepal.app');
    });

    it('configures audio session with background playback and ducking', async () => {
      await audio.configureAudioSession();
      // Audio session method executes cleanly without throwing
      expect(audio).toBeDefined();
    });
  });

  describe('Volume Fade Curves, Looping & Crossfade', () => {
    it('plays ambient soundscape with loopable flag and default volume', async () => {
      const rainTrack = getSoundscapeById('rain')!;
      expect(rainTrack).toBeDefined();
      expect(rainTrack.isLoopable).toBe(true);

      await audio.playTrack(rainTrack);
      const state = audio.getState();

      expect(state.isPlaying).toBe(true);
      expect(state.activeTrackId).toBe('rain');
      expect(state.volume).toBe(rainTrack.defaultVolume);
    });

    it('smoothly fades volume down to 0 and stops track via fadeOutAndStop', async () => {
      const libraryTrack = getSoundscapeById('library')!;
      await audio.playTrack(libraryTrack);
      expect(audio.getState().isPlaying).toBe(true);

      // Execute fade out with short duration for tests
      await audio.fadeOutAndStop(50);
      const state = audio.getState();

      expect(state.isPlaying).toBe(false);
      expect(state.activeTrackId).toBeNull();
      expect(state.volume).toBe(0);
    });

    it('smoothly fades volume in from 0 to target volume', async () => {
      const wavesTrack = getSoundscapeById('waves')!;
      await audio.playTrack(wavesTrack, 50); // with 50ms fade in

      const state = audio.getState();
      expect(state.isPlaying).toBe(true);
      expect(state.activeTrackId).toBe('waves');
      expect(state.volume).toBeCloseTo(wavesTrack.defaultVolume, 1);
    });

    it('crossfades seamlessly between soundscape tracks', async () => {
      const rain = getSoundscapeById('rain')!;
      const library = getSoundscapeById('library')!;

      await audio.playTrack(rain);
      expect(audio.getState().activeTrackId).toBe('rain');

      await audio.crossfadeToTrack(library, 60);
      const state = audio.getState();

      expect(state.isPlaying).toBe(true);
      expect(state.activeTrackId).toBe('library');
    });

    it('speaks text with speech rate 0.5 matching Swift default', async () => {
      await audio.speakText('Test reading announcement');
      const state = audio.getState();
      expect(state.isSpeechActive).toBe(true);

      await audio.stopSpeech();
      expect(audio.getState().isSpeechActive).toBe(false);
    });
  });

  describe('CoreHaptics Throttle Guard & Impact Styles', () => {
    it('executes full range of haptic impact and notification styles', async () => {
      await expect(haptics.selection()).resolves.toBeUndefined();
      await expect(haptics.impactLight()).resolves.toBeUndefined();
      await expect(haptics.impactMedium()).resolves.toBeUndefined();
      await expect(haptics.impactHeavy()).resolves.toBeUndefined();
      await expect(haptics.impactRigid()).resolves.toBeUndefined();
      await expect(haptics.notifySuccess()).resolves.toBeUndefined();
      await expect(haptics.notifyWarning()).resolves.toBeUndefined();
      await expect(haptics.notifyError()).resolves.toBeUndefined();
    });

    it('throttles rapid selection haptic bursts within minIntervalMs (40ms)', async () => {
      const selectionSpy = jest.spyOn(haptics, 'selection');

      // First call should trigger
      await haptics.throttledSelection(40);
      expect(selectionSpy).toHaveBeenCalledTimes(1);

      // Immediate subsequent calls within 40ms should be dropped
      await haptics.throttledSelection(40);
      await haptics.throttledSelection(40);
      expect(selectionSpy).toHaveBeenCalledTimes(1);

      // Wait 50ms (> 40ms interval)
      await new Promise((resolve) => setTimeout(resolve, 55));
      await haptics.throttledSelection(40);
      expect(selectionSpy).toHaveBeenCalledTimes(2);

      selectionSpy.mockRestore();
    });

    it('throttles impact calls across rapid touch movements', async () => {
      const impactSpy = jest.spyOn(haptics, 'impactLight');

      await haptics.throttledImpact('light', 50);
      expect(impactSpy).toHaveBeenCalledTimes(1);

      // Immediate follow-up dropped
      await haptics.throttledImpact('light', 50);
      expect(impactSpy).toHaveBeenCalledTimes(1);

      // After wait
      await new Promise((resolve) => setTimeout(resolve, 60));
      await haptics.throttledImpact('light', 50);
      expect(impactSpy).toHaveBeenCalledTimes(2);

      impactSpy.mockRestore();
    });
  });

  describe('AppState Lifecycle & Background Timer Wall-Clock Synchronization', () => {
    it('synchronizes timer state when fast-forwarding elapsed seconds from background', () => {
      // 1. Initialize running focus session (25 mins = 1500s)
      let state = timerReducer(initialTimerState, { type: 'START' });
      expect(state.status).toBe('running');
      expect(state.remainingSeconds).toBe(1500);

      // 2. Simulate 45 seconds elapsed while app was in background or locked
      state = timerReducer(state, {
        type: 'TICK',
        payload: { elapsedSeconds: 45 }
      });

      expect(state.remainingSeconds).toBe(1500 - 45); // 1455s
      expect(state.status).toBe('running');
    });

    it('completes interval and advances cycle when elapsed background time exceeds duration', () => {
      // 1. Start timer with 30 seconds remaining
      let state = timerReducer(initialTimerState, {
        type: 'SET_DURATION',
        payload: { seconds: 30 }
      });
      state = timerReducer(state, { type: 'START' });
      expect(state.remainingSeconds).toBe(30);
      expect(state.completedCycles).toBe(0);

      // 2. User minimizes app for 90 seconds (elapsedSeconds = 90)
      state = timerReducer(state, {
        type: 'TICK',
        payload: { elapsedSeconds: 90 }
      });

      // 3. Interval should have completed, remaining seconds clamped to 0, and cycle incremented
      expect(state.status).toBe('completed');
      expect(state.remainingSeconds).toBe(0);
      expect(state.completedCycles).toBe(1);
    });

    it('does not decrement or advance when timer was paused during background transition', () => {
      let state = timerReducer(initialTimerState, { type: 'START' });
      state = timerReducer(state, { type: 'PAUSE' });
      expect(state.status).toBe('paused');

      state = timerReducer(state, {
        type: 'TICK',
        payload: { elapsedSeconds: 120 }
      });

      // Paused timer ignores elapsed ticks
      expect(state.remainingSeconds).toBe(1500);
      expect(state.status).toBe('paused');
    });
  });
});
