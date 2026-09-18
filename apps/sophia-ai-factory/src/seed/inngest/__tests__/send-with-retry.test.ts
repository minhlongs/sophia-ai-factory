import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendInngestWithRetry,
  isTransientInngestError,
} from '../send-with-retry';

describe('sendInngestWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isTransientInngestError', () => {
    it('identifies network failures as transient', () => {
      expect(isTransientInngestError(new Error('fetch failed'))).toBe(true);
      expect(isTransientInngestError(new Error('Network connection error: socket hang up'))).toBe(true);
      expect(isTransientInngestError(new Error('Connection reset by peer: ECONNRESET'))).toBe(true);
      expect(isTransientInngestError(new Error('Request timeout'))).toBe(true);
      expect(isTransientInngestError(new Error('Gateway Timeout 504'))).toBe(true);
      expect(isTransientInngestError(new Error('Service Unavailable 503'))).toBe(true);
      expect(isTransientInngestError(new Error('429 Too Many Requests'))).toBe(true);
      expect(isTransientInngestError(new Error('Inngest unreachable'))).toBe(true);
    });

    it('identifies permanent/domain errors as non-transient', () => {
      expect(isTransientInngestError(new Error('Invalid event payload'))).toBe(false);
      expect(isTransientInngestError(new Error('Unauthorized: missing signing key'))).toBe(false);
      expect(isTransientInngestError(new Error('Schema validation error'))).toBe(false);
      expect(isTransientInngestError(null)).toBe(false);
      expect(isTransientInngestError(undefined)).toBe(false);
    });
  });

  describe('retry execution', () => {
    it('returns immediately on first-try success', async () => {
      const sendFn = vi.fn().mockResolvedValue({ ids: ['evt_123'] });

      const result = await sendInngestWithRetry(sendFn, {
        baseDelayMs: 5,
        maxDelayMs: 10,
      });

      expect(result).toEqual({ ids: ['evt_123'] });
      expect(sendFn).toHaveBeenCalledTimes(1);
    });

    it('retries on transient error and succeeds on 2nd attempt', async () => {
      const sendFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce({ ids: ['evt_recovered'] });

      const onRetry = vi.fn();

      const result = await sendInngestWithRetry(sendFn, {
        maxRetries: 2,
        baseDelayMs: 5,
        maxDelayMs: 10,
        jitter: false,
        onRetry,
      });

      expect(result).toEqual({ ids: ['evt_recovered'] });
      expect(sendFn).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 5);
    });

    it('fails fast on non-transient error without retrying', async () => {
      const sendFn = vi.fn().mockRejectedValue(new Error('Schema validation error: field required'));

      const onRetry = vi.fn();

      await expect(
        sendInngestWithRetry(sendFn, {
          maxRetries: 3,
          baseDelayMs: 5,
          onRetry,
        }),
      ).rejects.toThrow('Schema validation error: field required');

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    });

    it('exhausts retries on persistent transient error and throws last error', async () => {
      const sendFn = vi.fn().mockRejectedValue(new Error('Gateway Timeout 504'));

      const onRetry = vi.fn();

      await expect(
        sendInngestWithRetry(sendFn, {
          maxRetries: 2,
          baseDelayMs: 5,
          maxDelayMs: 10,
          jitter: false,
          onRetry,
        }),
      ).rejects.toThrow('Gateway Timeout 504');

      expect(sendFn).toHaveBeenCalledTimes(3); // attempt 0, attempt 1, attempt 2
      expect(onRetry).toHaveBeenCalledTimes(2);
    });
  });
});
