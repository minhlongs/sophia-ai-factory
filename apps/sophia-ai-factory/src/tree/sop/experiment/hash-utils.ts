import type { SopExperiment, ExperimentVariant } from './types';

/** Fast deterministic hash for variant bucketing (no crypto) */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function rowToExperiment(row: Record<string, unknown>): SopExperiment {
  return {
    id: row.id as string,
    sopTemplateId: row.sop_template_id as string,
    parameterKey: row.parameter_key as string,
    variants: JSON.parse(row.variants_json as string) as ExperimentVariant[],
    trafficPct: row.traffic_pct as number,
    status: row.status as SopExperiment['status'],
    winnerKey: (row.winner_key as string | null) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as number,
  };
}
