/**
 * StoreReviewService
 * Manages Apple App Store rating prompts with strict lifecycle rules:
 * 1. NEVER prompts until the app has been opened at least 15 times.
 * 2. If skipped, prompts again only after an additional 15 app opens (opens 30, 45, etc.).
 * 3. Integrates directly with Apple's official StoreKit SKStoreReviewController
 *    so user stars and reviews are submitted straight to Apple App Store developer reviews.
 */

import { NativeModules, Platform, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';

const AppleStoreReviewManager = NativeModules?.AppleStoreReviewManager;

export interface ReviewPromptState {
  launchCount: number;
  lastPromptLaunchCount: number;
  hasCompletedReview: boolean;
  lastPromptTimestamp?: number;
}

export class StoreReviewService {
  private static instance: StoreReviewService;
  public static readonly MIN_LAUNCHES_BEFORE_FIRST_PROMPT = 15;
  public static readonly LAUNCHES_BETWEEN_PROMPTS = 15;
  private readonly stateFileName = 'CoursePal_ReviewPromptState.json';

  private inMemoryState: ReviewPromptState = {
    launchCount: 0,
    lastPromptLaunchCount: 0,
    hasCompletedReview: false
  };
  private isLoaded = false;

  private constructor() {}

  public static get shared(): StoreReviewService {
    if (!StoreReviewService.instance) {
      StoreReviewService.instance = new StoreReviewService();
    }
    return StoreReviewService.instance;
  }

  private get stateFilePath(): string {
    const dir = FileSystem?.documentDirectory || '';
    return `${dir}${this.stateFileName}`;
  }

  /**
   * Loads review prompt tracking state from disk with safe fallback
   */
  public async loadState(): Promise<ReviewPromptState> {
    try {
      if (!FileSystem?.documentDirectory) {
        this.isLoaded = true;
        return { ...this.inMemoryState };
      }

      const info = await FileSystem.getInfoAsync(this.stateFilePath);
      if (!info.exists) {
        this.isLoaded = true;
        return { ...this.inMemoryState };
      }

      const content = await FileSystem.readAsStringAsync(this.stateFilePath, {
        encoding: FileSystem.EncodingType.UTF8
      });

      if (content && content.trim().length > 0) {
        const parsed = JSON.parse(content);
        this.inMemoryState = {
          launchCount: Number(parsed?.launchCount) || 0,
          lastPromptLaunchCount: Number(parsed?.lastPromptLaunchCount) || 0,
          hasCompletedReview: Boolean(parsed?.hasCompletedReview),
          lastPromptTimestamp: parsed?.lastPromptTimestamp ? Number(parsed.lastPromptTimestamp) : undefined
        };
      }
    } catch (err) {
      // Fallback to in-memory state
    }
    this.isLoaded = true;
    return { ...this.inMemoryState };
  }

  /**
   * Persists tracking state to disk
   */
  public async saveState(state: ReviewPromptState): Promise<boolean> {
    this.inMemoryState = { ...state };
    try {
      if (!FileSystem?.documentDirectory) return true;
      await FileSystem.writeAsStringAsync(
        this.stateFilePath,
        JSON.stringify(state),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Records an app launch and increments the counter.
   * Returns the new launchCount.
   */
  public async recordAppLaunch(): Promise<number> {
    if (!this.isLoaded) {
      await this.loadState();
    }

    const updated: ReviewPromptState = {
      ...this.inMemoryState,
      launchCount: this.inMemoryState.launchCount + 1
    };

    await this.saveState(updated);
    return updated.launchCount;
  }

  /**
   * Evaluates if the review prompt should appear:
   * - Never appears if user has already completed a review.
   * - Never appears unless launchCount >= 15.
   * - If skipped, only appears again when (launchCount - lastPromptLaunchCount) >= 15.
   */
  public async shouldShowReviewPrompt(): Promise<boolean> {
    if (!this.isLoaded) {
      await this.loadState();
    }

    const { launchCount, lastPromptLaunchCount, hasCompletedReview } = this.inMemoryState;

    if (hasCompletedReview) {
      return false;
    }

    if (launchCount < StoreReviewService.MIN_LAUNCHES_BEFORE_FIRST_PROMPT) {
      return false;
    }

    if (lastPromptLaunchCount === 0) {
      return true;
    }

    const launchesSinceLastPrompt = launchCount - lastPromptLaunchCount;
    return launchesSinceLastPrompt >= StoreReviewService.LAUNCHES_BETWEEN_PROMPTS;
  }

  /**
   * Marks that the review prompt was shown or requested.
   * Sets lastPromptLaunchCount to the current launchCount so it recurs
   * strictly 15 launches/uses later.
   */
  public async markPromptShown(): Promise<void> {
    if (!this.isLoaded) {
      await this.loadState();
    }

    const updated: ReviewPromptState = {
      ...this.inMemoryState,
      lastPromptLaunchCount: this.inMemoryState.launchCount,
      lastPromptTimestamp: Date.now()
    };

    await this.saveState(updated);
  }

  /**
   * Marks that the user skipped or dismissed the review prompt.
   * Alias for markPromptShown.
   */
  public async markPromptSkipped(): Promise<void> {
    await this.markPromptShown();
  }

  /**
   * Marks that the user submitted or engaged with the rating review.
   * Ensures the prompt will not appear again.
   */
  public async markReviewCompleted(): Promise<void> {
    if (!this.isLoaded) {
      await this.loadState();
    }

    const updated: ReviewPromptState = {
      ...this.inMemoryState,
      hasCompletedReview: true,
      lastPromptLaunchCount: this.inMemoryState.launchCount,
      lastPromptTimestamp: Date.now()
    };

    await this.saveState(updated);
  }

  /**
   * Triggers Apple's official StoreKit SKStoreReviewController dialog.
   * iOS renders Apple's native system dialog with 5 interactive stars,
   * and any submitted star rating or review is sent directly to Apple's App Store servers.
   */
  public async requestReview(): Promise<boolean> {
    // Record that Apple's native StoreKit prompt was requested at this launch/use count
    // so it doesn't prompt again until another 15 uses pass
    await this.markPromptShown();

    if (Platform.OS === 'ios' && AppleStoreReviewManager?.requestReview) {
      try {
        await AppleStoreReviewManager.requestReview();
        return true;
      } catch (err) {
        // Fallback to direct App Store write-review URL
        return this.openAppStoreReviewPage();
      }
    } else {
      return this.openAppStoreReviewPage();
    }
  }

  /**
   * Deep-links directly to the App Store or Google Play Store product page with write-review action
   */
  public async openAppStoreReviewPage(): Promise<boolean> {
    if (Platform.OS === 'ios' && AppleStoreReviewManager?.openStoreReviewPage) {
      try {
        const result = await AppleStoreReviewManager.openStoreReviewPage();
        if (result) return true;
      } catch (err) {
        // Fallback to Linking
      }
    }

    if (Platform.OS === 'android') {
      const playMarketUrl = 'market://details?id=com.coursepal.app';
      const playWebUrl = 'https://play.google.com/store/apps/details?id=com.coursepal.app';
      try {
        if (Linking?.canOpenURL && Linking?.openURL) {
          const canOpenMarket = await Linking.canOpenURL(playMarketUrl).catch(() => false);
          if (canOpenMarket) {
            await Linking.openURL(playMarketUrl);
            return true;
          }
          await Linking.openURL(playWebUrl);
          return true;
        }
      } catch (err) {
        // Handled safely
      }
      return false;
    }

    const appStoreUrl = 'https://apps.apple.com/app/coursepal?action=write-review';
    try {
      if (Linking?.canOpenURL && Linking?.openURL) {
        const canOpen = await Linking.canOpenURL(appStoreUrl);
        if (canOpen) {
          await Linking.openURL(appStoreUrl);
          return true;
        }
      }
    } catch (err) {
      // Handled safely
    }
    return false;
  }

  /**
   * Cross-platform alias for openAppStoreReviewPage.
   */
  public openStoreReviewPage = this.openAppStoreReviewPage.bind(this);

  /**
   * Helper for tests to inspect in-memory state
   */
  public getState(): ReviewPromptState {
    return { ...this.inMemoryState };
  }

  /**
   * Helper for tests to reset state
   */
  public resetForTesting(state?: Partial<ReviewPromptState>): void {
    this.inMemoryState = {
      launchCount: 0,
      lastPromptLaunchCount: 0,
      hasCompletedReview: false,
      ...state
    };
    this.isLoaded = true;
  }
}

export const storeReviewService = StoreReviewService.shared;
