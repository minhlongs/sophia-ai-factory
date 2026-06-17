import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pushBatch: vi.fn().mockResolvedValue(undefined),
  forwardToSentry: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@/seed/observability/telemetry/better-stack-client', () => ({
  pushBatch: mocks.pushBatch,
}));

vi.mock('@/seed/observability/sentry-forwarder', () => ({
  forwardToSentry: mocks.forwardToSentry,
}));

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: mocks.addBreadcrumb,
  captureException: mocks.captureException,
}));

import { flushBetterStackBuffer, log } from './logger-internals';

async function drainLogMicrotask() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('logger-internals Better Stack bridge', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    (globalThis as typeof globalThis & { __betterStackBuffer?: unknown }).__betterStackBuffer = undefined;
    (globalThis as typeof globalThis & { __betterStackFlushScheduled?: unknown }).__betterStackFlushScheduled = undefined;
    process.env.BETTER_STACK_LOGS_TOKEN = 'test-token';
    await flushBetterStackBuffer();
    mocks.pushBatch.mockClear();
  });

  it('ships one Better Stack payload per app log when a token is configured', async () => {
    log('info', 'hello logger', { requestId: 'req-1' });
    await drainLogMicrotask();

    expect(mocks.pushBatch).toHaveBeenCalledTimes(1);
    const [payloads, config] = mocks.pushBatch.mock.calls[0];
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      level: 'info',
      msg: 'hello logger',
    });
    expect(config).toMatchObject({ logsToken: 'test-token' });
  });

  it('batches synchronous logs and caps outbound payloads', async () => {
    log('info', 'one');
    log('warn', 'two');
    log('debug', 'three');
    log('error', 'four');
    await drainLogMicrotask();

    expect(mocks.pushBatch).toHaveBeenCalledTimes(1);
    const [payloads] = mocks.pushBatch.mock.calls[0];
    expect(payloads).toHaveLength(3);
    expect(payloads.map((p: { msg: string }) => p.msg)).toEqual(['one', 'two', 'three']);
  });

  it('does not call Better Stack when no token is configured', async () => {
    process.env.BETTER_STACK_LOGS_TOKEN = '';
    log('warn', 'tokenless log');
    await drainLogMicrotask();

    expect(mocks.pushBatch).not.toHaveBeenCalled();
  });

  it('keeps explicit flush safe when the buffer is empty', async () => {
    await expect(flushBetterStackBuffer()).resolves.toBe(0);
  });
});

describe('Sentry breadcrumb integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    (globalThis as typeof globalThis & { __betterStackBuffer?: unknown }).__betterStackBuffer = undefined;
    (globalThis as typeof globalThis & { __betterStackFlushScheduled?: unknown }).__betterStackFlushScheduled = undefined;
    process.env.BETTER_STACK_LOGS_TOKEN = '';
    await flushBetterStackBuffer();
    mocks.addBreadcrumb.mockClear();
    mocks.captureException.mockClear();
    mocks.forwardToSentry.mockClear();
    // Reset the Sentry module load attempt flag
    (globalThis as any).__sentryLoadAttempted = false;
  });

  it('adds debug logs as breadcrumbs with debug severity', async () => {
    log('debug', 'debug message', { requestId: 'req-123' });
    await drainLogMicrotask();

    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'debug message',
        level: 'debug',
        category: 'log',
        data: expect.objectContaining({ requestId: 'req-123' }),
      })
    );
  });

  it('adds info logs as breadcrumbs with info severity', async () => {
    log('info', 'info message', { userId: 'user-456' });
    await drainLogMicrotask();

    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'info message',
        level: 'info',
        category: 'log',
        data: expect.objectContaining({ userId: 'user-456' }),
      })
    );
  });

  it('adds warn logs as breadcrumbs with warning severity', async () => {
    log('warn', 'warning message', { stage: 'billing' });
    await drainLogMicrotask();

    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'warning message',
        level: 'warning',
        category: 'log',
        data: expect.objectContaining({ stage: 'billing' }),
      })
    );
  });

  it('adds error logs as breadcrumbs with error severity', async () => {
    const err = new Error('test error');
    log('error', 'error occurred', { operation: 'payment' }, err);
    await drainLogMicrotask();

    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'error occurred',
        level: 'error',
        category: 'log',
        data: expect.objectContaining({
          operation: 'payment',
          error: expect.objectContaining({
            name: 'Error',
            message: 'test error',
          }),
        }),
      })
    );
    // Also capture the exception to Sentry
    expect(mocks.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ extra: expect.anything() })
    );
  });

  it('adds fatal logs as breadcrumbs with fatal severity', async () => {
    const err = new Error('fatal error');
    log('fatal', 'fatal failure', { critical: true }, err);
    await drainLogMicrotask();

    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'fatal failure',
        level: 'fatal',
        category: 'log',
        data: expect.objectContaining({
          critical: true,
          error: expect.objectContaining({
            name: 'Error',
            message: 'fatal error',
          }),
        }),
      })
    );
  });

  it('forwards message-only errors via HTTP forwarder when no Error object', async () => {
    log('error', 'connection failed', { provider: 'stripe' });
    await drainLogMicrotask();

    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'connection failed',
        level: 'error',
        category: 'log',
        data: expect.objectContaining({ provider: 'stripe' }),
      })
    );
    expect(mocks.forwardToSentry).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: 'connection failed',
        extra: expect.objectContaining({ provider: 'stripe' }),
      })
    );
  });

  it('scrubs PII from metadata before adding breadcrumb', async () => {
    log('info', 'user action', {
      email: 'user@example.com',
      password: 'secret123',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      safeField: 'visible',
    });
    await drainLogMicrotask();

    const breadcrumbCall = mocks.addBreadcrumb.mock.calls[0][0];
    expect(breadcrumbCall.data).toEqual({
      email: '[REDACTED-EMAIL]',
      password: '[REDACTED-KEY]',
      token: '[REDACTED-KEY]',
      safeField: 'visible',
    });
  });

  it('handles Sentry import failures gracefully without blocking', async () => {
    // Simulate Sentry module failing to load by throwing on import
    const originalModule = await import('@sentry/nextjs');
    vi.doMock('@sentry/nextjs', () => {
      throw new Error('Sentry not available');
    });

    // Reset the module cache and load flag
    vi.resetModules();
    (globalThis as any).__sentryLoadAttempted = false;

    // This should not throw even though Sentry mock fails
    expect(() => log('error', 'test error')).not.toThrow();

    // Cleanup
    vi.doUnmock('@sentry/nextjs');
  });
});
