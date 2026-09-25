/**
 * Challenger 1 — Empirical Stress Test Suite
 *
 * Exhaustive adversarial verification of core algorithms:
 * 1. 70/30 Integer Royalty Split Fuzzing (1,000 random cent values + boundary invariants)
 * 2. OCC CAS Monotonic Sequence Ledger under simulated high concurrency & Schema Drift Detection
 * 3. Circular Lineage Traversal Algorithm (cyclic graphs & multi-hop ancestor chains)
 * 4. Web Crypto 24h HMAC Signed Download URLs (forgery, expiration, skew, payload tampering)
 * 5. APAC Peak-Time Optimizer (all 5 markets across edge timestamps: 23:59:59, exact slot, +1s)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  calculateTemplateRoyalty,
  isSelfTemplateActivation,
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
import {
  calculateNextPeakPublishTime,
  isPeakHour,
  getTodayPeakSlots,
  getZonedDateParts,
  convertLocalToUtcMs,
  detectMarketFromTimezone,
  getAllSupportedMarkets,
  getMarketPeakConfig,
  APAC_MARKET_PEAKS,
} from '../../apps/sophia-ai-factory/src/tree/publishing/apac-peak-optimizer';
import type { ApacMarket } from '../../apps/sophia-ai-factory/src/seed/types/apac-syndication';
import {
  createInMemoryD1,
  type MockD1Database,
  calculate70_30Split,
} from '../e2e/harness/e2e-test-harness';

/**
 * Creates an in-memory SQLite D1 shim with the canonical production Migration 0275 schema.
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
// 1. 70/30 INTEGER ROYALTY SPLIT FUZZING & INVARIANT HARDENING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1: 70/30 Integer Royalty Split Fuzzing', () => {
  it('fuzzes 1,000 random cent values verifying creatorCents + platformCents === priceCents', () => {
    let seed = 123456789;
    const pseudoRandom = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    let totalDiscrepancies = 0;

    for (let i = 0; i < 1000; i++) {
      // Random cent values from 1 cent up to $1,000,000 (100,000,000 cents)
      const priceCents = Math.floor(pseudoRandom() * 100_000_000) + 1;
      const split = calculateTemplateRoyalty(priceCents, 70.0);

      // Core Invariant 1: Sum equals original price exactly (Zero Leakage)
      if (split.creatorCents + split.platformCents !== priceCents) {
        totalDiscrepancies++;
      }

      // Core Invariant 2: Values must be pure integers
      expect(Number.isInteger(split.creatorCents)).toBe(true);
      expect(Number.isInteger(split.platformCents)).toBe(true);

      // Core Invariant 3: Non-negative allocations
      expect(split.creatorCents).toBeGreaterThanOrEqual(0);
      expect(split.platformCents).toBeGreaterThanOrEqual(0);

      // Core Invariant 4: Creator royalty is strictly floor(priceCents * 0.7)
      expect(split.creatorCents).toBe(Math.floor((priceCents * 70) / 100));
    }

    expect(totalDiscrepancies).toBe(0);
  });

  it('verifies exact integer division behavior for small cent values (1 to 10 cents)', () => {
    const expectedBreakdown: Record<number, { creator: number; platform: number }> = {
      1: { creator: 0, platform: 1 },  // floor(0.7) = 0
      2: { creator: 1, platform: 1 },  // floor(1.4) = 1
      3: { creator: 2, platform: 1 },  // floor(2.1) = 2
      4: { creator: 2, platform: 2 },  // floor(2.8) = 2
      5: { creator: 3, platform: 2 },  // floor(3.5) = 3
      6: { creator: 4, platform: 2 },  // floor(4.2) = 4
      7: { creator: 4, platform: 3 },  // floor(4.9) = 4
      8: { creator: 5, platform: 3 },  // floor(5.6) = 5
      9: { creator: 6, platform: 3 },  // floor(6.3) = 6
      10: { creator: 7, platform: 3 }, // floor(7.0) = 7
    };

    for (const [priceStr, exp] of Object.entries(expectedBreakdown)) {
      const price = Number(priceStr);
      const res = calculateTemplateRoyalty(price, 70.0);
      expect(res.creatorCents).toBe(exp.creator);
      expect(res.platformCents).toBe(exp.platform);
      expect(res.creatorCents + res.platformCents).toBe(price);
    }
  });

  it('tests boundary and pathological inputs (zero, negative, overflow, float prices)', () => {
    // Zero price
    const zeroRes = calculateTemplateRoyalty(0, 70.0);
    expect(zeroRes.creatorCents).toBe(0);
    expect(zeroRes.platformCents).toBe(0);

    // Negative price
    const negRes = calculateTemplateRoyalty(-100, 70.0);
    expect(negRes.creatorCents).toBe(0);
    expect(negRes.platformCents).toBe(0);

    // 0% royalty rate
    const zeroRoyalty = calculateTemplateRoyalty(100, 0);
    expect(zeroRoyalty.creatorCents).toBe(0);
    expect(zeroRoyalty.platformCents).toBe(100);

    // 100% royalty rate
    const hundredRoyalty = calculateTemplateRoyalty(100, 100);
    expect(hundredRoyalty.creatorCents).toBe(100);
    expect(hundredRoyalty.platformCents).toBe(0);

    // Negative royalty rate (< 0) clamped to 0
    const negRoyalty = calculateTemplateRoyalty(100, -15);
    expect(negRoyalty.creatorCents).toBe(0);
    expect(negRoyalty.platformCents).toBe(100);

    // Over 100% royalty rate (> 100) clamped to 100
    const overRoyalty = calculateTemplateRoyalty(100, 120);
    expect(overRoyalty.creatorCents).toBe(100);
    expect(overRoyalty.platformCents).toBe(0);
  });

  it('cross-verifies production calculateTemplateRoyalty against attribution calculateMultiTierSplit', () => {
    const prices = [100, 250, 499, 999, 1499, 5000, 10000];
    for (const p of prices) {
      const prodSplit = calculateTemplateRoyalty(p, 70.0);
      const multiTier = calculateMultiTierSplit(p, 70.0, 'root_01');
      expect(multiTier.rootRoyaltyCents).toBe(prodSplit.creatorCents);
      expect(multiTier.totalRoyaltyCents).toBe(prodSplit.creatorCents);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. OCC CAS MONOTONIC SEQUENCE LEDGER UNDER CONCURRENCY & SCHEMA DIVERGENCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1: OCC CAS Monotonic Sequence Ledger under Concurrency', () => {
  let db: D1Database & { raw: DatabaseSync };

  beforeEach(() => {
    db = createCanonicalD1();
  });

  it('handles simulated 10-way concurrency on canonical D1 schema with monotonic sequence and zero lost updates', async () => {
    const creatorId = 'cr_stress_concurrency';
    const numWorkers = 10;
    const amountCents = 150; // $1.50 per activation

    // Launch 10 concurrent ledger accruals with unique references
    const tasks = Array.from({ length: numWorkers }, (_, idx) => {
      return accrueCreatorLedgerEntryCAS(
        db,
        {
          creatorId,
          amountCents,
          referenceId: `ref_concurrent_${idx}_${Date.now()}`,
          eventType: 'royalty_accrual',
          sourceType: 'template_activation',
        },
        12, // maxRetries
      );
    });

    const results = await Promise.all(tasks);

    // Verify all succeeded
    const successful = results.filter((r) => r.success);
    expect(successful.length).toBe(numWorkers);

    // Fetch all inserted rows from database directly
    const rows = await db
      .prepare('SELECT sequence_num, balance_after_cents, amount_cents FROM creator_earnings_ledger WHERE creator_id = ? ORDER BY sequence_num ASC')
      .bind(creatorId)
      .all<{ sequence_num: number; balance_after_cents: number; amount_cents: number }>();

    expect(rows.results.length).toBe(numWorkers);

    // Verify Monotonic Sequence Invariant: [1, 2, 3, ..., 10]
    const seqs = rows.results.map((r) => r.sequence_num);
    const expectedSeqs = Array.from({ length: numWorkers }, (_, i) => i + 1);
    expect(seqs).toEqual(expectedSeqs);

    // Verify Cumulative Balance Invariant: exactly numWorkers * amountCents
    const finalRow = rows.results[rows.results.length - 1];
    expect(finalRow.balance_after_cents).toBe(numWorkers * amountCents);

    // Verify every step incremented balance by exactly amountCents
    for (let i = 0; i < rows.results.length; i++) {
      expect(rows.results[i].balance_after_cents).toBe((i + 1) * amountCents);
    }
  });

  it('verifies idempotent deduplication on duplicate referenceId', async () => {
    const creatorId = 'cr_idempotent_test';
    const referenceId = 'ref_idempotent_single_001';

    // First call
    const first = await accrueCreatorLedgerEntryCAS(
      db,
      {
        creatorId,
        amountCents: 500,
        referenceId,
        eventType: 'royalty_accrual',
      },
    );

    expect(first.success).toBe(true);
    expect(first.sequenceNum).toBe(1);
    expect(first.newBalanceCents).toBe(500);

    // Second call with identical referenceId (replay)
    const replay = await accrueCreatorLedgerEntryCAS(
      db,
      {
        creatorId,
        amountCents: 500,
        referenceId,
        eventType: 'royalty_accrual',
      },
    );

    expect(replay.success).toBe(true);
    expect(replay.ledgerId).toBe(first.ledgerId);
    expect(replay.sequenceNum).toBe(1);
    expect(replay.newBalanceCents).toBe(500);

    // Confirm only 1 row exists in database
    const count = await db
      .prepare('SELECT COUNT(*) as cnt FROM creator_earnings_ledger WHERE creator_id = ?')
      .bind(creatorId)
      .first<{ cnt: number }>();
    expect(count?.cnt).toBe(1);
  });

  it('empirically challenges concurrent race with the exact same referenceId', async () => {
    const creatorId = 'cr_race_duplicate';
    const referenceId = 'ref_race_dup_999';

    // 4 concurrent requests trying to insert the same referenceId
    const duplicateTasks = Array.from({ length: 4 }, () =>
      accrueCreatorLedgerEntryCAS(
        db,
        {
          creatorId,
          amountCents: 300,
          referenceId,
          eventType: 'royalty_accrual',
        },
        5, // retries
      ),
    );

    const dupResults = await Promise.all(duplicateTasks);

    // In a race on duplicate reference_id, at least one must succeed and create the row
    const succeeded = dupResults.filter((r) => r.success);
    expect(succeeded.length).toBeGreaterThanOrEqual(1);

    // The database must contain exactly ONE row (no duplicate credit)
    const count = await db
      .prepare('SELECT COUNT(*) as cnt FROM creator_earnings_ledger WHERE reference_id = ?')
      .bind(referenceId)
      .first<{ cnt: number }>();
    expect(count?.cnt).toBe(1);
  });

  it('isolates sequence numbers and balances across multiple creators', async () => {
    const creators = ['cr_alpha', 'cr_beta', 'cr_gamma'];

    // Interleaved writes across creators
    for (let round = 1; round <= 3; round++) {
      for (const cr of creators) {
        await accrueCreatorLedgerEntryCAS(
          db,
          {
            creatorId: cr,
            amountCents: 100,
            referenceId: `ref_${cr}_${round}`,
            eventType: 'royalty_accrual',
          },
        );
      }
    }

    // Each creator must have independent sequence 1..3 and balance 300
    for (const cr of creators) {
      const rows = await db
        .prepare('SELECT sequence_num, balance_after_cents FROM creator_earnings_ledger WHERE creator_id = ? ORDER BY sequence_num ASC')
        .bind(cr)
        .all<{ sequence_num: number; balance_after_cents: number }>();

      expect(rows.results.length).toBe(3);
      expect(rows.results.map((r) => r.sequence_num)).toEqual([1, 2, 3]);
      expect(rows.results[2].balance_after_cents).toBe(300);
    }
  });

  it('verifies that schema drift between mock-db-schema.ts and production attribution.ts is resolved in Iteration 2', async () => {
    // In Iteration 1, mock-db-schema had schema drift.
    // In Iteration 2 remediation, mock-db-schema was updated with full column parity (metadata_json, sequence_num, etc.).
    const mockDb = createInMemoryD1();

    const res = await accrueCreatorLedgerEntryCAS(
      mockDb as unknown as D1Database,
      {
        creatorId: 'cr_drift_test',
        amountCents: 100,
        referenceId: 'ref_drift_001',
      },
      2, // short retries
    );

    // Verified: mock-db-schema now successfully accrues with sequence 1 and balance 100
    expect(res.success).toBe(true);
    expect(res.sequenceNum).toBe(1);
    expect(res.newBalanceCents).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CIRCULAR LINEAGE TRAVERSAL ALGORITHM
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1: Circular Lineage Traversal Algorithm', () => {
  let db: D1Database & { raw: DatabaseSync };

  beforeEach(() => {
    db = createCanonicalD1();
  });

  it('detects direct 1-hop self-remix (remixer is creator of the blueprint)', async () => {
    await db
      .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('bp_direct', 'alice_user', null, 'Direct Template', Date.now())
      .run();

    const isCircular = await isCircularAncestorRemix(
      db,
      'bp_direct',
      'alice_user',
    );
    expect(isCircular).toBe(true);

    // Another user is not circular
    const isOtherCircular = await isCircularAncestorRemix(
      db,
      'bp_direct',
      'bob_user',
    );
    expect(isOtherCircular).toBe(false);
  });

  it('detects multi-hop ancestor chain where remixer created an upstream blueprint (5 hops)', async () => {
    // Chain: bp_0 (Alice) -> bp_1 (Bob) -> bp_2 (Charlie) -> bp_3 (Dave) -> bp_4 (Eve) -> bp_5 (Frank)
    await db.prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)').bind('bp_0', 'alice_user', null, 'Root', Date.now()).run();
    await db.prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)').bind('bp_1', 'bob_user', 'bp_0', 'Hop 1', Date.now()).run();
    await db.prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)').bind('bp_2', 'charlie_user', 'bp_1', 'Hop 2', Date.now()).run();
    await db.prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)').bind('bp_3', 'dave_user', 'bp_2', 'Hop 3', Date.now()).run();
    await db.prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)').bind('bp_4', 'eve_user', 'bp_3', 'Hop 4', Date.now()).run();
    await db.prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)').bind('bp_5', 'frank_user', 'bp_4', 'Hop 5', Date.now()).run();

    // Alice created bp_0 (5 hops up). If Alice tries to remix bp_5:
    const isAliceCircular = await isCircularAncestorRemix(
      db,
      'bp_5',
      'alice_user',
    );
    expect(isAliceCircular).toBe(true);

    // Charlie created bp_2 (3 hops up). If Charlie tries to remix bp_5:
    const isCharlieCircular = await isCircularAncestorRemix(
      db,
      'bp_5',
      'charlie_user',
    );
    expect(isCharlieCircular).toBe(true);

    // Grace is completely external. Not circular:
    const isGraceCircular = await isCircularAncestorRemix(
      db,
      'bp_5',
      'grace_user',
    );
    expect(isGraceCircular).toBe(false);
  });

  it('detects cyclic parent relationships (A -> B -> A) without infinite loop', async () => {
    // Cycle: bp_cyc_A -> bp_cyc_B -> bp_cyc_A
    await db.prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)').bind('bp_cyc_A', 'user_a', 'bp_cyc_B', 'Cycle A', Date.now()).run();
    await db.prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)').bind('bp_cyc_B', 'user_b', 'bp_cyc_A', 'Cycle B', Date.now()).run();

    // Any remixer encountering a cycle in the ancestor lineage should be flagged as circular
    const isCyc = await isCircularAncestorRemix(
      db,
      'bp_cyc_A',
      'external_user',
    );
    expect(isCyc).toBe(true);
  });

  it('detects immediate self-cycle (BP_A -> parent is BP_A)', async () => {
    await db.prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)').bind('bp_self_loop', 'user_x', 'bp_self_loop', 'Self Loop', Date.now()).run();

    const isLoop = await isCircularAncestorRemix(
      db,
      'bp_self_loop',
      'external_user',
    );
    expect(isLoop).toBe(true);
  });

  it('evaluates behavior at maxDepth boundary (10 hops)', async () => {
    // Construct chain of 12 hops: bp_0 .. bp_12
    let parent: string | null = null;
    for (let i = 0; i <= 12; i++) {
      const id = `depth_bp_${i}`;
      await db
        .prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id, `creator_${i}`, parent, `Depth ${i}`, Date.now())
        .run();
      parent = id;
    }

    // Remixer at depth 4 (creator_8 is 4 hops away from bp_12): detected
    const atDepth4 = await isCircularAncestorRemix(
      db,
      'depth_bp_12',
      'creator_8',
      10,
    );
    expect(atDepth4).toBe(true);

    // Remixer at depth 12 (creator_0 is 12 hops away, beyond maxDepth 10):
    // Documented boundary: maxDepth traversal terminates at depth 10
    const atDepth12 = await isCircularAncestorRemix(
      db,
      'depth_bp_12',
      'creator_0',
      10,
    );
    expect(atDepth12).toBe(false); // correctly bounded by maxDepth
  });

  it('blocks recordBlueprintRemixAndAccrueRoyalty when circular remix is attempted', async () => {
    await db.prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)').bind('bp_m2_root', 'alice_creator', null, 'Root', Date.now()).run();
    await db.prepare('INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, created_at) VALUES (?, ?, ?, ?, ?)').bind('bp_m2_child', 'bob_creator', 'bp_m2_root', 'Child', Date.now()).run();

    // Alice attempts to remix Child (Alice is root ancestor)
    const result = await recordBlueprintRemixAndAccrueRoyalty(
      db,
      {
        blueprintId: 'bp_m2_child',
        parentCreatorId: 'bob_creator',
        remixerUserId: 'alice_creator',
        missionId: 'mis_001',
        revenueCents: 1000,
        royaltyPercent: 70,
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
    expect(result.royaltyCents).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. WEB CRYPTO 24H HMAC SIGNED DOWNLOAD URLS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1: Web Crypto 24h HMAC Signed Download URLs', () => {
  const secret = 'super-secret-hmac-key-for-testing-12345';
  const videoId = 'vid_apac_dub_4k_001';
  const userId = 'usr_paid_apac_customer';

  it('generates a valid 24h signed token and verifies nominal success', async () => {
    const token = await createSignedDownloadToken({
      videoId,
      userId,
      tenantId: 'tenant_vietnam',
      ttlSeconds: 86400,
      secret,
    });

    expect(token).toBeDefined();
    expect(token.includes('.')).toBe(true);

    const verification = await verifySignedDownloadToken({
      token,
      videoId,
      secret,
    });

    expect(verification.valid).toBe(true);
    expect(verification.expired).toBe(false);
    expect(verification.payload?.videoId).toBe(videoId);
    expect(verification.payload?.userId).toBe(userId);
    expect(verification.payload?.tenantId).toBe('tenant_vietnam');
  });

  it('rejects forged signatures with wrong secret or corrupted signature bytes', async () => {
    const token = await createSignedDownloadToken({
      videoId,
      userId,
      ttlSeconds: 86400,
      secret,
    });

    // 1. Verify with incorrect secret
    const wrongSecretRes = await verifySignedDownloadToken({
      token,
      videoId,
      secret: 'wrong-attacker-secret',
    });
    expect(wrongSecretRes.valid).toBe(false);
    expect(wrongSecretRes.expired).toBe(false);

    // 2. Tampered signature (altered last 4 hex characters)
    const dotIdx = token.lastIndexOf('.');
    const payloadPart = token.substring(0, dotIdx);
    const sigPart = token.substring(dotIdx + 1);
    const tamperedSig = sigPart.slice(0, -4) + 'beef';
    const tamperedToken = `${payloadPart}.${tamperedSig}`;

    const tamperedSigRes = await verifySignedDownloadToken({
      token: tamperedToken,
      videoId,
      secret,
    });
    expect(tamperedSigRes.valid).toBe(false);
    expect(tamperedSigRes.expired).toBe(false);

    // 3. Truncated signature
    const truncatedToken = `${payloadPart}.${sigPart.slice(0, 16)}`;
    const truncatedRes = await verifySignedDownloadToken({
      token: truncatedToken,
      videoId,
      secret,
    });
    expect(truncatedRes.valid).toBe(false);
  });

  it('rejects tampered payload fields (videoId modification / cross-video replay)', async () => {
    const token = await createSignedDownloadToken({
      videoId: 'vid_cheap_1080p',
      userId,
      ttlSeconds: 86400,
      secret,
    });

    // Attacker tries to use cheap video token to download premium 4K video
    const replayRes = await verifySignedDownloadToken({
      token,
      videoId: 'vid_premium_4k_expensive',
      secret,
    });
    expect(replayRes.valid).toBe(false);

    // Attacker alters payload JSON directly and re-encodes base64 without knowing secret
    const dotIdx = token.lastIndexOf('.');
    const payloadPart = token.substring(0, dotIdx);
    const sigPart = token.substring(dotIdx + 1);

    const decodedJson = base64UrlToString(payloadPart);
    const parsed = JSON.parse(decodedJson);
    parsed.videoId = 'vid_premium_4k_expensive';
    const modifiedPayloadB64 = stringToBase64Url(JSON.stringify(parsed));
    const modifiedToken = `${modifiedPayloadB64}.${sigPart}`;

    const modifiedRes = await verifySignedDownloadToken({
      token: modifiedToken,
      videoId: 'vid_premium_4k_expensive',
      secret,
    });
    expect(modifiedRes.valid).toBe(false);
  });

  it('detects expired tokens (ttl = -1s or expired in the past)', async () => {
    const expiredToken = await createSignedDownloadToken({
      videoId,
      userId,
      ttlSeconds: -10, // already expired 10s ago
      secret,
    });

    const res = await verifySignedDownloadToken({
      token: expiredToken,
      videoId,
      secret,
    });

    expect(res.valid).toBe(false);
    expect(res.expired).toBe(true);
    expect(res.payload?.videoId).toBe(videoId);
  });

  it('tests timingSafeEqual against string attacks', () => {
    expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
    expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(timingSafeEqual('abcdef', 'abcdefg')).toBe(false); // length mismatch
    expect(timingSafeEqual('', '')).toBe(true);
    expect(timingSafeEqual('a', '')).toBe(false);
    // Non-string guard
    expect(timingSafeEqual(null as unknown as string, 'abc')).toBe(false);
    expect(timingSafeEqual('abc', undefined as unknown as string)).toBe(false);
  });

  it('handles garbage tokens gracefully without crashing', async () => {
    const garbageInputs = [
      '',
      'no-dot-token',
      '.leading-dot',
      'trailing-dot.',
      'multiple..dots',
      'invalid!base64$.signature',
      '{}',
    ];

    for (const g of garbageInputs) {
      const res = await verifySignedDownloadToken(g, videoId, secret);
      expect(res.valid).toBe(false);
      expect(res.expired).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. APAC PEAK-TIME OPTIMIZER (5 MARKETS ACROSS EDGE TIMESTAMPS)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenger 1: APAC Peak-Time Optimizer (5 Markets & Edge Times)', () => {
  const allMarkets: ApacMarket[] = ['hanoi', 'tokyo', 'bangkok', 'seoul', 'singapore'];

  it('verifies configurations and offsets for all 5 markets', () => {
    expect(getAllSupportedMarkets()).toEqual(['hanoi', 'tokyo', 'bangkok', 'seoul', 'singapore']);

    const configs: Record<ApacMarket, { utcOffset: number; slots: Array<{ hour: number; minute: number }> }> = {
      hanoi: { utcOffset: 7, slots: [{ hour: 11, minute: 30 }, { hour: 19, minute: 30 }] },
      tokyo: { utcOffset: 9, slots: [{ hour: 12, minute: 0 }, { hour: 20, minute: 0 }] },
      bangkok: { utcOffset: 7, slots: [{ hour: 12, minute: 0 }, { hour: 20, minute: 30 }] },
      seoul: { utcOffset: 9, slots: [{ hour: 12, minute: 0 }, { hour: 19, minute: 0 }] },
      singapore: { utcOffset: 8, slots: [{ hour: 12, minute: 30 }, { hour: 20, minute: 0 }] },
    };

    for (const m of allMarkets) {
      const cfg = getMarketPeakConfig(m);
      expect(cfg.utcOffsetHours).toBe(configs[m].utcOffset);
      expect(cfg.slots.length).toBe(2);
      expect(cfg.slots[0].hour).toBe(configs[m].slots[0].hour);
      expect(cfg.slots[0].minute).toBe(configs[m].slots[0].minute);
      expect(cfg.slots[1].hour).toBe(configs[m].slots[1].hour);
      expect(cfg.slots[1].minute).toBe(configs[m].slots[1].minute);
    }
  });

  // Test Edge Timestamp 1: 23:59:59 local across all 5 markets (End of day rollover)
  it('rolls over to tomorrow first slot when requested at 23:59:59 local for all 5 markets', () => {
    const year = 2026;
    const month = 9;
    const day = 24;

    for (const market of allMarkets) {
      const cfg = getMarketPeakConfig(market);
      // Create timestamp at 23:59:59 local
      const requestedTimeMs = convertLocalToUtcMs(
        year,
        month,
        day,
        23,
        59,
        59,
        cfg.utcOffsetHours,
      );

      const result = calculateNextPeakPublishTime(requestedTimeMs, market);

      // Must roll over to next day
      expect(result.isRollover).toBe(true);
      expect(result.slotName).toBe(cfg.slots[0].name);

      // Scheduled time must be strictly in the future
      expect(result.scheduledAtMs).toBeGreaterThan(requestedTimeMs);

      // Verify scheduled time matches tomorrow's first slot exactly
      const scheduledParts = getZonedDateParts(result.scheduledAtMs, cfg.timezone);
      expect(scheduledParts.year).toBe(year);
      expect(scheduledParts.month).toBe(month);
      expect(scheduledParts.day).toBe(day + 1);
      expect(scheduledParts.hour).toBe(cfg.slots[0].hour);
      expect(scheduledParts.minute).toBe(cfg.slots[0].minute);
    }
  });

  // Test Edge Timestamp 2: Exactly at slot 1 time
  it('schedules for evening slot when requested EXACTLY at slot 1 time for all 5 markets', () => {
    const year = 2026;
    const month = 9;
    const day = 24;

    for (const market of allMarkets) {
      const cfg = getMarketPeakConfig(market);
      const slot1 = cfg.slots[0];
      const slot2 = cfg.slots[1];

      // Exact millisecond of slot 1
      const exactSlot1Ms = convertLocalToUtcMs(
        year,
        month,
        day,
        slot1.hour,
        slot1.minute,
        0,
        cfg.utcOffsetHours,
      );

      const result = calculateNextPeakPublishTime(exactSlot1Ms, market);

      // Since exact slot 1 has arrived, optimizer schedules next slot (slot 2 today)
      expect(result.isRollover).toBe(false);
      expect(result.slotName).toBe(slot2.name);
      expect(result.scheduledAtMs).toBeGreaterThan(exactSlot1Ms);

      const scheduledParts = getZonedDateParts(result.scheduledAtMs, cfg.timezone);
      expect(scheduledParts.day).toBe(day);
      expect(scheduledParts.hour).toBe(slot2.hour);
      expect(scheduledParts.minute).toBe(slot2.minute);
    }
  });

  // Test Edge Timestamp 3: 1 second past slot 1 time
  it('schedules for evening slot when requested 1 second PAST slot 1 time for all 5 markets', () => {
    const year = 2026;
    const month = 9;
    const day = 24;

    for (const market of allMarkets) {
      const cfg = getMarketPeakConfig(market);
      const slot1 = cfg.slots[0];
      const slot2 = cfg.slots[1];

      // 1 second past slot 1
      const pastSlot1Ms = convertLocalToUtcMs(
        year,
        month,
        day,
        slot1.hour,
        slot1.minute,
        1,
        cfg.utcOffsetHours,
      );

      const result = calculateNextPeakPublishTime(pastSlot1Ms, market);

      expect(result.isRollover).toBe(false);
      expect(result.slotName).toBe(slot2.name);
      expect(result.scheduledAtMs).toBeGreaterThan(pastSlot1Ms);

      const scheduledParts = getZonedDateParts(result.scheduledAtMs, cfg.timezone);
      expect(scheduledParts.day).toBe(day);
      expect(scheduledParts.hour).toBe(slot2.hour);
      expect(scheduledParts.minute).toBe(slot2.minute);
    }
  });

  // Test Edge Timestamp 4: 1 second BEFORE slot 1 time
  it('captures slot 1 today when requested 1 second BEFORE slot 1 time for all 5 markets', () => {
    const year = 2026;
    const month = 9;
    const day = 24;

    for (const market of allMarkets) {
      const cfg = getMarketPeakConfig(market);
      const slot1 = cfg.slots[0];

      // 1 second before slot 1
      const exactSlot1Ms = convertLocalToUtcMs(
        year,
        month,
        day,
        slot1.hour,
        slot1.minute,
        0,
        cfg.utcOffsetHours,
      );
      const beforeSlot1Ms = exactSlot1Ms - 1000;

      const result = calculateNextPeakPublishTime(beforeSlot1Ms, market);

      expect(result.isRollover).toBe(false);
      expect(result.slotName).toBe(slot1.name);
      expect(result.scheduledAtMs).toBe(exactSlot1Ms);
    }
  });

  // Test Edge Timestamp 5: Exactly at slot 2 time & 1 second past slot 2 time
  it('rolls over to tomorrow slot 1 when requested at or past slot 2 for all 5 markets', () => {
    const year = 2026;
    const month = 9;
    const day = 24;

    for (const market of allMarkets) {
      const cfg = getMarketPeakConfig(market);
      const slot2 = cfg.slots[1];

      // At exact second of slot 2
      const exactSlot2Ms = convertLocalToUtcMs(
        year,
        month,
        day,
        slot2.hour,
        slot2.minute,
        0,
        cfg.utcOffsetHours,
      );
      const resExact = calculateNextPeakPublishTime(exactSlot2Ms, market);
      expect(resExact.isRollover).toBe(true);
      expect(resExact.slotName).toBe(cfg.slots[0].name);
      expect(resExact.scheduledAtMs).toBeGreaterThan(exactSlot2Ms);

      // 1 second past slot 2
      const resPast = calculateNextPeakPublishTime(exactSlot2Ms + 1000, market);
      expect(resPast.isRollover).toBe(true);
      expect(resPast.slotName).toBe(cfg.slots[0].name);
      expect(resPast.scheduledAtMs).toBeGreaterThan(exactSlot2Ms + 1000);
    }
  });

  // Test Edge Timestamp 6: Year-End Rollover (Dec 31 23:59:59 -> Jan 1)
  it('smoothly rolls over year-end boundary (Dec 31, 2026 23:59:59 to Jan 1, 2027)', () => {
    for (const market of allMarkets) {
      const cfg = getMarketPeakConfig(market);
      const newYearEveMs = convertLocalToUtcMs(
        2026,
        12,
        31,
        23,
        59,
        59,
        cfg.utcOffsetHours,
      );

      const res = calculateNextPeakPublishTime(newYearEveMs, market);
      expect(res.isRollover).toBe(true);

      const scheduledParts = getZonedDateParts(res.scheduledAtMs, cfg.timezone);
      expect(scheduledParts.year).toBe(2027);
      expect(scheduledParts.month).toBe(1);
      expect(scheduledParts.day).toBe(1);
      expect(scheduledParts.hour).toBe(cfg.slots[0].hour);
      expect(scheduledParts.minute).toBe(cfg.slots[0].minute);
    }
  });

  // Test Edge Timestamp 7: Leap Year Rollover (Feb 28, 2028 leap year)
  it('correctly respects leap year day 29 (Feb 28, 2028 23:59:59 to Feb 29, 2028)', () => {
    for (const market of allMarkets) {
      const cfg = getMarketPeakConfig(market);
      const leapEveMs = convertLocalToUtcMs(
        2028,
        2,
        28,
        23,
        59,
        59,
        cfg.utcOffsetHours,
      );

      const res = calculateNextPeakPublishTime(leapEveMs, market);
      expect(res.isRollover).toBe(true);

      const scheduledParts = getZonedDateParts(res.scheduledAtMs, cfg.timezone);
      expect(scheduledParts.year).toBe(2028);
      expect(scheduledParts.month).toBe(2);
      expect(scheduledParts.day).toBe(29); // Leap day preserved
    }
  });

  it('tests isPeakHour tolerance windows for all markets', () => {
    for (const market of allMarkets) {
      const cfg = getMarketPeakConfig(market);
      const slot1 = cfg.slots[0];
      const slotUtcMs = convertLocalToUtcMs(2026, 9, 24, slot1.hour, slot1.minute, 0, cfg.utcOffsetHours);

      // Exactly at slot: peak hour is true
      expect(isPeakHour(slotUtcMs, market, 30)).toBe(true);

      // 20 minutes before: true (within 30m tolerance)
      expect(isPeakHour(slotUtcMs - 20 * 60 * 1000, market, 30)).toBe(true);

      // 20 minutes after: true (within 30m tolerance)
      expect(isPeakHour(slotUtcMs + 20 * 60 * 1000, market, 30)).toBe(true);

      // 45 minutes after: false (outside 30m tolerance)
      expect(isPeakHour(slotUtcMs + 45 * 60 * 1000, market, 30)).toBe(false);
    }
  });

  it('detects market from IANA timezone strings', () => {
    expect(detectMarketFromTimezone('Asia/Ho_Chi_Minh')).toBe('hanoi');
    expect(detectMarketFromTimezone('Asia/Saigon')).toBe('hanoi');
    expect(detectMarketFromTimezone('Asia/Tokyo')).toBe('tokyo');
    expect(detectMarketFromTimezone('Asia/Bangkok')).toBe('bangkok');
    expect(detectMarketFromTimezone('Asia/Seoul')).toBe('seoul');
    expect(detectMarketFromTimezone('Asia/Singapore')).toBe('singapore');
    expect(detectMarketFromTimezone('Europe/London')).toBe('hanoi'); // fallback
  });
});
