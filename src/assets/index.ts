/**
 * Strongly-Typed Asset Manifest
 * Maps all bundled images, soundscapes, audio files, and syllabus documents.
 */

export const ImageAssets = {
  appLogo: require('./images/AppLogo.png'),
  appIcon1024: require('./images/AppIcon-1024.png'),
  appIcon180: require('./images/AppIcon-180.png')
} as const;

export const AudioAssets = {
  completionChime: require('./audio/completion_chime.mp3'),
  whiteNoise: require('./audio/white_noise.mp3'),
  rain: require('./audio/rain.mp3'),
  library: require('./audio/library.mp3'),
  waves: require('./audio/waves.mp3'),
  // WAV alternative handles
  completionChimeWav: require('./audio/completion_chime.wav'),
  whiteNoiseWav: require('./audio/white_noise.wav'),
  rainWav: require('./audio/rain.wav'),
  libraryWav: require('./audio/library.wav'),
  wavesWav: require('./audio/waves.wav')
} as const;

export const BundledSyllabi = [
  'CPC511_Syllabus.pdf',
  'CPC512_Syllabus.pdf',
  'CPC514_Syllabus.pdf',
  'CPC527_Syllabus.pdf',
  'Syllabus_1_CS501.pdf',
  'Syllabus_2_BIO412.pdf',
  'Syllabus_3_LAW702.pdf',
  'Syllabus_4_CPC514.pdf',
  'Syllabus_5_CPC523.pdf',
  'Syllabus_6_ECON305.pdf',
  'Syllabus_7_PHYS601.pdf',
  'Syllabus_8_HIST210.pdf',
  'Syllabus_9_ART150.pdf',
  'Syllabus_10_PSYCH800.pdf'
] as const;

export type ImageAssetKey = keyof typeof ImageAssets;
export type AudioAssetKey = keyof typeof AudioAssets;
export type BundledSyllabusKey = typeof BundledSyllabi[number];
