import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RETRY_BACKOFF_SCHEDULE_SECONDS,
  getBackoffDelaySeconds,
  publishExecute,
} from '@/forest/inngest/functions/publish-execute';
import { extractRetryAfterMs } from '@/land/video/publishing/publish-upload';
import { inngest } from '@/seed/inngest/client';

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_cfg, _event, handler) => ({ _handler: handler, ..._cfg })),
    send: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/land/video/publishing/execute', () => ({
  executePublishWorkflow: vi.fn(async (args) => {
    // Simulate failure triggering scheduleRetry
    await args.scheduleRetry(args.jobId, args.tenantId, args.userId, 1);
    return { skipped: false, jobId: args.jobId, status: 'scheduled' };
  }),
}));

vi.mock('@/forest/publishing/oauth-token-refresher', () => ({
  refreshChannelToken: vi.fn(),
  refreshExpiringTokens: vi.fn(),
}));

describe('Exponential Backoff Retry Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Backoff Schedule Math', () => {
    it('defines true exponential backoff schedule [30, 60, 300, 900, 3600] seconds', () => {
      expect(RETRY_BACKOFF_SCHEDULE_SECONDS).toEqual([30, 60, 300, 900, 3600]);
    });

    it('maps attempt 1 to 30s', () => {
      expect(getBackoffDelaySeconds(1)).toBe(30);
    });

    it('maps attempt 2 to 60s', () => {
      expect(getBackoffDelaySeconds(2)).toBe(60);
    });

    it('maps attempt 3 to 300s', () => {
      expect(getBackoffDelaySeconds(3)).toBe(300);
    });

    it('maps attempt 4 to 900s', () => {
      expect(getBackoffDelaySeconds(4)).toBe(900);
    });

    it('maps attempt 5 and higher to max backoff 3600s', () => {
      expect(getBackoffDelaySeconds(5)).toBe(3600);
      expect(getBackoffDelaySeconds(10)).toBe(3600);
    });

    it('bounds invalid or negative attempt counts safely to first index (30s)', () => {
      expect(getBackoffDelaySeconds(0)).toBe(30);
      expect(getBackoffDelaySeconds(-1)).toBe(30);
    });

    it('respects delayMs override from HTTP 429 Retry-After headers with [30, 3600] clamping', () => {
      expect(getBackoffDelaySeconds(1, 45000)).toBe(45);
      expect(getBackoffDelaySeconds(2, 120000)).toBe(120);
      expect(getBackoffDelaySeconds(1, 500)).toBe(30); // Clamped to min 30s
      expect(getBackoffDelaySeconds(1, 86400000)).toBe(3600); // Clamped to max 3600s
    });
  });

  describe('extractRetryAfterMs', () => {
    it('extracts from error object with retryAfterSec property', () => {
      const err = { message: 'rate limit', retryAfterSec: 75 };
      expect(extractRetryAfterMs(err)).toBe(75000);
    });

    it('extracts from Error message containing Retry-After pattern', () => {
      const err = new Error('Rate limited (429). Retry-After: 90s');
      expect(extractRetryAfterMs(err)).toBe(90000);
    });

    it('returns undefined when no retry after info is available', () => {
      expect(extractRetryAfterMs(new Error('Internal Server Error 500'))).toBeUndefined();
      expect(extractRetryAfterMs(null)).toBeUndefined();
      expect(extractRetryAfterMs(undefined)).toBeUndefined();
    });
  });

  describe('publishExecute scheduleRetry handler', () => {
    it('calls step.sleep with backoff duration before dispatching retry event', async () => {
      const stepSleep = vi.fn().mockResolvedValue(undefined);
      const step = {
        run: vi.fn().mockImplementation((_name, fn) => fn()),
        sleep: stepSleep,
      };

      const event = {
        id: 'evt-retry-test',
        name: 'publish.scheduled',
        data: {
          jobId: 'job-backoff-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
        },
      };

      const handler = (publishExecute as unknown as { _handler: (...args: unknown[]) => unknown })._handler;
      await handler({ event, step });

      // Verification: step.sleep called with '30s' for attempt 1
      expect(stepSleep).toHaveBeenCalledWith('publish-job-backoff-1-backoff-1', '30s');

      // inngest.send called with the retry event
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'publish-job-backoff-1-retry-1',
          name: 'publish.scheduled',
          data: expect.objectContaining({
            jobId: 'job-backoff-1',
            tenantId: 'tenant-1',
            userId: 'user-1',
            attempt: 1,
          }),
        }),
      );
    });
  });
});
