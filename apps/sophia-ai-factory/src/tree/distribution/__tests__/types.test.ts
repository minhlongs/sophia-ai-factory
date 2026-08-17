/**
 * Distribution OS — types, mapping, and error class tests.
 * @module tree/distribution/__tests__/types.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  newDistributionPlanId,
  newDistributionAssetId,
  planRowToDomain,
  assetRowToDomain,
  planDomainToRow,
  assetDomainToRow,
} from '@/tree/distribution/types';
import { DistributionError } from '@/tree/distribution/errors';
import type { DistributionPlanRow, DistributionAssetRow, DistributionPlan } from '@/tree/distribution/types';
import { freshDb, loadAll } from './test-utils';

describe('Distribution OS — types', () => {
  beforeEach(freshDb);

  // ── ID generation ──────────────────────────────────────────────────────

  it('newDistributionPlanId starts with dplt_ prefix', () => {
    expect(newDistributionPlanId()).toMatch(/^dplt_[0-9a-f]{32}$/);
  });

  it('newDistributionAssetId starts with dast_ prefix', () => {
    expect(newDistributionAssetId()).toMatch(/^dast_[0-9a-f]{32}$/);
  });

  it('IDs are unique across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newDistributionPlanId()));
    expect(ids.size).toBe(50);
  });

  // ── Row mapping ────────────────────────────────────────────────────────

  it('planRowToDomain converts snake_case to camelCase', () => {
    const row = {
      id: 'dplt_test',
      workspace_id: 'ws-1',
      project_id: 'proj-1',
      channels: '[{"channel":"youtube","assetId":"a1","settings":{}}]',
      schedule_at: 1700003600,
      status: 'scheduled',
      created_at: 1700000000,
      updated_at: 1700001000,
    } as DistributionPlanRow;
    const d = planRowToDomain(row);
    expect(d.workspaceId).toBe('ws-1');
    expect(d.projectId).toBe('proj-1');
    expect(d.channels).toEqual([{ channel: 'youtube', assetId: 'a1', settings: {} }]);
    expect(d.scheduleAt).toBe(1700003600);
    expect(d.status).toBe('scheduled');
  });

  it('planRowToDomain handles null schedule_at', () => {
    const row = {
      id: 'dplt_test',
      workspace_id: 'ws-1',
      project_id: 'proj-1',
      channels: '[]',
      schedule_at: null,
      status: 'draft',
      created_at: 1700000000,
      updated_at: 1700000000,
    } as DistributionPlanRow;
    const d = planRowToDomain(row);
    expect(d.scheduleAt).toBeUndefined();
  });

  it('assetRowToDomain converts snake_case to camelCase', () => {
    const row = {
      id: 'dast_test',
      workspace_id: 'ws-1',
      plan_id: 'dplt_test',
      asset_id: 'a1',
      channel: 'youtube',
      platform_post_id: 'yt-12345',
      status: 'posted',
      scheduled_at: 1700003600,
      posted_at: 1700003700,
      analytics: '{"views":100}',
      error: null,
      created_at: 1700000000,
    } as DistributionAssetRow;
    const d = assetRowToDomain(row);
    expect(d.planId).toBe('dplt_test');
    expect(d.platformPostId).toBe('yt-12345');
    expect(d.postedAt).toBe(1700003700);
    expect(d.analytics).toEqual({ views: 100 });
  });

  it('assetRowToDomain handles nulls gracefully', () => {
    const row = {
      id: 'dast_test',
      workspace_id: 'ws-1',
      plan_id: 'dplt_test',
      asset_id: 'a1',
      channel: 'youtube',
      platform_post_id: null,
      status: 'scheduled',
      scheduled_at: 1700003600,
      posted_at: null,
      analytics: '{}',
      error: null,
      created_at: 1700000000,
    } as DistributionAssetRow;
    const d = assetRowToDomain(row);
    expect(d.platformPostId).toBeUndefined();
    expect(d.postedAt).toBeUndefined();
    expect(d.error).toBeUndefined();
  });

  it('planDomainToRow converts camelCase to snake_case', () => {
    const plan: DistributionPlan = {
      id: 'dplt_test',
      workspaceId: 'ws-1',
      projectId: 'proj-1',
      channels: [{ channel: 'youtube', assetId: 'a1', settings: {} }],
      status: 'draft',
      createdAt: 1700000000,
      updatedAt: 1700001000,
    };
    const row = planDomainToRow(plan);
    expect(row.workspace_id).toBe('ws-1');
    expect(row.project_id).toBe('proj-1');
    expect(typeof row.channels).toBe('string');
    expect(JSON.parse(row.channels)).toEqual(plan.channels);
  });

  it('assetDomainToRow converts camelCase to snake_case', () => {
    const asset = {
      id: 'dast_test',
      workspaceId: 'ws-1',
      planId: 'dplt_test',
      assetId: 'a1',
      channel: 'youtube',
      status: 'scheduled' as const,
      scheduledAt: 1700003600,
      analytics: {},
      createdAt: 1700000000,
    };
    const row = assetDomainToRow(asset as any);
    expect(row.plan_id).toBe('dplt_test');
    expect(row.platform_post_id).toBeNull();
    expect(JSON.parse(row.analytics)).toEqual({});
  });

  // ── Error class ────────────────────────────────────────────────────────

  it('DistributionError stores code and message', () => {
    const err = new DistributionError('NOT_FOUND', 'plan missing');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('plan missing');
    expect(err.name).toBe('DistributionError');
  });

  it('DistributionError is instanceof Error', () => {
    const err = new DistributionError('D1_UNAVAILABLE', 'no db');
    expect(err).toBeInstanceOf(Error);
  });
});