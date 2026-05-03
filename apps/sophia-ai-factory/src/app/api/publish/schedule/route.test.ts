/**
 * Route-level smoke tests for POST /api/publish/schedule.
 * Full coverage in src/lib/publishing/__tests__/schedule-api-route.test.ts
 */

import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  schedulePublish: vi.fn().mockResolvedValue({ jobIds: ['j1'], quotaBlocked: [] }),
  getCurrentUserFromHeaders: vi.fn().mockResolvedValue(null),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/seed/utils/logger-utility', () => ({ logger: mocks.logger }));
vi.mock('@/lib/publishing/scheduler', () => ({ schedulePublish: mocks.schedulePublish }));
vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUserFromHeaders: mocks.getCurrentUserFromHeaders }));

import { POST } from './route';

describe('POST /api/publish/schedule — route unit', () => {
  it('returns 401 when unauthenticated', async () => {
    mocks.getCurrentUserFromHeaders.mockResolvedValueOnce(null);
    const res = await POST(new Request('http://localhost/api/publish/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoJobId: '00000000-0000-0000-0000-000000000001', channels: ['ch1'], caption: 'c', hashtags: [] }),
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing channels (validation)', async () => {
    // No auth mock set → returns null → 401, but validation runs if auth passes
    // This test checks validation when user IS authenticated
    mocks.getCurrentUserFromHeaders.mockResolvedValueOnce({ id: 'u1', email: 'u@test.com' });
    const res = await POST(new Request('http://localhost/api/publish/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoJobId: '00000000-0000-0000-0000-000000000001', caption: 'c', hashtags: [] }),
    }));
    expect(res.status).toBe(400);
  });
});
