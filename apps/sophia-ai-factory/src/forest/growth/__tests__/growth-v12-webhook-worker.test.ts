/**
 * Unit Tests for Growth v12 Webhook Worker
 * Layer: forest/growth/__tests__ | Max LOC: < 200 | Zero :any
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { growthV12WebhookWorker } from '../growth-v12-webhook-worker';

const { mockInngestSend } = vi.hoisted(() => ({
  mockInngestSend: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: mockInngestSend,
    createFunction: (
      _cfg: unknown,
      _evt: unknown,
      handler: (...args: unknown[]) => unknown,
    ) => handler,
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('growthV12WebhookWorker Inngest Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockStep = {
    run: vi.fn().mockImplementation((_name, fn) => fn()),
  };

  it('rejects invalid webhook payloads', async () => {
    const handler = growthV12WebhookWorker as unknown as (args: { event: { data: unknown }; step: typeof mockStep }) => Promise<{ success: boolean; reason?: string }>;
    const res = await handler({
      event: { data: { foo: 'bar' } },
      step: mockStep,
    });

    expect(res.success).toBe(false);
    expect(res.reason).toBe('INVALID_WEBHOOK');
  });

  it('normalizes valid ClickBank webhook and sends conversion.created', async () => {
    const validWebhook = {
      affiliateNetwork: 'CLICKBANK',
      externalOrderId: 'CB_ORDER_777',
      grossAmountUsd: 147.0,
      commissionAmountUsd: 73.5,
      subId: 'sub_manifest_101',
    };

    const handler = growthV12WebhookWorker as unknown as (args: { event: { data: unknown }; step: typeof mockStep }) => Promise<{ success: boolean; externalOrderId: string }>;
    const res = await handler({
      event: { data: validWebhook },
      step: mockStep,
    });

    expect(res.success).toBe(true);
    expect(res.externalOrderId).toBe('CB_ORDER_777');
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'conversion.created',
        data: expect.objectContaining({
          conversionEventId: 'CB_ORDER_777',
          tenantId: 'default',
        }),
      }),
    );
  });
});
