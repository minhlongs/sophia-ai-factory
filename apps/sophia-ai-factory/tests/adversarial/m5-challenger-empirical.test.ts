/**
 * Milestone M5 Tier 5 Adversarial Coverage Hardening:
 * Empirical Challenger Verification Harness for R1 & R2
 *
 * @vitest-environment node
 *
 * Requirements Verified:
 * 1. OCC CAS monotonic sequences [1..10] with 0% flakiness across 50 consecutive runs.
 * 2. Multi-hop circular self-remix rejection (A -> B -> A, A -> B -> C -> A) with CIRCULAR_SELF_REMIX_DENIED.
 * 3. Hook score calculation formulas, exact weight normalization, and strict bounds [0.0, 1.0].
 *
 * Layer: test (adversarial empirical challenge)
 */

import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  calculateRoyaltyCents,
  calculateMultiTierSplit,
  recordBlueprintRemixAndAccrueRoyalty,
  accrueCreatorLedgerEntryCAS,
  isCircularAncestorRemix,
} from '@/tree/creator-royalties/attribution';
import {
  calculateHookScore,
  classifyHookStyle,
  VIRAL_SCORE_WEIGHTS,
  CANONICAL_HOOK_STYLES,
} from '@/tree/trend-intelligence/hook-scorer';
import type { BlueprintRemixInput } from '@/seed/types/creator-marketplace';
import type { HookEvaluationInput } from '@/seed/types/creative-intelligence';

/**
 * Creates an in-memory SQLite database emulating Cloudflare D1 with schema 0275 constraints.
 */
function createEmulatedD1(options?: { withUniqueSeq?: boolean }) {
  const db = new DatabaseSync(':memory:');
  const withUniqueSeq = options?.withUniqueSeq ?? true;

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_blueprints (
      id TEXT PRIMARY KEY,
      creator_id TEXT,
      parent_blueprint_id TEXT,
      title TEXT,
      niche TEXT NOT NULL DEFAULT 'general',
      conversion_rate REAL DEFAULT 0.05,
      remix_count INTEGER NOT NULL DEFAULT 0,
      royalty_pct REAL NOT NULL DEFAULT 10.0,
      marketplace_listed INTEGER NOT NULL DEFAULT 1,
      target_platform TEXT NOT NULL DEFAULT 'tiktok',
      created_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS blueprint_remixes (
      id TEXT PRIMARY KEY,
      blueprint_id TEXT NOT NULL,
      parent_blueprint_id TEXT,
      creator_id TEXT NOT NULL,
      remixer_user_id TEXT NOT NULL,
      remixer_id TEXT,
      mission_id TEXT NOT NULL,
      royalty_cents INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS creator_earnings_ledger (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      event_type TEXT NOT NULL DEFAULT 'royalty_accrual',
      source_type TEXT NOT NULL DEFAULT 'blueprint_remix',
      reference_id TEXT NOT NULL,
      balance_after_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      sequence_num INTEGER NOT NULL DEFAULT 1,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(creator_id, reference_id, event_type)
      ${withUniqueSeq ? ', UNIQUE(creator_id, sequence_num)' : ''}
    );

    ${withUniqueSeq ? 'CREATE UNIQUE INDEX IF NOT EXISTS uidx_creator_ledger_seq ON creator_earnings_ledger(creator_id, sequence_num);' : ''}
    CREATE INDEX IF NOT EXISTS idx_creator_ledger_creator ON creator_earnings_ledger(creator_id, created_at DESC, sequence_num DESC);
  `);

  const d1Wrapper = {
    raw: db,
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

  return d1Wrapper as unknown as D1Database & { raw: DatabaseSync };
}

describe('Milestone M5 Challenger Empirical Hardening Suite', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // 1. OCC CAS MONOTONIC SEQUENCES [1..10] WITH 0% FLAKINESS
  // ══════════════════════════════════════════════════════════════════════════
  describe('1. OCC CAS Monotonic Sequences [1..10] (50 Iterations Stress Test)', () => {
    it('achieves 0% flakiness and strictly monotonic [1..10] sequence across 50 consecutive runs', async () => {
      const totalRuns = 50;
      const workerCount = 10;
      const amountPerWorker = 100; // 100 cents = $1.00
      let flawlessRuns = 0;
      let totalDroppedUpdates = 0;

      for (let run = 0; run < totalRuns; run++) {
        const db = createEmulatedD1({ withUniqueSeq: true });
        const creatorId = `creator_occ_run_${run}`;

        // 10 concurrent workers pounding the ledger simultaneously
        const workers = Array.from({ length: workerCount }, (_, i) =>
          accrueCreatorLedgerEntryCAS(
            db,
            {
              creatorId,
              amountCents: amountPerWorker,
              currency: 'USD',
              eventType: 'royalty_accrual',
              sourceType: 'blueprint_remix',
              referenceId: `ref_run_${run}_worker_${i}`,
              status: 'pending',
            },
            8, // 8 retries max
            10000 + run * 1000 + i,
          ),
        );

        const results = await Promise.all(workers);

        // Fetch persisted ledger rows ordered by sequence_num
        const rows = db.raw
          .prepare(
            'SELECT id, sequence_num, amount_cents, balance_after_cents FROM creator_earnings_ledger WHERE creator_id = ? ORDER BY sequence_num ASC',
          )
          .all(creatorId) as Array<{
            id: string;
            sequence_num: number;
            amount_cents: number;
            balance_after_cents: number;
          }>;

        const successfulCalls = results.filter((r) => r.success).length;
        const distinctSeqs = new Set(rows.map((r) => r.sequence_num));
        const finalRow = rows[rows.length - 1];

        // Strict assertions for this iteration
        expect(successfulCalls).toBe(workerCount);
        expect(rows).toHaveLength(workerCount);
        expect(distinctSeqs.size).toBe(workerCount);
        expect(rows.map((r) => r.sequence_num)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(finalRow?.balance_after_cents).toBe(workerCount * amountPerWorker);

        const dropped = workerCount - rows.length;
        totalDroppedUpdates += dropped;
        if (
          successfulCalls === workerCount &&
          rows.length === workerCount &&
          distinctSeqs.size === workerCount &&
          finalRow?.balance_after_cents === workerCount * amountPerWorker
        ) {
          flawlessRuns++;
        }
      }

      // Conclude 50-run verification
      expect(flawlessRuns).toBe(totalRuns);
      expect(totalDroppedUpdates).toBe(0);
    }, 60000);

    it('scales to 15 concurrent workers under high contention with zero sequence corruption', async () => {
      const db = createEmulatedD1({ withUniqueSeq: true });
      const creatorId = 'creator_high_contention_15';
      const workerCount = 15;
      const amountPerWorker = 50; // 50 cents

      const workers = Array.from({ length: workerCount }, (_, i) =>
        accrueCreatorLedgerEntryCAS(
          db,
          {
            creatorId,
            amountCents: amountPerWorker,
            currency: 'USD',
            eventType: 'royalty_accrual',
            sourceType: 'blueprint_remix',
            referenceId: `ref_c15_${i}`,
            status: 'pending',
          },
          10, // 10 retries for 15 workers
          20000 + i,
        ),
      );

      const results = await Promise.all(workers);
      const rows = db.raw
        .prepare(
          'SELECT sequence_num, balance_after_cents FROM creator_earnings_ledger WHERE creator_id = ? ORDER BY sequence_num ASC',
        )
        .all(creatorId) as Array<{ sequence_num: number; balance_after_cents: number }>;

      expect(results.filter((r) => r.success)).toHaveLength(workerCount);
      expect(rows).toHaveLength(workerCount);
      const expectedSeqs = Array.from({ length: workerCount }, (_, i) => i + 1);
      expect(rows.map((r) => r.sequence_num)).toEqual(expectedSeqs);
      expect(rows[rows.length - 1]?.balance_after_cents).toBe(workerCount * amountPerWorker);
    });

    it('guarantees sequential idempotency: repeated accrual with identical reference_id returns existing ledger row', async () => {
      const db = createEmulatedD1({ withUniqueSeq: true });
      const creatorId = 'creator_idempotent_test';

      const entry = {
        creatorId,
        amountCents: 250,
        currency: 'USD' as const,
        eventType: 'royalty_accrual' as const,
        sourceType: 'blueprint_remix',
        referenceId: 'ref_idempotent_seq_key',
        status: 'pending' as const,
      };

      const first = await accrueCreatorLedgerEntryCAS(db, entry);
      expect(first.success).toBe(true);
      expect(first.sequenceNum).toBe(1);
      expect(first.newBalanceCents).toBe(250);

      const second = await accrueCreatorLedgerEntryCAS(db, entry);
      expect(second.success).toBe(true);
      expect(second.ledgerId).toBe(first.ledgerId);
      expect(second.sequenceNum).toBe(1);
      expect(second.newBalanceCents).toBe(250);

      // Verify only 1 row in DB
      const rows = db.raw
        .prepare('SELECT * FROM creator_earnings_ledger WHERE creator_id = ?')
        .all(creatorId) as Array<{ sequence_num: number; balance_after_cents: number; id: string }>;
      expect(rows).toHaveLength(1);
    });

    it('documents concurrent duplicate reference_id race: DB integrity preserved with exactly 1 row', async () => {
      const db = createEmulatedD1({ withUniqueSeq: true });
      const creatorId = 'creator_concurrent_dup_test';

      const entry = {
        creatorId,
        amountCents: 250,
        currency: 'USD' as const,
        eventType: 'royalty_accrual' as const,
        sourceType: 'blueprint_remix',
        referenceId: 'ref_idempotent_race_key',
        status: 'pending' as const,
      };

      // 5 simultaneous submissions of the exact same referenceId
      const results = await Promise.all(
        Array.from({ length: 5 }, () => accrueCreatorLedgerEntryCAS(db, entry)),
      );

      // At least 1 worker succeeds
      const successful = results.filter((r) => r.success);
      expect(successful.length).toBeGreaterThanOrEqual(1);

      // Critical DB integrity invariant: exactly 1 row is EVER inserted
      const rows = db.raw
        .prepare('SELECT * FROM creator_earnings_ledger WHERE creator_id = ?')
        .all(creatorId) as Array<{ sequence_num: number; balance_after_cents: number; id: string }>;

      expect(rows).toHaveLength(1);
      expect(rows[0]?.sequence_num).toBe(1);
      expect(rows[0]?.balance_after_cents).toBe(250);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. MULTI-HOP CIRCULAR SELF-REMIX REJECTION (A -> B -> A)
  // ══════════════════════════════════════════════════════════════════════════
  describe('2. Multi-Hop Circular Self-Remix Rejection (CIRCULAR_SELF_REMIX_DENIED)', () => {
    it('2.1 blocks direct self-remix (User A remixes Blueprint created by User A)', async () => {
      const db = createEmulatedD1();
      const remix: BlueprintRemixInput = {
        blueprintId: 'bp_self_direct',
        parentCreatorId: 'user_alice',
        remixerUserId: 'user_alice', // SAME USER
        missionId: 'mis_self_direct',
        revenueCents: 5000,
        royaltyPercent: 10,
      };

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, remix);
      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(res.royaltyCents).toBe(0);

      // Confirm 0 records inserted anywhere
      const remixes = db.raw.prepare('SELECT count(*) as count FROM blueprint_remixes').get() as { count: number };
      expect(remixes.count).toBe(0);
      const ledger = db.raw.prepare('SELECT count(*) as count FROM creator_earnings_ledger').get() as { count: number };
      expect(ledger.count).toBe(0);
    });

    it('2.2 blocks 2-hop circular self-remix: A -> B -> A', async () => {
      const db = createEmulatedD1();

      // Alice creates Root Blueprint A
      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES ('bp_A', 'alice', NULL, 'Alice Root Blueprint A')
      `).run();

      // Bob remixes Alice's A to create Blueprint B
      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES ('bp_B', 'bob', 'bp_A', 'Bob Derivative Blueprint B')
      `).run();

      // Alice attempts to remix Bob's B (A -> B -> A)
      const remix: BlueprintRemixInput = {
        blueprintId: 'bp_B',
        parentCreatorId: 'bob',
        remixerUserId: 'alice', // Alice is the root creator of bp_B
        missionId: 'mis_circular_2hop',
        revenueCents: 10000,
        royaltyPercent: 10,
      };

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, remix);
      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(res.royaltyCents).toBe(0);

      // Verify no remix or ledger records created
      const remixes = db.raw.prepare("SELECT count(*) as count FROM blueprint_remixes WHERE blueprint_id = 'bp_B'").get() as { count: number };
      expect(remixes.count).toBe(0);
      const ledger = db.raw.prepare('SELECT count(*) as count FROM creator_earnings_ledger').get() as { count: number };
      expect(ledger.count).toBe(0);
    });

    it('2.3 blocks 3-hop circular self-remix: A -> B -> C -> A', async () => {
      const db = createEmulatedD1();

      // Alice -> Bob -> Charlie
      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES 
          ('bp_root_A', 'alice', NULL, 'Root A'),
          ('bp_child_B', 'bob', 'bp_root_A', 'Child B'),
          ('bp_grandchild_C', 'charlie', 'bp_child_B', 'Grandchild C');
      `).run();

      // Alice attempts to remix Charlie's C (A -> B -> C -> A)
      const remix: BlueprintRemixInput = {
        blueprintId: 'bp_grandchild_C',
        parentCreatorId: 'charlie',
        remixerUserId: 'alice', // Alice is the great-ancestor
        missionId: 'mis_circular_3hop',
        revenueCents: 10000,
        royaltyPercent: 15,
      };

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, remix);
      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(res.royaltyCents).toBe(0);

      const remixes = db.raw.prepare('SELECT count(*) as count FROM blueprint_remixes').get() as { count: number };
      expect(remixes.count).toBe(0);
    });

    it('2.4 permits legitimate multi-hop remix by an independent third party (A -> B -> C by Dave)', async () => {
      const db = createEmulatedD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES 
          ('bp_root_A', 'alice', NULL, 'Root A'),
          ('bp_child_B', 'bob', 'bp_root_A', 'Child B'),
          ('bp_grandchild_C', 'charlie', 'bp_child_B', 'Grandchild C');
      `).run();

      // Dave (independent user) remixes Charlie's C
      const legitimateRemix: BlueprintRemixInput = {
        blueprintId: 'bp_grandchild_C',
        parentCreatorId: 'charlie',
        remixerUserId: 'dave',
        missionId: 'mis_legit_dave',
        revenueCents: 10000, // $100.00
        royaltyPercent: 10,  // 10% = 1000 cents
      };

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, legitimateRemix);
      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.royaltyCents).toBe(1000);
      expect(res.creatorId).toBe('charlie');

      // Verify records created
      const remixes = db.raw.prepare('SELECT * FROM blueprint_remixes WHERE blueprint_id = ?').all('bp_grandchild_C') as Array<{
        remixer_user_id: string;
        royalty_cents: number;
      }>;
      expect(remixes).toHaveLength(1);
      expect(remixes[0]?.remixer_user_id).toBe('dave');
      expect(remixes[0]?.royalty_cents).toBe(1000);

      const ledger = db.raw.prepare('SELECT * FROM creator_earnings_ledger WHERE creator_id = ?').all('charlie') as Array<{
        amount_cents: number;
        balance_after_cents: number;
      }>;
      expect(ledger).toHaveLength(1);
      expect(ledger[0]?.amount_cents).toBe(1000);
      expect(ledger[0]?.balance_after_cents).toBe(1000);
    });

    it('2.5 handles corrupted cyclic graphs (A -> B -> A in blueprint table) without infinite recursion', async () => {
      const db = createEmulatedD1();

      // Malformed circular database state where blueprints reference each other in a loop
      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES 
          ('bp_loop_1', 'creator_1', 'bp_loop_2', 'Loop 1'),
          ('bp_loop_2', 'creator_2', 'bp_loop_1', 'Loop 2');
      `).run();

      // isCircularAncestorRemix must detect the cycle and return true without stack overflow
      const isLoop = await isCircularAncestorRemix(db, 'bp_loop_1', 'any_user');
      expect(isLoop).toBe(true);

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_loop_1',
        parentCreatorId: 'creator_2',
        remixerUserId: 'random_user',
        missionId: 'mis_loop',
        revenueCents: 5000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. HOOK SCORE CALCULATION FORMULAS AND BOUNDS
  // ══════════════════════════════════════════════════════════════════════════
  describe('3. Hook Score Calculation Formulas and Bounds', () => {
    it('3.1 strictly verifies exact weight formula: S_viral = 0.40 * S_hook + 0.25 * S_pacing + 0.20 * S_retention + 0.15 * S_cta', () => {
      // Normalization verification
      const weightSum =
        VIRAL_SCORE_WEIGHTS.hook +
        VIRAL_SCORE_WEIGHTS.pacing +
        VIRAL_SCORE_WEIGHTS.retention +
        VIRAL_SCORE_WEIGHTS.cta;
      expect(weightSum).toBeCloseTo(1.0, 6);

      // Verify each individual weight
      expect(VIRAL_SCORE_WEIGHTS.hook).toBe(0.40);
      expect(VIRAL_SCORE_WEIGHTS.pacing).toBe(0.25);
      expect(VIRAL_SCORE_WEIGHTS.retention).toBe(0.20);
      expect(VIRAL_SCORE_WEIGHTS.cta).toBe(0.15);

      // Test exact linear combination
      const res = calculateHookScore({
        hookText: 'Why 99% of creators fail',
        scores: {
          hookScore: 0.8,
          pacingScore: 0.6,
          retentionScore: 0.7,
          ctaScore: 0.9,
        },
      });

      // Expected: 0.40*0.8 + 0.25*0.6 + 0.20*0.7 + 0.15*0.9
      //         = 0.32 + 0.15 + 0.14 + 0.135 = 0.745 -> rounded = 0.75
      expect(res.viralScore).toBe(0.75);
      expect(res.hookScore).toBe(0.8);
      expect(res.pacingScore).toBe(0.6);
      expect(res.retentionScore).toBe(0.7);
      expect(res.ctaScore).toBe(0.9);
    });

    it('3.2 verifies isolated unitary inputs match exact weight constants', () => {
      expect(calculateHookScore({ hookText: 't', scores: { hookScore: 1, pacingScore: 0, retentionScore: 0, ctaScore: 0 } }).viralScore).toBe(0.40);
      expect(calculateHookScore({ hookText: 't', scores: { hookScore: 0, pacingScore: 1, retentionScore: 0, ctaScore: 0 } }).viralScore).toBe(0.25);
      expect(calculateHookScore({ hookText: 't', scores: { hookScore: 0, pacingScore: 0, retentionScore: 1, ctaScore: 0 } }).viralScore).toBe(0.20);
      expect(calculateHookScore({ hookText: 't', scores: { hookScore: 0, pacingScore: 0, retentionScore: 0, ctaScore: 1 } }).viralScore).toBe(0.15);
    });

    it('3.3 enforces strict bounds [0.0, 1.0] under out-of-range, negative, and infinite inputs', () => {
      // All zeroes
      const allZero = calculateHookScore({
        hookText: 'all zeros',
        scores: { hookScore: 0, pacingScore: 0, retentionScore: 0, ctaScore: 0 },
      });
      expect(allZero.viralScore).toBe(0.0);

      // All ones
      const allOne = calculateHookScore({
        hookText: 'all ones',
        scores: { hookScore: 1, pacingScore: 1, retentionScore: 1, ctaScore: 1 },
      });
      expect(allOne.viralScore).toBe(1.0);

      // Extremely negative clamped to 0.0
      const negativeClamped = calculateHookScore({
        hookText: 'negative',
        scores: {
          hookScore: -100,
          pacingScore: -0.0001,
          retentionScore: -Infinity,
          ctaScore: -500,
        },
      });
      expect(negativeClamped.viralScore).toBe(0.0);
      expect(negativeClamped.hookScore).toBe(0.0);
      expect(negativeClamped.pacingScore).toBe(0.0);
      expect(negativeClamped.retentionScore).toBe(0.0);
      expect(negativeClamped.ctaScore).toBe(0.0);

      // Extremely positive clamped to 1.0
      const positiveClamped = calculateHookScore({
        hookText: 'positive',
        scores: {
          hookScore: 99999,
          pacingScore: 2.5,
          retentionScore: Infinity,
          ctaScore: 100,
        },
      });
      expect(positiveClamped.viralScore).toBe(1.0);
      expect(positiveClamped.hookScore).toBe(1.0);
      expect(positiveClamped.pacingScore).toBe(1.0);
      expect(positiveClamped.retentionScore).toBe(1.0);
      expect(positiveClamped.ctaScore).toBe(1.0);

      // NaN and undefined values fallback safely to 0.5 default
      const nanHandled = calculateHookScore({
        hookText: 'nan test',
        scores: {
          hookScore: NaN,
          pacingScore: NaN,
          retentionScore: NaN,
          ctaScore: NaN,
        },
      });
      expect(nanHandled.viralScore).toBe(0.5);
      expect(nanHandled.hookScore).toBe(0.5);
    });

    it('3.4 Monte Carlo fuzzing: 10,000 randomized tuples strictly respect bounded viral score', () => {
      let seed = 123456789;
      function rng(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let i = 0; i < 10000; i++) {
        const rawH = rng() * 3 - 1; // [-1.0, 2.0]
        const rawP = rng() * 3 - 1;
        const rawR = rng() * 3 - 1;
        const rawC = rng() * 3 - 1;

        const res = calculateHookScore({
          hookText: 'fuzz',
          scores: {
            hookScore: rawH,
            pacingScore: rawP,
            retentionScore: rawR,
            ctaScore: rawC,
          },
        });

        // Verify bounds
        expect(res.viralScore).toBeGreaterThanOrEqual(0.0);
        expect(res.viralScore).toBeLessThanOrEqual(1.0);

        // Verify sanitized component bounds
        expect(res.hookScore).toBeGreaterThanOrEqual(0.0);
        expect(res.hookScore).toBeLessThanOrEqual(1.0);
        expect(res.pacingScore).toBeGreaterThanOrEqual(0.0);
        expect(res.pacingScore).toBeLessThanOrEqual(1.0);
        expect(res.retentionScore).toBeGreaterThanOrEqual(0.0);
        expect(res.retentionScore).toBeLessThanOrEqual(1.0);
        expect(res.ctaScore).toBeGreaterThanOrEqual(0.0);
        expect(res.ctaScore).toBeLessThanOrEqual(1.0);

        // Verify formula precision
        const expectedRaw =
          0.40 * res.hookScore +
          0.25 * res.pacingScore +
          0.20 * res.retentionScore +
          0.15 * res.ctaScore;
        const expectedRounded = Math.round(expectedRaw * 100) / 100;
        expect(Math.abs(res.viralScore - expectedRounded)).toBeLessThanOrEqual(0.01);
      }
    });

    it('3.5 classifies all 6 canonical hook styles across English and Vietnamese prompts', () => {
      expect(CANONICAL_HOOK_STYLES).toHaveLength(6);

      // Question
      expect(classifyHookStyle('Why do so many creators fail on TikTok?')).toBe('question');
      expect(classifyHookStyle('Tại sao 90% nhà sáng tạo nội dung đều thất bại?')).toBe('question');

      // Story Lead
      expect(classifyHookStyle('Story time: how I lost everything and rebuilt in 6 months')).toBe('story_lead');
      expect(classifyHookStyle('Hồi đó khi tôi mới bắt đầu xây dựng kênh với 0 đồng')).toBe('story_lead');

      // Problem Agitation
      expect(classifyHookStyle('Stop making this fatal mistake before posting your next video')).toBe('problem_agitation');
      expect(classifyHookStyle('Đừng bao giờ đăng video theo cách này kẻo mất tiền')).toBe('problem_agitation');

      // Bold Claim
      expect(classifyHookStyle('This AI workflow outperforms every manual video agency 10x faster')).toBe('bold_claim');
      expect(classifyHookStyle('Sự thật gây sốc: phương pháp này vượt trội hoàn toàn so với cách cũ')).toBe('bold_claim');

      // Statistic Reveal
      expect(classifyHookStyle('87% of viewers leave within the first 3 seconds')).toBe('statistic_reveal');
      expect(classifyHookStyle('Top 5 bí quyết tăng 1 triệu lượt xem trong 24 giờ')).toBe('statistic_reveal');

      // Curiosity Gap
      expect(classifyHookStyle('Wait until the end to see the hidden feature')).toBe('curiosity_gap');
      expect(classifyHookStyle('Cái kết bất ngờ mà không ai ngờ tới khi thử nghiệm')).toBe('curiosity_gap');

      // Empty / Fallback
      expect(classifyHookStyle('')).toBe('curiosity_gap');
      expect(classifyHookStyle('   ')).toBe('curiosity_gap');
    });
  });
});
