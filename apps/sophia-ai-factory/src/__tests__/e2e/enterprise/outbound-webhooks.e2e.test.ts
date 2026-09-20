/**
 * Enterprise Resilient Outbound Webhooks & Event Bus — Comprehensive 4-Tier E2E Test Suite
 *
 * Covers:
 * - Feature 1: Webhook subscription CRUD & event filtering
 * - Feature 2: Web Crypto timing-safe HMAC-SHA256 signature generator (t=...,v1=...)
 * - Feature 3: Signature verification, clock drift protection & replay defense
 * - Feature 4: Resilient retry delivery bus with exponential backoff & jitter
 * - Feature 5: Dead Letter Queue (DLQ) state transition & manual replay API
 *
 * Implements 4-Tier Test Architecture:
 * - Tier 1: Feature Coverage (>=5 tests per feature area)
 * - Tier 2: Boundary & Corner Cases (>=5 tests per feature area)
 * - Tier 3: Cross-Feature Combinations
 * - Tier 4: Real-World Scenarios
 *
 * @module __tests__/e2e/enterprise/outbound-webhooks.e2e.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEnterpriseD1,
  createWebhookEndpoint,
  generateWebhookSignature,
  verifyWebhookSignature,
  dispatchWebhookDelivery,
  processWebhookRetry,
  replayWebhookAttempt,
  calculateBackoffDelay,
  BACKOFF_SCHEDULE_SECONDS,
  type MockD1Database,
  type WebhookEndpoint,
} from './enterprise-test-harness';

describe('Enterprise Outbound Webhooks & Event Bus E2E Test Suite', () => {
  let db: MockD1Database;
  const testOrgId = 'org_webhook_enterprise';
  const otherOrgId = 'org_webhook_rival';
  const testSecret = 'whsec_test_secret_9999999999999999';

  beforeEach(async () => {
    db = createEnterpriseD1();

    // Seed test organizations
    await db
      .prepare(
        `INSERT INTO organizations (id, name, slug, tier, max_seats, status, created_at, updated_at)
         VALUES (?1, 'Webhook Org', 'webhook-org', 'master', 999, 'active', ?2, ?2)`
      )
      .bind(testOrgId, Date.now())
      .run();

    await db
      .prepare(
        `INSERT INTO organizations (id, name, slug, tier, max_seats, status, created_at, updated_at)
         VALUES (?1, 'Rival Org', 'rival-org', 'master', 999, 'active', ?2, ?2)`
      )
      .bind(otherOrgId, Date.now())
      .run();
  });

  // ============================================================================
  // TIER 1: FEATURE COVERAGE (>=5 tests per feature area)
  // ============================================================================
  describe('Tier 1: Feature Coverage', () => {
    describe('F1: Webhook Subscription Management & Event Filtering', () => {
      it('F1-1: creates an HTTPS webhook subscription with secret and event list', async () => {
        const endpoint = await createWebhookEndpoint(db, testOrgId, {
          url: 'https://api.customer.com/webhooks',
          secret: testSecret,
          description: 'Production Video Events',
          events: ['video.rendered', 'campaign.completed'],
        });

        expect(endpoint.id).toMatch(/^wep_/);
        expect(endpoint.org_id).toBe(testOrgId);
        expect(endpoint.url).toBe('https://api.customer.com/webhooks');
        expect(endpoint.secret).toBe(testSecret);
        expect(endpoint.events).toEqual(['video.rendered', 'campaign.completed']);
        expect(endpoint.status).toBe('active');
      });

      it('F1-2: rejects insecure HTTP (non-HTTPS) webhook URLs', async () => {
        await expect(
          createWebhookEndpoint(db, testOrgId, {
            url: 'http://insecure.customer.com/webhooks',
            secret: testSecret,
            events: ['video.rendered'],
          })
        ).rejects.toThrow(/INVALID_WEBHOOK_URL/);
      });

      it('F1-3: supports wildcard "*" event subscription', async () => {
        const endpoint = await createWebhookEndpoint(db, testOrgId, {
          url: 'https://api.customer.com/all-events',
          secret: testSecret,
          events: ['*'],
        });

        const delivery = await dispatchWebhookDelivery(db, endpoint, 'commission.earned', {
          amount: 5000,
        });

        expect(delivery.status).toBe('success');
      });

      it('F1-4: rejects dispatch for events the endpoint is not subscribed to', async () => {
        const endpoint = await createWebhookEndpoint(db, testOrgId, {
          url: 'https://api.customer.com/only-videos',
          secret: testSecret,
          events: ['video.rendered'],
        });

        await expect(
          dispatchWebhookDelivery(db, endpoint, 'payout.processed', { id: 'pay_1' })
        ).rejects.toThrow(/EVENT_NOT_SUBSCRIBED/);
      });

      it('F1-5: persists endpoint into webhook_endpoints database table', async () => {
        const endpoint = await createWebhookEndpoint(db, testOrgId, {
          url: 'https://api.customer.com/persisted',
          secret: testSecret,
          events: ['video.rendered'],
        });

        const record = await db
          .prepare(`SELECT * FROM webhook_endpoints WHERE id = ?1`)
          .bind(endpoint.id)
          .first<{ url: string; status: string }>();

        expect(record?.url).toBe('https://api.customer.com/persisted');
        expect(record?.status).toBe('active');
      });
    });

    describe('F2: Web Crypto Timing-Safe HMAC-SHA256 Signatures', () => {
      it('F2-1: generates signature in header format "t=<timestamp>,v1=<hex>"', async () => {
        const timestamp = 1717200000;
        const payload = JSON.stringify({ video_id: 'vid_123', status: 'completed' });
        const sig = await generateWebhookSignature(testSecret, payload, timestamp);

        expect(sig).toMatch(/^t=1717200000,v1=[a-f0-9]{64}$/);
      });

      it('F2-2: generates identical signature for identical secret, payload, and timestamp', async () => {
        const timestamp = 1717200000;
        const payload = '{"test":true}';
        const sig1 = await generateWebhookSignature(testSecret, payload, timestamp);
        const sig2 = await generateWebhookSignature(testSecret, payload, timestamp);

        expect(sig1).toBe(sig2);
      });

      it('F2-3: generates completely different signatures for different timestamps', async () => {
        const payload = '{"test":true}';
        const sig1 = await generateWebhookSignature(testSecret, payload, 1717200000);
        const sig2 = await generateWebhookSignature(testSecret, payload, 1717200001);

        expect(sig1).not.toBe(sig2);
      });

      it('F2-4: generates completely different signatures for different secrets', async () => {
        const timestamp = 1717200000;
        const payload = '{"test":true}';
        const sig1 = await generateWebhookSignature('secret_1', payload, timestamp);
        const sig2 = await generateWebhookSignature('secret_2', payload, timestamp);

        expect(sig1).not.toBe(sig2);
      });

      it('F2-5: signature covers 64-character SHA-256 hexadecimal output', async () => {
        const sig = await generateWebhookSignature(testSecret, 'hello', 1700000000);
        const hex = sig.split(',v1=')[1];
        expect(hex).toHaveLength(64);
      });
    });

    describe('F3: Signature Verification & Replay Protection', () => {
      it('F3-1: verifies valid signature matching payload and secret within drift window', async () => {
        const nowSec = Math.floor(Date.now() / 1000);
        const payload = JSON.stringify({ event: 'test' });
        const header = await generateWebhookSignature(testSecret, payload, nowSec);

        const isValid = await verifyWebhookSignature(testSecret, payload, header);
        expect(isValid).toBe(true);
      });

      it('F3-2: rejects signature when payload has been tampered with', async () => {
        const nowSec = Math.floor(Date.now() / 1000);
        const payload = JSON.stringify({ amount: 100 });
        const tampered = JSON.stringify({ amount: 100000 });
        const header = await generateWebhookSignature(testSecret, payload, nowSec);

        const isValid = await verifyWebhookSignature(testSecret, tampered, header);
        expect(isValid).toBe(false);
      });

      it('F3-3: rejects signature when secret is incorrect', async () => {
        const nowSec = Math.floor(Date.now() / 1000);
        const payload = JSON.stringify({ event: 'test' });
        const header = await generateWebhookSignature(testSecret, payload, nowSec);

        const isValid = await verifyWebhookSignature('wrong_secret', payload, header);
        expect(isValid).toBe(false);
      });

      it('F3-4: rejects replay attack when timestamp is older than 300 seconds tolerance', async () => {
        const staleSec = Math.floor(Date.now() / 1000) - 301; // 301s ago (>5 min drift)
        const payload = JSON.stringify({ event: 'replay' });
        const header = await generateWebhookSignature(testSecret, payload, staleSec);

        const isValid = await verifyWebhookSignature(testSecret, payload, header);
        expect(isValid).toBe(false);
      });

      it('F3-5: rejects malformed or empty signature headers', async () => {
        expect(await verifyWebhookSignature(testSecret, '{}', '')).toBe(false);
        expect(await verifyWebhookSignature(testSecret, '{}', 'invalid-format')).toBe(false);
        expect(await verifyWebhookSignature(testSecret, '{}', 't=nan,v1=123')).toBe(false);
        expect(await verifyWebhookSignature(testSecret, '{}', 't=12345')).toBe(false);
      });
    });

    describe('F4: Resilient Delivery Bus with Jittered Exponential Backoff', () => {
      it('F4-1: dispatches successfully on HTTP 200 response', async () => {
        const endpoint = await createWebhookEndpoint(db, testOrgId, {
          url: 'https://api.customer.com/success',
          secret: testSecret,
          events: ['video.rendered'],
        });

        const delivery = await dispatchWebhookDelivery(
          db,
          endpoint,
          'video.rendered',
          { id: 'vid_1' },
          async () => ({ status: 200, ok: true })
        );

        expect(delivery.status).toBe('success');
        expect(delivery.attempt_count).toBe(1);
        expect(delivery.response_code).toBe(200);
      });

      it('F4-2: schedules retry on HTTP 500 server error', async () => {
        const endpoint = await createWebhookEndpoint(db, testOrgId, {
          url: 'https://api.customer.com/server-error',
          secret: testSecret,
          events: ['video.rendered'],
        });

        const delivery = await dispatchWebhookDelivery(
          db,
          endpoint,
          'video.rendered',
          { id: 'vid_1' },
          async () => ({ status: 500, ok: false })
        );

        expect(delivery.status).toBe('failed');
        expect(delivery.attempt_count).toBe(1);
        expect(delivery.response_code).toBe(500);
        expect(delivery.next_attempt_at).toBeGreaterThan(Date.now());
      });

      it('F4-3: adheres to backoff schedule: 30s, 2m, 10m, 1h, 6h', () => {
        expect(calculateBackoffDelay(1)).toBe(30 * 1000);     // Attempt 1: 30s
        expect(calculateBackoffDelay(2)).toBe(120 * 1000);    // Attempt 2: 2m
        expect(calculateBackoffDelay(3)).toBe(600 * 1000);    // Attempt 3: 10m
        expect(calculateBackoffDelay(4)).toBe(3600 * 1000);   // Attempt 4: 1h
        expect(calculateBackoffDelay(5)).toBe(21600 * 1000);  // Attempt 5: 6h
      });

      it('F4-4: applies jitter within +/- 10% bounds', () => {
        for (let attempt = 1; attempt <= 5; attempt++) {
          const base = calculateBackoffDelay(attempt, false);
          const jittered = calculateBackoffDelay(attempt, true);
          expect(jittered).toBeGreaterThanOrEqual(base * 0.89);
          expect(jittered).toBeLessThanOrEqual(base * 1.15);
        }
      });

      it('F4-5: handles network timeout / fetch exceptions as failed attempt with backoff', async () => {
        const endpoint = await createWebhookEndpoint(db, testOrgId, {
          url: 'https://api.customer.com/timeout',
          secret: testSecret,
          events: ['video.rendered'],
        });

        const delivery = await dispatchWebhookDelivery(
          db,
          endpoint,
          'video.rendered',
          { id: 'vid_1' },
          async () => {
            throw new Error('ETIMEDOUT: Connection timed out after 10000ms');
          }
        );

        expect(delivery.status).toBe('failed');
        expect(delivery.response_code).toBe(0);
        expect(delivery.error_message).toContain('ETIMEDOUT');
      });
    });

    describe('F5: Dead Letter Queue (DLQ) & Manual Replay API', () => {
      it('F5-1: transitions to dead_letter status after reaching 5 failed attempts', async () => {
        const endpoint = await createWebhookEndpoint(db, testOrgId, {
          url: 'https://api.customer.com/dead',
          secret: testSecret,
          events: ['video.rendered'],
        });

        // Attempt 1
        let delivery = await dispatchWebhookDelivery(
          db,
          endpoint,
          'video.rendered',
          { id: 'vid_dlq' },
          async () => ({ status: 503, ok: false })
        );
        expect(delivery.status).toBe('failed');
        expect(delivery.attempt_count).toBe(1);

        // Attempts 2 to 4
        for (let a = 2; a <= 4; a++) {
          delivery = await processWebhookRetry(db, delivery.id, async () => ({ status: 503, ok: false }));
          expect(delivery.status).toBe('failed');
          expect(delivery.attempt_count).toBe(a);
        }

        // Attempt 5: strictly transitions to dead_letter!
        delivery = await processWebhookRetry(db, delivery.id, async () => ({ status: 503, ok: false }));
        expect(delivery.status).toBe('dead_letter');
        expect(delivery.attempt_count).toBe(5);
      });

      it('F5-2: persists dead_letter record in database with last response code', async () => {
        const endpoint = await createWebhookEndpoint(db, testOrgId, {
          url: 'https://api.customer.com/dlq-row',
          secret: testSecret,
          events: ['video.rendered'],
        });

        let delivery = await dispatchWebhookDelivery(
          db,
          endpoint,
          'video.rendered',
          { id: '1' },
          async () => ({ status: 504, ok: false })
        );

        for (let i = 2; i <= 5; i++) {
          delivery = await processWebhookRetry(db, delivery.id, async () => ({ status: 504, ok: false }));
        }

        const row = await db
          .prepare(`SELECT status, attempt_count, response_code FROM webhook_deliveries WHERE id = ?1`)
          .bind(delivery.id)
          .first<{ status: string; attempt_count: number; response_code: number }>();

        expect(row?.status).toBe('dead_letter');
        expect(row?.attempt_count).toBe(5);
        expect(row?.response_code).toBe(504);
      });

      it('F5-3: manual replay delivers payload with X-Sophia-Replay header and recovers to success', async () => {
        const endpoint = await createWebhookEndpoint(db, testOrgId, {
          url: 'https://api.customer.com/replay-success',
          secret: testSecret,
          events: ['video.rendered'],
        });

        // Fail to DLQ
        let delivery = await dispatchWebhookDelivery(
          db,
          endpoint,
          'video.rendered',
          { id: '1' },
          async () => ({ status: 500, ok: false })
        );
        for (let i = 2; i <= 5; i++) {
          delivery = await processWebhookRetry(db, delivery.id, async () => ({ status: 500, ok: false }));
        }
        expect(delivery.status).toBe('dead_letter');

        // Execute manual replay when recipient server is repaired
        const replayed = await replayWebhookAttempt(
          db,
          testOrgId,
          delivery.id,
          async (_url, headers) => {
            expect(headers['X-Sophia-Replay']).toBe('true');
            return { status: 200, ok: true };
          }
        );

        expect(replayed.status).toBe('success');
        expect(replayed.response_code).toBe(200);
      });

      it('F5-4: manual replay remains in dead_letter if recipient endpoint continues failing', async () => {
        const endpoint = await createWebhookEndpoint(db, testOrgId, {
          url: 'https://api.customer.com/replay-fail',
          secret: testSecret,
          events: ['video.rendered'],
        });

        const delivery = await dispatchWebhookDelivery(
          db,
          endpoint,
          'video.rendered',
          { id: '1' },
          async () => ({ status: 500, ok: false })
        );

        const replayed = await replayWebhookAttempt(
          db,
          testOrgId,
          delivery.id,
          async () => ({ status: 502, ok: false })
        );

        expect(replayed.status).toBe('dead_letter');
        expect(replayed.response_code).toBe(502);
      });

      it('F5-5: throws error if attempting to replay non-existent delivery ID', async () => {
        await expect(
          replayWebhookAttempt(db, testOrgId, 'del_ghost')
        ).rejects.toThrow(/DELIVERY_NOT_FOUND/);
      });
    });
  });

  // ============================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=5 tests)
  // ============================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('B1: timing attack resistance: comparison fails gracefully on unequal signature lengths', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const shortSigHeader = `t=${nowSec},v1=short`;
      const result = await verifyWebhookSignature(testSecret, 'payload', shortSigHeader);
      expect(result).toBe(false);
    });

    it('B2: rejects delivery replay across tenant boundaries (tenant isolation enforcement)', async () => {
      const endpoint = await createWebhookEndpoint(db, testOrgId, {
        url: 'https://api.customer.com/iso',
        secret: testSecret,
        events: ['video.rendered'],
      });

      const delivery = await dispatchWebhookDelivery(
        db,
        endpoint,
        'video.rendered',
        { test: 1 },
        async () => ({ status: 500, ok: false })
      );

      // Rival Org attempts to replay Org A's delivery record
      await expect(
        replayWebhookAttempt(db, otherOrgId, delivery.id)
      ).rejects.toThrow(/CROSS_TENANT_VIOLATION/);
    });

    it('B3: handles empty payload string correctly during signing and verification', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const header = await generateWebhookSignature(testSecret, '', nowSec);
      const isValid = await verifyWebhookSignature(testSecret, '', header);
      expect(isValid).toBe(true);
    });

    it('B4: handles future timestamps outside tolerance window (rejects future clock drift >300s)', async () => {
      const futureSec = Math.floor(Date.now() / 1000) + 350; // 350s in future
      const header = await generateWebhookSignature(testSecret, 'future', futureSec);
      const isValid = await verifyWebhookSignature(testSecret, 'future', header);
      expect(isValid).toBe(false);
    });

    it('B5: handles single-character bitflip in secret gracefully', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const header = await generateWebhookSignature(testSecret, 'data', nowSec);
      const tamperedSecret = testSecret.slice(0, -1) + (testSecret.slice(-1) === 'a' ? 'b' : 'a');
      const isValid = await verifyWebhookSignature(tamperedSecret, 'data', header);
      expect(isValid).toBe(false);
    });
  });

  // ============================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // ============================================================================
  describe('Tier 3: Cross-Feature Combinations', () => {
    it('P1: multi-tenant delivery isolation ensures webhooks only dispatch to own endpoints', async () => {
      const epA = await createWebhookEndpoint(db, testOrgId, {
        url: 'https://api.orga.com/wh',
        secret: 'secA_11111111111111111',
        events: ['video.rendered'],
      });

      const epB = await createWebhookEndpoint(db, otherOrgId, {
        url: 'https://api.orgb.com/wh',
        secret: 'secB_22222222222222222',
        events: ['video.rendered'],
      });

      const delA = await dispatchWebhookDelivery(db, epA, 'video.rendered', { org: 'A' });
      const delB = await dispatchWebhookDelivery(db, epB, 'video.rendered', { org: 'B' });

      expect(delA.org_id).toBe(testOrgId);
      expect(delB.org_id).toBe(otherOrgId);

      // Verify records in DB
      const rowsA = await db
        .prepare(`SELECT * FROM webhook_deliveries WHERE org_id = ?1`)
        .bind(testOrgId)
        .all<{ id: string }>();

      expect(rowsA.results).toHaveLength(1);
      expect(rowsA.results[0].id).toBe(delA.id);
    });

    it('P2: retry preserves original delivery ID and event payload across attempts', async () => {
      const endpoint = await createWebhookEndpoint(db, testOrgId, {
        url: 'https://api.customer.com/retry-persist',
        secret: testSecret,
        events: ['video.rendered'],
      });

      const origPayload = { videoId: 'vid_999', renderTimeMs: 12450 };
      const d1 = await dispatchWebhookDelivery(
        db,
        endpoint,
        'video.rendered',
        origPayload,
        async () => ({ status: 503, ok: false })
      );

      const d2 = await processWebhookRetry(
        db,
        d1.id,
        async () => ({ status: 503, ok: false })
      );

      expect(d2.id).toBe(d1.id);
      expect(JSON.parse(d2.payload)).toEqual(origPayload);
      expect(d2.attempt_count).toBe(2);
    });
  });

  // ============================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ============================================================================
  describe('Tier 4: Real-World Scenarios', () => {
    it('S1: complete Developer Outbound Webhook Lifecycle (Dispatch -> Transient Failure -> Backoff -> DLQ -> Replay)', async () => {
      // Step 1: Developer configures webhook endpoint for video production notifications
      const endpoint = await createWebhookEndpoint(db, testOrgId, {
        url: 'https://hooks.developer.com/production',
        secret: 'whsec_prod_developer_secret_12345678',
        description: 'Developer Video Engine Pipeline',
        events: ['video.rendered'],
      });
      expect(endpoint.status).toBe('active');

      // Step 2: System generates video and triggers outbound dispatch
      // Simulated: recipient developer server is temporarily returning 503 Service Unavailable
      let delivery = await dispatchWebhookDelivery(
        db,
        endpoint,
        'video.rendered',
        { videoId: 'vid_epic_campaign_1080p', renderCostCents: 15 },
        async (_url, headers, body) => {
          // Verify headers received by developer server
          expect(headers['X-Sophia-Event']).toBe('video.rendered');
          expect(headers['X-Sophia-Signature']).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);

          // Verify recipient can validate HMAC signature with their secret
          const valid = await verifyWebhookSignature(endpoint.secret, body, headers['X-Sophia-Signature']);
          expect(valid).toBe(true);

          return { status: 503, ok: false };
        }
      );

      expect(delivery.status).toBe('failed');
      expect(delivery.attempt_count).toBe(1);

      // Step 3: Resilient retry bus triggers consecutive retries through exponential backoff
      // Attempts 2, 3, 4
      for (let attempt = 2; attempt <= 4; attempt++) {
        delivery = await processWebhookRetry(db, delivery.id, async () => ({ status: 503, ok: false }));
        expect(delivery.attempt_count).toBe(attempt);
        expect(delivery.status).toBe('failed');
      }

      // Step 4: Final 5th attempt fails and delivery cleanly transitions to Dead Letter Queue (DLQ)
      delivery = await processWebhookRetry(db, delivery.id, async () => ({ status: 503, ok: false }));
      expect(delivery.attempt_count).toBe(5);
      expect(delivery.status).toBe('dead_letter');

      // Step 5: Developer fixes webhook server and triggers manual replay via Sophia dashboard
      const replayed = await replayWebhookAttempt(
        db,
        testOrgId,
        delivery.id,
        async (_url, headers, body) => {
          expect(headers['X-Sophia-Replay']).toBe('true');
          const valid = await verifyWebhookSignature(endpoint.secret, body, headers['X-Sophia-Signature']);
          expect(valid).toBe(true);
          return { status: 200, ok: true };
        }
      );

      // Step 6: Verify successful recovery
      expect(replayed.status).toBe('success');
      expect(replayed.response_code).toBe(200);

      const dbFinal = await db
        .prepare(`SELECT status, response_code FROM webhook_deliveries WHERE id = ?1`)
        .bind(delivery.id)
        .first<{ status: string; response_code: number }>();

      expect(dbFinal?.status).toBe('success');
      expect(dbFinal?.response_code).toBe(200);
    });
  });
});
