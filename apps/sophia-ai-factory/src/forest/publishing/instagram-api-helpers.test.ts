import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  shouldAllowRequest: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  classifyError: vi.fn((error: unknown) => error instanceof Error ? 'network_error' : 'unknown_error'),
  classifyHttpStatus: vi.fn((status: number) => `http_${status}`),
}));

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: mocks.shouldAllowRequest,
  recordSuccess: mocks.recordSuccess,
  recordFailure: mocks.recordFailure,
}));
vi.mock('@/seed/types/failure-kind', () => ({
  classifyError: mocks.classifyError,
  classifyHttpStatus: mocks.classifyHttpStatus,
}));

import {
  IG_API,
  IG_SERVICE_NAME,
  checkInstagramMediaStatus,
  pollInstagramContainerReady,
  refreshInstagramAccessToken,
} from './instagram-api-helpers';

describe('Instagram API helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldAllowRequest.mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('polls a container until processing finishes', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ status_code: 'IN_PROGRESS' }))
      .mockResolvedValueOnce(Response.json({ status_code: 'FINISHED' }));
    const pending = pollInstagramContainerReady('container-1', 'token-1');

    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(`${IG_API}/container-1`);
  });

  it('fails immediately when a container reports processing error', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ status_code: 'ERROR' }));

    await expect(pollInstagramContainerReady('container-2', 'token-2'))
      .rejects.toThrow('Instagram container processing failed');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a container that never reaches a terminal state', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(async () => Response.json({ status_code: 'IN_PROGRESS' }));
    const pending = pollInstagramContainerReady('container-3', 'token-3');

    const rejection = expect(pending).rejects.toThrow('Instagram container processing timeout');
    await vi.runAllTimersAsync();
    await rejection;

    expect(fetch).toHaveBeenCalledTimes(30);
  });

  it('returns a failed state without network work when the circuit is open', async () => {
    mocks.shouldAllowRequest.mockReturnValue(false);

    await expect(checkInstagramMediaStatus('token', 'media-1')).resolves.toEqual({
      status: 'failed', error: `[circuit-breaker] Circuit open for ${IG_SERVICE_NAME}`,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('classifies HTTP failures and strips the account prefix from media tokens', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('unavailable', { status: 503 }));

    await expect(checkInstagramMediaStatus('account:secret-token', 'media-2')).resolves.toEqual({
      status: 'failed', error: 'Instagram API 503',
    });

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('access_token=secret-token');
    expect(mocks.classifyHttpStatus).toHaveBeenCalledWith(503);
    expect(mocks.recordFailure).toHaveBeenCalledWith(IG_SERVICE_NAME, 'http_503');
  });

  it.each([
    ['FINISHED', { status: 'published' }],
    [undefined, { status: 'published' }],
    ['ERROR', { status: 'failed', error: 'Media processing error' }],
    ['IN_PROGRESS', { status: 'processing' }],
  ] as const)('maps media status %s', async (statusCode, expected) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(statusCode ? { status_code: statusCode } : {}));

    await expect(checkInstagramMediaStatus('plain-token', 'media-3')).resolves.toEqual(expected);
    expect(mocks.recordSuccess).toHaveBeenCalledWith(IG_SERVICE_NAME);
  });

  it('returns a classified failure when media status fetch throws', async () => {
    const networkError = new Error('connection reset');
    vi.mocked(fetch).mockRejectedValue(networkError);

    await expect(checkInstagramMediaStatus('token', 'media-4')).resolves.toEqual({
      status: 'failed', error: 'network_error',
    });
    expect(mocks.recordFailure).toHaveBeenCalledWith(IG_SERVICE_NAME, 'network_error');
  });

  it('refreshes an access token and returns the expiry', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ access_token: 'new-token', expires_in: 3_600 }));

    await expect(refreshInstagramAccessToken('client-id', 'unused-secret', 'old-token')).resolves.toEqual({
      accessToken: 'new-token', expiresIn: 3_600,
    });

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain(`${IG_API}/oauth/access_token`);
    expect(url).toContain('client_id=client-id');
    expect(url).toContain('fb_exchange_token=old-token');
    expect(url).not.toContain('unused-secret');
    expect(mocks.recordSuccess).toHaveBeenCalledWith(IG_SERVICE_NAME);
  });

  it('surfaces token refresh HTTP errors and records failures', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('invalid grant', { status: 400 }));

    await expect(refreshInstagramAccessToken('client-id', 'secret', 'bad-token'))
      .rejects.toThrow('Instagram token refresh failed: 400 invalid grant');
    expect(mocks.recordFailure).toHaveBeenCalledWith(IG_SERVICE_NAME, 'http_400');
    expect(mocks.classifyError).toHaveBeenCalled();
  });

  it('rejects token refresh before fetching when the circuit is open', async () => {
    mocks.shouldAllowRequest.mockReturnValue(false);

    await expect(refreshInstagramAccessToken('client-id', 'secret', 'token'))
      .rejects.toThrow(`[circuit-breaker] Circuit open for ${IG_SERVICE_NAME}`);
    expect(fetch).not.toHaveBeenCalled();
  });
});
