import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/byok/user-api-key-store', () => ({
  listUserApiKeyProviders: vi.fn(),
}));

import { getCurrentUser } from '@/lib/better-auth-session';
import { listUserApiKeyProviders } from '@/lib/byok/user-api-key-store';
import { GET } from './route';

describe('GET /api/health/byok', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json() as Record<string, string>;

    expect(response.status).toBe(401);
    expect(data.error).toBe('unauthorized');
  });

  it('returns provider list for authenticated user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-123', email: 'test@test.com' } as never);
    vi.mocked(listUserApiKeyProviders).mockResolvedValue(['openrouter', 'anthropic'] as never);

    const response = await GET();
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.user_id).toBe('user-123');
    expect(data.providers).toEqual(['openrouter', 'anthropic']);
    expect(data.provider_count).toBe(2);
    expect(typeof data.last_updated).toBe('string');
  });

  it('returns empty providers when user has none configured', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-456', email: 'empty@test.com' } as never);
    vi.mocked(listUserApiKeyProviders).mockResolvedValue([]);

    const response = await GET();
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.providers).toEqual([]);
    expect(data.provider_count).toBe(0);
  });

  it('calls listUserApiKeyProviders with the authenticated user id', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-789', email: 'x@x.com' } as never);
    vi.mocked(listUserApiKeyProviders).mockResolvedValue([]);

    await GET();

    expect(listUserApiKeyProviders).toHaveBeenCalledWith('user-789');
  });
});
