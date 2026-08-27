/**
 * Unit tests: revenue event ingestion — normalization per source, zod
 * validation, atomic lock ownership, dedupe, stale-lock recovery.
 * Real SQLite DB (shared D1 shim), no fake-pass mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

// vi.hoisted: the shared D1 shim imports getD1 at module load, so the mock
// ref must exist before any import runs.
const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  buildRevenueEventId,
  eventTypeForSource,
  normalizeRevenueEvent,
  processRevenueEvent,
  type RevenueEventPayload,
} from '../revenue-events';

const PAYMENT_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT DEFAULT '{}',
  processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_events_event_id ON payment_events(event_id);`;

function basePayload(overrides: Partial<RevenueEventPayload> = {}): RevenueEventPayload {
  return {
    source: 'ad-revenue',
    externalId: 'yt-2026-08',
    amountCents: 12345,
    currency: 'USD',
    workspaceId: 'ws-1',
    assetId: 'asset-1',
    projectId: 'proj-1',
    recordedAtMs: 1756080000000,
    ...overrides,
  };
}

function setupDb(): ReturnType<typeof freshDb> {
  const raw = freshDb();
  raw.exec(PAYMENT_EVENTS_TABLE);
  mockGetD1.mockResolvedValue(makeD1(raw));
  return raw;
}

interface PerfRow {
  id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  channel: string;
  event_type: string;
  count: number;
  value_cents: number;
  recorded_at: number;
  raw_data: string | null;
}

async function selectPerfRows(): Promise<PerfRow[]> {
  const db = await mockGetD1();
  const { results } = await db
    .prepare('SELECT * FROM performance_events ORDER BY id')
    .all();
  return results as PerfRow[];
}

interface LockRow {
  event_id: string;
  event_type: string;
  processed: number;
  created_at: string;
}

async function selectLockRows(): Promise<LockRow[]> {
  const db = await mockGetD1();
  const { results } = await db
    .prepare('SELECT event_id, event_type, processed, created_at FROM payment_events ORDER BY event_id')
    .all();
  return results as LockRow[];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('normalization (pure)', () => {
  it('builds idempotent event id revenue_{source}_{externalId}', () => {
    expect(buildRevenueEventId('ad-revenue', 'yt-2026-08')).toBe('revenue_ad-revenue_yt-2026-08');
    expect(buildRevenueEventId('commerce', 'order-9')).toBe('revenue_commerce_order-9');
  });

  it('maps sponsorship source to sponsorship event type, others to revenue', () => {
    expect(eventTypeForSource('sponsorship')).toBe('sponsorship');
    expect(eventTypeForSource('ad-revenue')).toBe('revenue');
    expect(eventTypeForSource('affiliate')).toBe('revenue');
    expect(eventTypeForSource('commerce')).toBe('revenue');
  });

  it('normalizes a payload into a PerformanceEvent with full provenance', () => {
    const event = normalizeRevenueEvent(
      basePayload({ metadata: { network: 'adsense' } }),
    );
    expect(event.id).toBe('revenue_ad-revenue_yt-2026-08');
    expect(event.workspaceId).toBe('ws-1');
    expect(event.entityType).toBe('asset');
    expect(event.entityId).toBe('asset-1');
    expect(event.channel).toBe('ad-revenue');
    expect(event.eventType).toBe('revenue');
    expect(event.count).toBe(1);
    expect(event.valueCents).toBe(12345);
    expect(event.recordedAt).toBe(1756080000000);
    expect(event.rawData).toEqual({
      source: 'ad-revenue',
      externalId: 'yt-2026-08',
      currency: 'USD',
      network: 'adsense',
    });
  });

  it('falls back to externalId as entityId when assetId is absent', () => {
    const event = normalizeRevenueEvent(basePayload({ assetId: undefined }));
    expect(event.entityId).toBe('yt-2026-08');
    expect(event.assetId).toBe('');
  });
});

describe('processRevenueEvent — normalization per source', () => {
  it('writes an ad-revenue row with event_type=revenue', async () => {
    setupDb();
    const result = await processRevenueEvent(basePayload());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.inserted).toBe(true);
    expect(result.value.eventType).toBe('revenue');

    const rows = await selectPerfRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe('revenue');
    expect(rows[0].channel).toBe('ad-revenue');
    expect(rows[0].value_cents).toBe(12345);
    expect(rows[0].recorded_at).toBe(1756080000000);
  });

  it('writes a sponsorship row with event_type=sponsorship', async () => {
    setupDb();
    const result = await processRevenueEvent(
      basePayload({ source: 'sponsorship', externalId: 'spon-1', amountCents: 50000 }),
    );
    expect(result.ok).toBe(true);
    const rows = await selectPerfRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe('sponsorship');
    expect(rows[0].channel).toBe('sponsorship');
    expect(rows[0].value_cents).toBe(50000);
  });

  it('writes an affiliate row with event_type=revenue', async () => {
    setupDb();
    const result = await processRevenueEvent(
      basePayload({ source: 'affiliate', externalId: 'cb-777' }),
    );
    expect(result.ok).toBe(true);
    const rows = await selectPerfRows();
    expect(rows[0].event_type).toBe('revenue');
    expect(rows[0].channel).toBe('affiliate');
  });

  it('writes a commerce row with event_type=revenue', async () => {
    setupDb();
    const result = await processRevenueEvent(
      basePayload({ source: 'commerce', externalId: 'order-9' }),
    );
    expect(result.ok).toBe(true);
    const rows = await selectPerfRows();
    expect(rows[0].event_type).toBe('revenue');
    expect(rows[0].channel).toBe('commerce');
  });
});

describe('processRevenueEvent — validation', () => {
  it('rejects an invalid payload with INVALID_PAYLOAD and writes nothing', async () => {
    setupDb();
    const result = await processRevenueEvent({ source: 'unknown', externalId: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_PAYLOAD');
    expect(await selectPerfRows()).toHaveLength(0);
    expect(await selectLockRows()).toHaveLength(0);
  });

  it('rejects zero and negative amounts with NON_POSITIVE_AMOUNT', async () => {
    setupDb();
    const zero = await processRevenueEvent(basePayload({ amountCents: 0 }));
    const negative = await processRevenueEvent(basePayload({ amountCents: -5 }));
    expect(zero.ok).toBe(false);
    expect(negative.ok).toBe(false);
    if (!zero.ok) expect(zero.error.code).toBe('NON_POSITIVE_AMOUNT');
    if (!negative.ok) expect(negative.error.code).toBe('NON_POSITIVE_AMOUNT');
    expect(await selectPerfRows()).toHaveLength(0);
  });

  it('fails with DB_UNAVAILABLE when no D1 binding resolves', async () => {
    mockGetD1.mockResolvedValue(null);
    const result = await processRevenueEvent(basePayload());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DB_UNAVAILABLE');
  });
});

describe('processRevenueEvent — lock ownership + dedupe', () => {
  it('acquires the lock and marks it processed after a successful write', async () => {
    setupDb();
    await processRevenueEvent(basePayload());
    const locks = await selectLockRows();
    expect(locks).toHaveLength(1);
    expect(locks[0].event_id).toBe('revenue_ad-revenue_yt-2026-08');
    expect(locks[0].event_type).toBe('revenue.recorded');
    expect(locks[0].processed).toBe(1);
  });

  it('dedupes a duplicate delivery: exactly one performance row', async () => {
    setupDb();
    const first = await processRevenueEvent(basePayload());
    const second = await processRevenueEvent(basePayload());

    expect(first.ok).toBe(true);
    if (first.ok) expect(first.value.inserted).toBe(true);

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.inserted).toBe(false);
      expect(second.value.alreadyProcessed).toBe(true);
    }

    expect(await selectPerfRows()).toHaveLength(1);
    expect(await selectLockRows()).toHaveLength(1);
  });

  it('returns ALREADY_PROCESSING when another run holds a fresh lock', async () => {
    const raw = setupDb();
    // Simulate a concurrent run that grabbed the lock but has not finished.
    raw
      .prepare(
        `INSERT INTO payment_events (event_id, event_type, payload, processed, created_at)
         VALUES (?, 'revenue.recorded', '{}', 0, ?)`,
      )
      .run('revenue_ad-revenue_yt-2026-08', new Date().toISOString());

    const result = await processRevenueEvent(basePayload());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ALREADY_PROCESSING');
    expect(await selectPerfRows()).toHaveLength(0);
  });

  it('recovers a stale lock (>5 min) and reports alreadyProcessed', async () => {
    const raw = setupDb();
    const staleAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    raw
      .prepare(
        `INSERT INTO payment_events (event_id, event_type, payload, processed, created_at)
         VALUES (?, 'revenue.recorded', '{}', 0, ?)`,
      )
      .run('revenue_ad-revenue_yt-2026-08', staleAt);

    const result = await processRevenueEvent(basePayload());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.inserted).toBe(false);
      expect(result.value.alreadyProcessed).toBe(true);
    }

    // Stale lock is marked processed so it cannot block future deliveries.
    const locks = await selectLockRows();
    expect(locks[0].processed).toBe(1);
    // No double write: the crashed run never produced a row.
    expect(await selectPerfRows()).toHaveLength(0);
  });
});
