import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pushBatch: vi.fn().mockResolvedValue(undefined),
  forwardToSentry: vi.fn(),
}));

vi.mock('@/land/telemetry/better-stack-client', () => ({
  pushBatch: mocks.pushBatch,
}));

vi.mock('@/land/observability/sentry-forwarder', () => ({
  forwardToSentry: mocks.forwardToSentry,
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
