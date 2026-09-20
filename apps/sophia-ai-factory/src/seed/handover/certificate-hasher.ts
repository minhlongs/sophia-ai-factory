/**
 * Cryptographic Certificate Hasher
 * Layer: seed (Pure, Web Crypto API, Edge-compatible)
 *
 * Implements canonical SHA-256 hashing for immutable digital acceptance certificates.
 * Works uniformly in Cloudflare Workers workerd runtime, Node.js 18+, and browsers.
 *
 * @module seed/handover/certificate-hasher
 */

import type { HandoverCertificatePayload } from '@/seed/handover/handover-types';

/**
 * Computes SHA-256 hash over an arbitrary UTF-8 string using standard crypto.subtle.
 * Returns lowercase 64-character hexadecimal digest string.
 */
export async function hashStringSha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Deterministically canonicalizes a HandoverCertificatePayload into an
 * alphabetical, whitespace-normalized JSON string.
 */
export function canonicalizeCertificatePayload(payload: HandoverCertificatePayload): string {
  const normalized = {
    acceptanceCheckpoints: [...payload.acceptanceCheckpoints].sort(),
    customerEmail: payload.customerEmail.trim().toLowerCase(),
    customerName: payload.customerName.trim(),
    deployedSha: payload.deployedSha.trim().toLowerCase(),
    handoverId: payload.handoverId.trim(),
    manifestHash: payload.manifestHash ? payload.manifestHash.trim().toLowerCase() : '',
    signerEmail: payload.signerEmail.trim().toLowerCase(),
    signerName: payload.signerName.trim(),
    signerRole: payload.signerRole.trim(),
    tenantId: payload.tenantId ? payload.tenantId.trim() : null,
    tier: payload.tier.trim().toUpperCase(),
    timestamp: payload.timestamp,
  };

  return JSON.stringify(normalized);
}

/**
 * Generates a tamper-evident SHA-256 hash digest for a certificate payload.
 */
export async function generateCertificateSha256(
  payload: HandoverCertificatePayload,
): Promise<string> {
  const canonicalJson = canonicalizeCertificatePayload(payload);
  return await hashStringSha256(canonicalJson);
}

/**
 * Timing-safe constant-time comparison of two hex strings to prevent timing attacks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verifies that a certificate payload matches an expected SHA-256 digest.
 */
export async function verifyCertificateSha256(
  payload: HandoverCertificatePayload,
  expectedHash: string,
): Promise<boolean> {
  if (!expectedHash || typeof expectedHash !== 'string') return false;
  const computedHash = await generateCertificateSha256(payload);
  return constantTimeEqual(
    computedHash.toLowerCase().trim(),
    expectedHash.toLowerCase().trim(),
  );
}
