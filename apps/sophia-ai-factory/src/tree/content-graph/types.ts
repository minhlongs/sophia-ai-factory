/**
 * Content Graph — Sophia 2027 Creative Economy OS
 * Layer: tree (domain-specific reusable)
 *
 * Tracks content production: projects → assets → derivatives.
 *
 * ContentProject  = "June Product Launch Campaign"
 * ContentAsset    = the actual output (video, image, audio, script)
 * DerivativeAsset = repurposed variant (clip, thumbnail, quote card)
 *
 * @module tree/content-graph
 */

import { getD1 } from '@/seed/db/client';
import type {
  ContentProject,
  ContentAsset,
  DerivativeAsset,
  ContentStatus,
} from '@/seed/types/creative-domain';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ContentGraphError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ContentGraphError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function newProjectId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'prj_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newAssetId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'ast_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

interface ProjectRow {
  id: string;
  workspace_id: string;
  mission_id: string;
  creator_id: string;
  brand_id: string;
  title: string;
  description: string;
  format: string;
  status: string;
  budget_cents: number;
  actual_cost_cents: number;
  metadata: string;
  created_at: number;
  updated_at: number;
}

interface AssetRow {
  id: string;
  workspace_id: string;
  project_id: string;
  type: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
  status: string;
  metadata: string;
  created_at: number;
  updated_at: number;
}

interface DerivativeRow {
  id: string;
  workspace_id: string;
  source_asset_id: string;
  parent_asset_id: string;
  type: string;
  storage_key: string;
  metadata: string;
  created_at: number;
}

function projectRowToDomain(row: ProjectRow): ContentProject {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    missionId: row.mission_id,
    creatorId: row.creator_id,
    brandId: row.brand_id,
    title: row.title,
    description: row.description,
    format: row.format as ContentProject['format'],
    status: row.status as ContentStatus,
    budgetCents: row.budget_cents,
    actualCostCents: row.actual_cost_cents,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assetRowToDomain(row: AssetRow): ContentAsset {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    type: row.type as ContentAsset['type'],
    storageKey: row.storage_key || undefined,
    mimeType: row.mime_type || undefined,
    sizeBytes: row.size_bytes || undefined,
    durationSeconds: row.duration_seconds || undefined,
    status: row.status as ContentStatus,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function derivativeRowToDomain(row: DerivativeRow): DerivativeAsset {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    sourceAssetId: row.source_asset_id,
    parentAssetId: row.parent_asset_id,
    type: row.type as DerivativeAsset['type'],
    storageKey: row.storage_key,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// ContentProject CRUD
// ---------------------------------------------------------------------------

export async function createProject(project: ContentProject): Promise<ContentProject> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  project.id = project.id || newProjectId();
  project.createdAt = now;
  project.updatedAt = now;

  try {
    await db
      .prepare(
        `INSERT INTO content_projects
           (id, workspace_id, mission_id, creator_id, brand_id, title, description,
            format, status, budget_cents, actual_cost_cents, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        project.id,
        project.workspaceId,
        project.missionId ?? null,
        project.creatorId,
        project.brandId ?? null,
        project.title,
        project.description,
        project.format,
        project.status,
        project.budgetCents,
        project.actualCostCents,
        JSON.stringify(project.metadata ?? {}),
        now,
        now,
      )
      .run();
  } catch (err) {
    throw new ContentGraphError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
  }

  return project;
}

export async function getProject(id: string): Promise<ContentProject | null> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db.prepare(`SELECT * FROM content_projects WHERE id = ?1 LIMIT 1`).bind(id).first<ProjectRow>();
  return row ? projectRowToDomain(row) : null;
}

export async function listProjects(workspaceId: string, missionId?: string): Promise<ContentProject[]> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  let sql = `SELECT * FROM content_projects WHERE workspace_id = ?1`;
  const params: unknown[] = [workspaceId];
  if (missionId) {
    sql += ` AND mission_id = ?${params.length + 1}`;
    params.push(missionId);
  }
  sql += ` ORDER BY created_at DESC`;

  const result = await db.prepare(sql).bind(...params).all<ProjectRow>();
  return (result.results ?? []).map(projectRowToDomain);
}

export async function updateProjectStatus(id: string, status: ContentStatus): Promise<ContentProject | null> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`UPDATE content_projects SET status = ?, updated_at = ? WHERE id = ?`).bind(status, now, id).run();

  const row = await db.prepare(`SELECT * FROM content_projects WHERE id = ?1 LIMIT 1`).bind(id).first<ProjectRow>();
  return row ? projectRowToDomain(row) : null;
}

// ---------------------------------------------------------------------------
// ContentAsset CRUD
// ---------------------------------------------------------------------------

export async function createAsset(asset: ContentAsset): Promise<ContentAsset> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  asset.id = asset.id || newAssetId();
  asset.createdAt = now;
  asset.updatedAt = now;

  try {
    await db
      .prepare(
        `INSERT INTO content_assets
           (id, workspace_id, project_id, type, storage_key, mime_type,
            size_bytes, duration_seconds, status, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        asset.id,
        asset.workspaceId,
        asset.projectId,
        asset.type,
        asset.storageKey ?? null,
        asset.mimeType ?? null,
        asset.sizeBytes ?? null,
        asset.durationSeconds ?? null,
        asset.status,
        JSON.stringify(asset.metadata ?? {}),
        now,
        now,
      )
      .run();
  } catch (err) {
    throw new ContentGraphError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
  }

  return asset;
}

export async function getAsset(id: string): Promise<ContentAsset | null> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db.prepare(`SELECT * FROM content_assets WHERE id = ?1 LIMIT 1`).bind(id).first<AssetRow>();
  return row ? assetRowToDomain(row) : null;
}

export async function listAssets(projectId: string): Promise<ContentAsset[]> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db.prepare(`SELECT * FROM content_assets WHERE project_id = ?1 ORDER BY created_at ASC`).bind(projectId).all<AssetRow>();
  return (result.results ?? []).map(assetRowToDomain);
}

export async function updateAssetStatus(id: string, status: ContentStatus): Promise<ContentAsset | null> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`UPDATE content_assets SET status = ?, updated_at = ? WHERE id = ?`).bind(status, now, id).run();

  const row = await db.prepare(`SELECT * FROM content_assets WHERE id = ?1 LIMIT 1`).bind(id).first<AssetRow>();
  return row ? assetRowToDomain(row) : null;
}

// ---------------------------------------------------------------------------
// DerivativeAsset CRUD
// ---------------------------------------------------------------------------

export async function createDerivative(derivative: DerivativeAsset): Promise<DerivativeAsset> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  derivative.id = derivative.id || newAssetId();
  derivative.createdAt = now;

  try {
    await db
      .prepare(
        `INSERT INTO derivative_assets
           (id, workspace_id, source_asset_id, parent_asset_id, type, storage_key, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        derivative.id,
        derivative.workspaceId,
        derivative.sourceAssetId,
        derivative.parentAssetId,
        derivative.type,
        derivative.storageKey,
        JSON.stringify(derivative.metadata ?? {}),
        now,
      )
      .run();
  } catch (err) {
    throw new ContentGraphError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
  }

  return derivative;
}

export async function getDerivativesOf(assetId: string): Promise<DerivativeAsset[]> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(`SELECT * FROM derivative_assets WHERE source_asset_id = ?1 OR parent_asset_id = ?1 ORDER BY created_at ASC`)
    .bind(assetId)
    .all<DerivativeRow>();

  return (result.results ?? []).map(derivativeRowToDomain);
}

// ─── Lineage / performance queries ──────────────────────────────────────────

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