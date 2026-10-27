/**
 * Tests for Bybit affiliate scout client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bybitClient } from '../client-bybit';
import type { ScoutEnv } from '../types';

const BASE_ENV: ScoutEnv = {};

describe('bybitClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array when no credentials provided (zero-mock production policy)', async () => {
    const result = await bybitClient.fetch(BASE_ENV, 'tenant-1');
    expect(result).toEqual([]);
  });

  it('returns empty array when BYOK credentialsOverride is empty', async () => {
    const result = await bybitClient.fetch(BASE_ENV, 'tenant-1', {});
    expect(result).toEqual([]);
  });

  it('returns empty array when retCode is not 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ retCode: 10001, retMsg: 'Not authorized', result: {} }),
      }),
    );
    const env: ScoutEnv = { BYBIT_API_KEY: 'key', BYBIT_API_SECRET: 'secret' };
    expect(await bybitClient.fetch(env, 'tenant-1')).toEqual([]);
  });

  it('returns empty array on non-OK HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 403, ok: false }));
    const env: ScoutEnv = { BYBIT_API_KEY: 'key', BYBIT_API_SECRET: 'secret' };
    expect(await bybitClient.fetch(env, 'tenant-1')).toEqual([]);
  });

  it('maps API response to affiliate fields without fabricating EPC', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          retCode: 0,
          result: {
            list: [
              {
                userId: 'U999',
                commissionRate: '0.30',
                tradeVolume: '20000000',
                kycLevel: '2',
              },
            ],
          },
        }),
      }),
    );
    const env: ScoutEnv = { BYBIT_API_KEY: 'key', BYBIT_API_SECRET: 'secret' };
    const result = await bybitClient.fetch(env, 'tenant-1');
    expect(result.length).toBe(1);
    expect(result[0].commissionPct).toBeCloseTo(30);
    expect(result[0].cryptoVolumeUsd).toBe(20000000);
    expect(result[0].kycRequired).toBe(true);
    expect(result[0].domain).toBe('bybit.com');
    expect(result[0].epc).toBeUndefined();
  });

  it('handles kycLevel 0 correctly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          retCode: 0,
          result: {
            list: [{ userId: 'U888', commissionRate: '0.25', tradeVolume: '0', kycLevel: '0' }],
          },
        }),
      }),
    );
    const env: ScoutEnv = { BYBIT_API_KEY: 'key', BYBIT_API_SECRET: 'secret' };
    const result = await bybitClient.fetch(env, 'tenant-1');
    expect(result[0].kycRequired).toBe(false);
  });

  it('prefers BYOK credentialsOverride over env keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ retCode: 0, result: { list: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await bybitClient.fetch(
      { BYBIT_API_KEY: 'env-key', BYBIT_API_SECRET: 'env-secret' },
      'tenant-1',
      { api_key: 'byok-key', api_secret: 'byok-secret' },
    );
    expect(fetchMock.mock.calls[0][1]?.headers?.['X-BAPI-API-KEY']).toBe('byok-key');
  });

  it('returns empty array on fetch network error (zero-mock fallback)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network timeout')));
    const env: ScoutEnv = { BYBIT_API_KEY: 'key', BYBIT_API_SECRET: 'secret' };
    const result = await bybitClient.fetch(env, 'tenant-1');
    expect(result).toEqual([]);
  });
});
