/**
 * Tests for Coinbase Advanced Trade affiliate scout client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coinbaseClient } from '../client-coinbase';
import type { ScoutEnv } from '../types';

const BASE_ENV: ScoutEnv = {};

describe('coinbaseClient', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns mock fixture when no credentials provided', async () => {
    const result = await coinbaseClient.fetch(BASE_ENV, 'tenant-1');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].network).toBe('coinbase');
  });

  it('returns mock fixture when BYOK credentialsOverride empty', async () => {
    const result = await coinbaseClient.fetch(BASE_ENV, 'tenant-1', {});
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].network).toBe('coinbase');
  });

  it('mock fixture populates scoring fields', async () => {
    const result = await coinbaseClient.fetch(BASE_ENV, 'tenant-1');
    expect(result[0].kycRequired).toBe(true);
    expect(result[0].domain).toBe('coinbase.com');
  });

  it('returns empty array when account verification fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false }));
    const env: ScoutEnv = { COINBASE_API_KEY: 'key', COINBASE_API_SECRET: 'secret' };
    expect(await coinbaseClient.fetch(env, 'tenant-1')).toEqual([]);
  });

  it('returns single affiliate on successful account verify + portfolio fetch', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      n++;
      if (n === 1) return Promise.resolve({ status: 200, ok: true, json: async () => ({ accounts: [{ uuid: 'ACC001' }] }) });
      return Promise.resolve({
        status: 200, ok: true,
        json: async () => ({ portfolios: [{ name: 'Other', type: 'CONSUMER' }, { name: 'My Default', type: 'DEFAULT' }] }),
      });
    }));
    const env: ScoutEnv = { COINBASE_API_KEY: 'key', COINBASE_API_SECRET: 'secret' };
    const result = await coinbaseClient.fetch(env, 'tenant-1');
    expect(result.length).toBe(1);
    expect(result[0].productName).toBe('My Default');
    expect(result[0].network).toBe('coinbase');
    expect(result[0].kycRequired).toBe(true);
  });

  it('still returns affiliate if portfolio fetch fails', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      n++;
      if (n === 1) return Promise.resolve({ status: 200, ok: true, json: async () => ({ accounts: [{}] }) });
      return Promise.reject(new Error('portfolios unavailable'));
    }));
    const env: ScoutEnv = { COINBASE_API_KEY: 'key', COINBASE_API_SECRET: 'secret' };
    const result = await coinbaseClient.fetch(env, 'tenant-1');
    expect(result.length).toBe(1);
    expect(result[0].network).toBe('coinbase');
  });

  it('prefers BYOK credentialsOverride over env keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200, ok: true, json: async () => ({ accounts: [{}] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await coinbaseClient.fetch(
      { COINBASE_API_KEY: 'env-key', COINBASE_API_SECRET: 'env-secret' },
      'tenant-1',
      { api_key: 'byok-key', api_secret: 'byok-secret' },
    );
    expect(fetchMock.mock.calls[0][1]?.headers?.['CB-ACCESS-KEY']).toBe('byok-key');
  });

  it('returns mock fixture on fetch network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const env: ScoutEnv = { COINBASE_API_KEY: 'key', COINBASE_API_SECRET: 'secret' };
    const result = await coinbaseClient.fetch(env, 'tenant-1');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].network).toBe('coinbase');
  });

  it('uses externalId with tenant scope', async () => {
    const result = await coinbaseClient.fetch(BASE_ENV, 'tenant-abc');
    expect(result[0].externalId).toContain('coinbase');
  });
});
