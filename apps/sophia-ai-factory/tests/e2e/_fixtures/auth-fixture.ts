/**
 * Playwright auth fixture — provides `authenticatedPage` to specs that need
 * a real signed Better Auth session.
 *
 * Usage:
 *   import { test, expect } from '../_fixtures/auth-fixture'
 *
 *   test('only-logged-in users see X', async ({ authenticatedPage }) => {
 *     await authenticatedPage.goto('/dashboard')
 *     await expect(authenticatedPage.locator('h1')).toContainText(/dashboard/i)
 *   })
 *
 * Required env (see .env.test or shell):
 *   E2E_TEST_USER_EMAIL     — defaults to "e2e-master@sophia.test"
 *   E2E_TEST_USER_PASSWORD  — REQUIRED for auth tests; tests skip when absent
 *   E2E_REQUIRE_AUTH        — set to "1" in go-live gates to fail instead of skip
 *
 * Bootstrap the user once per environment with:
 *   npm run e2e:bootstrap-user
 */

import { test as base, expect, type Page } from '@playwright/test'
import { signIn, type SignInResult } from './auth-helpers'

export interface TestUser {
  email: string
  password: string
  signIn: SignInResult
}

interface AuthFixtures {
  testUser: TestUser
  authenticatedPage: Page
}

const DEFAULT_EMAIL = 'e2e-master@sophia.test'
const requireAuth = process.env.E2E_REQUIRE_AUTH === '1'

export const test = base.extend<AuthFixtures>({
  testUser: async ({ baseURL }, use) => {
    const email = process.env.E2E_TEST_USER_EMAIL ?? DEFAULT_EMAIL
    const password = process.env.E2E_TEST_USER_PASSWORD

    if (!password) {
      const message =
        'E2E_TEST_USER_PASSWORD env var not set — auth fixture unavailable. ' +
        'Run `npm run e2e:bootstrap-user` first, then export the password.'

      if (requireAuth) {
        throw new Error(message)
      }

      test.skip(true, message)
      return
    }

    if (requireAuth && !email.trim()) {
      throw new Error(
        'E2E_TEST_USER_EMAIL resolved to an empty value — cannot run strict auth gate.',
      )
    }

    if (!baseURL) {
      throw new Error('Playwright baseURL not configured — cannot sign in')
    }

    const result = await signIn({ baseURL, email, password })
    await use({ email, password, signIn: result })
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    await page.context().addCookies(testUser.signIn.cookies)
    await use(page)
  },
})

export { expect }
