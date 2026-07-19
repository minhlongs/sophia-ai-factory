/**
 * Tests for email-outbox-stats — D1 mocked.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getEmailOutboxSnapshot } from './email-outbox-stats';

interface MockSequence {
  totalsResults?: Array<{ status: string; n: number }>;
  dueRow?: { n: number } | null;
  futureRow?: { n: number } | null;
  failures?: Array<Record<string, unknown>>;
  sends?: Array<Record<string, unknown>>;
}

function setD1Mock(seq: MockSequence) {
  // 5 calls in order: totals.all, due.first, future.first, failures.all, sends.all
  // We stub a generic chain that returns the right kind of result based on call index.
  let call = 0;
  const all = vi.fn().mockImplementation(() => {
    call++;
    if (call === 1) return Promise.resolve({ results: seq.totalsResults ?? [], success: true });
    if (call === 4) return Promise.resolve({ results: seq.failures ?? [], success: true });
    if (call === 5) return Promise.resolve({ results: seq.sends ?? [], success: true });
    return Promise.resolve({ results: [], success: true });
  });
  const first = vi.fn().mockImplementation(() => {
    call++;
    if (call === 2) return Promise.resolve(seq.dueRow ?? null);
    if (call === 3) return Promise.resolve(seq.futureRow ?? null);
    return Promise.resolve(null);
  });
  const bind = vi.fn().mockReturnValue({ first, all });
  const db = { prepare: vi.fn().mockReturnValue({ bind, all, first }) };
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = {
    ...((globalThis as unknown as { __env?: Record<string, unknown> }).__env ?? {}),
    DB: db,
  };
}

afterEach(() => vi.clearAllMocks());

describe('getEmailOutboxSnapshot', () => {
  it('returns zero snapshot when DB empty', async () => {
    setD1Mock({});
    const result = await getEmailOutboxSnapshot();
    expect(result.totals).toEqual([]);
    expect(result.pendingDue).toBe(0);
    expect(result.pendingFuture).toBe(0);
    expect(result.recentFailures).toEqual([]);
    expect(result.recentSends).toEqual([]);
  });

  it('aggregates counts and splits pending into due / future buckets', async () => {
    setD1Mock({
      totalsResults: [
        { status: 'sent', n: 100 },
        { status: 'pending', n: 5 },
        { status: 'failed', n: 2 },
      ],
      dueRow: { n: 3 },
      futureRow: { n: 2 },
    });
    const result = await getEmailOutboxSnapshot();
    expect(result.totals).toHaveLength(3);
    const sentTotal = result.totals.find((t) => t.status === 'sent');
    expect(sentTotal?.count).toBe(100);
    expect(result.pendingDue).toBe(3);
    expect(result.pendingFuture).toBe(2);
  });

  it('maps recent failure rows to camelCase output', async () => {
    setD1Mock({
      failures: [
        {
          id: 'f1',
          payment_id: 'pay-1',
          to_email: 'a@x.com',
          template: 'win-back',
          status: 'failed',
          attempts: 4,
          created_at: 1700000000,
          sent_at: null,
          last_error: 'SMTP 550',
        },
      ],
    });
    const result = await getEmailOutboxSnapshot();
    expect(result.recentFailures).toHaveLength(1);
    expect(result.recentFailures[0]).toEqual({
      id: 'f1',
      paymentId: 'pay-1',
      toEmail: 'a@x.com',
      template: 'win-back',
      status: 'failed',
      attempts: 4,
      createdAt: 1700000000,
      sentAt: null,
      lastError: 'SMTP 550',
    });
  });

  it('coerces numeric strings to numbers', async () => {
    setD1Mock({
      totalsResults: [{ status: 'sent', n: '50' as unknown as number }],
      dueRow: { n: '0' as unknown as number },
      futureRow: { n: '0' as unknown as number },
    });
    const result = await getEmailOutboxSnapshot();
    expect(typeof result.totals[0].count).toBe('number');
    expect(result.totals[0].count).toBe(50);
    expect(result.pendingDue).toBe(0);
  });
});
