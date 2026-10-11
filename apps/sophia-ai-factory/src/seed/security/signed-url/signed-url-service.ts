/**
 * Signed URL Token Generation Service
 *
 * Implements createSignedDownloadToken supporting positional and object parameter overloads.
 *
 * Layer: seed/security
 *
 * @module seed/security/signed-url/signed-url-service
 */

import {
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  type CreateSignedDownloadTokenParams,
  type SignedDownloadTokenPayload,
} from './types';
import { stringToBase64Url, computeHmacSha256Hex } from './hmac-signer';

/**
 * Creates a signed download token valid for 24 hours (or specified TTL).
 * Supports both params object and positional arguments.
 *
 * Token format: `${base64UrlPayload}.${signatureHex}`
 */
export async function createSignedDownloadToken(
  params: CreateSignedDownloadTokenParams,
): Promise<string>;
export async function createSignedDownloadToken(
  videoId: string,
  userId: string,
  ttlSeconds: number,
  secret: string,
  tenantId?: string,
): Promise<string>;
export async function createSignedDownloadToken(
  paramOrVideoId: CreateSignedDownloadTokenParams | string,
  userId?: string,
  ttlSeconds?: number,
  secret?: string,
  tenantId?: string,
): Promise<string> {
  let vId: string;
  let uId: string;
  let tId: string;
  let ttl: number;
  let sec: string;

  if (typeof paramOrVideoId === 'object' && paramOrVideoId !== null) {
    vId = paramOrVideoId.videoId;
    uId = paramOrVideoId.userId;
    tId = paramOrVideoId.tenantId;
    ttl = paramOrVideoId.ttlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS;
    sec = paramOrVideoId.secret;
  } else {
    vId = paramOrVideoId;
    uId = userId ?? '';
    tId = tenantId ?? 'default-tenant';
    ttl = ttlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS;
    sec = secret ?? '';
  }

  if (!sec || typeof sec !== 'string') {
    throw new Error('INVALID_SECRET: secret must be a non-empty string');
  }
  if (!vId || typeof vId !== 'string') {
    throw new Error('INVALID_VIDEO_ID: videoId must be a non-empty string');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = nowSec + ttl;

  const payload: SignedDownloadTokenPayload = {
    videoId: vId,
    userId: uId,
    tenantId: tId,
    issuedAt: nowSec,
    expiresAt,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = stringToBase64Url(payloadJson);
  const signatureHex = await computeHmacSha256Hex(sec, payloadB64);

  return `${payloadB64}.${signatureHex}`;
}
