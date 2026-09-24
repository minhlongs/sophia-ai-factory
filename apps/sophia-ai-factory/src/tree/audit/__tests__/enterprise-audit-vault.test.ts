/**
 * Unit & Integration Tests for Cryptographic Hash-Chain Audit Vault
 *
 * Verifies:
 * 1. Canonical deterministic JSON serialization
 * 2. Deterministic content hash generation and avalanche effect
 * 3. Atomic event recording and sequential hash chaining
 * 4. Cryptographic chain integrity verification & tamper pinpointing
 * 5. Multi-field filtering and pagination queries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  canonicalJson,
  computeEnterpriseContentHash,
  recordEnterpriseAuditEvent,
  verifyEnterpriseAuditChain,
  queryEnterpriseAuditEvents,
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

function createTestD1(): D1Database {
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

describe('Enterprise Cryptographic Audit Vault', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestD1();
  });

  describe('1. Canonical Deterministic JSON Serialization', () => {
    it('produces identical string regardless of key insertion order', () => {
      const objA = { z: 1, a: 'test', m: { b: 2, a: 1 } };
      const objB = { a: 'test', m: { a: 1, b: 2 }, z: 1 };

      expect(canonicalJson(objA)).toBe(canonicalJson(objB));
      expect(canonicalJson(objA)).toBe('{"a":"test","m":{"a":1,"b":2},"z":1}');
    });

    it('handles primitive values, arrays, and null correctly', () => {
      expect(canonicalJson(null)).toBe('null');
      expect(canonicalJson(123)).toBe('123');
      expect(canonicalJson('hello')).toBe('"hello"');
      expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
      expect(canonicalJson([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
    });

    it('omits undefined properties deterministically', () => {
      const objA = { a: 1, b: undefined };
      const objB = { a: 1 };
      expect(canonicalJson(objA)).toBe(canonicalJson(objB));
    });
  });

  describe('2. Canonical Hash Formula & Avalanche Effect', () => {
    it('computes a 64-character hexadecimal SHA-256 hash', () => {
      const hash = computeEnterpriseContentHash(
        null,
        1700000000,
        AUDIT_ACTIONS.VIDEO_PUBLISHED,
        'usr_123',
        { videoId: 'vid_999' },
      );

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is completely deterministic for identical inputs', () => {
      const hash1 = computeEnterpriseContentHash(
        'prev_hash_1',
        1700000000,
        AUDIT_ACTIONS.MCU_ALLOCATED,
        'usr_admin',
        { credits: 500, note: 'monthly topup' },
      );

      const hash2 = computeEnterpriseContentHash(
        'prev_hash_1',
        1700000000,
        AUDIT_ACTIONS.MCU_ALLOCATED,
        'usr_admin',
        { note: 'monthly topup', credits: 500 }, // reordered payload keys
      );

      expect(hash1).toBe(hash2);
    });

    it('alters hash when any field changes (avalanche effect)', () => {
      const baseHash = computeEnterpriseContentHash(
        'prev_hash',
        1700000000,
        AUDIT_ACTIONS.APIKEY_CREATED,
        'usr_1',
        { keyName: 'production' },
      );

      // Changed timestamp
      const hashTimestamp = computeEnterpriseContentHash(
        'prev_hash',
        1700000001,
        AUDIT_ACTIONS.APIKEY_CREATED,
        'usr_1',
        { keyName: 'production' },
      );
      expect(hashTimestamp).not.toBe(baseHash);

      // Changed actor
      const hashActor = computeEnterpriseContentHash(
        'prev_hash',
        1700000000,
        AUDIT_ACTIONS.APIKEY_CREATED,
        'usr_2',
        { keyName: 'production' },
      );
      expect(hashActor).not.toBe(baseHash);

      // Changed action
      const hashAction = computeEnterpriseContentHash(
        'prev_hash',
        1700000000,
        AUDIT_ACTIONS.APIKEY_REVOKED,
        'usr_1',
        { keyName: 'production' },
      );
      expect(hashAction).not.toBe(baseHash);

      // Changed payload
      const hashPayload = computeEnterpriseContentHash(
        'prev_hash',
        1700000000,
        AUDIT_ACTIONS.APIKEY_CREATED,
        'usr_1',
        { keyName: 'staging' },
      );
      expect(hashPayload).not.toBe(baseHash);
    });
  });

  describe('3. Event Recording & Hash Chaining', () => {
    it('records genesis event with prevHash = null', async () => {
      const event = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_acme',
        actorId: 'usr_owner',
        actorEmail: 'owner@acme.com',
        action: AUDIT_ACTIONS.SSO_CONFIGURED,
        resourceType: 'sso_config',
        payload: { domain: 'acme.com', provider: 'saml' },
      });

      expect(event.prevHash).toBeNull();
      expect(event.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(event.action).toBe(AUDIT_ACTIONS.SSO_CONFIGURED);
    });

    it('atomically links sequential events in the hash chain', async () => {
      // Event 1 (Genesis)
      const e1 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_acme',
        actorId: 'usr_1',
        action: AUDIT_ACTIONS.MCU_ALLOCATED,
        resourceType: 'credits',
        payload: { amount: 1000 },
        timestamp: 1700000000,
      });

      expect(e1.prevHash).toBeNull();

      // Event 2
      const e2 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_acme',
        actorId: 'usr_2',
        action: AUDIT_ACTIONS.VIDEO_APPROVED,
        resourceType: 'video',
        payload: { videoId: 'v1' },
        timestamp: 1700000010,
      });

      expect(e2.prevHash).toBe(e1.contentHash);

      // Event 3
      const e3 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_acme',
        actorId: 'usr_3',
        action: AUDIT_ACTIONS.VIDEO_PUBLISHED,
        resourceType: 'video',
        payload: { videoId: 'v1', channel: 'youtube' },
        timestamp: 1700000020,
      });

      expect(e3.prevHash).toBe(e2.contentHash);
    });
  });

  describe('4. Cryptographic Chain Verification & Tamper Detection', () => {
    it('validates an empty chain as valid', async () => {
      const result = await verifyEnterpriseAuditChain(db, 'org_empty');
      expect(result.valid).toBe(true);
      expect(result.totalEvents).toBe(0);
      expect(result.genesisHash).toBeNull();
      expect(result.latestHash).toBeNull();
    });

    it('successfully validates an untampered multi-event chain', async () => {
      const e1 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_valid',
        actorId: 'usr_1',
        action: AUDIT_ACTIONS.APIKEY_CREATED,
        resourceType: 'api_key',
        payload: { name: 'key1' },
        timestamp: 1700000001,
      });

      const e2 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_valid',
        actorId: 'usr_2',
        action: AUDIT_ACTIONS.VIDEO_APPROVED,
        resourceType: 'video',
        payload: { videoId: 'vid1' },
        timestamp: 1700000002,
      });

      const e3 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_valid',
        actorId: 'usr_3',
        action: AUDIT_ACTIONS.VIDEO_PUBLISHED,
        resourceType: 'video',
        payload: { videoId: 'vid1' },
        timestamp: 1700000003,
      });

      const result = await verifyEnterpriseAuditChain(db, 'org_valid');
      expect(result.valid).toBe(true);
      expect(result.totalEvents).toBe(3);
      expect(result.genesisHash).toBe(e1.contentHash);
      expect(result.latestHash).toBe(e3.contentHash);
    });

    it('pinpoints tampered payload at exact index', async () => {
      await recordEnterpriseAuditEvent(db, {
        orgId: 'org_tamper',
        actorId: 'usr_1',
        action: AUDIT_ACTIONS.MCU_ALLOCATED,
        resourceType: 'quota',
        payload: { granted: 100 },
        timestamp: 1700000001,
      });

      const e2 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_tamper',
        actorId: 'usr_2',
        action: AUDIT_ACTIONS.PAYOUT_APPROVED,
        resourceType: 'payout',
        payload: { amountUsd: 50 },
        timestamp: 1700000002,
      });

      await recordEnterpriseAuditEvent(db, {
        orgId: 'org_tamper',
        actorId: 'usr_3',
        action: AUDIT_ACTIONS.VIDEO_PUBLISHED,
        resourceType: 'video',
        payload: { status: 'published' },
        timestamp: 1700000003,
      });

      // Illegally modify payload in DB directly
      await db
        .prepare("UPDATE enterprise_audit_events SET payload = '{\"amountUsd\":50000}' WHERE id = ?1")
        .bind(e2.id)
        .run();

      const result = await verifyEnterpriseAuditChain(db, 'org_tamper');
      expect(result.valid).toBe(false);
      expect(result.tamperedIndex).toBe(1);
      expect(result.tamperedEventId).toBe(e2.id);
      expect(result.reason).toContain('Tampered content at index 1');
    });

    it('pinpoints broken hash chain link when predecessor hash is altered', async () => {
      await recordEnterpriseAuditEvent(db, {
        orgId: 'org_broken',
        actorId: 'usr_1',
        action: AUDIT_ACTIONS.SSO_CONFIGURED,
        resourceType: 'sso',
        timestamp: 1700000001,
      });

      const e2 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_broken',
        actorId: 'usr_2',
        action: AUDIT_ACTIONS.BRANDING_UPDATED,
        resourceType: 'branding',
        timestamp: 1700000002,
      });

      // Illegally corrupt prev_hash of e2
      await db
        .prepare('UPDATE enterprise_audit_events SET prev_hash = ?1 WHERE id = ?2')
        .bind('forged_non_matching_hash_value', e2.id)
        .run();

      const result = await verifyEnterpriseAuditChain(db, 'org_broken');
      expect(result.valid).toBe(false);
      expect(result.tamperedIndex).toBe(1);
      expect(result.tamperedEventId).toBe(e2.id);
      expect(result.reason).toContain('Broken hash link at index 1');
    });

    it('rejects genesis event with non-null prev_hash', async () => {
      const e1 = await recordEnterpriseAuditEvent(db, {
        orgId: 'org_genesis_tamper',
        actorId: 'usr_1',
        action: AUDIT_ACTIONS.SSO_CONFIGURED,
        resourceType: 'sso',
        timestamp: 1700000001,
      });

      await db
        .prepare('UPDATE enterprise_audit_events SET prev_hash = ?1 WHERE id = ?2')
        .bind('fake_predecessor_hash', e1.id)
        .run();

      const result = await verifyEnterpriseAuditChain(db, 'org_genesis_tamper');
      expect(result.valid).toBe(false);
      expect(result.tamperedIndex).toBe(0);
      expect(result.reason).toContain('Genesis event at index 0 must have prev_hash = null');
    });
  });

  describe('5. Audit Filtering & Pagination', () => {
    beforeEach(async () => {
      // Seed 5 events
      for (let i = 1; i <= 5; i++) {
        await recordEnterpriseAuditEvent(db, {
          orgId: i <= 3 ? 'org_alpha' : 'org_beta',
          actorId: `usr_${i}`,
          actorEmail: `user${i}@alpha.com`,
          action: i % 2 === 0 ? AUDIT_ACTIONS.VIDEO_PUBLISHED : AUDIT_ACTIONS.MCU_ALLOCATED,
          resourceType: i % 2 === 0 ? 'video' : 'quota',
          timestamp: 1700000000 + i * 100,
          payload: { step: i },
        });
      }
    });

    it('filters by organization ID', async () => {
      const resAlpha = await queryEnterpriseAuditEvents(db, { orgId: 'org_alpha' });
      expect(resAlpha.total).toBe(3);
      expect(resAlpha.events).toHaveLength(3);

      const resBeta = await queryEnterpriseAuditEvents(db, { orgId: 'org_beta' });
      expect(resBeta.total).toBe(2);
      expect(resBeta.events).toHaveLength(2);
    });

    it('filters by action', async () => {
      const res = await queryEnterpriseAuditEvents(db, {
        action: AUDIT_ACTIONS.VIDEO_PUBLISHED,
      });
      expect(res.total).toBe(2);
      res.events.forEach((e) => expect(e.action).toBe(AUDIT_ACTIONS.VIDEO_PUBLISHED));
    });

    it('filters by actor email partial match', async () => {
      const res = await queryEnterpriseAuditEvents(db, { actorEmail: 'user3' });
      expect(res.total).toBe(1);
      expect(res.events[0].actorEmail).toBe('user3@alpha.com');
    });

    it('filters by timestamp range', async () => {
      const res = await queryEnterpriseAuditEvents(db, {
        fromTimestamp: 1700000200,
        toTimestamp: 1700000400,
      });
      expect(res.total).toBe(3);
    });

    it('paginates results with limit and offset', async () => {
      const page1 = await queryEnterpriseAuditEvents(db, { limit: 2, offset: 0 });
      expect(page1.events).toHaveLength(2);
      expect(page1.total).toBe(5);

      const page2 = await queryEnterpriseAuditEvents(db, { limit: 2, offset: 2 });
      expect(page2.events).toHaveLength(2);
      expect(page2.events[0].id).not.toBe(page1.events[0].id);

      const page3 = await queryEnterpriseAuditEvents(db, { limit: 2, offset: 4 });
      expect(page3.events).toHaveLength(1);
    });
  });
});
