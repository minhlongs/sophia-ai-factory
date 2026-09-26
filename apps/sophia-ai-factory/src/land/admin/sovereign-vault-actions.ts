/**
 * Sovereign Data Residency & Cryptographic Compliance Vault Server Actions
 *
 * Implements administrative business mutations and queries for:
 * - Sovereign Data Zones management & tenant residency assignment
 * - Customer-Managed Encryption Keys (CMEK) lifecycle (create, rotate, crypto-shred)
 * - Cryptographic Certificate of Erasure issuance (Right-to-be-forgotten)
 * - Hash-chain audit ledger verification
 *
 * Layer: land (Public business layer & server actions)
 * Dependencies: @/seed/*, @/tree/sovereignty/*
 *
 * @module land/admin/sovereign-vault-actions
 */

'use server';

import type { D1Database } from '@cloudflare/workers-types';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  SovereignZoneCode,
  SovereignDataZone,
  TenantSovereignKey,
  ComplianceAuditLog,
  ErasureCertificate,
  ErasureRequestInput,
  ErasureExecutionResult,
  ChainVerificationResult,
  KeyType,
} from '@/seed/types/sovereign-vault';
import {
  mapRowToSovereignDataZone,
  SOVEREIGN_ZONE_CONFIGS,
  isValidZoneCode,
} from '@/tree/sovereignty/sovereign-zone-router';
import {
  initializeTenantSovereignKey,
  rotateTenantSovereignKey,
  cryptoShredDek,
  mapRowToTenantSovereignKey,
  base64ToBytes,
} from '@/tree/sovereignty/cmek-envelope-engine';
import {
  appendComplianceAuditLog,
  verifyComplianceAuditChain,
  queryComplianceAuditLogs,
  type AuditQueryFilters,
} from '@/tree/sovereignty/compliance-ledger';
import {
  executeRightToBeForgotten,
  verifyErasureCertificate,
  getErasureCertificateByNumber,
  sha256Hex,
} from '@/tree/sovereignty/right-to-be-forgotten-engine';

export interface SovereignVaultActionError {
  code: string;
  message: string;
}

export interface RegisterCmekActionInput {
  orgId: string;
  zoneCode: SovereignZoneCode;
  keyAlias: string;
  keyType?: KeyType;
  rawKekBase64?: string;
  rotationIntervalDays?: number;
}

// ── Authorization Guards ──────────────────────────────────────────────────────

interface AuthContext {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
}

async function assertVaultAccess(
  db: D1Database,
  orgId?: string,
): Promise<Result<AuthContext, SovereignVaultActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, userEmail: user.email, isAdmin: true });
  }

  if (!orgId) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Global sovereign vault administration requires platform administrator privileges.',
    });
  }

  // Check solo organization
  if (orgId === `org-${user.id}`) {
    return success({ userId: user.id, userEmail: user.email, isAdmin: false });
  }

  // Check organization membership
  const member = await db
    .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
    .bind(orgId, user.id)
    .first<{ role: string }>();

  if (!member) {
    return failure({ code: 'FORBIDDEN', message: 'You do not belong to this organization.' });
  }

  const role = member.role;
  const isPermitted =
    role === 'owner' || role === 'admin' || role === 'enterprise_admin';

  if (!isPermitted) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Your role lacks administrative permission for sovereign vault operations.',
    });
  }

  return success({ userId: user.id, userEmail: user.email, isAdmin: false });
}

// ── Server Actions ────────────────────────────────────────────────────────────

/**
 * Lists all active sovereign data zones registered in the platform.
 */
export async function getSovereignDataZonesAction(): Promise<
  Result<SovereignDataZone[], SovereignVaultActionError>
> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  try {
    const { results } = await db
      .prepare('SELECT * FROM sovereign_data_zones WHERE is_active = 1 ORDER BY created_at ASC')
      .all<Record<string, unknown>>();

    const zones = (results || []).map((row) => mapRowToSovereignDataZone(row));
    return success(zones);
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to fetch data zones', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to retrieve sovereign data zones' });
  }
}

/**
 * Assigns an organization to a territorial sovereign data zone.
 */
export async function assignTenantSovereignZoneAction(
  orgId: string,
  zoneCode: SovereignZoneCode,
): Promise<
  Result<{ success: boolean; orgId: string; zoneCode: SovereignZoneCode }, SovereignVaultActionError>
> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertVaultAccess(db, orgId);
  if (!auth.ok) return auth;

  if (!isValidZoneCode(zoneCode)) {
    return failure({ code: 'INVALID_ZONE', message: `Invalid zone code: ${zoneCode}` });
  }

  try {
    // Verify zone exists in D1
    const zoneRow = await db
      .prepare('SELECT id FROM sovereign_data_zones WHERE zone_code = ?1 LIMIT 1')
      .bind(zoneCode)
      .first<{ id: string }>();

    if (!zoneRow) {
      return failure({ code: 'ZONE_NOT_FOUND', message: `Sovereign zone ${zoneCode} not found` });
    }

    // Record compliance audit log
    await appendComplianceAuditLog(db, {
      orgId,
      zoneId: zoneRow.id,
      actorId: auth.value.userId,
      actorType: 'user',
      actorIpHash: await sha256Hex('127.0.0.1'),
      action: 'SOVEREIGN_ZONE_ASSIGNED',
      resourceType: 'organization',
      resourceId: orgId,
      jurisdictionCompliance: SOVEREIGN_ZONE_CONFIGS[zoneCode].regulatoryFramework,
      policyVerdict: 'ALLOWED',
      payload: {
        assignedZoneCode: zoneCode,
        zoneId: zoneRow.id,
      },
    });

    return success({ success: true, orgId, zoneCode });
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to assign sovereign zone', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to assign sovereign data zone' });
  }
}

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

/**
 * Triggers the automated Right-to-be-Forgotten pipeline and issues an Erasure Certificate.
 */
export async function executeRightToBeForgottenAction(
  input: ErasureRequestInput,
): Promise<Result<ErasureExecutionResult, SovereignVaultActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertVaultAccess(db, input.orgId);
  if (!auth.ok) return auth;

  try {
    const result = await executeRightToBeForgotten(db, input, {
      actorId: auth.value.userId,
    });

    return success(result);
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to execute right-to-be-forgotten', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to process erasure request' });
  }
}

/**
 * Verifies an Erasure Certificate by its unique certificate number.
 */
export async function verifyErasureCertificateAction(
  certificateNumber: string,
): Promise<
  Result<{ verified: boolean; certificate: ErasureCertificate }, SovereignVaultActionError>
> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  try {
    const cert = await getErasureCertificateByNumber(db, certificateNumber);
    if (!cert) {
      return failure({
        code: 'CERTIFICATE_NOT_FOUND',
        message: `Erasure certificate ${certificateNumber} was not found in the sovereign registry`,
      });
    }

    const signingKey = process.env.SOVEREIGN_COMPLIANCE_KEY ?? 'sophia_sov_vault_sec_master_2026';
    const verifyResult = await verifyErasureCertificate(cert, signingKey);

    if (!verifyResult.isValid) {
      return failure({
        code: 'INVALID_SIGNATURE',
        message: verifyResult.error ?? 'Certificate signature verification failed',
      });
    }

    return success({ verified: true, certificate: cert });
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to verify erasure certificate', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to verify erasure certificate' });
  }
}

/**
 * Cryptographically verifies the tamper-evident hash chain for an organization or zone.
 */
export async function verifySovereignComplianceChainAction(
  orgId?: string,
  zoneId?: string,
): Promise<Result<ChainVerificationResult, SovereignVaultActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertVaultAccess(db, orgId);
  if (!auth.ok) return auth;

  try {
    const result = await verifyComplianceAuditChain(db, {
      orgId,
      zoneId,
      signingKeySecret: process.env.SOVEREIGN_COMPLIANCE_KEY,
    });

    return success(result);
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to verify compliance chain', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to verify compliance hash chain' });
  }
}

/**
 * Queries the compliance audit vault with filters and pagination.
 */
export async function querySovereignAuditLogsAction(
  filters: AuditQueryFilters,
): Promise<Result<{ logs: ComplianceAuditLog[]; total: number }, SovereignVaultActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertVaultAccess(db, filters.orgId ?? undefined);
  if (!auth.ok) return auth;

  try {
    const result = await queryComplianceAuditLogs(db, filters);
    return success(result);
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to query compliance logs', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to retrieve compliance audit logs' });
  }
}
