/**
 * Integration tests for distribution-pipeline-scan cron route.
 * Tests the cron route that scans distribution pipeline for failures, latency spikes, and zero-post stalls.
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

vi.mock('@/forest/alerts/distribution-pipeline-alert', () => ({
  triggerDistributionPipelineAlert: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1Safe: vi.fn(),
}));

import { verifyCronAuth } from '@/seed/security/cron-auth';
import { startCronCheckIn, finishCronCheckIn, failCronCheckIn } from '@/seed/observability/cron-check-in';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { isAlertThrottled, markAlertThrottled } from '@/forest/alerts/alert-throttle';
import { triggerDistributionPipelineAlert } from '@/forest/alerts/distribution-pipeline-alert';
import { getD1Safe } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

describe('GET /api/cron/distribution-pipeline-scan', () => {
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
    const req = new Request('https://test.com/api/cron/distribution-pipeline-scan', {
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
    const req = new Request('https://test.com/api/cron/distribution-pipeline-scan', {
      method: 'GET',
      headers: new Headers({ 'Authorization': 'Bearer wrong-secret' }),
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 200 with no alerts when no data', async () => {
    mockDb.all.mockResolvedValueOnce({ results: [] }); // no distribution_posts

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.alerted).toBe(0);
    expect(recordCronRun).toHaveBeenCalledWith(mockDb, 'distribution-pipeline-scan', 'success');
  });

  it('should trigger alert on high failure rate', async () => {
    const now = Date.now();
    const hourAgo = now - 5 * 60 * 1000;
    // 5 posts in current hour: 3 failed, 2 success → failureRate 0.6 > 0.15 threshold
    mockDb.all.mockResolvedValueOnce({
      results: [
        { workspace_id: 'ws-1', platform: 'youtube', status: 'failed', error: 'timeout', created_at: hourAgo, scheduled_at: hourAgo, posted_at: null },
        { workspace_id: 'ws-1', platform: 'youtube', status: 'failed', error: 'timeout', created_at: hourAgo, scheduled_at: hourAgo, posted_at: null },
        { workspace_id: 'ws-1', platform: 'youtube', status: 'failed', error: 'api_error', created_at: hourAgo, scheduled_at: hourAgo, posted_at: null },
        { workspace_id: 'ws-1', platform: 'youtube', status: 'success', error: null, created_at: hourAgo, scheduled_at: hourAgo, posted_at: null },
        { workspace_id: 'ws-1', platform: 'youtube', status: 'success', error: null, created_at: hourAgo, scheduled_at: hourAgo, posted_at: null },
      ]
    });

    (triggerDistributionPipelineAlert as any).mockResolvedValue('alert-123');

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.alerted).toBe(1);
    expect(triggerDistributionPipelineAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        platform: 'youtube',
        failureRate: 0.6,
      })
    );
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
    const now = Date.now();
    const hourAgo = now - 5 * 60 * 1000;
    mockDb.all.mockResolvedValueOnce({
      results: Array(10).fill(null).map(() => ({
        workspace_id: 'ws-1',
        platform: 'youtube',
        status: 'failed',
        error: 'timeout',
        created_at: hourAgo,
        scheduled_at: hourAgo,
        posted_at: null,
      }))
    });

    (isAlertThrottled as any).mockResolvedValueOnce(true); // throttle active

    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.alerted).toBe(0);
    expect(body.throttled).toBe(1);
    expect(triggerDistributionPipelineAlert).not.toHaveBeenCalled();
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
    expect(recordCronRun).toHaveBeenCalledWith(mockDb, 'distribution-pipeline-scan', 'failure', expect.any(String));
  });
});
