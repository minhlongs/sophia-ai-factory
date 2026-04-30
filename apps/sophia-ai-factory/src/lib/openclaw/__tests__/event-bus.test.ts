/**
 * event-bus.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onEvent, emit, _clearHandlers } from '../event-bus';

// Mock D1 for persistHook tests
vi.mock('@/lib/db/client', () => ({
  getD1Raw: vi.fn().mockResolvedValue({
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }),
  }),
}));

describe('event-bus', () => {
  beforeEach(() => {
    _clearHandlers();
    vi.clearAllMocks();
  });

  it('registers a handler and calls it on emit', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    onEvent('video.published', 'tenant-a', handler);

    await emit('video.published', 'tenant-a', { videoId: '123' });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ videoId: '123' }, 'tenant-a');
  });

  it('tenant isolation: handler from tenant-a does not fire for tenant-b event', async () => {
    const handlerA = vi.fn().mockResolvedValue(undefined);
    const handlerB = vi.fn().mockResolvedValue(undefined);

    onEvent('video.published', 'tenant-a', handlerA);
    onEvent('video.published', 'tenant-b', handlerB);

    await emit('video.published', 'tenant-a', { videoId: 'xyz' });

    expect(handlerA).toHaveBeenCalledOnce();
    expect(handlerB).not.toHaveBeenCalled();
  });

  it('multiple handlers for same tenant+event all fire', async () => {
    const h1 = vi.fn().mockResolvedValue(undefined);
    const h2 = vi.fn().mockResolvedValue(undefined);

    onEvent('video.published', 'tenant-multi', h1);
    onEvent('video.published', 'tenant-multi', h2);

    await emit('video.published', 'tenant-multi', {});

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('unsubscribe function removes handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const unsubscribe = onEvent('test.event', 'tenant-unsub', handler);

    unsubscribe();
    await emit('test.event', 'tenant-unsub', {});

    expect(handler).not.toHaveBeenCalled();
  });

  it('emit with no handlers does not throw', async () => {
    await expect(emit('no.handlers.event', 'tenant-x', {})).resolves.toBeUndefined();
  });

  it('different events are isolated', async () => {
    const handlerA = vi.fn().mockResolvedValue(undefined);
    onEvent('event.a', 'tenant-ev', handlerA);

    await emit('event.b', 'tenant-ev', {});
    expect(handlerA).not.toHaveBeenCalled();
  });
});
