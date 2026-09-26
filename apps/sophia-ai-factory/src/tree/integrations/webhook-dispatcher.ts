/**
 * Webhook Dispatcher & Cryptographic Event Bus
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

import type { D1Database } from '@/seed/db/client';
import type {
  WebhookSubscription,
  WebhookSubscriptionRow,
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
  WebhookDeliveryLog,
  WebhookDeliveryLogRow,
  WebhookDeliveryStatus,
  WebhookSignResult,
  WebhookVerificationResult,
  WebhookDispatchResult,
} from './types';
import {
  mapWebhookSubscriptionRow,
  mapWebhookDeliveryLogRow,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

// ── Cryptographic Constants & Defaults ──────────────────────────────────────

export const DEFAULT_TOLERANCE_SECONDS = 300; // 5 minutes
export const SIGNATURE_HEADER_NAME = 'X-Sophia-Signature-256';
export const MAX_DELIVERY_ATTEMPTS = 5;

// Base retry delays in milliseconds for attempts 1 through 5:
// Attempt 1: immediate (0s)
// Attempt 2: 30s
// Attempt 3: 120s (2m)
// Attempt 4: 600s (10m)
// Attempt 5: 3600s (1h)
export const BACKOFF_BASE_DELAYS_MS: readonly number[] = [
  0,
  30_000,
  120_000,
  600_000,
  3_600_000,
] as const;

// ── Web Crypto HMAC-SHA256 Signing & Verification ───────────────────────────

/**
 * Computes HMAC-SHA256 hex digest using standard Web Crypto API.
 */
export async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string equality check to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Signs a payload with HMAC-SHA256 using the standard format:
 * Header: `X-Sophia-Signature-256: t=<timestamp_seconds>,v1=<hex_signature>`
 * Signed Message: `${timestamp_seconds}.${payload_json}`
 */
export async function signWebhookPayload(
  secretKey: string,
  payloadJson: string,
  timestampSeconds?: number
): Promise<WebhookSignResult> {
  if (!secretKey || secretKey.trim().length === 0) {
    throw new Error('WEBHOOK_SECRET_REQUIRED: Cannot sign payload without a secret key');
  }

  const t = timestampSeconds ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${t}.${payloadJson}`;
  const signatureHex = await computeHmacSha256(secretKey, signedPayload);
  const signatureHeader = `t=${t},v1=${signatureHex}`;

  return {
    signatureHeader,
    timestampSeconds: t,
    signatureHex,
    signedPayload,
  };
}

/**
 * Parses `t=<timestamp>,v1=<signature>` header format.
 */
export function parseSignatureHeader(
  header: string
): { timestampSeconds: number; signatureHex: string } | null {
  if (!header || typeof header !== 'string') return null;

  const parts = header.split(',');
  let timestampSeconds: number | null = null;
  let signatureHex: string | null = null;

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('t=')) {
      const val = parseInt(trimmed.slice(2), 10);
      if (Number.isFinite(val)) timestampSeconds = val;
    } else if (trimmed.startsWith('v1=')) {
      signatureHex = trimmed.slice(3).trim();
    }
  }

  if (timestampSeconds === null || !signatureHex) return null;
  return { timestampSeconds, signatureHex };
}

/**
 * Verifies a webhook signature against payload and secret key.
 * Enforces replay attack tolerance window (default 300s).
 */
export async function verifyWebhookSignature(
  secretKey: string,
  payloadJson: string,
  signatureHeader: string,
  options: {
    toleranceSeconds?: number;
    currentTimestampSeconds?: number;
  } = {}
): Promise<WebhookVerificationResult> {
  if (!secretKey) {
    return { valid: false, reason: 'MISSING_SECRET_KEY' };
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    return { valid: false, reason: 'MALFORMED_SIGNATURE_HEADER' };
  }

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowSec = options.currentTimestampSeconds ?? Math.floor(Date.now() / 1000);

  // Check 5-minute replay window
  const delta = Math.abs(nowSec - parsed.timestampSeconds);
  if (delta > tolerance) {
    return {
      valid: false,
      reason: `REPLAY_ATTACK_DETECTED: Timestamp delta ${delta}s exceeds tolerance ${tolerance}s`,
      timestampSeconds: parsed.timestampSeconds,
    };
  }

  const signedPayload = `${parsed.timestampSeconds}.${payloadJson}`;
  const expectedHex = await computeHmacSha256(secretKey, signedPayload);

  if (!timingSafeEqual(expectedHex, parsed.signatureHex)) {
    return {
      valid: false,
      reason: 'INVALID_SIGNATURE: Signature mismatch',
      timestampSeconds: parsed.timestampSeconds,
    };
  }

  return {
    valid: true,
    timestampSeconds: parsed.timestampSeconds,
  };
}

// ── Backoff & Retry Logic ───────────────────────────────────────────────────

/**
 * Computes next backoff delay in milliseconds for a given attempt number (1-based).
 * Jitter adds up to ±10% variation.
 */
export function calculateNextBackoffDelayMs(
  attemptNumber: number,
  options: {
    enableJitter?: boolean;
    jitterFraction?: number;
  } = {}
): number {
  if (attemptNumber < 1) return 0;
  if (attemptNumber > MAX_DELIVERY_ATTEMPTS) return 0;

  const baseDelay = BACKOFF_BASE_DELAYS_MS[attemptNumber - 1] ?? 0;
  if (baseDelay === 0) return 0;

  if (options.enableJitter === false) {
    return baseDelay;
  }

  const jitterRange = options.jitterFraction ?? 0.1; // ±10%
  const jitterFactor = 1 + (Math.random() * 2 - 1) * jitterRange;
  return Math.round(baseDelay * jitterFactor);
}

/**
 * Checks whether an HTTP status code should trigger a retry.
 * Non-retryable 4xx (400, 401, 403, 404, 410, etc.) abort immediately.
 * 408 (Timeout) and 429 (Rate Limit) are retryable.
 * 5xx server errors are retryable.
 */
export function isRetryableHttpStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}

// ── Subscription Operations ─────────────────────────────────────────────────

/**
 * Creates a new webhook subscription.
 */
export async function createWebhookSubscription(
  db: D1Database,
  input: CreateWebhookSubscriptionInput
): Promise<WebhookSubscription> {
  const id = input.id || generateId('whsub');
  const secretKey = input.secretKey || `whsec_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Date.now();
  const isActiveNum = input.isActive === false ? 0 : 1;
  const eventTypesJson = JSON.stringify(input.eventTypes || []);

  const query = `
    INSERT INTO webhook_subscriptions (
      id, tenant_id, endpoint_url, secret_key, event_types,
      is_active, description, failure_count, last_delivery_at,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, 0, NULL,
      ?, ?
    )
  `;

  await db
    .prepare(query)
    .bind(
      id,
      input.tenantId,
      input.endpointUrl.trim(),
      secretKey,
      eventTypesJson,
      isActiveNum,
      input.description?.trim() || null,
      now,
      now
    )
    .run();

  const created = await getWebhookSubscription(db, id);
  if (!created) {
    throw new Error(`Failed to retrieve newly created webhook subscription ${id}`);
  }
  return created;
}

/**
 * Retrieves a webhook subscription by ID.
 */
export async function getWebhookSubscription(
  db: D1Database,
  id: string
): Promise<WebhookSubscription | null> {
  const row = await db
    .prepare('SELECT * FROM webhook_subscriptions WHERE id = ?')
    .bind(id)
    .first<WebhookSubscriptionRow>();

  if (!row) return null;
  return mapWebhookSubscriptionRow(row);
}

/**
 * Updates an existing webhook subscription.
 */
export async function updateWebhookSubscription(
  db: D1Database,
  id: string,
  input: UpdateWebhookSubscriptionInput
): Promise<WebhookSubscription | null> {
  const parts: string[] = [];
  const bindings: unknown[] = [];
  const now = Date.now();

  if (input.endpointUrl !== undefined) {
    parts.push('endpoint_url = ?');
    bindings.push(input.endpointUrl.trim());
  }
  if (input.secretKey !== undefined) {
    parts.push('secret_key = ?');
    bindings.push(input.secretKey.trim());
  }
  if (input.eventTypes !== undefined) {
    parts.push('event_types = ?');
    bindings.push(JSON.stringify(input.eventTypes));
  }
  if (input.isActive !== undefined) {
    parts.push('is_active = ?');
    bindings.push(input.isActive ? 1 : 0);
  }
  if (input.description !== undefined) {
    parts.push('description = ?');
    bindings.push(input.description?.trim() || null);
  }

  parts.push('updated_at = ?');
  bindings.push(now);

  bindings.push(id);

  await db
    .prepare(`UPDATE webhook_subscriptions SET ${parts.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run();

  return getWebhookSubscription(db, id);
}

/**
 * Lists webhook subscriptions for a tenant.
 */
export async function listWebhookSubscriptions(
  db: D1Database,
  tenantId: string
): Promise<WebhookSubscription[]> {
  const result = await db
    .prepare('SELECT * FROM webhook_subscriptions WHERE tenant_id = ? ORDER BY created_at DESC')
    .bind(tenantId)
    .all<WebhookSubscriptionRow>();

  return (result.results || []).map(mapWebhookSubscriptionRow);
}

// ── Delivery Log Operations ─────────────────────────────────────────────────

/**
 * Records a delivery log entry in D1.
 */
export async function recordWebhookDeliveryLog(
  db: D1Database,
  log: {
    id?: string;
    subscriptionId: string;
    eventType: string;
    payload: Record<string, unknown>;
    signature: string;
    httpStatus: number | null;
    responseBody: string | null;
    durationMs: number | null;
    status: WebhookDeliveryStatus;
    attemptNumber: number;
    createdAt?: number;
  }
): Promise<WebhookDeliveryLog> {
  const id = log.id || generateId('whlog');
  const now = log.createdAt || Date.now();
  const payloadJson = JSON.stringify(log.payload || {});

  const query = `
    INSERT INTO webhook_delivery_logs (
      id, subscription_id, event_type, payload_json, signature,
      http_status, response_body, duration_ms, status, attempt_number,
      created_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?
    )
  `;

  await db
    .prepare(query)
    .bind(
      id,
      log.subscriptionId,
      log.eventType,
      payloadJson,
      log.signature,
      log.httpStatus,
      log.responseBody,
      log.durationMs,
      log.status,
      log.attemptNumber,
      now
    )
    .run();

  const row = await db
    .prepare('SELECT * FROM webhook_delivery_logs WHERE id = ?')
    .bind(id)
    .first<WebhookDeliveryLogRow>();

  if (!row) {
    throw new Error(`Failed to retrieve recorded webhook delivery log ${id}`);
  }
  return mapWebhookDeliveryLogRow(row);
}

/**
 * Lists webhook delivery logs for a subscription or all subscriptions.
 */
export async function listWebhookDeliveryLogs(
  db: D1Database,
  subscriptionId?: string,
  limit = 50
): Promise<WebhookDeliveryLog[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));

  let query = 'SELECT * FROM webhook_delivery_logs';
  const bindings: unknown[] = [];

  if (subscriptionId) {
    query += ' WHERE subscription_id = ?';
    bindings.push(subscriptionId);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(safeLimit);

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<WebhookDeliveryLogRow>();

  return (result.results || []).map(mapWebhookDeliveryLogRow);
}

// ── Dispatcher Engine ───────────────────────────────────────────────────────

export interface DispatchWebhookOptions {
  fetcher?: typeof fetch;
  attemptNumber?: number;
  currentTimeSeconds?: number;
  enableJitter?: boolean;
}

/**
 * Dispatches a webhook event to a subscription endpoint.
 * Signs payload with HMAC-SHA256, executes HTTP POST, records delivery log,
 * and schedules exponential backoff retry on retryable failure.
 */
export async function dispatchWebhookEvent(
  db: D1Database,
  subscription: WebhookSubscription,
  eventType: string,
  payload: Record<string, unknown>,
  options: DispatchWebhookOptions = {}
): Promise<WebhookDispatchResult> {
  const fetchFn = options.fetcher || globalThis.fetch;
  const attempt = options.attemptNumber ?? 1;
  const payloadJson = JSON.stringify(payload);

  // 1. Sign payload with HMAC-SHA256
  const signResult = await signWebhookPayload(
    subscription.secretKey,
    payloadJson,
    options.currentTimeSeconds
  );

  let httpStatus: number | null = null;
  let responseBody: string | null = null;
  let durationMs = 0;
  let deliveryStatus: WebhookDeliveryStatus = 'failed';
  let nextRetryAt: number | null = null;
  let errorMessage: string | null = null;

  const startTime = Date.now();

  try {
    const res = await fetchFn(subscription.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Sophia-Webhook-Dispatcher/2.0',
        [SIGNATURE_HEADER_NAME]: signResult.signatureHeader,
        'X-Sophia-Event': eventType,
        'X-Sophia-Attempt': String(attempt),
      },
      body: payloadJson,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    durationMs = Date.now() - startTime;
    httpStatus = res.status;

    try {
      responseBody = (await res.text()).slice(0, 2048);
    } catch {
      responseBody = null;
    }

    if (res.ok) {
      // HTTP 2xx Success
      deliveryStatus = 'success';
      nextRetryAt = null;

      // Update subscription stats: reset failure count, set last delivery
      await db
        .prepare('UPDATE webhook_subscriptions SET failure_count = 0, last_delivery_at = ? WHERE id = ?')
        .bind(Date.now(), subscription.id)
        .run();
    } else {
      // HTTP Error
      if (isRetryableHttpStatus(res.status) && attempt < MAX_DELIVERY_ATTEMPTS) {
        deliveryStatus = 'retrying';
        const delayMs = calculateNextBackoffDelayMs(attempt + 1, {
          enableJitter: options.enableJitter ?? true,
        });
        nextRetryAt = Date.now() + delayMs;
      } else {
        // Fatal non-retryable 4xx or reached max attempts
        deliveryStatus = 'failed';
        nextRetryAt = null;
      }

      await db
        .prepare('UPDATE webhook_subscriptions SET failure_count = failure_count + 1 WHERE id = ?')
        .bind(subscription.id)
        .run();
    }
  } catch (err: unknown) {
    durationMs = Date.now() - startTime;
    errorMessage = err instanceof Error ? err.message : String(err);

    // Network / timeout error is retryable
    if (attempt < MAX_DELIVERY_ATTEMPTS) {
      deliveryStatus = 'retrying';
      const delayMs = calculateNextBackoffDelayMs(attempt + 1, {
        enableJitter: options.enableJitter ?? true,
      });
      nextRetryAt = Date.now() + delayMs;
    } else {
      deliveryStatus = 'failed';
      nextRetryAt = null;
    }

    await db
      .prepare('UPDATE webhook_subscriptions SET failure_count = failure_count + 1 WHERE id = ?')
      .bind(subscription.id)
      .run();
  }

  // Record delivery log
  const log = await recordWebhookDeliveryLog(db, {
    subscriptionId: subscription.id,
    eventType,
    payload,
    signature: signResult.signatureHeader,
    httpStatus,
    responseBody,
    durationMs,
    status: deliveryStatus,
    attemptNumber: attempt,
    createdAt: Date.now(),
  });

  return {
    deliveryId: log.id,
    subscriptionId: subscription.id,
    eventType,
    status: deliveryStatus,
    httpStatus,
    responseBody,
    durationMs,
    attemptNumber: attempt,
    nextRetryAt,
    signature: signResult.signatureHeader,
    errorMessage,
  };
}

/**
 * Sends a lightweight test ping to a webhook endpoint.
 */
export async function testWebhookEndpoint(
  endpointUrl: string,
  secretKey: string,
  fetcher?: typeof fetch
): Promise<{ success: boolean; httpStatus?: number; error?: string }> {
  const fetchFn = fetcher || globalThis.fetch;
  const testPayload = {
    event: 'endpoint.test',
    timestamp: Date.now(),
    message: 'Sophia AI Factory Webhook Ping Verification',
  };
  const payloadJson = JSON.stringify(testPayload);

  try {
    const signResult = await signWebhookPayload(secretKey, payloadJson);
    const res = await fetchFn(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Sophia-Webhook-Dispatcher/2.0',
        [SIGNATURE_HEADER_NAME]: signResult.signatureHeader,
        'X-Sophia-Event': 'endpoint.test',
        'X-Sophia-Attempt': '1',
      },
      body: payloadJson,
      signal: AbortSignal.timeout(5_000),
    });

    return {
      success: res.ok,
      httpStatus: res.status,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
