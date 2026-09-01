/**
 * Integration tests for agent-cost-overrun-scan cron route.
 * Tests the cron route that scans for agent cost budget overruns.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';

// Mock dependencies
vi.mock('@/seed/security/cron-auth', () => ({
  verifyCronAuth: vi.fn().mockReturnValue(null),
}));

vi.mock('@/seed/observability/cron-check-in', () => ({
  startCronCheckIn: vi.fn(),
  finishCronCheckIn: vi.fn(),
  failCronCheckIn: vi.fn(),
}));

vi.mock('@/land/cron/run-tracker', () => ({
  recordCronRun: vi.fn().mockResolvedValue(undefined),
  wasRecentlyRun: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/forest/alerts/alert-throttle', () => ({
  isAlertThrottled: vi.fn().mockResolvedValue(false),
  markAlertThrottled: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/forest/alerts/agent-cost-overrun-alert', () => ({
  triggerAgentCostOverrunAlert: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1Safe: vi.fn(),
}));

import { verifyCronAuth } from '@/seed/security/cron-auth';
import { startCronCheckIn, finishCronCheckIn, failCronCheckIn } from '@/seed/observability/cron-check-in';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { isAlertThrottled, markAlertThrottled } from '@/forest/alerts/alert-throttle';
import { triggerAgentCostOverrunAlert } from '@/forest/alerts/agent-cost-overrun-alert';
import { getD1Safe } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

describe('GET /api/cron/agent-cost-overrun-scan', () => {
  const mockDb = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({ success: true }),
  };

  const mockRequest = {
    headers: new Headers({
      'Authorization': 'Bearer test-cron-secret',
    }),
  } as unknown as Request;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.prepare.mockReturnThis();
    mockDb.bind.mockReturnThis();
    mockDb.all.mockResolvedValue({ results: [] });
    mockDb.run.mockResolvedValue({ success: true });
    (getD1Safe as any).mockResolvedValue(mockDb);
    (startCronCheckIn as any).mockReturnValue({ checkInId: 'checkin-123', startedAt: Date.now() });
    (finishCronCheckIn as any).mockReturnValue(undefined);
    (failCronCheckIn as any).mockReturnValue(undefined);
    (recordCronRun as any).mockResolvedValue(undefined);
    (wasRecentlyRun as any).mockResolvedValue(false);
    (isAlertThrottled as any).mockResolvedValue(false);
    (markAlertThrottled as any).mockResolvedValue(undefined);
    (verifyCronAuth as any).mockReturnValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return 401 without Authorization header', async () => {
    (verifyCronAuth as any).mockReturnValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );
    const req = new Request('https://test.com/cron/agent-cost-overrun-scan', {
      method: 'GET',
      headers: new Headers({}),
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 401 with invalid Authorization token', async () => {
    (verifyCronAuth as any).mockReturnValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );
    const req = new Request('https://test.com/api/cron/agent-cost-overrun-scan', {
      method: 'GET',
      headers: new Headers({ 'Authorization': 'Bearer wrong-secret' }),
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 200 with no alerts when no active missions', async () => {
    mockDb.all.mockResolvedValueOnce({ results: [] });

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.scanned).toBe(0);
    expect(body.alerted).toBe(0);
    expect(body.throttled).toBe(0);
    expect(recordCronRun).toHaveBeenCalledWith(mockDb, 'agent-cost-overrun-scan', 'success');
  });

  it('should return 200 with no alerts when all missions within budget', async () => {
    // spend < 85% of budget, projected < 100% → no alert
    mockDb.all.mockResolvedValueOnce({
      results: [
        {
          mission_id: 'mission-1',
          workspace_id: 'ws-1',
          budget_cents: 10000,
          spent_cents: 5000,
          status: 'active',
          timeframe_end: Date.now() + 3600000,
          owner_user_id: 'user-1',
        }
      ]
    });

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.alerted).toBe(0);
    expect(triggerAgentCostOverrunAlert).not.toHaveBeenCalled();
  });

  it('should trigger critical alert when spend >= 100% budget', async () => {
    mockDb.all.mockResolvedValueOnce({
      results: [
        {
          mission_id: 'mission-critical',
          workspace_id: 'ws-1',
          budget_cents: 10000,
          spent_cents: 10500,
          status: 'active',
          timeframe_end: Date.now() + 3600000,
          owner_user_id: 'user-critical',
        }
      ]
    });
    // burn rate query returns 0
    mockDb.all.mockResolvedValueOnce({ results: [{ hourly_burn: 0 }] });

    (triggerAgentCostOverrunAlert as any).mockResolvedValue('alert-cost-critical-123');

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.alerted).toBe(1);
    expect(triggerAgentCostOverrunAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        missionId: 'mission-critical',
        workspaceId: 'ws-1',
        ownerUserId: 'user-critical',
        budgetCents: 10000,
        spentCents: 10500,
        severity: 'critical',
      })
    );
  });

  it('should trigger high alert when spend >= 85% but < 100%', async () => {
    mockDb.all.mockResolvedValueOnce({
      results: [
        {
          mission_id: 'mission-high',
          workspace_id: 'ws-2',
          budget_cents: 5000,
          spent_cents: 4500,
          status: 'active',
          timeframe_end: Date.now() + 7200000,
          owner_user_id: 'user-high',
        }
      ]
    });
    mockDb.all.mockResolvedValueOnce({ results: [{ hourly_burn: 0 }] });

    (triggerAgentCostOverrunAlert as any).mockResolvedValue('alert-cost-high-456');

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.alerted).toBe(1);
    expect(triggerAgentCostOverrunAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        missionId: 'mission-high',
        severity: 'high',
      })
    );
  });

  it('should trigger multiple alerts for multiple missions', async () => {
    mockDb.all.mockResolvedValueOnce({
      results: [
        {
          mission_id: 'mission-1',
          workspace_id: 'ws-1',
          budget_cents: 10000,
          spent_cents: 10500,
          status: 'active',
          timeframe_end: Date.now() + 3600000,
          owner_user_id: 'user-1',
        },
        {
          mission_id: 'mission-2',
          workspace_id: 'ws-2',
          budget_cents: 5000,
          spent_cents: 4500,
          status: 'executing',
          timeframe_end: Date.now() + 7200000,
          owner_user_id: 'user-2',
        },
      ]
    });
    // Two burn rate queries
    mockDb.all.mockResolvedValueOnce({ results: [{ hourly_burn: 0 }] });
    mockDb.all.mockResolvedValueOnce({ results: [{ hourly_burn: 0 }] });

    (triggerAgentCostOverrunAlert as any)
      .mockResolvedValueOnce('alert-1')
      .mockResolvedValueOnce('alert-2');

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.alerted).toBe(2);
    expect(triggerAgentCostOverrunAlert).toHaveBeenCalledTimes(2);
  });

  it('should skip if recently run (idempotency)', async () => {
    (wasRecentlyRun as any).mockResolvedValue(true);

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('skipped');
    expect(body.reason).toBe('already-ran');
    // scan must not run after skip
    expect(mockDb.all).not.toHaveBeenCalled();
    expect(recordCronRun).not.toHaveBeenCalled();
  });

  it('should respect KV throttle per mission', async () => {
    mockDb.all.mockResolvedValueOnce({
      results: [
        {
          mission_id: 'mission-throttled',
          workspace_id: 'ws-1',
          budget_cents: 10000,
          spent_cents: 10500,
          status: 'active',
          timeframe_end: Date.now() + 3600000,
          owner_user_id: 'user-throttle',
        }
      ]
    });
    mockDb.all.mockResolvedValueOnce({ results: [{ hourly_burn: 0 }] });

    (isAlertThrottled as any).mockResolvedValueOnce(true); // throttle active

    (triggerAgentCostOverrunAlert as any).mockResolvedValue('alert-123');

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.alerted).toBe(0);
    expect(body.throttled).toBe(1);
    expect(triggerAgentCostOverrunAlert).not.toHaveBeenCalled();
  });

  it('should handle database error gracefully', async () => {
    const error = new Error('D1 unavailable');
    mockDb.prepare.mockImplementation(() => {
      throw error;
    });

    const response = await GET(mockRequest);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('scan failed');
    expect(logger.error).toHaveBeenCalled();
    expect(recordCronRun).toHaveBeenCalledWith(mockDb, 'agent-cost-overrun-scan', 'failure', expect.any(String));
  });
});
