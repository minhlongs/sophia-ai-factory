import { describe, it, expect, vi } from 'vitest';
import { withD1Retry, isD1TransientError } from './d1-retry';

describe('d1-retry', () => {
  describe('isD1TransientError', () => {
    it('detects SQLite busy and locked errors', () => {
      expect(isD1TransientError(new Error('D1_ERROR: database is locked'))).toBe(true);
      expect(isD1TransientError(new Error('SQLITE_BUSY: database is locked'))).toBe(true);
      expect(isD1TransientError(new Error('resource temporarily unavailable'))).toBe(true);
      expect(isD1TransientError(new Error('network connection error'))).toBe(true);
    });

    it('rejects non-transient schema and constraint errors', () => {
      expect(isD1TransientError(new Error('UNIQUE constraint failed: users.email'))).toBe(false);
      expect(isD1TransientError(new Error('no such table: missing_table'))).toBe(false);
      expect(isD1TransientError(new Error('syntax error near "FROM"'))).toBe(false);
      expect(isD1TransientError(null)).toBe(false);
    });
  });

  describe('withD1Retry', () => {
    it('succeeds immediately when operation succeeds', async () => {
      const op = vi.fn().mockResolvedValue('ok');
      const result = await withD1Retry(op);
      expect(result).toBe('ok');
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('retries on transient error and succeeds', async () => {
      let calls = 0;
      const op = vi.fn().mockImplementation(async () => {
        calls++;
        if (calls < 3) {
          throw new Error('D1_ERROR: database is locked');
        }
        return 'recovered';
      });

      const onRetry = vi.fn();
      const result = await withD1Retry(op, {
        baseDelayMs: 5,
        maxDelayMs: 20,
        jitter: false,
        onRetry,
      });

      expect(result).toBe('recovered');
      expect(op).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('fails immediately on non-transient error without retrying', async () => {
      const op = vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed: users.id'));
      const onRetry = vi.fn();

      await expect(
        withD1Retry(op, { maxRetries: 3, onRetry }),
      ).rejects.toThrow('UNIQUE constraint failed');

      expect(op).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    });

    it('throws after exhausting max retries on persistent lock', async () => {
      const op = vi.fn().mockRejectedValue(new Error('SQLITE_BUSY: database is locked'));
      const onRetry = vi.fn();

      await expect(
        withD1Retry(op, {
          maxRetries: 2,
          baseDelayMs: 5,
          maxDelayMs: 15,
          jitter: false,
          onRetry,
        }),
      ).rejects.toThrow('SQLITE_BUSY: database is locked');

      expect(op).toHaveBeenCalledTimes(3); // attempt 0, 1, 2
      expect(onRetry).toHaveBeenCalledTimes(2);
    });
  });
});
