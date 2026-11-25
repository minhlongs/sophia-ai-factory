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
    // Also capture a scrubbed Error copy to Sentry (never the raw Error reference)
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Error',
        message: 'test error',
      }),
      expect.objectContaining({ extra: expect.anything() })
    );
    const capturedErr = mocks.captureException.mock.calls[0][0];
    expect(capturedErr).toBeInstanceOf(Error);
    expect(capturedErr).not.toBe(err);
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

describe('logger-internals secret & PII redaction (Issue #183)', () => {
  const SYNTHETIC_SK = 'sk-proj-synthetic1234567890abcdef';
  const SYNTHETIC_SK_OR = 'sk-or-v1-synthetic1234567890abcdef123456';
  const SYNTHETIC_RESEND = 're_synthetic_1234567890abcdef1234';
  const SYNTHETIC_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.c2lnbmF0dXJlMTIzNDU2';
  const SYNTHETIC_BEARER = 'Bearer synth_bearer_token_9876543210';
  const SYNTHETIC_EMAIL = 'ceo-test@example.com';

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    (globalThis as typeof globalThis & { __betterStackBuffer?: unknown }).__betterStackBuffer = undefined;
    (globalThis as typeof globalThis & { __betterStackFlushScheduled?: unknown }).__betterStackFlushScheduled = undefined;
    process.env.BETTER_STACK_LOGS_TOKEN = 'test-token';
    await flushBetterStackBuffer();
    mocks.pushBatch.mockClear();
    mocks.addBreadcrumb.mockClear();
    mocks.captureException.mockClear();
    mocks.forwardToSentry.mockClear();
  });

  it('redacts Bearer tokens, sk-*, sk-or-*, re_*, JWTs, hyphenated headers, and nested metadata across all sinks', async () => {
    const rawErr = new Error(
      `Upstream failed for ${SYNTHETIC_EMAIL}: ${SYNTHETIC_BEARER} ${SYNTHETIC_SK} ${SYNTHETIC_SK_OR} ${SYNTHETIC_RESEND} ${SYNTHETIC_JWT}`
    );
    rawErr.stack = `Error: boom ${SYNTHETIC_SK_OR}\n    at fetchWithKey (${SYNTHETIC_RESEND}:1:1)\n    at auth (${SYNTHETIC_BEARER}:2:2)`;

    log(
      'error',
      `Request failed with ${SYNTHETIC_BEARER} and ${SYNTHETIC_RESEND}`,
      {
        'x-api-key': 'synth-x-api-key-value-9999',
        'x-auth-token': 'synth-x-auth-token-value-8888',
        nested: {
          headers: {
            'x-api-key': 'nested-api-key-7777',
            'x-auth-token': 'nested-auth-token-6666',
            authorization: SYNTHETIC_BEARER,
          },
          providerKey: SYNTHETIC_SK_OR,
          email: SYNTHETIC_EMAIL,
        },
        safeField: 'pilot-ok',
      },
      rawErr
    );
    await drainLogMicrotask();

    const forbiddenValues = [
      SYNTHETIC_SK,
      SYNTHETIC_SK_OR,
      SYNTHETIC_RESEND,
      SYNTHETIC_JWT,
      'synth_bearer_token_9876543210',
      'synth-x-api-key-value-9999',
      'synth-x-auth-token-value-8888',
      'nested-api-key-7777',
      'nested-auth-token-6666',
      SYNTHETIC_EMAIL,
    ];

    // 1. Structured console error output
    const consoleOutput = String(consoleErrorSpy.mock.calls[0]?.[0] ?? '');
    for (const secret of forbiddenValues) {
      expect(consoleOutput).not.toContain(secret);
    }

    // 2. Better Stack transport payload
    expect(mocks.pushBatch).toHaveBeenCalledTimes(1);
    const betterStackSerialized = JSON.stringify(mocks.pushBatch.mock.calls[0][0]);
    for (const secret of forbiddenValues) {
      expect(betterStackSerialized).not.toContain(secret);
    }

    // 3. Sentry breadcrumb
    expect(mocks.addBreadcrumb).toHaveBeenCalledTimes(1);
    const breadcrumbSerialized = JSON.stringify(mocks.addBreadcrumb.mock.calls[0][0]);
    for (const secret of forbiddenValues) {
      expect(breadcrumbSerialized).not.toContain(secret);
    }

    // 4. Sentry captureException receives scrubbed Error copy, not raw Error
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
    const [capturedError, capturedCtx] = mocks.captureException.mock.calls[0];
    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError).not.toBe(rawErr);
    const sentrySerialized = JSON.stringify({
      name: capturedError.name,
      message: capturedError.message,
      stack: capturedError.stack,
      ctx: capturedCtx,
    });
    for (const secret of forbiddenValues) {
      expect(sentrySerialized).not.toContain(secret);
    }
  });

  it('scrubs non-Error string and object throwables before logging and Sentry forwarding', async () => {
    log('error', 'string throwable', { stage: 'test' }, `raw failure ${SYNTHETIC_SK_OR} ${SYNTHETIC_RESEND}`);
    log('error', 'object throwable', { stage: 'test' }, {
      'x-api-key': 'obj-throw-key-123456',
      detail: `leaked ${SYNTHETIC_BEARER}`,
    });
    await drainLogMicrotask();

    const allConsole = consoleErrorSpy.mock.calls.map((c: unknown[]) => String(c[0] ?? '')).join('\n');
    const allSentry = mocks.captureException.mock.calls
      .map((c: unknown[]) => {
        const err = c[0] as Error;
        return JSON.stringify({ name: err.name, message: err.message, stack: err.stack });
      })
      .join('\n');

    for (const secret of [SYNTHETIC_SK_OR, SYNTHETIC_RESEND, 'obj-throw-key-123456', 'synth_bearer_token_9876543210']) {
      expect(allConsole).not.toContain(secret);
      expect(allSentry).not.toContain(secret);
    }
    expect(mocks.captureException).toHaveBeenCalledTimes(2);
    expect(mocks.captureException.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(mocks.captureException.mock.calls[1][0]).toBeInstanceOf(Error);
  });
});

