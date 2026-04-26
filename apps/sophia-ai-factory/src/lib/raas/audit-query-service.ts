/**
 * Audit Query Service
 *
 * Read operations for RaaS audit logs:
 * filtered queries, per-license lookups, and JSON export.
 *
 * @module raas/audit-query-service
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import type { RaasAuditLogFilters, AuditLogResponse, RaasAuditLog } from '@/lib/raas-schema';

/**
 * Get audit logs with filters and pagination
 */
export async function getAuditLogs(filters: RaasAuditLogFilters): Promise<AuditLogResponse> {
  const db = createServerClient();
  const {
    action, license_id, license_nonce, user_id,
    page = 1, limit = 50,
    orderBy = 'created_at', orderDir = 'desc',
    startDate, endDate,
  } = filters;

  let query = db.from('raas_audit_logs').select('*', { count: 'exact' });

  if (action) query = query.eq('action', action);
  if (license_id) query = query.eq('license_id', license_id);
  if (license_nonce) query = query.eq('license_nonce', license_nonce);
  if (user_id) query = query.eq('user_id', user_id);
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  query = query.order(orderBy, { ascending: orderDir === 'asc' });

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    logger.error('Failed to fetch audit logs', toError(error));
    throw new Error(`Database error: ${error.message}`);
  }

  // Cast: DB CHECK constraint on `action` enforces RaasAuditLog['action'] union.
  return { logs: (data || []) as unknown as RaasAuditLog[], total: count || 0, page, limit };
}

/**
 * Get all audit logs for a specific license nonce
 */
export async function getAuditLogsByLicense(nonce: string): Promise<RaasAuditLog[]> {
  const db = createServerClient();

  const { data, error } = await db
    .from('raas_audit_logs')
    .select('*')
    .eq('license_nonce', nonce)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error(`Failed to fetch audit logs for license ${nonce}`, toError(error));
    throw new Error(`Database error: ${error.message}`);
  }

  return (data || []) as unknown as RaasAuditLog[];
}

/**
 * Export audit logs as JSON string
 */
export async function exportAuditLogs(options?: {
  action?: string;
  startDate?: number;
  endDate?: number;
}): Promise<string> {
  const db = createServerClient();
  let query = db.from('raas_audit_logs').select('*');

  if (options?.action) query = query.eq('action', options.action);
  if (options?.startDate) query = query.gte('created_at', options.startDate);
  if (options?.endDate) query = query.lte('created_at', options.endDate);

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to export audit logs', toError(error));
    throw new Error(`Database error: ${error.message}`);
  }

  return JSON.stringify(data, null, 2);
}
