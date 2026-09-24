/**
 * Challenger M2 Adversarial Stress Test Suite: Enterprise Audit Vault Cryptographic Hash-Chain
 *
 * EMPIRICAL ADVERSARIAL VERIFICATION:
 * 1. 10-Event Sequential Baseline Chain Verification
 * 2. Intermediate Event Tamper Pinpointing:
 *    - Payload tampering (exact index detection)
 *    - Timestamp tampering (exact index detection)
 *    - Actor tampering (exact index detection)
 *    - Predecessor hash (prev_hash) link corruption (exact index detection)
 * 3. Genesis Event Tamper Pinpointing (prev_hash != null)
 * 4. Out-of-Order / Backdated Event Insertion Detection
 * 5. Concurrent Collisions / Forking Attack Detection
 * 6. Avalanche Effect across All Fields (Single-byte modification detection)
 *
 * Layer: tree (Adversarial Test Suite)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  recordEnterpriseAuditEvent,
  verifyEnterpriseAuditChain,
  computeEnterpriseContentHash,
  canonicalJson,
} from '../enterprise-audit-vault';
import { AUDIT_ACTIONS } from '@/seed/types/enterprise-audit';

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

function createAdversarialD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS enterprise_audit_events (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      actor_id TEXT NOT NULL,
      actor_email TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      payload TEXT NOT NULL DEFAULT '{}',
      prev_hash TEXT,
      content_hash TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_eae_org_ts ON enterprise_audit_events(org_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_eae_action ON enterprise_audit_events(action);
    CREATE INDEX IF NOT EXISTS idx_eae_actor ON enterprise_audit_events(actor_id);
    CREATE INDEX IF NOT EXISTS idx_eae_content_hash ON enterprise_audit_events(content_hash);
    CREATE INDEX IF NOT EXISTS idx_eae_prev_hash ON enterprise_audit_events(prev_hash);
  `);

  return {
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() =>
              stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() =>
          stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;
}

describe('Challenger M2: Cryptographic Hash-Chain Adversarial Verification', () => {
  let db: D1Database;
  const TEST_ORG = 'org_enterprise_adversarial_test';

  beforeEach(() => {
    db = createAdversarialD1();
  });

  describe('1. 10-Event Hash Chain Construction & Baseline Verification', () => {
    it('creates 10 cryptographically linked events and validates 100% chain integrity', async () => {
      const insertedEvents = [];
      const baseTime = 1710000000;

      for (let i = 0; i < 10; i++) {
        const ev = await recordEnterpriseAuditEvent(db, {
          orgId: TEST_ORG,
          actorId: `usr_actor_${i}`,
          actorEmail: `actor${i}@acme-corp.com`,
          action: i === 0 ? AUDIT_ACTIONS.SSO_CONFIGURED : AUDIT_ACTIONS.VIDEO_PUBLISHED,
          resourceType: i === 0 ? 'sso_config' : 'video_job',
          resourceId: `res_${i}`,
          payload: { step: i, meta: `payload_data_${i}`, credits: (i + 1) * 100 },
          timestamp: baseTime + i * 60,
        });
        insertedEvents.push(ev);
      }

      // Assert each event points to its predecessor
      expect(insertedEvents[0].prevHash).toBeNull();
      for (let i = 1; i < 10; i++) {
        expect(insertedEvents[i].prevHash).toBe(insertedEvents[i - 1].contentHash);
      }

      // Verify chain
      const result = await verifyEnterpriseAuditChain(db, TEST_ORG);
      expect(result.valid).toBe(true);
      expect(result.totalEvents).toBe(10);
      expect(result.tamperedIndex).toBeUndefined();
      expect(result.tamperedEventId).toBeUndefined();
      expect(result.genesisHash).toBe(insertedEvents[0].contentHash);
      expect(result.latestHash).toBe(insertedEvents[9].contentHash);
    });
  });

  describe('2. Adversarial Tamper Pinpointing: 10-Event Chain Attacks', () => {
    let eventIds: string[] = [];
    const baseTime = 1710000000;

    beforeEach(async () => {
      eventIds = [];
      for (let i = 0; i < 10; i++) {
        const ev = await recordEnterpriseAuditEvent(db, {
          orgId: TEST_ORG,
          actorId: `usr_actor_${i}`,
          actorEmail: `actor${i}@acme-corp.com`,
          action: i % 2 === 0 ? AUDIT_ACTIONS.VIDEO_APPROVED : AUDIT_ACTIONS.PAYOUT_APPROVED,
          resourceType: 'audit_resource',
          resourceId: `res_${i}`,
          payload: { index: i, amountUsd: (i + 1) * 25 },
          timestamp: baseTime + i * 100,
        });
        eventIds.push(ev.id);
      }
    });

    it('ADVERSARIAL ATTACK A: Modifying payload at intermediate index (index 4) is detected immediately', async () => {
      const targetIndex = 4;
      const targetId = eventIds[targetIndex];

      // Simulate malicious attacker secretly modifying payout from $125 to $99999
      await db
        .prepare('UPDATE enterprise_audit_events SET payload = ?1 WHERE id = ?2')
        .bind(JSON.stringify({ index: 4, amountUsd: 99999 }), targetId)
        .run();

      const verification = await verifyEnterpriseAuditChain(db, TEST_ORG);
      expect(verification.valid).toBe(false);
      expect(verification.totalEvents).toBe(10);
      expect(verification.tamperedIndex).toBe(targetIndex);
      expect(verification.tamperedEventId).toBe(targetId);
      expect(verification.reason).toContain(`Tampered content at index ${targetIndex}`);
    });

    it('ADVERSARIAL ATTACK B: Modifying timestamp at intermediate index (index 7) is detected immediately', async () => {
      const targetIndex = 7;
      const targetId = eventIds[targetIndex];

      // Simulate attacker spoofing timestamp to cover up off-hours activity
      await db
        .prepare('UPDATE enterprise_audit_events SET timestamp = ?1 WHERE id = ?2')
        .bind(baseTime + targetIndex * 100 + 5, targetId)
        .run();

      const verification = await verifyEnterpriseAuditChain(db, TEST_ORG);
      expect(verification.valid).toBe(false);
      expect(verification.totalEvents).toBe(10);
      expect(verification.tamperedIndex).toBe(targetIndex);
      expect(verification.tamperedEventId).toBe(targetId);
      expect(verification.reason).toContain(`Tampered content at index ${targetIndex}`);
    });

    it('ADVERSARIAL ATTACK C: Modifying actor at intermediate index (index 2) is detected immediately', async () => {
      const targetIndex = 2;
      const targetId = eventIds[targetIndex];

      // Simulate attacker re-attributing action to a different actor ID
      await db
        .prepare('UPDATE enterprise_audit_events SET actor_id = ?1 WHERE id = ?2')
        .bind('usr_impersonated_innocent_user', targetId)
        .run();

      const verification = await verifyEnterpriseAuditChain(db, TEST_ORG);
      expect(verification.valid).toBe(false);
      expect(verification.totalEvents).toBe(10);
      expect(verification.tamperedIndex).toBe(targetIndex);
      expect(verification.tamperedEventId).toBe(targetId);
      expect(verification.reason).toContain(`Tampered content at index ${targetIndex}`);
    });

    it('ADVERSARIAL ATTACK D: Modifying prev_hash of intermediate event (index 6) breaks the hash chain link', async () => {
      const targetIndex = 6;
      const targetId = eventIds[targetIndex];

      // Simulate attacker forging a graft/predecessor hash
      const forgedHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      await db
        .prepare('UPDATE enterprise_audit_events SET prev_hash = ?1 WHERE id = ?2')
        .bind(forgedHash, targetId)
        .run();

      const verification = await verifyEnterpriseAuditChain(db, TEST_ORG);
      expect(verification.valid).toBe(false);
      expect(verification.totalEvents).toBe(10);
      expect(verification.tamperedIndex).toBe(targetIndex);
      expect(verification.tamperedEventId).toBe(targetId);
      expect(verification.reason).toContain(`Broken hash link at index ${targetIndex}`);
    });

    it('ADVERSARIAL ATTACK E: Modifying genesis event (index 0) contentHash invalidates subsequent link', async () => {
      const genesisId = eventIds[0];

      // Tamper genesis actor
      await db
        .prepare('UPDATE enterprise_audit_events SET actor_id = ?1 WHERE id = ?2')
        .bind('usr_evil_root', genesisId)
        .run();

      const verification = await verifyEnterpriseAuditChain(db, TEST_ORG);
      expect(verification.valid).toBe(false);
      expect(verification.tamperedIndex).toBe(0);
      expect(verification.tamperedEventId).toBe(genesisId);
      expect(verification.reason).toContain('Tampered content at index 0');
    });

    it('ADVERSARIAL ATTACK F: Modifying genesis event prev_hash from null to forged hash flags index 0', async () => {
      const genesisId = eventIds[0];

      await db
        .prepare('UPDATE enterprise_audit_events SET prev_hash = ?1 WHERE id = ?2')
        .bind('fake_non_null_hash', genesisId)
        .run();

      const verification = await verifyEnterpriseAuditChain(db, TEST_ORG);
      expect(verification.valid).toBe(false);
      expect(verification.tamperedIndex).toBe(0);
      expect(verification.tamperedEventId).toBe(genesisId);
      expect(verification.reason).toContain('Genesis event at index 0 must have prev_hash = null');
    });
  });

  describe('3. Out-of-Order Insertion & Backdating Stress Test', () => {
    it('detects backdated event insertion that breaks temporal/hash integrity', async () => {
      // 1. Record 3 events at timestamps 1000, 2000, 3000
      const e0 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_temporal',
        actorId: 'usr_1',
        action: AUDIT_ACTIONS.APIKEY_CREATED,
        resourceType: 'api_key',
        timestamp: 1000,
      });

      const e1 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_temporal',
        actorId: 'usr_2',
        action: AUDIT_ACTIONS.VIDEO_APPROVED,
        resourceType: 'video',
        timestamp: 2000,
      });

      const e2 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_temporal',
        actorId: 'usr_3',
        action: AUDIT_ACTIONS.VIDEO_PUBLISHED,
        resourceType: 'video',
        timestamp: 3000,
      });

      // 2. An adversarial backdated event is inserted with timestamp 1500 (between e0 and e1)
      // When recordEnterpriseAuditEvent runs, it queried latest event (which was e2 at ts 3000)
      const eBackdated = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_temporal',
        actorId: 'usr_intruder',
        action: AUDIT_ACTIONS.RBAC_ROLE_CHANGED,
        resourceType: 'role',
        timestamp: 1500, // backdated
      });

      // 3. Verification sorts by timestamp ASC: e0 (1000) -> eBackdated (1500) -> e1 (2000) -> e2 (3000)
      // eBackdated was chained to e2's hash, but chronologically sits at index 1 after e0.
      const verification = await verifyEnterpriseAuditChain(db, 'org_temporal');
      expect(verification.valid).toBe(false);
      expect(verification.tamperedIndex).toBe(1);
      expect(verification.tamperedEventId).toBe(eBackdated.id);
      expect(verification.reason).toContain('Broken hash link at index 1');
    });

    it('detects forged out-of-order manual SQL injection', async () => {
      const e0 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_manual_inject',
        actorId: 'usr_1',
        action: AUDIT_ACTIONS.MCU_ALLOCATED,
        resourceType: 'credits',
        timestamp: 1000,
      });

      const e1 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_manual_inject',
        actorId: 'usr_2',
        action: AUDIT_ACTIONS.PAYOUT_APPROVED,
        resourceType: 'payout',
        timestamp: 2000,
      });

      // Attacker tries to manually inject an event between e0 and e1 into D1
      // with a fabricated content_hash that does not link into e1
      const forgedId = 'injected_rogue_event_id';
      const fakeHash = computeEnterpriseContentHash(e0.contentHash, 1500, 'INJECTED_ACTION', 'usr_hacker', {});

      await db
        .prepare(`
          INSERT INTO enterprise_audit_events (
            id, org_id, actor_id, action, resource_type, payload,
            prev_hash, content_hash, timestamp, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        `)
        .bind(
          forgedId,
          'org_manual_inject',
          'usr_hacker',
          'INJECTED_ACTION',
          'rogue',
          '{}',
          e0.contentHash,
          fakeHash,
          1500,
          1500,
        )
        .run();

      // Now order by timestamp ASC:
      // index 0: e0 (ts 1000)
      // index 1: forged (ts 1500, prev_hash: e0.contentHash) -> valid hash
      // index 2: e1 (ts 2000, prev_hash: e0.contentHash) -> BUT expected prev_hash is forged.contentHash!
      const verification = await verifyEnterpriseAuditChain(db, 'org_manual_inject');
      expect(verification.valid).toBe(false);
      expect(verification.tamperedIndex).toBe(2);
      expect(verification.tamperedEventId).toBe(e1.id);
      expect(verification.reason).toContain('Broken hash link at index 2');
    });
  });

  describe('4. Concurrent Collisions & Forking Race Conditions', () => {
    it('detects chain bifurcation when two concurrent transactions claim identical prev_hash', async () => {
      // 1. Genesis event
      const e0 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_concurrent',
        actorId: 'usr_init',
        action: AUDIT_ACTIONS.SSO_CONFIGURED,
        resourceType: 'sso',
        timestamp: 1000,
      });

      // 2. Simulate two concurrent workers (Worker A and Worker B)
      // Both read e0 as the latest event at the exact same moment.
      const tsA = 1001;
      const tsB = 1002;
      const hashA = computeEnterpriseContentHash(e0.contentHash, tsA, AUDIT_ACTIONS.VIDEO_APPROVED, 'usr_worker_a', { worker: 'A' });
      const hashB = computeEnterpriseContentHash(e0.contentHash, tsB, AUDIT_ACTIONS.VIDEO_APPROVED, 'usr_worker_b', { worker: 'B' });

      // Worker A writes
      await db.prepare(`
        INSERT INTO enterprise_audit_events (id, org_id, actor_id, action, resource_type, payload, prev_hash, content_hash, timestamp, created_at)
        VALUES ('ev_worker_a', 'org_concurrent', 'usr_worker_a', '${AUDIT_ACTIONS.VIDEO_APPROVED}', 'video', '{"worker":"A"}', ?1, ?2, ?3, ?4)
      `).bind(e0.contentHash, hashA, tsA, tsA).run();

      // Worker B writes (colliding on prev_hash)
      await db.prepare(`
        INSERT INTO enterprise_audit_events (id, org_id, actor_id, action, resource_type, payload, prev_hash, content_hash, timestamp, created_at)
        VALUES ('ev_worker_b', 'org_concurrent', 'usr_worker_b', '${AUDIT_ACTIONS.VIDEO_APPROVED}', 'video', '{"worker":"B"}', ?1, ?2, ?3, ?4)
      `).bind(e0.contentHash, hashB, tsB, tsB).run();

      // 3. Verification traverses in timestamp order:
      // index 0: e0
      // index 1: ev_worker_a (prev_hash == e0.contentHash) -> OK, expectedPrevHash becomes hashA
      // index 2: ev_worker_b (prev_hash == e0.contentHash, expected == hashA) -> CONFLICT!
      const verification = await verifyEnterpriseAuditChain(db, 'org_concurrent');
      expect(verification.valid).toBe(false);
      expect(verification.tamperedIndex).toBe(2);
      expect(verification.tamperedEventId).toBe('ev_worker_b');
      expect(verification.reason).toContain('Broken hash link at index 2');
    });
  });

  describe('5. Cryptographic Avalanche & Precision Stress', () => {
    it('generates distinct contentHash when a single bit/character in payload changes', () => {
      const h1 = computeEnterpriseContentHash('prev', 1000, 'action', 'actor', { count: 1 });
      const h2 = computeEnterpriseContentHash('prev', 1000, 'action', 'actor', { count: 2 });
      const h3 = computeEnterpriseContentHash('prev', 1000, 'action', 'actor', { count: '1' });

      expect(h1).not.toBe(h2);
      expect(h1).not.toBe(h3);
      expect(h2).not.toBe(h3);
    });

    it('guarantees key ordering insensitivity in deeply nested objects', () => {
      const deep1 = { a: { b: { c: [1, 2, { y: 2, x: 1 }] } }, z: 'last' };
      const deep2 = { z: 'last', a: { b: { c: [1, 2, { x: 1, y: 2 }] } } };

      expect(canonicalJson(deep1)).toBe(canonicalJson(deep2));
      const hash1 = computeEnterpriseContentHash('prev', 1000, 'act', 'usr', deep1);
      const hash2 = computeEnterpriseContentHash('prev', 1000, 'act', 'usr', deep2);
      expect(hash1).toBe(hash2);
    });
  });
});
