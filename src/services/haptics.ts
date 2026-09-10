/**
 * Haptic Feedback Service
 * Parity with native iOS UIImpactFeedbackGenerator, UINotificationFeedbackGenerator,
 * and CoreHaptics selection feedback.
 *
 * Includes:
 * - Full style mapping: selection, light, medium, heavy, rigid, success, warning, error
 * - High-precision throttle guard to prevent taptic queue overflow during rapid scrubbing
 * - Headless fallback for test runner and web environments
 */

export type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid';

export interface HapticsProvider {
  notifySuccess(): Promise<void>;
  notifyWarning(): Promise<void>;
  notifyError(): Promise<void>;
  impactLight(): Promise<void>;
  impactMedium(): Promise<void>;
  impactHeavy(): Promise<void>;
  impactRigid(): Promise<void>;
  selection(): Promise<void>;
  throttledSelection(minIntervalMs?: number): Promise<void>;
  throttledImpact(style?: HapticImpactStyle, minIntervalMs?: number): Promise<void>;
}

class HapticsService implements HapticsProvider {
  private hapticsModule: any = null;
  private lastSelectionTimestamp: number = 0;
  private lastImpactTimestamp: number = 0;

  constructor() {
    try {
      this.hapticsModule = require('expo-haptics');
    } catch {
      this.hapticsModule = null;
    }
  }

  async notifySuccess(): Promise<void> {
    if (this.hapticsModule?.notificationAsync) {
      await this.hapticsModule.notificationAsync(
        this.hapticsModule.NotificationFeedbackType?.Success ?? 'success'
      );
    }
  }

  async notifyWarning(): Promise<void> {
    if (this.hapticsModule?.notificationAsync) {
      await this.hapticsModule.notificationAsync(
        this.hapticsModule.NotificationFeedbackType?.Warning ?? 'warning'
      );
    }
  }

  async notifyError(): Promise<void> {
    if (this.hapticsModule?.notificationAsync) {
      await this.hapticsModule.notificationAsync(
        this.hapticsModule.NotificationFeedbackType?.Error ?? 'error'
      );
    }
  }

  async impactLight(): Promise<void> {
    if (this.hapticsModule?.impactAsync) {
      await this.hapticsModule.impactAsync(
        this.hapticsModule.ImpactFeedbackStyle?.Light ?? 'light'
      );
    }
  }

  async impactMedium(): Promise<void> {
    if (this.hapticsModule?.impactAsync) {
      await this.hapticsModule.impactAsync(
        this.hapticsModule.ImpactFeedbackStyle?.Medium ?? 'medium'
      );
    }
  }

  async impactHeavy(): Promise<void> {
    if (this.hapticsModule?.impactAsync) {
      await this.hapticsModule.impactAsync(
        this.hapticsModule.ImpactFeedbackStyle?.Heavy ?? 'heavy'
      );
    }
  }

  async impactRigid(): Promise<void> {
    if (this.hapticsModule?.impactAsync) {
      await this.hapticsModule.impactAsync(
        this.hapticsModule.ImpactFeedbackStyle?.Rigid ?? 'rigid'
      );
    }
  }

  async selection(): Promise<void> {
    if (this.hapticsModule?.selectionAsync) {
      await this.hapticsModule.selectionAsync();
    }
  }

  /**
   * Throttles selection haptics to minIntervalMs (default 40ms)
   * Prevents taptic queue overflow during rapid slider drags or wave scrubbing
   */
  async throttledSelection(minIntervalMs: number = 40): Promise<void> {
    const now = Date.now();
    if (now - this.lastSelectionTimestamp < minIntervalMs) {
      return;
    }
    this.lastSelectionTimestamp = now;
    await this.selection();
  }

  /**
   * Throttles impact feedback to minIntervalMs (default 50ms)
   */
  async throttledImpact(style: HapticImpactStyle = 'light', minIntervalMs: number = 50): Promise<void> {
    const now = Date.now();
    if (now - this.lastImpactTimestamp < minIntervalMs) {
      return;
    }
    this.lastImpactTimestamp = now;

    switch (style) {
      case 'medium':
        await this.impactMedium();
        break;
      case 'heavy':
        await this.impactHeavy();
        break;
      case 'rigid':
        await this.impactRigid();
        break;
      case 'light':
      default:
        await this.impactLight();
        break;
    }
  }
}

export const haptics = new HapticsService();
