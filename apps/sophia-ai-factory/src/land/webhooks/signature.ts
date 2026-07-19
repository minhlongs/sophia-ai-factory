/**
 * Unified webhook signature — sign + verify.
 * Canonical implementation moved to @/seed/security/signature.
 * This file re-exports for backward compatibility.
 *
 * @module lib/webhooks/signature
 * @deprecated Import from @/seed/security/signature
 */

export {
  signWebhook,
  verifyWebhook,
  verifyInboundWebhook,
  computeHmacHex,
  hexToBytes,
  timingSafeEqual,
} from '@/seed/security/signature';

export type {
  InboundVerifyOptions,
  VerifyOptions,
} from '@/seed/security/signature';
