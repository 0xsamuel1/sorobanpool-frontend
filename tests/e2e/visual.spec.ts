import { expect, test } from '@playwright/test';

/**
 * Visual regression for the core screens (issue #151).
 *
 * Captured at 360px width in both `en` and `pcm`. Dynamic content (times, countdowns, live pool numbers, avatars)
 * is masked so the screenshots are stable. Update the baselines with:
 *   pnpm test:e2e --project=mobile tests/e2e/visual.spec.ts --update-snapshots
 */

const SCREENS = [
  { name: 'home', path: '/' },
  { name: 'onboarding', path: '/onboarding' },
  { name: 'explore', path: '/explore' },
  { name: 'supplier', path: '/supplier' },
] as const;

/** Anything whose text changes between runs. Mark new dynamic elements with data-dynamic to mask them. */
const DYNAMIC = ['time', '[data-dynamic]', '[data-testid="countdown"]', '[data-testid="live-progress"]'];

test.use({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, hasTouch: false, isMobile: false });

for (const locale of ['en', 'pcm'] as const) {
  for (const screen of SCREENS) {
    test(`${screen.name} matches its baseline (${locale})`, async ({ page, context }) => {
      await context.addCookies([{ name: 'locale', value: locale, url: 'http://localhost:3101' }]);
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
      await page.goto(screen.path);
      await expect(page.getByRole('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot(`${screen.name}-${locale}.png`, {
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
        mask: DYNAMIC.map((s) => page.locator(s)),
        maxDiffPixelRatio: 0.01, // small tolerance for anti-aliasing across runs
      });
    });
  }
}
