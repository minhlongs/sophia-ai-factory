/**
 * Unit tests for agent-cost-overrun-alert.ts
 * Tests the alert wrapper for agent cost overrun monitoring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerAgentCostOverrunAlert } from '../agent-cost-overrun-alert';

// Mock dependencies
vi.mock('@/tree/alerts/realtime-alert-service', () => ({
  createRealtimeAlert: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { createRealtimeAlert } from '@/tree/alerts/realtime-alert-service';
import { logger } from '@/seed/utils/logger-utility';

describe('triggerAgentCostOverrunAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should dispatch critical alert when spend >= 100% budget', async () => {
    const mockAlertId = 'alert-cost-critical-123';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const params = {
      missionId: 'mission-123',
      workspaceId: 'ws-123',
      ownerUserId: 'user-456',
      budgetCents: 10000, // $100
      spentCents: 10500,  // $105
      spendPercent: 105,
      projectedPercent: 150,
      hourlyBurnRateCents: 500, // $5/hr
      timeframeEnd: Date.now() + 3600000,
      severity: 'critical' as const,
    };

    const result = await triggerAgentCostOverrunAlert(params);

    expect(result).toBe(mockAlertId);
    expect(createRealtimeAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-456',
        type: 'platform.agent_cost_overrun',
        severity: 'critical',
        title: expect.stringContaining('OVER BUDGET'),
        message: expect.stringContaining('105%'),
        metadata: expect.objectContaining({
          missionId: 'mission-123',
          workspaceId: 'ws-123',
          ownerUserId: 'user-456',
          budgetCents: 10000,
          spentCents: 10500,
          budgetDollars: '100.00',
          spentDollars: '105.00',
          spendPercent: 105,
          projectedPercent: 150,
          hourlyBurnRateCents: 500,
          hourlyBurnDollars: '5.00',
          timeframeEnd: params.timeframeEnd,
          reason: 'AGENT_COST_OVERRUN',
        }),
        expiresAt: expect.any(Date),
      })
    );
  });

  it('should dispatch high alert when spend >= 85% but < 100%', async () => {
    const mockAlertId = 'alert-cost-high-456';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const params = {
      missionId: 'mission-456',
      workspaceId: 'ws-456',
      ownerUserId: 'user-789',
      budgetCents: 5000,   // $50
      spentCents: 4500,   // $45
      spendPercent: 90,
      projectedPercent: 120,
      hourlyBurnRateCents: 250, // $2.50/hr
      timeframeEnd: Date.now() + 7200000,
      severity: 'high' as const,
    };

    const result = await triggerAgentCostOverrunAlert(params);

    expect(result).toBe(mockAlertId);
    expect(createRealtimeAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'high',
        title: expect.stringContaining('90%'),
        message: expect.stringContaining('Projected: 120%'),
      })
    );
  });

  it('should handle missing projectedPercent gracefully', async () => {
    const mockAlertId = 'alert-cost-no-projection';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const params = {
      missionId: 'mission-789',
      workspaceId: 'ws-789',
      ownerUserId: 'user-999',
      budgetCents: 2000,   // $20
      spentCents: 1800,   // $18
      spendPercent: 90,
      hourlyBurnRateCents: 100, // $1/hr
      timeframeEnd: Date.now() + 1800000,
      severity: 'high' as const,
    };

    const result = await triggerAgentCostOverrunAlert(params);

    expect(result).toBe(mockAlertId);
    expect(createRealtimeAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          projectedPercent: null,
        }),
      })
    );
  });

  it('should return null and log error on dispatch failure', async () => {
    const error = new Error('D1 unavailable');
    (createRealtimeAlert as any).mockRejectedValue(error);

    const params = {
      missionId: 'mission-999',
      workspaceId: 'ws-999',
      ownerUserId: 'user-111',
      budgetCents: 1000,
      spentCents: 900,
      spendPercent: 90,
      hourlyBurnRateCents: 100,
      timeframeEnd: Date.now() + 3600000,
      severity: 'high' as const,
    };

    const result = await triggerAgentCostOverrunAlert(params);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      '[agent-cost-overrun-alert] dispatch failed',
      expect.objectContaining({
        missionId: 'mission-999',
        workspaceId: 'ws-999',
        error: 'D1 unavailable',
      })
    );
  });

  it('should set expiresAt to 3 days from now', async () => {
    const mockAlertId = 'alert-cost-expire';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const before = Date.now();
    const params = {
      missionId: 'mission-exp',
      workspaceId: 'ws-exp',
      ownerUserId: 'user-exp',
      budgetCents: 1000,
      spentCents: 950,
      spendPercent: 95,
      hourlyBurnRateCents: 200,
      timeframeEnd: Date.now() + 3600000,
      severity: 'high' as const,
    };

    await triggerAgentCostOverrunAlert(params);

    const callArgs = (createRealtimeAlert as any).mock.calls[0][0];
    const expiresAt = callArgs.expiresAt as Date;
    const after = Date.now();

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3 * 24 * 60 * 60 * 1000 - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 3 * 24 * 60 * 60 * 1000 + 1000);
  });

  it('should format dollar amounts with 2 decimal places', async () => {
    const mockAlertId = 'alert-cost-format';
    (createRealtimeAlert as any).mockResolvedValue(mockAlertId);

    const params = {
      missionId: 'mission-fmt',
      workspaceId: 'ws-fmt',
      ownerUserId: 'user-fmt',
      budgetCents: 9999,   // $99.99
      spentCents: 8888,   // $88.88
      spendPercent: 88.88,
      hourlyBurnRateCents: 123, // $1.23
      timeframeEnd: Date.now() + 3600000,
      severity: 'high' as const,
    };

    await triggerAgentCostOverrunAlert(params);

    const callArgs = (createRealtimeAlert as any).mock.calls[0][0];
    expect(callArgs.metadata.budgetDollars).toBe('99.99');
    expect(callArgs.metadata.spentDollars).toBe('88.88');
    expect(callArgs.metadata.hourlyBurnDollars).toBe('1.23');
    expect(callArgs.message).toContain('$99.99');
    expect(callArgs.message).toContain('$88.88');
  });
});