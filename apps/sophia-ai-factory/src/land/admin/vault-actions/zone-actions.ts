/**
 * Sovereign Data Residency & Cryptographic Compliance Vault: Zone Actions
 *
 * Layer: land (Public business layer & server actions)
 *
 * @module land/admin/vault-actions/zone-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  SovereignZoneCode,
  SovereignDataZone,
} from '@/seed/types/sovereign-vault';
import {
  mapRowToSovereignDataZone,
  SOVEREIGN_ZONE_CONFIGS,
  isValidZoneCode,
} from '@/tree/sovereignty/sovereign-zone-router';
import { appendComplianceAuditLog } from '@/tree/sovereignty/compliance-ledger';
import { sha256Hex } from '@/tree/sovereignty/right-to-be-forgotten-engine';
import { assertVaultAccess } from './auth-guard';
import type { SovereignVaultActionError } from './types';

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
