/**
 * @file mutation-store.ts
 * @description D1 storage layer for Darwinian Creative Mutations & Lineages
 * @layer tree
 */

import { createServerClient } from '@/seed/db/client';
import type {
  CreativeMutationRecord,
  MutationGene,
  MutationDelta,
  MutationIntensity,
  TriggerReason,
} from '@/seed/types/creative-mutator-types';

interface MutationRow {
  id: string;
  user_id: string;
  parent_job_id: string;
  offspring_job_id: string | null;
  generation: number;
  mutation_intensity: string;
  trigger_reason: string;
  parent_gene: string;
  offspring_gene: string;
  delta: string;
  parent_fitness: number;
  offspring_fitness: number | null;
  status: string;
  created_at: number;
  updated_at: number;
}

function mapRowToRecord(row: MutationRow): CreativeMutationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    parentJobId: row.parent_job_id,
    offspringJobId: row.offspring_job_id,
    generation: row.generation,
    mutationIntensity: row.mutation_intensity as MutationIntensity,
    triggerReason: row.trigger_reason as TriggerReason,
    parentGene: JSON.parse(row.parent_gene) as MutationGene,
    offspringGene: JSON.parse(row.offspring_gene) as MutationGene,
    delta: JSON.parse(row.delta) as MutationDelta,
    parentFitness: row.parent_fitness,
    offspringFitness: row.offspring_fitness,
    status: row.status as CreativeMutationRecord['status'],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function insertMutationRecord(
  record: Omit<CreativeMutationRecord, 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const db = createServerClient();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO creative_mutations (
        id, user_id, parent_job_id, offspring_job_id, generation,
        mutation_intensity, trigger_reason, parent_gene, offspring_gene,
        delta, parent_fitness, offspring_fitness, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      record.id,
      record.userId,
      record.parentJobId,
      record.offspringJobId,
      record.generation,
      record.mutationIntensity,
      record.triggerReason,
      JSON.stringify(record.parentGene),
      JSON.stringify(record.offspringGene),
      JSON.stringify(record.delta),
      record.parentFitness,
      record.offspringFitness,
      record.status,
      now,
      now
    )
    .run();
}

export async function listUserMutations(
  userId: string,
  limit = 50,
): Promise<CreativeMutationRecord[]> {
  const db = createServerClient();
  const res = await db
    .prepare(
      `SELECT * FROM creative_mutations
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(userId, limit)
    .all<MutationRow>();

  return (res.results ?? []).map(mapRowToRecord);
}

export async function getMutationById(
  id: string,
  userId: string,
): Promise<CreativeMutationRecord | null> {
  const db = createServerClient();
  const row = await db
    .prepare(
      `SELECT * FROM creative_mutations
       WHERE id = ? AND user_id = ?
       LIMIT 1`
    )
    .bind(id, userId)
    .first<MutationRow>();

  return row ? mapRowToRecord(row) : null;
}

export async function updateMutationStatus(
  id: string,
  userId: string,
  status: CreativeMutationRecord['status'],
  offspringJobId?: string,
  offspringFitness?: number,
): Promise<void> {
  const db = createServerClient();
  const now = Date.now();

  await db
    .prepare(
      `UPDATE creative_mutations
       SET status = ?,
           offspring_job_id = COALESCE(?, offspring_job_id),
           offspring_fitness = COALESCE(?, offspring_fitness),
           updated_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .bind(status, offspringJobId ?? null, offspringFitness ?? null, now, id, userId)
    .run();
}
