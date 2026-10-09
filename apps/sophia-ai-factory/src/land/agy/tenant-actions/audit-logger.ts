/**
 * Agency Tenant Audit Logging
 *
 * @module land/agy/tenant-actions/audit-logger
 */

import { createServerClient, tryCreateServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { AgyAuditLogRecord } from '@/seed/types/agy-multitenancy';

/** Helper to insert audit event log */
export async function recordAuditLog(
  agencyId: string,
  eventType: string,
  resource: string,
  details: Record<string, unknown>,
  actorId: string | null = null
): Promise<void> {
  const db = await tryCreateServerClient();
  if (!db) return;

  const now = Math.floor(Date.now() / 1000);
  const auditId = `aud_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

  try {
    await db
      .prepare(
        `INSERT INTO agy_audit_logs (id, agency_id, event_type, actor_id, resource, details_json, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      )
      .bind(
        auditId,
        agencyId,
        eventType,
        actorId,
        resource,
        JSON.stringify(details),
        now
      )
      .run();
  } catch (err) {
    logger.warn('[AGY Actions] Failed to write audit log', {
      agencyId,
      eventType,
      error: String(err),
    });
  }
}

/**
 * Queries audit logs for an agency.
 */
export async function queryAgencyAuditLogs(
  agencyId: string,
  limit: number = 50
): Promise<AgyAuditLogRecord[]> {
  const db = createServerClient();

  try {
    const rows = await db
      .prepare(
        `SELECT id, agency_id, event_type, actor_id, resource, details_json, timestamp
         FROM agy_audit_logs
         WHERE agency_id = ?1
         ORDER BY timestamp DESC
         LIMIT ?2`
      )
      .bind(agencyId, Math.min(200, Math.max(1, limit)))
      .all<{
        id: string;
        agency_id: string;
        event_type: string;
        actor_id: string | null;
        resource: string;
        details_json: string;
        timestamp: number;
      }>();

    const list = rows.results || [];
    return list.map((r) => {
      let details: Record<string, unknown> = {};
      try {
        details = JSON.parse(r.details_json || '{}');
      } catch {
        // fallback
      }
      return {
        id: r.id,
        agencyId: r.agency_id,
        eventType: r.event_type,
        actorId: r.actor_id,
        resource: r.resource,
        details,
        ipAddress: null,
        timestamp: r.timestamp,
        agency_id: r.agency_id,
        event_type: r.event_type,
        actor_id: r.actor_id,
        details_json: r.details_json,
      };
    });
  } catch (err) {
    logger.warn('[AGY Actions] queryAgencyAuditLogs error', { agencyId, error: String(err) });
    return [];
  }
}
