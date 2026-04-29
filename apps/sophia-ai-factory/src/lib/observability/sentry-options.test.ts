/**
 * Unit tests for sentry-options.ts — verifies sampling, env tagging, and PII stripping.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('sentry-options', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('buildClientOptions sets correct tracesSampleRate in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://test@sentry.io/123');
    const { buildClientOptions } = await import('./sentry-options');
    const opts = buildClientOptions();
    expect(opts.tracesSampleRate).toBe(0.1);
    expect(opts.environment).toBe('production');
  });

  it('buildClientOptions sets 100% tracesSampleRate in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { buildClientOptions } = await import('./sentry-options');
    const opts = buildClientOptions();
    expect(opts.tracesSampleRate).toBe(1.0);
  });

  it('buildServerOptions uses COMMIT_SHA as release', async () => {
    vi.stubEnv('COMMIT_SHA', 'abc12345');
    const { buildServerOptions } = await import('./sentry-options');
    const opts = buildServerOptions();
    expect(opts.release).toBe('abc12345');
  });

  it('buildEdgeOptions uses SENTRY_RELEASE as release fallback', async () => {
    vi.stubEnv('COMMIT_SHA', '');
    vi.stubEnv('SENTRY_RELEASE', 'v1.0.0');
    const { buildEdgeOptions } = await import('./sentry-options');
    const opts = buildEdgeOptions();
    expect(opts.release).toBe('v1.0.0');
  });

  it('beforeSend drops 4xx events', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { buildServerOptions } = await import('./sentry-options');
    const opts = buildServerOptions();
    const fakeEvent = {
      contexts: { response: { status_code: 404 } },
    };
    const result = opts.beforeSend?.(fakeEvent as Parameters<NonNullable<typeof opts.beforeSend>>[0], {});
    expect(result).toBeNull();
  });

  it('beforeSend allows 5xx events through', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { buildServerOptions } = await import('./sentry-options');
    const opts = buildServerOptions();
    const fakeEvent = {
      contexts: { response: { status_code: 500 } },
    };
    const result = opts.beforeSend?.(fakeEvent as Parameters<NonNullable<typeof opts.beforeSend>>[0], {});
    expect(result).not.toBeNull();
  });

  it('beforeSend strips token fields from extra', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { buildClientOptions } = await import('./sentry-options');
    const opts = buildClientOptions();
    const fakeEvent = {
      extra: { authToken: 'secret', userId: '123' },
    };
    const result = opts.beforeSend?.(fakeEvent as unknown as Parameters<NonNullable<typeof opts.beforeSend>>[0], {});
    expect(result).not.toBeNull();
    const resultWithExtra = result as { extra?: Record<string, unknown> } | null;
    if (resultWithExtra && resultWithExtra.extra) {
      expect(resultWithExtra.extra.authToken).toBe('[Filtered]');
      expect(resultWithExtra.extra.userId).toBe('123');
    }
  });
});
