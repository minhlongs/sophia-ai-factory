/**
 * Agency Tenant Quota Management
 *
 * @module land/agy/tenant-actions/quota-manager
 */

import { createServerClient } from '@/seed/db/client';
import { recordAuditLog } from './audit-logger';

/**
 * Updates an agency's compute quota limit and rate limit.
 */
export async function updateAgencyQuota(input: {
  agencyId: string;
  quotaLimitMcu: number;
  rateLimitRps?: number;
  actorId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { agencyId, quotaLimitMcu, rateLimitRps, actorId } = input;

  if (!agencyId || quotaLimitMcu < 0) {
    return { success: false, error: 'Valid agencyId and non-negative quotaLimitMcu required' };
  }

  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  try {
    if (rateLimitRps !== undefined && rateLimitRps > 0) {
      await db
        .prepare(
          `UPDATE agy_tenant_configs
           SET quota_limit_mcu = ?1, rate_limit_rps = ?2, updated_at = ?3
           WHERE agency_id = ?4`
        )
        .bind(quotaLimitMcu, rateLimitRps, now, agencyId)
        .run();
    } else {
      await db
        .prepare(
          `UPDATE agy_tenant_configs
           SET quota_limit_mcu = ?1, updated_at = ?2
           WHERE agency_id = ?3`
        )
        .bind(quotaLimitMcu, now, agencyId)
        .run();
    }

    await recordAuditLog(agencyId, 'QUOTA_UPDATED', `agency:${agencyId}`, {
      newQuotaLimitMcu: quotaLimitMcu,
      newRateLimitRps: rateLimitRps,
    }, actorId);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Increments quota used by an agency.
 */
export async function incrementAgencyQuotaUsed(
  agencyId: string,
  deltaMcu: number
): Promise<{ success: boolean; newQuotaUsedMcu?: number; error?: string }> {
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  try {
    // Atomic SQL increment preventing read-modify-write race conditions
    // Clamps at 0 so quota_used_mcu never drops below 0 on negative deltas
    const res = await db
      .prepare(
        `UPDATE agy_tenant_configs
         SET quota_used_mcu = MAX(0, ROUND(quota_used_mcu + ?1)), updated_at = ?2
         WHERE agency_id = ?3`
      )
      .bind(deltaMcu, now, agencyId)
      .run();

    if ((res.meta?.changes ?? 0) === 0) {
      return { success: false, error: `Agency ${agencyId} not found` };
    }

    const updated = await db
      .prepare(`SELECT quota_used_mcu FROM agy_tenant_configs WHERE agency_id = ?1 LIMIT 1`)
      .bind(agencyId)
      .first<{ quota_used_mcu: number }>();

    return { success: true, newQuotaUsedMcu: updated?.quota_used_mcu ?? 0 };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
