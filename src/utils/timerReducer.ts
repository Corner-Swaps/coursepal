/**
 * Timer State Reducer
 * Deterministic finite-state machine for focus/study sessions
 * Transitions: idle -> running -> paused -> completed
 */

import { TimerState, TimerAction, TimerMode } from '../types/timer';
export type { TimerState, TimerAction, TimerMode } from '../types/timer';

export const TimerModeDurations: Record<TimerMode, number> = {
  focus: 25 * 60,       // 1500s (25 minutes)
  shortBreak: 5 * 60,   // 300s  (5 minutes)
  longBreak: 15 * 60    // 900s  (15 minutes)
};

export const DEFAULT_DURATIONS = TimerModeDurations;

export const initialTimerState: TimerState = {
  status: 'idle',
  mode: 'focus',
  remainingSeconds: TimerModeDurations.focus,
  totalDurationSeconds: TimerModeDurations.focus,
  completedCycles: 0,
  soundtrackId: 'white_noise'
};

export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'START': {
      if (state.status === 'running') {
        return state;
      }
      return {
        ...state,
        status: 'running',
        remainingSeconds: state.remainingSeconds > 0 ? state.remainingSeconds : state.totalDurationSeconds,
        lastTickTimestamp: Date.now()
      };
    }

    case 'PAUSE': {
      if (state.status !== 'running') {
        return state;
      }
      return {
        ...state,
        status: 'paused',
        lastTickTimestamp: undefined
      };
    }

    case 'RESUME': {
      if (state.status !== 'paused') {
        return state;
      }
      return {
        ...state,
        status: 'running',
        lastTickTimestamp: Date.now()
      };
    }

    case 'RESET': {
      return {
        ...state,
        status: 'idle',
        remainingSeconds: state.totalDurationSeconds,
        lastTickTimestamp: undefined
      };
    }

    case 'TICK': {
      if (state.status !== 'running') {
        return state;
      }

      const elapsed = action.payload?.elapsedSeconds ?? 1;
      const nextRemaining = state.remainingSeconds - elapsed;

      if (nextRemaining <= 0) {
        return {
          ...state,
          status: 'completed',
          remainingSeconds: 0,
          completedCycles: state.mode === 'focus' ? state.completedCycles + 1 : state.completedCycles,
          lastTickTimestamp: undefined
        };
      }

      return {
        ...state,
        remainingSeconds: nextRemaining,
        lastTickTimestamp: Date.now()
      };
    }

    case 'SET_MODE':
    case 'SWITCH_MODE': {
      const mode = action.payload.mode;
      const duration = action.payload.durationSeconds ?? TimerModeDurations[mode];
      return {
        ...state,
        mode,
        status: 'idle',
        remainingSeconds: duration,
        totalDurationSeconds: duration,
        lastTickTimestamp: undefined
      };
    }

    case 'SET_DURATION': {
      const seconds = Math.max(1, action.payload.seconds);
      return {
        ...state,
        totalDurationSeconds: seconds,
        remainingSeconds: state.status === 'idle' ? seconds : Math.min(state.remainingSeconds, seconds)
      };
    }

    case 'SET_CUSTOM_DURATION': {
      const seconds = Math.max(1, action.payload.durationSeconds);
      return {
        ...state,
        totalDurationSeconds: seconds,
        remainingSeconds: state.status === 'idle' ? seconds : Math.min(state.remainingSeconds, seconds)
      };
    }

    case 'SET_SOUNDTRACK': {
      return {
        ...state,
        soundtrackId: action.payload.soundtrackId
      };
    }

    case 'SKIP_INTERVAL': {
      if (state.mode === 'focus') {
        const nextCycles = state.completedCycles + 1;
        const nextMode: TimerMode = nextCycles >= 4 ? 'longBreak' : 'shortBreak';
        const duration = TimerModeDurations[nextMode];
        return {
          ...state,
          status: 'idle',
          mode: nextMode,
          completedCycles: nextCycles,
          remainingSeconds: duration,
          totalDurationSeconds: duration,
          lastTickTimestamp: undefined
        };
      } else {
        const duration = TimerModeDurations.focus;
        return {
          ...state,
          status: 'idle',
          mode: 'focus',
          remainingSeconds: duration,
          totalDurationSeconds: duration,
          lastTickTimestamp: undefined
        };
      }
    }

    case 'COMPLETE': {
      return {
        ...state,
        status: 'completed',
        remainingSeconds: 0,
        completedCycles: state.mode === 'focus' ? state.completedCycles + 1 : state.completedCycles,
        lastTickTimestamp: undefined
      };
    }

    default:
      return state;
  }
}
