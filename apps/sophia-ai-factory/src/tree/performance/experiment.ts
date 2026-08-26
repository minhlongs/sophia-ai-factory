/**
 * Experiment + ExperimentVariant + ExperimentResult D1 repository.
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/performance/experiment
 */

import { getD1 } from '@/seed/db/client';
import type { Experiment, ExperimentVariant, ExperimentStatus } from '@/seed/types/creative-domain';
import { PerformanceError } from './errors';

// ─── ExperimentResult (local — not yet in seed types) ──────────────────────

export interface ExperimentResult {
  id: string;
  experimentId: string;
  variantId: string;
  sampleSize: number;
  conversions: number;
  conversionRate: number;
  revenueCents: number;
  metadata: Record<string, unknown>;
  recordedAt: number;
}

// ─── ID generation ─────────────────────────────────────────────────────────

export function newExperimentId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'exp_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Row types ─────────────────────────────────────────────────────────────
// Shapes mirror migrations/0254_experiments_tables.sql exactly:
// content columns are nullable (no NOT NULL), and experiments.status has no
// CHECK constraint, so the raw status is coerced at the mapping boundary.

interface ExperimentRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  hypothesis: string | null;
  metric: string | null;
  audience: string | null;
  channel: string | null;
  status: string;
  started_at: number | null;
  ended_at: number | null;
  winner_variant_id: string | null;
  confidence: number | null;
  result: string | null;
  created_at: number;
  updated_at: number;
}

interface VariantRow {
  id: string;
  experiment_id: string;
  name: string;
  description: string;
  asset_id: string | null;
  traffic_percent: number;
}

interface ResultRow {
  id: string;
  experiment_id: string;
  variant_id: string;
  sample_size: number;
  conversions: number;
  conversion_rate: number;
  revenue_cents: number;
  metadata: string | null;
  recorded_at: number;
}

// ─── Row ↔ Domain mapping ──────────────────────────────────────────────────

const EXPERIMENT_STATUSES: readonly ExperimentStatus[] = [
  'draft',
  'running',
  'completed',
  'cancelled',
];

function coerceStatus(raw: string): ExperimentStatus {
  return EXPERIMENT_STATUSES.includes(raw as ExperimentStatus)
    ? (raw as ExperimentStatus)
    : 'draft';
}

function experimentRowToDomain(
  row: ExperimentRow,
  variants: ExperimentVariant[] = [],
): Experiment {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id ?? '',
    hypothesis: row.hypothesis ?? '',
    metric: row.metric ?? '',
    audience: row.audience ?? '',
    channel: row.channel ?? '',
    status: coerceStatus(row.status),
    variants,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    winnerVariantId: row.winner_variant_id ?? undefined,
    confidence: row.confidence ?? undefined,
    result: row.result ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function variantRowToDomain(row: VariantRow): ExperimentVariant {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    name: row.name,
    description: row.description,
    assetId: row.asset_id ?? undefined,
    trafficPercent: row.traffic_percent,
  };
}

function resultRowToDomain(row: ResultRow): ExperimentResult {
  let parsedMetadata: Record<string, unknown> = {};
  if (row.metadata) {
    try {
      parsedMetadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      // Corrupt metadata — preserve raw string for debugging but don't crash
      parsedMetadata = { _corrupt: true, _raw: row.metadata };
    }
  }
  return {
    id: row.id,
    experimentId: row.experiment_id,
    variantId: row.variant_id,
    sampleSize: row.sample_size,
    conversions: row.conversions,
    conversionRate: row.conversion_rate,
    revenueCents: row.revenue_cents,
    metadata: parsedMetadata,
    recordedAt: row.recorded_at,
  };
}

// ─── Valid status transitions ───────────────────────────────────────────────

const VALID_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  draft: ['running', 'cancelled'],
  running: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function isValidTransition(from: ExperimentStatus, to: ExperimentStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// ─── Repository functions ──────────────────────────────────────────────────

export async function createExperiment(
  experiment: Experiment,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  try {
    await db
      .prepare(
        `INSERT INTO experiments
           (id, workspace_id, project_id, hypothesis, metric, audience, channel,
            status, started_at, ended_at, winner_variant_id, confidence, result,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        experiment.id, experiment.workspaceId, experiment.projectId,
        experiment.hypothesis, experiment.metric, experiment.audience,
        experiment.channel, experiment.status,
        experiment.startedAt ?? null, experiment.endedAt ?? null,
        experiment.winnerVariantId ?? null, experiment.confidence ?? null,
        experiment.result ?? null,
        experiment.createdAt || now, experiment.updatedAt || now,
      )
      .run();

    for (const v of experiment.variants) {
      await db
        .prepare(
          `INSERT INTO experiment_variants
             (id, experiment_id, name, description, asset_id, traffic_percent)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(v.id, v.experimentId, v.name, v.description, v.assetId ?? null, v.trafficPercent)
        .run();
    }
  } catch (err) {
    throw new PerformanceError(
      'INSERT_FAILED',
      err instanceof Error ? err.message : 'unknown',
    );
  }
}

export async function getExperiment(id: string): Promise<Experiment> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const expRow = await db
    .prepare('SELECT * FROM experiments WHERE id = ?1')
    .bind(id)
    .first<ExperimentRow>();

  if (!expRow) throw new PerformanceError('NOT_FOUND', `Experiment ${id} not found`);

  const varResult = await db
    .prepare('SELECT * FROM experiment_variants WHERE experiment_id = ?1')
    .bind(id)
    .all<VariantRow>();

  const variants = (varResult.results ?? []).map(variantRowToDomain);
  return experimentRowToDomain(expRow, variants);
}

export async function listExperiments(
  workspaceId: string,
  opts?: { projectId?: string; status?: ExperimentStatus },
): Promise<Experiment[]> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const conditions = ['workspace_id = ?1'];
  const params: unknown[] = [workspaceId];
  let idx = 2;

  if (opts?.projectId) {
    conditions.push(`project_id = ?${idx}`);
    params.push(opts.projectId);
    idx++;
  }
  if (opts?.status) {
    conditions.push(`status = ?${idx}`);
    params.push(opts.status);
    idx++;
  }

  const where = conditions.join(' AND ');
  const result = await db
    .prepare(`SELECT * FROM experiments WHERE ${where} ORDER BY created_at DESC`)
    .bind(...params)
    .all<ExperimentRow>();

  return (result.results ?? []).map((row) => experimentRowToDomain(row));
}

export async function startExperiment(id: string): Promise<Experiment> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const existing = await db
    .prepare('SELECT * FROM experiments WHERE id = ?1')
    .bind(id)
    .first<ExperimentRow>();

  if (!existing) throw new PerformanceError('NOT_FOUND', `Experiment ${id} not found`);
  const coercedStatus = coerceStatus(existing.status);
  if (!isValidTransition(coercedStatus, 'running')) {
    throw new PerformanceError(
      'INVALID_TRANSITION',
      `Cannot transition ${coercedStatus} → running`,
    );
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `UPDATE experiments SET status = 'running', started_at = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(now, now, id)
    .run();

  return getExperiment(id);
}

export async function completeExperiment(
  id: string,
  opts?: { winnerVariantId?: string; confidence?: number; result?: string },
): Promise<Experiment> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const existing = await db
    .prepare('SELECT * FROM experiments WHERE id = ?1')
    .bind(id)
    .first<ExperimentRow>();

  if (!existing) throw new PerformanceError('NOT_FOUND', `Experiment ${id} not found`);
  const coercedStatus = coerceStatus(existing.status);
  if (!isValidTransition(coercedStatus, 'completed')) {
    throw new PerformanceError(
      'INVALID_TRANSITION',
      `Cannot transition ${coercedStatus} → completed`,
    );
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `UPDATE experiments
       SET status = 'completed', ended_at = ?,
           winner_variant_id = ?, confidence = ?, result = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      now,
      opts?.winnerVariantId ?? null,
      opts?.confidence ?? null,
      opts?.result ?? null,
      now,
      id,
    )
    .run();

  return getExperiment(id);
}

export async function recordExperimentResult(
  experimentId: string,
  variantId: string,
  result: Omit<ExperimentResult, 'id' | 'experimentId' | 'variantId' | 'recordedAt'>,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const id = 'eres_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const now = Math.floor(Date.now() / 1000);

  try {
    await db
      .prepare(
        `INSERT INTO experiment_results
           (id, experiment_id, variant_id, sample_size, conversions,
            conversion_rate, revenue_cents, metadata, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, experimentId, variantId,
        result.sampleSize, result.conversions, result.conversionRate,
        result.revenueCents,
        JSON.stringify(result.metadata),
        now,
      )
      .run();
  } catch (err) {
    throw new PerformanceError(
      'INSERT_FAILED',
      err instanceof Error ? err.message : 'unknown',
    );
  }
}

export async function getExperimentResults(
  experimentId: string,
): Promise<ExperimentResult[]> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(
      `SELECT er.*, v.name AS variant_name
       FROM experiment_results er
       LEFT JOIN experiment_variants v ON er.variant_id = v.id
       WHERE er.experiment_id = ?1
       ORDER BY er.recorded_at DESC`,
    )
    .bind(experimentId)
    .all<ResultRow & { variant_name: string | null }>();

  return (result.results ?? []).map(resultRowToDomain);
}

export { experimentRowToDomain, variantRowToDomain, resultRowToDomain, isValidTransition };