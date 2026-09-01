/**
 * Unit tests for creative-quality-drift-alert.ts
 * Tests the alert wrapper for creative quality drift monitoring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerCreativeQualityDriftAlert } from '../creative-quality-drift-alert';

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

describe('triggerCreativeQualityDriftAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should dispatch alert with correct parameters when drift detected', async () => {
    const mockAlertId = 'alert-quality-123';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const params = {
      workspaceId: 'ws-123',
      currentAcceptanceRate: 0.55,
      baselineAcceptanceRate: 0.85,
      driftRatio: 0.647,
      acceptedCount: 11,
      rejectedCount: 9,
    };

    const result = await triggerCreativeQualityDriftAlert(params);

    expect(result).toBe(mockAlertId);
    expect(createRealtimeAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'synthetic-monitor',
        type: 'platform.creative_quality_drift',
        severity: 'high',
        title: expect.stringContaining('ws-123'),
        message: expect.stringContaining('55%'),
        message: expect.stringContaining('85%'),
        metadata: expect.objectContaining({
          workspaceId: 'ws-123',
          currentAcceptanceRate: 0.55,
          baselineAcceptanceRate: 0.85,
          currentRatePct: 55,
          baselineRatePct: 85,
          driftRatio: 0.65,
          acceptedCount: 11,
          rejectedCount: 9,
          reason: 'CREATIVE_QUALITY_DRIFT',
        }),
        expiresAt: expect.any(Date),
      })
    );
  });

  it('should use medium severity when drift ratio >= 0.70', async () => {
    const mockAlertId = 'alert-quality-456';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const params = {
      workspaceId: 'ws-456',
      currentAcceptanceRate: 0.72,
      baselineAcceptanceRate: 0.95,
      driftRatio: 0.758,
      acceptedCount: 18,
      rejectedCount: 7,
    };

    const result = await triggerCreativeQualityDriftAlert(params);

    expect(result).toBe(mockAlertId);
    expect(createRealtimeAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'medium',
      })
    );
  });

  it('should include SOP quality message when provided', async () => {
    const mockAlertId = 'alert-quality-789';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const params = {
      workspaceId: 'ws-789',
      currentAcceptanceRate: 0.5,
      baselineAcceptanceRate: 0.8,
      driftRatio: 0.625,
      acceptedCount: 10,
      rejectedCount: 10,
      sopTemplateId: 'sop-abc',
      currentSopQuality: 0.65,
      baselineSopQuality: 0.9,
    };

    await triggerCreativeQualityDriftAlert(params);

    const callArgs = (createRealtimeAlert as any).mock.calls[0][0];
    expect(callArgs.message).toContain('SOP quality: 65%');
    expect(callArgs.message).toContain('baseline: 90%');
    expect(callArgs.metadata).toMatchObject({
      sopTemplateId: 'sop-abc',
      currentSopQuality: 0.65,
      baselineSopQuality: 0.9,
    });
  });

  it('should return null and log error on dispatch failure', async () => {
    const error = new Error('D1 unavailable');
    (createRealtimeAlert as any).mockRejectedValue(error);

    const params = {
      workspaceId: 'ws-999',
      currentAcceptanceRate: 0.4,
      baselineAcceptanceRate: 0.8,
      driftRatio: 0.5,
      acceptedCount: 4,
      rejectedCount: 6,
    };

    const result = await triggerCreativeQualityDriftAlert(params);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      '[creative-quality-drift-alert] dispatch failed',
      expect.objectContaining({
        workspaceId: 'ws-999',
        error: 'D1 unavailable',
      })
    );
  });

  it('should set expiresAt to 3 days from now', async () => {
    const mockAlertId = 'alert-quality-999';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const before = Date.now();
    const params = {
      workspaceId: 'ws-999',
      currentAcceptanceRate: 0.5,
      baselineAcceptanceRate: 0.8,
      driftRatio: 0.625,
      acceptedCount: 10,
      rejectedCount: 10,
    };

    await triggerCreativeQualityDriftAlert(params);

    const callArgs = (createRealtimeAlert as any).mock.calls[0][0];
    const expiresAt = callArgs.expiresAt as Date;
    const after = Date.now();

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3 * 24 * 60 * 60 * 1000 - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 3 * 24 * 60 * 60 * 1000 + 1000);
  });

  it('should handle driftRatio of exactly 1.0 (no drift)', async () => {
    const mockAlertId = 'alert-quality-eq1';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const params = {
      workspaceId: 'ws-eq1',
      currentAcceptanceRate: 0.8,
      baselineAcceptanceRate: 0.8,
      driftRatio: 1.0,
      acceptedCount: 8,
      rejectedCount: 2,
    };

    await triggerCreativeQualityDriftAlert(params);

    const callArgs = (createRealtimeAlert as any).mock.calls[0][0];
    expect(callArgs.severity).toBe('medium'); // driftRatio 1.0 >= 0.70
    expect(callArgs.metadata.driftRatio).toBe(1.0); // 1.0 rounded to 2 decimal places
  });
});