import {
  timerReducer,
  initialTimerState,
  TimerState,
  TimerModeDurations
} from '../src/utils/timerReducer';

describe('Timer State Machine & Reducer', () => {
  it('initializes with default idle state and 25-minute focus mode', () => {
    expect(initialTimerState.status).toBe('idle');
    expect(initialTimerState.mode).toBe('focus');
    expect(initialTimerState.totalDurationSeconds).toBe(1500);
    expect(initialTimerState.remainingSeconds).toBe(1500);
    expect(initialTimerState.completedCycles).toBe(0);
    expect(initialTimerState.soundtrackId).toBe('white_noise');
  });

  describe('State transitions', () => {
    it('transitions idle -> running on START', () => {
      const state = timerReducer(initialTimerState, { type: 'START' });
      expect(state.status).toBe('running');
    });

    it('transitions running -> paused on PAUSE', () => {
      const runningState: TimerState = { ...initialTimerState, status: 'running' };
      const pausedState = timerReducer(runningState, { type: 'PAUSE' });
      expect(pausedState.status).toBe('paused');
    });

    it('transitions paused -> running on RESUME', () => {
      const pausedState: TimerState = { ...initialTimerState, status: 'paused' };
      const runningState = timerReducer(pausedState, { type: 'RESUME' });
      expect(runningState.status).toBe('running');
    });

    it('ignores RESUME when not in paused state', () => {
      const idleState = timerReducer(initialTimerState, { type: 'RESUME' });
      expect(idleState).toBe(initialTimerState);
    });

    it('transitions running -> idle on RESET with restored duration', () => {
      const runningState: TimerState = {
        ...initialTimerState,
        status: 'running',
        remainingSeconds: 400
      };
      const resetState = timerReducer(runningState, { type: 'RESET' });
      expect(resetState.status).toBe('idle');
      expect(resetState.remainingSeconds).toBe(1500);
    });

    it('ignores START when already running', () => {
      const runningState: TimerState = { ...initialTimerState, status: 'running' };
      const state = timerReducer(runningState, { type: 'START' });
      expect(state).toBe(runningState);
    });

    it('ignores PAUSE when not running', () => {
      const idleState = timerReducer(initialTimerState, { type: 'PAUSE' });
      expect(idleState).toBe(initialTimerState);
    });
  });

  describe('TICK handling and completion', () => {
    it('decrements remainingSeconds by 1 when running', () => {
      const runningState: TimerState = {
        ...initialTimerState,
        status: 'running',
        remainingSeconds: 1500
      };
      const ticked = timerReducer(runningState, { type: 'TICK' });
      expect(ticked.remainingSeconds).toBe(1499);
      expect(ticked.status).toBe('running');
    });

    it('decrements by custom elapsedSeconds when specified', () => {
      const runningState: TimerState = {
        ...initialTimerState,
        status: 'running',
        remainingSeconds: 100
      };
      const ticked = timerReducer(runningState, { type: 'TICK', payload: { elapsedSeconds: 10 } });
      expect(ticked.remainingSeconds).toBe(90);
    });

    it('does not decrement when paused or idle', () => {
      const idleTicked = timerReducer(initialTimerState, { type: 'TICK' });
      expect(idleTicked.remainingSeconds).toBe(1500);

      const pausedState: TimerState = { ...initialTimerState, status: 'paused', remainingSeconds: 500 };
      const pausedTicked = timerReducer(pausedState, { type: 'TICK' });
      expect(pausedTicked.remainingSeconds).toBe(500);
    });

    it('transitions to completed and increments cycle on remainingSeconds <= 1 reaching 0', () => {
      const nearEndState: TimerState = {
        ...initialTimerState,
        status: 'running',
        remainingSeconds: 1,
        completedCycles: 0,
        mode: 'focus'
      };
      const completed = timerReducer(nearEndState, { type: 'TICK' });
      expect(completed.remainingSeconds).toBe(0);
      expect(completed.status).toBe('completed');
      expect(completed.completedCycles).toBe(1);
    });

    it('does not increment completedCycles if mode was break', () => {
      const breakState: TimerState = {
        ...initialTimerState,
        status: 'running',
        remainingSeconds: 1,
        completedCycles: 2,
        mode: 'shortBreak'
      };
      const completed = timerReducer(breakState, { type: 'TICK' });
      expect(completed.remainingSeconds).toBe(0);
      expect(completed.status).toBe('completed');
      expect(completed.completedCycles).toBe(2);
    });
  });

  describe('SET_MODE & SWITCH_MODE', () => {
    it('switches to shortBreak and sets duration to 300s', () => {
      const state = timerReducer(initialTimerState, {
        type: 'SWITCH_MODE',
        payload: { mode: 'shortBreak' }
      });
      expect(state.mode).toBe('shortBreak');
      expect(state.totalDurationSeconds).toBe(300);
      expect(state.remainingSeconds).toBe(300);
      expect(state.status).toBe('idle');
    });

    it('switches to longBreak and sets duration to 900s via SET_MODE', () => {
      const state = timerReducer(initialTimerState, {
        type: 'SET_MODE',
        payload: { mode: 'longBreak' }
      });
      expect(state.mode).toBe('longBreak');
      expect(state.totalDurationSeconds).toBe(900);
      expect(state.remainingSeconds).toBe(900);
      expect(state.status).toBe('idle');
    });

    it('supports custom duration override on SWITCH_MODE', () => {
      const state = timerReducer(initialTimerState, {
        type: 'SWITCH_MODE',
        payload: { mode: 'focus', durationSeconds: 3000 }
      });
      expect(state.mode).toBe('focus');
      expect(state.totalDurationSeconds).toBe(3000);
      expect(state.remainingSeconds).toBe(3000);
    });
  });

  describe('SET_DURATION & SET_CUSTOM_DURATION', () => {
    it('sets duration via SET_DURATION in idle state', () => {
      const state = timerReducer(initialTimerState, {
        type: 'SET_DURATION',
        payload: { seconds: 1200 }
      });
      expect(state.totalDurationSeconds).toBe(1200);
      expect(state.remainingSeconds).toBe(1200);
    });

    it('clamps remaining seconds when SET_DURATION is smaller than remaining in running state', () => {
      const runningState: TimerState = {
        ...initialTimerState,
        status: 'running',
        remainingSeconds: 1500
      };
      const state = timerReducer(runningState, {
        type: 'SET_DURATION',
        payload: { seconds: 800 }
      });
      expect(state.totalDurationSeconds).toBe(800);
      expect(state.remainingSeconds).toBe(800);
    });

    it('sets custom duration via SET_CUSTOM_DURATION and updates remaining seconds', () => {
      const state = timerReducer(initialTimerState, {
        type: 'SET_CUSTOM_DURATION',
        payload: { durationSeconds: 1800 }
      });
      expect(state.totalDurationSeconds).toBe(1800);
      expect(state.remainingSeconds).toBe(1800);
    });
  });

  describe('SET_SOUNDTRACK', () => {
    it('updates soundtrack ID', () => {
      const state = timerReducer(initialTimerState, {
        type: 'SET_SOUNDTRACK',
        payload: { soundtrackId: 'rain' }
      });
      expect(state.soundtrackId).toBe('rain');
    });
  });

  describe('COMPLETE action', () => {
    it('immediately forces completed status and increments cycles for focus mode', () => {
      const runningState: TimerState = {
        ...initialTimerState,
        status: 'running',
        remainingSeconds: 600,
        completedCycles: 0,
        mode: 'focus'
      };
      const state = timerReducer(runningState, { type: 'COMPLETE' });
      expect(state.status).toBe('completed');
      expect(state.remainingSeconds).toBe(0);
      expect(state.completedCycles).toBe(1);
    });

    it('does not increment cycles for break mode on COMPLETE', () => {
      const runningState: TimerState = {
        ...initialTimerState,
        status: 'running',
        remainingSeconds: 200,
        completedCycles: 3,
        mode: 'shortBreak'
      };
      const state = timerReducer(runningState, { type: 'COMPLETE' });
      expect(state.status).toBe('completed');
      expect(state.remainingSeconds).toBe(0);
      expect(state.completedCycles).toBe(3);
    });
  });

  describe('SKIP_INTERVAL', () => {
    it('advances focus to shortBreak for cycles < 4', () => {
      const state: TimerState = {
        ...initialTimerState,
        status: 'running',
        mode: 'focus',
        completedCycles: 1
      };
      const skipped = timerReducer(state, { type: 'SKIP_INTERVAL' });
      expect(skipped.status).toBe('idle');
      expect(skipped.completedCycles).toBe(2);
      expect(skipped.mode).toBe('shortBreak');
      expect(skipped.remainingSeconds).toBe(TimerModeDurations.shortBreak);
    });

    it('advances focus to longBreak when reaching 4 cycles', () => {
      const state: TimerState = {
        ...initialTimerState,
        status: 'running',
        mode: 'focus',
        completedCycles: 3
      };
      const skipped = timerReducer(state, { type: 'SKIP_INTERVAL' });
      expect(skipped.status).toBe('idle');
      expect(skipped.completedCycles).toBe(4);
      expect(skipped.mode).toBe('longBreak');
      expect(skipped.remainingSeconds).toBe(TimerModeDurations.longBreak);
    });

    it('advances break back to focus without incrementing cycles', () => {
      const state: TimerState = {
        ...initialTimerState,
        status: 'running',
        mode: 'shortBreak',
        completedCycles: 2
      };
      const skipped = timerReducer(state, { type: 'SKIP_INTERVAL' });
      expect(skipped.status).toBe('idle');
      expect(skipped.completedCycles).toBe(2);
      expect(skipped.mode).toBe('focus');
      expect(skipped.remainingSeconds).toBe(TimerModeDurations.focus);
    });
  });

  describe('Unknown action handling', () => {
    it('returns untouched state for unknown action type', () => {
      // @ts-expect-error testing runtime behavior with invalid action
      const state = timerReducer(initialTimerState, { type: 'UNKNOWN_ACTION' });
      expect(state).toBe(initialTimerState);
    });
  });
});
