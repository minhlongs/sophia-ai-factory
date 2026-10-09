/**
 * @file crypto-signer.ts
 * @description HMAC-SHA256 signature generation and verification for compliance audit logs.
 * @layer tree
 */

import { bytesToHex } from '../cmek-envelope-engine';

/**
 * Generates an HMAC-SHA256 signature over the content hash using a compliance signing key.
 */
export async function signContentHash(contentHash: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(contentHash));
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Verifies an HMAC-SHA256 signature against the expected content hash.
 */
export async function verifySignature(
  contentHash: string,
  signatureHex: string,
  secret: string,
): Promise<boolean> {
  try {
    const expectedSig = await signContentHash(contentHash, secret);
    return expectedSig.toLowerCase() === signatureHex.toLowerCase();
  } catch {
    return false;
  }
}
