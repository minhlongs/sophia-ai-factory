import { logger } from '@/seed/utils/logger-utility';
import type { AutonomyLevel, AuditLedgerRecord } from '@/seed/types/agent-governance';
import { resolveDb } from './db-helper';
import type { QueryAuditLedgerOptions, QueryAuditLedgerResponse, AuditLedgerRow } from './types';

export async function queryAgyAuditLedger(
  agencyId: string,
  options: QueryAuditLedgerOptions = {},
  dbOverride?: unknown
): Promise<QueryAuditLedgerResponse> {
  try {
    if (!agencyId || typeof agencyId !== 'string') {
      return { success: false, error: 'INVALID_AGENCY_ID: agencyId is required' };
    }

    const db = resolveDb(dbOverride);
    const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
    const offset = Math.max(0, options.offset ?? 0);

    const conditions: string[] = ['agency_id = ?'];
    const params: unknown[] = [agencyId.trim()];

    if (options.agentId) {
      conditions.push('agent_id = ?');
      params.push(options.agentId.trim());
    }

    if (options.allowed !== undefined) {
      conditions.push('allowed = ?');
      params.push(options.allowed ? 1 : 0);
    }

    const sql = `SELECT * FROM agy_policy_audit_ledger WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const queryResult = await db.prepare(sql).bind(...params).all<AuditLedgerRow>();
    const rawRows: AuditLedgerRow[] = Array.isArray(queryResult)
      ? (queryResult as AuditLedgerRow[])
      : ((queryResult as { results?: AuditLedgerRow[] }).results ?? []);

    const records: AuditLedgerRecord[] = rawRows.map((row) => ({
      id: row.id,
      agencyId: row.agency_id,
      agentId: row.agent_id,
      action: row.action,
      requestedAutonomy: row.requested_autonomy as AutonomyLevel,
      maxAutonomy: (row.max_autonomy as AutonomyLevel) || null,
      requiredAutonomy: (row.required_autonomy as AutonomyLevel) || null,
      requestedCompute: row.requested_compute ?? row.requested_compute_units ?? 0,
      requestedComputeUnits: row.requested_compute_units ?? row.requested_compute ?? 0,
      allowed: Boolean(row.allowed),
      reason: row.reason,
      escalationTriggered: Boolean(row.escalation_triggered),
      evaluationSha256: row.evaluation_sha256,
      metadataJson: row.metadata_json,
      createdAt: row.created_at,
    }));

    return {
      success: true,
      data: {
        records,
        total: records.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[queryAgyAuditLedger] Query failed', { error: message, agencyId });
    return { success: false, error: message };
  }
}
