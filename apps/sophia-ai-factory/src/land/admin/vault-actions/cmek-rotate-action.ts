/**
 * Sovereign Data Residency & Cryptographic Compliance Vault: CMEK Rotate Action
 *
 * Implements cryptographic key rotation generating a new wrapped DEK version.
 *
 * Layer: land (Public business layer & server actions)
 *
 * @module land/admin/vault-actions/cmek-rotate-action
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type { TenantSovereignKey } from '@/seed/types/sovereign-vault';
import {
  rotateTenantSovereignKey,
  mapRowToTenantSovereignKey,
  base64ToBytes,
} from '@/tree/sovereignty/cmek-envelope-engine';
import { appendComplianceAuditLog } from '@/tree/sovereignty/compliance-ledger';
import { sha256Hex } from '@/tree/sovereignty/right-to-be-forgotten-engine';
import { assertVaultAccess } from './auth-guard';
import type { SovereignVaultActionError } from './types';

/**
 * Rotates an existing customer encryption key, generating a new wrapped DEK version.
 */
export async function rotateTenantCmekAction(
  keyId: string,
  rawKekBase64: string,
  newRawKekBase64?: string,
): Promise<Result<TenantSovereignKey, SovereignVaultActionError>> {
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

  const currentKey = mapRowToTenantSovereignKey(existingRow);
  const auth = await assertVaultAccess(db, currentKey.orgId);
  if (!auth.ok) return auth;

  try {
    const rawKek = base64ToBytes(rawKekBase64);
    const newRawKek = newRawKekBase64 ? base64ToBytes(newRawKekBase64) : undefined;

    const { rotatedKeyRecord } = await rotateTenantSovereignKey(currentKey, rawKek, newRawKek);

    // Update old key to suspended state
    await db
      .prepare('UPDATE tenant_sovereign_keys SET key_state = ?1, updated_at = ?2 WHERE id = ?3')
      .bind('suspended', Date.now(), currentKey.id)
      .run();

    // Insert newly rotated key version
    await db
      .prepare(`
        INSERT INTO tenant_sovereign_keys (
          id, org_id, zone_id, key_alias, key_type, algorithm,
          key_version, wrapped_dek_ciphertext, dek_iv_base64,
          kek_reference_or_fingerprint, key_state, rotation_interval_days,
          last_rotated_at, next_rotation_due_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
      `)
      .bind(
        rotatedKeyRecord.id,
        rotatedKeyRecord.orgId,
        rotatedKeyRecord.zoneId,
        rotatedKeyRecord.keyAlias,
        rotatedKeyRecord.keyType,
        rotatedKeyRecord.algorithm,
        rotatedKeyRecord.keyVersion,
        rotatedKeyRecord.wrappedDekCiphertext,
        rotatedKeyRecord.dekIvBase64,
        rotatedKeyRecord.kekReferenceOrFingerprint,
        rotatedKeyRecord.keyState,
        rotatedKeyRecord.rotationIntervalDays,
        rotatedKeyRecord.lastRotatedAt,
        rotatedKeyRecord.nextRotationDueAt,
        rotatedKeyRecord.createdAt,
        rotatedKeyRecord.updatedAt,
      )
      .run();

    // Log audit event
    await appendComplianceAuditLog(db, {
      orgId: currentKey.orgId,
      zoneId: currentKey.zoneId,
      actorId: auth.value.userId,
      actorType: 'user',
      actorIpHash: await sha256Hex('127.0.0.1'),
      action: 'CMEK_KEY_ROTATED',
      resourceType: 'tenant_sovereign_key',
      resourceId: rotatedKeyRecord.id,
      jurisdictionCompliance: 'GLOBAL',
      policyVerdict: 'ALLOWED',
      payload: {
        previousKeyId: currentKey.id,
        newKeyVersion: rotatedKeyRecord.keyVersion,
      },
    });

    return success(rotatedKeyRecord);
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to rotate key', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to rotate sovereign key' });
  }
}
