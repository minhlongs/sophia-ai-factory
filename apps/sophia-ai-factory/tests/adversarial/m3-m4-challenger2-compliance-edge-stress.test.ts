/**
 * Challenger 2: Empirical Adversarial Stress Test Suite
 * Milestone 3 (Cultural Compliance) & Milestone 4 (12-Language Portal & Edge Mesh)
 *
 * Requirements:
 * 1. Adversarial Compliance Verification:
 *    - Stress test compliance-engine.ts against adversarial evasion attempts
 *      (homoglyphs, unicode spacing tricks, mixed CJK/Latin scripts, regex evasion).
 *    - Test statutory legal hold conflict resolution: verify that right-to-be-forgotten requests
 *      for accounts with active Vietnam TT78 accounting invoices or open tax audits
 *      are correctly held/quarantined without violating statutory records laws.
 *    - Test subtitle CPS budgeting against extreme text overflow scenarios.
 * 2. Adversarial Edge Mesh & Withholding Tax Verification:
 *    - Stress test edge-mesh-router.ts under malformed Accept-Language headers,
 *      unsupported country codes, and edge KV misses.
 *    - Verify statutory withholding tax invariant: grossCents === withholdingCents + netCents
 *      across 1,000 randomized cross-border commission payouts.
 *    - Verify RTL Arabic layout isolation against BiDi injection.
 *
 * Discipline:
 * - Pure empirical tests with active assertions
 * - Zero :any types
 *
 * @module tests/adversarial/m3-m4-challenger2-compliance-edge-stress.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';

// Domain imports from tree layer
import {
  scanContentCompliance,
  remediateContentCompliance,
  generateAiDisclosure,
  createContentAuditRecord,
} from '@/tree/cultural-adaptation/compliance-engine';

import {
  getSubtitleCulturalBudget,
  adaptSubtitleCue,
  breakJapaneseBunsetsu,
  wrapWords,
  formatCulturalNumber,
  validateCulturalVisuals,
} from '@/tree/cultural-adaptation/subtitle-cultural-adapter';

import {
  checkLegalHold,
  executeRightToBeForgotten,
  verifyErasureCertificate,
  computeMerkleRoot,
  generateSubjectPseudonym,
  sha256Hex,
} from '@/tree/sovereignty/right-to-be-forgotten-engine';

import {
  parseEnterpriseAcceptLanguage,
  extractColoFromRay,
  resolveEdgeMeshRegion,
  extractLocaleFromCookie,
  extractLocaleFromPathname,
  resolveEnterpriseLocale,
  makeEdgeRoutingDecision,
  buildSwrCacheHeaders,
  buildEdgeRouteCacheKey,
  resolveEdgeRoutingWithKv,
  formatLocalizedEnterprisePath,
  type EdgeKvStore,
  type EdgeRequestHeaders,
} from '@/tree/localization/edge-mesh-router';

import {
  calculateWithholdingTax,
  type CalculateWithholdingTaxInput,
} from '@/tree/partners/withholding-tax-calculator';

import {
  calculateCrossBorderPayout,
  BEDROCK_LEDGER_FX_RATES,
} from '@/tree/partners/cross-border-ledger';

import {
  ENTERPRISE_12_LOCALES,
  type EnterpriseLocale,
  isEnterpriseLocale,
  isRtlLocale,
} from '@/seed/types/edge-mesh';

import type {
  WithholdingJurisdiction,
  TaxCertificateStatus,
  LedgerPayoutCurrency,
} from '@/seed/types/cross-border-ledger';

import type { ComplianceJurisdiction } from '@/seed/types/cultural-adaptation';
import type { ErasureRequestInput } from '@/seed/types/sovereign-vault';

// ─── Authentic D1 In-Memory SQLite Adapter ───────────────────────────────────

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

function createMockD1Database(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payment_events (
      event_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      processed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_organizations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      full_name TEXT,
      avatar_url TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenant_sovereign_keys (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      zone_id TEXT NOT NULL,
      key_alias TEXT NOT NULL,
      key_version INTEGER NOT NULL,
      wrapped_dek_ciphertext TEXT NOT NULL,
      dek_iv_base64 TEXT NOT NULL,
      kek_reference_or_fingerprint TEXT NOT NULL,
      key_state TEXT NOT NULL DEFAULT 'active',
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

// ─── SUITE: Challenger 2 Empirical Stress Verification ───────────────────────

describe('Challenger 2: Empirical Adversarial Compliance & Edge Stress Verification', () => {

  // ==========================================================================
  // SECTION 1: Adversarial Compliance Verification (compliance-engine.ts)
  // ==========================================================================

  describe('1. Adversarial Compliance Engine Stress Probes', () => {
    it('1.1: Detects canonical non-compliant claims across EU, US, JP, and VN jurisdictions', () => {
      const euTest = scanContentCompliance('Get our 100% guaranteed return with zero risk miracle cure', 'EU');
      expect(euTest.compliant).toBe(false);
      expect(euTest.violations.length).toBeGreaterThanOrEqual(1);

      const usTest = scanContentCompliance('This is an FDA approved AI cure-all with guaranteed profit', 'US');
      expect(usTest.compliant).toBe(false);
      expect(usTest.violations.some(v => v.ruleId === 'us-ftc-endorsement-false-doctor')).toBe(true);

      const jpTest = scanContentCompliance('当社は国内No.1であり、絶対に儲かる投資です', 'JP');
      expect(jpTest.compliant).toBe(false);
      expect(jpTest.violations.length).toBeGreaterThanOrEqual(2);

      const vnTest = scanContentCompliance('Sản phẩm chữa khỏi 100% cam kết dứt điểm hoàn tiền vô điều kiện', 'VN');
      expect(vnTest.compliant).toBe(false);
      expect(vnTest.violations.length).toBeGreaterThanOrEqual(2);
    });

    it('1.2 [Adversarial Evasion]: Probes homoglyph substitutions (Cyrillic a vs Latin a)', () => {
      // Attacker replaces Latin 'a' (\u0061) with Cyrillic 'а' (\u0430)
      const cyrillicA = '\u0430';
      const homoglyphEvasion = `100% gu${cyrillicA}r${cyrillicA}nteed return`;

      const result = scanContentCompliance(homoglyphEvasion, 'EU');
      // Documenting empirical finding: Raw regex without NFKC/homoglyph folding is evaded
      const isEvaded = result.compliant === true;
      expect(typeof isEvaded).toBe('boolean');
      // We document this as an empirical evasion probe:
      expect(isEvaded).toBe(true); // Confirmed: Cyrillic homoglyph bypasses the ASCII regex
    });

    it('1.3 [Adversarial Evasion]: Probes zero-width space and soft hyphen insertions', () => {
      // Attacker inserts zero-width space (\u200B) into prohibited phrase
      const zeroWidthSpace = '\u200B';
      const zwsEvasion = `100%${zeroWidthSpace}guaranteed${zeroWidthSpace}return`;
      const zwsResult = scanContentCompliance(zwsEvasion, 'EU');
      // In JS RegExp, \s does not match \u200B (zero-width space)
      expect(zwsResult.compliant).toBe(true); // Confirmed: Zero-width space evades \s* matching

      // Attacker inserts soft hyphen (\u00AD)
      const softHyphen = '\u00AD';
      const shyEvasion = `zero${softHyphen}risk`;
      const shyResult = scanContentCompliance(shyEvasion, 'EU');
      expect(shyResult.compliant).toBe(true); // Confirmed: Soft hyphen evades whitespace/word match
    });

    it('1.4 [Adversarial Evasion]: Probes Japanese fullwidth characters vs ASCII', () => {
      // Fullwidth 'Ｎｏ．１' (\uFF2E\uFF4F\uFF0E\uFF11) vs halfwidth 'No.1'
      const fullwidthText = '当社は国内Ｎｏ．１の最高峰AIです';
      const result = scanContentCompliance(fullwidthText, 'JP');
      // '国内No.?1' in regex looks for halfwidth 'No'
      // But '業界最高峰' or other keywords might match if present; here only fullwidth '国内Ｎｏ．１' is tested
      const singleKeyword = '国内Ｎｏ．１';
      const singleResult = scanContentCompliance(singleKeyword, 'JP');
      expect(singleResult.compliant).toBe(true); // Confirmed: Fullwidth character bypasses halfwidth regex
    });

    it('1.5 [Adversarial Evasion]: Probes punctuation and delimiter evasion', () => {
      // Delimiters like hyphens or underscores
      const hyphenated = '100%-guaranteed-return';
      const result = scanContentCompliance(hyphenated, 'EU');
      expect(result.compliant).toBe(true); // Confirmed: Hyphenation evades \s*

      const underscored = '100%_guaranteed_return';
      const underResult = scanContentCompliance(underscored, 'EU');
      expect(underResult.compliant).toBe(true); // Confirmed: Underscores evade \s*
    });

    it('1.6: Remediation cleans compliant terms and preserves surrounding sentence grammar', () => {
      const dirtyScript = 'We provide 100% guaranteed return on investment with zero risk methodology.';
      const remediated = remediateContentCompliance(dirtyScript, 'EU');

      expect(remediated.remediatedScript).not.toContain('100% guaranteed return');
      expect(remediated.remediatedScript).not.toContain('zero risk');
      expect(remediated.replacements.length).toBe(2);
      expect(remediated.replacements[0].replacement).toBe('verified methodology');
    });

    it('1.7: Generates valid AI disclosure watermarks with required opacity and duration', () => {
      const euDisclosure = generateAiDisclosure('EU', 'both');
      expect(euDisclosure.visualLabel.textEn).toBe('AI-Generated Content (Sophia AI)');
      expect(euDisclosure.visualLabel.position).toBe('bottom_right');
      expect(euDisclosure.visualLabel.opacity).toBe(0.85);
      expect(euDisclosure.audioDisclaimer).toBeDefined();
      expect(euDisclosure.audioDisclaimer?.estimatedDurationSec).toBeGreaterThan(1.5);

      const vnDisclosure = generateAiDisclosure('VN', 'both');
      expect(vnDisclosure.visualLabel.textLocal).toContain('trí tuệ nhân tạo');
      expect(vnDisclosure.audioDisclaimer?.textLocal).toContain('Sophia AI');
    });

    it('1.8: Creates immutable content audit records with correct status classification', () => {
      const cleanRecord = createContentAuditRecord({
        tenantId: 'tenant_test_1',
        videoId: 'vid_clean_001',
        jurisdiction: 'US',
        script: 'Welcome to our platform designed to enhance your digital workflows.',
      });
      expect(cleanRecord.complianceStatus).toBe('passed');
      expect(cleanRecord.violationsDetected.length).toBe(0);

      const rejectedRecord = createContentAuditRecord({
        tenantId: 'tenant_test_2',
        videoId: 'vid_reject_002',
        jurisdiction: 'VN',
        script: 'Thuốc này chữa khỏi 100% cam kết dứt điểm.',
      });
      expect(rejectedRecord.complianceStatus).toBe('rejected');
      expect(rejectedRecord.violationsDetected.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SECTION 2: Statutory Legal Hold Conflict Resolution
  // ==========================================================================

  describe('2. Statutory Legal Hold Conflict Resolution (right-to-be-forgotten-engine.ts)', () => {
    let db: D1Database;

    beforeEach(() => {
      db = createMockD1Database();
    });

    it('2.1 [Statutory Hold Active]: Blocks erasure when account has Vietnam TT78 invoices within 10-year window', async () => {
      const subjectId = 'usr_vn_taxable_001';
      const now = Date.now();
      const twoYearsAgo = now - 2 * 365 * 86400 * 1000;

      // Insert recent payment invoice into payment_events
      await db
        .prepare('INSERT INTO payment_events (event_id, user_id, amount, currency, processed, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
        .bind('evt_inv_001', subjectId, 5000000, 'VND', 1, twoYearsAgo)
        .run();

      // Check legal hold
      const hold = await checkLegalHold(db, subjectId);
      expect(hold.canErase).toBe(false);
      expect(hold.statutoryBasis).toContain('Vietnam Tax Law 38/2019/QH14');
      expect(hold.statutoryBasis).toContain('Circular TT78/2021');

      // Attempt orchestrated erasure
      const erasureInput: ErasureRequestInput = {
        subjectId,
        jurisdiction: 'VN_PDPD',
        legalBasis: 'Customer requested account deletion',
      };

      const result = await executeRightToBeForgotten(db, erasureInput);
      expect(result.success).toBe(false);
      expect(result.legalHoldBlocked).toBe(true);
      expect(result.shreddedKeysCount).toBe(0);
      expect(result.affectedRecordsCount).toBe(0);

      // Verify audit log recorded rejection
      const auditLog = await db
        .prepare('SELECT action, policy_verdict FROM compliance_audit_logs WHERE resource_id = ?1')
        .bind(subjectId)
        .first<{ action: string; policy_verdict: string }>();

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('SOVEREIGN_ERASURE_REQUEST_BLOCKED');
      expect(auditLog?.policy_verdict).toBe('DENIED');
    });

    it('2.2 [Statutory Hold Expired]: Allows erasure when invoices are older than the 10-year statutory window', async () => {
      const subjectId = 'usr_old_customer_002';
      const now = Date.now();
      // 11 years ago (exceeds 10-year / 315,360,000s window)
      const elevenYearsAgo = now - 11 * 365 * 86400 * 1000;

      await db
        .prepare('INSERT INTO payment_events (event_id, user_id, amount, currency, processed, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
        .bind('evt_inv_old', subjectId, 100000, 'VND', 1, elevenYearsAgo)
        .run();

      const hold = await checkLegalHold(db, subjectId);
      expect(hold.canErase).toBe(true);

      const erasureInput: ErasureRequestInput = {
        subjectId,
        jurisdiction: 'VN_PDPD',
      };

      const result = await executeRightToBeForgotten(db, erasureInput);
      expect(result.success).toBe(true);
      expect(result.certificateNumber).toBeDefined();
      expect(result.certificate).toBeDefined();
    });

    it('2.3 [Contractual Performance Hold]: Blocks erasure when organization has active enterprise tier', async () => {
      const subjectId = 'usr_enterprise_admin_003';
      const orgId = 'org_active_tier_001';

      await db
        .prepare('INSERT INTO partner_organizations (id, tenant_id, name, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(orgId, orgId, 'Enterprise Alpha', 'active', Date.now())
        .run();

      const hold = await checkLegalHold(db, subjectId, orgId);
      expect(hold.canErase).toBe(false);
      expect(hold.statutoryBasis).toContain('Commercial Contractual Performance');

      const result = await executeRightToBeForgotten(db, {
        subjectId,
        orgId,
        jurisdiction: 'EU_GDPR',
      });

      expect(result.success).toBe(false);
      expect(result.legalHoldBlocked).toBe(true);
      expect(result.shreddedKeysCount).toBe(0);
    });

    it('2.4: Lawful erasure executes crypto-shredding, Merkle root calculation, and certificate issuance', async () => {
      const subjectId = 'usr_lawful_delete_004';
      const orgId = 'org_terminated_002';
      const now = Date.now();

      // Seed terminated organization and user profile
      await db
        .prepare('INSERT INTO partner_organizations (id, tenant_id, name, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(orgId, orgId, 'Former Agency', 'terminated', now)
        .run();

      await db
        .prepare('INSERT INTO user_profiles (user_id, full_name, avatar_url, updated_at) VALUES (?1, ?2, ?3, ?4)')
        .bind(subjectId, 'Nguyen Van A', 'https://avatar.png', now)
        .run();

      // Seed active CMEK key
      await db
        .prepare(`
          INSERT INTO tenant_sovereign_keys (
            id, org_id, zone_id, key_alias, key_version, wrapped_dek_ciphertext,
            dek_iv_base64, kek_reference_or_fingerprint, key_state, created_at, updated_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        `)
        .bind('key_001', orgId, 'zone_vn_pdpd', 'primary', 1, 'VALID_BASE64_CIPHER', 'IV_12B', 'kek_fingerprint_01', 'active', now, now)
        .run();

      const result = await executeRightToBeForgotten(db, {
        subjectId,
        orgId,
        jurisdiction: 'VN_PDPD',
      });

      expect(result.success).toBe(true);
      expect(result.shreddedKeysCount).toBe(1);
      expect(result.affectedRecordsCount).toBeGreaterThanOrEqual(2);

      // Verify CMEK key was destroyed
      const destroyedKey = await db
        .prepare('SELECT key_state, revocation_reason FROM tenant_sovereign_keys WHERE id = ?1')
        .bind('key_001')
        .first<{ key_state: string; revocation_reason: string }>();

      expect(destroyedKey?.key_state).toBe('destroyed');
      expect(destroyedKey?.revocation_reason).toBe('CRYPTO_SHRED_RIGHT_TO_ERASURE');

      // Verify profile was pseudonymized
      const redactedProfile = await db
        .prepare('SELECT full_name, avatar_url FROM user_profiles WHERE user_id = ?1')
        .bind(subjectId)
        .first<{ full_name: string; avatar_url: string | null }>();

      expect(redactedProfile?.full_name).toBe('ERASED_SUBJECT');
      expect(redactedProfile?.avatar_url).toBeNull();

      // Verify erasure certificate was issued and signed
      const cert = result.certificate!;
      expect(cert).toBeDefined();
      expect(cert.recordsManifestHash).toBeDefined();

      const verifyStatus = await verifyErasureCertificate(cert, 'sophia_sov_vault_sec_master_2026');
      expect(verifyStatus.isValid).toBe(true);

      // Verify tampering invalidates certificate
      const tamperedCert = { ...cert, recordsManifestHash: 'tampered_hash_00000000000000000000' };
      const tamperedStatus = await verifyErasureCertificate(tamperedCert, 'sophia_sov_vault_sec_master_2026');
      expect(tamperedStatus.isValid).toBe(false);
    });

    it('2.5 [Caveat Discovery]: Documents that checkLegalHold does NOT check partner_cross_border_ledger', async () => {
      // In the current implementation, checkLegalHold queries payment_events and partner_organizations,
      // but does not inspect partner_cross_border_ledger.
      // This is an important empirical finding for production accounting compliance.
      const subjectId = 'usr_cross_border_affiliate';
      const hold = await checkLegalHold(db, subjectId);
      // Because partner_cross_border_ledger is not queried in checkLegalHold, it returns canErase: true
      expect(hold.canErase).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 3: Subtitle CPS Budgeting Against Extreme Text Overflow
  // ==========================================================================

  describe('3. Subtitle CPS Budgeting Against Extreme Text Overflow (subtitle-cultural-adapter.ts)', () => {
    it('3.1 [Extreme Pacing Overflow]: 10,000 characters in 1 second', () => {
      const massiveText = 'A'.repeat(10_000);
      const durationSec = 1.0;
      const result = adaptSubtitleCue(massiveText, durationSec, 'en');

      expect(result.effectiveCps).toBe(10_000);
      expect(result.isWithinBudget).toBe(false);
      // Suggested duration calculated as ceil(10,000 / 16 * 10) / 10 = 625.0s
      expect(result.suggestedDurationSec).toBe(625);
      // Max lines capped to 2
      expect(result.lines.length).toBeLessThanOrEqual(2);
    });

    it('3.2 [Line Length Overflow on Condense]: Reveals that condensing to maxLines creates oversized lines', () => {
      // When a long paragraph is passed with spaces, wrapWords creates many lines.
      // adaptSubtitleCue condenses them into maxLines (2 lines).
      // Each condensed line joins multiple chunks with spaces, resulting in lines exceeding maxCpl.
      const paragraph = Array.from({ length: 50 }, () => 'word').join(' '); // 50 * 5 = 250 chars
      const result = adaptSubtitleCue(paragraph, 5.0, 'en');

      expect(result.lines.length).toBe(2);
      // Document empirical finding: line lengths exceed budget maxCpl (38)
      const maxCpl = getSubtitleCulturalBudget('en').maxCpl;
      const longestLine = Math.max(...result.lines.map(l => l.length));
      expect(longestLine).toBeGreaterThan(maxCpl); // Empirical finding: condensing preserves words over maxCpl
    });

    it('3.3 [Unbroken Long Words]: Word longer than maxCpl cannot be split by space-wrapWords', () => {
      const longGermanWord = 'Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz'; // 63 chars
      const wrapped = wrapWords(longGermanWord, 38);
      // wrapWords only splits on whitespace \s+, so single words are never broken mid-word
      expect(wrapped.length).toBe(1);
      expect(wrapped[0].length).toBe(63);
      expect(wrapped[0].length).toBeGreaterThan(38);
    });

    it('3.4 [Pathological Japanese Bunsetsu]: Handles 100 consecutive particles and kanji streams', () => {
      // 100 consecutive particles 'は'
      const particleStream = 'は'.repeat(100);
      const particleChunks = breakJapaneseBunsetsu(particleStream, 16);
      expect(particleChunks.length).toBeGreaterThan(1);
      // Every line must be <= maxCpl (16) due to the hard-wrap fallback in breakJapaneseBunsetsu
      for (const line of particleChunks) {
        expect(line.length).toBeLessThanOrEqual(16);
      }

      // 100 kanji characters without particles
      const kanjiStream = '漢'.repeat(100);
      const kanjiChunks = breakJapaneseBunsetsu(kanjiStream, 16);
      for (const line of kanjiChunks) {
        expect(line.length).toBeLessThanOrEqual(16);
      }
    });

    it('3.5 [Duration Edge Cases]: Handles duration <= 0, NaN, and near-zero values gracefully', () => {
      const zeroDur = adaptSubtitleCue('Hello world', 0, 'en');
      // Effective duration clamped to 0.5s by Math.max(0.5, durationSec)
      expect(zeroDur.effectiveCps).toBeGreaterThan(0);
      expect(isFinite(zeroDur.effectiveCps)).toBe(true);

      const negDur = adaptSubtitleCue('Hello world', -10, 'en');
      expect(negDur.effectiveCps).toBeGreaterThan(0);

      const microDur = adaptSubtitleCue('Hello world', 0.0001, 'en');
      expect(microDur.effectiveCps).toBe(Math.round(('Hello world'.length / 0.5) * 10) / 10);
    });

    it('3.6: Formats cultural decimal numbers according to regional conventions', () => {
      // Dot decimal: US, UK, JP
      expect(formatCulturalNumber(1234567.89, 'en')).toBe('1,234,567.89');
      expect(formatCulturalNumber(1234567.89, 'ja')).toBe('1,234,567.89');

      // Comma decimal: VN, DE, FR, ES
      expect(formatCulturalNumber(1234567.89, 'vi')).toBe('1.234.567,89');
      expect(formatCulturalNumber(1234567.89, 'de')).toBe('1.234.567,89');
      expect(formatCulturalNumber(1234567.89, 'fr')).toBe('1.234.567,89');
    });

    it('3.7 [Cultural Visual Taboo & Bug Finding]: Validates WCAG contrast and discovers Korean taboo color tuple inversion', () => {
      // Good contrast (white on black): ratio ~21:1
      const goodContrast = validateCulturalVisuals({ background: '#000000', foreground: '#FFFFFF' }, [], 'en');
      expect(goodContrast.compliant).toBe(true);
      expect(goodContrast.contrastRatio).toBeGreaterThan(15);

      // Low contrast (grey on white): ratio < 4.5:1
      const lowContrast = validateCulturalVisuals({ background: '#FFFFFF', foreground: '#CCCCCC' }, [], 'en');
      expect(lowContrast.compliant).toBe(false);
      expect(lowContrast.warnings[0]).toContain('Low subtitle color contrast ratio');

      // Korean taboo discovery: In LOCALE_BUDGET_REGISTRY.ko, tabooColorPairs has ['#FF0000', '#FFFFFF']
      // The comment says "Writing names in red ink is culturally taboo" (red text on white bg).
      // However, the tuple has #FF0000 as background and #FFFFFF as foreground!
      // When tested with red bg / white fg, it flags:
      const redBgWhiteFg = validateCulturalVisuals({ background: '#FF0000', foreground: '#FFFFFF' }, [], 'ko');
      expect(redBgWhiteFg.compliant).toBe(false);
      expect(redBgWhiteFg.warnings.some(w => w.includes('taboo'))).toBe(true);

      // But when tested with white bg / red fg (the actual red ink writing), it is NOT flagged:
      const whiteBgRedFg = validateCulturalVisuals({ background: '#FFFFFF', foreground: '#FF0000' }, [], 'ko');
      // Document empirical finding: inverted tuple causes actual red ink text on white paper to pass
      expect(whiteBgRedFg.warnings.some(w => w.includes('taboo'))).toBe(false);

      // Japanese taboo symbol: '4' (Shi / death) or '9' (Ku / agony)
      const jpTaboo = validateCulturalVisuals({ background: '#000000', foreground: '#FFFFFF' }, ['4', '9'], 'ja');
      expect(jpTaboo.compliant).toBe(false);
      expect(jpTaboo.warnings.some(w => w.includes("Symbol '4'"))).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 4: Adversarial Edge Mesh & KV Router Stress
  // ==========================================================================

  describe('4. Adversarial Edge Mesh & KV Router Stress (edge-mesh-router.ts)', () => {
    it('4.1 [Accept-Language Fuzzing]: Handles malformed, garbage, and adversarial headers without crashing', () => {
      const maliciousHeaders = [
        '',
        '   ',
        ',,,,,,,',
        ';;;;;;',
        'q=NaN',
        '*;q=0.5',
        '*, en;q=0.8',
        'ar;q=-1, en;q=2.5',
        'ar;q=99999999999999999999',
        'ar;q=undefined, vi;q=null',
        'ar;q=text, ja;q=true',
        'ar;q=0.8;q=0.2',
        'en-US\r\nSet-Cookie: session=hacked',
        '<script>alert(1)</script>',
        'A'.repeat(50_000), // 50KB header buffer
      ];

      for (const header of maliciousHeaders) {
        expect(() => {
          const parsed = parseEnterpriseAcceptLanguage(header);
          expect(Array.isArray(parsed)).toBe(true);
          for (const item of parsed) {
            expect(item.q).toBeGreaterThanOrEqual(0.0);
            expect(item.q).toBeLessThanOrEqual(1.0);
            expect(typeof item.primaryCode).toBe('string');
          }
        }).not.toThrow();
      }
    });

    it('4.2: Resolves correct enterprise locale from complex weighted Accept-Language', () => {
      // When quality weights are specified: Japanese (q=0.95) beats English (q=0.8)
      const parsedWithWeights = parseEnterpriseAcceptLanguage('en-US;q=0.8,en;q=0.7,ja-JP;q=0.95,ja;q=0.9');
      expect(parsedWithWeights[0].primaryCode).toBe('ja');
      expect(parsedWithWeights[0].q).toBe(0.95);

      const decision = resolveEnterpriseLocale({
        acceptLanguage: 'en-US;q=0.8,en;q=0.7,ja-JP;q=0.95,ja;q=0.9',
      });
      expect(decision.locale).toBe('ja');
      expect(decision.source).toBe('accept-language');

      // When q is omitted on first item, RFC 9110 specifies default q=1.0
      const parsedDefaultQ = parseEnterpriseAcceptLanguage('en-US,ja-JP;q=0.95');
      expect(parsedDefaultQ[0].primaryCode).toBe('en');
      expect(parsedDefaultQ[0].q).toBe(1.0);
    });

    it('4.3 [Unsupported Country & Colo Fuzzing]: Gracefully falls back to global and default locales', () => {
      const weirdCountries = ['ZZ', 'XX', 'T1', 'A1', 'UNKNOWN', '', '123', '<script>', 'null'];
      for (const c of weirdCountries) {
        const region = resolveEdgeMeshRegion('GLOBAL', c);
        expect(region).toBe('global');

        const locale = resolveEnterpriseLocale({ geoCountry: c });
        expect(locale.locale).toBe('en');
        expect(locale.source).toBe('fallback');
      }

      // Vietnam IP always maps to 'vi' fallback
      const vnLocale = resolveEnterpriseLocale({ geoCountry: 'VN' });
      expect(vnLocale.locale).toBe('vi');
    });

    it('4.4 [Colo Ray Extraction]: Handles malformed CF-Ray headers', () => {
      expect(extractColoFromRay(null)).toBe('GLOBAL');
      expect(extractColoFromRay('')).toBe('GLOBAL');
      expect(extractColoFromRay('invalid_ray_format')).toBe('GLOBAL');
      expect(extractColoFromRay('8d26e95c1a8d052b-SIN')).toBe('SIN');
      expect(extractColoFromRay('8d26e95c1a8d052b-HAN')).toBe('HAN');
      expect(extractColoFromRay('8d26e95c1a8d052b-DXB')).toBe('DXB');
    });

    it('4.5 [KV Cache Misses & Resilience]: Operates gracefully when KV fails or throws', async () => {
      const headers: EdgeRequestHeaders = {
        ipCountry: 'JP',
        cfRay: '8d26e95c1a8d052b-NRT',
        acceptLanguage: 'ja-JP,ja;q=0.9',
      };

      // Case A: KV is null/undefined
      const resNullKv = await resolveEdgeRoutingWithKv(null, headers);
      expect(resNullKv.detectedLocale).toBe('ja');
      expect(resNullKv.coloCode).toBe('NRT');

      // Case B: KV store that throws on get()
      const throwingGetKv: EdgeKvStore = {
        get: async () => {
          throw new Error('KV 504 Gateway Timeout');
        },
        put: async () => {},
      };
      const resThrowingGet = await resolveEdgeRoutingWithKv(throwingGetKv, headers);
      expect(resThrowingGet.detectedLocale).toBe('ja');

      // Case C: KV store that returns corrupted JSON
      const corruptJsonKv: EdgeKvStore = {
        get: async () => '{"invalid json: missing end',
        put: async () => {},
      };
      const resCorrupt = await resolveEdgeRoutingWithKv(corruptJsonKv, headers);
      expect(resCorrupt.detectedLocale).toBe('ja');

      // Case D: KV store that returns invalid locale outside Enterprise 12
      const invalidLocaleKv: EdgeKvStore = {
        get: async () => JSON.stringify({ detectedLocale: 'klingon', isRtl: false }),
        put: async () => {},
      };
      const resInvalidLocale = await resolveEdgeRoutingWithKv(invalidLocaleKv, headers);
      expect(resInvalidLocale.detectedLocale).toBe('ja'); // Recomputed live

      // Case E: KV store that throws on put() (quota exceeded)
      const throwingPutKv: EdgeKvStore = {
        get: async () => null,
        put: async () => {
          throw new Error('KV 429 Quota Exceeded');
        },
      };
      const resThrowingPut = await resolveEdgeRoutingWithKv(throwingPutKv, headers);
      expect(resThrowingPut.detectedLocale).toBe('ja');
    });

    it('4.6: Validates SWR cache headers and cache key determinism', () => {
      const headers = buildSwrCacheHeaders(300, 86400);
      expect(headers['Cache-Control']).toContain('stale-while-revalidate=86400');
      expect(headers['Cloudflare-CDN-Cache-Control']).toContain('max-age=300');

      const reqHeaders: EdgeRequestHeaders = {
        ipCountry: 'VN',
        cfRay: '9f01234abcd-HAN',
        acceptLanguage: 'vi-VN,vi;q=0.9',
      };
      const key1 = buildEdgeRouteCacheKey(reqHeaders);
      const key2 = buildEdgeRouteCacheKey(reqHeaders);
      expect(key1).toBe(key2);
      expect(key1).toContain('edge_route:v1:VN:HAN:vi');
    });
  });

  // ==========================================================================
  // SECTION 5: Statutory Withholding Tax Invariant (1,000 Runs)
  // ==========================================================================

  describe('5. Statutory Withholding Tax Invariant (1,000 Monte Carlo Runs)', () => {
    it('5.1: Proves invariant grossCents === withholdingCents + netCents across 1,000 randomized payouts', () => {
      const jurisdictions: WithholdingJurisdiction[] = ['VN_FCT', 'US_W8', 'EU_RC', 'SG_NR', 'STANDARD_ZERO'];
      const statuses: TaxCertificateStatus[] = ['pending', 'verified', 'exempt', 'rejected'];
      const currencies: LedgerPayoutCurrency[] = ['USD', 'VND', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD', 'THB', 'IDR'];

      let totalGrossAllRuns = 0;
      let totalWithheldAllRuns = 0;
      let totalNetAllRuns = 0;

      // Seed pseudo-random generator with LCG for reproducible deterministic testing
      let seed = 42;
      function nextRandom(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let i = 0; i < 1_000; i++) {
        // Random gross cents between 0 and 1,000,000,000 cents ($0 to $10,000,000)
        const grossCents = Math.floor(nextRandom() * 10_000_000);
        const jurisdiction = jurisdictions[Math.floor(nextRandom() * jurisdictions.length)];
        const isIndividual = nextRandom() > 0.5;
        const certificateStatus = statuses[Math.floor(nextRandom() * statuses.length)];
        const customTreatyRate = Math.floor(nextRandom() * 30);
        const targetCurrency = currencies[Math.floor(nextRandom() * currencies.length)];
        const hedgingBufferPct = nextRandom() * 3.0;

        const input: CalculateWithholdingTaxInput = {
          grossCents,
          jurisdiction,
          isIndividual,
          certificateStatus,
          customTreatyRatePct: customTreatyRate,
        };

        const tax = calculateWithholdingTax(input);

        // Core statutory invariant check
        expect(tax.grossCents).toBe(tax.withholdingCents + tax.netCents);
        expect(tax.withholdingCents).toBeGreaterThanOrEqual(0);
        expect(tax.netCents).toBeGreaterThanOrEqual(0);
        expect(tax.withholdingCents).toBeLessThanOrEqual(tax.grossCents);

        // Cross-border payout calculation invariant check
        const { payout } = calculateCrossBorderPayout({
          ...input,
          targetCurrency,
          hedgingBufferPct,
        });

        expect(payout.grossCents).toBe(payout.withholdingCents + payout.netCents);
        expect(payout.localPayoutAmount).toBeGreaterThanOrEqual(0);

        // Zero-decimal currency integrity: VND and JPY must be strictly integers
        if (targetCurrency === 'VND' || targetCurrency === 'JPY') {
          expect(Number.isInteger(payout.localPayoutAmount)).toBe(true);
        }

        totalGrossAllRuns += tax.grossCents;
        totalWithheldAllRuns += tax.withholdingCents;
        totalNetAllRuns += tax.netCents;
      }

      // Macro-level portfolio invariant
      expect(totalGrossAllRuns).toBe(totalWithheldAllRuns + totalNetAllRuns);
      expect(totalGrossAllRuns).toBeGreaterThan(0);
    });

    it('5.2: Verifies statutory rates for Vietnam FCT, US W-8, EU Reverse Charge, and Singapore', () => {
      // 1. Vietnam FCT
      const vnCorp = calculateWithholdingTax({ grossCents: 10000, jurisdiction: 'VN_FCT', isIndividual: false });
      expect(vnCorp.ratePct).toBe(10.0);
      expect(vnCorp.withholdingCents).toBe(1000);
      expect(vnCorp.netCents).toBe(9000);

      const vnIndiv = calculateWithholdingTax({ grossCents: 10000, jurisdiction: 'VN_FCT', isIndividual: true });
      expect(vnIndiv.ratePct).toBe(5.0);
      expect(vnIndiv.withholdingCents).toBe(500);
      expect(vnIndiv.netCents).toBe(9500);

      const vnExempt = calculateWithholdingTax({ grossCents: 10000, jurisdiction: 'VN_FCT', certificateStatus: 'exempt' });
      expect(vnExempt.ratePct).toBe(0);
      expect(vnExempt.withholdingCents).toBe(0);

      // 2. US W-8
      const usUnverified = calculateWithholdingTax({ grossCents: 10000, jurisdiction: 'US_W8', certificateStatus: 'pending' });
      expect(usUnverified.ratePct).toBe(30.0);
      expect(usUnverified.withholdingCents).toBe(3000);

      const usVerified = calculateWithholdingTax({ grossCents: 10000, jurisdiction: 'US_W8', certificateStatus: 'verified' });
      expect(usVerified.ratePct).toBe(10.0); // Standard treaty default
      expect(usVerified.withholdingCents).toBe(1000);

      const usCustomTreaty = calculateWithholdingTax({ grossCents: 10000, jurisdiction: 'US_W8', certificateStatus: 'verified', customTreatyRatePct: 5.0 });
      expect(usCustomTreaty.ratePct).toBe(5.0);
      expect(usCustomTreaty.withholdingCents).toBe(500);

      // 3. EU Reverse Charge
      const euRc = calculateWithholdingTax({ grossCents: 10000, jurisdiction: 'EU_RC' });
      expect(euRc.ratePct).toBe(0.0);
      expect(euRc.withholdingCents).toBe(0);

      // 4. Singapore Non-Resident
      const sgNr = calculateWithholdingTax({ grossCents: 10000, jurisdiction: 'SG_NR' });
      expect(sgNr.ratePct).toBe(15.0);
      expect(sgNr.withholdingCents).toBe(1500);
    });

    it('5.3: Handles zero, negative, and fractional inputs with mathematical rigor', () => {
      // Zero gross cents
      const zero = calculateWithholdingTax({ grossCents: 0, jurisdiction: 'US_W8' });
      expect(zero.grossCents).toBe(0);
      expect(zero.withholdingCents).toBe(0);
      expect(zero.netCents).toBe(0);

      // Negative gross cents clamped to 0
      const negative = calculateWithholdingTax({ grossCents: -500, jurisdiction: 'US_W8' });
      expect(negative.grossCents).toBe(0);
      expect(negative.withholdingCents).toBe(0);
      expect(negative.netCents).toBe(0);

      // Fractional cents floored to integer
      const fractional = calculateWithholdingTax({ grossCents: 100.99, jurisdiction: 'US_W8', certificateStatus: 'pending' });
      expect(fractional.grossCents).toBe(100);
      expect(fractional.withholdingCents).toBe(30);
      expect(fractional.netCents).toBe(70);
    });
  });

  // ==========================================================================
  // SECTION 6: RTL Arabic Layout & BiDi Injection Isolation
  // ==========================================================================

  describe('6. RTL Arabic Layout & BiDi Injection Isolation', () => {
    it('6.1: Identifies Arabic (ar) as RTL and all other 11 Enterprise locales as LTR', () => {
      expect(isRtlLocale('ar')).toBe(true);
      expect(isRtlLocale('ar-EG')).toBe(true);
      expect(isRtlLocale('ar-SA')).toBe(true);
      expect(isRtlLocale('AR')).toBe(true);

      const nonRtlLocales = ['en', 'vi', 'ja', 'ko', 'zh', 'es', 'fr', 'de', 'th', 'id', 'hi'];
      for (const loc of nonRtlLocales) {
        expect(isRtlLocale(loc)).toBe(false);
      }
    });

    it('6.2 [BiDi Injection Probes]: Resists Unicode BiDi override characters in locale detection', () => {
      // Right-To-Left Override (U+202E) prepended to English or appended to Arabic
      const rlo = '\u202E';
      expect(isRtlLocale(`${rlo}en`)).toBe(false);
      expect(isRtlLocale(`${rlo}ar`)).toBe(false); // Does not match 'ar' cleanly

      // Pop Directional Formatting (U+202C)
      const pdf = '\u202C';
      expect(isRtlLocale(`ar${pdf}`)).toBe(false);

      // Left-To-Right Isolate (U+2066)
      const lri = '\u2066';
      expect(isRtlLocale(`${lri}ar`)).toBe(false);

      // Null and undefined safety
      expect(isRtlLocale(null)).toBe(false);
      expect(isRtlLocale(undefined)).toBe(false);
      expect(isRtlLocale('')).toBe(false);
    });

    it('6.3: Formats localized enterprise URL paths safely', () => {
      expect(formatLocalizedEnterprisePath('/pricing', 'ar')).toBe('/ar/pricing');
      expect(formatLocalizedEnterprisePath('/vi/pricing', 'ar')).toBe('/ar/pricing');
      expect(formatLocalizedEnterprisePath('/', 'ar')).toBe('/ar');
      expect(formatLocalizedEnterprisePath('', 'ar')).toBe('/ar');

      // BiDi override injection in path
      const injectedPath = '/pricing\u202Eevil';
      const formatted = formatLocalizedEnterprisePath(injectedPath, 'ar');
      expect(formatted.startsWith('/ar/')).toBe(true);
    });

    it('6.4: Validates that edge routing decision sets isRtl: true only for Arabic', () => {
      const arDecision = makeEdgeRoutingDecision({
        ipCountry: 'SA',
        cfRay: '12345-RUH',
      });
      expect(arDecision.detectedLocale).toBe('ar');
      expect(arDecision.isRtl).toBe(true);

      const vnDecision = makeEdgeRoutingDecision({
        ipCountry: 'VN',
        cfRay: '12345-HAN',
      });
      expect(vnDecision.detectedLocale).toBe('vi');
      expect(vnDecision.isRtl).toBe(false);

      const usDecision = makeEdgeRoutingDecision({
        ipCountry: 'US',
        cfRay: '12345-IAD',
      });
      expect(usDecision.detectedLocale).toBe('en');
      expect(usDecision.isRtl).toBe(false);
    });
  });
});
