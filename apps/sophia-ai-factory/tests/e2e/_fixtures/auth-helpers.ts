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

import { request as createRequestContext, type Cookie } from '@playwright/test'

export interface SignInOptions {
  baseURL: string
  email: string
  password: string
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
 */
export async function signIn(opts: SignInOptions): Promise<SignInResult> {
  const api = await createRequestContext.newContext({ baseURL: opts.baseURL })
  try {
    const resp = await api.post('/api/auth/sign-in/email', {
      data: { email: opts.email, password: opts.password },
      headers: { 'content-type': 'application/json' },
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
