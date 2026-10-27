/**
 * D1 repository for OPC affiliate execution runs and verified media artifacts.
 *
 * All reads/writes are tenant-scoped, all writes are idempotent on a stable
 * idempotency key, and state changes use a compare-and-swap UPDATE so two
 * concurrent workers cannot both move the same run forward (or overspend).
 *
 * Layer: tree/affiliate/execution
 * @module tree/affiliate/execution/execution-repo
 */

import { success, failure, type Result } from '@/seed/types/result';
import {
  transitionExecutionState,
  type ExecutionBlockReason,
  type ExecutionState,
  type VerifiedArtifact,
} from './execution-contract';

export interface ExecutionRunRecord {
  id: string;
  tenantId: string;
  campaignId: string;
  offerId: string | null;
  approvalId: string | null;
  idempotencyKey: string;
  state: ExecutionState;
  locale: string;
  market: string | null;
  artifactId: string | null;
  channelId: string | null;
  reservedCostCents: number;
  actualCostCents: number | null;
  failureReason: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  /** True when the call found an existing row (duplicate/restart/replay). */
  replayed?: boolean;
}

export interface BeginRunInput {
  id?: string;
  tenantId: string;
  campaignId: string;
  offerId?: string | null;
  approvalId?: string | null;
  idempotencyKey: string;
  locale?: 'en' | 'vi';
  market?: string | null;
  reservedCostCents?: number;
  nowMs?: number;
}

interface RunRow {
  id: string;
  tenant_id: string;
  campaign_id: string;
  offer_id: string | null;
  approval_id: string | null;
  idempotency_key: string;
  state: ExecutionState;
  locale: string;
  market: string | null;
  artifact_id: string | null;
  channel_id: string | null;
  reserved_cost_cents: number;
  actual_cost_cents: number | null;
  failure_reason: string | null;
  created_at: number;
  updated_at: number;
}

function toRecord(row: RunRow): ExecutionRunRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    campaignId: row.campaign_id,
    offerId: row.offer_id,
    approvalId: row.approval_id,
    idempotencyKey: row.idempotency_key,
    state: row.state,
    locale: row.locale,
    market: row.market,
    artifactId: row.artifact_id,
    channelId: row.channel_id,
    reservedCostCents: row.reserved_cost_cents,
    actualCostCents: row.actual_cost_cents,
    failureReason: row.failure_reason,
    createdAtMs: row.created_at,
    updatedAtMs: row.updated_at,
  };
}

const SELECT_COLUMNS = `id, tenant_id, campaign_id, offer_id, approval_id, idempotency_key,
  state, locale, market, artifact_id, channel_id, reserved_cost_cents,
  actual_cost_cents, failure_reason, created_at, updated_at`;

export async function beginExecutionRun(
  db: D1Database,
  input: BeginRunInput,
): Promise<Result<ExecutionRunRecord, string>> {
  if (!input.tenantId || !input.campaignId || !input.idempotencyKey) {
    return failure('TENANT_CAMPAIGN_AND_IDEMPOTENCY_KEY_REQUIRED');
  }
  const now = input.nowMs ?? Date.now();
  const id = input.id ?? `run_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

  try {
    await db
      .prepare(
        `INSERT INTO affiliate_execution_runs
          (id, tenant_id, campaign_id, offer_id, approval_id, idempotency_key, state,
           locale, market, reserved_cost_cents, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'approval_pending', ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, idempotency_key) DO NOTHING`,
      )
      .bind(
        id,
        input.tenantId,
        input.campaignId,
        input.offerId ?? null,
        input.approvalId ?? null,
        input.idempotencyKey,
        input.locale ?? 'en',
        input.market ?? null,
        input.reservedCostCents ?? 0,
        now,
        now,
      )
      .run();

    const row = await db
      .prepare(`SELECT ${SELECT_COLUMNS} FROM affiliate_execution_runs WHERE tenant_id = ? AND idempotency_key = ?`)
      .bind(input.tenantId, input.idempotencyKey)
      .first<RunRow>();
    if (!row) return failure('EXECUTION_RUN_READ_BACK_FAILED');
    return success({ ...toRecord(row), replayed: row.id !== id });
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }
}

export async function getExecutionRun(
  db: D1Database,
  tenantId: string,
  runId: string,
): Promise<ExecutionRunRecord | null> {
  const row = await db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM affiliate_execution_runs WHERE tenant_id = ? AND id = ?`)
    .bind(tenantId, runId)
    .first<RunRow>();
  return row ? toRecord(row) : null;
}

/**
 * Compare-and-swap state change. On a duplicate/retry that already reached the
 * target state, returns the current record with `replayed: true` instead of
 * applying side effects twice.
 */
export async function transitionRun(
  db: D1Database,
  tenantId: string,
  runId: string,
  from: ExecutionState,
  to: ExecutionState,
  patch: { failureReason?: string | null; channelId?: string; actualCostCents?: number } = {},
  nowMs: number = Date.now(),
): Promise<Result<ExecutionRunRecord, ExecutionBlockReason | string>> {
  const check = transitionExecutionState(from, to);
  if (!check.ok) return failure(check.error);

  const res = await db
    .prepare(
      `UPDATE affiliate_execution_runs
       SET state = ?, failure_reason = ?, channel_id = COALESCE(?, channel_id),
           actual_cost_cents = COALESCE(?, actual_cost_cents), updated_at = ?
       WHERE id = ? AND tenant_id = ? AND state = ?`,
    )
    .bind(
      to,
      patch.failureReason ?? null,
      patch.channelId ?? null,
      patch.actualCostCents ?? null,
      nowMs,
      runId,
      tenantId,
      from,
    )
    .run();

  const changed = res.meta?.changes ?? 0;
  const current = await getExecutionRun(db, tenantId, runId);
  if (!current) return failure('EXECUTION_RUN_NOT_FOUND');
  if (changed === 0) {
    if (current.state === to) return success({ ...current, replayed: true });
    return failure('CONCURRENT_STATE_CHANGE');
  }
  return success({ ...current, replayed: false });
}

/**
 * Persists verified media metadata and (only if present) advances the run to
 * `rendered`. Replay of the same artifact is a no-op, never a second render.
 */
export async function recordVerifiedArtifact(
  db: D1Database,
  tenantId: string,
  runId: string,
  artifact: VerifiedArtifact,
  nowMs: number = Date.now(),
): Promise<Result<ExecutionRunRecord, string>> {
  try {
    await db
      .prepare(
        `INSERT INTO affiliate_media_artifacts
          (id, tenant_id, run_id, storage_key, media_type, byte_size, duration_sec,
           checksum_sha256, is_fixture, verified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, run_id, storage_key) DO NOTHING`,
      )
      .bind(
        artifact.id,
        tenantId,
        runId,
        artifact.storageKey,
        artifact.mediaType,
        artifact.byteSize,
        artifact.durationSec ?? null,
        artifact.checksumSha256,
        artifact.isFixture ? 1 : 0,
        artifact.verifiedAtMs,
        nowMs,
      )
      .run();

    // A replay where the run is already `rendered` is a no-op success; any
    // other failure is a real error and must not be reported as produced media.
    const transition = await transitionRun(db, tenantId, runId, 'render_queued', 'rendered', {}, nowMs);
    if (!transition.ok) {
      const current = await getExecutionRun(db, tenantId, runId);
      if (!current || current.state !== 'rendered') return failure(String(transition.error));
      return success({ ...current, replayed: true });
    }

    await db
      .prepare('UPDATE affiliate_execution_runs SET artifact_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?')
      .bind(artifact.id, nowMs, runId, tenantId)
      .run();
    const final = await getExecutionRun(db, tenantId, runId);
    if (!final) return failure('EXECUTION_RUN_READ_BACK_FAILED');
    return success(final);
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }
}
