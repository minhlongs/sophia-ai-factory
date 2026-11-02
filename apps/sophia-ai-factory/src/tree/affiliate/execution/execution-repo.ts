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

import {
  PROPOSED_GATE1_TOTAL_CAP_CENTS,
  PROPOSED_GATE1_VERTICAL_CAP_CENTS,
} from '@/seed/config/affiliate-budget-defaults';
import { success, failure, type Result } from '@/seed/types/result';
import {
  hasVerifiedMedia,
  transitionExecutionState,
  type ExecutionBlockReason,
  type ExecutionState,
  type VerifiedArtifact,
} from './execution-contract';
import {
  computeTtsReserveCents,
  decodeExecutionMarket,
  encodeExecutionMarket,
  evaluateCumulativePilotBudget,
  getWorkspacePilotBudgetSummary,
  SQL_CLASSIFY_RUN_NICHE,
  SQL_COMMITTED_RUN_PREDICATE,
  type PilotVerticalNiche,
  type WorkspacePilotBudgetSummary,
} from './execution-budget-ledger';

export {
  computeTtsReserveCents,
  decodeExecutionMarket,
  encodeExecutionMarket,
  evaluateCumulativePilotBudget,
  getWorkspacePilotBudgetSummary,
  type PilotVerticalNiche,
  type WorkspacePilotBudgetSummary,
};

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
  niche?: PilotVerticalNiche | null;
  artifactId: string | null;
  channelId: string | null;
  reservedCostCents: number;
  actualCostCents: number | null;
  failureReason: string | null;
  providerJobId: string | null;
  renderAttempts: number;
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
  niche?: PilotVerticalNiche | null;
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
  provider_job_id: string | null;
  render_attempts: number;
  created_at: number;
  updated_at: number;
}

function toRecord(row: RunRow): ExecutionRunRecord {
  const decoded = decodeExecutionMarket(row.market);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    campaignId: row.campaign_id,
    offerId: row.offer_id,
    approvalId: row.approval_id,
    idempotencyKey: row.idempotency_key,
    state: row.state,
    locale: row.locale,
    market: decoded.market,
    niche: decoded.niche,
    artifactId: row.artifact_id,
    channelId: row.channel_id,
    reservedCostCents: row.reserved_cost_cents,
    actualCostCents: row.actual_cost_cents,
    failureReason: row.failure_reason,
    providerJobId: row.provider_job_id,
    renderAttempts: row.render_attempts,
    createdAtMs: row.created_at,
    updatedAtMs: row.updated_at,
  };
}

const SELECT_COLUMNS = `id, tenant_id, campaign_id, offer_id, approval_id, idempotency_key,
  state, locale, market, artifact_id, channel_id, reserved_cost_cents,
  actual_cost_cents, failure_reason, provider_job_id, render_attempts,
  created_at, updated_at`;

export async function beginExecutionRun(
  db: D1Database,
  input: BeginRunInput,
): Promise<Result<ExecutionRunRecord, string>> {
  if (!input.tenantId || !input.campaignId || !input.idempotencyKey) {
    return failure('TENANT_CAMPAIGN_AND_IDEMPOTENCY_KEY_REQUIRED');
  }
  const reservedCostCents = input.reservedCostCents ?? 0;
  if (!Number.isFinite(reservedCostCents) || reservedCostCents < 0) {
    return failure('INVALID_RESERVED_COST');
  }

  const now = input.nowMs ?? Date.now();
  const id = input.id ?? `run_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const resolvedNiche: PilotVerticalNiche | null =
    input.niche ??
    (input.offerId?.includes('_cex_') || input.campaignId.includes('crypto')
      ? 'crypto_global'
      : input.offerId?.includes('_saas_') || input.campaignId.includes('saas')
        ? 'saas_global'
        : null);
  const applicableCapCents = resolvedNiche
    ? PROPOSED_GATE1_VERTICAL_CAP_CENTS
    : PROPOSED_GATE1_TOTAL_CAP_CENTS;
  if (reservedCostCents > applicableCapCents) {
    return failure('BUDGET_CAP_EXCEEDED');
  }
  const encodedMarket = encodeExecutionMarket(input.market, resolvedNiche);

  try {
    await db
      .prepare(
        `INSERT INTO affiliate_execution_runs
          (id, tenant_id, campaign_id, offer_id, approval_id, idempotency_key, state,
           locale, market, reserved_cost_cents, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, 'approval_pending', ?, ?, ?, ?, ?
         WHERE (
           SELECT COALESCE(SUM(COALESCE(actual_cost_cents, reserved_cost_cents)), 0)
             FROM affiliate_execution_runs
            WHERE tenant_id = ?
              AND ${SQL_COMMITTED_RUN_PREDICATE}
         ) + ? <= ?
         AND (
           ? IS NULL OR (
             SELECT COALESCE(SUM(COALESCE(actual_cost_cents, reserved_cost_cents)), 0)
               FROM affiliate_execution_runs
              WHERE tenant_id = ?
                AND ${SQL_COMMITTED_RUN_PREDICATE}
                AND ${SQL_CLASSIFY_RUN_NICHE} = ?
           ) + ? <= ?
         )
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
        encodedMarket,
        reservedCostCents,
        now,
        now,
        input.tenantId,
        reservedCostCents,
        PROPOSED_GATE1_TOTAL_CAP_CENTS,
        resolvedNiche,
        input.tenantId,
        resolvedNiche,
        reservedCostCents,
        PROPOSED_GATE1_VERTICAL_CAP_CENTS,
      )
      .run();

    const row = await db
      .prepare(`SELECT ${SELECT_COLUMNS} FROM affiliate_execution_runs WHERE tenant_id = ? AND idempotency_key = ?`)
      .bind(input.tenantId, input.idempotencyKey)
      .first<RunRow>();
    if (!row) return failure('BUDGET_CAP_EXCEEDED');
    const record = toRecord(row);
    const replayed = row.id !== id;
    if (replayed) {
      if (record.campaignId !== input.campaignId) {
        return failure('IDEMPOTENCY_KEY_CAMPAIGN_MISMATCH');
      }
      if ((input.approvalId ?? null) !== (record.approvalId ?? null) && input.approvalId !== undefined) {
        return failure('IDEMPOTENCY_KEY_APPROVAL_MISMATCH');
      }
      if (input.reservedCostCents !== undefined && record.reservedCostCents !== reservedCostCents) {
        return failure('IDEMPOTENCY_KEY_COST_MISMATCH');
      }
    }
    return success({ ...record, replayed });
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
 * Latest run consumed from an approval. The approve→continuation resume path
 * must call this before re-sending: a run already exists means the approval
 * was consumed and must be marked executed, never re-sent blindly.
 */
export async function getExecutionRunByApprovalId(
  db: D1Database,
  tenantId: string,
  approvalId: string,
): Promise<ExecutionRunRecord | null> {
  const row = await db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM affiliate_execution_runs
       WHERE tenant_id = ? AND approval_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(tenantId, approvalId)
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
 * Pre-submit claim for external render submission. Increments `render_attempts`
 * from 0 to 1 BEFORE calling the external render API so that a crash or network
 * timeout after the HTTP POST cannot cause a retry to submit a duplicate paid
 * render job. If `render_attempts > 0` and `provider_job_id IS NULL`, a prior
 * attempt had an uncertain outcome and must be reconciled before retrying.
 */
export async function claimRenderSubmissionAttempt(
  db: D1Database,
  tenantId: string,
  runId: string,
  nowMs: number = Date.now(),
): Promise<Result<ExecutionRunRecord, 'UNCERTAIN_PRIOR_SUBMIT' | 'RENDER_SUBMISSION_CONFLICT' | 'EXECUTION_RUN_NOT_FOUND'>> {
  const res = await db
    .prepare(
      `UPDATE affiliate_execution_runs
       SET render_attempts = render_attempts + 1, updated_at = ?
       WHERE id = ? AND tenant_id = ? AND state = 'render_queued'
         AND provider_job_id IS NULL AND COALESCE(render_attempts, 0) = 0`,
    )
    .bind(nowMs, runId, tenantId)
    .run();
  const current = await getExecutionRun(db, tenantId, runId);
  if (!current) return failure('EXECUTION_RUN_NOT_FOUND');
  if ((res.meta?.changes ?? 0) === 0) {
    if (current.providerJobId) {
      return success({ ...current, replayed: true });
    }
    if (current.renderAttempts > 0) {
      return failure('UNCERTAIN_PRIOR_SUBMIT');
    }
    return failure('RENDER_SUBMISSION_CONFLICT');
  }
  return success({ ...current, replayed: false });
}

/**
 * Binds the run to a provider job id exactly once. The worker calls this
 * immediately after submit; a concurrent worker that finds providerJobId set
 * must poll that job instead of submitting a second render.
 */
export async function recordRenderSubmission(
  db: D1Database,
  tenantId: string,
  runId: string,
  providerJobId: string,
  nowMs: number = Date.now(),
): Promise<Result<ExecutionRunRecord, string>> {
  const res = await db
    .prepare(
      `UPDATE affiliate_execution_runs
       SET provider_job_id = ?,
           render_attempts = CASE WHEN COALESCE(render_attempts, 0) = 0 THEN 1 ELSE render_attempts END,
           updated_at = ?
       WHERE id = ? AND tenant_id = ? AND state = 'render_queued' AND provider_job_id IS NULL`,
    )
    .bind(providerJobId, nowMs, runId, tenantId)
    .run();
  if ((res.meta?.changes ?? 0) === 0) {
    const current = await getExecutionRun(db, tenantId, runId);
    if (current?.providerJobId) {
      return success({ ...current, replayed: true });
    }
    return failure('RENDER_SUBMISSION_CONFLICT');
  }
  const current = await getExecutionRun(db, tenantId, runId);
  if (!current) return failure('EXECUTION_RUN_NOT_FOUND');
  return success({ ...current, replayed: false });
}

/**
 * Settles a run's actual incurred cost in cents (idempotent). Once settled,
 * the budget ledger uses `actual_cost_cents` instead of `reserved_cost_cents`
 * so unused reservation is released without double-counting.
 */
export async function settleExecutionRunCost(
  db: D1Database,
  tenantId: string,
  runId: string,
  actualCostCents: number,
  nowMs: number = Date.now(),
): Promise<Result<ExecutionRunRecord, string>> {
  if (!Number.isFinite(actualCostCents) || actualCostCents < 0) {
    return failure('INVALID_ACTUAL_COST');
  }
  const rounded = Math.round(actualCostCents);
  const current = await getExecutionRun(db, tenantId, runId);
  if (!current) return failure('EXECUTION_RUN_NOT_FOUND');
  if (current.actualCostCents === rounded) {
    return success({ ...current, replayed: true });
  }
  await db
    .prepare(
      `UPDATE affiliate_execution_runs
       SET actual_cost_cents = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
    )
    .bind(rounded, nowMs, runId, tenantId)
    .run();
  const updated = await getExecutionRun(db, tenantId, runId);
  if (!updated) return failure('EXECUTION_RUN_NOT_FOUND');
  return success({ ...updated, replayed: false });
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
  // A `VerifiedArtifact`-typed object is only a compile-time claim. Reject
  // zero-byte / empty-checksum / missing-storage descriptors BEFORE writing any
  // row or advancing the state, so the durable DB can never say `rendered`
  // without byte-level media proof. Same predicate as the pure gates.
  if (!hasVerifiedMedia(artifact)) {
    return failure('MEDIA_NOT_VERIFIED');
  }
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
