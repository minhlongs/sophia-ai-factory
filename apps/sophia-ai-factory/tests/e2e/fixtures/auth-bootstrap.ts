/**
 * Shared auth-bootstrap helper for E2E specs that need a real
 * Better Auth session.
 *
 * Uses `signIn()` from `./auth-helpers` which hits the real
 * /api/auth/sign-in/email endpoint and harvests the __Secure-
 * (or non-prefixed) session cookie.
 *
 * Consumers: handover-journey-260519, handover-bughunt-260519,
 *            ux-usability-260519 (and any future spec).
 *
 * Usage:
 *   import { bootstrappedSession } from './fixtures/auth-bootstrap';
 *   const { email, cookies } = await bootstrappedSession(baseURL);
 *   await page.context().addCookies(cookies);
 */

import { signIn } from './auth-helpers'

export interface BootstrappedSession {
  email: string
  password: string
  cookies: Array<{
    name: string
    value: string
    domain: string
    path: string
    secure?: boolean
    httpOnly: boolean
    sameSite: 'Lax' | 'Strict' | 'None'
  }>
}

const DEFAULT_EMAIL = `e2e-bootstrap-${Date.now()}@sophia.test`

/**
 * Create a fresh user (sign-up) then sign-in to harvest cookies.
 *
 * Falls back to the `E2E_TEST_USER_EMAIL` / `E2E_TEST_USER_PASSWORD`
 * env vars when provided so that a pre-bootstrapped reusable user
 * can be reused across spec runs.
 */
export async function bootstrappedSession(
  baseURL: string,
): Promise<BootstrappedSession> {
  const email =
    process.env.E2E_TEST_USER_EMAIL ??
    process.env.E2E_ADMIN_EMAIL ??
    DEFAULT_EMAIL
  const password =
    process.env.E2E_TEST_USER_PASSWORD ??
    process.env.E2E_ADMIN_PASSWORD ??
    ''

  if (!password) {
    throw new Error(
      'No E2E password configured. Set E2E_TEST_USER_PASSWORD or run `npm run e2e:bootstrap-user`.',
    )
  }

  // Try sign-in first (user may already exist)
  let signInResult
  try {
    signInResult = await signIn({ baseURL, email, password })
  } catch {
    // User doesn't exist yet — sign up via API then sign in
    const { request: createRequest } = await import('@playwright/test')
    const api = await createRequest.newContext({ baseURL })
    try {
      const csrfResp = await api.get('/api/auth/sign-in')
      const setCookieHeaders = csrfResp.headers()['set-cookie']
      const cookiesList: string[] = Array.isArray(setCookieHeaders)
        ? setCookieHeaders
        : setCookieHeaders
          ? [setCookieHeaders]
          : []
      const csrfCookie = cookiesList.find((c) => c.startsWith('better-auth.csrf='))
      const csrfToken = csrfCookie
        ? decodeURIComponent(csrfCookie.split(';')[0].split('=')[1] || '')
        : ''

      const signupResp = await api.post('/api/auth/sign-up', {
        data: { email, password, name: 'E2E Bootstrap User' },
        headers: {
          'content-type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      })
      if (
        !signupResp.ok() &&
        !/already.*exists/i.test((await signupResp.text().catch(() => '')).slice(0, 200))
      ) {
        throw new Error(
          `Sign-up failed: HTTP ${signupResp.status()}`,
        )
      }
    } finally {
      await api.dispose()
    }

    // Now sign-in to harvest real cookies
    signInResult = await signIn({ baseURL, email, password })
  }

  // signIn stores cookies via page.context().addCookies — we need plain
  // cookie objects for specs that manage their own browser context.
  const isSecure = baseURL.startsWith('https://')
  const cookieName = isSecure
    ? '__Secure-better-auth.session_token'
    : 'better-auth.session_token'

  // Extract the session token cookie from the storage state
  const sessionCookie = signInResult.cookies.find(
    (c) => c.name === cookieName || c.name === 'better-auth.session_token',
  )

  const hostname = new URL(baseURL).hostname

  return {
    email,
    password,
    cookies: [
      {
        name: sessionCookie?.name ?? cookieName,
        value: sessionCookie?.value ?? '',
        domain: hostname,
        path: '/',
        secure: isSecure,
        httpOnly: true,
        sameSite: 'Lax' as const,
      },
    ],
  }
}
