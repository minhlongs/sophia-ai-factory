/**
 * Unit tests: writeConversionRevenueEvent — workspace resolution, idempotency,
 * zero-cent skipping, attributed_at recorded_at. Real SQLite DB (shared D1
 * shim), no fake-pass mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

// vi.hoisted: the shared D1 shim imports getD1 at module load, so the mock
// ref must exist before any import runs.
const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { writeConversionRevenueEvent } from '../tiktok-revenue-ingestion';
import { logger } from '@/seed/utils/logger-utility';

const ORG_TABLE = `
CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  UNIQUE(org_id, user_id)
);`;

interface EventRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  channel: string;
  event_type: string;
  count: number;
  value_cents: number;
  recorded_at: number;
  raw_data: string | null;
}

function setupDb(members: Array<{ org_id: string; user_id: string }>) {
  const raw = freshDb();
  raw.exec(ORG_TABLE);
  for (const m of members) {
    raw
      .prepare('INSERT INTO org_members (org_id, user_id) VALUES (?, ?)')
      .run(m.org_id, m.user_id);
  }
  mockGetD1.mockResolvedValue(makeD1(raw));
  return raw;
}

async function selectEvents(): Promise<EventRow[]> {
  const db = await mockGetD1();
  const { results } = await db
    .prepare('SELECT * FROM performance_events ORDER BY id')
    .all();
  return results as EventRow[];
}

describe('writeConversionRevenueEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes conversion event scoped to the resolved workspace', async () => {
    setupDb([{ org_id: 'org-1', user_id: 'affiliate-1' }]);

    const result = await writeConversionRevenueEvent({
      conversionEventId: 'conv-uuid-1',
      tenantId: 'tenant-1',
      affiliateId: 'affiliate-1',
      grossAmountUsd: 100,
      commissionUsd: 30,
      attributedAt: Math.floor(Date.now() / 1000),
      offerId: 'offer-1',
    });

    expect(result).toEqual({ written: 1, skipped: 0 });
    const events = await selectEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'conv_conv-uuid-1',
      workspace_id: 'org-1',
      asset_id: 'offer-1',
      project_id: 'offer-1',
      entity_type: 'conversion',
      entity_id: 'conv-uuid-1',
      channel: 'tiktok-shop',
      event_type: 'conversion',
      count: 1,
      value_cents: 3000, // 30 USD = 3000 cents
    });
    expect(JSON.parse(events[0]?.raw_data ?? '{}')).toEqual({
      source: 'tiktok-shop-webhook',
      conversionEventId: 'conv-uuid-1',
      tenantId: 'tenant-1',
      grossAmountUsd: 100,
      commissionUsd: 30,
    });
  });

  it('skips without throwing when affiliate has no org membership', async () => {
    setupDb([]);

    const result = await writeConversionRevenueEvent({
      conversionEventId: 'conv-uuid-2',
      tenantId: 'tenant-1',
      affiliateId: 'affiliate-no-org',
      grossAmountUsd: 100,
      commissionUsd: 30,
      attributedAt: Math.floor(Date.now() / 1000),
      offerId: 'offer-1',
    });

    expect(result).toEqual({ written: 0, skipped: 1 });
    expect(await selectEvents()).toHaveLength(0);
    expect(vi.mocked(logger.warn)).toHaveBeenCalled();
  });

  it('skips zero-commission rows (no noise events)', async () => {
    setupDb([{ org_id: 'org-1', user_id: 'affiliate-1' }]);

    const result = await writeConversionRevenueEvent({
      conversionEventId: 'conv-uuid-3',
      tenantId: 'tenant-1',
      affiliateId: 'affiliate-1',
      grossAmountUsd: 100,
      commissionUsd: 0,
      attributedAt: Math.floor(Date.now() / 1000),
      offerId: 'offer-1',
    });

    expect(result).toEqual({ written: 0, skipped: 1 });
    expect(await selectEvents()).toHaveLength(0);
  });

  it('stores recorded_at as attributedAt epoch-ms (converted from seconds)', async () => {
    setupDb([{ org_id: 'org-1', user_id: 'affiliate-1' }]);
    const attributedAt = 1722470400; // 2024-08-01 00:00:00 UTC in seconds

    await writeConversionRevenueEvent({
      conversionEventId: 'conv-uuid-4',
      tenantId: 'tenant-1',
      affiliateId: 'affiliate-1',
      grossAmountUsd: 100,
      commissionUsd: 25,
      attributedAt,
      offerId: 'offer-1',
    });

    const events = await selectEvents();
    expect(events[0]?.recorded_at).toBe(attributedAt * 1000); // converted to milliseconds
  });

  it('is idempotent: second call with same conversionEventId writes zero new events', async () => {
    setupDb([{ org_id: 'org-1', user_id: 'affiliate-1' }]);
    const baseTime = Math.floor(Date.now() / 1000);

    const first = await writeConversionRevenueEvent({
      conversionEventId: 'conv-uuid-5',
      tenantId: 'tenant-1',
      affiliateId: 'affiliate-1',
      grossAmountUsd: 100,
      commissionUsd: 20,
      attributedAt: baseTime,
      offerId: 'offer-1',
    });
    const second = await writeConversionRevenueEvent({
      conversionEventId: 'conv-uuid-5',
      tenantId: 'tenant-1',
      affiliateId: 'affiliate-1',
      grossAmountUsd: 100,
      commissionUsd: 20,
      attributedAt: baseTime,
      offerId: 'offer-1',
    });

    expect(first).toEqual({ written: 1, skipped: 0 });
    expect(second).toEqual({ written: 0, skipped: 1 });
    expect(await selectEvents()).toHaveLength(1);
  });

  it('handles different conversionEventIds as separate rows', async () => {
    setupDb([{ org_id: 'org-1', user_id: 'affiliate-1' }]);
    const baseTime = Math.floor(Date.now() / 1000);

    await writeConversionRevenueEvent({
      conversionEventId: 'conv-uuid-a',
      tenantId: 'tenant-1',
      affiliateId: 'affiliate-1',
      grossAmountUsd: 100,
      commissionUsd: 20,
      attributedAt: baseTime,
      offerId: 'offer-1',
    });
    await writeConversionRevenueEvent({
      conversionEventId: 'conv-uuid-b',
      tenantId: 'tenant-1',
      affiliateId: 'affiliate-1',
      grossAmountUsd: 50,
      commissionUsd: 15,
      attributedAt: baseTime,
      offerId: 'offer-2',
    });

    const events = await selectEvents();
    expect(events).toHaveLength(2);
    expect(events[0]?.id).toBe('conv_conv-uuid-a');
    expect(events[1]?.id).toBe('conv_conv-uuid-b');
    expect(events[0]?.asset_id).toBe('offer-1');
    expect(events[1]?.asset_id).toBe('offer-2');
  });
});