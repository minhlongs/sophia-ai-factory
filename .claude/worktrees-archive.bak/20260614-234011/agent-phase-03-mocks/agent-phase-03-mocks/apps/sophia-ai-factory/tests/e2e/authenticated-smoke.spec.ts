/**
 * Smoke tests that exercise the new auth fixture end-to-end.
 *
 * These run only when E2E_TEST_USER_PASSWORD is set (auto-skipped otherwise),
 * so they remain safe in the default unauthenticated test run.
 *
 * To enable:
 *   1. `npm run e2e:bootstrap-user` (one-time, per environment)
 *   2. export E2E_TEST_USER_PASSWORD='<password>'
 *   3. `npm run test:e2e -- authenticated-smoke`
 */

import { test, expect } from './_fixtures/auth-fixture'

test.describe('Auth fixture — smoke', () => {
  test('signs in and reaches dashboard without redirect', async ({ authenticatedPage }) => {
    const resp = await authenticatedPage.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    expect(resp).not.toBeNull()

    const finalUrl = authenticatedPage.url()
    expect(finalUrl, 'authenticated request should NOT redirect to /login').not.toMatch(/\/login/)
    expect(finalUrl).toMatch(/\/dashboard/)
  })

  test('signed-in user is exposed via /api/auth/get-session', async ({ authenticatedPage, testUser }) => {
    const resp = await authenticatedPage.request.get('/api/auth/get-session')
    expect(resp.ok(), 'get-session should return 2xx for an authenticated request').toBeTruthy()

    const body = (await resp.json()) as { user?: { email?: string } } | null
    expect(body?.user?.email, 'session payload should match bootstrapped user').toBe(testUser.email)
  })
})
