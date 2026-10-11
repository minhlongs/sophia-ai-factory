/**
 * Signed URL Token Validator & URL Builder
 *
 * Implements constant-time HMAC verification, expiration checks,
 * and signed download URL construction.
 *
 * Layer: seed/security
 *
 * @module seed/security/signed-url/url-validator
 */

import type {
  SignedDownloadTokenPayload,
  VerifySignedDownloadTokenParams,
  VerifySignedDownloadTokenResult,
} from './types';
import {
  timingSafeEqual,
  base64UrlToString,
  computeHmacSha256Hex,
} from './hmac-signer';

/**
 * Verifies a signed download token.
 * Validates HMAC signature with constant-time equality check and checks expiration.
 * Supports both params object and positional arguments.
 */
export async function verifySignedDownloadToken(
  params: VerifySignedDownloadTokenParams,
): Promise<VerifySignedDownloadTokenResult>;
export async function verifySignedDownloadToken(
  token: string,
  videoId: string,
  secret: string,
): Promise<VerifySignedDownloadTokenResult>;
export async function verifySignedDownloadToken(
  paramOrToken: VerifySignedDownloadTokenParams | string,
  maybeVideoId?: string,
  maybeSecret?: string,
): Promise<VerifySignedDownloadTokenResult> {
  let token: string;
  let videoId: string;
  let secret: string;

  if (typeof paramOrToken === 'object' && paramOrToken !== null) {
    token = paramOrToken.token;
    videoId = paramOrToken.videoId;
    secret = paramOrToken.secret;
  } else {
    token = paramOrToken;
    videoId = maybeVideoId ?? '';
    secret = maybeSecret ?? '';
  }

  if (!token || typeof token !== 'string' || !videoId || !secret) {
    return { valid: false, expired: false };
  }

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1 || dotIdx === 0 || dotIdx === token.length - 1) {
    return { valid: false, expired: false };
  }

  const payloadB64 = token.substring(0, dotIdx);
  const signatureHex = token.substring(dotIdx + 1);

  // Recompute HMAC signature
  try {
    const expectedSig = await computeHmacSha256Hex(secret, payloadB64);
    if (!timingSafeEqual(signatureHex.toLowerCase(), expectedSig.toLowerCase())) {
      return { valid: false, expired: false };
    }

    // Decode and parse payload
    const payloadJson = base64UrlToString(payloadB64);
    const parsed = JSON.parse(payloadJson) as Partial<SignedDownloadTokenPayload>;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.videoId !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      typeof parsed.issuedAt !== 'number'
    ) {
      return { valid: false, expired: false };
    }

    // Verify videoId match (prevents token reuse across different videos)
    if (parsed.videoId !== videoId) {
      return { valid: false, expired: false };
    }

    const payload: SignedDownloadTokenPayload = {
      videoId: parsed.videoId,
      userId: parsed.userId ?? '',
      tenantId: parsed.tenantId ?? '',
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };

    // Check expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > payload.expiresAt) {
      return { valid: false, expired: true, payload };
    }

    return { valid: true, expired: false, payload };
  } catch {
    return { valid: false, expired: false };
  }
}

/**
 * Helper to build an absolute signed download URL given a base URL and token.
 */
export function buildSignedDownloadUrl(baseUrl: string, videoId: string, token: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/api/videos/${encodeURIComponent(videoId)}/download?token=${encodeURIComponent(token)}`;
  return url;
}
