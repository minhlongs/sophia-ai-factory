/**
 * Unit tests: recordPerformanceEventIdempotent — INSERT OR IGNORE semantics
 * against a real SQLite database (node:sqlite via shared D1 shim, no mocks).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PerformanceEvent } from '@/seed/types/creative-domain';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

// vi.hoisted: the shared D1 shim imports getD1 at module load, so the mock
// ref must exist before any import runs.
const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));

import { recordPerformanceEventIdempotent } from '../events';

function makeEvent(overrides: Partial<PerformanceEvent> = {}): PerformanceEvent {
  return {
    id: 'rev_user-1_vid-1_2026-08-01',
    workspaceId: 'org-1',
    assetId: 'vid-1',
    projectId: 'vid-1',
    entityType: 'video',
    entityId: 'vid-1',
    channel: 'youtube',
    eventType: 'revenue',
    count: 1,
    valueCents: 250,
    recordedAt: Date.UTC(2026, 7, 1),
    rawData: { source: 'youtube-analytics', date: '2026-08-01' },
    ...overrides,
  };
}

describe('recordPerformanceEventIdempotent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetD1.mockResolvedValue(makeD1(freshDb()));
  });

  it('inserts a new row and returns true', async () => {
    const inserted = await recordPerformanceEventIdempotent(makeEvent());
    expect(inserted).toBe(true);

    const db = await mockGetD1();
    const row = await db
      .prepare('SELECT id, workspace_id, event_type, value_cents FROM performance_events WHERE id = ?')
      .bind('rev_user-1_vid-1_2026-08-01')
      .first();
    expect(row).toMatchObject({
      id: 'rev_user-1_vid-1_2026-08-01',
      workspace_id: 'org-1',
      event_type: 'revenue',
      value_cents: 250,
    });
  });

  it('re-insert with same id returns false and adds no rows', async () => {
    expect(await recordPerformanceEventIdempotent(makeEvent())).toBe(true);
    expect(await recordPerformanceEventIdempotent(makeEvent())).toBe(false);

    const db = await mockGetD1();
    const { results } = await db
      .prepare('SELECT id FROM performance_events')
      .all();
    expect(results).toHaveLength(1);
  });

  it('re-insert does not overwrite the original row values', async () => {
    await recordPerformanceEventIdempotent(makeEvent({ valueCents: 250 }));
    await recordPerformanceEventIdempotent(makeEvent({ valueCents: 999 }));

    const db = await mockGetD1();
    const row = await db
      .prepare('SELECT value_cents FROM performance_events WHERE id = ?')
      .bind('rev_user-1_vid-1_2026-08-01')
      .first();
    expect(row).toMatchObject({ value_cents: 250 });
  });

  it('different ids insert separate rows', async () => {
    expect(await recordPerformanceEventIdempotent(makeEvent())).toBe(true);
    expect(
      await recordPerformanceEventIdempotent(makeEvent({ id: 'rev_user-1_vid-1_2026-08-02' })),
    ).toBe(true);

    const db = await mockGetD1();
    const { results } = await db.prepare('SELECT id FROM performance_events').all();
    expect(results).toHaveLength(2);
  });

  it('throws D1_UNAVAILABLE when getD1 returns null', async () => {
    mockGetD1.mockResolvedValue(null);
    await expect(recordPerformanceEventIdempotent(makeEvent())).rejects.toThrow(
      'D1 not available',
    );
  });
});
