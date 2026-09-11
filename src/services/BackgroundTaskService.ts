import { NativeModules, Platform } from 'react-native';

const BackgroundTaskManager = NativeModules?.BackgroundTaskManager;

/**
 * Requests iOS background execution time for critical operations like syllabus upload.
 * Keeps JS thread, file I/O, and network alive for up to 30 seconds when app is minimized.
 */
export async function beginBackgroundTask(name: string): Promise<number | null> {
  if (Platform.OS !== 'ios' || !BackgroundTaskManager) {
    return null;
  }
  try {
    const id = await BackgroundTaskManager.beginBackgroundTask(name);
    return typeof id === 'number' ? id : null;
  } catch (err) {
    console.warn('Failed to begin background task:', err);
    return null;
  }
}

/**
 * Signals to iOS that the background task is complete.
 */
export async function endBackgroundTask(name: string): Promise<void> {
  if (Platform.OS !== 'ios' || !BackgroundTaskManager) {
    return;
  }
  try {
    await BackgroundTaskManager.endBackgroundTask(name);
  } catch (err) {
    console.warn('Failed to end background task:', err);
  }
}
