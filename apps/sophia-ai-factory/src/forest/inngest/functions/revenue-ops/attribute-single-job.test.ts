import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StepRunner } from './attribute-single-job';
import type { UnattributedJobRow } from './types';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  logger: { debug: vi.fn() },
  selectLastTouch: vi.fn(),
  resolveWorkspaceId: vi.fn(),
  fetchRevenueEvents: vi.fn(),
  fetchClaimedEventIds: vi.fn(),
  writeProvenance: vi.fn(),
  updateJobEconomics: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({ getD1: mocks.getD1 }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: mocks.logger }));
vi.mock('@/seed/types/creative-job-economics', () => ({ selectLastTouch: mocks.selectLastTouch }));
vi.mock('./attribution-processor', () => ({
  resolveWorkspaceId: mocks.resolveWorkspaceId,
  fetchRevenueEvents: mocks.fetchRevenueEvents,
  fetchClaimedEventIds: mocks.fetchClaimedEventIds,
  writeProvenance: mocks.writeProvenance,
  updateJobEconomics: mocks.updateJobEconomics,
}));

import { attributeSingleJob } from './attribute-single-job';

const job: UnattributedJobRow = {
  id: 'job-42', user_id: 'user-9', completed_at: 1_700_000_000, provider_cost: 125,
};
const winner = {
  sourceEventId: 'event-new', sourceType: 'revenue', channel: 'youtube', valueCents: 4_500,
  recordedAt: 1_700_000_000_000,
};

function makeStep(): StepRunner {
  return {
    run: vi.fn(async (_name: string, callback: () => Promise<unknown>) => callback()),
  } as unknown as StepRunner;
}

describe('attributeSingleJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getD1.mockResolvedValue({});
    mocks.resolveWorkspaceId.mockResolvedValue('workspace-3');
    mocks.fetchRevenueEvents.mockResolvedValue([{
      id: 'event-new', event_type: 'revenue', channel: 'youtube', value_cents: 4_500,
      recorded_at: 1_700_000_000_000,
    }]);
    mocks.fetchClaimedEventIds.mockResolvedValue([]);
    mocks.selectLastTouch.mockReturnValue(winner);
    mocks.writeProvenance.mockResolvedValue(true);
    mocks.updateJobEconomics.mockResolvedValue(undefined);
  });

  it('attributes a job from the latest unclaimed event and writes economics', async () => {
    const step = makeStep();

    await expect(attributeSingleJob(step, job)).resolves.toBe('attributed');

    expect(mocks.resolveWorkspaceId).toHaveBeenCalledWith({}, job.user_id);
    expect(mocks.fetchRevenueEvents).toHaveBeenCalledWith({}, 'workspace-3', job.completed_at * 1_000);
    expect(mocks.fetchClaimedEventIds).toHaveBeenCalledWith({}, ['event-new']);
    expect(mocks.selectLastTouch).toHaveBeenCalledWith([{
      sourceEventId: 'event-new', sourceType: 'revenue', channel: 'youtube',
      valueCents: 4_500, recordedAt: 1_700_000_000_000,
    }], { jobCompletedAt: job.completed_at * 1_000, windowDays: 30 });
    expect(mocks.writeProvenance).toHaveBeenCalledWith({}, job, winner, job.completed_at * 1_000);
    expect(mocks.updateJobEconomics).toHaveBeenCalledWith({}, job.id, winner.valueCents, job.provider_cost);
    expect(vi.mocked(step.run).mock.calls.map(([name]) => name)).toEqual([
      'resolve-workspace-job-42', 'fetch-revenue-events-job-42', 'fetch-claimed-job-42',
      'write-provenance-job-42', 'update-job-economics-job-42',
    ]);
  });

  it('skips when workspace resolution fails without fetching events', async () => {
    mocks.resolveWorkspaceId.mockResolvedValue(null);

    await expect(attributeSingleJob(makeStep(), job)).resolves.toBe('skipped');

    expect(mocks.logger.debug).toHaveBeenCalledWith(
      '[revenue-attribution] Workspace unresolved — skipping job', { jobId: job.id },
    );
    expect(mocks.fetchRevenueEvents).not.toHaveBeenCalled();
  });

  it('skips jobs with no revenue events', async () => {
    mocks.fetchRevenueEvents.mockResolvedValue([]);

    await expect(attributeSingleJob(makeStep(), job)).resolves.toBe('skipped');

    expect(mocks.fetchClaimedEventIds).not.toHaveBeenCalled();
    expect(mocks.selectLastTouch).not.toHaveBeenCalled();
  });

  it('does not claim an event already attributed to another job', async () => {
    mocks.fetchClaimedEventIds.mockResolvedValue(['event-new']);
    mocks.selectLastTouch.mockReturnValue(null);

    await expect(attributeSingleJob(makeStep(), job)).resolves.toBe('skipped');

    expect(mocks.selectLastTouch).toHaveBeenCalledWith([], expect.objectContaining({ jobCompletedAt: job.completed_at * 1_000 }));
    expect(mocks.writeProvenance).not.toHaveBeenCalled();
  });

  it('skips when another invocation already owns the provenance row', async () => {
    mocks.writeProvenance.mockResolvedValue(false);

    await expect(attributeSingleJob(makeStep(), job)).resolves.toBe('skipped');

    expect(mocks.logger.debug).toHaveBeenCalledWith(
      '[revenue-attribution] Provenance already owned — skipping',
      { jobId: job.id, sourceEventId: winner.sourceEventId },
    );
    expect(mocks.updateJobEconomics).not.toHaveBeenCalled();
  });

  it('fails the step when the D1 binding is missing', async () => {
    mocks.getD1.mockResolvedValue(null);

    await expect(attributeSingleJob(makeStep(), job)).rejects.toThrow('D1 database binding not available');
    expect(mocks.resolveWorkspaceId).not.toHaveBeenCalled();
  });
});
