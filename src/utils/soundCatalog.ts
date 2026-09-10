/**
 * Soundscape Catalog & Lookup Service
 * Maps study audio tracks, descriptions, and loop configurations
 */

import { SoundscapeTrack, SoundscapeId, SoundscapeCategory } from '../types/audio';

export const SOUNDSCAPE_CATALOG: SoundscapeTrack[] = [
  {
    id: 'rain',
    name: 'Gentle Rain',
    category: 'nature',
    description: 'Calming soft rainfall for deep focus and reading',
    assetPath: 'audio/rain.mp3',
    defaultVolume: 0.65,
    isLoopable: true
  },
  {
    id: 'library',
    name: 'Quiet Library',
    category: 'ambient',
    description: 'Subtle academic ambiance with gentle page turns',
    assetPath: 'audio/library.mp3',
    defaultVolume: 0.5,
    isLoopable: true
  },
  {
    id: 'white_noise',
    name: 'Deep White Noise',
    category: 'focus',
    description: 'Consistent broadband sound to block distracting noises',
    assetPath: 'audio/white_noise.mp3',
    defaultVolume: 0.6,
    isLoopable: true
  },
  {
    id: 'waves',
    name: 'Ocean Waves',
    category: 'nature',
    description: 'Rhythmic coastal waves promoting relaxed concentration',
    assetPath: 'audio/waves.mp3',
    defaultVolume: 0.55,
    isLoopable: true
  },
  {
    id: 'completion_chime',
    name: 'Completion Chime',
    category: 'bell',
    description: 'Clear Tibetan singing bowl chime marking completed session',
    assetPath: 'audio/completion_chime.mp3',
    defaultVolume: 0.85,
    isLoopable: false
  }
];

export function getSoundscapeById(id: SoundscapeId): SoundscapeTrack | undefined {
  return SOUNDSCAPE_CATALOG.find(track => track.id === id);
}

export function listSoundscapesByCategory(category: SoundscapeCategory): SoundscapeTrack[] {
  return SOUNDSCAPE_CATALOG.filter(track => track.category === category);
}

export function getAllSoundscapes(): SoundscapeTrack[] {
  return [...SOUNDSCAPE_CATALOG];
}
