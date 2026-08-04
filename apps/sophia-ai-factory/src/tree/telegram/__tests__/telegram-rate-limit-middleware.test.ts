/**
 * Unit tests for telegram-rate-limit-middleware
 * @module tree/telegram/__tests__/telegram-rate-limit-middleware.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit } from '../telegram-rate-limit-middleware';
import { createServerClient } from '@/seed/db/client';

// Mock D1 client
const mockRpc = vi.fn();

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
  tryCreateServerClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

describe('TelegramRateLimitMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow request when under limit (backward compatible API)', async () => {
      mockRpc.mockResolvedValue({
        data: [{ allowed: true, remaining: 9, oldest_timestamp: null }],
        error: null,
      });

      const result = await checkRateLimit('user123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.resetAt).toBeGreaterThanOrEqual(Math.floor(Date.now() / 1000));
      expect(result.retryAfter).toBe(0);
    });

    it('should deny request when limit exceeded', async () => {
      mockRpc.mockResolvedValue({
        data: [{ allowed: false, remaining: 0, oldest_timestamp: new Date().toISOString() }],
        error: null,
      });

      const result = await checkRateLimit('user123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should support new API with userId and chatId', async () => {
      mockRpc.mockResolvedValue({
        data: [{ allowed: true, remaining: 9, oldest_timestamp: null }],
        error: null,
      });

      const result = await checkRateLimit('user123', 'chat456', 10, 60);

      expect(mockRpc).toHaveBeenCalledWith('check_telegram_rate_limit', {
        p_chat_id: 'chat456',
        p_command_type: 'command',
        p_max_requests: 10,
        p_window_seconds: 60,
      });
      expect(result.allowed).toBe(true);
    });

    it('should handle RPC errors gracefully (fail open)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      const result = await checkRateLimit('user123', 'chat456', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
      expect(result.retryAfter).toBe(0); // allowed=true => retryAfter=0
    });

    it('should handle exceptions gracefully (fail open)', async () => {
      mockRpc.mockRejectedValue(new Error('Connection error'));

      const result = await checkRateLimit('user123', 'chat456', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
      expect(result.retryAfter).toBe(0); // allowed=true => retryAfter=0
    });

    it('should calculate remaining correctly', async () => {
      // Count = 7, limit = 10, so after this request count becomes 8, remaining = 2
      mockRpc.mockResolvedValue({
        data: [{ allowed: true, remaining: 2, oldest_timestamp: null }],
        error: null,
      });

      const result = await checkRateLimit('user123', 'chat456', 10, 60);

      expect(result.remaining).toBe(2);
      expect(result.allowed).toBe(true);
    });
  });
});
