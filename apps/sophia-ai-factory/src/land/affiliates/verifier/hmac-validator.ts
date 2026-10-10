/**
 * hmac-validator.ts — Land Layer
 * Constant-time HMAC comparison for affiliate postbacks
 */

import { verifyAffiliateHmac } from '@/tree/affiliate/hmac-verifier';
import type { VerifySignatureOptions } from './types';

/**
 * Verify HMAC-SHA256 postback signature.
 */
export async function verifyPostbackSignature(options: VerifySignatureOptions): Promise<boolean> {
  const { rawBody, signature, secret, algorithm = 'SHA-256' } = options;
  if (!rawBody || !signature || !secret) return false;
  return verifyAffiliateHmac(rawBody, signature, secret, algorithm);
}
