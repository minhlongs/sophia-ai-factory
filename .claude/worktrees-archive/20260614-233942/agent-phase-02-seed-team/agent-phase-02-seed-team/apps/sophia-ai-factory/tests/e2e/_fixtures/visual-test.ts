/**
 * Playwright visual-regression fixture — wraps `.toHaveScreenshot()` with
 * deterministic defaults: animations off, dynamic regions masked.
 *
 * Usage:
 *   import { test, expect } from '../_fixtures/visual-test'
 *
 *   test('dashboard overview is visually stable', async ({ page, expectSnapshot }) => {
 *     await page.goto('/dashboard')
 *     await expectSnapshot(page, 'dashboard-overview.png')
 *   })
 *
 * Regenerate snapshots intentionally on `main` after design changes:
 *   npx playwright test --update-snapshots <spec>
 */

import { test as base, expect, type Page, type Locator } from '@playwright/test'

/**
 * Default selectors masked on every snapshot. Picks regions that change between
 * runs but should not invalidate a visual baseline (timestamps, avatar URLs,
 * toast notifications, status badges driven by Date.now()).
 */
export const DEFAULT_MASK_SELECTORS = [
  '[data-testid="timestamp"]',
  '[data-testid="last-updated"]',
  '[data-testid="avatar-image"]',
  '[role="status"]',
  '.toast',
  '.sonner-toast',
] as const

export interface ExpectSnapshotOptions {
  /** Additional CSS selectors to mask (merged with DEFAULT_MASK_SELECTORS) */
  mask?: string[]
  /** Replace defaults entirely (use sparingly) */
  maskOverride?: string[]
  /** Capture full scrollable page (default: viewport only for stability) */
  fullPage?: boolean
  /** Override Playwright's default 0.2 maxDiffPixelRatio (0 = strict) */
  maxDiffPixelRatio?: number
  /** Pre-snapshot hook (e.g. wait for specific data-loaded marker) */
  beforeSnapshot?: (page: Page) => Promise<void>
}

export interface VisualFixtures {
  expectSnapshot: (page: Page, name: string, opts?: ExpectSnapshotOptions) => Promise<void>
}

export const test = base.extend<VisualFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture API requires destructured first arg
  expectSnapshot: async ({}, use) => {
    await use(async (page, name, opts = {}) => {
      if (opts.beforeSnapshot) await opts.beforeSnapshot(page)

      const selectors = opts.maskOverride
        ? opts.maskOverride
        : [...DEFAULT_MASK_SELECTORS, ...(opts.mask ?? [])]

      const masks: Locator[] = selectors.map((sel) => page.locator(sel))

      await expect(page).toHaveScreenshot(name, {
        fullPage: opts.fullPage ?? false,
        animations: 'disabled',
        mask: masks,
        maxDiffPixelRatio: opts.maxDiffPixelRatio ?? 0.01,
      })
    })
  },
})

export { expect }
