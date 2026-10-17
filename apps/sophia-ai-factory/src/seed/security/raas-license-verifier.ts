/**
 * Offline-Capable Web Crypto HMAC-SHA256 RaaS License Token Issuer & Verifier
 *
 * Allows self-hosted Commercial (`ENTERPRISE $799/mo` or `MASTER $4,999`)
 * deployments to cryptographically unlock `CLOUD_SAAS` and `ENTERPRISE_MASTER`
 * modules without requiring a hard dependency on an external license server.
 *
 * Token Format: `SOPHIA-RAAS-v1.<base64url-payload>.<hmac-sha256-hex>`
 *
 * Layer: seed/security
 * @module seed/security/raas-license-verifier
 */

import { computeHmacHex, timingSafeEqual } from './signature-primitives';
import type { SophiaEdition } from '@/seed/config/open-core-manifest';

const TOKEN_PREFIX = 'SOPHIA-RAAS-v1';

export type LicensedCommercialTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

export interface RaasLicensePayload {
  readonly licenseId: string;
  readonly orgId: string;
  readonly edition: Extract<SophiaEdition, 'cloud' | 'enterprise'>;
  readonly tier: LicensedCommercialTier;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly whiteLabelEnabled: boolean;
}

export interface RaasLicenseVerificationResult {
  readonly valid: boolean;
  readonly reason?:
    | 'EMPTY_OR_MALFORMED_TOKEN'
    | 'MISSING_SECRET'
    | 'SIGNATURE_MISMATCH'
    | 'INVALID_PAYLOAD_JSON'
    | 'LICENSE_EXPIRED';
  readonly payload?: RaasLicensePayload;
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(b64url: string): string | null {
  try {
    const padded = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const binary = atob(padded + '='.repeat(padLen));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function isValidPayloadShape(val: unknown): val is RaasLicensePayload {
  if (!val || typeof val !== 'object') return false;
  const rec = val as Record<string, unknown>;
  const validTiers = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
  const validEditions = ['cloud', 'enterprise'];
  return (
    typeof rec.licenseId === 'string' &&
    rec.licenseId.length > 0 &&
    typeof rec.orgId === 'string' &&
    rec.orgId.length > 0 &&
    typeof rec.edition === 'string' &&
    validEditions.includes(rec.edition) &&
    typeof rec.tier === 'string' &&
    validTiers.includes(rec.tier) &&
    typeof rec.issuedAt === 'number' &&
    typeof rec.expiresAt === 'number' &&
    typeof rec.whiteLabelEnabled === 'boolean'
  );
}

/**
 * Issues a signed `SOPHIA-RAAS-v1.<payload>.<sig>` license key for an Enterprise or Master buyer.
 */
export async function issueRaasLicenseToken(
  payload: RaasLicensePayload,
  secret: string,
): Promise<string> {
  if (!secret || secret.trim().length < 16) {
    throw new Error('RAAS_LICENSE_SECRET must be at least 16 characters');
  }
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${TOKEN_PREFIX}.${encodedPayload}`;
  const sigHex = await computeHmacHex(signingInput, secret, 'SHA-256');
  return `${signingInput}.${sigHex}`;
}

/**
 * Verifies a `SOPHIA-RAAS-v1.<payload>.<sig>` token in constant time and checks expiration.
 */
export async function verifyRaasLicenseToken(
  token: string,
  secret: string,
  nowUnixSec: number = Math.floor(Date.now() / 1000),
): Promise<RaasLicenseVerificationResult> {
  if (!secret || secret.trim().length < 16) {
    return { valid: false, reason: 'MISSING_SECRET' };
  }
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'EMPTY_OR_MALFORMED_TOKEN' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    return { valid: false, reason: 'EMPTY_OR_MALFORMED_TOKEN' };
  }

  const [, encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) {
    return { valid: false, reason: 'EMPTY_OR_MALFORMED_TOKEN' };
  }

  const signingInput = `${TOKEN_PREFIX}.${encodedPayload}`;
  const expectedSig = await computeHmacHex(signingInput, secret, 'SHA-256');
  if (!timingSafeEqual(expectedSig, providedSig.toLowerCase())) {
    return { valid: false, reason: 'SIGNATURE_MISMATCH' };
  }

  const decodedJson = decodeBase64Url(encodedPayload);
  if (!decodedJson) {
    return { valid: false, reason: 'INVALID_PAYLOAD_JSON' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedJson);
  } catch {
    return { valid: false, reason: 'INVALID_PAYLOAD_JSON' };
  }

  if (!isValidPayloadShape(parsed)) {
    return { valid: false, reason: 'INVALID_PAYLOAD_JSON' };
  }

  if (nowUnixSec >= parsed.expiresAt) {
    return { valid: false, reason: 'LICENSE_EXPIRED', payload: parsed };
  }

  return { valid: true, payload: parsed };
}
