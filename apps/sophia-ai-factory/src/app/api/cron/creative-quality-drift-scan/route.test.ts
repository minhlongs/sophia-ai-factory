/**
 * Integration tests for creative-quality-drift-scan cron route.
 * Tests the cron route that scans for creative quality acceptance rate drift.
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

vi.mock('@/forest/alerts/creative-quality-drift-alert', () => ({
  triggerCreativeQualityDriftAlert: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1Safe: vi.fn(),
}));

import { verifyCronAuth } from '@/seed/security/cron-auth';
import { startCronCheckIn, finishCronCheckIn, failCronCheckIn } from '@/seed/observability/cron-check-in';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { isAlertThrottled, markAlertThrottled } from '@/forest/alerts/alert-throttle';
import { triggerCreativeQualityDriftAlert } from '@/forest/alerts/creative-quality-drift-alert';
import { getD1Safe } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

describe('GET /api/cron/creative-quality-drift-scan', () => {
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
    const req = new Request('https://test.com/api/cron/creative-quality-drift-scan', {
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
    const req = new Request('https://test.com/api/cron/creative-quality-drift-scan', {
      method: 'GET',
      headers: new Headers({ 'Authorization': 'Bearer wrong-secret' }),
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 200 with no alerts when no events', async () => {
    mockDb.all.mockResolvedValueOnce({ results: [] }); // no quality rows

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.alerted).toBe(0);
    expect(recordCronRun).toHaveBeenCalledWith(mockDb, 'creative-quality-drift-scan', 'success');
  });

  it('should return 200 with no alerts when acceptance rate is healthy', async () => {
    // currentRate = 85/100 = 0.85, baselineRate = 0.84/(0.84+0.16) = 0.84
    // driftRatio = 0.85/0.84 ≈ 1.01 >= 0.7 threshold → no alert
    mockDb.all.mockResolvedValueOnce({
      results: [
        { workspace_id: 'ws-1', accepted_1h: 85, rejected_1h: 15, baseline_accepted_hourly: 0.84, baseline_rejected_hourly: 0.16 }
      ]
    });

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.alerted).toBe(0);
    expect(triggerCreativeQualityDriftAlert).not.toHaveBeenCalled();
  });

  it('should trigger alert on acceptance rate drift', async () => {
    // currentRate = 11/20 = 0.55, baselineRate = 0.85/(0.85+0.15) = 0.85
    // driftRatio = 0.55/0.85 ≈ 0.647 < 0.7 threshold → alert
    mockDb.all.mockResolvedValueOnce({
      results: [
        { workspace_id: 'ws-1', accepted_1h: 11, rejected_1h: 9, baseline_accepted_hourly: 0.85, baseline_rejected_hourly: 0.15 }
      ]
    });

    (triggerCreativeQualityDriftAlert as any).mockResolvedValue('alert-quality-123');

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.alerted).toBe(1);
    expect(triggerCreativeQualityDriftAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        currentAcceptanceRate: 0.55,
        baselineAcceptanceRate: 0.85,
        driftRatio: expect.closeTo(0.647, 2),
        acceptedCount: 11,
        rejectedCount: 9,
      })
    );
    expect(markAlertThrottled).toHaveBeenCalledWith(
      'quality_drift_alert:ws-1',
      'alert-quality-123',
      4 * 60 * 60
    );
  });

  it('should not mark throttle when alert dispatch fails', async () => {
    mockDb.all.mockResolvedValueOnce({
      results: [
        { workspace_id: 'ws-1', accepted_1h: 11, rejected_1h: 9, baseline_accepted_hourly: 0.85, baseline_rejected_hourly: 0.15 }
      ]
    });

    (triggerCreativeQualityDriftAlert as any).mockResolvedValue(null); // dispatch failed

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.alerted).toBe(0);
    expect(markAlertThrottled).not.toHaveBeenCalled();
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

  it('should respect KV throttle', async () => {
    // Row that would trigger an alert (driftRatio ≈ 0.38 < 0.7), but throttle is active
    mockDb.all.mockResolvedValueOnce({
      results: [
        { workspace_id: 'ws-1', accepted_1h: 3, rejected_1h: 7, baseline_accepted_hourly: 0.8, baseline_rejected_hourly: 0.2 }
      ]
    });

    (isAlertThrottled as any).mockResolvedValueOnce(true); // throttle active

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.alerted).toBe(0);
    expect(body.throttled).toBe(1);
    expect(triggerCreativeQualityDriftAlert).not.toHaveBeenCalled();
  });

  it('should skip workspaces with insufficient events', async () => {
    // currentTotal = 4 < MIN_EVENTS_FOR_ALERT (5) → no alert
    mockDb.all.mockResolvedValueOnce({
      results: [
        { workspace_id: 'ws-1', accepted_1h: 2, rejected_1h: 2, baseline_accepted_hourly: 0.5, baseline_rejected_hourly: 0.5 }
      ]
    });

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.alerted).toBe(0);
    expect(triggerCreativeQualityDriftAlert).not.toHaveBeenCalled();
  });

  it('should skip workspaces with zero baseline volume', async () => {
    // baselineTotal = 0 → guard skips row even with severe current drift
    mockDb.all.mockResolvedValueOnce({
      results: [
        { workspace_id: 'ws-1', accepted_1h: 1, rejected_1h: 9, baseline_accepted_hourly: 0, baseline_rejected_hourly: 0 }
      ]
    });

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.alerted).toBe(0);
    expect(triggerCreativeQualityDriftAlert).not.toHaveBeenCalled();
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
    expect(recordCronRun).toHaveBeenCalledWith(mockDb, 'creative-quality-drift-scan', 'failure', expect.any(String));
  });
});
