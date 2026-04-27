/**
 * Tests for GET /api/cron/wallet-rebuild
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/utils/to-error', () => ({
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

vi.mock('@/lib/wallet/wallet-rebuilder', () => ({
  rebuildAllWallets: vi.fn(),
}));

import { GET } from './route';
import { rebuildAllWallets } from '@/lib/wallet/wallet-rebuilder';
import { NextRequest } from 'next/server';

const mockRebuildAllWallets = vi.mocked(rebuildAllWallets);

function makeRequest(headers: Record<string, string> = {}, params = ''): NextRequest {
  return new NextRequest(`https://sophia.agencyos.network/api/cron/wallet-rebuild${params}`, {
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRebuildAllWallets.mockResolvedValue({ count: 5 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/cron/wallet-rebuild', () => {
  describe('auth: CRON_SECRET set', () => {
    beforeEach(() => {
      vi.stubEnv('CRON_SECRET', 'test-secret');
    });

    it('returns 401 when no auth header provided', async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      expect(rebuildAllWallets).not.toHaveBeenCalled();
    });

    it('returns 401 for wrong Bearer token', async () => {
      const res = await GET(makeRequest({ authorization: 'Bearer wrong-token' }));
      expect(res.status).toBe(401);
    });

    it('returns 200 for valid Bearer token', async () => {
      const res = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
      const data = await res.json() as { ok: boolean; count: number };

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.count).toBe(5);
    });

    it('returns 200 for valid x-cron-secret header', async () => {
      const res = await GET(makeRequest({ 'x-cron-secret': 'test-secret' }));
      expect(res.status).toBe(200);
    });

    it('calls rebuildAllWallets service', async () => {
      await GET(makeRequest({ authorization: 'Bearer test-secret' }));
      expect(rebuildAllWallets).toHaveBeenCalledOnce();
    });
  });

  describe('auth: CRON_SECRET unset (auth fails open)', () => {
    it('returns 200 without any auth header when CRON_SECRET unset', async () => {
      vi.stubEnv('CRON_SECRET', '');

      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      expect(rebuildAllWallets).toHaveBeenCalledOnce();
    });
  });

  describe('service errors', () => {
    beforeEach(() => {
      vi.stubEnv('CRON_SECRET', 'test-secret');
    });

    it('returns 500 on service failure', async () => {
      mockRebuildAllWallets.mockRejectedValue(new Error('D1 error'));

      const res = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
      const data = await res.json() as { error: string };

      expect(res.status).toBe(500);
      expect(data.error).toBe('Wallet rebuild failed');
    });
  });
});
