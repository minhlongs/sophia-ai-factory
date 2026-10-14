import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/seed/auth/better-auth-server';
import { getSessionCookieName, isProductionEnvironment } from '@/seed/auth/cookie-name';
import { signCookieValue } from '@/seed/auth/sign-cookie-value';
import { writeAuditLog } from '@/tree/admin/audit-log';
import { logger } from '@/seed/utils/logger-utility';

export async function createSessionForUser(
  userId: string,
  request: NextRequest,
): Promise<{ token: string; expiresAt: Date } | null> {
  try {
    const auth = await getAuth();
    const ctx = await (auth as unknown as {
      $context: Promise<{
        internalAdapter: {
          createSession: (
            userId: string,
            request: Request,
            dontRememberMe?: boolean,
            cookieAttributes?: Record<string, unknown>,
          ) => Promise<{ token: string; expiresAt: Date } | null>;
        };
      }>;
    }).$context;

    return await ctx.internalAdapter.createSession(userId, request);
  } catch (err) {
    logger.warn('[Welcome/Consume] Could not create Better Auth session via internalAdapter', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function issueAndAttachSession(
  handover: { id: string; customer_user_id: string },
  request: NextRequest,
  response: NextResponse,
): Promise<void> {
  const session = await createSessionForUser(handover.customer_user_id, request);
  if (!session) {
    logger.warn('[Welcome/Consume] Session not created — user will be redirected to /login', {
      handoverId: handover.id,
    });
    return;
  }

  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || '';
  if (!secret) {
    logger.error('[Welcome/Consume] Missing BETTER_AUTH_SECRET — cannot sign session cookie');
    return;
  }

  const cookieName = getSessionCookieName();
  const useSecure = isProductionEnvironment();
  const signedValue = await signCookieValue(session.token, secret);
  const expires = new Date(session.expiresAt).toUTCString();

  const parts = [`${cookieName}=${signedValue}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Expires=${expires}`];
  if (useSecure) parts.splice(2, 0, 'Secure');
  response.headers.append('Set-Cookie', parts.join('; '));

  await writeAuditLog({
    actorUserId: handover.customer_user_id,
    actionType: 'customer_handover_session_created',
    targetUserId: handover.customer_user_id,
    payload: { handoverId: handover.id, expiresAt: session.expiresAt },
  });
  logger.info('[Welcome/Consume] Signed session cookie set', {
    handoverId: handover.id,
    userId: handover.customer_user_id,
    cookieName,
    useSecureCookies: useSecure,
  });
}
