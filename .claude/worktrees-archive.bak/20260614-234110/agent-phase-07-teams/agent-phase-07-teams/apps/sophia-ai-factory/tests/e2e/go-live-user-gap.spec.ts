/**
 * Go-live E2E user GAP gate.
 *
 * This spec exercises the minimum production user path that must work before a
 * CF-direct deploy: real Better Auth sign-in, dashboard access, account page,
 * and video creation form visibility. It is strict-gated by
 * scripts/e2e-go-live-user-gap.sh, which sets E2E_REQUIRE_AUTH=1.
 */

import { test, expect } from './_fixtures/auth-fixture'

test.describe('@go-live user GAP', () => {
  test('signed-in user reaches dashboard and has a live session', async ({
    authenticatedPage,
    testUser,
  }) => {
    const dashboardResponse = await authenticatedPage.goto('/en/dashboard', {
      waitUntil: 'domcontentloaded',
    })

    expect(dashboardResponse?.ok(), 'dashboard should return 2xx').toBeTruthy()
    expect(authenticatedPage.url(), 'must not redirect to login').not.toMatch(/\/login/)
    await expect(
      authenticatedPage.getByRole('navigation', { name: /dashboard sidebar/i }),
    ).toBeVisible()
    await expect(authenticatedPage.getByRole('link', { name: /overview/i })).toBeVisible()

    const sessionResponse = await authenticatedPage.request.get('/api/auth/get-session')
    expect(sessionResponse.ok(), 'session endpoint should return 2xx').toBeTruthy()

    const session = (await sessionResponse.json()) as { user?: { email?: string } } | null
    expect(session?.user?.email).toBe(testUser.email)
  })

  test('signed-in user can open the video creation surface', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.goto('/en/dashboard/videos/new', {
      waitUntil: 'domcontentloaded',
    })

    expect(response?.ok(), 'video creation page should return 2xx').toBeTruthy()
    expect(authenticatedPage.url(), 'must stay on video creation page').toMatch(
      /\/dashboard\/videos\/new/,
    )

    await expect(authenticatedPage.locator('textarea[name="prompt"]')).toBeVisible()
    await expect(authenticatedPage.locator('select[name="style"]')).toBeVisible()
    await expect(authenticatedPage.locator('select[name="language"]')).toBeVisible()
    await expect(authenticatedPage.locator('button[type="submit"]')).toBeVisible()
  })

  test('signed-in user can open account and billing surfaces', async ({ authenticatedPage }) => {
    const accountResponse = await authenticatedPage.goto('/en/dashboard/account', {
      waitUntil: 'domcontentloaded',
    })
    expect(accountResponse?.ok(), 'account page should return 2xx').toBeTruthy()
    expect(authenticatedPage.url(), 'account page must not redirect to login').not.toMatch(
      /\/login/,
    )
    await expect(
      authenticatedPage.getByRole('heading', { name: /account & billing/i }),
    ).toBeVisible()
    await expect(authenticatedPage.getByRole('tab', { name: /profile/i })).toBeVisible()

    const billingResponse = await authenticatedPage.goto('/en/dashboard/billing', {
      waitUntil: 'domcontentloaded',
    })
    expect(billingResponse?.ok(), 'billing page should return 2xx').toBeTruthy()
    expect(authenticatedPage.url(), 'billing page must not redirect to login').not.toMatch(
      /\/login/,
    )
    await expect(
      authenticatedPage.getByRole('heading', { name: /billing & usage/i }),
    ).toBeVisible()
  })
})
