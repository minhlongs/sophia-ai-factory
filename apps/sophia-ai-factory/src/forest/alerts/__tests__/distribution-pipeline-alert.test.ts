/**
 * Unit tests for distribution-pipeline-alert.ts
 * Tests the alert wrapper for distribution pipeline monitoring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerDistributionPipelineAlert } from '../distribution-pipeline-alert';

// Mock dependencies
vi.mock('@/tree/alerts/realtime-alert-service', () => ({
  createRealtimeAlert: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/seed/config/synthetic-monitoring', () => ({
  SYNTHETIC_USER_ID: 'synthetic-monitor',
}));

import { createRealtimeAlert } from '@/tree/alerts/realtime-alert-service';
import { logger } from '@/seed/utils/logger-utility';
import { SYNTHETIC_USER_ID } from '@/seed/config/synthetic-monitoring';

describe('triggerDistributionPipelineAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should dispatch alert with correct parameters', async () => {
    const mockAlertId = 'alert-123';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const params = {
      workspaceId: 'ws-123',
      platform: 'youtube',
      failedCount: 5,
      totalCount: 20,
      failureRate: 0.25,
      baselineFailureRate: 0.05,
      p95LatencyMs: 5000,
      baselineP95LatencyMs: 1500,
      failureTaxonomy: { 'timeout': 3, 'api_error': 2 },
    };

    const result = await triggerDistributionPipelineAlert(params);

    expect(result).toBe(mockAlertId);
    expect(createRealtimeAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'synthetic-monitor',
        type: 'platform.distribution_pipeline',
        severity: 'high',
        title: expect.stringContaining('youtube'),
        message: expect.stringContaining('25%'),
        metadata: expect.objectContaining({
          workspaceId: 'ws-123',
          platform: 'youtube',
          failedCount: 5,
          totalCount: 20,
          failureRate: 0.25,
          baselineFailureRate: 0.05,
          p95LatencyMs: 5000,
          baselineP95LatencyMs: 1500,
          failureTaxonomy: { 'timeout': 3, 'api_error': 2 },
          reason: 'DISTRIBUTION_PIPELINE_DEGRADED',
        }),
        expiresAt: expect.any(Date),
      })
    );
  });

  it('should handle zero latency gracefully', async () => {
    const mockAlertId = 'alert-456';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const params = {
      workspaceId: 'ws-456',
      platform: 'tiktok',
      failedCount: 10,
      totalCount: 10,
      failureRate: 1.0,
      baselineFailureRate: 0.1,
      p95LatencyMs: 0,
      baselineP95LatencyMs: 0,
      failureTaxonomy: { 'auth_failed': 10 },
    };

    const result = await triggerDistributionPipelineAlert(params);

    expect(result).toBe(mockAlertId);
    expect(createRealtimeAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          p95LatencyMs: 0,
          baselineP95LatencyMs: 0,
        }),
      })
    );
  });

  it('should return null and log error on dispatch failure', async () => {
    const error = new Error('D1 unavailable');
    (createRealtimeAlert as any).mockRejectedValue(error);

    const params = {
      workspaceId: 'ws-789',
      platform: 'instagram',
      failedCount: 1,
      totalCount: 5,
      failureRate: 0.2,
      baselineFailureRate: 0.02,
      p95LatencyMs: 2000,
      baselineP95LatencyMs: 500,
      failureTaxonomy: {},
    };

    const result = await triggerDistributionPipelineAlert(params);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      '[distribution-pipeline-alert] dispatch failed',
      expect.objectContaining({
        workspaceId: 'ws-789',
        platform: 'instagram',
        error: 'D1 unavailable',
      })
    );
  });

  it('should set expiresAt to 3 days from now', async () => {
    const mockAlertId = 'alert-789';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const before = Date.now();
    const params = {
      workspaceId: 'ws-999',
      platform: 'facebook',
      failedCount: 2,
      totalCount: 10,
      failureRate: 0.2,
      baselineFailureRate: 0.05,
      p95LatencyMs: 3000,
      baselineP95LatencyMs: 1000,
      failureTaxonomy: {},
    };

    await triggerDistributionPipelineAlert(params);

    const callArgs = (createRealtimeAlert as any).mock.calls[0][0];
    const expiresAt = callArgs.expiresAt as Date;
    const after = Date.now();

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3 * 24 * 60 * 60 * 1000 - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 3 * 24 * 60 * 60 * 1000 + 1000);
  });
});