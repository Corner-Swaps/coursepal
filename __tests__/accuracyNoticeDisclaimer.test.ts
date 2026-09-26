import { DataPersistenceBackupManager } from '../src/services/DataPersistenceBackupManager';

describe('Accuracy Notice Disclaimer Guarantees', () => {
  it('saves and loads accuracy notice acceptance correctly', async () => {
    const manager = DataPersistenceBackupManager.shared;
    const testCourseIds = ['course-1', 'course-2'];

    const saved = await manager.saveAccuracyAccepted(testCourseIds);
    expect(saved).toBe(true);

    const loaded = await manager.loadAccuracyAccepted();
    expect(loaded).toEqual(testCourseIds);
  });

  it('resets accuracy accepted on full data reset', async () => {
    const manager = DataPersistenceBackupManager.shared;
    await manager.saveAccuracyAccepted(['c-test']);

    const resetSuccess = await manager.resetAllStoredData();
    expect(resetSuccess).toBe(true);

    const loaded = await manager.loadAccuracyAccepted();
    expect(loaded).toEqual([]);
  });
});
