import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuth: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock('@/seed/auth/better-auth-server', () => ({
  getAuth: mocks.getAuth,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: mocks.loggerError,
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

  it('logs explicit errorName on getCurrentUserFromHeaders failure for minified custom Error and non-Error throws', async () => {
    class e extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'D1AuthTimeoutError';
      }
    }

    mocks.getAuth.mockRejectedValueOnce(new e('timeout'));
    const headers = new Headers({ cookie: 'better-auth.session_token=abc' });
    await expect(getCurrentUserFromHeaders(headers)).rejects.toThrow('timeout');
    expect(mocks.loggerError).toHaveBeenCalledWith(
      '[better-auth-session] getSessionFromHeaders failed',
      expect.any(Error),
      expect.objectContaining({ errorName: 'D1AuthTimeoutError' }),
    );

    mocks.getAuth.mockRejectedValueOnce('string-failure');
    await expect(getCurrentUserFromHeaders(headers)).rejects.toThrow('string-failure');
    expect(mocks.loggerError).toHaveBeenCalledWith(
      '[better-auth-session] getSessionFromHeaders failed',
      expect.any(Error),
      expect.objectContaining({ errorName: 'string' }),
    );
  });

  it('logs errorName safely on getSession failure for both Error and non-Error throws', async () => {
    mocks.headers.mockResolvedValue(new Headers({ cookie: 'better-auth.session_token=abc' }));
    mocks.getAuth.mockRejectedValueOnce(new TypeError('bad header'));
    await expect(getSession()).resolves.toBeNull();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      '[better-auth-session] getSession failed',
      expect.any(Error),
      expect.objectContaining({ errorName: 'TypeError' }),
    );

    mocks.getAuth.mockRejectedValueOnce('raw-error');
    await expect(getSession()).resolves.toBeNull();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      '[better-auth-session] getSession failed',
      expect.any(Error),
      expect.objectContaining({ errorName: 'string' }),
    );
  });
});
