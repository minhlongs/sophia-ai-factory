/**
 * Tests for GET /api/setup/local-mode/status
 *
 * Covers: 401 no auth, not provisioned, provisioned + healthy signal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

interface StatusBody {
  provisioned?: boolean;
  endpoint_hostname?: string | null;
  last_health_at?: string | null;
  status?: string;
  error?: string;
}

// Helper to get the D1 mock set up in test/setup.tsx
function getD1Mock() {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  return env.DB as { prepare: ReturnType<typeof vi.fn> };
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/setup/local-mode/status', { headers });
}

describe('GET /api/setup/local-mode/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue(null);

    const res = await GET(makeRequest());
    const body = await res.json() as StatusBody;

    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns provisioned:false when user has no local_mode_endpoint', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });

    const d1 = getD1Mock();
    // first() returns null — user row has no endpoint
    d1.prepare.mockReturnValueOnce({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ local_mode_endpoint: null }),
      }),
    });

    const res = await GET(makeRequest());
    const body = await res.json() as StatusBody;

    expect(res.status).toBe(200);
    expect(body.provisioned).toBe(false);
    expect(body.endpoint_hostname).toBeNull();
    expect(body.status).toBe('unknown');
  });

  it('returns provisioned:true with status:healthy for recent healthy signal', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({
      id: 'user-2',
      email: 'user@example.com',
    });

    const d1 = getD1Mock();
    const recentTs = Date.now() - 60_000; // 1 minute ago → healthy

    // Call 1: users table
    d1.prepare
      .mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ local_mode_endpoint: 'http://localhost:4002' }),
        }),
      })
      // Call 2: signals_events table
      .mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ event_type: 'local_mode_healthy', ts: recentTs }),
        }),
      });

    const res = await GET(makeRequest());
    const body = await res.json() as StatusBody;

    expect(res.status).toBe(200);
    expect(body.provisioned).toBe(true);
    expect(body.endpoint_hostname).toBe('localhost');
    expect(body.status).toBe('healthy');
    expect(body.last_health_at).toBeTruthy();
  });

  it('returns status:failed when latest signal is local_mode_unhealthy', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({
      id: 'user-3',
      email: 'user@example.com',
    });

    const d1 = getD1Mock();

    d1.prepare
      .mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ local_mode_endpoint: 'http://m1max.local:4002' }),
        }),
      })
      .mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ event_type: 'local_mode_unhealthy', ts: Date.now() - 1000 }),
        }),
      });

    const res = await GET(makeRequest());
    const body = await res.json() as StatusBody;

    expect(body.provisioned).toBe(true);
    expect(body.status).toBe('failed');
  });

  it('returns status:stale when signal is older than 5 min but under 60 min', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({
      id: 'user-4',
      email: 'user@example.com',
    });

    const d1 = getD1Mock();
    const staleTs = Date.now() - 10 * 60 * 1000; // 10 min ago

    d1.prepare
      .mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ local_mode_endpoint: 'http://localhost:4002' }),
        }),
      })
      .mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ event_type: 'local_mode_healthy', ts: staleTs }),
        }),
      });

    const res = await GET(makeRequest());
    const body = await res.json() as StatusBody;

    expect(body.status).toBe('stale');
  });
});
