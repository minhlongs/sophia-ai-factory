/**
 * Tests for Bitget affiliate scout client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bitgetClient } from '../client-bitget';
import type { ScoutEnv } from '../types';

const BASE_ENV: ScoutEnv = {};

describe('bitgetClient', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns mock fixture when no credentials provided', async () => {
    const result = await bitgetClient.fetch(BASE_ENV, 'tenant-1');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].network).toBe('bitget');
  });

  it('returns mock fixture when passphrase missing', async () => {
    const env: ScoutEnv = { BITGET_API_KEY: 'key', BITGET_API_SECRET: 'secret' };
    const result = await bitgetClient.fetch(env, 'tenant-1');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].network).toBe('bitget');
  });

  it('mock fixture populates scoring fields', async () => {
    const result = await bitgetClient.fetch(BASE_ENV, 'tenant-1');
    expect(result[0].cryptoVolumeUsd).toBeTypeOf('number');
    expect(result[0].kycRequired).toBe(true);
    expect(result[0].domain).toBe('bitget.com');
  });

  it('returns empty array when account verify returns non-00000 code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200, ok: true,
      json: async () => ({ code: '40001', msg: 'ACCESS_KEY does not exist', data: null }),
    }));
    const env: ScoutEnv = { BITGET_API_KEY: 'key', BITGET_API_SECRET: 'secret', BITGET_PASSPHRASE: 'pass' };
    expect(await bitgetClient.fetch(env, 'tenant-1')).toEqual([]);
  });

  it('returns empty array on non-OK HTTP response for verify', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 403, ok: false }));
    const env: ScoutEnv = { BITGET_API_KEY: 'key', BITGET_API_SECRET: 'secret', BITGET_PASSPHRASE: 'pass' };
    expect(await bitgetClient.fetch(env, 'tenant-1')).toEqual([]);
  });

  it('maps affiliate invite list to affiliate fields', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      n++;
      if (n === 1) return Promise.resolve({ status: 200, ok: true, json: async () => ({ code: '00000', data: {} }) });
      return Promise.resolve({
        status: 200, ok: true,
        json: async () => ({ code: '00000', data: { inviteList: [{ uid: 'INV001', commissionRate: '0.40', tradeVolume: '15000000' }] } }),
      });
    }));
    const env: ScoutEnv = { BITGET_API_KEY: 'key', BITGET_API_SECRET: 'secret', BITGET_PASSPHRASE: 'pass' };
    const result = await bitgetClient.fetch(env, 'tenant-1');
    expect(result.length).toBe(1);
    expect(result[0].commissionPct).toBeCloseTo(40);
    expect(result[0].cryptoVolumeUsd).toBe(15000000);
    expect(result[0].domain).toBe('bitget.com');
  });

  it('handles empty inviteList from API', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      n++;
      if (n === 1) return Promise.resolve({ status: 200, ok: true, json: async () => ({ code: '00000', data: {} }) });
      return Promise.resolve({ status: 200, ok: true, json: async () => ({ code: '00000', data: { inviteList: [] } }) });
    }));
    const env: ScoutEnv = { BITGET_API_KEY: 'key', BITGET_API_SECRET: 'secret', BITGET_PASSPHRASE: 'pass' };
    expect(await bitgetClient.fetch(env, 'tenant-1')).toEqual([]);
  });

  it('prefers BYOK credentialsOverride over env keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200, ok: true, json: async () => ({ code: '00000', data: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await bitgetClient.fetch(
      { BITGET_API_KEY: 'env-key', BITGET_API_SECRET: 'env-secret', BITGET_PASSPHRASE: 'env-pass' },
      'tenant-1',
      { api_key: 'byok-key', api_secret: 'byok-secret', passphrase: 'byok-pass' },
    );
    expect(fetchMock.mock.calls[0][1]?.headers?.['ACCESS-KEY']).toBe('byok-key');
  });

  it('returns mock fixture on fetch network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const env: ScoutEnv = { BITGET_API_KEY: 'key', BITGET_API_SECRET: 'secret', BITGET_PASSPHRASE: 'pass' };
    const result = await bitgetClient.fetch(env, 'tenant-1');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].network).toBe('bitget');
  });
});
