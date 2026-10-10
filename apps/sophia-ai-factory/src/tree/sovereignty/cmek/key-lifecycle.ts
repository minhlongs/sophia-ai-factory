/**
 * CMEK Key Lifecycle, Rotation & Mapping Operations
 *
 * Layer: tree/sovereignty/cmek
 */

import type {
  TenantSovereignKey,
  KeyState,
  KeyType,
} from '@/seed/types/sovereign-vault';
import {
  CmekKeyDestroyedError,
  type CreateKeyInput,
} from './envelope-types';
import {
  generateRawKey,
  computeKeyFingerprint,
} from './web-crypto-primitives';
import { wrapDek } from './envelope-engine';

export async function initializeTenantSovereignKey(
  input: CreateKeyInput,
): Promise<{
  keyRecord: TenantSovereignKey;
  rawDek: Uint8Array;
  rawKek: Uint8Array;
}> {
  const rawDek = generateRawKey();
  const rawKek = input.rawKek ?? generateRawKey();

  const { wrappedDekBase64, dekIvBase64 } = await wrapDek(rawDek, rawKek);
  const fingerprint = await computeKeyFingerprint(rawKek);

  const now = Date.now();
  const rotationDays = input.rotationIntervalDays ?? 90;
  const keyId = `tsk_${input.orgId.replace(/[^a-zA-Z0-9]/g, '_')}_${input.keyAlias}_v1`;

  const keyRecord: TenantSovereignKey = {
    id: keyId,
    orgId: input.orgId,
    zoneId: input.zoneId,
    keyAlias: input.keyAlias,
    keyType: input.keyType ?? 'platform_managed_isolated',
    algorithm: 'AES-256-GCM',
    keyVersion: 1,
    wrappedDekCiphertext: wrappedDekBase64,
    dekIvBase64,
    kekReferenceOrFingerprint: fingerprint,
    keyState: 'active',
    rotationIntervalDays: rotationDays,
    lastRotatedAt: now,
    nextRotationDueAt: now + rotationDays * 86400000,
    revokedAt: null,
    revocationReason: null,
    createdAt: now,
    updatedAt: now,
  };

  return { keyRecord, rawDek, rawKek };
}

export async function rotateTenantSovereignKey(
  currentKey: TenantSovereignKey,
  rawKek: Uint8Array,
  newRawKek?: Uint8Array,
): Promise<{
  rotatedKeyRecord: TenantSovereignKey;
  newRawDek: Uint8Array;
}> {
  if (currentKey.keyState === 'destroyed') {
    throw new CmekKeyDestroyedError(currentKey.id);
  }

  const effectiveKek = newRawKek ?? rawKek;
  const newRawDek = generateRawKey();
  const { wrappedDekBase64, dekIvBase64 } = await wrapDek(newRawDek, effectiveKek);
  const fingerprint = await computeKeyFingerprint(effectiveKek);

  const now = Date.now();
  const nextVersion = currentKey.keyVersion + 1;
  const keyId = `tsk_${currentKey.orgId.replace(/[^a-zA-Z0-9]/g, '_')}_${currentKey.keyAlias}_v${nextVersion}`;

  const rotatedKeyRecord: TenantSovereignKey = {
    id: keyId,
    orgId: currentKey.orgId,
    zoneId: currentKey.zoneId,
    keyAlias: currentKey.keyAlias,
    keyType: currentKey.keyType,
    algorithm: 'AES-256-GCM',
    keyVersion: nextVersion,
    wrappedDekCiphertext: wrappedDekBase64,
    dekIvBase64,
    kekReferenceOrFingerprint: fingerprint,
    keyState: 'active',
    rotationIntervalDays: currentKey.rotationIntervalDays,
    lastRotatedAt: now,
    nextRotationDueAt: now + currentKey.rotationIntervalDays * 86400000,
    revokedAt: null,
    revocationReason: null,
    createdAt: now,
    updatedAt: now,
  };

  return { rotatedKeyRecord, newRawDek };
}

export function mapRowToTenantSovereignKey(row: Record<string, unknown>): TenantSovereignKey {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    zoneId: String(row.zone_id),
    keyAlias: String(row.key_alias),
    keyType: row.key_type as KeyType,
    algorithm: String(row.algorithm || 'AES-256-GCM'),
    keyVersion: Number(row.key_version || 1),
    wrappedDekCiphertext: String(row.wrapped_dek_ciphertext),
    dekIvBase64: String(row.dek_iv_base64),
    kekReferenceOrFingerprint: String(row.kek_reference_or_fingerprint),
    keyState: row.key_state as KeyState,
    rotationIntervalDays: Number(row.rotation_interval_days || 90),
    lastRotatedAt: row.last_rotated_at ? Number(row.last_rotated_at) : null,
    nextRotationDueAt: row.next_rotation_due_at ? Number(row.next_rotation_due_at) : null,
    revokedAt: row.revoked_at ? Number(row.revoked_at) : null,
    revocationReason: row.revocation_reason ? String(row.revocation_reason) : null,
    createdAt: Number(row.created_at || Date.now()),
    updatedAt: Number(row.updated_at || Date.now()),
  };
}
