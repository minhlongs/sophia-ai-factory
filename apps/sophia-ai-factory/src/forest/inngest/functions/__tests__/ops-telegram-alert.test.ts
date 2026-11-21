// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ sendOpsAlert: vi.fn(), createFunction: vi.fn() }));
vi.mock('@/seed/observability/ops-alert', () => ({ sendOpsAlert: mocks.sendOpsAlert }));
vi.mock('@/seed/inngest/client', () => ({ inngest: { createFunction: mocks.createFunction } }));
import { processOpsAlert } from '../ops-telegram-alert';

describe('mission failure ops-only dispatch', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.unstubAllEnvs(); });
  it('discards customer details, reason, action and payload destination', async () => {
    mocks.sendOpsAlert.mockResolvedValue({ sent: true });
    expect(await processOpsAlert({ provider: 'private-provider', chatId: 'attacker',
      reason: 'private customer', action: 'https://attacker.invalid', failureKind: 'AUTH_FAILURE' }))
      .toEqual({ sent: true });
    expect(mocks.sendOpsAlert).toHaveBeenCalledExactlyOnceWith({ severity: 'high',
      eventType: 'mission_auth_failure', incidentId: undefined });
  });
  it.each(['RATE_LIMIT', 'UNKNOWN'])('maps %s to fixed event label', async (failureKind) => {
    await processOpsAlert({ provider: 'private', failureKind });
    expect(mocks.sendOpsAlert).toHaveBeenCalledWith(expect.objectContaining({
      eventType: failureKind === 'RATE_LIMIT' ? 'mission_rate_limit' : 'mission_failed',
    }));
  });
  it('returns rate limit honestly without retrying or replaying business/accounting work', async () => {
    const deferred = { sent: false, reason: 'rate_limited', retryAfterSeconds: 120 };
    mocks.sendOpsAlert.mockResolvedValue(deferred);
    expect(await processOpsAlert({ provider: 'private', failureKind: 'RATE_LIMIT' })).toEqual(deferred);
    expect(mocks.sendOpsAlert).toHaveBeenCalledOnce();
  });
  it('registers a no-retry notification consumer, preserving actionability filter', async () => {
    vi.resetModules();
    await import('../ops-telegram-alert');
    const [config, trigger, handler] = mocks.createFunction.mock.calls[0];
    expect(config).toEqual({ id: 'ops-telegram-alert', retries: 0 });
    expect(trigger).toEqual({ event: 'agent.mission.failed' });
    mocks.sendOpsAlert.mockResolvedValue({ sent: false, reason: 'disabled' });
    await expect(handler({ event: { data: { provider: 'fal-ai', failureKind: 'AUTH_FAILURE' } } }))
      .resolves.toEqual({ sent: false, reason: 'disabled' });
    expect(mocks.sendOpsAlert).toHaveBeenCalledOnce();
  });
});
