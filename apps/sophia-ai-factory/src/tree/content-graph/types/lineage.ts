import { getD1 } from '@/seed/db/client';
import type {
  ContentProject,
  ContentAsset,
  DerivativeAsset,
} from '@/seed/types/creative-domain';
import {
  ContentGraphError,
  derivativeRowToDomain,
  type DerivativeRow,
} from './common';
import { getProject } from './projects';
import { listAssets } from './assets';

export interface ContentLineage {
  project: ContentProject;
  assets: ContentAsset[];
  derivatives: DerivativeAsset[];
  performance: Array<{
    id: string;
    channel: string;
    eventType: string;
    count: number;
    valueCents?: number;
    recordedAt: number;
  }>;
}

/**
 * Full lifecycle trace for a content project: project → assets →
 * derivatives → performance events. Used by the dashboard to show
 * what was produced and how it performed.
 */
export async function getContentLineage(projectId: string): Promise<ContentLineage | null> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const project = await getProject(projectId);
  if (!project) return null;

  const assets = await listAssets(projectId);

  const derivativeResult = await db
    .prepare(
      `SELECT * FROM derivative_assets WHERE parent_asset_id IN (SELECT id FROM content_assets WHERE project_id = ?1) ORDER BY created_at ASC`,
    )
    .bind(projectId)
    .all<DerivativeRow>();

  const perfResult = await db
    .prepare(
      `SELECT id, channel, event_type, count, value_cents, recorded_at FROM performance_events WHERE project_id = ?1 ORDER BY recorded_at DESC`,
    )
    .bind(projectId)
    .all<{
      id: string;
      channel: string;
      event_type: string;
      count: number;
      value_cents: number | null;
      recorded_at: number;
    }>();

  return {
    project,
    assets,
    derivatives: (derivativeResult.results ?? []).map(derivativeRowToDomain),
    performance: (perfResult.results ?? []).map((r) => ({
      id: r.id,
      channel: r.channel,
      eventType: r.event_type,
      count: r.count,
      valueCents: r.value_cents ?? undefined,
      recordedAt: r.recorded_at,
    })),
  };
}

/**
 * Join content performance events with the project they reference.
 */
export async function getContentPerformance(projectId: string): Promise<
  Array<{
    id: string;
    channel: string;
    eventType: string;
    count: number;
    valueCents?: number;
    recordedAt: number;
  }>
> {
  const lineage = await getContentLineage(projectId);
  if (!lineage) return [];
  return lineage.performance;
}
