/**
 * useAppLifecycleSync Hook
 * Tracks AppState transitions ('active' <-> 'background' <-> 'inactive')
 * and synchronizes wall-clock elapsed time across background suspensions and device locks.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export interface AppLifecycleSyncOptions {
  onEnterBackground?: () => void;
  onReturnToForeground?: (elapsedSeconds: number) => void;
}

export function useAppLifecycleSync(options?: AppLifecycleSyncOptions) {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState || 'active');
  const backgroundTimestampRef = useRef<number | null>(null);

  const handleAppStateChange = useCallback(
    (nextState: AppStateStatus) => {
      const prevState = appState;
      setAppState(nextState);

      if (
        (prevState === 'active' || prevState === 'inactive') &&
        nextState === 'background'
      ) {
        // App entered background
        backgroundTimestampRef.current = Date.now();
        if (options?.onEnterBackground) {
          options.onEnterBackground();
        }
      } else if (
        prevState === 'background' &&
        nextState === 'active'
      ) {
        // App returned to foreground
        if (backgroundTimestampRef.current !== null) {
          const elapsedMs = Date.now() - backgroundTimestampRef.current;
          const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
          backgroundTimestampRef.current = null;

          if (options?.onReturnToForeground) {
            options.onReturnToForeground(elapsedSec);
          }
        }
      }
    },
    [appState, options]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  return {
    appState,
    isBackground: appState === 'background',
    isActive: appState === 'active'
  };
}
