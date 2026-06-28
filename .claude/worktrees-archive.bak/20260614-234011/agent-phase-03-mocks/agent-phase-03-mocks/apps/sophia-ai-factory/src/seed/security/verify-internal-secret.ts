/**
 * Internal Secret Verification — shared helper for all "internal" API routes.
 *
 * Usage:
 *   import { verifyInternalSecret } from '@/seed/security/verify-internal-secret';
 *   if (!verifyInternalSecret(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *
 * Header: x-internal-secret
 * Env:    INTERNAL_API_SECRET
 *
 * Edge-runtime compatible — uses a pure-JS constant-time compare (no node:crypto).
 */

import type { NextRequest } from 'next/server';

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both strings must be the same length for a true timing-safe comparison;
 * we normalise length by always comparing the first min(a,b) chars and OR-ing
 * a length mismatch flag — the iteration count is fixed at max(a,b).
 */
function timingSafeCompare(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let mismatch = a.length !== b.length ? 1 : 0;
  for (let i = 0; i < maxLen; i++) {
    const ca = a.charCodeAt(i) || 0;
    const cb = b.charCodeAt(i) || 0;
    mismatch |= ca ^ cb;
  }
  return mismatch === 0;
}

/**
 * Verify that the incoming request carries a valid x-internal-secret header
 * matching the INTERNAL_API_SECRET environment variable.
 *
 * Returns true when authenticated, false otherwise.
 * Returns false (not an error) when the env var is not configured — callers
 * should treat that as a misconfiguration and reject the request.
 */
export function verifyInternalSecret(request: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) return false;

  const provided = request.headers.get('x-internal-secret') ?? '';
  return timingSafeCompare(provided, expected);
}
