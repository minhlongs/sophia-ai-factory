/**
 * E2E — /dashboard/admin : a11y + visual regression
 *
 * The admin route requires tier=MASTER. Two paths are covered:
 *
 *   - MASTER tier user  → admin page loads, a11y check passes
 *   - Non-MASTER user   → redirect to /dashboard?error=admin_required;
 *                         a11y check on landing page always runs
 *
 * The test determines which path it is on at runtime by checking whether
 * the final URL still contains "/dashboard/admin" after navigation.
 *
 * Skipped automatically when E2E_TEST_USER_PASSWORD is not set.
 */

import { mergeTests, expect } from '@playwright/test'
import { test as authTest } from './_fixtures/auth-fixture'
import { test as a11yTest } from './_fixtures/a11y-test'
import { test as visualTest } from './_fixtures/visual-test'

const test = mergeTests(authTest, a11yTest, visualTest)

test.describe('/dashboard/admin', () => {
  test('loads admin page (MASTER) or redirects with error (non-MASTER); a11y always passes', async ({
    authenticatedPage: page,
    checkA11y,
    expectSnapshot,
  }) => {
    await page.goto('/dashboard/admin')
    await page.waitForLoadState('networkidle')

    const finalUrl = page.url()
    const isMasterPage = finalUrl.includes('/dashboard/admin')

    if (isMasterPage) {
      // MASTER path: verify admin-specific content renders
      const heading = page.locator('h1')
      await expect(heading).toBeVisible()
      await checkA11y(page)
      await expectSnapshot(page, 'dashboard-admin-master.png')
    } else {
      // Non-MASTER path: verify redirect includes expected error param
      expect(finalUrl).toContain('error=admin_required')
      // a11y check on whatever page we landed on (e.g. /dashboard)
      await checkA11y(page)
      await expectSnapshot(page, 'dashboard-admin-redirect.png')
    }
  })
})
