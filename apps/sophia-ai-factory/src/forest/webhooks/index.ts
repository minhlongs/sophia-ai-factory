/**
 * Sophia outbound webhook system — barrel export.
 * @module lib/webhooks
 */

export { sign, verify } from './signer';
export { signWebhook, verifyWebhook } from './signature';
export type { VerifyOptions } from './signature';
export { nextRetryDelay, nextRetryAt, isDeadLetter, MAX_ATTEMPTS } from './retry';
export { sendWebhook } from './sender';
export {
  listByTenant,
  getById,
  create,
  update,
  remove,
  recordAttempt,
  markSuccess,
  markFailure,
  listAttempts,
  getActiveEndpointsForEvent,
} from './registry';
export { emit } from './emitter';
export type {
  WebhookEvent,
  WebhookEndpoint,
  WebhookAttempt,
  WebhookPayload,
  AttemptStatus,
} from './types';
