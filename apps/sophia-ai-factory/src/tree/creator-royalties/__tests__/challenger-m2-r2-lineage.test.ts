/**
 * Challenger M2 Round 2: Empirical Adversarial Stress Test Suite
 * Anti-Fraud Ancestor Lineage Traversal & Multi-Hop Circular Self-Remix Rejection
 *
 * @vitest-environment node
 *
 * Layer: tree
 */

import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  isCircularAncestorRemix,
  recordBlueprintRemixAndAccrueRoyalty,
} from '../attribution';
import type { BlueprintRemixInput } from '@/seed/types/creator-marketplace';

/**
 * Creates a real SQLite database mirroring D1 with full Migration 0275 schema.
 */
function createSqliteD1() {
  const db = new DatabaseSync(':memory:');

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

describe('Challenger M2 R2: Ancestor Lineage Traversal & Multi-Hop Cycle Stress Suite', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // 1. Multi-Hop Circular Self-Remix Rejection
  // ══════════════════════════════════════════════════════════════════════════
  describe('1. Multi-Hop Circular Self-Remix Rejection', () => {
    it('1.1 rejects 2-hop loop: Alice -> Bob -> Alice (A -> B -> A)', async () => {
      const db = createSqliteD1();

      // Alice creates root blueprint
      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, royalty_pct)
        VALUES ('bp_root_alice', 'alice', NULL, 'Alice Root Blueprint', 10.0)
      `).run();

      // Bob remixes Alice's root blueprint into derivative
      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title, royalty_pct)
        VALUES ('bp_deriv_bob', 'bob', 'bp_root_alice', 'Bob Derivative Blueprint', 10.0)
      `).run();

      // Alice attempts to remix Bob's derivative
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_deriv_bob',
        parentCreatorId: 'bob',
        remixerUserId: 'alice',
        missionId: 'mis_alice_2hop',
        revenueCents: 10000,
        royaltyPercent: 10,
      });

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

    it('1.2 rejects 3-hop loop: Alice -> Bob -> Charlie -> Alice (A -> B -> C -> A)', async () => {
      const db = createSqliteD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES 
          ('bp_1', 'alice', NULL, 'Alice Root'),
          ('bp_2', 'bob', 'bp_1', 'Bob Derivative'),
          ('bp_3', 'charlie', 'bp_2', 'Charlie Derivative')
      `).run();

      // Alice attempts to remix Charlie's derivative (originated from Alice 3 hops ago)
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_3',
        parentCreatorId: 'charlie',
        remixerUserId: 'alice',
        missionId: 'mis_alice_3hop',
        revenueCents: 10000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(res.royaltyCents).toBe(0);

      const remixes = db.raw.prepare('SELECT count(*) as count FROM blueprint_remixes').get() as { count: number };
      expect(remixes.count).toBe(0);

      const ledger = db.raw.prepare('SELECT count(*) as count FROM creator_earnings_ledger').get() as { count: number };
      expect(ledger.count).toBe(0);
    });

    it('1.3 rejects 5-hop deep loop: Alice -> Bob -> Charlie -> Dave -> Eve -> Alice', async () => {
      const db = createSqliteD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES 
          ('bp_1', 'alice', NULL, 'Alice Root'),
          ('bp_2', 'bob', 'bp_1', 'Bob Derivative'),
          ('bp_3', 'charlie', 'bp_2', 'Charlie Derivative'),
          ('bp_4', 'dave', 'bp_3', 'Dave Derivative'),
          ('bp_5', 'eve', 'bp_4', 'Eve Derivative')
      `).run();

      // 1.3.1 Alice (5 hops back at root) remixes bp_5
      const resAlice = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_5',
        parentCreatorId: 'eve',
        remixerUserId: 'alice',
        missionId: 'mis_alice_5hop',
        revenueCents: 10000,
        royaltyPercent: 10,
      });
      expect(resAlice.success).toBe(false);
      expect(resAlice.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(resAlice.royaltyCents).toBe(0);

      // 1.3.2 Bob (4 hops back) remixes bp_5
      const resBob = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_5',
        parentCreatorId: 'eve',
        remixerUserId: 'bob',
        missionId: 'mis_bob_4hop',
        revenueCents: 10000,
        royaltyPercent: 10,
      });
      expect(resBob.success).toBe(false);
      expect(resBob.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(resBob.royaltyCents).toBe(0);

      // 1.3.3 Charlie (3 hops back) remixes bp_5
      const resCharlie = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_5',
        parentCreatorId: 'eve',
        remixerUserId: 'charlie',
        missionId: 'mis_charlie_3hop',
        revenueCents: 10000,
        royaltyPercent: 10,
      });
      expect(resCharlie.success).toBe(false);
      expect(resCharlie.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(resCharlie.royaltyCents).toBe(0);

      // 1.3.4 Dave (2 hops back) remixes bp_5
      const resDave = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_5',
        parentCreatorId: 'eve',
        remixerUserId: 'dave',
        missionId: 'mis_dave_2hop',
        revenueCents: 10000,
        royaltyPercent: 10,
      });
      expect(resDave.success).toBe(false);
      expect(resDave.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(resDave.royaltyCents).toBe(0);

      // 1.3.5 Eve (direct parent self-remix) remixes bp_5
      const resEve = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_5',
        parentCreatorId: 'eve',
        remixerUserId: 'eve',
        missionId: 'mis_eve_direct',
        revenueCents: 10000,
        royaltyPercent: 10,
      });
      expect(resEve.success).toBe(false);
      expect(resEve.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(resEve.royaltyCents).toBe(0);

      // Total rows in DB must remain 0
      const remixes = db.raw.prepare('SELECT count(*) as count FROM blueprint_remixes').get() as { count: number };
      expect(remixes.count).toBe(0);
      const ledger = db.raw.prepare('SELECT count(*) as count FROM creator_earnings_ledger').get() as { count: number };
      expect(ledger.count).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Corrupted Graph Cycles in Database
  // ══════════════════════════════════════════════════════════════════════════
  describe('2. Corrupted Graph Cycles in Database', () => {
    it('2.1 detects 2-node cycle: B1 -> B2 -> B1 and blocks remix safely', async () => {
      const db = createSqliteD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES 
          ('bp_c1', 'creator_1', 'bp_c2', 'Cycle Node 1'),
          ('bp_c2', 'creator_2', 'bp_c1', 'Cycle Node 2')
      `).run();

      // Direct lineage check on cycle
      const isCycle1 = await isCircularAncestorRemix(db, 'bp_c1', 'third_party_frank');
      expect(isCycle1).toBe(true);

      const isCycle2 = await isCircularAncestorRemix(db, 'bp_c2', 'third_party_frank');
      expect(isCycle2).toBe(true);

      // Even genuine third party Frank is denied because the graph itself is invalid/corrupt
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_c1',
        parentCreatorId: 'creator_1',
        remixerUserId: 'third_party_frank',
        missionId: 'mis_cycle_2node',
        revenueCents: 10000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
      expect(res.royaltyCents).toBe(0);
    });

    it('2.2 detects 1-node self-cycle: B1 -> B1 and blocks remix safely', async () => {
      const db = createSqliteD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES ('bp_self_loop', 'creator_1', 'bp_self_loop', 'Self Loop Node')
      `).run();

      const isCycle = await isCircularAncestorRemix(db, 'bp_self_loop', 'third_party_frank');
      expect(isCycle).toBe(true);

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_self_loop',
        parentCreatorId: 'creator_1',
        remixerUserId: 'third_party_frank',
        missionId: 'mis_self_loop',
        revenueCents: 5000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
    });

    it('2.3 detects 3-node cycle: B1 -> B2 -> B3 -> B1 and blocks remix safely', async () => {
      const db = createSqliteD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES 
          ('bp_loop_1', 'creator_1', 'bp_loop_2', 'Loop 1'),
          ('bp_loop_2', 'creator_2', 'bp_loop_3', 'Loop 2'),
          ('bp_loop_3', 'creator_3', 'bp_loop_1', 'Loop 3')
      `).run();

      const isCycle = await isCircularAncestorRemix(db, 'bp_loop_3', 'third_party_frank');
      expect(isCycle).toBe(true);

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_loop_3',
        parentCreatorId: 'creator_3',
        remixerUserId: 'third_party_frank',
        missionId: 'mis_loop_3',
        revenueCents: 7500,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
    });

    it('2.4 handles tail-into-cycle graph: Start -> Mid -> B1 -> B2 -> B1 without hanging', async () => {
      const db = createSqliteD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES 
          ('bp_c1', 'c1', 'bp_c2', 'Cycle 1'),
          ('bp_c2', 'c2', 'bp_c1', 'Cycle 2'),
          ('bp_mid', 'cm', 'bp_c1', 'Mid'),
          ('bp_start', 'cs', 'bp_mid', 'Start')
      `).run();

      const isCycle = await isCircularAncestorRemix(db, 'bp_start', 'third_party_frank');
      expect(isCycle).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Valid Non-Circular Derivative Chains (Zero False Rejection Guarantee)
  // ══════════════════════════════════════════════════════════════════════════
  describe('3. Valid Non-Circular Derivative Chains (Zero False Rejections)', () => {
    it('3.1 permits genuine third party to remix root blueprint directly', async () => {
      const db = createSqliteD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES ('bp_root_alice', 'alice', NULL, 'Alice Root')
      `).run();

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_root_alice',
        parentCreatorId: 'alice',
        remixerUserId: 'frank_genuine',
        missionId: 'mis_frank_root',
        revenueCents: 10000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(true);
      expect(res.royaltyCents).toBe(1000);
      expect(res.creatorId).toBe('alice');

      // Verify row in blueprint_remixes
      const remix = db.raw.prepare('SELECT * FROM blueprint_remixes WHERE remixer_user_id = ?').get('frank_genuine') as any;
      expect(remix).toBeDefined();
      expect(remix.blueprint_id).toBe('bp_root_alice');
      expect(remix.creator_id).toBe('alice');
      expect(remix.royalty_cents).toBe(1000);

      // Verify row in creator_earnings_ledger
      const ledger = db.raw.prepare('SELECT * FROM creator_earnings_ledger WHERE creator_id = ?').get('alice') as any;
      expect(ledger).toBeDefined();
      expect(ledger.amount_cents).toBe(1000);
      expect(ledger.sequence_num).toBe(1);
      expect(ledger.balance_after_cents).toBe(1000);
    });

    it('3.2 permits genuine third party to remix 2-hop derivative (A -> B -> Frank)', async () => {
      const db = createSqliteD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES 
          ('bp_root_alice', 'alice', NULL, 'Alice Root'),
          ('bp_deriv_bob', 'bob', 'bp_root_alice', 'Bob Derivative')
      `).run();

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_deriv_bob',
        parentCreatorId: 'bob',
        remixerUserId: 'frank_genuine',
        missionId: 'mis_frank_2hop',
        revenueCents: 15000,
        royaltyPercent: 20,
      });

      expect(res.success).toBe(true);
      expect(res.royaltyCents).toBe(3000);
      expect(res.creatorId).toBe('bob');

      const ledger = db.raw.prepare('SELECT * FROM creator_earnings_ledger WHERE creator_id = ?').get('bob') as any;
      expect(ledger.amount_cents).toBe(3000);
      expect(ledger.sequence_num).toBe(1);
      expect(ledger.balance_after_cents).toBe(3000);
    });

    it('3.3 permits genuine third party to remix 3-hop derivative (A -> B -> C -> Frank)', async () => {
      const db = createSqliteD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES 
          ('bp_1', 'alice', NULL, 'Alice Root'),
          ('bp_2', 'bob', 'bp_1', 'Bob Derivative'),
          ('bp_3', 'charlie', 'bp_2', 'Charlie Derivative')
      `).run();

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_3',
        parentCreatorId: 'charlie',
        remixerUserId: 'frank_genuine',
        missionId: 'mis_frank_3hop',
        revenueCents: 20000,
        royaltyPercent: 15,
      });

      expect(res.success).toBe(true);
      expect(res.royaltyCents).toBe(3000);
      expect(res.creatorId).toBe('charlie');
    });

    it('3.4 permits genuine third party to remix 5-hop derivative (A -> B -> C -> D -> E -> Frank)', async () => {
      const db = createSqliteD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES 
          ('bp_1', 'alice', NULL, 'Alice Root'),
          ('bp_2', 'bob', 'bp_1', 'Bob Deriv'),
          ('bp_3', 'charlie', 'bp_2', 'Charlie Deriv'),
          ('bp_4', 'dave', 'bp_3', 'Dave Deriv'),
          ('bp_5', 'eve', 'bp_4', 'Eve Deriv')
      `).run();

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_5',
        parentCreatorId: 'eve',
        remixerUserId: 'frank_genuine',
        missionId: 'mis_frank_5hop',
        revenueCents: 10000,
        royaltyPercent: 12,
      });

      expect(res.success).toBe(true);
      expect(res.royaltyCents).toBe(1200);
      expect(res.creatorId).toBe('eve');

      const ledger = db.raw.prepare('SELECT * FROM creator_earnings_ledger WHERE creator_id = ?').get('eve') as any;
      expect(ledger.amount_cents).toBe(1200);
      expect(ledger.sequence_num).toBe(1);
    });

    it('3.5 permits genuine third party to remix 8-hop derivative chain', async () => {
      const db = createSqliteD1();

      const creators = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];
      for (let i = 0; i < creators.length; i++) {
        db.raw.prepare(`
          INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
          VALUES (?, ?, ?, ?)
        `).run(`bp_${i}`, creators[i], i === 0 ? null : `bp_${i - 1}`, `Title ${i}`);
      }

      // Frank remixes bp_7 (depth 8)
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_7',
        parentCreatorId: 'c7',
        remixerUserId: 'frank_genuine',
        missionId: 'mis_frank_8hop',
        revenueCents: 10000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(true);
      expect(res.royaltyCents).toBe(1000);
      expect(res.creatorId).toBe('c7');

      // However, if c0 (root) attempts to remix bp_7, it must be rejected!
      const resC0 = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_7',
        parentCreatorId: 'c7',
        remixerUserId: 'c0',
        missionId: 'mis_c0_loop',
        revenueCents: 10000,
        royaltyPercent: 10,
      });

      expect(resC0.success).toBe(false);
      expect(resC0.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. Edge Cases, Dangling Pointers & Boundary Conditions
  // ══════════════════════════════════════════════════════════════════════════
  describe('4. Edge Cases & Boundary Conditions', () => {
    it('4.1 handles non-existent blueprintId (dangling blueprint)', async () => {
      const db = createSqliteD1();

      const isCycle = await isCircularAncestorRemix(db, 'non_existent_bp', 'alice');
      expect(isCycle).toBe(false);
    });

    it('4.2 handles broken parent pointer (parent_blueprint_id points to non-existent blueprint)', async () => {
      const db = createSqliteD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES ('bp_broken', 'bob', 'non_existent_parent', 'Broken Parent BP')
      `).run();

      // Alice is not in chain
      const isCycleAlice = await isCircularAncestorRemix(db, 'bp_broken', 'alice');
      expect(isCycleAlice).toBe(false);

      // Bob is the direct creator
      const isCycleBob = await isCircularAncestorRemix(db, 'bp_broken', 'bob');
      expect(isCycleBob).toBe(true);
    });

    it('4.3 handles empty blueprintId or remixerUserId gracefully', async () => {
      const db = createSqliteD1();

      expect(await isCircularAncestorRemix(db, '', 'alice')).toBe(false);
      expect(await isCircularAncestorRemix(db, 'bp_1', '')).toBe(false);
    });

    it('4.4 handles null or empty creator_id in ancestor blueprints without false rejection', async () => {
      const db = createSqliteD1();

      db.raw.prepare(`
        INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
        VALUES 
          ('bp_null_creator', NULL, NULL, 'Orphan Root'),
          ('bp_child', 'bob', 'bp_null_creator', 'Bob BP')
      `).run();

      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_child',
        parentCreatorId: 'bob',
        remixerUserId: 'frank',
        missionId: 'mis_orphan',
        revenueCents: 5000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(true);
      expect(res.royaltyCents).toBe(500);
    });

    it('4.5 observes maxDepth limit behavior for ultra-deep chains (>10 hops)', async () => {
      const db = createSqliteD1();

      // Create a 15-hop chain: bp_0 (c0) -> bp_1 (c1) -> ... -> bp_14 (c14)
      for (let i = 0; i <= 14; i++) {
        db.raw.prepare(`
          INSERT INTO campaign_blueprints (id, creator_id, parent_blueprint_id, title)
          VALUES (?, ?, ?, ?)
        `).run(`bp_deep_${i}`, `creator_${i}`, i === 0 ? null : `bp_deep_${i - 1}`, `Deep BP ${i}`);
      }

      // With default maxDepth = 10, checking bp_deep_14 traverses up to bp_deep_5 (10 steps).
      // creator_14, creator_13, ..., creator_5 are detected.
      // creator_0 (14 hops back) is beyond default maxDepth = 10.
      const detectedNear = await isCircularAncestorRemix(db, 'bp_deep_14', 'creator_8');
      expect(detectedNear).toBe(true);

      // Specifying custom maxDepth = 20 allows detecting creator_0
      const detectedDeepWithCustomDepth = await isCircularAncestorRemix(db, 'bp_deep_14', 'creator_0', 20);
      expect(detectedDeepWithCustomDepth).toBe(true);

      // Third party is never falsely rejected regardless of depth
      const thirdParty = await isCircularAncestorRemix(db, 'bp_deep_14', 'frank_unrelated', 20);
      expect(thirdParty).toBe(false);
    });
  });
});
