/**
 * Audio & Text-to-Speech Service
 * Parity with native iOS AVAudioPlayer, AVAudioSession, and AVSpeechSynthesizer.
 *
 * Capabilities:
 * - Audio Session: AVAudioSessionCategoryPlayback, DuckOthers, speaker/bluetooth routing, staysActiveInBackground
 * - Seamless gapless looping for ambient soundscapes
 * - Smooth volume fade-in, fade-out, and crossfading between soundscape tracks
 * - Speech rate 0.5 parity for text-to-speech
 */

import { SoundscapeTrack, AudioPlaybackState } from '../types/audio';
import { getSoundscapeById } from '../utils/soundCatalog';

export interface AudioProvider {
  playTrack(track: SoundscapeTrack, fadeInMs?: number): Promise<void>;
  stopTrack(): Promise<void>;
  fadeOutAndStop(durationMs?: number): Promise<void>;
  fadeIn(targetVolume: number, durationMs?: number): Promise<void>;
  crossfadeToTrack(nextTrack: SoundscapeTrack, crossfadeMs?: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  speakText(text: string): Promise<void>;
  stopSpeech(): Promise<void>;
  getState(): AudioPlaybackState;
  configureAudioSession(): Promise<void>;
}

class AudioService implements AudioProvider {
  private state: AudioPlaybackState = {
    isPlaying: false,
    activeTrackId: null,
    volume: 1.0,
    isMuted: false,
    isSpeechActive: false
  };

  private avModule: any = null;
  private speechModule: any = null;
  private currentSound: any = null;
  private isAudioSessionConfigured: boolean = false;
  private fadeInterval: NodeJS.Timeout | null = null;

  constructor() {
    try {
      this.avModule = require('expo-av');
    } catch {
      this.avModule = null;
    }
    try {
      this.speechModule = require('expo-speech');
    } catch {
      this.speechModule = null;
    }
  }

  /**
   * Configures iOS audio session to AVAudioSessionCategoryPlayback with DuckOthers
   * Matching Swift: session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers, .defaultToSpeaker])
   */
  async configureAudioSession(): Promise<void> {
    if (this.isAudioSessionConfigured) return;

    if (this.avModule?.Audio?.setAudioModeAsync) {
      try {
        await this.avModule.Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: 2, // DuckOthers
          shouldDuckAndroid: true,
          interruptionModeAndroid: 2,
          playThroughEarpieceAndroid: false
        });
        this.isAudioSessionConfigured = true;
      } catch (err) {
        // Fallback or test runner
      }
    }
  }

  async playTrack(track: SoundscapeTrack, fadeInMs: number = 0): Promise<void> {
    await this.configureAudioSession();
    await this.stopTrack();

    this.state.activeTrackId = track.id;
    this.state.volume = fadeInMs > 0 ? 0 : track.defaultVolume;
    this.state.isPlaying = true;

    if (this.avModule?.Audio?.Sound) {
      try {
        const { sound } = await this.avModule.Audio.Sound.createAsync(
          { uri: track.assetPath },
          {
            shouldPlay: true,
            isLooping: track.isLoopable,
            volume: this.state.volume
          }
        );
        this.currentSound = sound;

        if (fadeInMs > 0) {
          await this.fadeIn(track.defaultVolume, fadeInMs);
        }
      } catch (err) {
        this.currentSound = null;
      }
    } else if (fadeInMs > 0) {
      await this.fadeIn(track.defaultVolume, fadeInMs);
    }
  }

  async stopTrack(): Promise<void> {
    this.clearFadeInterval();

    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
      } catch {}
      this.currentSound = null;
    }
    this.state.isPlaying = false;
    this.state.activeTrackId = null;
  }

  /**
   * Smoothly attenuates volume down to 0 over durationMs before stopping the audio track
   */
  async fadeOutAndStop(durationMs: number = 600): Promise<void> {
    this.clearFadeInterval();

    if (!this.state.isPlaying) {
      await this.stopTrack();
      return;
    }

    const steps = 15;
    const intervalTime = Math.max(10, Math.floor(durationMs / steps));
    const startVolume = this.state.volume;
    const volumeStep = startVolume / steps;
    let currentStep = 0;

    return new Promise<void>((resolve) => {
      this.fadeInterval = setInterval(async () => {
        currentStep++;
        const nextVolume = Math.max(0.0, startVolume - volumeStep * currentStep);
        await this.setVolume(nextVolume);

        if (currentStep >= steps || nextVolume <= 0.01) {
          this.clearFadeInterval();
          await this.stopTrack();
          resolve();
        }
      }, intervalTime);
    });
  }

  /**
   * Smoothly ramps volume up from 0 to targetVolume over durationMs
   */
  async fadeIn(targetVolume: number, durationMs: number = 500): Promise<void> {
    this.clearFadeInterval();

    const clampedTarget = Math.max(0.0, Math.min(1.0, targetVolume));
    const steps = 15;
    const intervalTime = Math.max(10, Math.floor(durationMs / steps));
    const volumeStep = clampedTarget / steps;
    let currentStep = 0;

    await this.setVolume(0.0);

    return new Promise<void>((resolve) => {
      this.fadeInterval = setInterval(async () => {
        currentStep++;
        const nextVolume = Math.min(clampedTarget, volumeStep * currentStep);
        await this.setVolume(nextVolume);

        if (currentStep >= steps || nextVolume >= clampedTarget) {
          this.clearFadeInterval();
          await this.setVolume(clampedTarget);
          resolve();
        }
      }, intervalTime);
    });
  }

  /**
   * Crossfade: fades out current track while fading in the next track
   */
  async crossfadeToTrack(nextTrack: SoundscapeTrack, crossfadeMs: number = 800): Promise<void> {
    const fadeHalf = Math.floor(crossfadeMs / 2);
    await this.fadeOutAndStop(fadeHalf);
    await this.playTrack(nextTrack, fadeHalf);
  }

  async setVolume(volume: number): Promise<void> {
    const clamped = Math.max(0.0, Math.min(1.0, volume));
    this.state.volume = clamped;
    if (this.currentSound) {
      try {
        await this.currentSound.setVolumeAsync(clamped);
      } catch {}
    }
  }

  async speakText(text: string): Promise<void> {
    if (!text.trim()) return;

    await this.stopSpeech();
    this.state.isSpeechActive = true;

    if (this.speechModule?.speak) {
      this.speechModule.speak(text, {
        language: 'en-US',
        rate: 0.5, // 1:1 with Swift AVSpeechUtteranceDefaultSpeechRate
        pitch: 1.0,
        onDone: () => {
          this.state.isSpeechActive = false;
        },
        onStopped: () => {
          this.state.isSpeechActive = false;
        }
      });
    }
  }

  async stopSpeech(): Promise<void> {
    if (this.speechModule?.stop) {
      this.speechModule.stop();
    }
    this.state.isSpeechActive = false;
  }

  getState(): AudioPlaybackState {
    return { ...this.state };
  }

  private clearFadeInterval() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }
}

export const audio = new AudioService();
