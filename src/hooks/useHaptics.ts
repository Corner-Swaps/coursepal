/**
 * useHaptics Hook
 * Tactile feedback triggers matching iOS UIKit and CoreHaptics generator calls
 */

import { useCallback } from 'react';
import { haptics, HapticImpactStyle } from '../services/HapticsService';

export function useHaptics() {
  const selection = useCallback(() => {
    return haptics.selection();
  }, []);

  const throttledSelection = useCallback((minIntervalMs?: number) => {
    return haptics.throttledSelection(minIntervalMs);
  }, []);

  const light = useCallback(() => {
    return haptics.impactLight();
  }, []);

  const medium = useCallback(() => {
    return haptics.impactMedium();
  }, []);

  const heavy = useCallback(() => {
    return haptics.impactHeavy();
  }, []);

  const rigid = useCallback(() => {
    return haptics.impactRigid();
  }, []);

  const throttledImpact = useCallback((style?: HapticImpactStyle, minIntervalMs?: number) => {
    return haptics.throttledImpact(style, minIntervalMs);
  }, []);

  const success = useCallback(() => {
    return haptics.notifySuccess();
  }, []);

  const warning = useCallback(() => {
    return haptics.notifyWarning();
  }, []);

  const error = useCallback(() => {
    return haptics.notifyError();
  }, []);

  return {
    selection,
    throttledSelection,
    light,
    medium,
    heavy,
    rigid,
    throttledImpact,
    success,
    warning,
    error
  };
}
