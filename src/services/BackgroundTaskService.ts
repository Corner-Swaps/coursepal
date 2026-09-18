import { NativeModules, Platform } from 'react-native';

const BackgroundTaskManager = NativeModules?.BackgroundTaskManager;

let androidTaskCounter = 1000;

/**
 * Requests background execution time for critical operations like syllabus upload.
 * Keeps JS thread, file I/O, and network alive when app is minimized.
 */
export async function beginBackgroundTask(name: string): Promise<number | null> {
  if (BackgroundTaskManager?.beginBackgroundTask) {
    try {
      const id = await BackgroundTaskManager.beginBackgroundTask(name);
      return typeof id === 'number' ? id : null;
    } catch (err) {
      console.warn('Failed to begin native background task:', err);
    }
  }

  // Graceful fallback for Android / Expo environment
  if (Platform.OS === 'android') {
    return ++androidTaskCounter;
  }

  return null;
}

/**
 * Signals that the background task is complete.
 */
export async function endBackgroundTask(name: string): Promise<void> {
  if (BackgroundTaskManager?.endBackgroundTask) {
    try {
      await BackgroundTaskManager.endBackgroundTask(name);
    } catch (err) {
      console.warn('Failed to end native background task:', err);
    }
  }
}
