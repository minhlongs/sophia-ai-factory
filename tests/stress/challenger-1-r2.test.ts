/**
 * Challenger 1 (Iteration 2) — Empirical Stress Test Suite
 *
 * Exhaustive adversarial stress-testing of core algorithms & mathematical invariants:
 * 1. 70/30 Integer Royalty Split: Fuzz test 10,000 random transaction amounts
 *    (including micro-transactions $0.01, zero, large values $100,000, up to $1,000,000)
 *    ensuring `creatorCut + platformCut === total` always holds with 0 balance leakage.
 * 2. OCC CAS Monotonic Ledger: Stress-test `creator_earnings_ledger` accrual under
 *    simulated concurrent transactions, ensuring monotonic sequencing and zero lost updates.
 * 3. Circular Lineage Graph Traversal: Test deep trees (up to 500 hops), self-remix,
 *    and cyclic remix attempts ensuring all cycles are rejected without stack overflow or infinite loops.
 * 4. HMAC Signed URLs: Test 24h expiration, signature tampering, and constant-time
 *    token verification using Web Crypto API.
 *
 * @module tests/stress/challenger-1-r2.test
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
import { createInMemoryD1 } from '../e2e/harness/e2e-test-harness';

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
// 1. 70/30 INTEGER ROYALTY SPLIT: 10,000 RANDOM TRANSACTIONS & ZERO LEAKAGE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1 (R2): 70/30 Integer Royalty Split Mathematical Invariants', () => {
  it('fuzz tests 10,000 random transaction amounts ensuring creatorCut + platformCut === total with 0 balance leakage', () => {
    // Deterministic LCG pseudo-random generator
    let seed = 987654321;
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

      if (i < 100) {
        // Micro-transactions: $0.01 to $1.00 (1 to 100 cents)
        priceCents = (i % 100) + 1;
      } else if (i < 200) {
        // Large values: $1,000 to $100,000 ($100k = 10,000,000 cents)
        priceCents = 100_000 + Math.floor(lcg() * 9_900_000);
      } else if (i < 250) {
        // Pathological boundary amounts ($0.01, $100,000 exact, $1,000,000 exact)
        const boundaries = [1, 2, 3, 7, 10, 100, 1999, 10_000_000, 100_000_000];
        priceCents = boundaries[i % boundaries.length];
      } else {
        // Wide random spectrum: 1 cent to 100,000,000 cents ($1,000,000)
        priceCents = Math.floor(lcg() * 100_000_000) + 1;
      }

      const split = calculateTemplateRoyalty(priceCents, 70.0);

      // Invariant 1: Zero balance leakage (Exact equality: creatorCut + platformCut === total)
      if (split.creatorCents + split.platformCents !== priceCents) {
        totalDiscrepancies++;
      }

      // Invariant 2: Discrete integer cents (No float contamination)
      expect(Number.isInteger(split.creatorCents)).toBe(true);
      expect(Number.isInteger(split.platformCents)).toBe(true);

      // Invariant 3: Non-negative allocations
      expect(split.creatorCents).toBeGreaterThanOrEqual(0);
      expect(split.platformCents).toBeGreaterThanOrEqual(0);

      // Invariant 4: Exact mathematical floor formula
      const expectedCreator = Math.floor((priceCents * 70) / 100);
      expect(split.creatorCents).toBe(expectedCreator);
      expect(split.platformCents).toBe(priceCents - expectedCreator);

      totalCentsFuzzed += priceCents;
      totalCreatorCents += split.creatorCents;
      totalPlatformCents += split.platformCents;
    }

    // Zero balance leakage across all 10,000 transactions
    expect(totalDiscrepancies).toBe(0);
    expect(totalCreatorCents + totalPlatformCents).toBe(totalCentsFuzzed);
  });

  it('empirically verifies micro-transactions ($0.01 to $0.10) exact integer floor attribution', () => {
    // Verification of micro-transactions: 1 cent ($0.01) up to 10 cents ($0.10)
    const microTests = [
      { cents: 1, creator: 0, platform: 1 },  // floor(0.7) = 0, remainder 1
      { cents: 2, creator: 1, platform: 1 },  // floor(1.4) = 1, remainder 1
      { cents: 3, creator: 2, platform: 1 },  // floor(2.1) = 2, remainder 1
      { cents: 4, creator: 2, platform: 2 },  // floor(2.8) = 2, remainder 2
      { cents: 5, creator: 3, platform: 2 },  // floor(3.5) = 3, remainder 2
      { cents: 6, creator: 4, platform: 2 },  // floor(4.2) = 4, remainder 2
      { cents: 7, creator: 4, platform: 3 },  // floor(4.9) = 4, remainder 3
      { cents: 8, creator: 5, platform: 3 },  // floor(5.6) = 5, remainder 3
      { cents: 9, creator: 6, platform: 3 },  // floor(6.3) = 6, remainder 3
      { cents: 10, creator: 7, platform: 3 }, // floor(7.0) = 7, remainder 3
    ];

    for (const test of microTests) {
      const split = calculateTemplateRoyalty(test.cents, DEFAULT_TEMPLATE_ROYALTY_PCT);
      expect(split.creatorCents).toBe(test.creator);
      expect(split.platformCents).toBe(test.platform);
      expect(split.creatorCents + split.platformCents).toBe(test.cents);
    }
  });

  it('empirically tests large values ($100,000 to $1,000,000,000) for integer overflow immunity', () => {
    const largeAmounts = [
      10_000_000,        // $100,000.00
      50_000_000,        // $500,000.00
      100_000_000,       // $1,000,000.00
      1_000_000_000,     // $10,000,000.00
      100_000_000_000,   // $1,000,000,000.00 (within JS Number.MAX_SAFE_INTEGER: 9e15)
    ];

    for (const amount of largeAmounts) {
      const split = calculateTemplateRoyalty(amount, 70.0);
      expect(split.creatorCents + split.platformCents).toBe(amount);
      expect(split.creatorCents).toBe(Math.floor((amount * 70) / 100));
      expect(Number.isSafeInteger(split.creatorCents)).toBe(true);
      expect(Number.isSafeInteger(split.platformCents)).toBe(true);
    }
  });

  it('tests zero, negative, and extreme percentage boundaries', () => {
    // 0 cents
    const zeroRes = calculateTemplateRoyalty(0, 70.0);
    expect(zeroRes).toEqual({ creatorCents: 0, platformCents: 0 });

    // Negative amounts
    const negRes = calculateTemplateRoyalty(-5000, 70.0);
    expect(negRes).toEqual({ creatorCents: 0, platformCents: 0 });

    // 0% royalty: 100% to platform
    const zeroPct = calculateTemplateRoyalty(1000, 0.0);
    expect(zeroPct).toEqual({ creatorCents: 0, platformCents: 1000 });

    // Negative royalty: 100% to platform
    const negPct = calculateTemplateRoyalty(1000, -10.0);
    expect(negPct).toEqual({ creatorCents: 0, platformCents: 1000 });

    // 100% royalty: 100% to creator
    const fullPct = calculateTemplateRoyalty(1000, 100.0);
    expect(fullPct).toEqual({ creatorCents: 1000, platformCents: 0 });

    // >100% royalty clamped: 100% to creator
    const overPct = calculateTemplateRoyalty(1000, 120.0);
    expect(overPct).toEqual({ creatorCents: 1000, platformCents: 0 });
  });

  it('cross-verifies calculateMultiTierSplit 10,000 random transactions for 0 leakage', () => {
    let seed = 44556677;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 4294967296;
    };

    let totalDiscrepancies = 0;

    for (let i = 0; i < 10000; i++) {
      const revenueCents = Math.floor(lcg() * 50_000_000) + 1;
      const split = calculateMultiTierSplit(revenueCents, 70.0, 'root_cr', 'parent_cr');

      // Invariant: rootRoyalty + parentRoyalty === totalRoyaltyCents (zero leakage)
      if (split.rootRoyaltyCents + (split.parentRoyaltyCents ?? 0) !== split.totalRoyaltyCents) {
        totalDiscrepancies++;
      }

      expect(Number.isInteger(split.rootRoyaltyCents)).toBe(true);
      expect(Number.isInteger(split.parentRoyaltyCents ?? 0)).toBe(true);
    }

    expect(totalDiscrepancies).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. OCC CAS MONOTONIC LEDGER UNDER CONCURRENCY & ZERO LOST UPDATES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1 (R2): OCC CAS Monotonic Ledger Concurrency Stress-Testing', () => {
  let db: D1Database & { raw: DatabaseSync };

  beforeEach(() => {
    db = createCanonicalD1();
  });

  it('handles simulated 15-way concurrent transactions on the same creator with strictly monotonic sequence and zero lost updates', async () => {
    const creatorId = 'cr_concurrent_stress_15';
    const numWorkers = 15;
    const amountPerTx = 250; // $2.50 per transaction

    // Launch 15 concurrent promises simultaneously
    const tasks = Array.from({ length: numWorkers }, (_, idx) => {
      return accrueCreatorLedgerEntryCAS(
        db,
        {
          creatorId,
          amountCents: amountPerTx,
          referenceId: `ref_conc_tx_${idx}`,
          eventType: 'royalty_accrual',
          sourceType: 'template_activation',
        },
        12, // Sufficient retries for 15-way contention
      );
    });

    const results = await Promise.all(tasks);

    // 1. Every single concurrent transaction must succeed
    for (let i = 0; i < numWorkers; i++) {
      expect(results[i].success).toBe(true);
      expect(results[i].error).toBeUndefined();
    }

    // 2. Query ledger rows from database to verify persistence
    const rows = await db
      .prepare(
        `SELECT id, sequence_num, amount_cents, balance_after_cents 
         FROM creator_earnings_ledger 
         WHERE creator_id = ? 
         ORDER BY sequence_num ASC`,
      )
      .bind(creatorId)
      .all<{
        id: string;
        sequence_num: number;
        amount_cents: number;
        balance_after_cents: number;
      }>();

    expect(rows.results.length).toBe(numWorkers);

    // 3. Monotonic sequencing: sequence numbers must be exactly [1, 2, ..., 15] with zero duplicates or gaps
    const sequences = rows.results.map((r) => r.sequence_num);
    const expectedSequences = Array.from({ length: numWorkers }, (_, i) => i + 1);
    expect(sequences).toEqual(expectedSequences);
    expect(new Set(sequences).size).toBe(numWorkers);

    // 4. Zero lost updates: final balance must equal exactly 15 * 250 = 3750 cents ($37.50)
    const expectedFinalBalance = numWorkers * amountPerTx;
    const finalRow = rows.results[rows.results.length - 1];
    expect(finalRow.balance_after_cents).toBe(expectedFinalBalance);

    // 5. Monotonic balance check: every row balance_after_cents must equal previous + amount
    let runningBalance = 0;
    for (const row of rows.results) {
      runningBalance += row.amount_cents;
      expect(row.balance_after_cents).toBe(runningBalance);
    }
  });

  it('guarantees sequential idempotent deduplication on duplicate referenceId', async () => {
    const creatorId = 'cr_seq_idempotent';
    const referenceId = 'ref_seq_duplicate_uuid';
    const amountCents = 1500;

    // First call inserts the ledger entry
    const res1 = await accrueCreatorLedgerEntryCAS(
      db,
      {
        creatorId,
        amountCents,
        referenceId,
        eventType: 'royalty_accrual',
      },
      8,
    );

    expect(res1.success).toBe(true);
    expect(res1.sequenceNum).toBe(1);
    expect(res1.newBalanceCents).toBe(amountCents);

    // Second sequential call with the exact same referenceId hits step 1 deduplication probe
    const res2 = await accrueCreatorLedgerEntryCAS(
      db,
      {
        creatorId,
        amountCents,
        referenceId,
        eventType: 'royalty_accrual',
      },
      8,
    );

    expect(res2.success).toBe(true);
    expect(res2.ledgerId).toBe(res1.ledgerId);
    expect(res2.sequenceNum).toBe(res1.sequenceNum);
    expect(res2.newBalanceCents).toBe(res1.newBalanceCents);

    // Verify exactly ONE physical row exists in database (0 balance inflation)
    const countRow = await db
      .prepare(`SELECT count(*) as count FROM creator_earnings_ledger WHERE creator_id = ?`)
      .bind(creatorId)
      .first<{ count: number }>();

    expect(countRow?.count).toBe(1);
  });

  it('empirically reveals concurrent deduplication race behavior (missing re-probe in CAS retry loop)', async () => {
    const creatorId = 'cr_concurrent_dedup_race';
    const sharedReferenceId = 'ref_concurrent_duplicate_uuid';
    const amountCents = 1500;
    const concurrency = 4;

    // 4 concurrent requests fire simultaneously before any row is committed
    const tasks = Array.from({ length: concurrency }, () => {
      return accrueCreatorLedgerEntryCAS(
        db,
        {
          creatorId,
          amountCents,
          referenceId: sharedReferenceId,
          eventType: 'royalty_accrual',
        },
        3, // Limit retries to prevent test latency
      );
    });

    const results = await Promise.all(tasks);

    // Exactly one request wins the race and commits the entry
    const successful = results.filter((r) => r.success);
    expect(successful.length).toBeGreaterThanOrEqual(1);

    // The database integrity is preserved: exactly 1 physical row committed (0 balance leakage)
    const countRow = await db
      .prepare(`SELECT count(*) as count FROM creator_earnings_ledger WHERE reference_id = ?`)
      .bind(sharedReferenceId)
      .first<{ count: number }>();
    expect(countRow?.count).toBe(1);

    // Empirical finding: Siblings that lose the initial INSERT race do not re-probe the
    // deduplication index inside the CAS loop; they repeatedly retry INSERT and fail on UNIQUE constraint
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      expect(failed[0].error).toMatch(/UNIQUE constraint failed/i);
    }
  });

  it('isolates sequence numbers and balances across multiple concurrent creators', async () => {
    const creators = ['cr_alpha', 'cr_beta', 'cr_gamma', 'cr_delta', 'cr_epsilon'];
    const txPerCreator = 5;

    // 5 creators x 5 transactions = 25 total concurrent tasks
    const tasks: Promise<unknown>[] = [];
    for (const cr of creators) {
      for (let i = 0; i < txPerCreator; i++) {
        tasks.push(
          accrueCreatorLedgerEntryCAS(
            db,
            {
              creatorId: cr,
              amountCents: 100,
              referenceId: `ref_${cr}_${i}`,
              eventType: 'royalty_accrual',
            },
            10,
          ),
        );
      }
    }

    await Promise.all(tasks);

    // Verify each creator has sequence [1, 2, 3, 4, 5] and balance 500
    for (const cr of creators) {
      const rows = await db
        .prepare(
          `SELECT sequence_num, balance_after_cents 
           FROM creator_earnings_ledger 
           WHERE creator_id = ? 
           ORDER BY sequence_num ASC`,
        )
        .bind(cr)
        .all<{ sequence_num: number; balance_after_cents: number }>();

      expect(rows.results.length).toBe(txPerCreator);
      expect(rows.results.map((r) => r.sequence_num)).toEqual([1, 2, 3, 4, 5]);
      expect(rows.results[txPerCreator - 1].balance_after_cents).toBe(500);
    }
  });

  it('tests end-to-end template activation with OCC CAS concurrency', async () => {
    const creatorId = 'cr_tpl_e2e';
    const templateId = 'tpl_e2e_stress';

    // Insert template
    await db
      .prepare(
        `INSERT INTO creator_templates (id, creator_id, slug, title, niche, script_template, storyboard_json, visual_style_prompt, price_cents, royalty_pct, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        templateId,
        creatorId,
        'tpl-e2e-stress',
        'Viral Hook Template',
        'marketing',
        'Script',
        '{}',
        'cinematic',
        2000, // $20.00
        70.0,
        'approved',
        Date.now(),
        Date.now(),
      )
      .run();

    // 8 concurrent activations by 8 distinct users
    const activationTasks = Array.from({ length: 8 }, (_, idx) => {
      return activateTemplateWithRoyaltyCAS(
        db,
        {
          templateId,
          creatorId,
          activatingUserId: `user_buyer_${idx}`,
          priceCents: 2000,
        },
      );
    });

    const results = await Promise.all(activationTasks);

    for (const res of results) {
      expect(res.success).toBe(true);
      expect(res.creatorCents).toBe(1400); // 70% of 2000
      expect(res.platformCents).toBe(600);  // 30% of 2000
    }

    // Verify use_count reached 8
    const tplRow = await db
      .prepare(`SELECT use_count FROM creator_templates WHERE id = ?`)
      .bind(templateId)
      .first<{ use_count: number }>();
    expect(tplRow?.use_count).toBe(8);

    // Verify total ledger balance = 8 * 1400 = 11200 cents
    const ledgerRows = await db
      .prepare(`SELECT balance_after_cents FROM creator_earnings_ledger WHERE creator_id = ? ORDER BY sequence_num DESC LIMIT 1`)
      .bind(creatorId)
      .first<{ balance_after_cents: number }>();
    expect(ledgerRows?.balance_after_cents).toBe(11200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CIRCULAR LINEAGE GRAPH TRAVERSAL: DEEP TREES, SELF-REMIX & CYCLES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1 (R2): Circular Lineage Traversal Stress-Testing', () => {
  let db: D1Database & { raw: DatabaseSync };

  beforeEach(() => {
    db = createCanonicalD1();
  });

  it('rejects direct 1-hop self-remix (creator tries to remix own template)', async () => {
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_direct', 'alice_user', null, 'Direct Template', Date.now())
      .run();

    const isCircular = await isCircularAncestorRemix(db, 'bp_direct', 'alice_user');
    expect(isCircular).toBe(true);

    // Self-activation pure function
    expect(isSelfTemplateActivation('alice_user', 'alice_user')).toBe(true);
    expect(isSelfTemplateActivation('  alice_user  ', 'alice_user')).toBe(true);
    expect(isSelfTemplateActivation('alice_user', 'bob_user')).toBe(false);
  });

  it('detects cyclic remix parent loops (1-cycle, 2-cycle, and N-cycle) without infinite loop or hanging', async () => {
    // 1-Cycle: A -> A
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_cycle_1', 'creator_1', 'bp_cycle_1', 'Self Cycle', Date.now())
      .run();

    const is1Cycle = await isCircularAncestorRemix(db, 'bp_cycle_1', 'innocent_user');
    expect(is1Cycle).toBe(true);

    // 2-Cycle: A -> B -> A
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_loop_a', 'user_a', 'bp_loop_b', 'Loop A', Date.now())
      .run();
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_loop_b', 'user_b', 'bp_loop_a', 'Loop B', Date.now())
      .run();

    const is2Cycle = await isCircularAncestorRemix(db, 'bp_loop_a', 'innocent_user');
    expect(is2Cycle).toBe(true);

    // 4-Cycle: A -> B -> C -> D -> B (sub-cycle within ancestors)
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_c1', 'u1', 'bp_c2', 'C1', Date.now())
      .run();
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_c2', 'u2', 'bp_c3', 'C2', Date.now())
      .run();
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_c3', 'u3', 'bp_c4', 'C3', Date.now())
      .run();
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_c4', 'u4', 'bp_c2', 'C4 cycles to C2', Date.now())
      .run();

    const isSubCycle = await isCircularAncestorRemix(db, 'bp_c1', 'innocent_user');
    expect(isSubCycle).toBe(true);
  });

  it('traverses deep trees (50 and 500 hops) iteratively without stack overflow', async () => {
    // Construct 50-node linear lineage chain
    for (let i = 0; i < 50; i++) {
      const parentId = i === 0 ? null : `bp_deep_${i - 1}`;
      await db
        .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(`bp_deep_${i}`, `creator_node_${i}`, parentId, `Deep Node ${i}`, Date.now())
        .run();
    }

    // Default maxDepth = 10:
    // Searching for creator_node_49 (leaf node): matches immediately at depth 0
    expect(await isCircularAncestorRemix(db, 'bp_deep_49', 'creator_node_49')).toBe(true);

    // Searching for creator_node_42 (7 hops back): within maxDepth 10 -> detected
    expect(await isCircularAncestorRemix(db, 'bp_deep_49', 'creator_node_42')).toBe(true);

    // Searching for creator_node_10 (39 hops back): beyond default maxDepth 10 -> stops without hanging
    expect(await isCircularAncestorRemix(db, 'bp_deep_49', 'creator_node_10')).toBe(false);

    // Expanding maxDepth to 100: detects creator_node_10
    expect(await isCircularAncestorRemix(db, 'bp_deep_49', 'creator_node_10', 100)).toBe(true);

    // Massive 500-hop tree stress test: ensure 0 stack overflow
    for (let i = 50; i < 500; i++) {
      const parentId = `bp_deep_${i - 1}`;
      await db
        .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(`bp_deep_${i}`, `creator_node_${i}`, parentId, `Deep Node ${i}`, Date.now())
        .run();
    }

    // Traversal at depth 500 finishes in milliseconds without memory exhaustion or stack overflow
    const startTime = performance.now();
    const result = await isCircularAncestorRemix(db, 'bp_deep_499', 'creator_node_0', 550);
    const duration = performance.now() - startTime;

    expect(result).toBe(true);
    expect(duration).toBeLessThan(500); // Must execute within 500ms
  });

  it('blocks circular remix via recordBlueprintRemixAndAccrueRoyalty', async () => {
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_root', 'cr_alice', null, 'Root Blueprint', Date.now())
      .run();

    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_child', 'cr_bob', 'bp_root', 'Child Blueprint', Date.now())
      .run();

    // Alice tries to remix Bob's child blueprint (Alice is root creator of the blueprint lineage)
    const result = await recordBlueprintRemixAndAccrueRoyalty(db, {
      blueprintId: 'bp_child',
      parentCreatorId: 'cr_bob',
      remixerUserId: 'cr_alice',
      missionId: 'ms_001',
      revenueCents: 5000,
      royaltyPercent: 70,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. HMAC SIGNED URLS: 24H EXPIRATION, TAMPERING & CONSTANT-TIME VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1 (R2): HMAC Signed URLs Cryptographic Security', () => {
  const secret = 'super-secret-hmac-key-256-edge-safe';
  const videoId = 'vid_enterprise_4k_dubbed';
  const userId = 'usr_vip_apac_01';

  it('enforces exact 24-hour (86,400s) expiration boundary', async () => {
    const fixedNowMs = 1758760000000;
    const nowSec = Math.floor(fixedNowMs / 1000);

    const token = await createSignedDownloadToken({
      videoId,
      userId,
      ttlSeconds: 86400,
      secret,
    });

    // 1. Nominal immediate verification: valid = true, expired = false
    const resNow = await verifySignedDownloadToken({ token, videoId, secret });
    expect(resNow.valid).toBe(true);
    expect(resNow.expired).toBe(false);
    expect(resNow.payload?.videoId).toBe(videoId);
    expect(resNow.payload?.expiresAt).toBe(resNow.payload!.issuedAt + 86400);

    // 2. Token created with ttl = -1 (already expired 1 second in the past)
    const expiredToken = await createSignedDownloadToken({
      videoId,
      userId,
      ttlSeconds: -1,
      secret,
    });

    const resExpired = await verifySignedDownloadToken({ token: expiredToken, videoId, secret });
    expect(resExpired.valid).toBe(false);
    expect(resExpired.expired).toBe(true);
    expect(resExpired.payload).toBeDefined();

    // 3. Token created with ttl = -86400 (expired 24 hours in the past)
    const expired24hToken = await createSignedDownloadToken({
      videoId,
      userId,
      ttlSeconds: -86400,
      secret,
    });

    const resExpired24h = await verifySignedDownloadToken({ token: expired24hToken, videoId, secret });
    expect(resExpired24h.valid).toBe(false);
    expect(resExpired24h.expired).toBe(true);
  });

  it('rejects signature tampering across all 64 hexadecimal characters', async () => {
    const token = await createSignedDownloadToken({ videoId, userId, ttlSeconds: 86400, secret });
    const dotIdx = token.lastIndexOf('.');
    const payloadB64 = token.substring(0, dotIdx);
    const signatureHex = token.substring(dotIdx + 1);

    expect(signatureHex.length).toBe(64);

    // Flip every single hex character [0..63] individually
    for (let pos = 0; pos < 64; pos++) {
      const origChar = signatureHex[pos];
      // Flip character: if 'a' then 'b', else 'a'
      const flippedChar = origChar === 'a' ? 'b' : 'a';
      const tamperedSig = signatureHex.substring(0, pos) + flippedChar + signatureHex.substring(pos + 1);
      const tamperedToken = `${payloadB64}.${tamperedSig}`;

      const res = await verifySignedDownloadToken({ token: tamperedToken, videoId, secret });
      expect(res.valid).toBe(false);
      expect(res.expired).toBe(false);
    }

    // Truncated signature (63 chars)
    const truncatedToken = `${payloadB64}.${signatureHex.slice(0, 63)}`;
    expect((await verifySignedDownloadToken({ token: truncatedToken, videoId, secret })).valid).toBe(false);

    // Appended signature (65 chars)
    const extendedToken = `${payloadB64}.${signatureHex}ff`;
    expect((await verifySignedDownloadToken({ token: extendedToken, videoId, secret })).valid).toBe(false);

    // Wrong secret verification
    const wrongSecretRes = await verifySignedDownloadToken({ token, videoId, secret: 'wrong-attacker-key' });
    expect(wrongSecretRes.valid).toBe(false);
  });

  it('rejects payload tampering and cross-video token replay attacks', async () => {
    const token = await createSignedDownloadToken({ videoId, userId, ttlSeconds: 86400, secret });
    const dotIdx = token.lastIndexOf('.');
    const payloadB64 = token.substring(0, dotIdx);
    const signatureHex = token.substring(dotIdx + 1);

    // Decode valid payload
    const payload = JSON.parse(base64UrlToString(payloadB64));

    // Tamper 1: Attacker changes videoId to access expensive video
    payload.videoId = 'vid_confidential_unreleased_movie';
    const tamperedPayloadB64 = stringToBase64Url(JSON.stringify(payload));
    const tamperedToken = `${tamperedPayloadB64}.${signatureHex}`;

    const resTampered = await verifySignedDownloadToken({ token: tamperedToken, videoId: 'vid_confidential_unreleased_movie', secret });
    expect(resTampered.valid).toBe(false);

    // Tamper 2: Attacker extends expiresAt by 1 year
    payload.videoId = videoId;
    payload.expiresAt = payload.expiresAt + 365 * 86400;
    const extendedPayloadB64 = stringToBase64Url(JSON.stringify(payload));
    const extendedToken = `${extendedPayloadB64}.${signatureHex}`;

    const resExtended = await verifySignedDownloadToken({ token: extendedToken, videoId, secret });
    expect(resExtended.valid).toBe(false);

    // Tamper 3: Cross-video replay (Valid token for videoId A presented for videoId B)
    const replayRes = await verifySignedDownloadToken({ token, videoId: 'vid_other_video_replay', secret });
    expect(replayRes.valid).toBe(false);
  });

  it('empirically verifies constant-time string comparison (timingSafeEqual)', () => {
    // 1. Equal strings of various lengths
    expect(timingSafeEqual('a', 'a')).toBe(true);
    expect(timingSafeEqual('abcdef1234567890', 'abcdef1234567890')).toBe(true);
    expect(timingSafeEqual('a'.repeat(64), 'a'.repeat(64))).toBe(true);

    // 2. Mismatched strings (different character at start, middle, end)
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

    // Time difference must be within tight bound (both execute the entire loop without early exit)
    expect(Math.abs(tHead - tTail)).toBeLessThan(50); // Difference under 50ms over 50,000 iterations
  });

  it('gracefully handles malformed tokens and illegal inputs without throwing', async () => {
    const malformedCases = [
      '',
      'no-dots-in-this-token',
      'too.many.dots.in.this.token.signature',
      '.leadingdot',
      'trailingdot.',
      'notbase64.validhexsignature',
      'dGVzdA.invalidhex!@#$',
    ];

    for (const malformed of malformedCases) {
      const res = await verifySignedDownloadToken({ token: malformed, videoId, secret });
      expect(res.valid).toBe(false);
      expect(res.expired).toBe(false);
    }
  });
});
