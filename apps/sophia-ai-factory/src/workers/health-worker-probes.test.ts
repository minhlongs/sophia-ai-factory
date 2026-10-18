import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './health-worker';
import { checkEnvConfigs, checkRateLimit, probeD1, probeKV, probeR2 } from './health-worker-probes';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('checkRateLimit', () => {
  it('allows exactly 300 requests, rejects the next one, then resets after the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const key = 'health-probe-rate-limit-boundary';

    for (let request = 0; request < 300; request += 1) {
      expect(checkRateLimit(key)).toBe(true);
    }
    expect(checkRateLimit(key)).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(checkRateLimit(key)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(checkRateLimit(key)).toBe(true);
  });

  it('starts a fresh window for a new key', () => {
    expect(checkRateLimit('health-probe-rate-limit-independent-key')).toBe(true);
  });
});

describe('probeD1', () => {
  it('treats an absent binding as healthy without adding service detail', async () => {
    const services: Record<string, unknown> = {};

    await expect(probeD1(undefined, true, services)).resolves.toBe('healthy');
    expect(services).toEqual({});
  });

  it('reports authorized success latency but keeps successful checks private when unauthorized', async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const db = { prepare: vi.fn().mockReturnValue({ run }) } as unknown as D1Database;
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(107);
    const authorizedServices: Record<string, unknown> = {};

    await expect(probeD1(db, true, authorizedServices)).resolves.toBe('healthy');
    expect(db.prepare).toHaveBeenCalledWith('SELECT 1');
    expect(run).toHaveBeenCalledOnce();
    expect(authorizedServices).toEqual({ d1: { status: 'up', latency: 7 } });

    const privateServices: Record<string, unknown> = {};
    await expect(probeD1(db, false, privateServices)).resolves.toBe('healthy');
    expect(privateServices).toEqual({});
  });

  it('returns degraded on query errors and exposes the error only to authorized callers', async () => {
    const db = { prepare: vi.fn().mockReturnValue({ run: vi.fn().mockRejectedValue(new Error('database down')) }) } as unknown as D1Database;
    const authorizedServices: Record<string, unknown> = {};
    const privateServices: Record<string, unknown> = {};

    await expect(probeD1(db, true, authorizedServices)).resolves.toBe('degraded');
    await expect(probeD1(db, false, privateServices)).resolves.toBe('degraded');
    expect(authorizedServices).toEqual({ d1: { status: 'down', error: 'Error: database down' } });
    expect(privateServices).toEqual({});
  });
});

describe('probeR2', () => {
  it('treats an absent bucket as healthy and records latency only for authorized checks', async () => {
    await expect(probeR2(undefined, true, {})).resolves.toBe('healthy');
    const head = vi.fn().mockResolvedValue({ key: 'health-check.txt' });
    const bucket = { head } as unknown as R2Bucket;
    const services: Record<string, unknown> = {};

    await expect(probeR2(bucket, true, services)).resolves.toBe('healthy');
    expect(head).toHaveBeenCalledWith('health-check.txt');
    expect(services.r2).toMatchObject({ status: 'up' });

    const privateServices: Record<string, unknown> = {};
    await expect(probeR2(bucket, false, privateServices)).resolves.toBe('healthy');
    expect(privateServices).toEqual({});
  });

  it('returns degraded and omits error details when head fails', async () => {
    const bucket = { head: vi.fn().mockRejectedValue(new Error('storage unavailable')) } as unknown as R2Bucket;
    const services: Record<string, unknown> = {};

    await expect(probeR2(bucket, true, services)).resolves.toBe('degraded');
    expect(services).toEqual({ r2: { status: 'down' } });
  });
});

describe('probeKV', () => {
  it('treats an absent binding as healthy and records a successful ping for authorized callers', async () => {
    await expect(probeKV(undefined, true, {})).resolves.toBe('healthy');
    const get = vi.fn().mockResolvedValue('pong');
    const kv = { get } as unknown as KVNamespace;
    const services: Record<string, unknown> = {};

    await expect(probeKV(kv, true, services)).resolves.toBe('healthy');
    expect(get).toHaveBeenCalledWith('health:ping');
    expect(services.kv).toMatchObject({ status: 'up' });
  });

  it('returns degraded on get errors without disclosing error text', async () => {
    const kv = { get: vi.fn().mockRejectedValue(new Error('kv unavailable')) } as unknown as KVNamespace;
    const services: Record<string, unknown> = {};

    await expect(probeKV(kv, true, services)).resolves.toBe('degraded');
    expect(services).toEqual({ kv: { status: 'down' } });
  });
});

describe('checkEnvConfigs', () => {
  it('reports configured and missing status for every supported service binding', () => {
    const env: Env = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://db.example',
      UPSTASH_REDIS_REST_URL: '',
      OPENROUTER_API_KEY: 'configured-key',
      HEYGEN_API_KEY: 'configured-key',
      TELEGRAM_BOT_TOKEN: 'configured-token',
      INNGEST_EVENT_KEY: 'configured-key',
    };
    const services: Record<string, unknown> = {};

    checkEnvConfigs(env, services);

    expect(services).toEqual({
      supabase: { status: 'configured' },
      redis: { status: 'missing_config' },
      openrouter: { status: 'configured' },
      elevenlabs: { status: 'missing_config' },
      heygen: { status: 'configured' },
      telegram: { status: 'configured' },
      sentry: { status: 'missing_config' },
      inngest: { status: 'configured' },
    });
  });
});
