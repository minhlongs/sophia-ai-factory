/**
 * Challenger 1 (Iteration 3) — Empirical Stress Test Suite
 *
 * Exhaustive adversarial stress-testing of core algorithms & mathematical invariants:
 * 1. OCC CAS Monotonic Ledger & Concurrent Deduplication Re-Probe:
 *    Simulate high-concurrency race on identical `referenceId` (e.g. duplicate webhook / retry storm).
 *    Verify losing siblings return idempotent success immediately without exhausting retries,
 *    all returning identical ledgerId, with exactly 1 row committed and zero lost updates.
 * 2. 70/30 Integer Royalty Split Mathematical Invariants:
 *    Fuzz test 10,000 random transaction amounts (micro $0.01 to $1,000,000,000) ensuring
 *    `creatorCut + platformCut === total` always holds with 0 balance leakage.
 * 3. Circular Lineage Graph Traversal:
 *    Stress-test deep trees (up to 1,000 hops), self-remix, and cyclic graphs (1-cycle, 2-cycle,
 *    N-cycle, sub-cycle) ensuring all cycles are rejected without stack overflow or infinite loops.
 * 4. HMAC Signed URLs Cryptographic Security:
 *    Enforce 24h expiration boundary, payload tampering, signature bit-flipping across all 64 hex chars,
 *    cross-video replay attacks, and timing-safe verification.
 *
 * @module tests/stress/challenger-1-r3.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  calculateTemplateRoyalty,
  isSelfTemplateActivation,
  activateTemplateWithRoyaltyCAS,
  DEFAULT_TEMPLATE_ROYALTY_PCT,
} from '../../apps/sophia-ai-factory/src/tree/creator-royalties/template-activation';
import {
  calculateRoyaltyCents,
  calculateMultiTierSplit,
  accrueCreatorLedgerEntryCAS,
  isCircularAncestorRemix,
  recordBlueprintRemixAndAccrueRoyalty,
} from '../../apps/sophia-ai-factory/src/tree/creator-royalties/attribution';
import {
  createSignedDownloadToken,
  verifySignedDownloadToken,
  timingSafeEqual,
  stringToBase64Url,
  base64UrlToString,
  computeHmacSha256Hex,
} from '../../apps/sophia-ai-factory/src/seed/security/signed-url';

/**
 * Creates an in-memory SQLite D1 shim with the canonical production Migration 0275/0291 schema.
 */
function createCanonicalD1(): D1Database & { raw: DatabaseSync } {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_blueprints (
      id TEXT PRIMARY KEY,
      creator_id TEXT,
      parent_blueprint_id TEXT,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL
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

    CREATE TABLE IF NOT EXISTS creator_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      handle TEXT UNIQUE NOT NULL,
      payout_rail TEXT NOT NULL DEFAULT 'USDT',
      payout_destination TEXT,
      accumulated_earnings_cents INTEGER NOT NULL DEFAULT 0,
      available_balance_cents INTEGER NOT NULL DEFAULT 0,
      total_earnings_cents INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS creator_templates (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      niche TEXT NOT NULL,
      script_template TEXT NOT NULL,
      storyboard_json TEXT NOT NULL,
      visual_style_prompt TEXT NOT NULL,
      background_music_url TEXT,
      price_cents INTEGER NOT NULL DEFAULT 0,
      royalty_pct REAL NOT NULL DEFAULT 70.0,
      status TEXT NOT NULL DEFAULT 'approved',
      rating_avg REAL NOT NULL DEFAULT 0.0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      use_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS creator_earnings_ledger (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      event_type TEXT NOT NULL DEFAULT 'royalty_accrual',
      source_type TEXT NOT NULL DEFAULT 'template_activation',
      reference_id TEXT NOT NULL,
      balance_after_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      sequence_num INTEGER NOT NULL DEFAULT 1,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(creator_id, reference_id, event_type),
      UNIQUE(creator_id, sequence_num)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uidx_creator_ledger_seq 
      ON creator_earnings_ledger(creator_id, sequence_num);

    CREATE INDEX IF NOT EXISTS idx_creator_ledger_creator 
      ON creator_earnings_ledger(creator_id, created_at DESC, sequence_num DESC);
  `);

  const d1Wrapper = {
    raw: db,
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          const sanitized = args.map((p) => (p === undefined ? null : p));
          return {
            async first<T>(): Promise<T | null> {
              const res = stmt.get(...sanitized);
              return (res ?? null) as T;
            },
            async all<T>(): Promise<{ results: T[] }> {
              const res = stmt.all(...sanitized);
              return { results: res as T[] };
            },
            async run(): Promise<{ success: boolean; meta: { changes: number } }> {
              const info = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(info.changes) } };
            },
          };
        },
      };
    },
  };

  return d1Wrapper as unknown as D1Database & { raw: DatabaseSync };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. OCC CAS CONCURRENT DEDUPLICATION RE-PROBE & MONOTONIC LEDGER
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1 (R3): OCC CAS Concurrent Deduplication Re-Probe & Monotonic Ledger', () => {
  let db: D1Database & { raw: DatabaseSync };

  beforeEach(() => {
    db = createCanonicalD1();
  });

  it('empirically verifies simulated race on identical referenceId: losing siblings return idempotent success immediately without exhausting retries', async () => {
    const creatorId = 'cr_simulated_race_winner';
    const sharedReferenceId = 'ref_race_duplicate_001';
    const amountCents = 2500; // $25.00
    const concurrency = 10;

    // Launch 10 simultaneous concurrent requests with the EXACT SAME referenceId.
    // Set maxRetries = 3 to prove losing siblings do NOT exhaust retries or fail.
    const startTime = performance.now();
    const tasks = Array.from({ length: concurrency }, (_, idx) => {
      return accrueCreatorLedgerEntryCAS(
        db,
        {
          creatorId,
          amountCents,
          referenceId: sharedReferenceId,
          eventType: 'royalty_accrual',
          sourceType: 'template_activation',
          metadata: { workerIndex: idx },
        },
        3, // Tight retry limit: would fail if re-probe did not succeed immediately
      );
    });

    const results = await Promise.all(tasks);
    const durationMs = performance.now() - startTime;

    // Invariant 1: 100% of siblings must report success
    const successCount = results.filter((r) => r.success).length;
    expect(successCount).toBe(concurrency);

    // Invariant 2: Zero siblings fail with CAS_CONCURRENCY_EXHAUSTED or UNIQUE constraint error
    const failedSiblings = results.filter((r) => !r.success);
    expect(failedSiblings).toHaveLength(0);

    // Invariant 3: All siblings return the exact same winner ledgerId
    const distinctLedgerIds = new Set(results.map((r) => r.ledgerId));
    expect(distinctLedgerIds.size).toBe(1);

    // Invariant 4: All siblings return the exact same sequence number and balance
    const distinctSeqNums = new Set(results.map((r) => r.sequenceNum));
    expect(distinctSeqNums.size).toBe(1);
    expect(results[0].sequenceNum).toBe(1);

    const distinctBalances = new Set(results.map((r) => r.newBalanceCents));
    expect(distinctBalances.size).toBe(1);
    expect(results[0].newBalanceCents).toBe(amountCents);

    // Invariant 5: Database state has exactly ONE physical row inserted (Zero balance inflation)
    const countRow = await db
      .prepare(`SELECT count(*) as count FROM creator_earnings_ledger WHERE reference_id = ?`)
      .bind(sharedReferenceId)
      .first<{ count: number }>();
    expect(countRow?.count).toBe(1);

    const totalBalanceRow = await db
      .prepare(`SELECT balance_after_cents FROM creator_earnings_ledger WHERE creator_id = ?`)
      .bind(creatorId)
      .first<{ balance_after_cents: number }>();
    expect(totalBalanceRow?.balance_after_cents).toBe(amountCents);

    // Invariant 6: Execution finishes promptly without retry sleep delays
    expect(durationMs).toBeLessThan(1000);
  });

  it('handles massive 25-way concurrent deduplication storm on identical referenceId with 100% idempotent success', async () => {
    const creatorId = 'cr_dedup_storm_25';
    const sharedReferenceId = 'ref_dedup_storm_key_999';
    const amountCents = 1200;
    const concurrency = 25;

    const tasks = Array.from({ length: concurrency }, () => {
      return accrueCreatorLedgerEntryCAS(
        db,
        {
          creatorId,
          amountCents,
          referenceId: sharedReferenceId,
          eventType: 'royalty_accrual',
          sourceType: 'template_activation',
        },
        4, // Constrained retries
      );
    });

    const results = await Promise.all(tasks);

    // All 25 must return success: true
    for (const r of results) {
      expect(r.success).toBe(true);
      expect(r.error).toBeUndefined();
      expect(r.newBalanceCents).toBe(1200);
      expect(r.sequenceNum).toBe(1);
    }

    // Exactly 1 row in DB
    const countRow = await db
      .prepare(`SELECT count(*) as count FROM creator_earnings_ledger WHERE reference_id = ?`)
      .bind(sharedReferenceId)
      .first<{ count: number }>();
    expect(countRow?.count).toBe(1);
  });

  it('handles interleaved multi-reference concurrent races without crosstalk', async () => {
    const creatorId = 'cr_interleaved_races';
    const refA = 'ref_group_alpha';
    const refB = 'ref_group_beta';
    const amountA = 500;
    const amountB = 700;

    // 5 concurrent on refA, 5 concurrent on refB running in parallel
    const tasksA = Array.from({ length: 5 }, () =>
      accrueCreatorLedgerEntryCAS(db, {
        creatorId,
        amountCents: amountA,
        referenceId: refA,
        eventType: 'royalty_accrual',
      }, 8),
    );

    const tasksB = Array.from({ length: 5 }, () =>
      accrueCreatorLedgerEntryCAS(db, {
        creatorId,
        amountCents: amountB,
        referenceId: refB,
        eventType: 'royalty_accrual',
      }, 8),
    );

    const [resultsA, resultsB] = await Promise.all([
      Promise.all(tasksA),
      Promise.all(tasksB),
    ]);

    // All 10 requests must succeed
    expect(resultsA.every((r) => r.success)).toBe(true);
    expect(resultsB.every((r) => r.success)).toBe(true);

    // Results in group A share 1 ledgerId; group B share another ledgerId
    const ledgerIdsA = new Set(resultsA.map((r) => r.ledgerId));
    const ledgerIdsB = new Set(resultsB.map((r) => r.ledgerId));
    expect(ledgerIdsA.size).toBe(1);
    expect(ledgerIdsB.size).toBe(1);
    expect([...ledgerIdsA][0]).not.toBe([...ledgerIdsB][0]);

    // Exactly 2 physical rows inserted
    const countRow = await db
      .prepare(`SELECT count(*) as count FROM creator_earnings_ledger WHERE creator_id = ?`)
      .bind(creatorId)
      .first<{ count: number }>();
    expect(countRow?.count).toBe(2);

    // Final balance is exactly 500 + 700 = 1200
    const finalBalanceRow = await db
      .prepare(`SELECT balance_after_cents FROM creator_earnings_ledger WHERE creator_id = ? ORDER BY sequence_num DESC LIMIT 1`)
      .bind(creatorId)
      .first<{ balance_after_cents: number }>();
    expect(finalBalanceRow?.balance_after_cents).toBe(1200);
  });

  it('guarantees strictly monotonic sequencing and zero lost updates under 20 distinct concurrent transactions', async () => {
    const creatorId = 'cr_distinct_conc_20';
    const numTransactions = 20;
    const amountPerTx = 300;

    const tasks = Array.from({ length: numTransactions }, (_, idx) => {
      return accrueCreatorLedgerEntryCAS(
        db,
        {
          creatorId,
          amountCents: amountPerTx,
          referenceId: `ref_distinct_tx_${idx}`,
          eventType: 'royalty_accrual',
          sourceType: 'template_activation',
        },
        12,
      );
    });

    const results = await Promise.all(tasks);

    // 1. All 20 must succeed
    expect(results.every((r) => r.success)).toBe(true);

    // 2. Query all rows in sequence order
    const rows = await db
      .prepare(
        `SELECT sequence_num, amount_cents, balance_after_cents 
         FROM creator_earnings_ledger 
         WHERE creator_id = ? 
         ORDER BY sequence_num ASC`,
      )
      .bind(creatorId)
      .all<{ sequence_num: number; amount_cents: number; balance_after_cents: number }>();

    expect(rows.results.length).toBe(numTransactions);

    // 3. Strict monotonic sequence [1, 2, ..., 20] with zero gaps or duplicates
    const seqs = rows.results.map((r) => r.sequence_num);
    const expected = Array.from({ length: numTransactions }, (_, i) => i + 1);
    expect(seqs).toEqual(expected);

    // 4. Exact balance conservation: 20 * 300 = 6000 cents
    expect(rows.results[numTransactions - 1].balance_after_cents).toBe(numTransactions * amountPerTx);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. 70/30 INTEGER ROYALTY SPLIT: 10,000 RANDOM TRANSACTIONS & ZERO LEAKAGE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1 (R3): 70/30 Integer Royalty Split Mathematical Invariants', () => {
  it('fuzz tests 10,000 random transaction amounts (zero leakage, discrete integer cents, invariant conservation)', () => {
    // Deterministic LCG pseudo-random generator
    let seed = 123456789;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 4294967296;
    };

    let totalDiscrepancies = 0;
    let totalCentsFuzzed = 0;
    let totalCreatorCents = 0;
    let totalPlatformCents = 0;

    for (let i = 0; i < 10000; i++) {
      let priceCents: number;

      if (i < 500) {
        // Micro-transactions: $0.01 to $1.00 (1 to 100 cents)
        priceCents = (i % 100) + 1;
      } else if (i < 2500) {
        // Low-mid amounts: $1.01 to $100.00 (101 to 10,000 cents)
        priceCents = 101 + Math.floor(lcg() * 9899);
      } else if (i < 5000) {
        // Mid-high amounts: $100.01 to $10,000.00 (10,001 to 1,000,000 cents)
        priceCents = 10_001 + Math.floor(lcg() * 989_999);
      } else if (i < 8000) {
        // Large amounts: $10,000.01 to $1,000,000.00 (1,000,001 to 100,000,000 cents)
        priceCents = 1_000_001 + Math.floor(lcg() * 99_000_000);
      } else {
        // Boundary and extreme spectrum ($0.01, $9.99, $19.99, $100k, $1M, $10M, $1B)
        const boundaries = [
          1, 2, 3, 4, 5, 7, 9, 10, 99, 100, 199, 999, 1999, 2999, 4999, 9999,
          10_000, 50_000, 100_000, 500_000, 1_000_000, 10_000_000, 100_000_000,
          1_000_000_000, // $10,000,000.00
          100_000_000_000, // $1,000,000,000.00 (within JS Number.MAX_SAFE_INTEGER)
        ];
        priceCents = boundaries[i % boundaries.length];
      }

      const split = calculateTemplateRoyalty(priceCents, 70.0);

      // Invariant 1: Zero leakage (creatorCents + platformCents === priceCents)
      if (split.creatorCents + split.platformCents !== priceCents) {
        totalDiscrepancies++;
      }

      // Invariant 2: Discrete integer cents
      expect(Number.isInteger(split.creatorCents)).toBe(true);
      expect(Number.isInteger(split.platformCents)).toBe(true);

      // Invariant 3: Exact mathematical floor formula
      const expectedCreator = Math.floor((priceCents * 70) / 100);
      expect(split.creatorCents).toBe(expectedCreator);
      expect(split.platformCents).toBe(priceCents - expectedCreator);

      // Invariant 4: Non-negative allocations
      expect(split.creatorCents).toBeGreaterThanOrEqual(0);
      expect(split.platformCents).toBeGreaterThanOrEqual(0);

      totalCentsFuzzed += priceCents;
      totalCreatorCents += split.creatorCents;
      totalPlatformCents += split.platformCents;
    }

    // Zero balance leakage across all 10,000 transactions
    expect(totalDiscrepancies).toBe(0);
    expect(totalCreatorCents + totalPlatformCents).toBe(totalCentsFuzzed);
  });

  it('cross-verifies calculateMultiTierSplit across 10,000 random transactions for zero leakage', () => {
    let seed = 99887766;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 4294967296;
    };

    let totalDiscrepancies = 0;

    for (let i = 0; i < 10000; i++) {
      const revenueCents = Math.floor(lcg() * 50_000_000) + 1;
      const split = calculateMultiTierSplit(revenueCents, 70.0, 'root_author', 'parent_remixer');

      // Invariant: rootRoyalty + parentRoyalty === totalRoyaltyCents
      if (split.rootRoyaltyCents + (split.parentRoyaltyCents ?? 0) !== split.totalRoyaltyCents) {
        totalDiscrepancies++;
      }

      expect(Number.isInteger(split.rootRoyaltyCents)).toBe(true);
      expect(Number.isInteger(split.parentRoyaltyCents ?? 0)).toBe(true);
    }

    expect(totalDiscrepancies).toBe(0);
  });

  it('verifies boundary and edge cases: zero, negative, and extreme percentages', () => {
    // 0 cents
    expect(calculateTemplateRoyalty(0, 70.0)).toEqual({ creatorCents: 0, platformCents: 0 });

    // Negative amounts
    expect(calculateTemplateRoyalty(-100, 70.0)).toEqual({ creatorCents: 0, platformCents: 0 });
    expect(calculateTemplateRoyalty(-9999, 70.0)).toEqual({ creatorCents: 0, platformCents: 0 });

    // 0% royalty: 100% to platform
    expect(calculateTemplateRoyalty(1000, 0.0)).toEqual({ creatorCents: 0, platformCents: 1000 });

    // Negative royalty: 100% to platform
    expect(calculateTemplateRoyalty(1000, -25.0)).toEqual({ creatorCents: 0, platformCents: 1000 });

    // 100% royalty: 100% to creator
    expect(calculateTemplateRoyalty(1000, 100.0)).toEqual({ creatorCents: 1000, platformCents: 0 });

    // >100% royalty: clamped to 100%
    expect(calculateTemplateRoyalty(1000, 150.0)).toEqual({ creatorCents: 1000, platformCents: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CIRCULAR LINEAGE GRAPH TRAVERSAL: DEEP TREES & CYCLIC GRAPH REJECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1 (R3): Circular Lineage Graph Traversal Stress-Testing', () => {
  let db: D1Database & { raw: DatabaseSync };

  beforeEach(() => {
    db = createCanonicalD1();
  });

  it('rejects direct 1-hop self-remix and self-activation', async () => {
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_root_alice', 'usr_alice', null, 'Alice Root', Date.now())
      .run();

    const isCircular = await isCircularAncestorRemix(db, 'bp_root_alice', 'usr_alice');
    expect(isCircular).toBe(true);

    expect(isSelfTemplateActivation('usr_alice', 'usr_alice')).toBe(true);
    expect(isSelfTemplateActivation('  usr_alice  ', 'usr_alice')).toBe(true);
    expect(isSelfTemplateActivation('usr_alice', 'usr_bob')).toBe(false);
  });

  it('detects cyclic parent loops of any topology (1-cycle, 2-cycle, 3-cycle, sub-cycle) without infinite recursion', async () => {
    // 1-Cycle: A -> A
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_cycle_self', 'u1', 'bp_cycle_self', 'Self loop', Date.now())
      .run();
    expect(await isCircularAncestorRemix(db, 'bp_cycle_self', 'usr_unrelated')).toBe(true);

    // 2-Cycle: A -> B -> A
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_2a', 'u_a', 'bp_2b', '2A', Date.now())
      .run();
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_2b', 'u_b', 'bp_2a', '2B', Date.now())
      .run();
    expect(await isCircularAncestorRemix(db, 'bp_2a', 'usr_unrelated')).toBe(true);

    // 3-Cycle: A -> B -> C -> A
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_3a', 'u_1', 'bp_3b', '3A', Date.now())
      .run();
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_3b', 'u_2', 'bp_3c', '3B', Date.now())
      .run();
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_3c', 'u_3', 'bp_3a', '3C', Date.now())
      .run();
    expect(await isCircularAncestorRemix(db, 'bp_3a', 'usr_unrelated')).toBe(true);

    // Sub-cycle: A -> B -> C -> D -> B (sub-cycle within ancestors)
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_sub_1', 'u_1', 'bp_sub_2', 'Sub 1', Date.now())
      .run();
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_sub_2', 'u_2', 'bp_sub_3', 'Sub 2', Date.now())
      .run();
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_sub_3', 'u_3', 'bp_sub_4', 'Sub 3', Date.now())
      .run();
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_sub_4', 'u_4', 'bp_sub_2', 'Sub 4 loops to Sub 2', Date.now())
      .run();
    expect(await isCircularAncestorRemix(db, 'bp_sub_1', 'usr_unrelated')).toBe(true);
  });

  it('traverses deep trees up to 1,000 hops iteratively without stack overflow or performance degradation', async () => {
    const chainLength = 1000;

    // Insert 1,000-node lineage chain
    for (let i = 0; i < chainLength; i++) {
      const parentId = i === 0 ? null : `bp_deep_${i - 1}`;
      await db
        .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(`bp_deep_${i}`, `creator_node_${i}`, parentId, `Deep Node ${i}`, Date.now())
        .run();
    }

    // Default maxDepth = 10:
    // Searching for creator_node_999 (leaf node): matches immediately at depth 0
    expect(await isCircularAncestorRemix(db, 'bp_deep_999', 'creator_node_999')).toBe(true);

    // Searching for creator_node_993 (6 hops back): detected within default maxDepth 10
    expect(await isCircularAncestorRemix(db, 'bp_deep_999', 'creator_node_993')).toBe(true);

    // Searching for creator_node_980 (19 hops back): beyond default maxDepth 10 -> gracefully stops
    expect(await isCircularAncestorRemix(db, 'bp_deep_999', 'creator_node_980')).toBe(false);

    // Deep search with maxDepth = 1100: reaches root creator_node_0 across 1,000 hops
    const startTime = performance.now();
    const detectedRoot = await isCircularAncestorRemix(db, 'bp_deep_999', 'creator_node_0', 1100);
    const durationMs = performance.now() - startTime;

    expect(detectedRoot).toBe(true);
    expect(durationMs).toBeLessThan(1000); // 1,000 SQLite lookups must execute within 1 second
  });

  it('blocks multi-hop circular remix via recordBlueprintRemixAndAccrueRoyalty', async () => {
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_root_orig', 'author_alice', null, 'Root Origin', Date.now())
      .run();
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_step_1', 'author_bob', 'bp_root_orig', 'Step 1', Date.now())
      .run();
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_step_2', 'author_charlie', 'bp_step_1', 'Step 2', Date.now())
      .run();

    // Alice attempts to remix Step 2 (originated from Alice 2 hops back)
    const result = await recordBlueprintRemixAndAccrueRoyalty(db, {
      blueprintId: 'bp_step_2',
      parentCreatorId: 'author_charlie',
      remixerUserId: 'author_alice',
      missionId: 'ms_remix_cycle',
      revenueCents: 10000,
      royaltyPercent: 70,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. HMAC SIGNED URLS: 24H EXPIRATION, TAMPERING & CONSTANT-TIME VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1 (R3): HMAC Signed URLs Cryptographic Security', () => {
  const secret = 'super-secret-hmac-key-256-edge-safe';
  const videoId = 'vid_enterprise_4k_dubbed';
  const userId = 'usr_vip_apac_01';
  const tenantId = 'tenant_apac_singapore';

  it('enforces exact 24-hour (86,400s) expiration boundary', async () => {
    // 1. Nominal token with default 86,400s TTL
    const token = await createSignedDownloadToken({
      videoId,
      userId,
      tenantId,
      ttlSeconds: 86400,
      secret,
    });

    const resNow = await verifySignedDownloadToken({ token, videoId, secret });
    expect(resNow.valid).toBe(true);
    expect(resNow.expired).toBe(false);
    expect(resNow.payload?.videoId).toBe(videoId);
    expect(resNow.payload?.expiresAt).toBe(resNow.payload!.issuedAt + 86400);

    // 2. Token created with ttl = -1 (already expired 1 second in past)
    const expiredToken = await createSignedDownloadToken({
      videoId,
      userId,
      tenantId,
      ttlSeconds: -1,
      secret,
    });

    const resExpired = await verifySignedDownloadToken({ token: expiredToken, videoId, secret });
    expect(resExpired.valid).toBe(false);
    expect(resExpired.expired).toBe(true);
    expect(resExpired.payload?.videoId).toBe(videoId);

    // 3. Token created with ttl = -86400 (expired 24 hours in past)
    const expired24hToken = await createSignedDownloadToken({
      videoId,
      userId,
      tenantId,
      ttlSeconds: -86400,
      secret,
    });

    const resExpired24h = await verifySignedDownloadToken({ token: expired24hToken, videoId, secret });
    expect(resExpired24h.valid).toBe(false);
    expect(resExpired24h.expired).toBe(true);
  });

  it('rejects signature bit-flipping across all 64 hexadecimal characters', async () => {
    const token = await createSignedDownloadToken({ videoId, userId, tenantId, ttlSeconds: 86400, secret });
    const dotIdx = token.lastIndexOf('.');
    const payloadB64 = token.substring(0, dotIdx);
    const signatureHex = token.substring(dotIdx + 1);

    expect(signatureHex.length).toBe(64);

    // Flip every single hex character [0..63] individually
    for (let pos = 0; pos < 64; pos++) {
      const origChar = signatureHex[pos];
      const flippedChar = origChar === 'a' ? 'b' : 'a';
      const tamperedSig = signatureHex.substring(0, pos) + flippedChar + signatureHex.substring(pos + 1);
      const tamperedToken = `${payloadB64}.${tamperedSig}`;

      const res = await verifySignedDownloadToken({ token: tamperedToken, videoId, secret });
      expect(res.valid).toBe(false);
      expect(res.expired).toBe(false);
    }

    // Truncated signature (63 chars)
    expect((await verifySignedDownloadToken({ token: `${payloadB64}.${signatureHex.slice(0, 63)}`, videoId, secret })).valid).toBe(false);

    // Appended signature (65 chars)
    expect((await verifySignedDownloadToken({ token: `${payloadB64}.${signatureHex}ff`, videoId, secret })).valid).toBe(false);

    // Wrong secret
    expect((await verifySignedDownloadToken({ token, videoId, secret: 'attacker-wrong-secret' })).valid).toBe(false);
  });

  it('rejects payload tampering and cross-video token replay attacks', async () => {
    const token = await createSignedDownloadToken({ videoId, userId, tenantId, ttlSeconds: 86400, secret });
    const dotIdx = token.lastIndexOf('.');
    const payloadB64 = token.substring(0, dotIdx);
    const signatureHex = token.substring(dotIdx + 1);

    const payload = JSON.parse(base64UrlToString(payloadB64));

    // Tamper 1: Attacker changes videoId in payload
    payload.videoId = 'vid_unauthorized_premium_movie';
    const tamperedPayloadB64 = stringToBase64Url(JSON.stringify(payload));
    const tamperedToken = `${tamperedPayloadB64}.${signatureHex}`;
    expect((await verifySignedDownloadToken({ token: tamperedToken, videoId: 'vid_unauthorized_premium_movie', secret })).valid).toBe(false);

    // Tamper 2: Attacker extends expiresAt by 1 year
    payload.videoId = videoId;
    payload.expiresAt = payload.expiresAt + 365 * 86400;
    const extendedPayloadB64 = stringToBase64Url(JSON.stringify(payload));
    const extendedToken = `${extendedPayloadB64}.${signatureHex}`;
    expect((await verifySignedDownloadToken({ token: extendedToken, videoId, secret })).valid).toBe(false);

    // Tamper 3: Cross-video replay (Valid token for video A presented for video B)
    expect((await verifySignedDownloadToken({ token, videoId: 'vid_victim_target_video', secret })).valid).toBe(false);
  });

  it('empirically verifies constant-time string comparison (timingSafeEqual)', () => {
    // 1. Equal strings
    expect(timingSafeEqual('a', 'a')).toBe(true);
    expect(timingSafeEqual('abcdef1234567890', 'abcdef1234567890')).toBe(true);
    expect(timingSafeEqual('a'.repeat(64), 'a'.repeat(64))).toBe(true);

    // 2. Mismatched strings at different positions
    expect(timingSafeEqual('Xbcdef', 'abcdef')).toBe(false);
    expect(timingSafeEqual('abcXef', 'abcdef')).toBe(false);
    expect(timingSafeEqual('abcdeX', 'abcdef')).toBe(false);

    // 3. Length mismatch returns false immediately
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('abcd', 'abc')).toBe(false);

    // 4. Non-string defenses
    expect(timingSafeEqual(null as unknown as string, 'abc')).toBe(false);
    expect(timingSafeEqual('abc', undefined as unknown as string)).toBe(false);
    expect(timingSafeEqual(123 as unknown as string, 123 as unknown as string)).toBe(false);

    // 5. Statistical timing benchmark: verify timing difference between head mismatch and tail mismatch is negligible
    const len = 64;
    const base = 'a'.repeat(len);
    const headMismatch = 'b' + 'a'.repeat(len - 1);
    const tailMismatch = 'a'.repeat(len - 1) + 'b';

    const iterations = 50000;

    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      timingSafeEqual(base, headMismatch);
    }
    const tHead = performance.now() - t0;

    const t1 = performance.now();
    for (let i = 0; i < iterations; i++) {
      timingSafeEqual(base, tailMismatch);
    }
    const tTail = performance.now() - t1;

    // Both head mismatch and tail mismatch iterate through the entire string without early return
    expect(Math.abs(tHead - tTail)).toBeLessThan(50); // Under 50ms variance over 50,000 iterations
  });

  it('gracefully handles malformed tokens without throwing unhandled exceptions', async () => {
    const malformed = [
      '',
      'singletokenstring',
      'too.many.dots.in.token.string',
      '.leadingdot',
      'trailingdot.',
      'notbase64@@@.signature',
      'bm90anNvbg.signature',
    ];

    for (const badToken of malformed) {
      const res = await verifySignedDownloadToken({ token: badToken, videoId, secret });
      expect(res.valid).toBe(false);
      expect(res.expired).toBe(false);
    }
  });
});
