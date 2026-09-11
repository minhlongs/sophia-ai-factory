/**
 * AgentRun / AgentApproval D1 persistence
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/mission
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentRunRecord {
  id: string;
  agentId: string;
  workspaceId: string;
  missionId?: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'awaiting_approval';
  phase: 'planning' | 'executing' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled' | 'retrying';
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  errorJson?: Record<string, unknown>;
  errorMessage?: string;
  autonomyLevel: number;
  totalCostCents: number;
  totalTokens: number;
  retryCount: number;
  parentRunId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentLogEntry {
  id: string;
  runId: string;
  phase: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface CreateAgentRunInput {
  id: string;
  agentId: string;
  workspaceId: string;
  missionId?: string;
  autonomyLevel: number;
  inputJson?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentRunInput {
  status?: AgentRunRecord['status'];
  phase?: AgentRunRecord['phase'];
  outputJson?: Record<string, unknown>;
  errorJson?: Record<string, unknown>;
  errorMessage?: string;
  totalCostCents?: number;
  totalTokens?: number;
  retryCount?: number;
  startedAt?: number;
  endedAt?: number;
}

export interface CreateApprovalInput {
  id: string;
  agentRunId: string;
  actionId: string;
  actionType: string;
  actionSummary: string;
  estimatedCostCents?: number;
  timeoutAt?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toJson(v: Record<string, unknown> | undefined): string | undefined {
  if (!v) return undefined;
  try {
    return JSON.stringify(v);
  } catch {
    return undefined;
  }
}

function parseJson(v: string | null | undefined): Record<string, unknown> | undefined {
  if (!v) return undefined;
  try {
    return JSON.parse(v) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function rowToRun(row: Record<string, unknown>): AgentRunRecord {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    workspaceId: row.workspace_id as string,
    missionId: row.mission_id as string | undefined,
    createdAt: row.created_at as number,
    startedAt: row.started_at as number | undefined,
    endedAt: row.ended_at as number | undefined,
    status: row.status as AgentRunRecord['status'],
    phase: row.phase as AgentRunRecord['phase'],
    inputJson: parseJson(row.input_json as string | null | undefined),
    outputJson: parseJson(row.output_json as string | null | undefined),
    errorJson: parseJson(row.error_json as string | null | undefined),
    errorMessage: row.error_message as string | undefined,
    autonomyLevel: row.autonomy_level as number,
    totalCostCents: row.total_cost_cents as number,
    totalTokens: row.total_tokens as number,
    retryCount: row.retry_count as number,
    parentRunId: row.parent_run_id as string | undefined,
    metadata: parseJson(row.metadata as string | null | undefined),
  };
}

// ---------------------------------------------------------------------------
// AgentRun repo
// ---------------------------------------------------------------------------

export async function createAgentRun(
  input: CreateAgentRunInput
): Promise<Result<AgentRunRecord, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(
      `INSERT INTO agent_runs (id, agent_id, workspace_id, mission_id, autonomy_level, input_json, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        input.id,
        input.agentId,
        input.workspaceId,
        input.missionId ?? null,
        input.autonomyLevel,
        toJson(input.inputJson),
        toJson(input.metadata),
        now
      )
      .run();

    const row = await db
      .prepare(`SELECT * FROM agent_runs WHERE id = ?`)
      .bind(input.id)
      .first<Record<string, unknown>>();

    if (!row) {
      return failure({ code: 'NOT_FOUND', message: `AgentRun ${input.id} not found after insert` });
    }

    return success(rowToRun(row));
  } catch (err) {
    logger.error('createAgentRun failed', { error: err instanceof Error ? err.message : String(err), input });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

export async function getAgentRun(
  id: string
): Promise<Result<AgentRunRecord | null, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const row = await db.prepare(`SELECT * FROM agent_runs WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    if (!row) return success(null);
    return success(rowToRun(row));
  } catch (err) {
    logger.error('getAgentRun failed', { error: err instanceof Error ? err.message : String(err), id });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

/**
 * List agent runs for one mission, scoped to its workspace (belt-and-braces:
 * both filters are bound parameters). Newest first.
 */
export async function listAgentRunsForMission(
  missionId: string,
  workspaceId: string,
  limit = 10
): Promise<Result<AgentRunRecord[], { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const result = await db
      .prepare(
        `SELECT * FROM agent_runs WHERE mission_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?`
      )
      .bind(missionId, workspaceId, limit)
      .all<Record<string, unknown>>();

    const rows = result.results ?? [];
    return success(rows.map(rowToRun));
  } catch (err) {
    logger.error('listAgentRunsForMission failed', {
      error: err instanceof Error ? err.message : String(err),
      missionId,
      workspaceId,
    });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

export async function updateAgentRun(
  id: string,
  patch: UpdateAgentRunInput
): Promise<Result<AgentRunRecord, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (patch.status) { fields.push('status = ?'); values.push(patch.status); }
    if (patch.phase) { fields.push('phase = ?'); values.push(patch.phase); }
    if (patch.outputJson !== undefined) { fields.push('output_json = ?'); values.push(toJson(patch.outputJson)); }
    if (patch.errorJson !== undefined) { fields.push('error_json = ?'); values.push(toJson(patch.errorJson)); }
    if (patch.errorMessage !== undefined) { fields.push('error_message = ?'); values.push(patch.errorMessage); }
    if (patch.totalCostCents !== undefined) { fields.push('total_cost_cents = ?'); values.push(patch.totalCostCents); }
    if (patch.totalTokens !== undefined) { fields.push('total_tokens = ?'); values.push(patch.totalTokens); }
    if (patch.retryCount !== undefined) { fields.push('retry_count = ?'); values.push(patch.retryCount); }
    if (patch.startedAt !== undefined) { fields.push('started_at = ?'); values.push(patch.startedAt); }
    if (patch.endedAt !== undefined) { fields.push('ended_at = ?'); values.push(patch.endedAt); }

    if (fields.length === 0) {
      return failure({ code: 'NO_CHANGES', message: 'No fields to update' });
    }

    values.push(id);
    await db.prepare(`UPDATE agent_runs SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

    const row = await db.prepare(`SELECT * FROM agent_runs WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    if (!row) {
      return failure({ code: 'NOT_FOUND', message: `AgentRun ${id} not found after update` });
    }

    return success(rowToRun(row));
  } catch (err) {
    logger.error('updateAgentRun failed', { error: err instanceof Error ? err.message : String(err), id, patch });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

export async function appendAgentLog(
  entry: AgentLogEntry
): Promise<Result<AgentLogEntry, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    await db.prepare(
      `INSERT INTO agent_run_logs (id, agent_run_id, phase, level, message, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(entry.id, entry.runId, entry.phase, entry.level, entry.message, toJson(entry.metadata), entry.timestamp)
      .run();

    return success(entry);
  } catch (err) {
    logger.error('appendAgentLog failed', { error: err instanceof Error ? err.message : String(err), entry });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

// ---------------------------------------------------------------------------
// AgentApproval repo
// ---------------------------------------------------------------------------

export async function createApproval(
  input: CreateApprovalInput
): Promise<Result<Record<string, unknown>, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const now = Math.floor(Date.now() / 1000);
    const timeoutAt = input.timeoutAt ?? now + 86400;
    await db.prepare(
      `INSERT INTO agent_approvals (id, agent_run_id, action_id, action_type, action_summary, estimated_cost_cents, status, created_at, timeout_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        input.id,
        input.agentRunId,
        input.actionId,
        input.actionType,
        input.actionSummary,
        input.estimatedCostCents ?? null,
        'pending',
        now,
        timeoutAt
      )
      .run();

    return success({
      id: input.id,
      agentRunId: input.agentRunId,
      actionId: input.actionId,
      actionType: input.actionType,
      actionSummary: input.actionSummary,
      estimatedCostCents: input.estimatedCostCents,
      status: 'pending',
      createdAt: now,
      timeoutAt,
    });
  } catch (err) {
    logger.error('createApproval failed', { error: err instanceof Error ? err.message : String(err), input });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

export async function getApproval(
  id: string
): Promise<Result<Record<string, unknown> | null, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const row = await db.prepare(`SELECT * FROM agent_approvals WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    if (!row) return success(null);
    return success(row);
  } catch (err) {
    logger.error('getApproval failed', { error: err instanceof Error ? err.message : String(err), id });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

export async function resolveApproval(
  id: string,
  status: 'approved' | 'rejected',
  reviewerId: string,
  comment?: string,
  workspaceId?: string
): Promise<Result<Record<string, unknown>, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const row = await db.prepare(`SELECT * FROM agent_approvals WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    if (!row) {
      return failure({ code: 'NOT_FOUND', message: `Approval ${id} not found` });
    }
    if (workspaceId && row.agent_run_id) {
      const runRow = await db.prepare(`SELECT workspace_id FROM agent_runs WHERE id = ?`).bind(row.agent_run_id).first<{ workspace_id: string }>();
      if (runRow && runRow.workspace_id !== workspaceId) {
        return failure({ code: 'FORBIDDEN', message: `Approval ${id} does not belong to workspace ${workspaceId}` });
      }
    }
    if (row.status !== 'pending') {
      return failure({ code: 'ALREADY_RESOLVED', message: `Approval ${id} already resolved` });
    }

    const now = Math.floor(Date.now() / 1000);
    await db.prepare(`UPDATE agent_approvals SET status = ?, reviewer_id = ?, comment = ?, resolved_at = ? WHERE id = ?`)
      .bind(status, reviewerId, comment ?? null, now, id)
      .run();

    const updated = await db.prepare(`SELECT * FROM agent_approvals WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    return success((updated ?? row) as Record<string, unknown>);
  } catch (err) {
    logger.error('resolveApproval failed', { error: err instanceof Error ? err.message : String(err), id, status });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

// ---------------------------------------------------------------------------
// List pending approvals for a workspace
// ---------------------------------------------------------------------------

export interface PendingApprovalRecord {
  id: string;
  agentRunId: string;
  actionId: string;
  actionType: string;
  actionSummary: string;
  estimatedCostCents: number | null;
  status: string;
  createdAt: number;
  timeoutAt: number;
  agentId: string;
  missionId: string | null;
}

export async function listPendingApprovals(
  workspaceId: string,
  limit = 50,
  offset = 0
): Promise<Result<{ approvals: PendingApprovalRecord[]; count: number }, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }

    const result = await db
      .prepare(
        `SELECT aa.*, ar.agent_id, ar.mission_id
         FROM agent_approvals aa
         JOIN agent_runs ar ON aa.agent_run_id = ar.id
         WHERE ar.workspace_id = ? AND aa.status = 'pending'
         ORDER BY aa.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(workspaceId, limit, offset)
      .all<Record<string, unknown>>();

    const rows = result.results ?? [];
    const approvals: PendingApprovalRecord[] = rows.map((row) => ({
      id: row.id as string,
      agentRunId: row.agent_run_id as string,
      actionId: row.action_id as string,
      actionType: row.action_type as string,
      actionSummary: row.action_summary as string,
      estimatedCostCents: row.estimated_cost_cents as number | null,
      status: row.status as string,
      createdAt: row.created_at as number,
      timeoutAt: row.timeout_at as number,
      agentId: row.agent_id as string,
      missionId: row.mission_id as string | null,
    }));

    return success({ approvals, count: approvals.length });
  } catch (err) {
    logger.error('listPendingApprovals failed', {
      error: err instanceof Error ? err.message : String(err),
      workspaceId,
    });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

// ---------------------------------------------------------------------------
// Guarded run flip + stale approval expiry (human approval gates)
// ---------------------------------------------------------------------------

export interface ExpiredApproval {
  id: string;
  agentRunId: string;
}

/**
 * Guarded terminal fail of a run that is currently awaiting_approval.
 *
 * `WHERE status = 'awaiting_approval'` + `meta.changes` prevents a race with
 * the approval-timeout cron (which may already have failed the same run): if
 * the run is no longer awaiting, the UPDATE touches 0 rows and `failed` is
 * false so the caller knows it lost the race and must not double-report.
 */
export async function failAwaitingRun(
  id: string,
  errorJson: Record<string, unknown>,
  errorMessage: string
): Promise<Result<{ failed: boolean }, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const result = await db
      .prepare(
        `UPDATE agent_runs
         SET status = 'failed', phase = 'failed',
             error_message = ?, error_json = ?, ended_at = ?
         WHERE id = ? AND status = 'awaiting_approval'`
      )
      .bind(errorMessage, JSON.stringify(errorJson), nowSec, id)
      .run();
    return success({ failed: result.meta.changes > 0 });
  } catch (err) {
    logger.error('failAwaitingRun failed', {
      error: err instanceof Error ? err.message : String(err),
      id,
    });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

/**
 * Guarded flip of a running agent run to awaiting_approval.
 *
 * The `WHERE status = 'running'` + `meta.changes` check is the concurrency
 * guard: if the run already moved on (completed/failed/cancelled) the UPDATE
 * touches 0 rows and `flipped` is false (not an error) so the caller decides
 * whether to proceed.
 */
export async function markRunAwaitingApproval(
  id: string
): Promise<Result<{ flipped: boolean }, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const result = await db
      .prepare(
        `UPDATE agent_runs
         SET status = 'awaiting_approval', phase = 'awaiting_approval'
         WHERE id = ? AND status = 'running'`
      )
      .bind(id)
      .run();
    return success({ flipped: result.meta.changes > 0 });
  } catch (err) {
    logger.error('markRunAwaitingApproval failed', {
      error: err instanceof Error ? err.message : String(err),
      id,
    });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

/**
 * Expire pending approvals whose timeout_at has passed and fail their still-
 * awaiting_approval runs with APPROVAL_TIMEOUT.
 *
 * Both writes are guarded so a concurrent resolve or a double scan is safe:
 * the approval flip uses `WHERE status = 'pending'` and only rows that
 * actually flip are counted; the run fail uses `WHERE status =
 * 'awaiting_approval'` so a run that already resumed or failed is untouched.
 *
 * @param nowIso Optional reference time (ISO 8601); defaults to current time.
 */
export async function expireStaleApprovals(
  nowIso?: string
): Promise<Result<{ expiredCount: number; expired: ExpiredApproval[] }, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }

    const nowSec = nowIso === undefined
      ? Math.floor(Date.now() / 1000)
      : Math.floor(new Date(nowIso).getTime() / 1000);
    if (Number.isNaN(nowSec)) {
      return failure({ code: 'INVALID_TIME', message: `Invalid nowIso: ${nowIso}` });
    }

    const overdue = await db
      .prepare(
        `SELECT id, agent_run_id
         FROM agent_approvals
         WHERE status = 'pending' AND timeout_at IS NOT NULL AND timeout_at <= ?`
      )
      .bind(nowSec)
      .all<Record<string, unknown>>();

    const candidates = overdue.results ?? [];
    if (candidates.length === 0) {
      return success({ expiredCount: 0, expired: [] });
    }

    const expired: ExpiredApproval[] = [];
    for (const row of candidates) {
      const id = row.id as string;
      const agentRunId = row.agent_run_id as string;
      const flip = await db
        .prepare(
          `UPDATE agent_approvals
           SET status = 'expired', resolved_at = ?
           WHERE id = ? AND status = 'pending'`
        )
        .bind(nowSec, id)
        .run();
      if (flip.meta.changes > 0) {
        expired.push({ id, agentRunId });
      }
    }

    for (const item of expired) {
      await db
        .prepare(
          `UPDATE agent_runs
           SET status = 'failed', phase = 'failed',
               error_message = ?, error_json = ?, ended_at = ?
           WHERE id = ? AND status = 'awaiting_approval'`
        )
        .bind(
          'Approval expired before review',
          JSON.stringify({ code: 'APPROVAL_TIMEOUT', approvalId: item.id }),
          nowSec,
          item.agentRunId
        )
        .run();
    }

    return success({ expiredCount: expired.length, expired });
  } catch (err) {
    logger.error('expireStaleApprovals failed', {
      error: err instanceof Error ? err.message : String(err),
      nowIso,
    });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}