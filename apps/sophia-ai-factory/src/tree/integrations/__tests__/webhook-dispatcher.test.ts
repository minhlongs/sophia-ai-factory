/**
 * Webhook Dispatcher Unit & Integration Test Suite
 *
 * Verifies:
 * - Web Crypto HMAC-SHA256 signature generation (X-Sophia-Signature-256).
 * - Constant-time equality checks and header parsing.
 * - Replay attack rejection outside 5-minute (300s) tolerance window.
 * - 5-attempt exponential backoff progression with jitter.
 * - Non-retryable HTTP 4xx immediate aborts vs retryable 429/5xx.
 * - In-memory SQLite D1 database persistence and end-to-end dispatch.
 *
 * @vitest-environment node
 * @module tree/integrations/__tests__/webhook-dispatcher.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';
import {
  signWebhookPayload,
  verifyWebhookSignature,
  timingSafeEqual,
  parseSignatureHeader,
  calculateNextBackoffDelayMs,
  isRetryableHttpStatus,
  createWebhookSubscription,
  getWebhookSubscription,
  updateWebhookSubscription,
  listWebhookSubscriptions,
  recordWebhookDeliveryLog,
  listWebhookDeliveryLogs,
  dispatchWebhookEvent,
  testWebhookEndpoint,
  DEFAULT_TOLERANCE_SECONDS,
  BACKOFF_BASE_DELAYS_MS,
  MAX_DELIVERY_ATTEMPTS,
} from '../webhook-dispatcher';

function createMockD1(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      endpoint_url TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      event_types TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      failure_count INTEGER NOT NULL DEFAULT 0,
      last_delivery_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      signature TEXT NOT NULL,
      http_status INTEGER,
      response_body TEXT,
      duration_ms INTEGER,
      status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'retrying')),
      attempt_number INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (subscription_id) REFERENCES webhook_subscriptions(id)
    );
  `);

  const d1Wrapper = {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              const res = stmt.get(...args);
              return (res ?? null) as T;
            },
            async all<T>(): Promise<{ results: T[] }> {
              const res = stmt.all(...args);
              return { results: res as T[] };
            },
            async run(): Promise<{ success: boolean; meta: { changes: number } }> {
              const info = stmt.run(...args);
              return { success: true, meta: { changes: Number(info.changes) } };
            },
          };
        },
      };
    },
  };

  return d1Wrapper as unknown as D1Database;
}

describe('Webhook Dispatcher & Cryptographic Bus', () => {
  let db: D1Database;
  const testSecret = 'whsec_7f9c8b3e2a1d0f5c4b3a2e1d';

  beforeEach(() => {
    db = createMockD1();
  });

  describe('HMAC-SHA256 Web Crypto Signature Generation & Parsing', () => {
    it('signs payload and outputs correct header format t=<timestamp>,v1=<hex>', async () => {
      const payload = JSON.stringify({ event: 'deal.won', dealId: 'deal_100', amount: 5000 });
      const fixedTimestamp = 1758850000;

      const signResult = await signWebhookPayload(testSecret, payload, fixedTimestamp);

      expect(signResult.timestampSeconds).toBe(fixedTimestamp);
      expect(signResult.signatureHeader).toMatch(/^t=1758850000,v1=[a-f0-9]{64}$/);
      expect(signResult.signedPayload).toBe(`1758850000.${payload}`);
      expect(signResult.signatureHex).toHaveLength(64);
    });

    it('throws error when secret is empty or blank', async () => {
      await expect(signWebhookPayload('', '{}')).rejects.toThrow('WEBHOOK_SECRET_REQUIRED');
      await expect(signWebhookPayload('   ', '{}')).rejects.toThrow('WEBHOOK_SECRET_REQUIRED');
    });

    it('parses valid signature header correctly', () => {
      const header = 't=1758850000,v1=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const parsed = parseSignatureHeader(header);

      expect(parsed).not.toBeNull();
      expect(parsed?.timestampSeconds).toBe(1758850000);
      expect(parsed?.signatureHex).toBe('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');
    });

    it('returns null on malformed or empty signature headers', () => {
      expect(parseSignatureHeader('')).toBeNull();
      expect(parseSignatureHeader('invalid_header')).toBeNull();
      expect(parseSignatureHeader('t=not_a_number,v1=abc')).toBeNull();
      expect(parseSignatureHeader('t=123')).toBeNull();
    });

    it('timingSafeEqual behaves correctly for match and mismatch', () => {
      expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
      expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
      expect(timingSafeEqual('abcdef', 'abcde')).toBe(false);
      expect(timingSafeEqual('', '')).toBe(true);
    });
  });

  describe('Signature Verification & Replay Protection', () => {
    it('verifies a genuine signed payload within tolerance window', async () => {
      const payload = JSON.stringify({ event: 'video.rendered', videoId: 'vid_123' });
      const currentSec = 1758850000;
      const signResult = await signWebhookPayload(testSecret, payload, currentSec);

      const verification = await verifyWebhookSignature(
        testSecret,
        payload,
        signResult.signatureHeader,
        { currentTimestampSeconds: currentSec + 50 } // 50 seconds later, well within 300s
      );

      expect(verification.valid).toBe(true);
      expect(verification.timestampSeconds).toBe(currentSec);
    });

    it('REJECTS verification when payload has been tampered with', async () => {
      const originalPayload = JSON.stringify({ amount: 100 });
      const tamperedPayload = JSON.stringify({ amount: 999999 });
      const currentSec = 1758850000;
      const signResult = await signWebhookPayload(testSecret, originalPayload, currentSec);

      const verification = await verifyWebhookSignature(
        testSecret,
        tamperedPayload,
        signResult.signatureHeader,
        { currentTimestampSeconds: currentSec }
      );

      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain('INVALID_SIGNATURE');
    });

    it('REJECTS verification when secret key is wrong', async () => {
      const payload = JSON.stringify({ event: 'test' });
      const currentSec = 1758850000;
      const signResult = await signWebhookPayload(testSecret, payload, currentSec);

      const verification = await verifyWebhookSignature(
        'whsec_wrong_key_123456789',
        payload,
        signResult.signatureHeader,
        { currentTimestampSeconds: currentSec }
      );

      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain('INVALID_SIGNATURE');
    });

    it('REJECTS replay attack when timestamp is older than tolerance (300s)', async () => {
      const payload = JSON.stringify({ event: 'deal.won' });
      const oldTimestamp = 1758850000;
      const signResult = await signWebhookPayload(testSecret, payload, oldTimestamp);

      // Replay attempt 301 seconds later
      const verification = await verifyWebhookSignature(
        testSecret,
        payload,
        signResult.signatureHeader,
        { currentTimestampSeconds: oldTimestamp + 301 }
      );

      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain('REPLAY_ATTACK_DETECTED');
    });

    it('REJECTS timestamp too far into the future (replay/clock drift > 300s)', async () => {
      const payload = JSON.stringify({ event: 'deal.won' });
      const futureTimestamp = 1758851000;
      const signResult = await signWebhookPayload(testSecret, payload, futureTimestamp);

      // Current time is 1758850000 (1000s behind future timestamp)
      const verification = await verifyWebhookSignature(
        testSecret,
        payload,
        signResult.signatureHeader,
        { currentTimestampSeconds: 1758850000 }
      );

      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain('REPLAY_ATTACK_DETECTED');
    });
  });

  describe('Exponential Backoff Progression & HTTP Classification', () => {
    it('computes exact base delays for 5 attempts without jitter', () => {
      expect(calculateNextBackoffDelayMs(1, { enableJitter: false })).toBe(0);
      expect(calculateNextBackoffDelayMs(2, { enableJitter: false })).toBe(30_000); // 30s
      expect(calculateNextBackoffDelayMs(3, { enableJitter: false })).toBe(120_000); // 2m
      expect(calculateNextBackoffDelayMs(4, { enableJitter: false })).toBe(600_000); // 10m
      expect(calculateNextBackoffDelayMs(5, { enableJitter: false })).toBe(3_600_000); // 1h
      expect(calculateNextBackoffDelayMs(6, { enableJitter: false })).toBe(0); // Terminal
    });

    it('applies jitter within ±10% bounds when jitter is enabled', () => {
      for (let attempt = 2; attempt <= 5; attempt++) {
        const base = BACKOFF_BASE_DELAYS_MS[attempt - 1];
        const delayWithJitter = calculateNextBackoffDelayMs(attempt, { enableJitter: true });
        const minBound = base * 0.9;
        const maxBound = base * 1.1;
        expect(delayWithJitter).toBeGreaterThanOrEqual(minBound);
        expect(delayWithJitter).toBeLessThanOrEqual(maxBound);
      }
    });

    it('correctly classifies non-retryable 4xx vs retryable HTTP statuses', () => {
      // Non-retryable fatal client errors
      expect(isRetryableHttpStatus(400)).toBe(false);
      expect(isRetryableHttpStatus(401)).toBe(false);
      expect(isRetryableHttpStatus(403)).toBe(false);
      expect(isRetryableHttpStatus(404)).toBe(false);
      expect(isRetryableHttpStatus(410)).toBe(false);
      expect(isRetryableHttpStatus(422)).toBe(false);

      // Retryable client errors (rate limit and timeout)
      expect(isRetryableHttpStatus(408)).toBe(true);
      expect(isRetryableHttpStatus(429)).toBe(true);

      // Retryable server errors (5xx)
      expect(isRetryableHttpStatus(500)).toBe(true);
      expect(isRetryableHttpStatus(502)).toBe(true);
      expect(isRetryableHttpStatus(503)).toBe(true);
      expect(isRetryableHttpStatus(504)).toBe(true);
    });
  });

  describe('End-to-End Dispatching with Mock D1 & Fetch', () => {
    it('dispatches successfully on HTTP 200, verifies signature, and resets failure count', async () => {
      const sub = await createWebhookSubscription(db, {
        tenantId: 'tenant_test',
        endpointUrl: 'https://webhook.client.com/events',
        secretKey: testSecret,
        eventTypes: ['deal.won'],
        description: 'Customer ERP Integration',
      });

      let capturedHeader: string | null = null;
      let capturedBody: string | null = null;

      const mockFetch = vi.fn().mockImplementation(async (url, init) => {
        capturedHeader = init.headers['X-Sophia-Signature-256'];
        capturedBody = init.body;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ received: true }),
        };
      });

      const result = await dispatchWebhookEvent(
        db,
        sub,
        'deal.won',
        { dealId: 'deal_777', value: 10000 },
        { fetcher: mockFetch as unknown as typeof fetch, currentTimeSeconds: 1758850000 }
      );

      expect(result.status).toBe('success');
      expect(result.httpStatus).toBe(200);
      expect(result.nextRetryAt).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify delivery log persisted
      const logs = await listWebhookDeliveryLogs(db, sub.id);
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('success');
      expect(logs[0].httpStatus).toBe(200);

      // Verify the signature header sent was cryptographically valid
      expect(capturedHeader).not.toBeNull();
      const verifyReceived = await verifyWebhookSignature(
        testSecret,
        capturedBody!,
        capturedHeader!,
        { currentTimestampSeconds: 1758850000 }
      );
      expect(verifyReceived.valid).toBe(true);
    });

    it('immediately aborts with status "failed" on non-retryable HTTP 404', async () => {
      const sub = await createWebhookSubscription(db, {
        tenantId: 'tenant_404',
        endpointUrl: 'https://webhook.client.com/not-found',
        secretKey: testSecret,
        eventTypes: ['deal.won'],
      });

      const mockFetch = vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 404,
        text: async () => 'Endpoint Not Found',
      }));

      const result = await dispatchWebhookEvent(
        db,
        sub,
        'deal.won',
        { dealId: 'deal_888' },
        { fetcher: mockFetch as unknown as typeof fetch, attemptNumber: 1 }
      );

      expect(result.status).toBe('failed');
      expect(result.httpStatus).toBe(404);
      expect(result.nextRetryAt).toBeNull(); // No retry scheduled!

      // Subscription failure count incremented
      const updatedSub = await getWebhookSubscription(db, sub.id);
      expect(updatedSub?.failureCount).toBe(1);
    });

    it('schedules retry with exponential backoff on HTTP 429 Too Many Requests', async () => {
      const sub = await createWebhookSubscription(db, {
        tenantId: 'tenant_rate_limited',
        endpointUrl: 'https://api.rate-limited.com/webhook',
        secretKey: testSecret,
        eventTypes: ['deal.won'],
      });

      const mockFetch = vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      }));

      const startTime = Date.now();
      const result = await dispatchWebhookEvent(
        db,
        sub,
        'deal.won',
        { dealId: 'deal_999' },
        { fetcher: mockFetch as unknown as typeof fetch, attemptNumber: 1, enableJitter: false }
      );

      expect(result.status).toBe('retrying');
      expect(result.httpStatus).toBe(429);
      expect(result.nextRetryAt).not.toBeNull();
      // Attempt 1 -> Attempt 2 base delay is 30,000ms
      expect(result.nextRetryAt!).toBeGreaterThanOrEqual(startTime + 30_000);
    });

    it('marks terminal failure when attempt reaching MAX_DELIVERY_ATTEMPTS (5) fails on 500', async () => {
      const sub = await createWebhookSubscription(db, {
        tenantId: 'tenant_terminal',
        endpointUrl: 'https://api.server-down.com/webhook',
        secretKey: testSecret,
        eventTypes: ['deal.won'],
      });

      const mockFetch = vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      }));

      const result = await dispatchWebhookEvent(
        db,
        sub,
        'deal.won',
        { dealId: 'deal_terminal' },
        { fetcher: mockFetch as unknown as typeof fetch, attemptNumber: 5 } // 5th attempt!
      );

      expect(result.status).toBe('failed'); // Terminal failure!
      expect(result.nextRetryAt).toBeNull();
    });

    it('handles network timeout / connection abort gracefully with retry status', async () => {
      const sub = await createWebhookSubscription(db, {
        tenantId: 'tenant_network_fail',
        endpointUrl: 'https://unreachable-host.local/webhook',
        secretKey: testSecret,
        eventTypes: ['deal.won'],
      });

      const mockFetch = vi.fn().mockImplementation(async () => {
        throw new Error('ETIMEDOUT: Connection timed out');
      });

      const result = await dispatchWebhookEvent(
        db,
        sub,
        'deal.won',
        { dealId: 'deal_timeout' },
        { fetcher: mockFetch as unknown as typeof fetch, attemptNumber: 1, enableJitter: false }
      );

      expect(result.status).toBe('retrying');
      expect(result.httpStatus).toBeNull();
      expect(result.errorMessage).toContain('ETIMEDOUT');
      expect(result.nextRetryAt).not.toBeNull();
    });

    it('executes testWebhookEndpoint ping successfully', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
      }));

      const ping = await testWebhookEndpoint(
        'https://test.endpoint.com',
        testSecret,
        mockFetch as unknown as typeof fetch
      );

      expect(ping.success).toBe(true);
      expect(ping.httpStatus).toBe(200);
    });
  });
});
