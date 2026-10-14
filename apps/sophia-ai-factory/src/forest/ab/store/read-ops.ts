/**
 * Experiment Store - Read Operations
 *
 * Layer: forest/ab
 */

import { getD1 } from '@/seed/db/client';
import type { AbExperiment, AbExperimentRow, ContentType } from '../ab-types';
import { rowToExperiment } from './mapper';

/** Fetch a single experiment by ID. */
export async function getExperiment(id: string): Promise<AbExperiment | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const row = await db
    .prepare('SELECT * FROM ab_experiments WHERE id = ? LIMIT 1')
    .bind(id)
    .first<AbExperimentRow>();

  return row ? rowToExperiment(row) : null;
}

/** Fetch all active experiments for a tenant. */
export async function getActiveExperiments(tenantId: string): Promise<AbExperiment[]> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const { results } = await db
    .prepare(
      `SELECT * FROM ab_experiments
       WHERE tenant_id = ? AND status = 'active'
       ORDER BY created_at DESC`
    )
    .bind(tenantId)
    .all<AbExperimentRow>();

  return (results ?? []).map(rowToExperiment);
}

/** Fetch all experiments for a tenant (all statuses). */
export async function getAllExperiments(
  tenantId: string,
  limit = 50,
): Promise<AbExperiment[]> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const { results } = await db
    .prepare(
      `SELECT * FROM ab_experiments
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(tenantId, limit)
    .all<AbExperimentRow>();

  return (results ?? []).map(rowToExperiment);
}

/**
 * Fetch active experiments that have been running for at least `minAgeHours`.
 * Used by the winner-picker cron to find experiments ready for evaluation.
 */
export async function getActiveExperimentsOlderThan(
  minAgeHours: number,
): Promise<AbExperiment[]> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const cutoff = new Date(Date.now() - minAgeHours * 60 * 60 * 1000).toISOString();

  const { results } = await db
    .prepare(
      `SELECT * FROM ab_experiments
       WHERE status = 'active' AND created_at <= ?
       ORDER BY created_at ASC`
    )
    .bind(cutoff)
    .all<AbExperimentRow>();

  return (results ?? []).map(rowToExperiment);
}

/**
 * Fetch active experiments filtered by content type.
 * Used by content-specific crons (caption, hook, CTA experiments).
 */
export async function getActiveByContentType(
  contentType: ContentType,
): Promise<AbExperiment[]> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const { results } = await db
    .prepare(
      `SELECT * FROM ab_experiments
       WHERE status = 'active' AND content_type = ?
       ORDER BY created_at ASC`
    )
    .bind(contentType)
    .all<AbExperimentRow>();

  return (results ?? []).map(rowToExperiment);
}
