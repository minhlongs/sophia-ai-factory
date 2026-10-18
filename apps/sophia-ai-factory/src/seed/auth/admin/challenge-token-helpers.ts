/**
 * Internal helper functions for Admin Challenge Tokens
 * Layer: seed
 *
 * @module seed/auth/admin/challenge-token-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import type { ChallengePayload } from './types';

export function toBase64(s: string): string {
  const str = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (str.length % 4)) % 4;
  return str + '='.repeat(pad);
}

export function getAdminSecret(): string | undefined {
  const secret = process.env.ADMIN_CHALLENGE_SECRET || process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
  if (!process.env.ADMIN_CHALLENGE_SECRET && (process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET)) {
    const globalWithFlag = globalThis as typeof globalThis & { _adminChallengeSecretWarned?: boolean };
    if (!globalWithFlag._adminChallengeSecretWarned) {
      logger.warn('[require-admin] ADMIN_CHALLENGE_SECRET not set — falling back to BETTER_AUTH_SECRET/JWT_SECRET. Set dedicated secret for key separation.');
      globalWithFlag._adminChallengeSecretWarned = true;
    }
  }
  return secret;
}

export function parseAndVerifySignature(
  payloadB64: string,
  sigB64: string,
): { validSig: boolean; payload?: ChallengePayload } {
  let payload: ChallengePayload;
  try {
    payload = JSON.parse(atob(toBase64(payloadB64))) as ChallengePayload;
  } catch {
    return { validSig: false };
  }

  try {
    const decoded = atob(toBase64(sigB64));
    const sigBytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      sigBytes[i] = decoded.charCodeAt(i);
    }

    if (sigBytes.length !== 32) {
      return { validSig: false };
    }

    const canonicalSigB64 = btoa(String.fromCharCode(...sigBytes))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    if (sigB64 !== canonicalSigB64) {
      return { validSig: false };
    }

    return { validSig: true, payload };
  } catch {
    return { validSig: false };
  }
}
