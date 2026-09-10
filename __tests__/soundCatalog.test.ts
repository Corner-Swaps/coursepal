import {
  SOUNDSCAPE_CATALOG,
  getSoundscapeById,
  listSoundscapesByCategory,
  getAllSoundscapes
} from '../src/utils/soundCatalog';
import { SoundscapeId, SoundscapeCategory } from '../src/types/audio';

describe('Soundscape Catalog Service', () => {
  it('contains all 5 expected soundscape tracks', () => {
    expect(SOUNDSCAPE_CATALOG).toHaveLength(5);
    const ids = SOUNDSCAPE_CATALOG.map(s => s.id);
    expect(ids).toContain('rain');
    expect(ids).toContain('library');
    expect(ids).toContain('white_noise');
    expect(ids).toContain('waves');
    expect(ids).toContain('completion_chime');
  });

  it('validates each soundscape has required non-empty metadata', () => {
    for (const track of SOUNDSCAPE_CATALOG) {
      expect(track.id).toBeTruthy();
      expect(track.name).toBeTruthy();
      expect(track.description).toBeTruthy();
      expect(track.assetPath).toBeTruthy();
      expect(track.defaultVolume).toBeGreaterThan(0);
      expect(track.defaultVolume).toBeLessThanOrEqual(1.0);
      expect(typeof track.isLoopable).toBe('boolean');
    }
  });

  it('distinguishes loopable ambient tracks from completion chime', () => {
    const loopable = SOUNDSCAPE_CATALOG.filter(t => t.isLoopable);
    const nonLoopable = SOUNDSCAPE_CATALOG.filter(t => !t.isLoopable);

    expect(loopable).toHaveLength(4);
    expect(nonLoopable).toHaveLength(1);
    expect(nonLoopable[0].id).toBe('completion_chime');
  });

  describe('getSoundscapeById', () => {
    it('returns the exact track for known IDs', () => {
      const rain = getSoundscapeById('rain');
      expect(rain).toBeDefined();
      expect(rain?.name).toBe('Gentle Rain');
      expect(rain?.category).toBe('nature');

      const whiteNoise = getSoundscapeById('white_noise');
      expect(whiteNoise?.name).toBe('Deep White Noise');
    });

    it('returns undefined for non-existent IDs', () => {
      const unknown = getSoundscapeById('non_existent' as SoundscapeId);
      expect(unknown).toBeUndefined();
    });
  });

  describe('listSoundscapesByCategory', () => {
    it('filters tracks by nature category', () => {
      const nature = listSoundscapesByCategory('nature');
      expect(nature).toHaveLength(2);
      expect(nature.map(t => t.id)).toEqual(['rain', 'waves']);
    });

    it('filters tracks by focus category', () => {
      const focus = listSoundscapesByCategory('focus');
      expect(focus).toHaveLength(1);
      expect(focus[0].id).toBe('white_noise');
    });

    it('filters tracks by bell category', () => {
      const bell = listSoundscapesByCategory('bell');
      expect(bell).toHaveLength(1);
      expect(bell[0].id).toBe('completion_chime');
    });

    it('returns empty array for unused category', () => {
      const empty = listSoundscapesByCategory('binaural' as SoundscapeCategory);
      expect(empty).toEqual([]);
    });
  });

  describe('getAllSoundscapes', () => {
    it('returns a shallow clone of the catalog to prevent direct mutation', () => {
      const copy = getAllSoundscapes();
      expect(copy).toHaveLength(SOUNDSCAPE_CATALOG.length);
      expect(copy).not.toBe(SOUNDSCAPE_CATALOG);
    });
  });
});
