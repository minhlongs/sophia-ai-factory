/**
 * E2E — /dashboard (overview) : a11y + visual regression
 *
 * Checks:
 *   1. Page loads with authenticated session
 *   2. Primary heading is present
 *   3. WCAG 2.1 AA — 0 serious|critical violations
 *   4. Visual snapshot baseline committed
 *
 * Skipped automatically when E2E_TEST_USER_PASSWORD is not set.
 */

import { mergeTests, expect } from '@playwright/test'
import { test as authTest } from './_fixtures/auth-fixture'
import { test as a11yTest } from './_fixtures/a11y-test'
import { test as visualTest } from './_fixtures/visual-test'

const test = mergeTests(authTest, a11yTest, visualTest)

test.describe('/dashboard overview', () => {
  test('loads, has heading, passes a11y and visual snapshot', async ({
    authenticatedPage: page,
    checkA11y,
    expectSnapshot,
  }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Assert primary heading is present (case-insensitive)
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()

    // a11y gate: 0 serious|critical
    await checkA11y(page)

    // Visual baseline
    await expectSnapshot(page, 'dashboard-overview.png')
  })
})
