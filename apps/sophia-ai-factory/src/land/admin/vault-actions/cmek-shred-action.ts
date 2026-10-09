/**
 * Sovereign Data Residency & Cryptographic Compliance Vault: CMEK Shred Action
 *
 * Implements irreversible zero-knowledge crypto-shredding on a tenant's sovereign key.
 *
 * Layer: land (Public business layer & server actions)
 *
 * @module land/admin/vault-actions/cmek-shred-action
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  cryptoShredDek,
  mapRowToTenantSovereignKey,
} from '@/tree/sovereignty/cmek-envelope-engine';
import { appendComplianceAuditLog } from '@/tree/sovereignty/compliance-ledger';
import { sha256Hex } from '@/tree/sovereignty/right-to-be-forgotten-engine';
import { assertVaultAccess } from './auth-guard';
import type { SovereignVaultActionError } from './types';

/**
 * Executes irreversible zero-knowledge crypto-shredding on a tenant's sovereign key.
 */
export async function cryptoShredTenantKeyAction(
  keyId: string,
  reason: string,
): Promise<Result<{ success: boolean; keyId: string; shreddedAt: number }, SovereignVaultActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const existingRow = await db
    .prepare('SELECT * FROM tenant_sovereign_keys WHERE id = ?1 LIMIT 1')
    .bind(keyId)
    .first<Record<string, unknown>>();

  if (!existingRow) {
    return failure({ code: 'KEY_NOT_FOUND', message: `Key ${keyId} not found` });
  }

  const key = mapRowToTenantSovereignKey(existingRow);
  const auth = await assertVaultAccess(db, key.orgId);
  if (!auth.ok) return auth;

  try {
    const { shreddedDekBase64, shreddedAt } = cryptoShredDek();

    await db
      .prepare(`
        UPDATE tenant_sovereign_keys
        SET wrapped_dek_ciphertext = ?1,
            key_state = 'destroyed',
            revoked_at = ?2,
            revocation_reason = ?3,
            updated_at = ?2
        WHERE id = ?4
      `)
      .bind(shreddedDekBase64, shreddedAt, reason, keyId)
      .run();

    // Log high-priority audit enforcement event
    await appendComplianceAuditLog(db, {
      orgId: key.orgId,
      zoneId: key.zoneId,
      actorId: auth.value.userId,
      actorType: 'user',
      actorIpHash: await sha256Hex('127.0.0.1'),
      action: 'CMEK_KEY_CRYPTO_SHREDDED',
      resourceType: 'tenant_sovereign_key',
      resourceId: keyId,
      jurisdictionCompliance: 'GLOBAL',
      policyVerdict: 'ENFORCED',
      payload: {
        keyAlias: key.keyAlias,
        keyVersion: key.keyVersion,
        revocationReason: reason,
        shreddedAt,
      },
    });

    return success({ success: true, keyId, shreddedAt });
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to crypto-shred key', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to execute crypto-shredding' });
  }
}
