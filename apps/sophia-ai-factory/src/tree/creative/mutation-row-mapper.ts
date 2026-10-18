/**
 * @file mutation-row-mapper.ts
 * @description D1 row interface and mapper for Darwinian Creative Mutations
 * @layer tree
 */

import type {
  CreativeMutationRecord,
  MutationGene,
  MutationDelta,
  MutationIntensity,
  TriggerReason,
} from '@/seed/types/creative-mutator-types';

export interface MutationRow {
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

export function mapRowToRecord(row: MutationRow): CreativeMutationRecord {
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
