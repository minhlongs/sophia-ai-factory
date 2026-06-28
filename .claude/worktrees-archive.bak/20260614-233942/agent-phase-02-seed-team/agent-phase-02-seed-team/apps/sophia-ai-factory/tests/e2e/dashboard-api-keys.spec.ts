/**
 * E2E — /dashboard/api-keys : a11y + visual regression
 *
 * Checks:
 *   1. Page loads for authenticated user
 *   2. "API Keys" heading text is present (case-insensitive)
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

test.describe('/dashboard/api-keys', () => {
  test('loads, shows API Keys heading, passes a11y and visual snapshot', async ({
    authenticatedPage: page,
    checkA11y,
    expectSnapshot,
  }) => {
    await page.goto('/dashboard/api-keys')
    await page.waitForLoadState('networkidle')

    // Verify "API Keys" heading text is visible somewhere on the page
    const apiKeysHeading = page.getByRole('heading', { name: /api keys/i })
    await expect(apiKeysHeading).toBeVisible()

    // a11y gate: 0 serious|critical
    await checkA11y(page)

    // Visual baseline
    await expectSnapshot(page, 'dashboard-api-keys.png')
  })
})
