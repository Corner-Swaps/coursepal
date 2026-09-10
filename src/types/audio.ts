/**
 * Audio service & soundscape types
 */

export type SoundscapeCategory = 'ambient' | 'nature' | 'focus' | 'bell';

export type SoundscapeId =
  | 'rain'
  | 'library'
  | 'white_noise'
  | 'waves'
  | 'completion_chime';

export interface SoundscapeTrack {
  id: SoundscapeId;
  name: string;
  category: SoundscapeCategory;
  description: string;
  assetPath: string;
  defaultVolume: number; // 0.0 to 1.0
  isLoopable: boolean;
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  activeTrackId: SoundscapeId | null;
  volume: number;
  isMuted: boolean;
  isSpeechActive: boolean;
}
