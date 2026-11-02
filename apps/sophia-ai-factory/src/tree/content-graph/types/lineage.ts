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
 *
 * When `workspaceId` is supplied the whole trace fails closed against
 * cross-tenant reads: a project owned by another workspace yields null.
 */
export async function getContentLineage(
  projectId: string,
  workspaceId?: string
): Promise<ContentLineage | null> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const project = await getProject(projectId, workspaceId);
  if (!project) return null;

  const tenantWs = workspaceId ?? project.workspaceId;
  const assets = await listAssets(projectId, tenantWs);

  const derivativeResult = await db
    .prepare(
      `SELECT * FROM derivative_assets WHERE workspace_id = ?2 AND parent_asset_id IN (SELECT id FROM content_assets WHERE project_id = ?1) ORDER BY created_at ASC`,
    )
    .bind(projectId, tenantWs)
    .all<DerivativeRow>();

  const perfResult = await db
    .prepare(
      `SELECT id, channel, event_type, count, value_cents, recorded_at FROM performance_events WHERE workspace_id = ?2 AND project_id = ?1 ORDER BY recorded_at DESC`,
    )
    .bind(projectId, tenantWs)
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
/**
 * Join content performance events with the project they reference.
 * Scoped by `workspaceId` so a cross-tenant projectId yields an empty
 * result instead of another tenant's performance data.
 */
export async function getContentPerformance(projectId: string, workspaceId?: string): Promise<
  Array<{
    id: string;
    channel: string;
    eventType: string;
    count: number;
    valueCents?: number;
    recordedAt: number;
  }>
> {
  const lineage = await getContentLineage(projectId, workspaceId);
  if (!lineage) return [];
  return lineage.performance;
}
