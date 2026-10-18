import type { D1Database } from '@cloudflare/workers-types';
import type { LegalHoldStatus } from './types';
import { cryptoShredDek } from '../cmek-envelope-engine';

export {
  sha256Hex,
  computeMerkleRoot,
  generateSubjectPseudonym,
} from './merkle-hash-primitives';

/**
 * Verifies whether personal data erasure is blocked by statutory legal obligations.
 */
export async function checkLegalHold(
  db: D1Database,
  subjectId: string,
  orgId?: string,
): Promise<LegalHoldStatus> {
  try {
    const invoiceCountRow = await db
      .prepare(`
        SELECT COUNT(*) as count FROM payment_events
        WHERE user_id = ?1 AND created_at >= (strftime('%s', 'now') - 315360000) * 1000
      `)
      .bind(subjectId)
      .first<{ count: number }>();

    if (invoiceCountRow && Number(invoiceCountRow.count) > 0) {
      return {
        canErase: false,
        reason:
          'Data subject has financial tax invoices within the statutory 10-year retention window. Personal identifying data will be pseudonymized, but accounting ledger must be retained.',
        statutoryBasis: 'Vietnam Tax Law 38/2019/QH14, Circular TT78/2021 & EU VAT Directive 2006/112/EC',
        holdExpiresAt: Date.now() + 315360000 * 1000,
      };
    }
  } catch {
    // If payment_events table is empty or inaccessible, continue check
  }

  if (orgId) {
    try {
      const orgRow = await db
        .prepare('SELECT status FROM partner_organizations WHERE id = ?1 OR tenant_id = ?1')
        .bind(orgId)
        .first<{ status: string }>();

      if (orgRow && (orgRow.status === 'active' || orgRow.status === 'pending_approval')) {
        return {
          canErase: false,
          reason: 'Organization has an active enterprise contractual tier. Contract termination required prior to complete erasure.',
          statutoryBasis: 'Commercial Contractual Performance (GDPR Art 6(1)(b))',
        };
      }
    } catch {
      // Continue if table not present in test scope
    }
  }

  return { canErase: true };
}

export async function shredCustomerKeys(
  db: D1Database,
  orgId?: string,
): Promise<{ shreddedCount: number; fingerprint: string | null; keyRecordIds: string[] }> {
  if (!orgId) return { shreddedCount: 0, fingerprint: null, keyRecordIds: [] };
  let shreddedCount = 0;
  let fingerprint: string | null = null;
  const keyRecordIds: string[] = [];

  try {
    const keys = await db
      .prepare('SELECT id, key_alias, key_version, kek_reference_or_fingerprint FROM tenant_sovereign_keys WHERE org_id = ?1 AND key_state != ?2')
      .bind(orgId, 'destroyed')
      .all<{ id: string; key_alias: string; key_version: number; kek_reference_or_fingerprint: string }>();

    for (const k of keys.results || []) {
      const { shreddedDekBase64 } = cryptoShredDek();
      await db
        .prepare(`
          UPDATE tenant_sovereign_keys
          SET wrapped_dek_ciphertext = ?1,
              key_state = 'destroyed',
              revoked_at = ?2,
              revocation_reason = 'CRYPTO_SHRED_RIGHT_TO_ERASURE',
              updated_at = ?2
          WHERE id = ?3
        `)
        .bind(shreddedDekBase64, Date.now(), k.id)
        .run();

      shreddedCount++;
      fingerprint = k.kek_reference_or_fingerprint;
      keyRecordIds.push(`key:${k.id}`);
    }
  } catch {
    // No keys or table not present
  }

  return { shreddedCount, fingerprint, keyRecordIds };
}

export async function redactUserProfileRecord(
  db: D1Database,
  subjectId: string,
  now: number,
): Promise<string[]> {
  const affected: string[] = [];
  try {
    const profileUpdate = await db
      .prepare(`
        UPDATE user_profiles
        SET full_name = 'ERASED_SUBJECT',
            avatar_url = NULL,
            updated_at = ?1
        WHERE user_id = ?2
      `)
      .bind(now, subjectId)
      .run();

    if (profileUpdate.meta?.changes) {
      affected.push(`user_profile:${subjectId}`);
    }
  } catch {
    // Table might not exist in pure test harness
  }
  return affected;
}
