/**
 * useTimer Hook
 * Manages study timer state machine, intervals, and completion triggers
 * with seamless background AppState wall-clock synchronization.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { TimerState, TimerMode } from '../types/timer';
import { timerReducer, initialTimerState } from '../utils/timerReducer';

export function useTimer(initialMode: TimerMode = 'focus', autoSyncWithAppState: boolean = true) {
  const [state, setState] = useState<TimerState>(() =>
    timerReducer(initialTimerState, { type: 'SET_MODE', payload: { mode: initialMode } })
  );

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const backgroundTimestampRef = useRef<number | null>(null);

  const start = useCallback(() => {
    setState(prev => timerReducer(prev, { type: 'START' }));
  }, []);

  const pause = useCallback(() => {
    setState(prev => timerReducer(prev, { type: 'PAUSE' }));
  }, []);

  const resume = useCallback(() => {
    setState(prev => timerReducer(prev, { type: 'RESUME' }));
  }, []);

  const reset = useCallback(() => {
    setState(prev => timerReducer(prev, { type: 'RESET' }));
  }, []);

  const setMode = useCallback((mode: TimerMode, durationSeconds?: number) => {
    setState(prev => timerReducer(prev, { type: 'SET_MODE', payload: { mode, durationSeconds } }));
  }, []);

  const setDuration = useCallback((seconds: number) => {
    setState(prev => timerReducer(prev, { type: 'SET_DURATION', payload: { seconds } }));
  }, []);

  const skipInterval = useCallback(() => {
    setState(prev => timerReducer(prev, { type: 'SKIP_INTERVAL' }));
  }, []);

  // Standard 1-second foreground interval tick
  useEffect(() => {
    if (state.status === 'running') {
      timerRef.current = setInterval(() => {
        setState(prev => timerReducer(prev, { type: 'TICK' }));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.status]);

  // AppState background/foreground synchronization
  useEffect(() => {
    if (!autoSyncWithAppState) return;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimestampRef.current = Date.now();
      } else if (nextState === 'active') {
        if (backgroundTimestampRef.current !== null) {
          const elapsedMs = Date.now() - backgroundTimestampRef.current;
          const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
          backgroundTimestampRef.current = null;

          if (elapsedSeconds > 0) {
            setState(prev => {
              if (prev.status !== 'running') return prev;
              return timerReducer(prev, {
                type: 'TICK',
                payload: { elapsedSeconds }
              });
            });
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [autoSyncWithAppState]);

  return {
    state,
    start,
    pause,
    resume,
    reset,
    setMode,
    setDuration,
    skipInterval,
    isRunning: state.status === 'running',
    isPaused: state.status === 'paused',
    isCompleted: state.status === 'completed'
  };
}
