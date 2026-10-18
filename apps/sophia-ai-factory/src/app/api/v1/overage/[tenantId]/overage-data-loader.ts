/**
 * Database query helpers for the tenant overage endpoint.
 * @module app/api/v1/overage/[tenantId]/overage-data-loader
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { OverageEvent } from '@/seed/types/billing-contracts';

export interface TenantOverageData {
  tier: string;
  overageEvents: OverageEvent[];
}

export async function fetchTenantOverageData(
  userId: string,
  tenantId: string,
): Promise<{ ok: true; data: TenantOverageData } | { ok: false; status: number; message: string }> {
  const db = createServerClient();
  const { data: license, error: licenseError } = await db
    .from('raas_licenses')
    .select('nonce, tier, agency_id')
    .eq('agency_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (licenseError || !license) {
    logger.warn('[Overage API] No active license found for tenant', { tenantId, userId });
    return { ok: false, status: 404, message: 'Tenant not found or no active license' };
  }

  const typedLicense = license as { nonce: string; tier: string; agency_id: string };

  const { data: overageEvents, error: overageError } = await db
    .from('overage_events')
    .select('*')
    .eq('user_id', userId)
    .eq('license_nonce', typedLicense.nonce)
    .order('created_at', { ascending: false })
    .limit(100);

  if (overageError) {
    logger.error('[Overage API] Failed to fetch overage events', {
      error: overageError.message,
      tenantId,
      userId,
    });
    return { ok: false, status: 500, message: 'Failed to fetch overage events' };
  }

  return {
    ok: true,
    data: {
      tier: typedLicense.tier,
      overageEvents: (overageEvents as unknown as OverageEvent[]) ?? [],
    },
  };
}
