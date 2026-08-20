/**
 * POST /api/auth/sign-in/email — Better Auth sign-in wrapper with account lockout (F01 / ASVS V2.2.2).
 *
 * Wraps the Better Auth catch-all handler to enforce per-account brute-force
 * protection. Specific path takes precedence over `[...all]/route.ts` in Next.js routing.
 *
 * Flow:
 *  1. Parse email from request body (clone, then re-stream to handler).
 *  2. Look up user_id by email in D1 `user` table.
 *  3. Pre-check lock via `checkAccountLock`; on locked → 423 immediately.
 *  4. Forward to Better Auth handler.
 *  5. Inspect response: 401 → `incrementFailedLogin`; 2xx → `resetFailedLogin`.
 *
 * Closes the wiring gap referenced in `seed/auth/account-lockout-hook.ts:27`
 * without depending on upstream Better Auth `beforeSignIn` hook.
 */

import { NextResponse } from 'next/server';
import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/seed/auth/better-auth-server';
import {
  checkAccountLock,
  incrementFailedLogin,
  resetFailedLogin,
  type D1Binding,
} from '@/seed/security/account-lockout';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

function getD1(): D1Binding | null {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Binding;
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
    Symbol.for('__cloudflare-context__')
  ];
  if (ctx?.env?.DB) return ctx.env.DB as D1Binding;
  return null;
}

async function lookupUserIdByEmail(db: D1Binding, email: string): Promise<string | null> {
  try {
    const row = await db
      .prepare('SELECT id FROM "user" WHERE email = ?1 LIMIT 1')
      .bind(email.toLowerCase().trim())
      .first<{ id: string }>();
    return row?.id ?? null;
  } catch (err) {
    logger.error('[auth/sign-in/email] user lookup failed', toError(err));
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  // Clone body so we can both read email and forward to Better Auth.
  let email: string | null = null;
  let bodyText: string;
  try {
    bodyText = await request.text();
    const parsed = JSON.parse(bodyText) as { email?: unknown };
    if (typeof parsed.email === 'string') email = parsed.email;
  } catch {
    // Malformed body — let Better Auth respond with its own 400.
    bodyText = '';
  }

  const forwarded = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: bodyText,
  });

  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
  }

  const db = await getD1();
  let userId: string | null = null;

  // Pre-check lock (best-effort — never block sign-in on infra errors).
  if (db && email) {
    userId = await lookupUserIdByEmail(db, email);
    if (userId) {
      try {
        const lock = await checkAccountLock(db, userId);
        if (lock.locked) {
          logger.warn('[F01] sign-in blocked — account locked', {
            userId,
            lockedUntil: lock.lockedUntil,
          });
          return NextResponse.json(
            {
              error: 'Account temporarily locked due to too many failed login attempts.',
              lockedUntil: lock.lockedUntil,
            },
            { status: 423 },
          );
        }
      } catch (err) {
        logger.error('[F01] pre-check lock failed (allowing through)', toError(err));
      }
    }
  }

  const { POST: handler } = toNextJsHandler(auth);
  const response = await handler(forwarded);

  // Post-inspect: increment on 401 (bad credentials), reset on 2xx (success).
  // Only act if we resolved a userId — anonymous failures (typo'd email) are
  // not tracked to avoid leaking account existence via lockout state.
  if (db && userId) {
    try {
      if (response.status === 401) {
        await incrementFailedLogin(db, userId);
      } else if (response.status >= 200 && response.status < 300) {
        await resetFailedLogin(db, userId);
      }
    } catch (err) {
      logger.error('[F01] post-inspect lockout update failed', toError(err));
    }
  }

  return response;
}
