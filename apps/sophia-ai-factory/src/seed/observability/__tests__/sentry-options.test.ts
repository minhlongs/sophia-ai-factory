/**
 * Unit tests for sentry-options.ts — verifies sampling, env tagging, PII stripping,
 * and SSE breadcrumb rate-sampling (Wave-15).
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
    const { buildClientOptions } = await import('../sentry-options');
    const opts = buildClientOptions();
    expect(opts.tracesSampleRate).toBe(0.02);
    expect(opts.environment).toBe('production');
  });

  it('buildClientOptions sets 100% tracesSampleRate in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { buildClientOptions } = await import('../sentry-options');
    const opts = buildClientOptions();
    expect(opts.tracesSampleRate).toBe(1.0);
  });

  it('buildServerOptions uses COMMIT_SHA as release', async () => {
    vi.stubEnv('COMMIT_SHA', 'abc12345');
    const { buildServerOptions } = await import('../sentry-options');
    const opts = buildServerOptions();
    expect(opts.release).toBe('abc12345');
  });

  it('buildEdgeOptions uses SENTRY_RELEASE as release fallback', async () => {
    vi.stubEnv('COMMIT_SHA', '');
    vi.stubEnv('SENTRY_RELEASE', 'v1.0.0');
    const { buildEdgeOptions } = await import('../sentry-options');
    const opts = buildEdgeOptions();
    expect(opts.release).toBe('v1.0.0');
  });

  it('beforeSend drops 4xx events', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { buildServerOptions } = await import('../sentry-options');
    const opts = buildServerOptions();
    const fakeEvent = {
      contexts: { response: { status_code: 404 } },
    };
    const result = opts.beforeSend?.(fakeEvent as Parameters<NonNullable<typeof opts.beforeSend>>[0], {});
    expect(result).toBeNull();
  });

  it('beforeSend allows 5xx events through', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { buildServerOptions } = await import('../sentry-options');
    const opts = buildServerOptions();
    const fakeEvent = {
      contexts: { response: { status_code: 500 } },
    };
    const result = opts.beforeSend?.(fakeEvent as Parameters<NonNullable<typeof opts.beforeSend>>[0], {});
    expect(result).not.toBeNull();
  });

  it('beforeSend strips token fields from extra', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { buildClientOptions } = await import('../sentry-options');
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

// ─── SSE Sampling Tests (Wave-15) ───────────────────────────────────────────

describe('shouldKeepSseBreadcrumb', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('always keeps error-level SSE breadcrumbs regardless of rate', async () => {
    const { shouldKeepSseBreadcrumb } = await import('../sentry-options');
    // Call many times — all should pass because level=error
    for (let i = 0; i < 100; i++) {
      expect(shouldKeepSseBreadcrumb({ mission_id: 'mission-error-test' }, 'error')).toBe(true);
    }
  });

  it('always keeps the first SSE breadcrumb per mission per second window', async () => {
    const { shouldKeepSseBreadcrumb } = await import('../sentry-options');
    // Fresh module → fresh bucket; first call must return true
    const kept = shouldKeepSseBreadcrumb({ mission_id: 'mission-first-event' }, 'info');
    expect(kept).toBe(true);
  });

  it('drops SSE breadcrumbs beyond MAX_SSE_PER_SECOND (10) in the same window', async () => {
    const { shouldKeepSseBreadcrumb } = await import('../sentry-options');
    const missionId = 'mission-rate-test';

    // Simulate 50 SSE breadcrumbs in the same second for the same mission.
    // The first is always kept; beyond 10 all must be dropped.
    let kept = 0;
    let dropped = 0;
    for (let i = 0; i < 50; i++) {
      if (shouldKeepSseBreadcrumb({ mission_id: missionId }, 'info')) {
        kept++;
      } else {
        dropped++;
      }
    }

    // Hard cap: no more than 10 non-error breadcrumbs kept per second per mission
    expect(kept).toBeLessThanOrEqual(10);
    // At least 40 must be dropped (50 - max 10)
    expect(dropped).toBeGreaterThanOrEqual(40);
  });

  it('resets the window and keeps the first event in a new second', async () => {
    vi.useFakeTimers();
    const { shouldKeepSseBreadcrumb } = await import('../sentry-options');
    const missionId = 'mission-window-reset';

    // Fill the current window
    for (let i = 0; i < 15; i++) {
      shouldKeepSseBreadcrumb({ mission_id: missionId }, 'info');
    }

    // Advance time by 2 seconds to force a new window
    vi.advanceTimersByTime(2000);

    // First event in the new window must always be kept
    const result = shouldKeepSseBreadcrumb({ mission_id: missionId }, 'info');
    expect(result).toBe(true);

    vi.useRealTimers();
  });
});

// ─── buildBeforeBreadcrumb SSE integration ──────────────────────────────────

describe('buildBeforeBreadcrumb SSE sampling integration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('drops unknown category breadcrumbs', async () => {
    const { buildBeforeBreadcrumb } = await import('../sentry-options');
    const result = buildBeforeBreadcrumb({ category: 'custom-unknown', data: {} });
    expect(result).toBeNull();
  });

  it('passes non-SSE breadcrumbs without sampling', async () => {
    const { buildBeforeBreadcrumb } = await import('../sentry-options');
    const result = buildBeforeBreadcrumb({ category: 'fetch', data: {} });
    expect(result).not.toBeNull();
  });

  it('passes SSE error breadcrumbs always', async () => {
    const { buildBeforeBreadcrumb } = await import('../sentry-options');
    // Error-level SSE breadcrumbs must never be dropped
    for (let i = 0; i < 20; i++) {
      const result = buildBeforeBreadcrumb({
        category: 'sse',
        level: 'error',
        data: { mission_id: 'mission-sse-error' },
      });
      expect(result).not.toBeNull();
    }
  });

  it('sampling drops SSE info breadcrumbs beyond rate limit', async () => {
    const { buildBeforeBreadcrumb } = await import('../sentry-options');
    const missionId = 'mission-sse-sampling';
    let dropped = 0;
    // Send 50 SSE breadcrumbs — beyond 10/s cap, remainder must be dropped
    for (let i = 0; i < 50; i++) {
      const result = buildBeforeBreadcrumb({
        category: 'sse',
        level: 'info',
        data: { mission_id: missionId },
      });
      if (result === null) dropped++;
    }
    // At least 40 should be dropped (hard cap at 10/s)
    expect(dropped).toBeGreaterThanOrEqual(40);
  });
});
