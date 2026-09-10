/**
 * useAudio Hook
 * React hook interface for soundscapes, volume fading, and text-to-speech
 */

import { useState, useCallback } from 'react';
import { audio } from '../services/audio';
import { SoundscapeTrack, SoundscapeId, AudioPlaybackState } from '../types/audio';
import { getSoundscapeById } from '../utils/soundCatalog';

export function useAudio() {
  const [playbackState, setPlaybackState] = useState<AudioPlaybackState>(audio.getState());

  const play = useCallback(async (trackOrId: SoundscapeTrack | SoundscapeId, fadeInMs?: number) => {
    const track = typeof trackOrId === 'string' ? getSoundscapeById(trackOrId) : trackOrId;
    if (track) {
      await audio.playTrack(track, fadeInMs);
      setPlaybackState(audio.getState());
    }
  }, []);

  const stop = useCallback(async () => {
    await audio.stopTrack();
    setPlaybackState(audio.getState());
  }, []);

  const fadeOutAndStop = useCallback(async (durationMs?: number) => {
    await audio.fadeOutAndStop(durationMs);
    setPlaybackState(audio.getState());
  }, []);

  const fadeIn = useCallback(async (targetVolume: number, durationMs?: number) => {
    await audio.fadeIn(targetVolume, durationMs);
    setPlaybackState(audio.getState());
  }, []);

  const crossfadeToTrack = useCallback(async (trackOrId: SoundscapeTrack | SoundscapeId, crossfadeMs?: number) => {
    const track = typeof trackOrId === 'string' ? getSoundscapeById(trackOrId) : trackOrId;
    if (track) {
      await audio.crossfadeToTrack(track, crossfadeMs);
      setPlaybackState(audio.getState());
    }
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    await audio.setVolume(volume);
    setPlaybackState(audio.getState());
  }, []);

  const speak = useCallback(async (text: string) => {
    await audio.speakText(text);
    setPlaybackState(audio.getState());
  }, []);

  const stopSpeech = useCallback(async () => {
    await audio.stopSpeech();
    setPlaybackState(audio.getState());
  }, []);

  return {
    ...playbackState,
    play,
    stop,
    fadeOutAndStop,
    fadeIn,
    crossfadeToTrack,
    setVolume,
    speak,
    stopSpeech
  };
}
