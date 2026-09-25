import { isMockSeed } from '../src/context/CoursePalContext';
import { DataPersistenceBackupManager } from '../src/services/DataPersistenceBackupManager';
import * as FileSystem from 'expo-file-system';

describe('Clean App Store Install & User Data Persistence Guarantees', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Legacy Seed & Mock Course Elimination', () => {
    it('accurately identifies and marks all legacy mock and sample seed IDs', () => {
      const mockIds = [
        'c-cpc527',
        'c-cpc527-static-seed',
        'c-seed-mock',
        'c-seed-123',
        'c-mock-demo',
        'c-sample-course',
        'c-cpc-523-active',
        'c-cpc-511-active',
        'c-cpc-512-active',
        'c-cpc-514-active',
        'c-cpc-527-active',
        'c-psyc-612-active',
        'c-cpc-514-canonical',
        'c-course-static-seed'
      ];

      for (const id of mockIds) {
        expect(isMockSeed(id)).toBe(true);
      }
    });

    it('does NOT flag authentic user-uploaded or user-created course IDs', () => {
      const userCourseIds = [
        'c-1790298985075-v180',
        'c-1790291960560-5mhi',
        'c-user-12345',
        'c-psyc-fall2026',
        'c-data-630-mine',
        'c-neur-740-spring'
      ];

      for (const id of userCourseIds) {
        expect(isMockSeed(id)).toBe(false);
      }
    });
  });

  describe('Backup Storage Resilience & Backward Compatibility', () => {
    it('accepts and revives backup payload with missing or earlier version numbers', async () => {
      const legacyPayload = {
        version: 3,
        timestamp: Date.now(),
        courses: [
          {
            id: 'c-1790298985075-v180',
            courseCode: 'SXST-3010',
            courseName: 'Human Sexuality',
            createdAt: '2026-09-24T18:00:00.000Z'
          }
        ],
        readings: [],
        assignments: [],
        vaultDocs: []
      };

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(legacyPayload));

      const manager = DataPersistenceBackupManager.shared;
      const loaded = await manager.loadLatestBackup();

      expect(loaded).not.toBeNull();
      expect(loaded?.courses.length).toBe(1);
      expect(loaded?.courses[0].courseCode).toBe('SXST-3010');
      expect(loaded?.version).toBe(5); // Auto-migrated to version 5
    });

    it('resetAllStoredData cleanly purges all persistent sandbox data', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const manager = DataPersistenceBackupManager.shared;
      const success = await manager.resetAllStoredData();

      expect(success).toBe(true);
      expect(FileSystem.deleteAsync).toHaveBeenCalled();
    });
  });
});
