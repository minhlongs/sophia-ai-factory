/**
 * Schema-bound D1 integration test for `runSchedulerCron` and `insertPublishingJobRow`.
 *
 * Executes real SQL statements produced by `runSchedulerCron` and
 * `insertPublishingJobRow` against the migration-derived `publishing_jobs`
 * schema (`buildSchemaDatabase()`), catching any nonexistent column or table
 * reference that hand-stubbed mocks would hide.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSchemaDatabase, makeSchemaBoundD1, type SqliteDb } from '@/__tests__/integration/d1-schema-boundary';

const { mockInngestSend, state } = vi.hoisted(() => ({
  mockInngestSend: vi.fn(),
  state: { currentDb: null as unknown },
}));

vi.mock('@/seed/db/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/seed/db/client')>();
  return {
    ...original,
    createServerClient: vi.fn((override?: unknown) =>
      original.createServerClient((override ?? state.currentDb) as Parameters<typeof original.createServerClient>[0]),
    ),
  };
});

vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: mockInngestSend },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createServerClient } from '@/seed/db/client';
import { resolveSyntheticMediaDisclosure } from '@/tree/publishing/synthetic-media-disclosure';
import { runSchedulerCron } from '@/forest/publishing/scheduler-ops/scheduler-cron-runner';
import { insertPublishingJobRow } from '@/forest/publishing/scheduler-ops/slot-persistence';

describe('runSchedulerCron & insertPublishingJobRow against real migration-derived D1 schema', () => {
  let sqliteDb: SqliteDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInngestSend.mockResolvedValue({ ids: ['evt-schema-1'] });
    sqliteDb = buildSchemaDatabase().db;
    state.currentDb = makeSchemaBoundD1(sqliteDb);
  });

  it('inserts via insertPublishingJobRow with provider and dispatches via runSchedulerCron with provenance', async () => {
    const client = createServerClient();
    const jobId = await insertPublishingJobRow(client, {
      tenantId: 'ws_schema_1',
      videoJobId: 'vid_schema_1',
      channelId: 'ch_yt_1',
      provider: 'youtube',
      caption: 'Earn $5,000 per month passive income guaranteed.',
      hashtagsJson: '["shorts"]',
      privacyStatus: 'unlisted',
      scheduledAt: 1_700_000_000,
      nowSec: 1_700_000_000,
    });

    const cronRes = await runSchedulerCron({ nowSec: 1_700_000_100, limit: 10 });
    expect(cronRes).toEqual({
      processed: 1,
      dispatched: [jobId],
      skipped: 0,
    });

    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    const sent = mockInngestSend.mock.calls[0]![0];
    expect(sent.name).toBe('publish.scheduled');
    expect(resolveSyntheticMediaDisclosure({ provenance: sent.data.provenance }).blocked).toBe(true);
  });
});
