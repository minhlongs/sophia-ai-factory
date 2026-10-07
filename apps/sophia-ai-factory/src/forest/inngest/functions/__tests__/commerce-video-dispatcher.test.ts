/**
 * Unit Tests for commerceVideoBatchDispatcher Inngest Function
 *
 * Tests quota gating, video render mission triggering, and
 * Reality Loop cost telemetry emission.
 *
 * Layer: forest (infrastructure orchestrator tests)
 * @module forest/inngest/functions/__tests__/commerce-video-dispatcher.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commerceVideoBatchDispatcher } from '../commerce-video-dispatcher';
import { success, failure } from '@/seed/types/result';
import type { UnifiedProductItem } from '@/seed/types/ecommerce';

const { mockTriggerMission, mockEmitCost, mockCheckQuota } = vi.hoisted(() => ({
  mockTriggerMission: vi.fn(),
  mockEmitCost: vi.fn(),
  mockCheckQuota: vi.fn(),
}));

vi.mock('@/land/commerce/mission-trigger', () => ({
  triggerProductVideoMission: mockTriggerMission,
}));

vi.mock('@/tree/performance', () => ({
  emitMissionCostRecorded: mockEmitCost,
}));

vi.mock('@/tree/quota/mission-quota', () => ({
  checkMissionQuota: mockCheckQuota,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('commerceVideoBatchDispatcher Inngest Function', () => {
  const sampleProducts: UnifiedProductItem[] = [
    {
      id: 'prod_101',
      platform: 'shopify',
      title: 'Minimalist Titanium Watch',
      description: 'Precision engineered automatic movement.',
      price: 249.0,
      currency: 'USD',
      images: ['https://cdn.shopify.com/watch.jpg'],
      status: 'active',
      tags: ['luxury'],
      rawMetadata: {},
    },
    {
      id: 'prod_102',
      platform: 'shopify',
      title: 'Obsidian Chronograph',
      description: 'Sapphire crystal dial.',
      price: 389.0,
      currency: 'USD',
      images: ['https://cdn.shopify.com/obsidian.jpg'],
      status: 'active',
      tags: ['luxury', 'chronograph'],
      rawMetadata: {},
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('halts batch dispatch when pre-flight quota is exceeded', async () => {
    mockCheckQuota.mockResolvedValue({
      allowed: false,
      remaining: 0,
      current: 100,
    });

    const stepMock = {
      run: vi.fn(async (_name: string, fn: () => unknown) => fn()),
    };

    const eventData = {
      name: 'commerce/video.batch.dispatch.requested',
      data: {
        batchId: 'batch_q_001',
        workspaceId: 'ws_demo',
        storeHost: 'store.myshopify.com',
        products: sampleProducts,
        autonomyLevel: 1,
      },
    };

    const handler = (commerceVideoBatchDispatcher as unknown as { fn: (ctx: unknown) => Promise<unknown> }).fn;
    const result = (await handler({ event: eventData, step: stepMock })) as {
      dispatchedCount: number;
      skippedCount: number;
      reason: string;
    };

    expect(result.dispatchedCount).toBe(0);
    expect(result.skippedCount).toBe(2);
    expect(result.reason).toBe('QUOTA_EXCEEDED');
    expect(mockTriggerMission).not.toHaveBeenCalled();
  });

  it('triggers video missions and records telemetry when quota is allowed', async () => {
    mockCheckQuota.mockResolvedValue({
      allowed: true,
      remaining: 10,
      current: 5,
    });

    mockTriggerMission
      .mockResolvedValueOnce(success({ missionId: 'm_101', status: 'queued' }))
      .mockResolvedValueOnce(success({ missionId: 'm_102', status: 'queued' }));

    mockEmitCost.mockResolvedValue(undefined);

    const stepMock = {
      run: vi.fn(async (_name: string, fn: () => unknown) => fn()),
    };

    const eventData = {
      name: 'commerce/video.batch.dispatch.requested',
      data: {
        batchId: 'batch_success_001',
        workspaceId: 'ws_demo',
        storeHost: 'store.myshopify.com',
        products: sampleProducts,
        autonomyLevel: 2,
      },
    };

    const handler = (commerceVideoBatchDispatcher as unknown as { fn: (ctx: unknown) => Promise<unknown> }).fn;
    const result = (await handler({ event: eventData, step: stepMock })) as {
      dispatchedCount: number;
      failedCount: number;
      missionIds: string[];
    };

    expect(result.dispatchedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.missionIds).toEqual(['m_101', 'm_102']);
    expect(mockTriggerMission).toHaveBeenCalledTimes(2);
    expect(mockEmitCost).toHaveBeenCalledTimes(2);
  });

  it('handles partial mission trigger failures gracefully without failing the entire batch', async () => {
    mockCheckQuota.mockResolvedValue({
      allowed: true,
      remaining: 10,
      current: 5,
    });

    mockTriggerMission
      .mockResolvedValueOnce(success({ missionId: 'm_101', status: 'queued' }))
      .mockResolvedValueOnce(
        failure({
          kind: 'VALIDATION_ERROR',
          message: 'Product missing mandatory assets',
        })
      );

    mockEmitCost.mockResolvedValue(undefined);

    const stepMock = {
      run: vi.fn(async (_name: string, fn: () => unknown) => fn()),
    };

    const eventData = {
      name: 'commerce/video.batch.dispatch.requested',
      data: {
        batchId: 'batch_partial_001',
        workspaceId: 'ws_demo',
        storeHost: 'store.myshopify.com',
        products: sampleProducts,
        autonomyLevel: 1,
      },
    };

    const handler = (commerceVideoBatchDispatcher as unknown as { fn: (ctx: unknown) => Promise<unknown> }).fn;
    const result = (await handler({ event: eventData, step: stepMock })) as {
      dispatchedCount: number;
      failedCount: number;
      missionIds: string[];
    };

    expect(result.dispatchedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.missionIds).toEqual(['m_101']);
    expect(mockEmitCost).toHaveBeenCalledTimes(1);
  });
});
