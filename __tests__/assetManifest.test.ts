import fs from 'fs';
import path from 'path';
import { ImageAssets, AudioAssets, BundledSyllabi } from '../src/assets';

describe('Asset Manifest & Physical Asset Integrity', () => {
  const assetsDir = path.resolve(__dirname, '../src/assets');

  describe('Image Assets', () => {
    it('defines required application image keys', () => {
      expect(ImageAssets.appLogo).toBeDefined();
      expect(ImageAssets.appIcon1024).toBeDefined();
      expect(ImageAssets.appIcon180).toBeDefined();
    });

    it('verifies physical image files exist with non-zero size', () => {
      const images = ['AppLogo.png', 'AppIcon-1024.png', 'AppIcon-180.png'];
      for (const img of images) {
        const filePath = path.join(assetsDir, 'images', img);
        expect(fs.existsSync(filePath)).toBe(true);
        const stat = fs.statSync(filePath);
        expect(stat.size).toBeGreaterThan(0);
      }
    });
  });

  describe('Audio Assets', () => {
    it('defines required audio keys for soundscapes and completion chime', () => {
      expect(AudioAssets.completionChime).toBeDefined();
      expect(AudioAssets.whiteNoise).toBeDefined();
      expect(AudioAssets.rain).toBeDefined();
      expect(AudioAssets.library).toBeDefined();
      expect(AudioAssets.waves).toBeDefined();
    });

    it('verifies physical audio files (both MP3 and WAV) exist with valid size', () => {
      const audioFiles = [
        'completion_chime.mp3',
        'completion_chime.wav',
        'white_noise.mp3',
        'white_noise.wav',
        'rain.mp3',
        'rain.wav',
        'library.mp3',
        'library.wav',
        'waves.mp3',
        'waves.wav'
      ];

      for (const audio of audioFiles) {
        const filePath = path.join(assetsDir, 'audio', audio);
        expect(fs.existsSync(filePath)).toBe(true);
        const stat = fs.statSync(filePath);
        expect(stat.size).toBeGreaterThan(100);
      }
    });
  });

  describe('Bundled Syllabi PDFs', () => {
    it('contains exactly 14 pre-bundled academic syllabi matching iOS original', () => {
      expect(BundledSyllabi).toHaveLength(14);
    });

    it('verifies all 14 physical PDF documents exist on disk and are valid non-empty files', () => {
      for (const syllabusName of BundledSyllabi) {
        const filePath = path.join(assetsDir, 'syllabi', syllabusName);
        expect(fs.existsSync(filePath)).toBe(true);
        const stat = fs.statSync(filePath);
        // Valid PDFs should have substantial size (> 1000 bytes)
        expect(stat.size).toBeGreaterThan(1000);

        // Verify PDF magic header bytes (%PDF)
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(4);
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);
        expect(buffer.toString('utf-8')).toBe('%PDF');
      }
    });
  });
});
