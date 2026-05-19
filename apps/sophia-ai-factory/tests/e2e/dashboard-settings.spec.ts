/**
 * E2E — /dashboard/settings : a11y + visual regression
 *
 * Checks:
 *   1. Settings page loads for authenticated user
 *   2. At least one form field (input or select) renders
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

test.describe('/dashboard/settings', () => {
  test('loads, has a form field, passes a11y and visual snapshot', async ({
    authenticatedPage: page,
    checkA11y,
    expectSnapshot,
  }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    // At least one input or select element should be present
    const formField = page.locator('input, select, textarea').first()
    await expect(formField).toBeVisible()

    // a11y gate: 0 serious|critical
    await checkA11y(page)

    // Visual baseline
    await expectSnapshot(page, 'dashboard-settings.png')
  })
})
