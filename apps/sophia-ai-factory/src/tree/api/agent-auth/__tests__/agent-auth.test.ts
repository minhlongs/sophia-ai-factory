/**
 * Unit tests for agent API authentication, hashing, key management, and rate limiting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sha256Hex,
  rowToApiKey,
  generateApiKey,
  validateApiKey,
  revokeApiKey,
  checkRateLimit,
  logApiRequest,
} from '../index';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('agent-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sha256Hex & rowToApiKey', () => {
    it('produces consistent SHA-256 hex digests', async () => {
      const hash1 = await sha256Hex('test-key-string');
      const hash2 = await sha256Hex('test-key-string');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('correctly maps snake_case DB row to camelCase ApiKey object', () => {
      const row = {
        id: 'k1',
        user_id: 'u1',
        key_hash: 'hash123',
        key_prefix: 'sk_sophia_abc',
        name: 'Test Key',
        permissions_json: JSON.stringify(['sop:read']),
        rate_limit_rpm: 60,
        is_active: 1,
        last_used_at: 1700000000,
        expires_at: 1800000000,
        created_at: 1600000000,
      };
      const apiKey = rowToApiKey(row);
      expect(apiKey.id).toBe('k1');
      expect(apiKey.userId).toBe('u1');
      expect(apiKey.keyPrefix).toBe('sk_sophia_abc');
      expect(apiKey.permissions).toEqual(['sop:read']);
      expect(apiKey.isActive).toBe(true);
    });
  });

  describe('key-manager', () => {
    it('generates an API key and saves hash to D1', async () => {
      const runMock = vi.fn().mockResolvedValue({ success: true });
      const bindMock = vi.fn().mockReturnValue({ run: runMock });
      const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
      const { getD1 } = await import('@/seed/db/client');
      vi.mocked(getD1).mockResolvedValue({ prepare: prepareMock } as unknown as D1Database);

      const result = await generateApiKey('user_123', 'My Key', ['sop:execute']);
      expect(result.rawKey).toMatch(/^sk_sophia_/);
      expect(result.keyPrefix).toBe(result.rawKey.slice(0, 12));
      expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO api_keys'));
      expect(runMock).toHaveBeenCalled();
    });

    it('validates an active non-expired API key', async () => {
      const row = {
        id: 'k2',
        user_id: 'u2',
        key_hash: 'abc',
        key_prefix: 'sk_sophia_123',
        name: 'Valid Key',
        permissions_json: JSON.stringify(['sop:read']),
        rate_limit_rpm: 60,
        is_active: 1,
        expires_at: Math.floor(Date.now() / 1000) + 10000,
        created_at: 1600000000,
      };
      const firstMock = vi.fn().mockResolvedValue(row);
      const touchRun = vi.fn().mockResolvedValue({ success: true });
      const touchBind = vi.fn().mockReturnValue({ run: touchRun, catch: vi.fn() });
      const prepareMock = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return { bind: vi.fn().mockReturnValue({ first: firstMock }) };
        }
        return { bind: touchBind };
      });
      const { getD1 } = await import('@/seed/db/client');
      vi.mocked(getD1).mockResolvedValue({ prepare: prepareMock } as unknown as D1Database);

      const key = await validateApiKey('any_raw_key');
      expect(key).not.toBeNull();
      expect(key?.id).toBe('k2');
      expect(key?.userId).toBe('u2');
    });

    it('revokes an API key by setting is_active = 0', async () => {
      const runMock = vi.fn().mockResolvedValue({ success: true });
      const bindMock = vi.fn().mockReturnValue({ run: runMock });
      const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
      const { getD1 } = await import('@/seed/db/client');
      vi.mocked(getD1).mockResolvedValue({ prepare: prepareMock } as unknown as D1Database);

      await revokeApiKey('k1');
      expect(prepareMock).toHaveBeenCalledWith('UPDATE api_keys SET is_active = 0 WHERE id = ?');
      expect(bindMock).toHaveBeenCalledWith('k1');
      expect(runMock).toHaveBeenCalled();
    });
  });

  describe('rate-limiter and request-logger', () => {
    it('allows requests within rate limit', async () => {
      const prepareMock = vi.fn().mockImplementation((query: string) => {
        if (query.includes('rate_limit_rpm')) {
          return { bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({ rate_limit_rpm: 60 }) }) };
        }
        return { bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({ cnt: 10 }) }) };
      });
      const { getD1 } = await import('@/seed/db/client');
      vi.mocked(getD1).mockResolvedValue({ prepare: prepareMock } as unknown as D1Database);

      const result = await checkRateLimit('k1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(50);
    });

    it('logs an API request to D1 without throwing', async () => {
      const runMock = vi.fn().mockResolvedValue({ success: true });
      const bindMock = vi.fn().mockReturnValue({ run: runMock });
      const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
      const { getD1 } = await import('@/seed/db/client');
      vi.mocked(getD1).mockResolvedValue({ prepare: prepareMock } as unknown as D1Database);

      await expect(
        logApiRequest({
          apiKeyId: 'k1',
          endpoint: '/api/v1/agent',
          method: 'POST',
          statusCode: 200,
          durationMs: 45,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
