/**
 * Tests for Binance affiliate scout client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { binanceClient } from '../client-binance';
import type { ScoutEnv } from '../types';

const BASE_ENV: ScoutEnv = {};

describe('binanceClient', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns mock fixture when no credentials provided', async () => {
    const result = await binanceClient.fetch(BASE_ENV, 'tenant-1');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].network).toBe('binance');
    expect(result[0].externalId).toBeTruthy();
  });

  it('returns mock fixture when BYOK credentialsOverride empty', async () => {
    const result = await binanceClient.fetch(BASE_ENV, 'tenant-1', {});
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].network).toBe('binance');
  });

  it('mock fixture populates cryptoVolumeUsd and kycRequired', async () => {
    const result = await binanceClient.fetch(BASE_ENV, 'tenant-1');
    expect(result[0].cryptoVolumeUsd).toBeTypeOf('number');
    expect(result[0].kycRequired).toBe(true);
    expect(result[0].domain).toBe('binance.com');
  });

  it('returns empty array on 451 region-blocked response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 451, ok: false }));
    const env: ScoutEnv = { BINANCE_API_KEY: 'key', BINANCE_API_SECRET: 'secret' };
    const result = await binanceClient.fetch(env, 'tenant-1');
    expect(result).toEqual([]);
  });

  it('returns empty array on non-OK non-451 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 403, ok: false }));
    const env: ScoutEnv = { BINANCE_API_KEY: 'key', BINANCE_API_SECRET: 'secret' };
    const result = await binanceClient.fetch(env, 'tenant-1');
    expect(result).toEqual([]);
  });

  it('maps API response to affiliate fields correctly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200, ok: true,
      json: async () => ({
        data: [{ commissionRate: '0.35', volume: '50000000', customLink: 'https://binance.com/ref/TEST' }],
      }),
    }));
    const env: ScoutEnv = { BINANCE_API_KEY: 'key', BINANCE_API_SECRET: 'secret' };
    const result = await binanceClient.fetch(env, 'tenant-1');
    expect(result.length).toBe(1);
    expect(result[0].commissionPct).toBeCloseTo(35);
    expect(result[0].cryptoVolumeUsd).toBe(50000000);
    expect(result[0].domain).toBe('binance.com');
    expect(result[0].kycRequired).toBe(true);
  });

  it('handles empty data array from API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200, ok: true, json: async () => ({ data: [] }),
    }));
    const env: ScoutEnv = { BINANCE_API_KEY: 'key', BINANCE_API_SECRET: 'secret' };
    expect(await binanceClient.fetch(env, 'tenant-1')).toEqual([]);
  });

  it('prefers BYOK credentialsOverride over env keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200, ok: true, json: async () => ({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await binanceClient.fetch(
      { BINANCE_API_KEY: 'env-key', BINANCE_API_SECRET: 'env-secret' },
      'tenant-1',
      { api_key: 'byok-key', api_secret: 'byok-secret' },
    );
    expect(fetchMock.mock.calls[0][1]?.headers?.['X-MBX-APIKEY']).toBe('byok-key');
  });

  it('returns mock fixture on fetch network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network timeout')));
    const env: ScoutEnv = { BINANCE_API_KEY: 'key', BINANCE_API_SECRET: 'secret' };
    const result = await binanceClient.fetch(env, 'tenant-1');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].network).toBe('binance');
  });
});
