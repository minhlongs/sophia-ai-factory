import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import type { User } from '@/seed/db/client';

export type RequireAdminResult = { user: User } | NextResponse;

/** Result type for recent-auth challenge check. */
export type RecentAuthResult =
  | { ok: true }
  | { ok: false; reason: 'no-challenge' | 'expired' | 'invalid' };

/**
 * Payload embedded in the admin_challenge_token cookie.
 * Signed via HMAC-SHA-256 with BETTER_AUTH_SECRET.
 * Format (JSON):  {"userId":"...","issuedAt":1234567890}
 */
interface ChallengePayload {
  userId: string;
  issuedAt: number;
}

/** Derive an HMAC-SHA-256 key from the application secret. */
async function deriveHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Mint an admin_challenge_token cookie value.
 * Format: base64url(payload_json).base64url(signature)
 * Called by /api/auth/admin-challenge on successful password/MFA verify.
 */
export async function mintAdminChallengeToken(
  userId: string,
  secret: string,
): Promise<string> {
  const payload: ChallengePayload = { userId, issuedAt: Date.now() };
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const key = await deriveHmacKey(secret);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${payloadB64}.${sigB64}`;
}

/**
 * Verify admin_challenge_token cookie on a protected mutation.
 * Reads the `admin_challenge_token` cookie (HttpOnly, Secure, SameSite=Strict).
 * Returns ok=true only when signature is valid AND token is within maxAgeMs.
 */
export async function requireRecentAuth(
  request: NextRequest | Request,
  maxAgeMs = 5 * 60 * 1000,
): Promise<RecentAuthResult> {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    return { ok: false, reason: 'invalid' };
  }

  const cookieHeader = request.headers
    .get('cookie')
    ?.split(';')
    .find((c) => c.trim().startsWith('admin_challenge_token='))
    ?.split('=')
    .slice(1)
    .join('=');

  if (!cookieHeader) {
    return { ok: false, reason: 'no-challenge' };
  }

  const dotIdx = cookieHeader.lastIndexOf('.');
  if (dotIdx === -1) {
    return { ok: false, reason: 'invalid' };
  }

  const payloadB64 = cookieHeader.slice(0, dotIdx);
  const sigB64 = cookieHeader.slice(dotIdx + 1);

  // Re-pad base64url → base64
  const toBase64 = (s: string) => {
    const str = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (str.length % 4)) % 4;
    return str + '='.repeat(pad);
  };

  let payload: ChallengePayload;
  try {
    payload = JSON.parse(atob(toBase64(payloadB64))) as ChallengePayload;
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  // Verify HMAC signature
  let sigBytes: Uint8Array;
  try {
    const b64 = toBase64(sigB64);
    const decoded = atob(b64);
    sigBytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      sigBytes[i] = decoded.charCodeAt(i);
    }
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  // Ensure signature is exactly 32 bytes for HMAC-SHA256
  if (sigBytes.length !== 32) {
    return { ok: false, reason: 'invalid' };
  }

  // Check canonical representation to prevent signature malleability
  const canonicalSigB64 = btoa(String.fromCharCode(...sigBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  if (sigB64 !== canonicalSigB64) {
    return { ok: false, reason: 'invalid' };
  }

  try {
    const key = await deriveHmacKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes as BufferSource,
      new TextEncoder().encode(payloadB64),
    );

    if (!valid) {
      return { ok: false, reason: 'invalid' };
    }
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  // Check age
  if (Date.now() - payload.issuedAt > maxAgeMs) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true };
}

/**
 * Check if request has valid deploy automation token.
 * Set DEPLOY_GUARD_API_TOKEN in environment for deploy-with-sha.sh.
 */
export function hasDeployToken(request: NextRequest | Request): boolean {
  const token = request.headers.get('X-Deploy-Guard-Token')
  const expected = process.env.DEPLOY_GUARD_API_TOKEN
  return !!expected && token === expected
}

/**
 * Get operator identifier from request.
 * For deploy script: X-Deploy-Operator header.
 * For web UI: extracts from admin_challenge_token cookie (signed).
 */
export function getOperatorId(request: NextRequest | Request): string {
  const deployOperator = request.headers.get('X-Deploy-Operator')
  if (deployOperator) return deployOperator

  // Extract from admin_challenge_token cookie (signed payload contains userId)
  const cookieHeader = request.headers
    .get('cookie')
    ?.split(';')
    .find((c) => c.trim().startsWith('admin_challenge_token='))
    ?.split('=')
    .slice(1)
    .join('=')

  if (!cookieHeader) return 'unknown'

  const dotIdx = cookieHeader.lastIndexOf('.')
  if (dotIdx === -1) return 'unknown'

  const payloadB64 = cookieHeader.slice(0, dotIdx)
  const toBase64 = (s: string) => {
    const str = s.replace(/-/g, '+').replace(/_/g, '/')
    const pad = (4 - (str.length % 4)) % 4
    return str + '='.repeat(pad)
  }

  try {
    const payload = JSON.parse(atob(toBase64(payloadB64))) as { userId?: string }
    if (payload.userId) return payload.userId
  } catch {
    // fall through
  }

  return 'unknown'
}

/**
 * Require admin (via session) OR valid deploy token.
 * Returns { userId: string, isDeployToken: boolean } on success,
 * or NextResponse on failure.
 *
 * Deploy token allows automated scripts to call admin APIs without session.
 */
export async function requireAdminOrDeploy(request: NextRequest | Request): Promise<{ userId: string; isDeployToken: boolean } | NextResponse> {
  // Try admin first
  const adminResult = await requireAdmin(request)
  if (!(adminResult instanceof NextResponse)) {
    return { userId: adminResult.user.id, isDeployToken: false }
  }

  // Not admin — check deploy token
  if (hasDeployToken(request)) {
    const operatorId = getOperatorId(request)
    if (operatorId) {
      return { userId: operatorId, isDeployToken: true }
    }
  }

  return adminResult // return the original 401/403
}

/**
 * Combined gate: require admin role AND recent authentication challenge.
 * This is the ASVS V3.5.1 enforcement helper for destructive admin mutations.
 *
 * Usage:
 * const auth = await requireAdminWithRecentAuth(request);
 * if (auth instanceof NextResponse) return auth;
 * // proceed with mutation — admin identity + recent auth confirmed
 */
export async function requireAdminWithRecentAuth(
	request: NextRequest | Request,
): Promise<RequireAdminResult & { recentAuth: true } | NextResponse> {
	// Step 1: Verify admin role (existing check)
	const adminResult = await requireAdmin(request);
	if (adminResult instanceof NextResponse) {
		return adminResult;
	}

	// Step 2: Verify recent auth challenge (ASVS V3.5.1)
	const recentAuth = await requireRecentAuth(request);
	if (!recentAuth.ok) {
		const status = recentAuth.reason === 'no-challenge' ? 401 : 403;
		return NextResponse.json(
			{
				error: 'Re-authentication required',
				reason: recentAuth.reason,
				detail:
					recentAuth.reason === 'no-challenge'
						? 'Please confirm your password to continue.'
						: 'Authentication session expired. Please try again.',
			},
			{ status },
		);
	}

	return { ...adminResult, recentAuth: true };
}

/**
 * Gate a route on Better Auth session + role === 'admin'.
 * Returns { user } on success, or a NextResponse with 401/403 on failure.
 *
 * Usage:
 *   const auth = await requireAdmin(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const { user } = auth;
 */
export async function requireAdmin(
  request: NextRequest | Request,
): Promise<RequireAdminResult> {
  const headers =
    request instanceof Request
      ? request.headers
      : (request as NextRequest).headers;
  const user = await getCurrentUserFromHeaders(headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: admin role required' },
      { status: 403 },
    );
  }
  return { user };
}
