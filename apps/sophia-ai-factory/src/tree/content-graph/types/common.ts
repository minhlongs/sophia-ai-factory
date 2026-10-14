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
// Row Interfaces
// ---------------------------------------------------------------------------

export interface ProjectRow {
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

export interface AssetRow {
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

export interface DerivativeRow {
  id: string;
  workspace_id: string;
  source_asset_id: string;
  parent_asset_id: string;
  type: string;
  storage_key: string;
  metadata: string;
  created_at: number;
}

// ---------------------------------------------------------------------------
// Row Mappers
// ---------------------------------------------------------------------------

export function projectRowToDomain(row: ProjectRow): ContentProject {
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

export function assetRowToDomain(row: AssetRow): ContentAsset {
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

export function derivativeRowToDomain(row: DerivativeRow): DerivativeAsset {
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
