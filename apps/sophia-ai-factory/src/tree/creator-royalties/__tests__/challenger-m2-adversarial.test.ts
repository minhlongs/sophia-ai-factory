/**
 * Milestone M2 Adversarial Stress Test Suite:
 * Creator Marketplace & Video Blueprint Royalty Attribution, Lineage & OCC CAS Ledger
 *
 * @vitest-environment node
 *
 * Empirical challenger validation of:
 * 1. Exact integer cent truncation math (\lfloor (R \times P) / 100 \rfloor, boundary $0, 0%, 100%, negative, fuzzing)
 * 2. Deep multi-tier lineage splits (70/30 split, root + parent === totalPool across 1,000 randomized revenue values, zero leakage)
 * 3. Circular and self-remix attack vectors (remixer_id === creator_id, indirect cycles A -> B -> A)
 * 4. High-concurrency OCC CAS stress (10 concurrent workers, monotonic sequence_num progression, zero dropped earnings)
 *
 * Layer: tree
 */

import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  calculateRoyaltyCents,
  calculateMultiTierSplit,
  recordBlueprintRemixAndAccrueRoyalty,
  accrueCreatorLedgerEntryCAS,
} from '../attribution';
import type { BlueprintRemixInput } from '@/seed/types/creator-marketplace';

/**
 * Creates a real SQLite database mirroring D1, with optional unique sequence constraint.
 */
function createSqliteD1(options?: { withUniqueSeq?: boolean }) {
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

    CREATE INDEX IF NOT EXISTS idx_creator_ledger_creator 
      ON creator_earnings_ledger(creator_id, created_at DESC, sequence_num DESC);
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

describe('Challenger M2: Empirical Adversarial Stress & Verification Harness', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 1: Exact Integer Cent Truncation Math
  // ══════════════════════════════════════════════════════════════════════════
  describe('1. Exact Integer Cent Truncation Math', () => {
    it('1.1 verifies floor truncation: $9.99 at 10% = 99 cents', () => {
      // 999 * 10 / 100 = 99.9 -> floor = 99 cents
      expect(calculateRoyaltyCents(999, 10)).toBe(99);
      // 2550 * 20 / 100 = 510.0 -> 510 cents
      expect(calculateRoyaltyCents(2550, 20)).toBe(510);
      // 1999 * 15 / 100 = 299.85 -> floor = 299 cents
      expect(calculateRoyaltyCents(1999, 15)).toBe(299);
      // 99 cents at 10% = 9.9 -> 9 cents
      expect(calculateRoyaltyCents(99, 10)).toBe(9);
    });

    it('1.2 boundary: $0 revenue yields exactly 0 cents regardless of royalty rate', () => {
      expect(calculateRoyaltyCents(0, 0)).toBe(0);
      expect(calculateRoyaltyCents(0, 10)).toBe(0);
      expect(calculateRoyaltyCents(0, 50)).toBe(0);
      expect(calculateRoyaltyCents(0, 100)).toBe(0);
    });

    it('1.3 boundary: 0% royalty yields 0 cents across arbitrary revenue', () => {
      expect(calculateRoyaltyCents(1, 0)).toBe(0);
      expect(calculateRoyaltyCents(999, 0)).toBe(0);
      expect(calculateRoyaltyCents(100000, 0)).toBe(0);
      expect(calculateRoyaltyCents(10000000, 0)).toBe(0);
    });

    it('1.4 boundary: 100% royalty yields exact revenueCents without loss', () => {
      expect(calculateRoyaltyCents(1, 100)).toBe(1);
      expect(calculateRoyaltyCents(999, 100)).toBe(999);
      expect(calculateRoyaltyCents(1234567, 100)).toBe(1234567);
    });

    it('1.5 sub-cent truncation boundaries (<10 cents at 10% round down to 0)', () => {
      // 1 cent * 10% = 0.1 -> 0
      expect(calculateRoyaltyCents(1, 10)).toBe(0);
      // 9 cents * 10% = 0.9 -> 0
      expect(calculateRoyaltyCents(9, 10)).toBe(0);
      // 10 cents * 10% = 1.0 -> 1
      expect(calculateRoyaltyCents(10, 10)).toBe(1);
    });

    it('1.6 guards against negative revenue and negative royalty rates', () => {
      expect(calculateRoyaltyCents(-100, 10)).toBe(0);
      expect(calculateRoyaltyCents(500, -5)).toBe(0);
      expect(calculateRoyaltyCents(-500, -10)).toBe(0);
    });

    it('1.7 Monte Carlo fuzzing: 10,000 randomized tuples strictly conform to floor((R * P)/100)', () => {
      let seed = 987654321;
      function rng(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let i = 0; i < 10000; i++) {
        const rev = Math.floor(rng() * 100000); // 0 to $1,000.00
        const pct = Math.round(rng() * 10000) / 100; // 0.00% to 100.00%

        const actual = calculateRoyaltyCents(rev, pct);
        const expected = rev <= 0 || pct <= 0 ? 0 : pct >= 100 ? rev : Math.floor((rev * pct) / 100);

        expect(actual).toBe(expected);
        expect(Number.isInteger(actual)).toBe(true);
        expect(actual).toBeGreaterThanOrEqual(0);
        expect(actual).toBeLessThanOrEqual(rev);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 2: Deep Multi-Tier Lineage Splits (70/30) & Conservation Invariant
  // ══════════════════════════════════════════════════════════════════════════
  describe('2. Deep Multi-Tier Lineage Splits (70/30) & Conservation Invariant', () => {
    it('2.1 allocates 70% to root creator and 30% to direct parent remixer', () => {
      const split = calculateMultiTierSplit(10000, 10, 'creator_root', 'creator_parent');
      expect(split.totalRoyaltyCents).toBe(1000);
      expect(split.rootRoyaltyCents).toBe(700);
      expect(split.parentRoyaltyCents).toBe(300);
      expect(split.rootRoyaltyCents + split.parentRoyaltyCents!).toBe(split.totalRoyaltyCents);
    });

    it('2.2 single-tier and self-parenting collapse to 100% root share without parent allocation', () => {
      const single = calculateMultiTierSplit(5000, 10, 'creator_alice');
      expect(single.totalRoyaltyCents).toBe(500);
      expect(single.rootRoyaltyCents).toBe(500);
      expect(single.parentCreatorId).toBeUndefined();
      expect(single.parentRoyaltyCents).toBeUndefined();

      const selfParent = calculateMultiTierSplit(5000, 10, 'creator_alice', 'creator_alice');
      expect(selfParent.totalRoyaltyCents).toBe(500);
      expect(selfParent.rootRoyaltyCents).toBe(500);
      expect(selfParent.parentRoyaltyCents).toBeUndefined();
    });

    it('2.3 remainder cent invariant: odd fractional penny remainder always goes to root creator', () => {
      // Total pool = 101 cents
      // 30% of 101 = 30.3 -> parent = 30 cents
      // root = 101 - 30 = 71 cents (gets remainder penny 0.3)
      const split = calculateMultiTierSplit(1010, 10, 'root', 'parent');
      expect(split.totalRoyaltyCents).toBe(101);
      expect(split.parentRoyaltyCents).toBe(30);
      expect(split.rootRoyaltyCents).toBe(71);
      expect(split.rootRoyaltyCents + split.parentRoyaltyCents!).toBe(101);
    });

    it('2.4 zero cent leakage: Root + Parent === TotalPool across 1,000 randomized revenue values', () => {
      let seed = 456789123;
      function rng(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      let leakageCount = 0;
      for (let i = 0; i < 1000; i++) {
        const revenueCents = Math.floor(rng() * 10000000) + 1; // 1 cent to $100,000
        const royaltyPercent = Math.round((rng() * 99 + 1) * 100) / 100; // 1.00% to 100.00%

        const split = calculateMultiTierSplit(revenueCents, royaltyPercent, 'root_creator', 'parent_remixer');
        const sum = split.rootRoyaltyCents + (split.parentRoyaltyCents ?? 0);

        if (sum !== split.totalRoyaltyCents) {
          leakageCount++;
        }

        expect(sum).toBe(split.totalRoyaltyCents);
        expect(split.rootRoyaltyCents).toBeGreaterThanOrEqual(0);
        expect(split.parentRoyaltyCents ?? 0).toBeGreaterThanOrEqual(0);
      }

      expect(leakageCount).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 3: Circular & Self-Remix Attack Vectors
  // ══════════════════════════════════════════════════════════════════════════
  describe('3. Circular and Self-Remix Attack Vectors', () => {
    it('3.1 blocks direct self-remix (remixerUserId === parentCreatorId) with CIRCULAR_SELF_REMIX_DENIED', async () => {
      const db = createSqliteD1();
      const remix: BlueprintRemixInput = {
        blueprintId: 'bp_self_1',
        parentCreatorId: 'user_attacker',
        remixerUserId: 'user_attacker',
        missionId: 'mis_self_1',
        revenueCents: 10000,
        royaltyPercent: 10,
      };

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, remix);

      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(res.royaltyCents).toBe(0);

      // Verify zero rows in blueprint_remixes
      const remixes = db.raw.prepare('SELECT count(*) as count FROM blueprint_remixes').get() as { count: number };
      expect(remixes.count).toBe(0);

      // Verify zero rows in creator_earnings_ledger
      const ledger = db.raw.prepare('SELECT count(*) as count FROM creator_earnings_ledger').get() as { count: number };
      expect(ledger.count).toBe(0);
    });

    it('3.2 rejects out-of-range royalty percentages (<0 or >100)', async () => {
      const db = createSqliteD1();
      const resNeg = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_neg',
        parentCreatorId: 'creator_alice',
        remixerUserId: 'user_bob',
        missionId: 'mis_neg',
        revenueCents: 5000,
        royaltyPercent: -1,
      });
      expect(resNeg.success).toBe(false);
      expect(resNeg.error).toBe('INVALID_ROYALTY_PERCENT');

      const resOver = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_over',
        parentCreatorId: 'creator_alice',
        remixerUserId: 'user_bob',
        missionId: 'mis_over',
        revenueCents: 5000,
        royaltyPercent: 101,
      });
      expect(resOver.success).toBe(false);
      expect(resOver.error).toBe('INVALID_ROYALTY_PERCENT');
    });

    it('3.3 tests indirect cycles: multi-hop derivative where remixer is root creator (A -> B -> A)', async () => {
      const db = createSqliteD1();

      // Seed Root Blueprint created by Alice
      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, royalty_pct)
        VALUES ('bp_root_alice', 'alice', NULL, 'Alice Root Blueprint', 10.0)
      `).run();

      // Bob remixes Alice's root blueprint into a derivative blueprint
      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, royalty_pct)
        VALUES ('bp_deriv_bob', 'bob', 'bp_root_alice', 'Bob Derivative Blueprint', 10.0)
      `).run();

      // Now Alice attempts to remix Bob's derivative (which originated from Alice!)
      // Input: parentCreatorId = 'bob', remixerUserId = 'alice'
      const indirectRemix: BlueprintRemixInput = {
        blueprintId: 'bp_deriv_bob',
        parentCreatorId: 'bob',
        remixerUserId: 'alice',
        missionId: 'mis_alice_indirect',
        revenueCents: 10000,
        royaltyPercent: 10,
      };

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, indirectRemix);

      process.stderr.write(
        `\n=== 3.3 Indirect Cycle Verification (A -> B -> A) ===\n` +
        `Remixer: ${indirectRemix.remixerUserId}, Parent Creator: ${indirectRemix.parentCreatorId}\n` +
        `Result success: ${res.success}, Error: ${res.error ?? 'none'}\n` +
        `Royalty cents accrued to Bob: ${res.royaltyCents}\n` +
        `Cycle prevention status: ${res.error === 'CIRCULAR_SELF_REMIX_DENIED' ? 'REJECTED' : 'PERMITTED_TO_PARENT'}\n` +
        `======================================================\n`
      );

      // Rejects multi-hop circular self-remix (Alice is root creator of bp_deriv_bob)
      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(res.royaltyCents).toBe(0);
      expect(res.creatorId).toBe('bob');

      // Verify zero rows in blueprint_remixes
      const remixes = db.raw
        .prepare("SELECT count(*) as count FROM blueprint_remixes WHERE blueprint_id = 'bp_deriv_bob'")
        .get() as { count: number };
      expect(remixes.count).toBe(0);

      // Verify zero rows in creator_earnings_ledger
      const ledger = db.raw
        .prepare("SELECT count(*) as count FROM creator_earnings_ledger WHERE reference_id LIKE 'rem_%'")
        .get() as { count: number };
      expect(ledger.count).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 4: High-Concurrency OCC CAS Ledger Stress
  // ══════════════════════════════════════════════════════════════════════════
  describe('4. High-Concurrency OCC CAS Stress (10 Concurrent Workers)', () => {
    it('4.1 verifies Migration 0275 schema natively achieves monotonic sequence_num and zero dropped earnings under 10 concurrent workers', async () => {
      // Schema WITH UNIQUE(creator_id, sequence_num) [natively enforced by 0275 migration]
      const db = createSqliteD1();
      const creatorId = 'creator_high_concurrency';
      const workerCount = 10;
      const amountPerWorker = 100; // 100 cents each = $1.00 each

      const workers = Array.from({ length: workerCount }, (_, i) =>
        accrueCreatorLedgerEntryCAS(
          db,
          {
            creatorId,
            amountCents: amountPerWorker,
            currency: 'USD',
            eventType: 'royalty_accrual',
            sourceType: 'blueprint_remix',
            referenceId: `ref_w_${i}`,
            status: 'pending',
          },
          8,
          1000 + i,
        ),
      );

      const results = await Promise.all(workers);

      const rows = db.raw
        .prepare(
          'SELECT id, sequence_num, amount_cents, balance_after_cents FROM creator_earnings_ledger WHERE creator_id = ? ORDER BY sequence_num ASC, id ASC',
        )
        .all(creatorId) as Array<{
          id: string;
          sequence_num: number;
          amount_cents: number;
          balance_after_cents: number;
        }>;

      const distinctSeqs = new Set(rows.map((r) => r.sequence_num));
      const successfulCalls = results.filter((r) => r.success).length;
      const finalRow = rows[rows.length - 1];

      process.stderr.write(
        `\n=== 4.1 Concurrency on Hardened 0275 Schema ===\n` +
        `Total workers: ${workerCount}\n` +
        `Successful calls: ${successfulCalls}\n` +
        `Rows inserted: ${rows.length}\n` +
        `Sequence numbers: [${rows.map((r) => r.sequence_num).join(', ')}]\n` +
        `Distinct sequence_num count: ${distinctSeqs.size}\n` +
        `Balance snapshots: [${rows.map((r) => r.balance_after_cents).join(', ')}]\n` +
        `Collision conflict triggered: ${distinctSeqs.size === workerCount ? 'YES (Resolved by OCC CAS backoff)' : 'NO'}\n` +
        `===============================================\n`
      );

      // Verify all workers completed
      expect(successfulCalls).toBe(workerCount);
      expect(rows).toHaveLength(workerCount);
      // Strictly monotonic sequence_num progression: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      expect(distinctSeqs.size).toBe(workerCount);
      expect(rows.map((r) => r.sequence_num)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      // Zero dropped earnings: cumulative balance accumulates to 1,000 cents
      expect(finalRow?.balance_after_cents).toBe(workerCount * amountPerWorker);
    });

    it('4.2 [CAS PROTECTION] verifies monotonic sequence_num and zero dropped earnings when UNIQUE(creator_id, sequence_num) is enforced', async () => {
      // Schema WITH UNIQUE(creator_id, sequence_num)
      const db = createSqliteD1({ withUniqueSeq: true });
      const creatorId = 'creator_protected_occ';
      const workerCount = 10;
      const amountPerWorker = 100;

      const workers = Array.from({ length: workerCount }, (_, i) =>
        accrueCreatorLedgerEntryCAS(
          db,
          {
            creatorId,
            amountCents: amountPerWorker,
            currency: 'USD',
            eventType: 'royalty_accrual',
            sourceType: 'blueprint_remix',
            referenceId: `ref_cas_${i}`,
            status: 'pending',
          },
          8, // 8 retries provide sufficient budget for 10-worker collision backoff
          1000 + i,
        ),
      );

      const results = await Promise.all(workers);

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

      process.stderr.write(
        `\n=== 4.2 Concurrency with Unique Sequence Constraint ===\n` +
        `Total workers: ${workerCount}\n` +
        `Successful calls: ${successfulCalls}\n` +
        `Rows inserted: ${rows.length}\n` +
        `Sequence numbers: [${rows.map((r) => r.sequence_num).join(', ')}]\n` +
        `Distinct sequence_num count: ${distinctSeqs.size}\n` +
        `Balance snapshots: [${rows.map((r) => r.balance_after_cents).join(', ')}]\n` +
        `Final balance snapshot: ${finalRow?.balance_after_cents} cents (Expected: ${workerCount * amountPerWorker})\n` +
        `Monotonic progression verified: ${distinctSeqs.size === workerCount}\n` +
        `Zero dropped earnings: ${finalRow?.balance_after_cents === workerCount * amountPerWorker}\n` +
        `=======================================================\n`
      );

      // Invariants with CAS constraint:
      // 1. All 10 workers succeed
      expect(successfulCalls).toBe(workerCount);
      // 2. Exactly 10 rows inserted
      expect(rows).toHaveLength(workerCount);
      // 3. Strictly monotonic sequence_num progression: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      expect(distinctSeqs.size).toBe(workerCount);
      expect(rows.map((r) => r.sequence_num)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      // 4. Zero dropped earnings: cumulative balance accumulates to 1,000 cents
      expect(finalRow?.balance_after_cents).toBe(workerCount * amountPerWorker);
    });

    it('4.3 verifies idempotency: repeated accrual with same reference_id returns existing ledger row', async () => {
      const db = createSqliteD1({ withUniqueSeq: true });
      const creatorId = 'creator_idempotency';

      const entry = {
        creatorId,
        amountCents: 500,
        currency: 'USD',
        eventType: 'royalty_accrual' as const,
        sourceType: 'blueprint_remix',
        referenceId: 'rem_idempotent_1',
        status: 'pending' as const,
      };

      const first = await accrueCreatorLedgerEntryCAS(db, entry);
      expect(first.success).toBe(true);
      expect(first.sequenceNum).toBe(1);
      expect(first.newBalanceCents).toBe(500);

      // Duplicate submission
      const second = await accrueCreatorLedgerEntryCAS(db, entry);
      expect(second.success).toBe(true);
      expect(second.ledgerId).toBe(first.ledgerId);
      expect(second.sequenceNum).toBe(1);
      expect(second.newBalanceCents).toBe(500);

      // DB must contain only 1 row
      const countRes = db.raw
        .prepare('SELECT count(*) as count FROM creator_earnings_ledger WHERE creator_id = ?')
        .get(creatorId) as { count: number };
      expect(countRes.count).toBe(1);
    });
  });
});
