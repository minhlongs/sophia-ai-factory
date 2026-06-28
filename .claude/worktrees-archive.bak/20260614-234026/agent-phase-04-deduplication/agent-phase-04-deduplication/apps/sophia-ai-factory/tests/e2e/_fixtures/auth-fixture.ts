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
 *   E2E_TEST_USER_PASSWORD  — REQUIRED; tests skip when absent
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

export const test = base.extend<AuthFixtures>({
  testUser: async ({ baseURL }, use) => {
    const email = process.env.E2E_TEST_USER_EMAIL ?? DEFAULT_EMAIL
    const password = process.env.E2E_TEST_USER_PASSWORD

    if (!password) {
      test.skip(
        true,
        'E2E_TEST_USER_PASSWORD env var not set — auth fixture unavailable. ' +
          'Run `npm run e2e:bootstrap-user` first, then export the password.',
      )
      return
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
