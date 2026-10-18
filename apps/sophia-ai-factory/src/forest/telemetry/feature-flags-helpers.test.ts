import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as circuitBreaker from '@/seed/security/circuit-breaker';
import { logger } from '@/seed/utils/logger-utility';
import { CACHE_TTL_SECONDS, getAllFlags, getKv, POSTHOG_DECIDE_URL } from './feature-flags-helpers';

function setKv(get: ReturnType<typeof vi.fn>, put = vi.fn().mockResolvedValue(undefined)) {
  const namespace = { get, put } as unknown as KVNamespace;
  (globalThis as Record<string, unknown>).EXPERIMENT_KV = namespace;
  return namespace;
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('feature flag bulk helpers', () => {
  beforeEach(() => {
    vi.stubEnv('POSTHOG_PROJECT_KEY', 'project-key');
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(circuitBreaker, 'shouldAllowRequest').mockReturnValue(true);
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).EXPERIMENT_KV;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null when no KV binding exists and reuses cached flag maps', async () => {
    expect(getKv()).toBeNull();
    const kv = setKv(vi.fn().mockResolvedValue(JSON.stringify({ experiment: 'treatment' })));
    expect(getKv()).toBe(kv);
    await expect(getAllFlags('user-1')).resolves.toEqual({ experiment: 'treatment' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('ignores malformed or unavailable cache data, then fetches and caches flags', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(okResponse({ featureFlags: { experiment: true } }));
    const put = vi.fn().mockRejectedValue(new Error('KV write failed'));
    setKv(vi.fn().mockResolvedValueOnce('{bad-json').mockRejectedValueOnce(new Error('KV read failed')), put);

    await expect(getAllFlags('user-2')).resolves.toEqual({ experiment: true });
    expect(fetchMock).toHaveBeenCalledWith(POSTHOG_DECIDE_URL, expect.objectContaining({ method: 'POST' }));
    expect(put).toHaveBeenCalledWith('flags:all:user-2', '{"experiment":true}', {
      expirationTtl: CACHE_TTL_SECONDS,
    });
    await Promise.resolve();
  });

  it('returns empty flags without a key or when the circuit breaker is open', async () => {
    vi.stubEnv('POSTHOG_PROJECT_KEY', '');
    await expect(getAllFlags('user-3')).resolves.toEqual({});
    vi.stubEnv('POSTHOG_PROJECT_KEY', 'project-key');
    vi.spyOn(circuitBreaker, 'shouldAllowRequest').mockReturnValue(false);
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    await expect(getAllFlags('user-4')).resolves.toEqual({});
    expect(warn).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('handles empty successful payloads, non-OK responses, and fetch failures', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okResponse({}))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockRejectedValueOnce(new Error('network down'));

    await expect(getAllFlags('user-5')).resolves.toEqual({});
    await expect(getAllFlags('user-6')).resolves.toEqual({});
    await expect(getAllFlags('user-7')).resolves.toEqual({});
  });
});
