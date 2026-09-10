/**
 * Timer state machine types & definitions
 */

import { SoundscapeId } from './audio';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

export interface TimerConfig {
  focusDuration: number;     // in seconds (e.g. 1500 = 25m)
  shortBreakDuration: number; // in seconds (e.g. 300 = 5m)
  longBreakDuration: number;  // in seconds (e.g. 900 = 15m)
  autoStartBreaks?: boolean;
}

export interface TimerState {
  status: TimerStatus;
  mode: TimerMode;
  remainingSeconds: number;
  totalDurationSeconds: number;
  completedCycles: number;
  soundtrackId?: SoundscapeId;
  lastTickTimestamp?: number;
}

export type TimerAction =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'TICK'; payload?: { elapsedSeconds?: number } }
  | { type: 'SET_MODE'; payload: { mode: TimerMode; durationSeconds?: number } }
  | { type: 'SWITCH_MODE'; payload: { mode: TimerMode; durationSeconds?: number } }
  | { type: 'SET_DURATION'; payload: { seconds: number } }
  | { type: 'SET_CUSTOM_DURATION'; payload: { durationSeconds: number } }
  | { type: 'SET_SOUNDTRACK'; payload: { soundtrackId: SoundscapeId } }
  | { type: 'SKIP_INTERVAL' }
  | { type: 'COMPLETE' };
