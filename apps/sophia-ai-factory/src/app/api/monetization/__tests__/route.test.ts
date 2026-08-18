/**
 * GET /api/monetization — Unit Tests
 * Phase 6: Monetization OS Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '../route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getWorkspaceROI, getTopROIChannels } from '@/tree/roi';
import { aggregateRevenueAttribution } from '@/forest/analytics/queries/revenue-attribution';
import { getDynamicMultiplier } from '@/land/billing/dynamic-pricing-config';
import { VIDEO_MCU_COSTS } from '@/land/billing/video-mcu-cost-config';

// vi.hoisted() — all refs used inside vi.mock() factories MUST be hoisted
const {
  mockDbFirst,
  mockDbBind,
  mockGetCurrentUser,
  mockGetUserTier,
  mockGetWorkspaceROI,
  mockGetTopROIChannels,
  mockAggregateRevenueAttribution,
  mockGetDynamicMultiplier,
} = vi.hoisted(() => {
  const mockDbFirst = vi.fn();
  const mockDbBind = vi.fn().mockReturnThis();
  const mockGetCurrentUser = vi.fn();
  const mockGetUserTier = vi.fn();
  const mockGetWorkspaceROI = vi.fn();
  const mockGetTopROIChannels = vi.fn();
  const mockAggregateRevenueAttribution = vi.fn();
  const mockGetDynamicMultiplier = vi.fn();
  return {
    mockDbFirst,
    mockDbBind,
    mockGetCurrentUser,
    mockGetUserTier,
    mockGetWorkspaceROI,
    mockGetTopROIChannels,
    mockAggregateRevenueAttribution,
    mockGetDynamicMultiplier,
  };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn().mockReturnValue({
    prepare: () => ({ bind: mockDbBind, first: mockDbFirst }),
  }),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: mockGetUserTier,
}));

vi.mock('@/tree/roi', () => ({
  getWorkspaceROI: mockGetWorkspaceROI,
  getTopROIChannels: mockGetTopROIChannels,
}));

vi.mock('@/forest/analytics/queries/revenue-attribution', () => ({
  aggregateRevenueAttribution: mockAggregateRevenueAttribution,
}));

vi.mock('@/land/billing/dynamic-pricing-config', () => ({
  getDynamicMultiplier: mockGetDynamicMultiplier,
}));

vi.mock('@/land/billing/video-mcu-cost-config', () => ({
  VIDEO_MCU_COSTS: { VIDEO_CREATE: 50 },
}));

const mockUser = { id: 'user_001', email: 'test@example.com', full_name: 'Test', role: 'owner' };

function authed() {
  mockGetCurrentUser.mockResolvedValue(mockUser);
}

function unauthed() {
  mockGetCurrentUser.mockResolvedValue(null);
}

function grantAccess() {
  mockDbFirst.mockResolvedValue({ user_id: 'user_001' });
}

function denyAccess() {
  mockDbFirst.mockResolvedValue(null);
}

function stubSuccessData() {
  mockGetWorkspaceROI.mockResolvedValue({
    workspaceId: 'ws_001',
    totalRevenueCents: 10000,
    totalCostCents: 5000,
    roi: 100,
    unitCount: 10,
    avgRevenuePerUnit: 1000,
    avgCostPerUnit: 500,
  });
  mockGetTopROIChannels.mockResolvedValue([]);
  mockAggregateRevenueAttribution.mockResolvedValue([]);
  mockGetUserTier.mockResolvedValue('PREMIUM');
  mockGetDynamicMultiplier.mockReturnValue(0.95);
}

async function json<T>(res: NextResponse): Promise<T> {
  return res.json() as Promise<T>;
}

describe('GET /api/monetization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    denyAccess();
  });

  it('returns 401 when not authenticated', async () => {
    unauthed();
    const req = new Request('http://localhost/api/monetization');
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 when workspaceId is missing', async () => {
    authed();
    const req = new Request('http://localhost/api/monetization');
    const res = await GET(req as never);
    expect(res.status).toBe(400);
    const body = await json<{ error: string }>(res);
    expect(body.error).toContain('workspaceId');
  });

  it('returns 403 when user has no workspace access', async () => {
    authed();
    denyAccess();
    const url = new URL('http://localhost/api/monetization');
    url.searchParams.set('workspaceId', 'ws_other');
    const req = new Request(url.toString());
    const res = await GET(req as never);
    expect(res.status).toBe(403);
  });

  it('returns 200 with correct shape', async () => {
    authed();
    grantAccess();
    stubSuccessData();

    const url = new URL('http://localhost/api/monetization');
    url.searchParams.set('workspaceId', 'ws_001');
    const req = new Request(url.toString());
    const res = await GET(req as never);
    expect(res.status).toBe(200);

    const body = await json<{
      aggregate: Record<string, number>;
      topChannels: unknown[];
      revenueAttribution: unknown[];
      dynamicPricing: Record<string, unknown>;
    }>(res);

    expect(body).toHaveProperty('aggregate');
    expect(body).toHaveProperty('topChannels');
    expect(body).toHaveProperty('revenueAttribution');
    expect(body).toHaveProperty('dynamicPricing');
    expect(Array.isArray(body.topChannels)).toBe(true);
    expect(Array.isArray(body.revenueAttribution)).toBe(true);

    expect(body.aggregate).toMatchObject({
      totalRevenueCents: 10000,
      totalCostCents: 5000,
      roi: 100,
      unitCount: 10,
    });

    expect(body.dynamicPricing).toMatchObject({
      tier: 'PREMIUM',
      baseCostMCU: 50,
      adjustedCostMCU: 48,
      multiplier: 0.95,
    });
  });

  it('passes since param to getWorkspaceROI', async () => {
    authed();
    grantAccess();
    stubSuccessData();

    const url = new URL('http://localhost/api/monetization');
    url.searchParams.set('workspaceId', 'ws_001');
    url.searchParams.set('since', '1700000000000');
    const req = new Request(url.toString());
    await GET(req as never);

    expect(mockGetWorkspaceROI).toHaveBeenCalledWith('ws_001', { since: 1700000000000 });
    expect(mockGetTopROIChannels).toHaveBeenCalledWith('ws_001', 5, 1700000000000);
    expect(mockAggregateRevenueAttribution).toHaveBeenCalledWith('ws_001', { since: 1700000000000 });
  });
});