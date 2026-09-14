import { storeReviewService, StoreReviewService } from '../src/services/StoreReviewService';

describe('StoreReviewService: 15-Launch Cycle & Apple StoreKit Integration Protocol', () => {
  beforeEach(() => {
    storeReviewService.resetForTesting();
  });

  describe('Rule 1: Never prompts before 15 launches', () => {
    it('returns false for all launches from 1 to 14', async () => {
      for (let i = 1; i <= 14; i++) {
        await storeReviewService.recordAppLaunch();
        const shouldPrompt = await storeReviewService.shouldShowReviewPrompt();
        expect(shouldPrompt).toBe(false);
      }
      expect(storeReviewService.getState().launchCount).toBe(14);
    });

    it('triggers prompt exactly at launch 15', async () => {
      // Advance to launch 14
      for (let i = 1; i <= 14; i++) {
        await storeReviewService.recordAppLaunch();
      }
      expect(await storeReviewService.shouldShowReviewPrompt()).toBe(false);

      // Launch 15!
      await storeReviewService.recordAppLaunch();
      expect(storeReviewService.getState().launchCount).toBe(15);
      expect(await storeReviewService.shouldShowReviewPrompt()).toBe(true);
    });
  });

  describe('Rule 2: If skipped, recurs only after an additional 15 launches', () => {
    it('suppresses prompt on launches 16-29 after skip, and recurs at launch 30', async () => {
      // Reach launch 15
      storeReviewService.resetForTesting({ launchCount: 15 });
      expect(await storeReviewService.shouldShowReviewPrompt()).toBe(true);

      // User skips prompt at launch 15
      await storeReviewService.markPromptSkipped();
      expect(storeReviewService.getState().lastPromptLaunchCount).toBe(15);
      // Immediately after skip, prompt should not show
      expect(await storeReviewService.shouldShowReviewPrompt()).toBe(false);

      // Launches 16 through 29: MUST NEVER PROMPT
      for (let launch = 16; launch <= 29; launch++) {
        await storeReviewService.recordAppLaunch();
        const shouldPrompt = await storeReviewService.shouldShowReviewPrompt();
        expect(shouldPrompt).toBe(false);
      }
      expect(storeReviewService.getState().launchCount).toBe(29);

      // Launch 30: Exactly 15 launches later, MUST PROMPT AGAIN!
      await storeReviewService.recordAppLaunch();
      expect(storeReviewService.getState().launchCount).toBe(30);
      expect(await storeReviewService.shouldShowReviewPrompt()).toBe(true);
    });

    it('handles multiple consecutive skips correctly (recurs at 15, 30, 45...)', async () => {
      // First cycle at 15
      storeReviewService.resetForTesting({ launchCount: 15, lastPromptLaunchCount: 0 });
      expect(await storeReviewService.shouldShowReviewPrompt()).toBe(true);
      await storeReviewService.markPromptSkipped();

      // Second cycle at 30
      storeReviewService.resetForTesting({ launchCount: 30, lastPromptLaunchCount: 15 });
      expect(await storeReviewService.shouldShowReviewPrompt()).toBe(true);
      await storeReviewService.markPromptSkipped();

      // In between 31..44
      storeReviewService.resetForTesting({ launchCount: 44, lastPromptLaunchCount: 30 });
      expect(await storeReviewService.shouldShowReviewPrompt()).toBe(false);

      // Third cycle at 45
      storeReviewService.resetForTesting({ launchCount: 45, lastPromptLaunchCount: 30 });
      expect(await storeReviewService.shouldShowReviewPrompt()).toBe(true);
    });
  });

  describe('Rule 3: Once reviewed or rated, never prompts again', () => {
    it('permanently suppresses prompt once markReviewCompleted is called', async () => {
      storeReviewService.resetForTesting({ launchCount: 15 });
      expect(await storeReviewService.shouldShowReviewPrompt()).toBe(true);

      await storeReviewService.markReviewCompleted();
      expect(storeReviewService.getState().hasCompletedReview).toBe(true);
      expect(await storeReviewService.shouldShowReviewPrompt()).toBe(false);

      // Even after 100 more launches
      storeReviewService.resetForTesting({
        launchCount: 100,
        lastPromptLaunchCount: 15,
        hasCompletedReview: true
      });
      expect(await storeReviewService.shouldShowReviewPrompt()).toBe(false);
    });
  });

  describe('Rule 4: StoreKit Request Review Execution', () => {
    it('executes requestReview and openAppStoreReviewPage without crashing', async () => {
      const reviewResult = await storeReviewService.requestReview();
      expect(typeof reviewResult === 'boolean').toBe(true);

      const storePageResult = await storeReviewService.openAppStoreReviewPage();
      expect(typeof storePageResult === 'boolean').toBe(true);
    });
  });
});
