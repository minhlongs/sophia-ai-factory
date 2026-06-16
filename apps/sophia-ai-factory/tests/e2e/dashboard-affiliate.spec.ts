/**
 * E2E — /dashboard/affiliate : a11y + visual regression
 *
 * Checks:
 *   1. Page loads for authenticated user
 *   2. Earnings or program section is present
 *   3. WCAG 2.1 AA — 0 serious|critical violations
 *   4. Visual snapshot baseline committed
 *
 * Skipped automatically when E2E_TEST_USER_PASSWORD is not set.
 */

import { mergeTests, expect } from '@playwright/test'
import { test as authTest } from './fixtures/auth-fixture'
import { test as a11yTest } from './fixtures/a11y-test'
import { test as visualTest } from './fixtures/visual-test'

const test = mergeTests(authTest, a11yTest, visualTest)

test.describe('/dashboard/affiliate', () => {
  test('loads, shows earnings or program section, passes a11y and visual snapshot', async ({
    authenticatedPage: page,
    checkA11y,
    expectSnapshot,
  }) => {
    await page.goto('/dashboard/affiliate')
    await page.waitForLoadState('networkidle')

    // Earnings section or affiliate program heading should be visible
    const earningsOrProgram = page.locator(
      ':is([data-testid="earnings-section"], [data-testid="affiliate-program"], h1, h2)',
    ).first()
    await expect(earningsOrProgram).toBeVisible()

    // a11y gate: 0 serious|critical
    await checkA11y(page)

    // Visual baseline
    await expectSnapshot(page, 'dashboard-affiliate.png')
  })
})
