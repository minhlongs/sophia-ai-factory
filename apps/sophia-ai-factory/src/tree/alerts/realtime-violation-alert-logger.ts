import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { Tier } from '@/seed/types';
import type { AlertSeverity } from './realtime-alert-types';
import { createRealtimeAlert } from './realtime-alert-mutations';

/** Log violation record and create alert in a single operation. */
export async function logViolationAndAlert(params: {
  userId: string;
  licenseNonce: string;
  tier: Tier;
  type: 'quota_exceeded' | 'rate_limit_exceeded' | 'unauthorized_access';
  severity: AlertSeverity;
  endpoint: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ violationId: string | null; alertId: string | null }> {
  const db = createServerClient();

  const violationId = await (async () => {
    try {
      const { data: rawData, error: _error } = await db
        .from('violations')
        .insert({
          type: params.type,
          severity: params.severity,
          user_id: params.userId,
          license_nonce: params.licenseNonce,
          tier: params.tier,
          endpoint: params.endpoint,
          ip_address: params.ipAddress,
          user_agent: params.userAgent,
          metadata: params.metadata || {},
        })
        .select('id')
        .single();
      const data = rawData as { id: string } | null;

      return data?.id || null;
    } catch (error) {
      logger.error('[Realtime Alert] Failed to log violation', toError(error));
      return null;
    }
  })();

  const alertId = await createRealtimeAlert({
    userId: params.userId,
    licenseNonce: params.licenseNonce,
    type: params.type === 'quota_exceeded' ? 'quota_exceeded' : 'usage_threshold',
    severity: params.severity,
    title: params.type === 'quota_exceeded' ? 'Quota Exceeded' : 'Access Violation',
    message: `Violation detected: ${params.type} at ${params.endpoint}`,
    metadata: {
      violationId,
      ...params.metadata,
    },
    ipAddress: params.ipAddress,
    endpoint: params.endpoint,
  });

  return { violationId, alertId };
}
