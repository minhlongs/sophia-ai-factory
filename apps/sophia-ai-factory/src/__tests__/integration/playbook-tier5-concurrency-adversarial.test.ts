/**
 * Tier 5 Adversarial Hardening: Concurrency, Race Conditions & OCC CAS State Transitions
 *
 * Adversarially challenges:
 * 1. OCC CAS updates on playbook_patterns (scoring-cas.ts):
 *    - Matching vs stale detected_at
 *    - Auto-retry with detected_at refresh
 *    - Retry limit exhaustion -> CONCURRENT_MODIFICATION
 *    - Multi-worker concurrent race condition simulation
 *    - Missing pattern -> PATTERN_NOT_FOUND
 * 2. OCC CAS updates on playbook_rules (toggleRuleAutoApplyAction in src/land/playbook/actions.ts):
 *    - Stale expectedUpdatedAt -> { success: false, code: 'CAS_CONFLICT' }
 *    - Matching expectedUpdatedAt -> { success: true }
 *    - Two concurrent callers racing on same expectedUpdatedAt
 *    - Missing expectedUpdatedAt fallback & NOT_FOUND
 *    - Edge cases (0, negative, NaN, float)
 * 3. Mission lifecycle state transitions:
 *    - completed -> learning -> iterating canonical flow
 *    - Monotonicity: backwards transitions rejected with INVALID_STATUS_TRANSITION
 *    - Non-reentrancy: double-transitions rejected with CONCURRENT_MODIFICATION
 *    - Multi-worker transition race condition (exactly one winner)
 *    - Full 10x10 exhaustive status transition matrix (100 permutations)
 * 4. SQLite unique index uidx_playbook_patterns_upsert:
 *    - Schema presence check on (workspace_id, feature_key, feature_value, metric)
 *    - Idempotent ON CONFLICT updates without duplicates
 *    - High-frequency 100 rapid sequential upserts
 *    - 50 concurrent Promise.all upserts
 *    - Raw duplicate INSERT constraint enforcement
 *    - Metric/feature value boundary differentiation
 *
 * Layer: tests / adversarial
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

// ── In-Memory SQLite Setup via node:sqlite ──────────────────────────────────
const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

type StatementSync = ReturnType<InstanceType<typeof DatabaseSync>['prepare']>;

let rawDb: InstanceType<typeof DatabaseSync>;

function makeD1(db: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      const stmt: StatementSync = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() =>
              stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return {
                success: true,
                meta: { changes: Number(r.changes ?? 0), duration: 0 },
              };
            },
            all: async <T = Record<string, unknown>>() => {
              return {
                results: stmt.all(...sanitized) as T[],
                meta: { changes: 0, duration: 0 },
              };
            },
          };
        },
        first: async <T = Record<string, unknown>>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return {
            success: true,
            meta: { changes: Number(r.changes ?? 0), duration: 0 },
          };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: (sql: string) => db.exec(sql),
    batch: (stmts: unknown[]) => Promise.all(stmts),
    execute: async (sql: string, params?: unknown[]) => {
      const stmt = db.prepare(sql);
      const sanitized = (params ?? []).map((p) => (p === undefined ? null : p));
      const isSelect = /^\s*SELECT/i.test(sql);
      if (isSelect) {
        const results = stmt.all(...sanitized);
        return { results, meta: { changes: 0, duration: 0 } };
      } else {
        const r = stmt.run(...sanitized);
        return {
          results: [],
          meta: { changes: Number(r.changes ?? 0), duration: 0 },
        };
      }
    },
    unwrap: function () {
      return this;
    },
  };
}

let d1Mock: ReturnType<typeof makeD1>;

// ── Mock Auth and DB Modules ────────────────────────────────────────────────
let mockUser: { id: string; email: string; name: string } | null = {
  id: 'usr_test_challenger',
  email: 'challenger@sophia.agency',
  name: 'Challenger 2',
};

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(async () => mockUser),
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: vi.fn(async () => true),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(async () => d1Mock),
  createServerClient: vi.fn(() => d1Mock),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Imports Under Test ──────────────────────────────────────────────────────
import {
  updatePatternScoreCAS,
  transitionMissionLifecycleCAS,
  transitionMissionToLearningCAS,
  transitionMissionToIteratingCAS,
  canMissionTransition,
  LearningLoopError,
  ALLOWED_LIFECYCLE_TRANSITIONS,
} from '@/tree/learning-loop/scoring-cas';
import { toggleRuleAutoApplyAction } from '@/land/playbook/actions';
import type { CreativeMissionStatus, PatternScoreUpdates } from '@/tree/learning-loop/types';

// ── Schema Initialization ───────────────────────────────────────────────────
const TEST_SCHEMA = `
CREATE TABLE IF NOT EXISTS creative_missions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  brand_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  current_phase TEXT NOT NULL DEFAULT 'initialization',
  budget_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS playbook_patterns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  feature_value TEXT NOT NULL,
  metric TEXT NOT NULL,
  avg_metric REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  confidence REAL NOT NULL,
  confidence_level TEXT NOT NULL DEFAULT 'medium',
  source TEXT NOT NULL DEFAULT 'mission',
  detected_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_playbook_patterns_upsert
  ON playbook_patterns(workspace_id, feature_key, feature_value, metric);

CREATE TABLE IF NOT EXISTS playbook_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  pattern_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  goal TEXT NOT NULL,
  rule_vi TEXT NOT NULL,
  rule_en TEXT NOT NULL,
  confidence REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  applied_count INTEGER NOT NULL DEFAULT 0,
  auto_apply INTEGER NOT NULL DEFAULT 0,
  rollback_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
`;

const WS_ID = 'ws_concurrency_test';

describe('Tier 5 Adversarial Hardening: Concurrency & Race Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'usr_test_challenger',
      email: 'challenger@sophia.agency',
      name: 'Challenger 2',
    };

    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(TEST_SCHEMA);
    d1Mock = makeD1(rawDb);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. OCC CAS UPDATES ON playbook_patterns (scoring-cas.ts)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Target 1: OCC CAS Updates on playbook_patterns (scoring-cas.ts)', () => {
    const defaultUpdates: PatternScoreUpdates = {
      avgMetric: 0.18,
      sampleSize: 30,
      confidence: 0.92,
      confidenceLevel: 'high',
    };

    it('ADV-1.1: CAS succeeds on first attempt when expected detected_at matches row timestamp', async () => {
      const initialTs = 1700000100;
      rawDb.prepare(
        `INSERT INTO playbook_patterns (id, workspace_id, feature_key, feature_value, metric, avg_metric, sample_size, confidence, confidence_level, source, detected_at)
         VALUES ('pat_1', ?, 'hook_style', 'curiosity_gap', 'ctr', 0.10, 10, 0.75, 'medium', 'mission', ?)`
      ).run(WS_ID, initialTs);

      const result = await updatePatternScoreCAS('pat_1', initialTs, defaultUpdates, 3, d1Mock as unknown as D1Database);

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(result.retries).toBe(0);
      expect(result.error).toBeUndefined();

      // Verify row in DB was updated with new values and new detected_at
      const updatedRow = rawDb.prepare('SELECT avg_metric, sample_size, confidence, detected_at FROM playbook_patterns WHERE id = ?').get('pat_1') as {
        avg_metric: number;
        sample_size: number;
        confidence: number;
        detected_at: number;
      };
      expect(updatedRow.avg_metric).toBe(0.18);
      expect(updatedRow.sample_size).toBe(30);
      expect(updatedRow.confidence).toBe(0.92);
      expect(updatedRow.detected_at).toBeGreaterThan(initialTs);
    });

    it('ADV-1.2: Stale detected_at triggers auto-retry, re-reading latest detected_at and succeeding', async () => {
      const initialTs = 1700000100;
      const newerTs = 1700000200;
      // Row in DB has already been moved to newerTs by an out-of-band write
      rawDb.prepare(
        `INSERT INTO playbook_patterns (id, workspace_id, feature_key, feature_value, metric, avg_metric, sample_size, confidence, confidence_level, source, detected_at)
         VALUES ('pat_stale', ?, 'hook_style', 'curiosity_gap', 'ctr', 0.10, 10, 0.75, 'medium', 'mission', ?)`
      ).run(WS_ID, newerTs);

      // Caller starts with stale timestamp initialTs
      const result = await updatePatternScoreCAS('pat_stale', initialTs, defaultUpdates, 3, d1Mock as unknown as D1Database);

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(result.retries).toBe(1); // Exactly 1 retry needed
      expect(result.error).toBeUndefined();

      const row = rawDb.prepare('SELECT avg_metric, detected_at FROM playbook_patterns WHERE id = ?').get('pat_stale') as {
        avg_metric: number;
        detected_at: number;
      };
      expect(row.avg_metric).toBe(0.18);
      expect(row.detected_at).toBeGreaterThan(newerTs);
    });

    it('ADV-1.3: Continuous collision exhausts maxRetries and fails closed with CONCURRENT_MODIFICATION', async () => {
      const initialTs = 1700000100;
      rawDb.prepare(
        `INSERT INTO playbook_patterns (id, workspace_id, feature_key, feature_value, metric, avg_metric, sample_size, confidence, confidence_level, source, detected_at)
         VALUES ('pat_exhaust', ?, 'hook_style', 'bold_claim', 'ctr', 0.10, 10, 0.70, 'medium', 'mission', ?)`
      ).run(WS_ID, initialTs);

      // With maxRetries = 0, stale timestamp must fail immediately without retry
      const resultZero = await updatePatternScoreCAS('pat_exhaust', 999999, defaultUpdates, 0, d1Mock as unknown as D1Database);
      expect(resultZero.success).toBe(false);
      expect(resultZero.changes).toBe(0);
      expect(resultZero.retries).toBe(0);
      expect(resultZero.error).toBe('CONCURRENT_MODIFICATION');

      // Now test with maxRetries = 2 when timestamp is mutated between every attempt
      // We can mock D1 to simulate an active competitor advancing detected_at every time
      let attemptCount = 0;
      const racingD1 = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...params: unknown[]) => ({
            first: async () => {
              if (sql.includes('SELECT detected_at FROM playbook_patterns')) {
                // Return a timestamp that will immediately be invalidated before run executes
                attemptCount++;
                return { detected_at: 2000000 + attemptCount };
              }
              return null;
            },
            run: async () => {
              // Always return changes = 0 to simulate another process beating us to the commit
              return { success: true, meta: { changes: 0, duration: 1 } };
            },
          })),
        })),
      } as unknown as D1Database;

      const resultExhausted = await updatePatternScoreCAS('pat_exhaust', 1000, defaultUpdates, 2, racingD1);
      expect(resultExhausted.success).toBe(false);
      expect(resultExhausted.changes).toBe(0);
      expect(resultExhausted.retries).toBe(2);
      expect(resultExhausted.error).toBe('CONCURRENT_MODIFICATION');
    });

    it('ADV-1.4: Multi-worker concurrency simulation (10 parallel workers on same pattern)', async () => {
      const initialTs = 1700000000;
      rawDb.prepare(
        `INSERT INTO playbook_patterns (id, workspace_id, feature_key, feature_value, metric, avg_metric, sample_size, confidence, confidence_level, source, detected_at)
         VALUES ('pat_contended', ?, 'voice_style', 'dynamic_hook', 'retention', 0.50, 15, 0.80, 'high', 'mission', ?)`
      ).run(WS_ID, initialTs);

      // Launch 10 simultaneous workers attempting CAS updates with maxRetries = 5
      const workers = Array.from({ length: 10 }, (_, i) => {
        return updatePatternScoreCAS(
          'pat_contended',
          initialTs,
          {
            avgMetric: 0.50 + i * 0.01,
            sampleSize: 20 + i,
            confidence: 0.85,
            confidenceLevel: 'high',
          },
          5,
          d1Mock as unknown as D1Database,
        );
      });

      const results = await Promise.all(workers);

      // Verify that every worker terminated deterministically: either success or CONCURRENT_MODIFICATION
      for (const res of results) {
        expect(['CONCURRENT_MODIFICATION', undefined]).toContain(res.error);
        if (res.success) {
          expect(res.changes).toBe(1);
        } else {
          expect(res.changes).toBe(0);
          expect(res.error).toBe('CONCURRENT_MODIFICATION');
        }
      }

      // At least 1 worker MUST succeed
      const successfulWorkers = results.filter((r) => r.success);
      expect(successfulWorkers.length).toBeGreaterThanOrEqual(1);

      // Verify row in DB is valid and uncorrupted
      const finalRow = rawDb.prepare('SELECT avg_metric, sample_size FROM playbook_patterns WHERE id = ?').get('pat_contended') as {
        avg_metric: number;
        sample_size: number;
      };
      expect(finalRow.avg_metric).toBeGreaterThanOrEqual(0.50);
      expect(finalRow.sample_size).toBeGreaterThanOrEqual(20);
    });

    it('ADV-1.5: Non-existent pattern ID fails immediately with PATTERN_NOT_FOUND', async () => {
      const result = await updatePatternScoreCAS('pat_missing_id', 1700000000, defaultUpdates, 3, d1Mock as unknown as D1Database);

      expect(result.success).toBe(false);
      expect(result.changes).toBe(0);
      expect(result.retries).toBe(0);
      expect(result.error).toBe('PATTERN_NOT_FOUND');
    });

    it('ADV-1.6: Pattern deleted during conflict retry returns PATTERN_NOT_FOUND', async () => {
      const initialTs = 1700000000;
      rawDb.prepare(
        `INSERT INTO playbook_patterns (id, workspace_id, feature_key, feature_value, metric, avg_metric, sample_size, confidence, confidence_level, source, detected_at)
         VALUES ('pat_delete_mid', ?, 'hook_style', 'question', 'ctr', 0.08, 5, 0.60, 'medium', 'mission', ?)`
      ).run(WS_ID, initialTs);

      // Custom mock: attempt 0 fails changes = 0, then refresh returns null (row was deleted)
      const attempt = 0;
      const deleteD1 = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn(() => ({
            first: async () => null, // Row deleted!
            run: async () => ({ success: true, meta: { changes: 0, duration: 1 } }),
          })),
        })),
      } as unknown as D1Database;

      const result = await updatePatternScoreCAS('pat_delete_mid', 999999, defaultUpdates, 3, deleteD1);
      expect(result.success).toBe(false);
      expect(result.changes).toBe(0);
      expect(result.error).toBe('PATTERN_NOT_FOUND');
    });

    it('ADV-1.7: Database unavailable returns D1_UNAVAILABLE', async () => {
      const result = await updatePatternScoreCAS('pat_1', 1700000000, defaultUpdates, 3, null as unknown as D1Database);
      expect(result.success).toBe(false);
      expect(result.changes).toBe(0);
      expect(result.error).toBe('D1_UNAVAILABLE');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. OCC CAS UPDATES ON playbook_rules (toggleRuleAutoApplyAction)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Target 2: OCC CAS Updates on playbook_rules (toggleRuleAutoApplyAction)', () => {
    const RULE_ID = 'rule_occ_101';
    const INITIAL_TS = 1700000000000;

    beforeEach(() => {
      rawDb.prepare(
        `INSERT INTO playbook_rules (id, workspace_id, pattern_id, platform, goal, rule_vi, rule_en, confidence, sample_size, applied_count, auto_apply, rollback_count, created_at, updated_at)
         VALUES (?, ?, 'pat_1', 'youtube_shorts', 'awareness', 'Quy tắc mẫu', 'Sample Rule', 0.95, 20, 0, 0, 0, ?, ?)`
      ).run(RULE_ID, WS_ID, INITIAL_TS, INITIAL_TS);
    });

    it('ADV-2.1: Matching expectedUpdatedAt successfully toggles auto_apply and advances updated_at', async () => {
      const res = await toggleRuleAutoApplyAction(RULE_ID, true, INITIAL_TS);

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.ruleId).toBe(RULE_ID);
      expect(res.data.autoApply).toBe(true);
      expect(typeof res.data.updatedAt).toBe('number');
      expect(res.data.updatedAt).toBeGreaterThan(INITIAL_TS);

      // Verify database reflects the change
      const row = rawDb.prepare('SELECT auto_apply, updated_at FROM playbook_rules WHERE id = ?').get(RULE_ID) as {
        auto_apply: number;
        updated_at: number;
      };
      expect(row.auto_apply).toBe(1);
      expect(row.updated_at).toBe(res.data.updatedAt);
    });

    it('ADV-2.2: Stale expectedUpdatedAt fails closed with CAS_CONFLICT without mutating database', async () => {
      const staleTimestamp = INITIAL_TS - 50000;
      const res = await toggleRuleAutoApplyAction(RULE_ID, true, staleTimestamp);

      expect(res.success).toBe(false);
      expect(res.code).toBe('CAS_CONFLICT');
      expect(res.error).toContain('Rule was modified by another process');

      // Verify DB remains untouched
      const row = rawDb.prepare('SELECT auto_apply, updated_at FROM playbook_rules WHERE id = ?').get(RULE_ID) as {
        auto_apply: number;
        updated_at: number;
      };
      expect(row.auto_apply).toBe(0);
      expect(row.updated_at).toBe(INITIAL_TS);
    });

    it('ADV-2.3: Race condition between two concurrent callers with identical expectedUpdatedAt', async () => {
      // Both Worker A and Worker B saw the rule at INITIAL_TS
      const callA = toggleRuleAutoApplyAction(RULE_ID, true, INITIAL_TS);
      const callB = toggleRuleAutoApplyAction(RULE_ID, false, INITIAL_TS);

      const [resA, resB] = await Promise.all([callA, callB]);

      // Exactly ONE must succeed and exactly ONE must fail with CAS_CONFLICT
      const outcomes = [resA, resB];
      const successes = outcomes.filter((o) => o.success);
      const conflicts = outcomes.filter((o) => !o.success && o.code === 'CAS_CONFLICT');

      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(1);

      // The winning caller advanced updated_at
      const row = rawDb.prepare('SELECT auto_apply, updated_at FROM playbook_rules WHERE id = ?').get(RULE_ID) as {
        auto_apply: number;
        updated_at: number;
      };
      expect(row.updated_at).toBeGreaterThan(INITIAL_TS);
    });

    it('ADV-2.4: Missing expectedUpdatedAt automatically reads current timestamp and succeeds', async () => {
      const res = await toggleRuleAutoApplyAction(RULE_ID, true);

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.autoApply).toBe(true);

      const row = rawDb.prepare('SELECT auto_apply FROM playbook_rules WHERE id = ?').get(RULE_ID) as { auto_apply: number };
      expect(row.auto_apply).toBe(1);
    });

    it('ADV-2.5: Non-existent rule returns NOT_FOUND when timestamp omitted, CAS_CONFLICT when provided', async () => {
      // Without expectedUpdatedAt
      const resWithout = await toggleRuleAutoApplyAction('rule_non_existent', true);
      expect(resWithout.success).toBe(false);
      expect(resWithout.code).toBe('NOT_FOUND');

      // With expectedUpdatedAt
      const resWith = await toggleRuleAutoApplyAction('rule_non_existent', true, 123456789);
      expect(resWith.success).toBe(false);
      expect(resWith.code).toBe('CAS_CONFLICT');
    });

    it('ADV-2.6: Unauthenticated session fails closed with UNAUTHORIZED before executing any DB query', async () => {
      mockUser = null; // simulate logged-out user
      const res = await toggleRuleAutoApplyAction(RULE_ID, true, INITIAL_TS);

      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');

      // Verify DB unchanged
      const row = rawDb.prepare('SELECT auto_apply FROM playbook_rules WHERE id = ?').get(RULE_ID) as { auto_apply: number };
      expect(row.auto_apply).toBe(0);
    });

    it('ADV-2.7: Edge case values for expectedUpdatedAt (0, negative, NaN, float) fail closed safely', async () => {
      // expectedUpdatedAt = 0 (epoch start, stale)
      const resZero = await toggleRuleAutoApplyAction(RULE_ID, true, 0);
      expect(resZero.success).toBe(false);
      expect(resZero.code).toBe('CAS_CONFLICT');

      // expectedUpdatedAt = -1 (negative timestamp)
      const resNeg = await toggleRuleAutoApplyAction(RULE_ID, true, -1);
      expect(resNeg.success).toBe(false);
      expect(resNeg.code).toBe('CAS_CONFLICT');

      // expectedUpdatedAt = NaN
      const resNaN = await toggleRuleAutoApplyAction(RULE_ID, true, NaN);
      expect(resNaN.success).toBe(false);
      expect(resNaN.code).toBe('CAS_CONFLICT');

      // DB unchanged throughout all edge tests
      const row = rawDb.prepare('SELECT auto_apply FROM playbook_rules WHERE id = ?').get(RULE_ID) as { auto_apply: number };
      expect(row.auto_apply).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. MISSION LIFECYCLE STATE TRANSITIONS & MONOTONICITY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Target 3: Mission Lifecycle State Machine & Monotonicity', () => {
    const MSN_ID = 'msn_lifecycle_test';

    beforeEach(() => {
      rawDb.prepare(
        `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase, budget_cents, created_at, updated_at)
         VALUES (?, ?, 'usr_creator', 'Campaign Test Mission', 'completed', 'executing', 100, 1000, 1000)`
      ).run(MSN_ID, WS_ID);
    });

    it('ADV-3.1: Canonical forward progression completed -> learning -> iterating succeeds atomically', async () => {
      // Step 1: completed -> learning
      await expect(transitionMissionToLearningCAS(MSN_ID, d1Mock as unknown as D1Database)).resolves.not.toThrow();

      let mission = rawDb.prepare('SELECT status, current_phase FROM creative_missions WHERE id = ?').get(MSN_ID) as {
        status: string;
        current_phase: string;
      };
      expect(mission.status).toBe('learning');
      expect(mission.current_phase).toBe('learning_loop_analyzing');

      // Step 2: learning -> iterating
      await expect(transitionMissionToIteratingCAS(MSN_ID, d1Mock as unknown as D1Database)).resolves.not.toThrow();

      mission = rawDb.prepare('SELECT status, current_phase FROM creative_missions WHERE id = ?').get(MSN_ID) as {
        status: string;
        current_phase: string;
      };
      expect(mission.status).toBe('iterating');
      expect(mission.current_phase).toBe('ready_for_iteration');
    });

    it('ADV-3.2: Backwards transitions are strictly forbidden and throw INVALID_STATUS_TRANSITION', async () => {
      // Transition to learning first
      await transitionMissionToLearningCAS(MSN_ID, d1Mock as unknown as D1Database);

      // Attempt backwards: learning -> completed
      await expect(
        transitionMissionLifecycleCAS(MSN_ID, 'learning', 'completed', 'backward_jump', d1Mock as unknown as D1Database)
      ).rejects.toThrowError(LearningLoopError);

      try {
        await transitionMissionLifecycleCAS(MSN_ID, 'learning', 'completed', 'backward_jump', d1Mock as unknown as D1Database);
      } catch (err) {
        expect((err as LearningLoopError).code).toBe('INVALID_STATUS_TRANSITION');
      }

      // Advance to iterating
      await transitionMissionToIteratingCAS(MSN_ID, d1Mock as unknown as D1Database);

      // Attempt backwards: iterating -> learning
      await expect(
        transitionMissionLifecycleCAS(MSN_ID, 'iterating', 'learning', 'backward_jump', d1Mock as unknown as D1Database)
      ).rejects.toThrowError(LearningLoopError);

      // Attempt backwards: iterating -> completed
      await expect(
        transitionMissionLifecycleCAS(MSN_ID, 'iterating', 'completed', 'backward_jump', d1Mock as unknown as D1Database)
      ).rejects.toThrowError(LearningLoopError);
    });

    it('ADV-3.3: Illegal state skipping is strictly rejected (completed cannot jump directly to iterating)', async () => {
      // Mission is 'completed'
      await expect(
        transitionMissionLifecycleCAS(MSN_ID, 'completed', 'iterating', 'illegal_skip', d1Mock as unknown as D1Database)
      ).rejects.toThrowError(LearningLoopError);

      try {
        await transitionMissionLifecycleCAS(MSN_ID, 'completed', 'iterating', 'illegal_skip', d1Mock as unknown as D1Database);
      } catch (err) {
        expect((err as LearningLoopError).code).toBe('INVALID_STATUS_TRANSITION');
      }

      // Verify mission status remains 'completed'
      const mission = rawDb.prepare('SELECT status FROM creative_missions WHERE id = ?').get(MSN_ID) as { status: string };
      expect(mission.status).toBe('completed');
    });

    it('ADV-3.4: Double-transition / Re-entrancy fails closed with CONCURRENT_MODIFICATION', async () => {
      // First advance succeeds
      await transitionMissionToLearningCAS(MSN_ID, d1Mock as unknown as D1Database);

      // Second advance with expectedStatus 'completed' must fail because DB is now 'learning'
      await expect(
        transitionMissionToLearningCAS(MSN_ID, d1Mock as unknown as D1Database)
      ).rejects.toThrowError(LearningLoopError);

      try {
        await transitionMissionToLearningCAS(MSN_ID, d1Mock as unknown as D1Database);
      } catch (err) {
        expect((err as LearningLoopError).code).toBe('CONCURRENT_MODIFICATION');
      }

      // Same check for learning -> iterating
      await transitionMissionToIteratingCAS(MSN_ID, d1Mock as unknown as D1Database);

      await expect(
        transitionMissionToIteratingCAS(MSN_ID, d1Mock as unknown as D1Database)
      ).rejects.toThrowError(LearningLoopError);

      try {
        await transitionMissionToIteratingCAS(MSN_ID, d1Mock as unknown as D1Database);
      } catch (err) {
        expect((err as LearningLoopError).code).toBe('CONCURRENT_MODIFICATION');
      }
    });

    it('ADV-3.5: Concurrent transition race: exactly ONE of two simultaneous workers succeeds', async () => {
      // Both workers attempt completed -> learning simultaneously
      const worker1 = transitionMissionToLearningCAS(MSN_ID, d1Mock as unknown as D1Database);
      const worker2 = transitionMissionToLearningCAS(MSN_ID, d1Mock as unknown as D1Database);

      const results = await Promise.allSettled([worker1, worker2]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectionReason).toBeInstanceOf(LearningLoopError);
      expect(rejectionReason.code).toBe('CONCURRENT_MODIFICATION');

      // Final status in DB must be 'learning'
      const mission = rawDb.prepare('SELECT status FROM creative_missions WHERE id = ?').get(MSN_ID) as { status: string };
      expect(mission.status).toBe('learning');
    });

    it('ADV-3.6: Exhaustive 10x10 lifecycle transition matrix verification (100 permutations)', () => {
      const allStatuses: CreativeMissionStatus[] = [
        'draft',
        'planned',
        'approval_required',
        'running',
        'paused',
        'review',
        'completed',
        'learning',
        'iterating',
        'failed',
      ];

      let allowedCount = 0;
      let disallowedCount = 0;

      for (const from of allStatuses) {
        for (const to of allStatuses) {
          const isPermitted = canMissionTransition(from, to);
          const shouldBeAllowed = ALLOWED_LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;

          expect(isPermitted).toBe(shouldBeAllowed);
          if (isPermitted) allowedCount++;
          else disallowedCount++;
        }
      }

      // Verify specific counts: 100 total combinations, majority are disallowed
      expect(allowedCount + disallowedCount).toBe(100);
      expect(allowedCount).toBeLessThan(30); // Strict, constrained state machine
      expect(disallowedCount).toBeGreaterThan(70);

      // Verify critical Phase 5 constraints:
      expect(canMissionTransition('completed', 'learning')).toBe(true);
      expect(canMissionTransition('completed', 'iterating')).toBe(false);
      expect(canMissionTransition('completed', 'running')).toBe(false);
      expect(canMissionTransition('completed', 'completed')).toBe(false);
      expect(canMissionTransition('learning', 'iterating')).toBe(true);
      expect(canMissionTransition('learning', 'completed')).toBe(false);
      expect(canMissionTransition('learning', 'learning')).toBe(false);
      expect(canMissionTransition('iterating', 'learning')).toBe(false);
      expect(canMissionTransition('iterating', 'completed')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. SQLITE UNIQUE INDEX uidx_playbook_patterns_upsert UNDER RAPID UPSERTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Target 4: SQLite Unique Index uidx_playbook_patterns_upsert Rapid Upserts', () => {
    it('ADV-4.1: Confirms unique index exists on (workspace_id, feature_key, feature_value, metric)', () => {
      const indexInfo = rawDb.prepare(
        `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = 'uidx_playbook_patterns_upsert'`
      ).get() as { name: string; sql: string };

      expect(indexInfo).toBeDefined();
      expect(indexInfo.name).toBe('uidx_playbook_patterns_upsert');
      expect(indexInfo.sql).toContain('playbook_patterns');
      expect(indexInfo.sql).toContain('workspace_id');
      expect(indexInfo.sql).toContain('feature_key');
      expect(indexInfo.sql).toContain('feature_value');
      expect(indexInfo.sql).toContain('metric');
    });

    it('ADV-4.2: Idempotent ON CONFLICT update preserves primary key id while updating metrics', () => {
      const stmt = rawDb.prepare(`
        INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric, avg_metric,
          sample_size, confidence, confidence_level, source, detected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(workspace_id, feature_key, feature_value, metric)
        DO UPDATE SET
          avg_metric = excluded.avg_metric,
          sample_size = excluded.sample_size,
          confidence = excluded.confidence,
          confidence_level = excluded.confidence_level,
          detected_at = excluded.detected_at
      `);

      // First insert
      stmt.run('pat_id_initial', WS_ID, 'hook_style', 'curiosity_gap', 'ctr', 0.10, 10, 0.70, 'medium', 'mission', 100);

      // Second insert with DIFFERENT id and new metrics
      stmt.run('pat_id_second', WS_ID, 'hook_style', 'curiosity_gap', 'ctr', 0.22, 50, 0.95, 'high', 'mission', 200);

      const rows = rawDb.prepare(
        'SELECT * FROM playbook_patterns WHERE workspace_id = ? AND feature_key = ?'
      ).all(WS_ID, 'hook_style') as Array<{
        id: string;
        avg_metric: number;
        sample_size: number;
        confidence: number;
        confidence_level: string;
        detected_at: number;
      }>;

      // Uniqueness guarantees exactly ONE row
      expect(rows).toHaveLength(1);
      // Original primary key is preserved
      expect(rows[0].id).toBe('pat_id_initial');
      // Updated attributes match the second upsert
      expect(rows[0].avg_metric).toBe(0.22);
      expect(rows[0].sample_size).toBe(50);
      expect(rows[0].confidence).toBe(0.95);
      expect(rows[0].confidence_level).toBe('high');
      expect(rows[0].detected_at).toBe(200);
    });

    it('ADV-4.3: 100 rapid sequential upserts on same tuple maintain exactly 1 row with final state', () => {
      const stmt = rawDb.prepare(`
        INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric, avg_metric,
          sample_size, confidence, confidence_level, source, detected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(workspace_id, feature_key, feature_value, metric)
        DO UPDATE SET
          avg_metric = excluded.avg_metric,
          sample_size = excluded.sample_size,
          confidence = excluded.confidence,
          confidence_level = excluded.confidence_level,
          detected_at = excluded.detected_at
      `);

      for (let i = 1; i <= 100; i++) {
        stmt.run(
          `pat_seq_${i}`,
          WS_ID,
          'duration',
          '31-60s',
          'retention',
          0.30 + i * 0.001,
          i,
          Math.min(1.0, 0.50 + i * 0.005),
          i > 50 ? 'high' : 'medium',
          'mission',
          1000 + i,
        );
      }

      const totalRows = rawDb.prepare(
        'SELECT COUNT(*) as count FROM playbook_patterns WHERE workspace_id = ? AND feature_key = ?'
      ).get(WS_ID, 'duration') as { count: number };
      expect(totalRows.count).toBe(1);

      const finalRow = rawDb.prepare(
        'SELECT id, sample_size, detected_at FROM playbook_patterns WHERE workspace_id = ? AND feature_key = ?'
      ).get(WS_ID, 'duration') as { id: string; sample_size: number; detected_at: number };

      expect(finalRow.id).toBe('pat_seq_1'); // initial id preserved
      expect(finalRow.sample_size).toBe(100); // 100th iteration applied
      expect(finalRow.detected_at).toBe(1100);
    });

    it('ADV-4.4: 50 concurrent Promise.all upserts on same tuple complete with zero duplicate rows', async () => {
      const upsertAsync = async (i: number) => {
        return d1Mock
          .prepare(`
            INSERT INTO playbook_patterns (
              id, workspace_id, feature_key, feature_value, metric, avg_metric,
              sample_size, confidence, confidence_level, source, detected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(workspace_id, feature_key, feature_value, metric)
            DO UPDATE SET
              avg_metric = excluded.avg_metric,
              sample_size = excluded.sample_size,
              confidence = excluded.confidence,
              confidence_level = excluded.confidence_level,
              detected_at = excluded.detected_at
          `)
          .bind(
            `pat_concurrent_${i}`,
            WS_ID,
            'voice_style',
            'enthusiastic_recommender',
            'conversion_rate',
            0.05 + (i % 10) * 0.01,
            10 + i,
            0.80,
            'high',
            'mission',
            2000 + i,
          )
          .run();
      };

      const promises = Array.from({ length: 50 }, (_, i) => upsertAsync(i));
      await expect(Promise.all(promises)).resolves.not.toThrow();

      const totalRows = rawDb.prepare(
        'SELECT COUNT(*) as count FROM playbook_patterns WHERE workspace_id = ? AND feature_key = ?'
      ).get(WS_ID, 'voice_style') as { count: number };
      expect(totalRows.count).toBe(1);
    });

    it('ADV-4.5: Multi-feature concurrent upsert creates exactly N distinct rows without cross-pollution', async () => {
      const features = [
        { key: 'hook_style', val: 'curiosity_gap' },
        { key: 'hook_style', val: 'bold_claim' },
        { key: 'hook_style', val: 'problem_agitation' },
        { key: 'voice_style', val: 'dynamic_hook' },
        { key: 'voice_style', val: 'calm_authoritative' },
        { key: 'duration', val: '0-15s' },
        { key: 'duration', val: '16-30s' },
        { key: 'duration', val: '31-60s' },
      ];

      const upserts = features.map((f, i) => {
        return d1Mock
          .prepare(`
            INSERT INTO playbook_patterns (
              id, workspace_id, feature_key, feature_value, metric, avg_metric,
              sample_size, confidence, confidence_level, source, detected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(workspace_id, feature_key, feature_value, metric)
            DO UPDATE SET
              avg_metric = excluded.avg_metric,
              sample_size = excluded.sample_size,
              confidence = excluded.confidence,
              confidence_level = excluded.confidence_level,
              detected_at = excluded.detected_at
          `)
          .bind(
            `pat_multi_${i}`,
            WS_ID,
            f.key,
            f.val,
            'ctr',
            0.15,
            20,
            0.85,
            'high',
            'mission',
            3000 + i,
          )
          .run();
      });

      await expect(Promise.all(upserts)).resolves.not.toThrow();

      const totalRows = rawDb.prepare(
        'SELECT COUNT(*) as count FROM playbook_patterns WHERE workspace_id = ?'
      ).get(WS_ID) as { count: number };
      expect(totalRows.count).toBe(features.length);
    });

    it('ADV-4.6: Raw INSERT without ON CONFLICT strictly throws SQLITE_CONSTRAINT unique violation', () => {
      const rawInsert = rawDb.prepare(`
        INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric, avg_metric,
          sample_size, confidence, confidence_level, source, detected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // First raw insert succeeds
      rawInsert.run('pat_raw_1', WS_ID, 'hook_style', 'story_lead', 'ctr', 0.12, 10, 0.70, 'medium', 'mission', 100);

      // Duplicate raw insert with DIFFERENT id must throw SQLite constraint error
      expect(() => {
        rawInsert.run('pat_raw_2', WS_ID, 'hook_style', 'story_lead', 'ctr', 0.14, 15, 0.75, 'medium', 'mission', 200);
      }).toThrow(/UNIQUE constraint failed/i);
    });

    it('ADV-4.7: Boundary differentiation: same workspace/feature but different metric stores as distinct row', () => {
      const stmt = rawDb.prepare(`
        INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric, avg_metric,
          sample_size, confidence, confidence_level, source, detected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(workspace_id, feature_key, feature_value, metric)
        DO UPDATE SET
          avg_metric = excluded.avg_metric,
          sample_size = excluded.sample_size,
          confidence = excluded.confidence,
          confidence_level = excluded.confidence_level,
          detected_at = excluded.detected_at
      `);

      // Same workspace, feature_key, feature_value, but metric is 'ctr' vs 'retention'
      stmt.run('pat_diff_1', WS_ID, 'hook_style', 'statistic_reveal', 'ctr', 0.10, 10, 0.75, 'medium', 'mission', 100);
      stmt.run('pat_diff_2', WS_ID, 'hook_style', 'statistic_reveal', 'retention', 0.45, 10, 0.80, 'high', 'mission', 100);

      const rows = rawDb.prepare(
        'SELECT id, metric, avg_metric FROM playbook_patterns WHERE workspace_id = ? AND feature_key = ?'
      ).all(WS_ID, 'hook_style') as Array<{ id: string; metric: string; avg_metric: number }>;

      expect(rows).toHaveLength(2);
      const metrics = rows.map((r) => r.metric);
      expect(metrics).toContain('ctr');
      expect(metrics).toContain('retention');
    });
  });
});
