/**
 * Sovereign Data Residency & Cryptographic Compliance Vault: CMEK Registration Action
 *
 * Layer: land (Public business layer & server actions)
 *
 * @module land/admin/vault-actions/cmek-register-action
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type { TenantSovereignKey } from '@/seed/types/sovereign-vault';
import { SOVEREIGN_ZONE_CONFIGS } from '@/tree/sovereignty/sovereign-zone-router';
import {
  initializeTenantSovereignKey,
  base64ToBytes,
} from '@/tree/sovereignty/cmek-envelope-engine';
import { appendComplianceAuditLog } from '@/tree/sovereignty/compliance-ledger';
import { sha256Hex } from '@/tree/sovereignty/right-to-be-forgotten-engine';
import { assertVaultAccess } from './auth-guard';
import type { RegisterCmekActionInput, SovereignVaultActionError } from './types';

/**
 * Registers and provisions a Customer-Managed Encryption Key (CMEK) with envelope wrapping.
 */
export async function registerTenantCmekAction(
  input: RegisterCmekActionInput,
): Promise<Result<TenantSovereignKey, SovereignVaultActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertVaultAccess(db, input.orgId);
  if (!auth.ok) return auth;

  try {
    // Resolve zone ID
    const zoneRow = await db
      .prepare('SELECT id FROM sovereign_data_zones WHERE zone_code = ?1 LIMIT 1')
      .bind(input.zoneCode)
      .first<{ id: string }>();

    const zoneId = zoneRow?.id ?? `zone_${input.zoneCode.toLowerCase()}`;

    let rawKek: Uint8Array | undefined;
    if (input.rawKekBase64) {
      rawKek = base64ToBytes(input.rawKekBase64);
    }

    const { keyRecord } = await initializeTenantSovereignKey({
      orgId: input.orgId,
      zoneId,
      zoneCode: input.zoneCode,
      keyAlias: input.keyAlias,
      keyType: input.keyType,
      rawKek,
      rotationIntervalDays: input.rotationIntervalDays,
    });

    // Save key to D1
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
        keyRecord.lastRotatedAt,
        keyRecord.nextRotationDueAt,
        keyRecord.createdAt,
        keyRecord.updatedAt,
      )
      .run();

    // Log compliance event
    await appendComplianceAuditLog(db, {
      orgId: input.orgId,
      zoneId,
      actorId: auth.value.userId,
      actorType: 'user',
      actorIpHash: await sha256Hex('127.0.0.1'),
      action: 'CMEK_KEY_REGISTERED',
      resourceType: 'tenant_sovereign_key',
      resourceId: keyRecord.id,
      jurisdictionCompliance: SOVEREIGN_ZONE_CONFIGS[input.zoneCode].regulatoryFramework,
      policyVerdict: 'ALLOWED',
      payload: {
        keyAlias: input.keyAlias,
        keyVersion: keyRecord.keyVersion,
        fingerprint: keyRecord.kekReferenceOrFingerprint,
      },
    });

    return success(keyRecord);
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to register CMEK key', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to provision CMEK key' });
  }
}
