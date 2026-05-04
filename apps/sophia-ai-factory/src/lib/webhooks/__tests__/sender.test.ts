/**
 * Unit tests for webhook HTTP sender.
 * Tests: timeout behaviour, signature header presence, success/failure paths.
 * @module lib/webhooks/__tests__/sender.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendWebhook } from '../sender';
import type { WebhookPayload } from '../types';

const samplePayload: WebhookPayload = {
  id: 'test-id-123',
  event: 'webhook.test',
  tenantId: 'tenant-abc',
  timestamp: '2026-05-03T00:00:00.000Z',
  data: { message: 'Hello from Sophia' },
};

describe('sendWebhook', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes X-Sophia-Signature header in POST request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => 'ok',
    });
    vi.stubGlobal('fetch', mockFetch);

    await sendWebhook(
      { url: 'https://example.com/hook', secret: 'test-secret' },
      'webhook.test',
      samplePayload,
    );

    const callArgs = mockFetch.mock.calls[0];
    const requestInit = callArgs[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;

    expect(headers['X-Sophia-Signature']).toBeDefined();
    expect(headers['X-Sophia-Signature']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('includes X-Sophia-Event and X-Sophia-Delivery headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => 'ok',
    });
    vi.stubGlobal('fetch', mockFetch);

    await sendWebhook(
      { url: 'https://example.com/hook', secret: 'secret' },
      'mission.completed',
      samplePayload,
    );

    const callArgs = mockFetch.mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;

    expect(headers['X-Sophia-Event']).toBe('mission.completed');
    expect(headers['X-Sophia-Delivery']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('returns success=true for 2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      text: async () => 'acknowledged',
    }));

    const result = await sendWebhook(
      { url: 'https://example.com/hook', secret: 'secret' },
      'webhook.test',
      samplePayload,
    );

    expect(result.success).toBe(true);
    expect(result.httpStatus).toBe(200);
  });

  it('returns success=false for 4xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 404,
      text: async () => 'not found',
    }));

    const result = await sendWebhook(
      { url: 'https://example.com/hook', secret: 'secret' },
      'webhook.test',
      samplePayload,
    );

    expect(result.success).toBe(false);
    expect(result.httpStatus).toBe(404);
    expect(result.error).toContain('404');
  });

  it('returns success=false with AbortError (simulated timeout)', async () => {
    // Simulate what happens when AbortController fires after 10s
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init.signal as AbortSignal | undefined;
        if (signal?.aborted) {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
          return;
        }
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
          // Immediately trigger abort to avoid waiting real 10s
          Promise.resolve().then(() => {
            (signal as AbortSignal & { _abort?: () => void })._abort?.();
          });
        }
        // Abort from outside — simulate by rejecting after microtask
        Promise.resolve().then(() => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }));

    const result = await sendWebhook(
      { url: 'https://example.com/slow', secret: 'secret' },
      'webhook.test',
      samplePayload,
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timeout|abort/i);
  });

  it('returns success=false when fetch rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    const result = await sendWebhook(
      { url: 'https://example.com/hook', secret: 'secret' },
      'webhook.test',
      samplePayload,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network failure');
  });
});
