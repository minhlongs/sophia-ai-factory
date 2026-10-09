/**
 * Webhook Dispatcher & Cryptographic Event Bus (Root Facade).
 *
 * Implements:
 * - Web Crypto HMAC-SHA256 signature signing and constant-time verification.
 * - Anti-replay attack tolerance window (default 300 seconds).
 * - 5-attempt exponential backoff schedule with jitter.
 * - Non-retryable HTTP 4xx immediate aborts.
 * - D1 persistence for webhook subscriptions and delivery logs.
 *
 * Layer: tree/integrations (Pure domain engine — imports only from @/seed and @/tree/)
 *
 * @module tree/integrations/webhook-dispatcher
 */

export * from './dispatcher';
