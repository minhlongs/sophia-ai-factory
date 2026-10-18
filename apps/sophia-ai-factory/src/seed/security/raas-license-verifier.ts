/**
 * Server-Side HMAC-SHA256 RaaS License Key Verifier
 *
 * Verifies signed `RAAS_LICENSE_KEY` tokens on the server using Web Crypto
 * HMAC-SHA256 (`computeHmacHex`) and constant-time comparison (`timingSafeEqual`).
 * Note: Symmetric HMAC requires `RAAS_LICENSE_SECRET` to remain strictly on the
 * trusted server / control plane and never be exposed to browser clients.
 *
 * Token format: `SOPHIA-RAAS-v1.<base64url-payload>.<hex-hmac-sha256>`
 *
 * Layer: seed/security
 * @module seed/security/raas-license-verifier
 */

import { computeHmacHex, timingSafeEqual } from './signature-primitives';
import {
  encodeBase64Url,
  decodeBase64Url,
  isValidLicensePayload,
  type RaasLicensePayload,
  type RaasLicenseVerificationResult,
} from './raas-license-codec';

export type { RaasLicensePayload, RaasLicenseVerificationResult } from './raas-license-codec';
export { encodeBase64Url, decodeBase64Url, isValidLicensePayload } from './raas-license-codec';

const LICENSE_PREFIX = 'SOPHIA-RAAS-v1';

/**
 * Issues a signed `SOPHIA-RAAS-v1` license token (used by AgencyOS control plane
 * and server-side verification tests).
 */
export async function issueRaasLicenseToken(
  payload: RaasLicensePayload,
  secret: string,
): Promise<string> {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${LICENSE_PREFIX}.${encodedPayload}`;
  const signatureHex = await computeHmacHex(signingInput, secret, 'SHA-256');
  return `${signingInput}.${signatureHex}`;
}

/**
 * Verifies a `SOPHIA-RAAS-v1` license token against a server-held HMAC secret
 * and checks expiration against `nowUnixSeconds`.
 */
export async function verifyRaasLicenseToken(
  token: string | undefined | null,
  secret: string | undefined | null,
  nowUnixSeconds: number = Math.floor(Date.now() / 1000),
): Promise<RaasLicenseVerificationResult> {
  if (!token || token.trim().length === 0) {
    return { valid: false, reason: 'MISSING_TOKEN' };
  }
  if (!secret || secret.trim().length < 16) {
    return { valid: false, reason: 'MISSING_SECRET' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX) {
    return { valid: false, reason: 'EMPTY_OR_MALFORMED_TOKEN' };
  }

  const [, encodedPayload, providedSig] = parts;
  const signingInput = `${LICENSE_PREFIX}.${encodedPayload}`;
  const expectedSig = await computeHmacHex(signingInput, secret.trim(), 'SHA-256');

  if (!timingSafeEqual(expectedSig, providedSig.toLowerCase())) {
    return { valid: false, reason: 'SIGNATURE_MISMATCH' };
  }

  const decodedJson = decodeBase64Url(encodedPayload);
  if (!decodedJson) {
    return { valid: false, reason: 'MALFORMED_TOKEN' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedJson);
  } catch {
    return { valid: false, reason: 'INVALID_PAYLOAD' };
  }

  if (!isValidLicensePayload(parsed)) {
    return { valid: false, reason: 'INVALID_PAYLOAD' };
  }

  if (parsed.expiresAt <= nowUnixSeconds) {
    return { valid: false, reason: 'LICENSE_EXPIRED', payload: parsed };
  }

  return { valid: true, payload: parsed };
}
