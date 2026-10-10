/**
 * Deploy Guard and Operator Identification Helpers
 * Layer: seed
 *
 * @module seed/auth/admin/operator-identity
 */

import type { NextRequest } from 'next/server';

/**
 * Check if request has valid deploy automation token.
 * Set DEPLOY_GUARD_API_TOKEN in environment for deploy-with-sha.sh.
 */
export function hasDeployToken(request: NextRequest | Request): boolean {
  const token = request.headers.get('X-Deploy-Guard-Token');
  const expected = process.env.DEPLOY_GUARD_API_TOKEN;
  return !!expected && token === expected;
}

/**
 * Get operator identifier from request.
 * For deploy script: X-Deploy-Operator header.
 * For web UI: extracts from admin_challenge_token cookie (signed).
 */
export function getOperatorId(request: NextRequest | Request): string {
  const deployOperator = request.headers.get('X-Deploy-Operator');
  if (deployOperator) return deployOperator;

  // Extract from admin_challenge_token cookie (signed payload contains userId)
  const cookieHeader = request.headers
    .get('cookie')
    ?.split(';')
    .find((c) => c.trim().startsWith('admin_challenge_token='))
    ?.split('=')
    .slice(1)
    .join('=');

  if (!cookieHeader) return 'unknown';

  const dotIdx = cookieHeader.lastIndexOf('.');
  if (dotIdx === -1) return 'unknown';

  const payloadB64 = cookieHeader.slice(0, dotIdx);
  const toBase64 = (s: string) => {
    const str = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (str.length % 4)) % 4;
    return str + '='.repeat(pad);
  };

  try {
    const payload = JSON.parse(atob(toBase64(payloadB64))) as { userId?: string };
    if (payload.userId) return payload.userId;
  } catch {
    // fall through
  }

  return 'unknown';
}
