// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ sendOpsAlert: vi.fn(), cleanup: vi.fn() }));
vi.mock('@/seed/observability/ops-alert', () => ({ sendOpsAlert: mocks.sendOpsAlert }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/land/monitoring/synthetic-cleanup', () => ({ cleanupSyntheticArtifacts: mocks.cleanup }));
vi.mock('@/land/fulfillment/one-time-fulfillment', () => ({ triggerOneTimeFulfillment: vi.fn() }));
vi.mock('@/seed/db/repositories/user-purchases-repo', () => ({ markPaid: vi.fn() }));
import { runSmokePhaseACheck } from './smoke-one-time-helpers';

describe('synthetic smoke alert boundary', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('keeps cleanup and cron result independent of failed optional notification', async () => {
    mocks.sendOpsAlert.mockResolvedValue({ sent: false, reason: 'rate_limited', retryAfterSeconds: 300 });
    const purchaseId = '12345678123412341234123456789abc';
    const statement = { bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [{ id: purchaseId, created_at: 1 }] }),
      first: vi.fn().mockResolvedValue(null) };
    const db = { prepare: vi.fn().mockReturnValue(statement) } as unknown as D1Database;
    expect(await runSmokePhaseACheck(db, 5000)).toBe(true);
    expect(mocks.sendOpsAlert).toHaveBeenCalledExactlyOnceWith({ severity: 'high',
      eventType: 'synthetic_fulfillment_stale', incidentId: purchaseId });
    expect(mocks.cleanup).toHaveBeenCalledExactlyOnceWith(purchaseId);
  });
});
