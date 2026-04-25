import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Validate if the agency has access to the specified resource.
 * Checks ownership in DB for each resource type. Deny unknown types by default.
 */
export async function validateResourceAccess(
  agencyId: string,
  resourceType: string,
  resourceId: string | null
): Promise<boolean> {
  try {
    const db = createServerClient();

    switch (resourceType) {
      case 'usage_event': {
        if (!resourceId) return true;
        const { data, error } = await db
          .from('usage_events')
          .select('user_id')
          .eq('id', resourceId)
          .single();
        if (error || !data) {
          logger.warn('[Tenant Isolation] Usage event not found', { resourceId, agencyId });
          return false;
        }
        return data.user_id === agencyId;
      }

      case 'license': {
        if (!resourceId) return true;
        const { data, error } = await db
          .from('raas_licenses')
          .select('created_by')
          .eq('nonce', resourceId)
          .single();
        if (error || !data) {
          logger.warn('[Tenant Isolation] License not found', { resourceId, agencyId });
          return false;
        }
        return data.created_by === agencyId;
      }

      case 'reconciliation_job': {
        if (!resourceId) return true;
        const { data, error } = await db
          .from('raas_licenses')
          .select('created_by')
          .eq('id', resourceId)
          .single();
        if (error || !data) {
          logger.warn('[Tenant Isolation] Reconciliation job not found', { resourceId, agencyId });
          return false;
        }
        return data.created_by === agencyId;
      }

      case 'audit_log': {
        if (!resourceId) return true;
        const { data, error } = await db
          .from('raas_audit_logs')
          .select('user_id')
          .eq('id', resourceId)
          .single();
        if (error || !data) {
          logger.warn('[Tenant Isolation] Audit log not found', { resourceId, agencyId });
          return false;
        }
        return data.user_id === agencyId;
      }

      case 'usage_summary': {
        if (!resourceId) return true;
        const { data: daily, error: dailyError } = await db
          .from('usage_daily_summaries')
          .select('tenant_id')
          .eq('id', resourceId)
          .single();

        if (dailyError || !daily) {
          const { data: hourly, error: hourlyError } = await db
            .from('usage_hourly_summaries')
            .select('tenant_id')
            .eq('id', resourceId)
            .single();

          if (hourlyError || !hourly) {
            logger.warn('[Tenant Isolation] Usage summary not found', { resourceId, agencyId });
            return false;
          }
          return hourly.tenant_id === agencyId;
        }
        return daily.tenant_id === agencyId;
      }

      default:
        logger.warn('[Tenant Isolation] Unknown resource type access blocked', { resourceType, agencyId });
        return false;
    }
  } catch (error) {
    logger.error('[Tenant Isolation] Error validating resource access', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}
