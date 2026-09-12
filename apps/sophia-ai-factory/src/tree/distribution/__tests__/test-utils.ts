/**
 * Shared test utilities for distribution OS tests.
 */

import { vi } from 'vitest';
import Database from 'better-sqlite3';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS distribution_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  channels TEXT NOT NULL DEFAULT '[]',
  schedule_at INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS distribution_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  platform_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at INTEGER NOT NULL,
  posted_at INTEGER,
  analytics TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  created_at INTEGER NOT NULL
);
`;

let db: ReturnType<typeof Database>;

export function buildMockD1() {
  return {
    prepare(sql: string) {
      const normalized = sql.replace(/\?(\d+)/g, '?');
      const stmt = db.prepare(normalized);
      return {
        bind(...params: unknown[]) {
          return {
            async first<T = Record<string, unknown>>(): Promise<T | null> {
              const row = stmt.get(...params) as T | undefined;
              return row ?? null;
            },
            async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
              const rows = stmt.all(...params) as T[];
              return { results: rows };
            },
            async run(): Promise<{ meta: { changes: number } }> {
              const info = stmt.run(...params);
              return { meta: { changes: info.changes } };
            },
          };
        },
      };
    },
    exec(sql: string) {
      db.exec(sql);
    },
  };
}

export function freshDb() {
  db = new Database(':memory:');
  db.exec(SCHEMA);
}

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(() => buildMockD1()),
}));

export async function loadAll() {
  const [
    { planRowToDomain, assetRowToDomain, planDomainToRow, assetDomainToRow, newDistributionPlanId, newDistributionAssetId },
    { DistributionError },
    { createDistributionPlan, getDistributionPlan, listDistributionPlans, updateDistributionPlanStatus, isValidPlanTransition },
    { createDistributionAsset, getDistributionAsset, listDistributionAssets, updateDistributionAssetStatus, markDistributionAssetFailed, isValidAssetTransition },
  ] = await Promise.all([
    import('@/tree/distribution/types'),
    import('@/tree/distribution/errors'),
    import('@/tree/distribution/plans'),
    import('@/tree/distribution/assets'),
  ]);
  return {
    planRowToDomain, assetRowToDomain, planDomainToRow, assetDomainToRow,
    newDistributionPlanId, newDistributionAssetId, DistributionError,
    createDistributionPlan, getDistributionPlan, listDistributionPlans,
    updateDistributionPlanStatus, isValidPlanTransition,
    createDistributionAsset, getDistributionAsset, listDistributionAssets,
    updateDistributionAssetStatus, markDistributionAssetFailed, isValidAssetTransition,
  };
}

export function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dplt_aabbccdd00112233aabbccdd00112233',
    workspaceId: 'ws-1',
    projectId: 'proj-1',
    channels: [{ channel: 'youtube', assetId: 'a1', settings: {} }],
    status: 'draft' as const,
    createdAt: 1700000000,
    updatedAt: 1700000000,
    ...overrides,
  };
}

export function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dast_aabbccdd00112233aabbccdd00112233',
    workspaceId: 'ws-1',
    planId: 'dplt_aabbccdd00112233aabbccdd00112233',
    assetId: 'a1',
    channel: 'youtube',
    status: 'scheduled' as const,
    scheduledAt: 1700003600,
    analytics: {},
    createdAt: 1700000000,
    ...overrides,
  };
}