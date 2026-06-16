/**
 * Better Auth helpers for Playwright E2E tests.
 *
 * Strategy: call Better Auth's own sign-in endpoint via Playwright's request
 * context, then harvest the Set-Cookie payload. This yields a *real* signed
 * session that the server accepts on subsequent requests — no direct SQLite
 * insertion (which would be rejected by Better Auth's session validation).
 *
 * User provisioning is a separate concern; see
 *   scripts/e2e-bootstrap-user.ts
 * for the one-time setup script (idempotent, run once per environment).
 */

import { request as createRequestContext, type Cookie, type Page } from '@playwright/test'

export interface SignInOptions {
  baseURL: string
  email: string
  password: string
}

/**
 * Legacy local-dev helper: inject an unsigned Better-Auth cookie into a page.
 *
 * Use only when the test requires direct SQLite seeding (e.g. `seedTestUser`
 * + `mockSseStreamWildcard`) and cannot use the `authenticatedPage` fixture.
 * Production runs cannot honour this cookie because the server validates the
 * signature on every request — tests that rely on it must guard themselves
 * with `test.skip(isRemote, ...)`.
 *
 * Prefer `authenticatedPage` from `./auth-fixture.ts` for any new test that
 * just needs to be signed in.
 */
export async function injectLocalAuthCookie(page: Page, sessionToken: string): Promise<void> {
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}

export interface SignInResult {
  cookies: Cookie[]
  userId: string
  sessionToken: string
}

interface SignInResponseBody {
  user?: { id?: string }
  token?: string
}

/**
 * Sign in a user against Better Auth and return cookies + session metadata.
 * Throws on non-2xx so test authors don't get silently unauthenticated tests.
 *
 * CSRF handling: Better Auth requires a CSRF token for POST /sign-in.
 * We first GET /api/auth/sign-in to establish a session and extract the
 * CSRF token from the `better-auth.csrf` cookie, then include it in the
 * POST request headers.
 */
export async function signIn(opts: SignInOptions): Promise<SignInResult> {
  const api = await createRequestContext.newContext({ baseURL: opts.baseURL })
  try {
    // Step 1: GET sign-in page to establish session and get CSRF token
    const csrfResp = await api.get('/api/auth/sign-in')
    if (!csrfResp.ok()) {
      throw new Error(`Failed to load CSRF token: HTTP ${csrfResp.status()}`)
    }

    // Extract CSRF token from Set-Cookie headers (may be string or array)
    const setCookieHeaders = csrfResp.headers()['set-cookie']
    const cookiesList = Array.isArray(setCookieHeaders) ? setCookieHeaders : (setCookieHeaders ? [setCookieHeaders] : [])
    const csrfCookie = cookiesList.find((c: string) => c.startsWith('better-auth.csrf='))
    const csrfToken = csrfCookie
      ? decodeURIComponent(csrfCookie.split(';')[0].split('=')[1] || '')
      : ''

    // Step 2: POST credentials with CSRF token
    const resp = await api.post('/api/auth/sign-in/email', {
      data: { email: opts.email, password: opts.password },
      headers: {
        'content-type': 'application/json',
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      },
    })

    if (!resp.ok()) {
      const body = await resp.text().catch(() => '<no body>')
      throw new Error(
        `Better Auth sign-in failed: HTTP ${resp.status()} — ${body.slice(0, 300)}`,
      )
    }

    const json = (await resp.json().catch(() => ({}))) as SignInResponseBody
    const state = await api.storageState()
    const cookies = state.cookies as Cookie[]

    if (cookies.length === 0) {
      throw new Error(
        'Better Auth sign-in returned 2xx but produced no cookies — check baseURL + Better Auth config.',
      )
    }

    return {
      cookies,
      userId: json.user?.id ?? 'unknown',
      sessionToken: json.token ?? '',
    }
  } finally {
    await api.dispose()
  }
}

/**
 * Sign out (clears Better Auth session). Best-effort — failures are swallowed
 * since teardown should never block test completion.
 */
export async function signOut(baseURL: string, cookies: Cookie[]): Promise<void> {
  try {
    const api = await createRequestContext.newContext({
      baseURL,
      storageState: { cookies, origins: [] },
    })
    await api.post('/api/auth/sign-out').catch(() => {
      /* swallow */
    })
    await api.dispose()
  } catch {
    /* swallow */
  }
}
