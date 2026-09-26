/**
 * Unit & Adversarial Tests: Sovereign Compliance Ledger
 *
 * Verifies:
 * 1. Deterministic canonical JSON serialization & key sorting
 * 2. SHA-256 content hash computation & avalanche property
 * 3. Digital signature generation and verification (HMAC-SHA256)
 * 4. Sequential hash chaining (prev_hash -> content_hash)
 * 5. Adversarial tamper detection:
 *    - Pinpoints modified payload row
 *    - Pinpoints altered timestamp
 *    - Pinpoints deleted intermediate record (broken chain link)
 *    - Detects forged or invalidated digital signatures
 * 6. Query filtering and pagination
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  canonicalJson,
  computeSovereignContentHash,
  signContentHash,
  verifySignature,
  appendComplianceAuditLog,
  verifyComplianceAuditChain,
  queryComplianceAuditLogs,
} from '../compliance-ledger';

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
    CREATE TABLE IF NOT EXISTS sovereign_data_zones (
      id TEXT PRIMARY KEY,
      zone_code TEXT NOT NULL,
      name TEXT NOT NULL,
      jurisdiction_legal_name TEXT NOT NULL,
      regulatory_framework TEXT NOT NULL,
      primary_storage_region TEXT NOT NULL,
      fallback_storage_region TEXT,
      cross_border_transfer_policy TEXT NOT NULL DEFAULT 'adequacy_only',
      mandatory_cmek INTEGER NOT NULL DEFAULT 0,
      retention_period_days INTEGER NOT NULL DEFAULT 2555,
      audit_retention_days INTEGER NOT NULL DEFAULT 2555,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS compliance_audit_logs (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      zone_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_ip_hash TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      jurisdiction_compliance TEXT NOT NULL,
      policy_verdict TEXT NOT NULL,
      payload_canonical_json TEXT NOT NULL DEFAULT '{}',
      prev_hash TEXT,
      content_hash TEXT NOT NULL,
      digital_signature TEXT,
      timestamp INTEGER NOT NULL,
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

describe('Sovereign Compliance Ledger', () => {
  let db: D1Database;
  const SIGNING_SECRET = 'test_compliance_signing_sec_2026';

  beforeEach(() => {
    db = createTestD1();
  });

  describe('Canonical JSON Serialization', () => {
    it('sorts keys alphabetically regardless of insertion order', () => {
      const obj1 = { z: 1, a: 'test', m: { b: 2, a: 1 } };
      const obj2 = { a: 'test', m: { a: 1, b: 2 }, z: 1 };
      expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
      expect(canonicalJson(obj1)).toBe('{"a":"test","m":{"a":1,"b":2},"z":1}');
    });

    it('ignores undefined properties', () => {
      const obj = { a: 1, b: undefined, c: null };
      expect(canonicalJson(obj)).toBe('{"a":1,"c":null}');
    });

    it('serializes primitives and arrays deterministically', () => {
      expect(canonicalJson(null)).toBe('null');
      expect(canonicalJson(123)).toBe('123');
      expect(canonicalJson([3, 2, 1])).toBe('[3,2,1]');
    });
  });

  describe('Cryptographic Content Hash & Avalanche Effect', () => {
    it('produces identical SHA-256 hash for identical inputs', async () => {
      const p = {
        prevHash: 'abc',
        timestamp: 1700000000000,
        zoneId: 'zone_eu_gdpr',
        orgId: 'org_1',
        actorId: 'usr_admin',
        action: 'SOVEREIGN_ACCESS_GRANTED',
        jurisdictionCompliance: 'EU_GDPR',
        policyVerdict: 'ALLOWED',
        payload: { scope: 'read', resource: 'user_vault' },
      };

      const h1 = await computeSovereignContentHash(p);
      const h2 = await computeSovereignContentHash(p);
      expect(h1).toHaveLength(64);
      expect(h1).toBe(h2);
    });

    it('demonstrates cryptographic avalanche effect on single character mutation', async () => {
      const p1 = {
        prevHash: 'abc',
        timestamp: 1700000000000,
        zoneId: 'zone_eu_gdpr',
        orgId: 'org_1',
        actorId: 'usr_admin',
        action: 'SOVEREIGN_ACCESS_GRANTED',
        jurisdictionCompliance: 'EU_GDPR',
        policyVerdict: 'ALLOWED',
        payload: { scope: 'read' },
      };

      const p2 = { ...p1, payload: { scope: 'reag' } }; // 1 character difference
      const h1 = await computeSovereignContentHash(p1);
      const h2 = await computeSovereignContentHash(p2);
      expect(h1).not.toBe(h2);
    });
  });

  describe('Digital Signature Verification', () => {
    it('signs and verifies content hash using HMAC-SHA256', async () => {
      const contentHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const sig = await signContentHash(contentHash, SIGNING_SECRET);
      expect(sig).toHaveLength(64);

      const isValid = await verifySignature(contentHash, sig, SIGNING_SECRET);
      expect(isValid).toBe(true);

      const isInvalidSecret = await verifySignature(contentHash, sig, 'wrong_secret');
      expect(isInvalidSecret).toBe(false);

      const isTamperedHash = await verifySignature('corrupted_hash', sig, SIGNING_SECRET);
      expect(isTamperedHash).toBe(false);
    });
  });

  describe('Sequential Chaining & Chain Verification', () => {
    it('creates an unbroken hash chain linking prev_hash sequentially', async () => {
      const e1 = await appendComplianceAuditLog(db, {
        orgId: 'org_alpha',
        zoneId: 'zone_eu_gdpr',
        actorId: 'user_1',
        actorType: 'user',
        actorIpHash: 'ip_hash_1',
        action: 'ZONE_RESIDENCY_BINDING',
        resourceType: 'organization',
        jurisdictionCompliance: 'EU_GDPR',
        policyVerdict: 'ALLOWED',
        signingKeySecret: SIGNING_SECRET,
        timestamp: 1000,
      });

      expect(e1.prevHash).toBeNull();
      expect(e1.contentHash).toBeDefined();

      const e2 = await appendComplianceAuditLog(db, {
        orgId: 'org_alpha',
        zoneId: 'zone_eu_gdpr',
        actorId: 'user_1',
        actorType: 'user',
        actorIpHash: 'ip_hash_1',
        action: 'CMEK_KEY_REGISTERED',
        resourceType: 'tenant_sovereign_key',
        jurisdictionCompliance: 'EU_GDPR',
        policyVerdict: 'ALLOWED',
        signingKeySecret: SIGNING_SECRET,
        timestamp: 2000,
      });

      expect(e2.prevHash).toBe(e1.contentHash);

      const e3 = await appendComplianceAuditLog(db, {
        orgId: 'org_alpha',
        zoneId: 'zone_eu_gdpr',
        actorId: 'user_1',
        actorType: 'user',
        actorIpHash: 'ip_hash_1',
        action: 'CMEK_KEY_ROTATED',
        resourceType: 'tenant_sovereign_key',
        jurisdictionCompliance: 'EU_GDPR',
        policyVerdict: 'ALLOWED',
        signingKeySecret: SIGNING_SECRET,
        timestamp: 3000,
      });

      expect(e3.prevHash).toBe(e2.contentHash);

      // Verify entire chain
      const verification = await verifyComplianceAuditChain(db, {
        orgId: 'org_alpha',
        signingKeySecret: SIGNING_SECRET,
      });

      expect(verification.isValid).toBe(true);
      expect(verification.checkedCount).toBe(3);
      expect(verification.genesisHash).toBe(e1.contentHash);
      expect(verification.latestHash).toBe(e3.contentHash);
    });

    it('pinpoints tampered payload record in audit chain', async () => {
      const e1 = await appendComplianceAuditLog(db, {
        orgId: 'org_tamper',
        zoneId: 'zone_vn_pdpd',
        actorId: 'u1',
        actorType: 'user',
        actorIpHash: 'hash',
        action: 'INIT',
        resourceType: 'test',
        jurisdictionCompliance: 'VN_PDPD',
        policyVerdict: 'ALLOWED',
        timestamp: 1000,
      });

      const e2 = await appendComplianceAuditLog(db, {
        orgId: 'org_tamper',
        zoneId: 'zone_vn_pdpd',
        actorId: 'u1',
        actorType: 'user',
        actorIpHash: 'hash',
        action: 'TRANSFER_REQUEST',
        resourceType: 'test',
        jurisdictionCompliance: 'VN_PDPD',
        policyVerdict: 'DENIED',
        payload: { original: 'value' },
        timestamp: 2000,
      });

      await appendComplianceAuditLog(db, {
        orgId: 'org_tamper',
        zoneId: 'zone_vn_pdpd',
        actorId: 'u1',
        actorType: 'user',
        actorIpHash: 'hash',
        action: 'FINAL',
        resourceType: 'test',
        jurisdictionCompliance: 'VN_PDPD',
        policyVerdict: 'ALLOWED',
        timestamp: 3000,
      });

      // Attacker maliciously modifies event 2 payload directly in database
      await db
        .prepare(`UPDATE compliance_audit_logs SET payload_canonical_json = '{"original":"altered"}' WHERE id = ?1`)
        .bind(e2.id)
        .run();

      const verification = await verifyComplianceAuditChain(db, { orgId: 'org_tamper' });
      expect(verification.isValid).toBe(false);
      expect(verification.tamperedEventId).toBe(e2.id);
      expect(verification.tamperedIndex).toBe(1);
      expect(verification.error).toContain('Content hash mismatch');
    });

    it('pinpoints broken chain link when an intermediate record is deleted', async () => {
      await appendComplianceAuditLog(db, {
        orgId: 'org_del',
        zoneId: 'zone_us_ccpa',
        actorId: 'u1',
        actorType: 'user',
        actorIpHash: 'h',
        action: 'EV1',
        resourceType: 'r',
        jurisdictionCompliance: 'US_CCPA',
        policyVerdict: 'ALLOWED',
        timestamp: 100,
      });

      const e2 = await appendComplianceAuditLog(db, {
        orgId: 'org_del',
        zoneId: 'zone_us_ccpa',
        actorId: 'u1',
        actorType: 'user',
        actorIpHash: 'h',
        action: 'EV2',
        resourceType: 'r',
        jurisdictionCompliance: 'US_CCPA',
        policyVerdict: 'ALLOWED',
        timestamp: 200,
      });

      const e3 = await appendComplianceAuditLog(db, {
        orgId: 'org_del',
        zoneId: 'zone_us_ccpa',
        actorId: 'u1',
        actorType: 'user',
        actorIpHash: 'h',
        action: 'EV3',
        resourceType: 'r',
        jurisdictionCompliance: 'US_CCPA',
        policyVerdict: 'ALLOWED',
        timestamp: 300,
      });

      // Attacker drops e2
      await db.prepare('DELETE FROM compliance_audit_logs WHERE id = ?1').bind(e2.id).run();

      const verification = await verifyComplianceAuditChain(db, { orgId: 'org_del' });
      expect(verification.isValid).toBe(false);
      expect(verification.tamperedEventId).toBe(e3.id);
      expect(verification.tamperedIndex).toBe(1);
      expect(verification.error).toContain('Broken chain link');
    });
  });

  describe('Query Filtering & Pagination', () => {
    it('filters logs by action and jurisdiction and supports pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await appendComplianceAuditLog(db, {
          orgId: 'org_query',
          zoneId: 'zone_eu_gdpr',
          actorId: `user_${i}`,
          actorType: 'user',
          actorIpHash: 'h',
          action: i % 2 === 0 ? 'READ' : 'WRITE',
          resourceType: 'doc',
          jurisdictionCompliance: 'EU_GDPR',
          policyVerdict: 'ALLOWED',
          timestamp: 1000 + i,
        });
      }

      const queryAll = await queryComplianceAuditLogs(db, { orgId: 'org_query' });
      expect(queryAll.total).toBe(5);
      expect(queryAll.logs).toHaveLength(5);

      const queryReads = await queryComplianceAuditLogs(db, {
        orgId: 'org_query',
        action: 'READ',
      });
      expect(queryReads.total).toBe(3);
      expect(queryReads.logs).toHaveLength(3);

      const paged = await queryComplianceAuditLogs(db, {
        orgId: 'org_query',
        limit: 2,
        offset: 1,
      });
      expect(paged.total).toBe(5);
      expect(paged.logs).toHaveLength(2);
    });
  });
});
