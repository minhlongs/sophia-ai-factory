import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuth: vi.fn(),
  headers: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock('@/seed/auth/better-auth-server', () => ({
  getAuth: mocks.getAuth,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { getCurrentUserFromHeaders, getSession } from './better-auth-session';

describe('better-auth-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSession returns null without touching Better Auth when no credential headers exist', async () => {
    mocks.headers.mockResolvedValue(new Headers());

    await expect(getSession()).resolves.toBeNull();

    expect(mocks.getAuth).not.toHaveBeenCalled();
  });

  it('getCurrentUserFromHeaders returns null without touching Better Auth when no credentials exist', async () => {
    await expect(getCurrentUserFromHeaders(new Headers())).resolves.toBeNull();

    expect(mocks.getAuth).not.toHaveBeenCalled();
  });

  it('getCurrentUserFromHeaders calls Better Auth when credentials exist', async () => {
    const getSessionMock = vi.fn().mockResolvedValue({
      user: { id: 'user-1', email: 'u@example.com', name: 'User', image: null, role: 'admin' },
    });
    mocks.getAuth.mockReturnValue({ api: { getSession: getSessionMock } });

    const headers = new Headers({ cookie: 'better-auth.session_token=abc' });
    const user = await getCurrentUserFromHeaders(headers);

    expect(user).toMatchObject({ id: 'user-1', email: 'u@example.com', role: 'admin' });
    expect(getSessionMock).toHaveBeenCalledWith({ headers });
  });
});
