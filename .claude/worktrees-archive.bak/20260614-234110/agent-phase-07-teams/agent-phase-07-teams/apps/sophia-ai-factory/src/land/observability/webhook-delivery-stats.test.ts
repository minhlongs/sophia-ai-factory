/**
 * Tests for webhook-delivery-stats — D1 mocked.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getWebhookDeliverySnapshot } from './webhook-delivery-stats';

interface MockSeq {
  endpointRow?: { total_endpoints: number; active_endpoints: number; unhealthy_endpoints: number } | null;
  totalsResults?: Array<{ status: string; n: number }>;
  failures?: Array<Record<string, unknown>>;
  successes?: Array<Record<string, unknown>>;
}

function setD1Mock(seq: MockSeq) {
  let call = 0;
  const first = vi.fn().mockImplementation(() => {
    call++;
    if (call === 1) return Promise.resolve(seq.endpointRow ?? null);
    return Promise.resolve(null);
  });
  const all = vi.fn().mockImplementation(() => {
    call++;
    if (call === 2) return Promise.resolve({ results: seq.totalsResults ?? [], success: true });
    if (call === 3) return Promise.resolve({ results: seq.failures ?? [], success: true });
    if (call === 4) return Promise.resolve({ results: seq.successes ?? [], success: true });
    return Promise.resolve({ results: [], success: true });
  });
  const db = { prepare: vi.fn().mockReturnValue({ first, all }) };
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = {
    ...((globalThis as unknown as { __env?: Record<string, unknown> }).__env ?? {}),
    DB: db,
  };
}

afterEach(() => vi.clearAllMocks());

describe('getWebhookDeliverySnapshot', () => {
  it('returns zero snapshot when DB empty', async () => {
    setD1Mock({});
    const result = await getWebhookDeliverySnapshot();
    expect(result.endpoints.totalEndpoints).toBe(0);
    expect(result.endpoints.activeEndpoints).toBe(0);
    expect(result.endpoints.unhealthyEndpoints).toBe(0);
    expect(result.attemptTotals).toEqual([]);
    expect(result.recentFailures).toEqual([]);
    expect(result.recentSuccesses).toEqual([]);
  });

  it('aggregates endpoint health counts', async () => {
    setD1Mock({
      endpointRow: { total_endpoints: 12, active_endpoints: 10, unhealthy_endpoints: 3 },
      totalsResults: [
        { status: 'success', n: 200 },
        { status: 'failed', n: 8 },
        { status: 'dead_letter', n: 1 },
      ],
    });
    const result = await getWebhookDeliverySnapshot();
    expect(result.endpoints.totalEndpoints).toBe(12);
    expect(result.endpoints.activeEndpoints).toBe(10);
    expect(result.endpoints.unhealthyEndpoints).toBe(3);
    expect(result.attemptTotals).toHaveLength(3);
    const success = result.attemptTotals.find((t) => t.status === 'success');
    expect(success?.count).toBe(200);
  });

  it('maps recent failure rows to camelCase', async () => {
    setD1Mock({
      failures: [
        {
          id: 'att-1',
          endpoint_id: 'ep-1',
          tenant_id: 't-1',
          event: 'video.completed',
          attempt_num: 3,
          status: 'failed',
          http_status: 500,
          error_message: 'connection reset',
          created_at: '2026-05-10T17:00:00Z',
          completed_at: '2026-05-10T17:00:05Z',
        },
      ],
    });
    const result = await getWebhookDeliverySnapshot();
    expect(result.recentFailures).toHaveLength(1);
    expect(result.recentFailures[0]).toEqual({
      id: 'att-1',
      endpointId: 'ep-1',
      tenantId: 't-1',
      event: 'video.completed',
      attemptNum: 3,
      status: 'failed',
      httpStatus: 500,
      errorMessage: 'connection reset',
      createdAt: '2026-05-10T17:00:00Z',
      completedAt: '2026-05-10T17:00:05Z',
    });
  });

  it('coerces numeric strings from D1 driver', async () => {
    setD1Mock({
      endpointRow: {
        total_endpoints: '5' as unknown as number,
        active_endpoints: '5' as unknown as number,
        unhealthy_endpoints: '0' as unknown as number,
      },
      totalsResults: [{ status: 'success', n: '7' as unknown as number }],
    });
    const result = await getWebhookDeliverySnapshot();
    expect(typeof result.endpoints.totalEndpoints).toBe('number');
    expect(result.endpoints.totalEndpoints).toBe(5);
    expect(result.attemptTotals[0].count).toBe(7);
  });

  it('handles dead_letter status in failures bucket', async () => {
    setD1Mock({
      failures: [
        {
          id: 'att-2', endpoint_id: 'ep-2', tenant_id: 't-2',
          event: 'invoice.paid', attempt_num: 5, status: 'dead_letter',
          http_status: null, error_message: 'max retries',
          created_at: '2026-05-10T16:00:00Z', completed_at: null,
        },
      ],
    });
    const result = await getWebhookDeliverySnapshot();
    expect(result.recentFailures[0].status).toBe('dead_letter');
    expect(result.recentFailures[0].httpStatus).toBeNull();
  });
});
