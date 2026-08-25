/**
 * Unit tests: writeYouTubeRevenueEvents — workspace resolution, idempotency,
 * zero-cent skipping, UTC-midnight recorded_at. Real SQLite DB (shared D1
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

import { writeYouTubeRevenueEvents } from '../revenue-ingestion';
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

describe('writeYouTubeRevenueEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes revenue events scoped to the resolved workspace', async () => {
    setupDb([{ org_id: 'org-1', user_id: 'user-1' }]);

    const result = await writeYouTubeRevenueEvents({
      userId: 'user-1',
      rows: [
        { videoId: 'vid-1', date: '2026-08-01', estimatedRevenueCents: 250 },
        { videoId: 'vid-2', date: '2026-08-01', estimatedRevenueCents: 100 },
      ],
    });

    expect(result).toEqual({ written: 2, skipped: 0 });
    const events = await selectEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: 'rev_user-1_vid-1_2026-08-01',
      workspace_id: 'org-1',
      asset_id: 'vid-1',
      project_id: 'vid-1',
      entity_type: 'video',
      entity_id: 'vid-1',
      channel: 'youtube',
      event_type: 'revenue',
      count: 1,
      value_cents: 250,
    });
    expect(JSON.parse(events[0]?.raw_data ?? '{}')).toEqual({
      source: 'youtube-analytics',
      date: '2026-08-01',
    });
  });

  it('skips all rows without throwing when user has no org membership', async () => {
    setupDb([]);

    const result = await writeYouTubeRevenueEvents({
      userId: 'user-no-org',
      rows: [{ videoId: 'vid-1', date: '2026-08-01', estimatedRevenueCents: 250 }],
    });

    expect(result).toEqual({ written: 0, skipped: 1 });
    expect(await selectEvents()).toHaveLength(0);
    expect(vi.mocked(logger.warn)).toHaveBeenCalled();
  });

  it('skips zero-cent rows (no noise events)', async () => {
    setupDb([{ org_id: 'org-1', user_id: 'user-1' }]);

    const result = await writeYouTubeRevenueEvents({
      userId: 'user-1',
      rows: [
        { videoId: 'vid-1', date: '2026-08-01', estimatedRevenueCents: 0 },
        { videoId: 'vid-1', date: '2026-08-02', estimatedRevenueCents: 150 },
      ],
    });

    expect(result).toEqual({ written: 1, skipped: 1 });
    const events = await selectEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe('rev_user-1_vid-1_2026-08-02');
  });

  it('stores recorded_at as UTC midnight epoch-ms of the row date', async () => {
    setupDb([{ org_id: 'org-1', user_id: 'user-1' }]);

    await writeYouTubeRevenueEvents({
      userId: 'user-1',
      rows: [{ videoId: 'vid-1', date: '2026-08-01', estimatedRevenueCents: 100 }],
    });

    const events = await selectEvents();
    expect(events[0]?.recorded_at).toBe(Date.UTC(2026, 7, 1, 0, 0, 0, 0));
  });

  it('is idempotent: second pass over same rows writes zero new events', async () => {
    setupDb([{ org_id: 'org-1', user_id: 'user-1' }]);
    const rows = [
      { videoId: 'vid-1', date: '2026-08-01', estimatedRevenueCents: 250 },
      { videoId: 'vid-1', date: '2026-08-02', estimatedRevenueCents: 100 },
    ];

    const first = await writeYouTubeRevenueEvents({ userId: 'user-1', rows });
    const second = await writeYouTubeRevenueEvents({ userId: 'user-1', rows });

    expect(first).toEqual({ written: 2, skipped: 0 });
    expect(second).toEqual({ written: 0, skipped: 2 });
    expect(await selectEvents()).toHaveLength(2);
  });

  it('returns zero counts for empty input without touching the DB', async () => {
    setupDb([]);
    const result = await writeYouTubeRevenueEvents({ userId: 'user-1', rows: [] });
    expect(result).toEqual({ written: 0, skipped: 0 });
  });
});
