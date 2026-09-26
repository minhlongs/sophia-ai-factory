/**
 * Unit & Adversarial Tests: Right-to-be-Forgotten & Erasure Certificate Engine
 *
 * Verifies:
 * 1. Deterministic Merkle root manifest calculation & order invariance
 * 2. GDPR/PDPD subject pseudonymization
 * 3. Statutory legal hold gate (Vietnam TT78 10-year invoice retention & active contracts)
 * 4. Orchestrated erasure execution:
 *    - CMEK key crypto-shredding
 *    - Relational data redaction
 *    - Digital certificate generation & non-repudiation signing
 * 5. Certificate signature verification & adversarial tampering detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  computeMerkleRoot,
  generateSubjectPseudonym,
  checkLegalHold,
  executeRightToBeForgotten,
  verifyErasureCertificate,
  getErasureCertificateByNumber,
} from '../right-to-be-forgotten-engine';
import { initializeTenantSovereignKey } from '../cmek-envelope-engine';

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

    CREATE TABLE IF NOT EXISTS tenant_sovereign_keys (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      zone_id TEXT NOT NULL,
      key_alias TEXT NOT NULL,
      key_type TEXT NOT NULL,
      algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
      key_version INTEGER NOT NULL DEFAULT 1,
      wrapped_dek_ciphertext TEXT NOT NULL,
      dek_iv_base64 TEXT NOT NULL,
      kek_reference_or_fingerprint TEXT NOT NULL,
      key_state TEXT NOT NULL DEFAULT 'active',
      rotation_interval_days INTEGER NOT NULL DEFAULT 90,
      last_rotated_at INTEGER,
      next_rotation_due_at INTEGER,
      revoked_at INTEGER,
      revocation_reason TEXT,
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

    CREATE TABLE IF NOT EXISTS erasure_certificates (
      id TEXT PRIMARY KEY,
      certificate_number TEXT NOT NULL UNIQUE,
      org_id TEXT,
      subject_id_pseudonym TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      legal_basis TEXT NOT NULL,
      erasure_method TEXT NOT NULL,
      shredded_key_fingerprint TEXT,
      affected_records_count INTEGER NOT NULL DEFAULT 0,
      records_manifest_hash TEXT NOT NULL,
      verifier_public_key_id TEXT NOT NULL,
      digital_signature TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      certificate_pdf_url TEXT,
      metadata_json TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      full_name TEXT,
      avatar_url TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_organizations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      status TEXT NOT NULL
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

describe('Right-to-be-Forgotten & Erasure Certificate Engine', () => {
  let db: D1Database;
  const SIGNING_SECRET = 'sov_test_cert_secret_2026';

  beforeEach(() => {
    db = createTestD1();
  });

  describe('Merkle Root Manifest Calculation', () => {
    it('computes deterministic Merkle root hash for records list', async () => {
      const recordIds = ['record_1', 'record_2', 'record_3', 'record_4'];
      const root1 = await computeMerkleRoot(recordIds);
      const root2 = await computeMerkleRoot(recordIds);

      expect(root1).toHaveLength(64);
      expect(root1).toBe(root2);
    });

    it('guarantees ordering invariance by internal canonical sorting', async () => {
      const listA = ['id_z', 'id_a', 'id_m'];
      const listB = ['id_a', 'id_m', 'id_z'];
      const listC = ['id_m', 'id_z', 'id_a'];

      const rootA = await computeMerkleRoot(listA);
      const rootB = await computeMerkleRoot(listB);
      const rootC = await computeMerkleRoot(listC);

      expect(rootA).toBe(rootB);
      expect(rootA).toBe(rootC);
    });

    it('returns empty manifest hash for empty records array', async () => {
      const root = await computeMerkleRoot([]);
      expect(root).toHaveLength(64);
    });

    it('detects record modification with completely different root hash', async () => {
      const r1 = await computeMerkleRoot(['doc_1', 'doc_2']);
      const r2 = await computeMerkleRoot(['doc_1', 'doc_3']);
      expect(r1).not.toBe(r2);
    });
  });

  describe('Subject Pseudonymization', () => {
    it('generates consistent pseudonym with ANON_ prefix', async () => {
      const p1 = await generateSubjectPseudonym('user_john_doe_123');
      const p2 = await generateSubjectPseudonym('user_john_doe_123');
      expect(p1.startsWith('ANON_')).toBe(true);
      expect(p1).toBe(p2);
    });

    it('produces distinct pseudonyms for distinct user IDs', async () => {
      const p1 = await generateSubjectPseudonym('user_1');
      const p2 = await generateSubjectPseudonym('user_2');
      expect(p1).not.toBe(p2);
    });
  });

  describe('Statutory Legal Hold Gate Evaluation', () => {
    it('blocks erasure if data subject has statutory tax invoices (Vietnam TT78 / EU VAT)', async () => {
      // Seed a financial payment record
      await db
        .prepare('INSERT INTO payment_events (id, user_id, amount, created_at) VALUES (?1, ?2, ?3, ?4)')
        .bind('inv_1', 'user_tax_hold', 500000, Date.now())
        .run();

      const hold = await checkLegalHold(db, 'user_tax_hold');
      expect(hold.canErase).toBe(false);
      expect(hold.reason).toContain('statutory 10-year retention');
      expect(hold.statutoryBasis).toContain('Vietnam Tax Law 38/2019/QH14');
    });

    it('blocks erasure if organization has an active commercial contract', async () => {
      await db
        .prepare('INSERT INTO partner_organizations (id, tenant_id, status) VALUES (?1, ?2, ?3)')
        .bind('org_active', 'org_active', 'active')
        .run();

      const hold = await checkLegalHold(db, 'user_free', 'org_active');
      expect(hold.canErase).toBe(false);
      expect(hold.reason).toContain('active enterprise contractual tier');
    });

    it('permits erasure when no statutory holds or active contracts exist', async () => {
      const hold = await checkLegalHold(db, 'user_clean_erasure');
      expect(hold.canErase).toBe(true);
      expect(hold.reason).toBeUndefined();
    });
  });

  describe('Orchestrated Right-to-be-Forgotten Execution', () => {
    it('halts and returns legalHoldBlocked when statutory hold is detected', async () => {
      await db
        .prepare('INSERT INTO payment_events (id, user_id, amount, created_at) VALUES (?1, ?2, ?3, ?4)')
        .bind('inv_block', 'user_blocked', 100000, Date.now())
        .run();

      const result = await executeRightToBeForgotten(
        db,
        {
          subjectId: 'user_blocked',
          jurisdiction: 'EU_GDPR',
        },
        { signingKeySecret: SIGNING_SECRET },
      );

      expect(result.success).toBe(false);
      expect(result.legalHoldBlocked).toBe(true);
      expect(result.certificate).toBeUndefined();
    });

    it('executes crypto-shredding, redaction, and issues signed certificate', async () => {
      // 1. Provision a CMEK key for the org
      const { keyRecord } = await initializeTenantSovereignKey({
        orgId: 'org_purge',
        zoneId: 'zone_eu_gdpr',
        zoneCode: 'EU',
        keyAlias: 'doc_key',
      });

      await db
        .prepare(`
          INSERT INTO tenant_sovereign_keys (
            id, org_id, zone_id, key_alias, key_type, algorithm,
            key_version, wrapped_dek_ciphertext, dek_iv_base64,
            kek_reference_or_fingerprint, key_state, rotation_interval_days,
            created_at, updated_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
        `)
        .bind(
          keyRecord.id,
          keyRecord.orgId,
          keyRecord.zoneId,
          keyRecord.keyAlias,
          keyRecord.keyType,
          keyRecord.algorithm,
          keyRecord.keyVersion,
          keyRecord.wrappedDekCiphertext,
          keyRecord.dekIvBase64,
          keyRecord.kekReferenceOrFingerprint,
          keyRecord.keyState,
          keyRecord.rotationIntervalDays,
          keyRecord.createdAt,
          keyRecord.updatedAt,
        )
        .run();

      // 2. Insert user profile to redact
      await db
        .prepare('INSERT INTO user_profiles (user_id, full_name, avatar_url, updated_at) VALUES (?1, ?2, ?3, ?4)')
        .bind('user_purge_1', 'John Doe Private', 'https://avatar.png', Date.now())
        .run();

      // 3. Execute erasure
      const result = await executeRightToBeForgotten(
        db,
        {
          subjectId: 'user_purge_1',
          orgId: 'org_purge',
          jurisdiction: 'EU_GDPR',
          legalBasis: 'GDPR Article 17(1)(a) Consent Withdrawn',
        },
        { signingKeySecret: SIGNING_SECRET },
      );

      expect(result.success).toBe(true);
      expect(result.certificateNumber).toBeDefined();
      expect(result.certificateNumber?.startsWith('SOV-ERASURE-')).toBe(true);
      expect(result.shreddedKeysCount).toBe(1);

      // Verify key in DB is destroyed and shredded
      const keyRow = await db
        .prepare('SELECT key_state, wrapped_dek_ciphertext, revocation_reason FROM tenant_sovereign_keys WHERE id = ?1')
        .bind(keyRecord.id)
        .first<{ key_state: string; wrapped_dek_ciphertext: string; revocation_reason: string }>();

      expect(keyRow?.key_state).toBe('destroyed');
      expect(keyRow?.wrapped_dek_ciphertext).not.toBe(keyRecord.wrappedDekCiphertext);
      expect(keyRow?.revocation_reason).toBe('CRYPTO_SHRED_RIGHT_TO_ERASURE');

      // Verify user profile was redacted
      const profileRow = await db
        .prepare('SELECT full_name, avatar_url FROM user_profiles WHERE user_id = ?1')
        .bind('user_purge_1')
        .first<{ full_name: string; avatar_url: string | null }>();

      expect(profileRow?.full_name).toBe('ERASED_SUBJECT');
      expect(profileRow?.avatar_url).toBeNull();

      // Verify digital certificate is verifiable
      expect(result.certificate).toBeDefined();
      if (result.certificate) {
        const verifyRes = await verifyErasureCertificate(result.certificate, SIGNING_SECRET);
        expect(verifyRes.isValid).toBe(true);
      }
    });
  });

  describe('Erasure Certificate Tampering Detection', () => {
    it('detects altered Merkle manifest or subject in certificate', async () => {
      const result = await executeRightToBeForgotten(
        db,
        {
          subjectId: 'user_cert_test',
          jurisdiction: 'VN_PDPD',
        },
        { signingKeySecret: SIGNING_SECRET },
      );

      expect(result.success).toBe(true);
      const cert = result.certificate!;

      // Valid signature
      const validCheck = await verifyErasureCertificate(cert, SIGNING_SECRET);
      expect(validCheck.isValid).toBe(true);

      // Attacker attempts to modify manifest hash
      const tamperedCert = { ...cert, recordsManifestHash: 'tampered_hash_value' };
      const tamperedCheck = await verifyErasureCertificate(tamperedCert, SIGNING_SECRET);
      expect(tamperedCheck.isValid).toBe(false);
      expect(tamperedCheck.error).toContain('Digital signature mismatch');

      // Attacker attempts to forge certificate number
      const forgedCert = { ...cert, certificateNumber: 'SOV-ERASURE-FAKE' };
      const forgedCheck = await verifyErasureCertificate(forgedCert, SIGNING_SECRET);
      expect(forgedCheck.isValid).toBe(false);
    });

    it('retrieves certificate by number from database', async () => {
      const result = await executeRightToBeForgotten(
        db,
        {
          subjectId: 'user_fetch_test',
          jurisdiction: 'EU_GDPR',
        },
        { signingKeySecret: SIGNING_SECRET },
      );

      const fetched = await getErasureCertificateByNumber(db, result.certificateNumber!);
      expect(fetched).not.toBeNull();
      expect(fetched?.certificateNumber).toBe(result.certificateNumber);
      expect(fetched?.jurisdiction).toBe('EU_GDPR');
    });
  });
});
