/**
 * Tests for Postback Dead-Letter Queue (DLQ)
 *
 * Covers enqueue, retrieval, count aggregation, and resolution of unmapped
 * or failed postbacks.
 *
 * @module land/postback/__tests__/postback-dead-letter.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enqueuePostbackDlq,
  listUnresolvedPostbackDlq,
  getPostbackDlqCounts,
  resolvePostbackDlqEntry,
} from '../postback-dead-letter';
import { getD1 } from '@/seed/db/client';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

interface StoredRow {
  id: string;
  network: string;
  endpoint: string;
  source_ip: string | null;
  headers_json: string;
  payload: string;
  failure_reason: string;
  tenant_hint: string | null;
  retry_count: number;
  resolved: number;
  resolved_at: string | null;
  created_at: string;
  last_attempted_at: string;
}

describe('Postback Dead-Letter Queue', () => {
  let inMemoryDb: StoredRow[] = [];

  const mockD1 = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        run: async () => {
          if (sql.includes('INSERT INTO postback_dead_letter')) {
            const [
              id,
              network,
              endpoint,
              sourceIp,
              headersJson,
              payload,
              failureReason,
              tenantHint,
              retryCount,
              createdAt,
              lastAttemptedAt,
            ] = args as [
              string,
              string,
              string,
              string | null,
              string,
              string,
              string,
              string | null,
              number,
              string,
              string,
            ];

            const existingIndex = inMemoryDb.findIndex((r) => r.id === id);
            if (existingIndex >= 0) {
              const row = inMemoryDb[existingIndex];
              row.retry_count += 1;
              row.failure_reason = failureReason;
              row.last_attempted_at = lastAttemptedAt;
            } else {
              inMemoryDb.push({
                id,
                network,
                endpoint,
                source_ip: sourceIp,
                headers_json: headersJson,
                payload,
                failure_reason: failureReason,
                tenant_hint: tenantHint,
                retry_count: retryCount,
                resolved: 0,
                resolved_at: null,
                created_at: createdAt,
                last_attempted_at: lastAttemptedAt,
              });
            }
          } else if (sql.includes('UPDATE postback_dead_letter')) {
            const [resolvedAt, id] = args as [string, string];
            const row = inMemoryDb.find((r) => r.id === id);
            if (row) {
              row.resolved = 1;
              row.resolved_at = resolvedAt;
            }
          }
          return { success: true };
        },
        all: async <T>() => {
          if (sql.includes('SELECT * FROM postback_dead_letter')) {
            const [limit] = args as [number];
            const filtered = inMemoryDb.filter((r) => r.resolved === 0).slice(0, limit);
            return { results: filtered as unknown as T[] };
          }
          return { results: [] };
        },
      }),
      all: async <T>() => {
        if (sql.includes('SELECT') && sql.includes('GROUP BY network')) {
          const grouped: Record<string, { total: number; unresolved: number }> = {};
          for (const row of inMemoryDb) {
            if (!grouped[row.network]) {
              grouped[row.network] = { total: 0, unresolved: 0 };
            }
            grouped[row.network].total += 1;
            if (row.resolved === 0) {
              grouped[row.network].unresolved += 1;
            }
          }
          const results = Object.entries(grouped).map(([network, counts]) => ({
            network,
            total: counts.total,
            unresolved: counts.unresolved,
          }));
          return { results: results as unknown as T[] };
        }
        return { results: [] };
      },
    }),
  };

  beforeEach(() => {
    inMemoryDb = [];
    vi.clearAllMocks();
    vi.mocked(getD1).mockResolvedValue(mockD1 as unknown as D1Database);
  });

  it('enqueues unmapped postback to dead-letter queue with correct fields', async () => {
    const id = await enqueuePostbackDlq({
      network: 'partnerstack',
      endpoint: 'https://sophia.agencyos.network/api/webhooks/saas-crypto/partnerstack',
      sourceIp: '1.2.3.4',
      headersJson: JSON.stringify({ 'x-partnerstack-signature': 'abc' }),
      rawBody: JSON.stringify({ amount: 100 }),
      failureReason: 'tenant_unresolvable',
      tenantHint: null,
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(inMemoryDb.length).toBe(1);

    const stored = inMemoryDb[0];
    expect(stored.network).toBe('partnerstack');
    expect(stored.failure_reason).toBe('tenant_unresolvable');
    expect(stored.resolved).toBe(0);
    expect(stored.source_ip).toBe('1.2.3.4');
  });

  it('lists unresolved dead-letter items', async () => {
    await enqueuePostbackDlq({
      network: 'amazon',
      endpoint: '/api/webhooks/amazon',
      sourceIp: null,
      headersJson: '{}',
      rawBody: '{}',
      failureReason: 'secret_not_configured',
      tenantHint: 'ws-123',
    });

    const unresolved = await listUnresolvedPostbackDlq();
    expect(unresolved.length).toBe(1);
    expect(unresolved[0].network).toBe('amazon');
    expect(unresolved[0].tenant_hint).toBe('ws-123');
    expect(unresolved[0].resolved).toBe(false);
  });

  it('aggregates counts by network', async () => {
    await enqueuePostbackDlq({
      network: 'partnerstack',
      endpoint: '/api/webhooks/saas-crypto/partnerstack',
      sourceIp: null,
      headersJson: '{}',
      rawBody: '{}',
      failureReason: 'tenant_unresolvable',
      tenantHint: null,
    });
    await enqueuePostbackDlq({
      network: 'partnerstack',
      endpoint: '/api/webhooks/saas-crypto/partnerstack',
      sourceIp: null,
      headersJson: '{}',
      rawBody: '{}',
      failureReason: 'secret_not_configured',
      tenantHint: 'ws-456',
    });

    const counts = await getPostbackDlqCounts();
    expect(counts.length).toBe(1);
    expect(counts[0].network).toBe('partnerstack');
    expect(counts[0].total).toBe(2);
    expect(counts[0].unresolved).toBe(2);
  });

  it('resolves a dead-letter entry', async () => {
    const id = await enqueuePostbackDlq({
      network: 'tiktok_shop',
      endpoint: '/api/webhooks/tiktok-shop',
      sourceIp: null,
      headersJson: '{}',
      rawBody: '{}',
      failureReason: 'link_unattributed',
      tenantHint: 'ws-789',
    });

    expect(id).not.toBeNull();
    await resolvePostbackDlqEntry(id!);

    const unresolved = await listUnresolvedPostbackDlq();
    expect(unresolved.length).toBe(0);
    expect(inMemoryDb[0].resolved).toBe(1);
    expect(inMemoryDb[0].resolved_at).toBeDefined();
  });

  it('fails gracefully when D1 is unavailable across all operations', async () => {
    vi.mocked(getD1).mockResolvedValue(null as unknown as D1Database);
    const id = await enqueuePostbackDlq({
      network: 'bybit',
      endpoint: '/api/webhooks/saas-crypto/bybit',
      sourceIp: null,
      headersJson: '{}',
      rawBody: '{}',
      failureReason: 'db_unavailable',
      tenantHint: null,
    });
    expect(id).toBeNull();

    const unresolved = await listUnresolvedPostbackDlq();
    expect(unresolved).toEqual([]);

    const counts = await getPostbackDlqCounts();
    expect(counts).toEqual([]);

    await expect(resolvePostbackDlqEntry('some-id')).resolves.not.toThrow();
  });

  it('handles database errors gracefully across query operations', async () => {
    const errorD1 = {
      prepare: () => ({
        bind: () => ({
          run: async () => {
            throw new Error('D1 write error');
          },
          all: async () => {
            throw new Error('D1 read error');
          },
        }),
        all: async () => {
          throw new Error('D1 aggregation error');
        },
      }),
    };
    vi.mocked(getD1).mockResolvedValue(errorD1 as unknown as D1Database);

    const id = await enqueuePostbackDlq({
      network: 'binance',
      endpoint: '/api/webhooks/saas-crypto/binance',
      sourceIp: null,
      headersJson: '{}',
      rawBody: '{}',
      failureReason: 'error_test',
      tenantHint: null,
    });
    expect(id).toBeNull();

    const unresolved = await listUnresolvedPostbackDlq();
    expect(unresolved).toEqual([]);

    const counts = await getPostbackDlqCounts();
    expect(counts).toEqual([]);

    await expect(resolvePostbackDlqEntry('some-id')).resolves.not.toThrow();
  });
});
