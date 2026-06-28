/**
 * Enhanced auth fixtures — admin/regular user test data + helpers.
 *
 * Usage in tests:
 *   import { test, expect } from './fixtures/auth-fixtures'
 *
 * Provides:
 *   - testAdminUser: { email, password, role: 'admin', signIn }
 *   - testRegularUser: { email, password, role: 'user', signIn }
 *   - loginAs(page, credentials)
 *   - logout(page)
 *
 * Environment:
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD — admin credentials
 *   E2E_USER_EMAIL, E2E_USER_PASSWORD — regular user credentials
 *
 * Bootstrap both users:
 *   npm run e2e:bootstrap-users
 */

import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { signIn, type SignInResult } from './auth-helpers';
import { TestDataFactory } from './test-data.factory';

export interface TestUser {
  email: string;
  password: string;
  role: 'admin' | 'user';
  signIn: SignInResult;
}

interface AuthFixtures {
  testAdminUser: TestUser;
  testRegularUser: TestUser;
  adminPage: Page;
  userPage: Page;
}

const DEFAULT_ADMIN_EMAIL = 'e2e-admin@sophia.test';
const DEFAULT_USER_EMAIL = 'e2e-user@sophia.test';

export const test = base.extend<AuthFixtures>({
  testAdminUser: async ({ baseURL }, use) => {
    const email = process.env.E2E_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;

    if (!password || !baseURL) {
      test.skip(
        true,
        'E2E_ADMIN_PASSWORD env var not set — admin fixture unavailable. ' +
          'Run `npm run e2e:bootstrap-users` first, then export the password.',
      );
      return;
    }

    const result = await signIn({ baseURL, email, password });
    await use({ email, password, role: 'admin' as const, signIn: result });
  },

  testRegularUser: async ({ baseURL }, use) => {
    const email = process.env.E2E_USER_EMAIL ?? DEFAULT_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;

    if (!password || !baseURL) {
      test.skip(
        true,
        'E2E_USER_PASSWORD env var not set — user fixture unavailable. ' +
          'Run `npm run e2e:bootstrap-users` first, then export the password.',
      );
      return;
    }

    const result = await signIn({ baseURL, email, password });
    await use({ email, password, role: 'user' as const, signIn: result });
  },

  adminPage: async ({ page, testAdminUser }, use) => {
    await page.context().addCookies(testAdminUser.signIn.cookies);
    await use(page);
  },

  userPage: async ({ page, testRegularUser }, use) => {
    await page.context().addCookies(testRegularUser.signIn.cookies);
    await use(page);
  },
});

export { expect };

/**
 * Programmatic login helper for ad-hoc test scenarios.
 *
 * @param page - Playwright page
 * @param email - User email
 * @param password - User password
 * @returns SignInResult with cookies and session metadata
 */
export async function loginAs(page: Page, baseURL: string, email: string, password: string): Promise<SignInResult> {
  const result = await signIn({ baseURL, email, password });
  await page.context().addCookies(result.cookies);
  return result;
}

/**
 * Logout helper — clears session cookies.
 *
 * @param page - Playwright page
 */
export async function logout(page: Page): Promise<void> {
  // Clear all cookies to invalidate session
  await page.context().clearCookies();
  // Optionally navigate to logout endpoint
  try {
    await page.goto('/api/auth/sign-out', { waitUntil: 'load' });
  } catch {
    // Best effort — continue even if logout endpoint fails
  }
}

/**
 * Helper to check if current user has admin role.
 * Uses getCurrentUser pattern from the app.
 *
 * @param page - Playwright page
 * @returns true if user has admin role
 */
export async function isAdminUser(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get('/api/auth/get-session');
    if (!response.ok()) return false;
    const body = await response.json();
    return body.user?.metadata?.role === 'admin';
  } catch {
    return false;
  }
}

/**
 * Create test user via API (for dynamic test data).
 * Useful when tests need fresh users with specific roles.
 *
 * @param baseURL - Base URL of the app
 * @param email - User email (optional, generated if not provided)
 * @param password - User password (optional, generated if not provided)
 * @param role - User role ('admin' or 'user')
 * @returns TestUser with credentials and sign-in result
 */
export async function createTestUser(
  baseURL: string,
  email?: string,
  password?: string,
  role: 'admin' | 'user' = 'user'
): Promise<TestUser> {
  const userData = TestDataFactory.generateUser({ email, password });

  const { request: createRequest } = await import('@playwright/test');
  const api = await createRequest.newContext({ baseURL });
  try {
    // Step 1: GET sign-in page to establish session and get CSRF token
    const csrfResp = await api.get('/api/auth/sign-in');
    if (!csrfResp.ok()) {
      throw new Error(`Failed to load CSRF token: HTTP ${csrfResp.status()}`);
    }

    // Extract CSRF token from Set-Cookie headers (may be string or array)
    const setCookieHeaders = csrfResp.headers()['set-cookie'];
    const cookiesList = Array.isArray(setCookieHeaders) ? setCookieHeaders : (setCookieHeaders ? [setCookieHeaders] : []);
    const csrfCookie = cookiesList.find((c: string) => c.startsWith('better-auth.csrf='));
    const csrfToken = csrfCookie
      ? decodeURIComponent(csrfCookie.split(';')[0].split('=')[1] || '')
      : '';

    // Step 2: POST sign-up with CSRF token
    const signupResp = await api.post('/api/auth/sign-up', {
      data: {
        email: userData.email,
        password: userData.password,
        name: userData.name,
      },
      headers: {
        'content-type': 'application/json',
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      },
    });

    if (!signupResp.ok && !/already.*exists/i.test(await signupResp.text().catch(() => ''))) {
      throw new Error(`Failed to create test user: HTTP ${signupResp.status}`);
    }
  } finally {
    await api.dispose();
  }

  // If admin role, we'd need to update user metadata via admin API or direct DB
  // For now, return the user. Admin role may require separate admin action.
  const signInResult = await signIn({ baseURL, email: userData.email, password: userData.password });

  return {
    email: userData.email,
    password: userData.password,
    role,
    signIn: signInResult,
  };
}
