/**
 * schedule.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scheduleAgent } from '../schedule';

// Mock inngest client
const mockSend = vi.fn().mockResolvedValue({ id: 'evt-123' });
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: mockSend },
}));

// Mock audit
const mockAudit = vi.fn().mockResolvedValue(undefined);
vi.mock('../audit', () => ({
  audit: mockAudit,
}));

describe('scheduleAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls inngest.send with event name and tenantId in data', async () => {
    const result = await scheduleAgent(
      'affiliate.sync.requested',
      { batchSize: 100 },
      { tenantId: 'tenant-sched' },
    );

    expect(mockSend).toHaveBeenCalledOnce();
    const sendArg = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(sendArg.name).toBe('affiliate.sync.requested');
    expect((sendArg.data as Record<string, unknown>).tenantId).toBe('tenant-sched');
    expect(result.tenantId).toBe('tenant-sched');
    expect(result.cron).toBe('affiliate.sync.requested');
  });

  it('inserts audit row on schedule', async () => {
    await scheduleAgent(
      'video.cron.triggered',
      {},
      { tenantId: 'tenant-audit', actor: 'cron-runner' },
    );

    expect(mockAudit).toHaveBeenCalledOnce();
    const auditArg = mockAudit.mock.calls[0][0] as Record<string, unknown>;
    expect(auditArg.action).toBe('schedule.agent');
    expect(auditArg.tenantId).toBe('tenant-audit');
    expect(auditArg.actor).toBe('cron-runner');
  });

  it('sets idempotency key when provided', async () => {
    await scheduleAgent(
      'my.event',
      {},
      { tenantId: 'tenant-idem', idempotencyKey: 'key-unique-123' },
    );

    const sendArg = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(sendArg['id']).toBe('key-unique-123');
  });

  it('returns structured result', async () => {
    const result = await scheduleAgent('my.event', { x: 1 }, { tenantId: 'tenant-res' });
    expect(result).toHaveProperty('eventId');
    expect(result).toHaveProperty('cron');
    expect(result).toHaveProperty('tenantId');
  });
});
