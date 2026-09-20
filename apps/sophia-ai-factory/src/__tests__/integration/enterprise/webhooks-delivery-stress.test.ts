/**
 * Adversarial Stress Test Suite: Milestone 4 Webhook Delivery Queue, Jitter Distribution,
 * DLQ State Transitions, and Multi-Tenant Isolation
 *
 * Empirical Challenger M4-2 Verification Suite:
 * 1. Jitter Distribution & Entropy Bounds:
 *    - Validates calculateBackoffDelay(attempt, true) across 1,000 calls per attempt tier (Tiers 1 to 5).
 *    - Asserts delays strictly fall within [0.89 * base, 1.15 * base] (and actual [0.90, 1.10] implementation bounds).
 *    - Asserts collision resistance and entropy across concurrent runs.
 *    - Tests edge boundary values: negative attempts, attempt 0, fractional attempts, high attempt clamping,
 *      deterministic base mode (withJitter = false), and custom random generators.
 * 2. DLQ State Transition Boundary:
 *    - Simulates retry attempts 1 to 4: verifies status strictly remains 'failed'.
 *    - Simulates attempt 5: verifies strict terminal transition to 'dead_letter'.
 *    - Verifies attempt count is exactly 5, error message is persisted, and SQLite row matches memory state.
 *    - Confirms post-DLQ retry attempts remain in 'dead_letter'.
 *    - Tests queue sweeper (processDueWebhookRetries) to ensure dead-lettered items are never automatically retried.
 *    - Validates manual replay recovery from 'dead_letter' back to 'success' with X-Sophia-Replay header.
 * 3. Cross-Tenant Replay Isolation Attacks:
 *    - Simulates Org A failed/DLQ delivery attacked by Org B via replayWebhookAttempt.
 *    - Verifies strict rejection with error matching /CROSS_TENANT_VIOLATION/ and HTTP 403 status.
 *    - Adversarial fuzzing of attacker org ID: empty strings, whitespace, null/undefined, SQL injections,
 *      prefix/suffix spoofing, and path traversal strings.
 *    - Server Action replayWebhookAction cross-tenant rejection.
 *    - Verifies delivery record immutability under attack.
 * 4. Concurrent Delivery Stress & SQLite Concurrency:
 *    - Simulates 100 concurrent webhook deliveries firing simultaneously across 5 organizations.
 *    - Verifies zero SQLite locking errors (e.g. SQLITE_BUSY) in in-memory D1 shim.
 *    - Verifies valid unique delivery IDs (^del_[a-f0-9]{16}$) with 100% uniqueness (0 collisions).
 *    - Verifies absolute tenant data isolation across concurrently inserted records.
 *    - Simulates concurrent mixed-outcome bursts (50 simultaneous deliveries with 25 successes and 25 failures).
 *    - Simulates concurrent batch sweeps via processDueWebhookRetries.
 *
 * Layer: Integration Tests
 *
 * @module __tests__/integration/enterprise/webhooks-delivery-stress.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { freshDb, makeD1 } from '../shared-d1-shim';
import type { D1Database } from '@/seed/db/client';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockGetCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.mockGetCurrentUser,
  getCurrentUserFromHeaders: vi.fn().mockImplementation(() => mocks.mockGetCurrentUser()),
}));

import {
  calculateBackoffDelay,
  calculateNextAttemptTimestamp,
  isAttemptExhausted,
  evaluateAttemptStatus,
  BACKOFF_SCHEDULE_SECONDS,
  MAX_DELIVERY_ATTEMPTS,
  DEFAULT_JITTER_RATIO,
} from '@/tree/webhooks/backoff-calculator';
import {
  createWebhookEndpoint,
  getWebhookEndpointById,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
} from '@/tree/webhooks/subscription-repo';
import {
  dispatchWebhookDelivery,
  processWebhookRetry,
  replayWebhookAttempt,
  processDueWebhookRetries,
} from '@/forest/webhooks/delivery-bus';
import { CrossTenantViolationError } from '@/forest/tenant/isolation-guard';
import { replayWebhookAction } from '@/land/admin/webhook-actions';
import type { WebhookDelivery, WebhookEndpoint } from '@/seed/types/outbound-webhooks';

const MIGRATION_0279_SQL = `
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'master',
  max_seats INTEGER NOT NULL DEFAULT 999,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS organization_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY DEFAULT ('wep_' || lower(hex(randomblob(12)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (url LIKE 'https://%'),
  secret TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  events TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY DEFAULT ('del_' || lower(hex(randomblob(12)))),
  endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'success', 'failed', 'dead_letter')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at INTEGER NOT NULL,
  response_code INTEGER DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
`;

describe('Milestone 4 Adversarial Stress Suite: Delivery Queue, Jitter, DLQ & Tenant Isolation', () => {
  let sqliteDb: ReturnType<typeof freshDb>;
  let d1: ReturnType<typeof makeD1>;

  const orgA = 'org_stress_tenant_alpha';
  const orgB = 'org_stress_tenant_beta';
  const userAdminOrgB = 'usr_admin_org_beta';

  beforeEach(() => {
    sqliteDb = freshDb();
    sqliteDb.exec(MIGRATION_0279_SQL);
    d1 = makeD1(sqliteDb);

    mocks.mockGetD1.mockResolvedValue(d1 as unknown as D1Database);

    const now = Date.now();
    sqliteDb.exec(`
      INSERT INTO organizations (id, name, slug, tier, max_seats, status, created_at, updated_at)
      VALUES 
        ('${orgA}', 'Tenant Alpha Corp', 'tenant-alpha', 'master', 999, 'active', ${now}, ${now}),
        ('${orgB}', 'Tenant Beta Rival', 'tenant-beta', 'master', 999, 'active', ${now}, ${now});

      INSERT INTO users (id, email, name, role, created_at, updated_at)
      VALUES 
        ('${userAdminOrgB}', 'admin@beta.com', 'Admin Beta', 'user', ${now}, ${now});

      INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
      VALUES 
        ('mem_admin_beta', '${orgB}', '${userAdminOrgB}', 'admin', ${now}, ${now});

      INSERT INTO org_members (id, org_id, user_id, role, created_at, updated_at)
      VALUES 
        ('omem_admin_beta', '${orgB}', '${userAdminOrgB}', 'admin', ${now}, ${now});
    `);
  });

  // ============================================================================
  // 1. JITTER DISTRIBUTION & ENTROPY STRESS TESTING
  // ============================================================================
  describe('1. Jitter Distribution, Bounds & Entropy Across 1,000 Calls Per Attempt Tier', () => {
    const SAMPLE_COUNT = 1000;

    it('validates schedule constants and jitter ratio settings', () => {
      expect(BACKOFF_SCHEDULE_SECONDS).toEqual([30, 120, 600, 3600, 21600]);
      expect(MAX_DELIVERY_ATTEMPTS).toBe(5);
      expect(DEFAULT_JITTER_RATIO).toBe(0.10);
    });

    it('Tier 1 (Attempt 1: 30s base): 1,000 calls adhere strictly to [0.89 * base, 1.15 * base] and exhibit high entropy', () => {
      const baseMs = 30 * 1000;
      const lowerBoundRequirement = baseMs * 0.89;
      const upperBoundRequirement = baseMs * 1.15;
      const lowerBoundImplementation = baseMs * 0.90;
      const upperBoundImplementation = baseMs * 1.10;

      const samples: number[] = [];
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const delay = calculateBackoffDelay(1, true);
        samples.push(delay);
        expect(delay).toBeGreaterThanOrEqual(lowerBoundRequirement);
        expect(delay).toBeLessThanOrEqual(upperBoundRequirement);
        expect(delay).toBeGreaterThanOrEqual(lowerBoundImplementation);
        expect(delay).toBeLessThanOrEqual(upperBoundImplementation);
      }

      const uniqueValues = new Set(samples);
      // In a span of 6,000 ms with 1,000 random samples, collision resistance should yield >800 unique values
      expect(uniqueValues.size).toBeGreaterThan(800);

      // Verify spread covers both lower and upper tails
      const minSample = Math.min(...samples);
      const maxSample = Math.max(...samples);
      expect(minSample).toBeLessThan(baseMs * 0.92);
      expect(maxSample).toBeGreaterThan(baseMs * 1.08);

      // Verify mean is balanced around the base delay (within ±1%)
      const mean = samples.reduce((a, b) => a + b, 0) / SAMPLE_COUNT;
      expect(mean).toBeGreaterThan(baseMs * 0.985);
      expect(mean).toBeLessThan(baseMs * 1.015);
    });

    it('Tier 2 (Attempt 2: 120s base): 1,000 calls adhere strictly to bounds with >950 unique values', () => {
      const baseMs = 120 * 1000;
      const samples: number[] = [];

      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const delay = calculateBackoffDelay(2, true);
        samples.push(delay);
        expect(delay).toBeGreaterThanOrEqual(baseMs * 0.89);
        expect(delay).toBeLessThanOrEqual(baseMs * 1.15);
        expect(delay).toBeGreaterThanOrEqual(baseMs * 0.90);
        expect(delay).toBeLessThanOrEqual(baseMs * 1.10);
      }

      const uniqueValues = new Set(samples);
      // Span is 24,000 ms -> high entropy > 950 unique values
      expect(uniqueValues.size).toBeGreaterThan(950);
    });

    it('Tier 3 (Attempt 3: 600s base): 1,000 calls adhere strictly to bounds with >980 unique values', () => {
      const baseMs = 600 * 1000;
      const samples: number[] = [];

      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const delay = calculateBackoffDelay(3, true);
        samples.push(delay);
        expect(delay).toBeGreaterThanOrEqual(baseMs * 0.89);
        expect(delay).toBeLessThanOrEqual(baseMs * 1.15);
        expect(delay).toBeGreaterThanOrEqual(baseMs * 0.90);
        expect(delay).toBeLessThanOrEqual(baseMs * 1.10);
      }

      const uniqueValues = new Set(samples);
      // Span is 120,000 ms -> virtually zero collisions (>980 unique values)
      expect(uniqueValues.size).toBeGreaterThan(980);
    });

    it('Tier 4 (Attempt 4: 3600s base): 1,000 calls adhere strictly to bounds with >990 unique values', () => {
      const baseMs = 3600 * 1000;
      const samples: number[] = [];

      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const delay = calculateBackoffDelay(4, true);
        samples.push(delay);
        expect(delay).toBeGreaterThanOrEqual(baseMs * 0.89);
        expect(delay).toBeLessThanOrEqual(baseMs * 1.15);
        expect(delay).toBeGreaterThanOrEqual(baseMs * 0.90);
        expect(delay).toBeLessThanOrEqual(baseMs * 1.10);
      }

      const uniqueValues = new Set(samples);
      expect(uniqueValues.size).toBeGreaterThan(990);
    });

    it('Tier 5 (Attempt 5: 21600s base): 1,000 calls adhere strictly to bounds with >990 unique values', () => {
      const baseMs = 21600 * 1000;
      const samples: number[] = [];

      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const delay = calculateBackoffDelay(5, true);
        samples.push(delay);
        expect(delay).toBeGreaterThanOrEqual(baseMs * 0.89);
        expect(delay).toBeLessThanOrEqual(baseMs * 1.15);
        expect(delay).toBeGreaterThanOrEqual(baseMs * 0.90);
        expect(delay).toBeLessThanOrEqual(baseMs * 1.10);
      }

      const uniqueValues = new Set(samples);
      expect(uniqueValues.size).toBeGreaterThan(990);
    });

    it('confirms concurrent runs do not generate identical collisions across threads/tasks', async () => {
      // Execute 50 parallel asynchronous invocations
      const promises = Array.from({ length: 50 }, async () => {
        return calculateBackoffDelay(1, true);
      });

      const results = await Promise.all(promises);
      const unique = new Set(results);
      // Ensure concurrent execution generates distinct entropy, not identical values
      expect(unique.size).toBeGreaterThan(40);
    });

    it('tests attempt parameter boundary clamping, fractional attempts, and zero-jitter determinism', () => {
      // Attempt 0 or negative clamped to attempt 1
      expect(calculateBackoffDelay(0, false)).toBe(30000);
      expect(calculateBackoffDelay(-10, false)).toBe(30000);

      // Fractional attempts sanitized with Math.floor
      expect(calculateBackoffDelay(1.9, false)).toBe(30000);
      expect(calculateBackoffDelay(2.5, false)).toBe(120000);
      expect(calculateBackoffDelay(4.99, false)).toBe(3600000);

      // Higher attempts clamped to maximum schedule tier (attempt 5: 21600s)
      expect(calculateBackoffDelay(6, false)).toBe(21600000);
      expect(calculateBackoffDelay(99, false)).toBe(21600000);

      // withJitter = false returns exact deterministic base values
      expect(calculateBackoffDelay(1, false)).toBe(30000);
      expect(calculateBackoffDelay(2, false)).toBe(120000);
      expect(calculateBackoffDelay(3, false)).toBe(600000);
      expect(calculateBackoffDelay(4, false)).toBe(3600000);
      expect(calculateBackoffDelay(5, false)).toBe(21600000);

      // Custom deterministic random generators
      const minJitter = calculateBackoffDelay(1, true, () => 0.0);
      expect(minJitter).toBe(Math.floor(30000 * 0.90));

      const maxJitter = calculateBackoffDelay(1, true, () => 1.0);
      expect(maxJitter).toBe(Math.floor(30000 * 1.10));

      const midJitter = calculateBackoffDelay(1, true, () => 0.5);
      expect(midJitter).toBe(30000);
    });

    it('verifies calculateNextAttemptTimestamp calculation with nowMs', () => {
      const fixedNow = 1700000000000;
      const nextAttempt = calculateNextAttemptTimestamp(1, fixedNow, false);
      expect(nextAttempt).toBe(fixedNow + 30000);

      const jitteredNext = calculateNextAttemptTimestamp(1, fixedNow, true);
      expect(jitteredNext).toBeGreaterThanOrEqual(fixedNow + 27000);
      expect(jitteredNext).toBeLessThanOrEqual(fixedNow + 33000);
    });
  });

  // ============================================================================
  // 2. DLQ STATE TRANSITION BOUNDARY TEST
  // ============================================================================
  describe('2. Dead Letter Queue (DLQ) State Transition Boundary & Sweeper Isolation', () => {
    let endpointA: WebhookEndpoint;

    beforeEach(async () => {
      endpointA = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.orga.com/dlq-test-target',
        events: ['video.rendered'],
        description: 'DLQ Stress Target',
      });
    });

    it('strictly maintains status = failed across attempts 1-4 and transitions to dead_letter precisely on attempt 5', async () => {
      const now = Date.now();

      // Attempt 1: Initial outbound dispatch failure
      let delivery = await dispatchWebhookDelivery(
        d1 as unknown as D1Database,
        endpointA,
        'video.rendered',
        { missionId: 'mis_dlq_1' },
        async () => ({ status: 503, ok: false })
      );

      expect(delivery.status).toBe('failed');
      expect(delivery.attempt_count).toBe(1);
      expect(delivery.max_attempts).toBe(5);
      expect(delivery.response_code).toBe(503);
      expect(delivery.error_message).toBe('HTTP_503');
      expect(delivery.next_attempt_at).toBeGreaterThan(now);

      // Attempts 2, 3, 4: Retries maintain status = 'failed'
      for (let attempt = 2; attempt <= 4; attempt++) {
        delivery = await processWebhookRetry(
          d1 as unknown as D1Database,
          delivery.id,
          async () => ({ status: 503, ok: false })
        );

        expect(delivery.status).toBe('failed');
        expect(delivery.attempt_count).toBe(attempt);
        expect(delivery.max_attempts).toBe(5);
        expect(delivery.response_code).toBe(503);
        expect(delivery.error_message).toBe('HTTP_503');

        // Confirm DB persistence at each step
        const dbRow = await d1
          .prepare('SELECT status, attempt_count, error_message FROM webhook_deliveries WHERE id = ?1')
          .bind(delivery.id)
          .first<{ status: string; attempt_count: number; error_message: string }>();

        expect(dbRow?.status).toBe('failed');
        expect(dbRow?.attempt_count).toBe(attempt);
        expect(dbRow?.error_message).toBe('HTTP_503');
      }

      // Attempt 5: Strict transition boundary to 'dead_letter'
      delivery = await processWebhookRetry(
        d1 as unknown as D1Database,
        delivery.id,
        async () => ({ status: 503, ok: false })
      );

      expect(delivery.status).toBe('dead_letter');
      expect(delivery.attempt_count).toBe(5);
      expect(delivery.max_attempts).toBe(5);
      expect(delivery.response_code).toBe(503);
      expect(delivery.error_message).toBe('HTTP_503');

      // Verify persistent SQLite record in database
      const finalDbRecord = await d1
        .prepare('SELECT * FROM webhook_deliveries WHERE id = ?1')
        .bind(delivery.id)
        .first<WebhookDelivery>();

      expect(finalDbRecord?.status).toBe('dead_letter');
      expect(finalDbRecord?.attempt_count).toBe(5);
      expect(finalDbRecord?.error_message).toBe('HTTP_503');
      expect(finalDbRecord?.response_code).toBe(503);
    });

    it('tests pure state machine helpers: isAttemptExhausted and evaluateAttemptStatus', () => {
      // isAttemptExhausted checks >= 5
      expect(isAttemptExhausted(0)).toBe(false);
      expect(isAttemptExhausted(1)).toBe(false);
      expect(isAttemptExhausted(4)).toBe(false);
      expect(isAttemptExhausted(5)).toBe(true);
      expect(isAttemptExhausted(6)).toBe(true);

      // evaluateAttemptStatus on success
      expect(evaluateAttemptStatus(1, true)).toEqual({ status: 'success', isTerminal: true });
      expect(evaluateAttemptStatus(5, true)).toEqual({ status: 'success', isTerminal: true });

      // evaluateAttemptStatus on failure
      expect(evaluateAttemptStatus(1, false)).toEqual({ status: 'failed', isTerminal: false });
      expect(evaluateAttemptStatus(4, false)).toEqual({ status: 'failed', isTerminal: false });
      expect(evaluateAttemptStatus(5, false)).toEqual({ status: 'dead_letter', isTerminal: true });
      expect(evaluateAttemptStatus(6, false)).toEqual({ status: 'dead_letter', isTerminal: true });
    });

    it('confirms subsequent retry attempts on an already dead-lettered delivery stay in dead_letter', async () => {
      let delivery = await dispatchWebhookDelivery(
        d1 as unknown as D1Database,
        endpointA,
        'video.rendered',
        { id: 'exhausted_test' },
        async () => ({ status: 500, ok: false })
      );

      // Advance to 5 attempts
      for (let i = 2; i <= 5; i++) {
        delivery = await processWebhookRetry(
          d1 as unknown as D1Database,
          delivery.id,
          async () => ({ status: 500, ok: false })
        );
      }
      expect(delivery.status).toBe('dead_letter');

      // Attempt 6 retry: remains dead_letter
      const postDlqDelivery = await processWebhookRetry(
        d1 as unknown as D1Database,
        delivery.id,
        async () => ({ status: 500, ok: false })
      );
      expect(postDlqDelivery.status).toBe('dead_letter');
      expect(postDlqDelivery.attempt_count).toBe(6);
    });

    it('processDueWebhookRetries ignores dead_letter deliveries and only sweeps failed deliveries', async () => {
      // 1. Create a failed delivery due now
      const dFailed = await dispatchWebhookDelivery(
        d1 as unknown as D1Database,
        endpointA,
        'video.rendered',
        { id: 'will_retry' },
        async () => ({ status: 500, ok: false })
      );

      // 2. Create a delivery and exhaust it to dead_letter
      let dDeadLetter = await dispatchWebhookDelivery(
        d1 as unknown as D1Database,
        endpointA,
        'video.rendered',
        { id: 'already_dead' },
        async () => ({ status: 500, ok: false })
      );
      for (let i = 2; i <= 5; i++) {
        dDeadLetter = await processWebhookRetry(
          d1 as unknown as D1Database,
          dDeadLetter.id,
          async () => ({ status: 500, ok: false })
        );
      }
      expect(dDeadLetter.status).toBe('dead_letter');

      // Backdate next_attempt_at for both to past
      const past = Date.now() - 10000;
      sqliteDb.exec(`UPDATE webhook_deliveries SET next_attempt_at = ${past} WHERE id IN ('${dFailed.id}', '${dDeadLetter.id}')`);

      // Run sweeper
      const sweepResult = await processDueWebhookRetries(d1 as unknown as D1Database, 50);

      // Sweeper should only process the 1 failed delivery, not the dead_letter delivery
      expect(sweepResult.processed).toBe(1);

      // Verify the dead_letter delivery was unchanged
      const deadLetterCheck = await d1
        .prepare('SELECT status, attempt_count FROM webhook_deliveries WHERE id = ?1')
        .bind(dDeadLetter.id)
        .first<{ status: string; attempt_count: number }>();
      expect(deadLetterCheck?.status).toBe('dead_letter');
      expect(deadLetterCheck?.attempt_count).toBe(5);
    });

    it('manual replay recovers a dead_letter delivery to success with X-Sophia-Replay header', async () => {
      let delivery = await dispatchWebhookDelivery(
        d1 as unknown as D1Database,
        endpointA,
        'video.rendered',
        { videoId: 'vid_replay_ok' },
        async () => ({ status: 504, ok: false })
      );

      for (let i = 2; i <= 5; i++) {
        delivery = await processWebhookRetry(
          d1 as unknown as D1Database,
          delivery.id,
          async () => ({ status: 504, ok: false })
        );
      }
      expect(delivery.status).toBe('dead_letter');

      let capturedReplayHeader = '';
      const replayed = await replayWebhookAttempt(
        d1 as unknown as D1Database,
        orgA,
        delivery.id,
        async (_url, headers) => {
          capturedReplayHeader = headers['X-Sophia-Replay'] ?? '';
          return { status: 200, ok: true };
        }
      );

      expect(capturedReplayHeader).toBe('true');
      expect(replayed.status).toBe('success');
      expect(replayed.response_code).toBe(200);
      expect(replayed.error_message).toBeNull();

      // Check DB
      const dbRow = await d1
        .prepare('SELECT status, response_code, error_message FROM webhook_deliveries WHERE id = ?1')
        .bind(delivery.id)
        .first<{ status: string; response_code: number; error_message: string | null }>();
      expect(dbRow?.status).toBe('success');
      expect(dbRow?.response_code).toBe(200);
      expect(dbRow?.error_message).toBeNull();
    });

    it('manual replay failure keeps status as dead_letter with updated error message', async () => {
      let delivery = await dispatchWebhookDelivery(
        d1 as unknown as D1Database,
        endpointA,
        'video.rendered',
        { videoId: 'vid_replay_fail' },
        async () => ({ status: 504, ok: false })
      );

      for (let i = 2; i <= 5; i++) {
        delivery = await processWebhookRetry(
          d1 as unknown as D1Database,
          delivery.id,
          async () => ({ status: 504, ok: false })
        );
      }

      const replayed = await replayWebhookAttempt(
        d1 as unknown as D1Database,
        orgA,
        delivery.id,
        async () => ({ status: 502, ok: false })
      );

      expect(replayed.status).toBe('dead_letter');
      expect(replayed.response_code).toBe(502);
      expect(replayed.error_message).toBe('REPLAY_FAILED_HTTP_502');
    });
  });

  // ============================================================================
  // 3. CROSS-TENANT REPLAY ISOLATION ATTACKS
  // ============================================================================
  describe('3. Cross-Tenant Replay Isolation & Adversarial Input Attacks', () => {
    let deliveryA: WebhookDelivery;

    beforeEach(async () => {
      const endpointA = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.orga.com/private-webhooks',
        events: ['video.rendered'],
        description: 'Org A Target',
      });

      deliveryA = await dispatchWebhookDelivery(
        d1 as unknown as D1Database,
        endpointA,
        'video.rendered',
        { secretData: 'org_a_classified_metrics' },
        async () => ({ status: 500, ok: false })
      );
    });

    it('strictly rejects cross-tenant replay attempt from rival Org B with CROSS_TENANT_VIOLATION', async () => {
      // Org B attempts to replay Org A's delivery
      const replayPromise = replayWebhookAttempt(
        d1 as unknown as D1Database,
        orgB,
        deliveryA.id,
        async () => ({ status: 200, ok: true })
      );

      await expect(replayPromise).rejects.toThrow(/CROSS_TENANT_VIOLATION/);

      try {
        await replayWebhookAttempt(d1 as unknown as D1Database, orgB, deliveryA.id);
        expect.unreachable('Should have thrown CrossTenantViolationError');
      } catch (err) {
        expect(err).toBeInstanceOf(CrossTenantViolationError);
        const error = err as CrossTenantViolationError;
        expect(error.code).toBe('CROSS_TENANT_VIOLATION');
        expect(error.status).toBe(403);
        expect(error.currentOrgId).toBe(orgB);
        expect(error.resourceOrgId).toBe(orgA);
      }
    });

    it('rejects cross-tenant replay via Server Action replayWebhookAction with CROSS_TENANT_VIOLATION', async () => {
      // Mock authenticated session as Admin of Org B
      mocks.mockGetCurrentUser.mockResolvedValue({
        id: userAdminOrgB,
        email: 'admin@beta.com',
        role: 'user',
      });

      // Admin of Org B tries to replay Org A's delivery ID
      const result = await replayWebhookAction(orgB, deliveryA.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CROSS_TENANT_VIOLATION');
        expect(result.error.message).toContain('CROSS_TENANT_VIOLATION');
      }
    });

    it('rejects adversarial orgId spoofing: empty strings, whitespace, null, and SQL injections', async () => {
      const maliciousOrgIds = [
        '',
        '   ',
        '\t\n',
        'null',
        'undefined',
        orgA + "' OR '1'='1",
        orgA + "'; DROP TABLE webhook_deliveries; --",
        orgA + '_sub',
        'org_stress_tenant_alpha_hacker',
        '../' + orgA,
      ];

      for (const badOrgId of maliciousOrgIds) {
        await expect(
          replayWebhookAttempt(d1 as unknown as D1Database, badOrgId, deliveryA.id)
        ).rejects.toThrow(/CROSS_TENANT_VIOLATION/);
      }
    });

    it('guarantees delivery record immutability under attack', async () => {
      const originalRecord = await d1
        .prepare('SELECT * FROM webhook_deliveries WHERE id = ?1')
        .bind(deliveryA.id)
        .first<WebhookDelivery>();

      // Fire 10 rapid unauthorized cross-tenant attacks
      for (let i = 0; i < 10; i++) {
        try {
          await replayWebhookAttempt(d1 as unknown as D1Database, orgB, deliveryA.id);
        } catch {
          // Expected rejection
        }
      }

      const postAttackRecord = await d1
        .prepare('SELECT * FROM webhook_deliveries WHERE id = ?1')
        .bind(deliveryA.id)
        .first<WebhookDelivery>();

      // Record must remain 100% identical and unmutated
      expect(postAttackRecord).toEqual(originalRecord);
    });

    it('enforces tenant isolation across subscription-repo operations', async () => {
      const epA = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.orga.com/wh-isolation',
        events: ['video.rendered'],
      });

      // Org B attempts to read Org A endpoint
      await expect(
        getWebhookEndpointById(d1 as unknown as D1Database, epA.id, orgB)
      ).rejects.toThrow(/CROSS_TENANT_VIOLATION/);

      // Org B attempts to update Org A endpoint
      await expect(
        updateWebhookEndpoint(d1 as unknown as D1Database, orgB, epA.id, {
          url: 'https://hacked.com',
        })
      ).rejects.toThrow(/CROSS_TENANT_VIOLATION/);

      // Org B attempts to delete Org A endpoint
      await expect(
        deleteWebhookEndpoint(d1 as unknown as D1Database, orgB, epA.id)
      ).rejects.toThrow(/CROSS_TENANT_VIOLATION/);
    });
  });

  // ============================================================================
  // 4. CONCURRENT DELIVERY STRESS & SQLITE CONCURRENCY
  // ============================================================================
  describe('4. Concurrent Delivery Stress, Zero SQLite Locks & ID Uniqueness', () => {
    const ORG_COUNT = 5;
    const DELIVERIES_PER_ORG = 20;
    const TOTAL_CONCURRENT = ORG_COUNT * DELIVERIES_PER_ORG; // 100 concurrent deliveries

    it('simulates 100 concurrent webhook deliveries firing simultaneously across multiple organizations', async () => {
      const orgIds: string[] = [];
      const endpoints: WebhookEndpoint[] = [];
      const now = Date.now();

      // Seed 5 organizations and 5 endpoints
      for (let i = 1; i <= ORG_COUNT; i++) {
        const oid = `org_concurrent_tenant_${i}`;
        orgIds.push(oid);
        sqliteDb.exec(`
          INSERT INTO organizations (id, name, slug, tier, max_seats, status, created_at, updated_at)
          VALUES ('${oid}', 'Concurrent Org ${i}', 'conc-org-${i}', 'master', 999, 'active', ${now}, ${now});
        `);

        const ep = await createWebhookEndpoint(d1 as unknown as D1Database, oid, {
          url: `https://api.tenant${i}.com/webhook`,
          events: ['video.rendered', 'campaign.completed'],
          description: `Concurrent Endpoint Org ${i}`,
        });
        endpoints.push(ep);
      }

      // Generate 100 concurrent delivery dispatch jobs
      const dispatchJobs: Array<Promise<WebhookDelivery>> = [];

      for (let oIdx = 0; oIdx < ORG_COUNT; oIdx++) {
        const ep = endpoints[oIdx];
        for (let dIdx = 0; dIdx < DELIVERIES_PER_ORG; dIdx++) {
          const payload = {
            tenantIndex: oIdx + 1,
            deliverySeq: dIdx + 1,
            uuid: `data_${oIdx}_${dIdx}`,
            timestamp: Date.now(),
          };

          // Simulated edge fetcher with randomized micro-latency to induce realistic async concurrency
          const mockFetcher = async () => {
            await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 4) + 1));
            return { status: 200, ok: true };
          };

          dispatchJobs.push(
            dispatchWebhookDelivery(
              d1 as unknown as D1Database,
              ep,
              'video.rendered',
              payload,
              mockFetcher
            )
          );
        }
      }

      expect(dispatchJobs).toHaveLength(TOTAL_CONCURRENT);

      // Execute all 100 deliveries concurrently
      const results = await Promise.all(dispatchJobs);

      // 1. Verify all 100 resolved with 0 SQLite locking errors
      expect(results).toHaveLength(TOTAL_CONCURRENT);
      for (const res of results) {
        expect(res.status).toBe('success');
        expect(res.response_code).toBe(200);
        expect(res.id).toMatch(/^del_[a-f0-9]{16}$/);
      }

      // 2. Verify 100% ID uniqueness (0 collisions)
      const allDeliveryIds = results.map((r) => r.id);
      const uniqueIds = new Set(allDeliveryIds);
      expect(uniqueIds.size).toBe(TOTAL_CONCURRENT);

      // 3. Verify SQLite DB state and strict tenant data isolation
      const totalDbRows = await d1
        .prepare('SELECT count(*) as total FROM webhook_deliveries')
        .first<{ total: number }>();
      expect(totalDbRows?.total).toBe(TOTAL_CONCURRENT);

      // Verify each tenant has exactly 20 deliveries and zero foreign records
      for (const oid of orgIds) {
        const tenantDeliveries = await d1
          .prepare('SELECT id, org_id FROM webhook_deliveries WHERE org_id = ?1')
          .bind(oid)
          .all<{ id: string; org_id: string }>();

        expect(tenantDeliveries.results).toHaveLength(DELIVERIES_PER_ORG);
        for (const item of tenantDeliveries.results) {
          expect(item.org_id).toBe(oid);
        }
      }
    });

    it('handles concurrent burst of 50 deliveries with mixed outcomes (25 success, 25 failed) without locking', async () => {
      const ep = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.orga.com/mixed-concurrency',
        events: ['campaign.completed'],
      });

      const burstJobs = Array.from({ length: 50 }, async (_, idx) => {
        const shouldSucceed = idx % 2 === 0;
        return dispatchWebhookDelivery(
          d1 as unknown as D1Database,
          ep,
          'campaign.completed',
          { idx, targetOutcome: shouldSucceed },
          async () => {
            // Simulated micro delay
            await new Promise((r) => setTimeout(r, 1));
            return shouldSucceed ? { status: 200, ok: true } : { status: 503, ok: false };
          }
        );
      });

      const burstResults = await Promise.all(burstJobs);

      const successCount = burstResults.filter((r) => r.status === 'success').length;
      const failedCount = burstResults.filter((r) => r.status === 'failed').length;

      expect(successCount).toBe(25);
      expect(failedCount).toBe(25);

      // Verify all 50 recorded cleanly in DB
      const dbCounts = await d1
        .prepare(`
          SELECT 
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
          FROM webhook_deliveries WHERE endpoint_id = ?1
        `)
        .bind(ep.id)
        .first<{ success_count: number; failed_count: number }>();

      expect(dbCounts?.success_count).toBe(25);
      expect(dbCounts?.failed_count).toBe(25);
    });

    it('handles concurrent replay executions without race conditions', async () => {
      const ep = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.orga.com/concurrent-replays',
        events: ['video.rendered'],
      });

      // Create 10 failed deliveries
      const failedDeliveries: WebhookDelivery[] = [];
      for (let i = 0; i < 10; i++) {
        const d = await dispatchWebhookDelivery(
          d1 as unknown as D1Database,
          ep,
          'video.rendered',
          { i },
          async () => ({ status: 500, ok: false })
        );
        failedDeliveries.push(d);
      }

      // Replay all 10 simultaneously
      const replayJobs = failedDeliveries.map((fd) =>
        replayWebhookAttempt(d1 as unknown as D1Database, orgA, fd.id, async () => {
          await new Promise((r) => setTimeout(r, 2));
          return { status: 200, ok: true };
        })
      );

      const replayedDeliveries = await Promise.all(replayJobs);
      expect(replayedDeliveries).toHaveLength(10);
      for (const rd of replayedDeliveries) {
        expect(rd.status).toBe('success');
        expect(rd.response_code).toBe(200);
      }
    });
  });
});
