/**
 * Dual-auth helper for API routes that accept EITHER:
 *   1. `Authorization: Bearer <openclaw_exchange_token>` (OpenClaw plugin)
 *   2. Better Auth session cookie (browser)
 *
 * Scope model: OpenClaw exchange tokens carry implicit full access (all scopes).
 * Scope enum is defined here for forward-compatibility — future token versions may
 * embed explicit scope lists. For now, a verified Bearer token satisfies any scope.
 *
 * Usage in a route:
 *   const auth = await getCurrentUserOrOpenClaw(request, { requiredScope: 'publish:write' });
 *   if (isAuthError(auth)) return auth.toNextResponse();
 *
 * @module seed/auth/get-current-user-or-openclaw
 */
import { NextResponse } from 'next/server';
import { verifyOpenclawToken } from '@/seed/auth/openclaw-token';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';

// ---------------------------------------------------------------------------
// Scope definitions
// ---------------------------------------------------------------------------

export type OpenClawScope =
  | 'publish:write'
  | 'publish:read'
  | 'video:write'
  | 'video:read';

/** All scopes implicitly granted to a verified OpenClaw exchange token. */
const ALL_OPENCLAW_SCOPES: OpenClawScope[] = [
  'publish:write',
  'publish:read',
  'video:write',
  'video:read',
];

// ---------------------------------------------------------------------------
// Return types — plain discriminated union (no instanceof)
// ---------------------------------------------------------------------------

export interface OpenClawAuthResult {
  _type: 'auth_ok';
  userId: string;
  source: 'openclaw' | 'cookie';
  /** Populated only for Bearer source. */
  scopes?: OpenClawScope[];
}

export interface OpenClawAuthError {
  _type: 'auth_error';
  status: 401 | 403;
  error: string;
  detail?: string;
  /** Convenience method — converts to NextResponse for route return. */
  toNextResponse(): NextResponse;
}

/** Type guard — narrows to error branch. */
export function isAuthError(result: OpenClawAuthResult | OpenClawAuthError): result is OpenClawAuthError {
  return result._type === 'auth_error';
}

function makeError(status: 401 | 403, error: string, detail?: string): OpenClawAuthError {
  return {
    _type: 'auth_error',
    status,
    error,
    detail,
    toNextResponse() {
      return NextResponse.json(
        detail ? { error, detail } : { error },
        { status },
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Helper — extract Bearer token from Authorization header
// ---------------------------------------------------------------------------

function extractBearer(headers: Headers): string | null {
  const raw = headers.get('authorization');
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Resolve the calling user from Bearer token OR session cookie, then check scope.
 *
 * Returns either `OpenClawAuthResult` (success) or `OpenClawAuthError` (failure).
 * Use `isAuthError()` to branch:
 *
 *   const auth = await getCurrentUserOrOpenClaw(request, { requiredScope: 'publish:write' });
 *   if (isAuthError(auth)) return auth.toNextResponse();
 */
export async function getCurrentUserOrOpenClaw(
  request: Request,
  options: { requiredScope: OpenClawScope },
): Promise<OpenClawAuthResult | OpenClawAuthError> {
  const { requiredScope } = options;
  const bearer = extractBearer(request.headers);

  if (bearer) {
    // --- Bearer path ---
    let verified: { userId: string; expiresAt: number } | null = null;
    try {
      verified = await verifyOpenclawToken(bearer);
    } catch (err) {
      logger.error('[get-current-user-or-openclaw] verifyOpenclawToken threw', err instanceof Error ? err : new Error(String(err)));
    }

    if (!verified) {
      // Bearer present but invalid — 401. Not fallback to cookie (explicit Bearer = plugin path).
      return makeError(401, 'Unauthorized');
    }

    // Scope check — current token grants ALL_OPENCLAW_SCOPES implicitly
    if (!ALL_OPENCLAW_SCOPES.includes(requiredScope)) {
      return makeError(403, 'Forbidden', `Scope '${requiredScope}' is not recognised`);
    }

    return { _type: 'auth_ok', userId: verified.userId, source: 'openclaw', scopes: ALL_OPENCLAW_SCOPES };
  }

  // --- Cookie path ---
  let user: { id: string } | null = null;
  try {
    user = await getCurrentUserFromHeaders(request.headers);
  } catch (err) {
    logger.error('[get-current-user-or-openclaw] getCurrentUserFromHeaders threw', err instanceof Error ? err : new Error(String(err)));
  }

  if (!user) {
    return makeError(401, 'Unauthorized');
  }

  return { _type: 'auth_ok', userId: user.id, source: 'cookie' };
}
