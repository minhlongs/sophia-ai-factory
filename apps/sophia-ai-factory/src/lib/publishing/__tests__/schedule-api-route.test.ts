/**
 * Tests for POST /api/publish/schedule
 * Auth-boundary tests only (mock injection is reliable for these cases).
 * Full integration tests covered in per-channel-quota and scheduler unit tests.
 */

import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  schedulePublish: vi.fn().mockResolvedValue({ jobIds: ['j1', 'j2'], quotaBlocked: [] }),
  getCurrentUserFromHeaders: vi.fn().mockResolvedValue({ id: 'u1', email: 'u@test.com' }),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/seed/utils/logger-utility', () => ({ logger: mocks.logger }));
vi.mock('@/forest/publishing/scheduler', () => ({ schedulePublish: mocks.schedulePublish }));
vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUserFromHeaders: mocks.getCurrentUserFromHeaders }));

import { POST } from '@/app/api/publish/schedule/route';

const VALID_JOB_ID = '00000000-0000-0000-0000-000000000001';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/publish/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/publish/schedule — auth & validation', () => {
  it('returns 401 when not authenticated', async () => {
    mocks.getCurrentUserFromHeaders.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({
      videoJobId: VALID_JOB_ID,
      channels: ['ch1'],
      caption: 'cap',
      hashtags: [],
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing videoJobId', async () => {
    const res = await POST(makeRequest({ channels: ['ch1'], caption: 'hi', hashtags: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid UUID videoJobId', async () => {
    const res = await POST(makeRequest({
      videoJobId: 'not-a-uuid',
      channels: ['ch1'],
      caption: 'hi',
      hashtags: [],
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty channels array', async () => {
    const res = await POST(makeRequest({
      videoJobId: VALID_JOB_ID,
      channels: [],
      caption: 'cap',
      hashtags: [],
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing caption', async () => {
    const res = await POST(makeRequest({
      videoJobId: VALID_JOB_ID,
      channels: ['ch1'],
      hashtags: [],
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid productLink URL', async () => {
    const res = await POST(makeRequest({
      videoJobId: VALID_JOB_ID,
      channels: ['ch1'],
      caption: 'cap',
      hashtags: [],
      productLink: 'not-a-url',
    }));
    expect(res.status).toBe(400);
  });
});
