/**
 * Tests for Coinbase Advanced Trade affiliate scout client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coinbaseClient } from '../client-coinbase';
import type { ScoutEnv } from '../types';

const BASE_ENV: ScoutEnv = {};

describe('coinbaseClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array when no credentials provided (zero-mock production policy)', async () => {
    const result = await coinbaseClient.fetch(BASE_ENV, 'tenant-1');
    expect(result).toEqual([]);
  });

  it('returns empty array when BYOK credentialsOverride is empty', async () => {
    const result = await coinbaseClient.fetch(BASE_ENV, 'tenant-1', {});
    expect(result).toEqual([]);
  });

  it('returns empty array when account verification fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false }));
    const env: ScoutEnv = { COINBASE_API_KEY: 'key', COINBASE_API_SECRET: 'secret' };
    expect(await coinbaseClient.fetch(env, 'tenant-1')).toEqual([]);
  });

  it('returns single affiliate on successful account verify + portfolio fetch', async () => {
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        n++;
        if (n === 1) {
          return Promise.resolve({
            status: 200,
            ok: true,
            json: async () => ({ accounts: [{ uuid: 'ACC001' }] }),
          });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          json: async () => ({
            portfolios: [
              { name: 'Other', type: 'CONSUMER' },
              { name: 'My Default', type: 'DEFAULT' },
            ],
          }),
        });
      }),
    );
    const env: ScoutEnv = { COINBASE_API_KEY: 'key', COINBASE_API_SECRET: 'secret' };
    const result = await coinbaseClient.fetch(env, 'tenant-1');
    expect(result.length).toBe(1);
    expect(result[0].productName).toBe('My Default');
    expect(result[0].network).toBe('coinbase');
    expect(result[0].kycRequired).toBe(true);
    expect(result[0].externalId).toBe('coinbase-tenant-1');
  });

  it('still returns affiliate if portfolio fetch fails', async () => {
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        n++;
        if (n === 1) {
          return Promise.resolve({
            status: 200,
            ok: true,
            json: async () => ({ accounts: [{}] }),
          });
        }
        return Promise.reject(new Error('portfolios unavailable'));
      }),
    );
    const env: ScoutEnv = { COINBASE_API_KEY: 'key', COINBASE_API_SECRET: 'secret' };
    const result = await coinbaseClient.fetch(env, 'tenant-1');
    expect(result.length).toBe(1);
    expect(result[0].network).toBe('coinbase');
  });

  it('prefers BYOK credentialsOverride over env keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ accounts: [{}] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await coinbaseClient.fetch(
      { COINBASE_API_KEY: 'env-key', COINBASE_API_SECRET: 'env-secret' },
      'tenant-1',
      { api_key: 'byok-key', api_secret: 'byok-secret' },
    );
    expect(fetchMock.mock.calls[0][1]?.headers?.['CB-ACCESS-KEY']).toBe('byok-key');
  });

  it('returns empty array on fetch network error (zero-mock fallback)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const env: ScoutEnv = { COINBASE_API_KEY: 'key', COINBASE_API_SECRET: 'secret' };
    const result = await coinbaseClient.fetch(env, 'tenant-1');
    expect(result).toEqual([]);
  });
});
