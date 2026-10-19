import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), logger: { error: vi.fn() } }));
vi.mock('@/seed/db/client', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: mocks.logger }));

import { createCampaignRecord, fetchUserProjects, updateCampaignForRender } from './automation-db-helpers';

function createCampaignDb(result: { data?: unknown; error?: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const order = vi.fn().mockResolvedValue(result);
  let eqCalls = 0;
  const eq = vi.fn(() => {
    eqCalls++;
    return eqCalls % 2 === 0 ? Promise.resolve(result) : { eq, order };
  });
  const update = vi.fn(() => ({ eq }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert, update, select: vi.fn(() => ({ eq: vi.fn(() => ({ order })) })) }));
  return { db: { from }, from, insert, select, single, update, eq, order };
}

describe('automation campaign database helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the created campaign id', async () => {
    const fixture = createCampaignDb({ data: { id: 'campaign-1' }, error: null });
    mocks.createServerClient.mockReturnValue(fixture.db);

    await expect(createCampaignRecord('user-1', 'topic', 'audience')).resolves.toEqual({ id: 'campaign-1' });
    expect(fixture.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', status: 'draft' }));
  });

  it.each([
    ['database error', { data: { id: 'campaign-1' }, error: new Error('write failed') }],
    ['missing returned row', { data: null, error: null }],
  ])('returns an error when campaign creation has %s', async (_label, result) => {
    const fixture = createCampaignDb(result);
    mocks.createServerClient.mockReturnValue(fixture.db);

    await expect(createCampaignRecord('user-1', 'topic', 'audience')).resolves.toEqual({ error: 'Failed to initialize campaign' });
    expect(mocks.logger.error).toHaveBeenCalled();
  });

  it('returns success when render status updates', async () => {
    const fixture = createCampaignDb({ error: null });
    mocks.createServerClient.mockReturnValue(fixture.db);

    await expect(updateCampaignForRender('campaign-1', 'user-1')).resolves.toEqual({ success: true });
    expect(fixture.update).toHaveBeenCalledWith({ status: 'processing_video' });
  });

  it('returns an error when render status update fails', async () => {
    const fixture = createCampaignDb({ error: new Error('write failed') });
    mocks.createServerClient.mockReturnValue(fixture.db);

    await expect(updateCampaignForRender('campaign-1', 'user-1')).resolves.toEqual({ error: 'Failed to update status' });
    expect(mocks.logger.error).toHaveBeenCalled();
  });

  it('returns projects newest first and defaults null results to an empty list', async () => {
    const rows = [{ id: 'campaign-1' }];
    const fixture = createCampaignDb({ data: rows, error: null });
    mocks.createServerClient.mockReturnValue(fixture.db);
    await expect(fetchUserProjects('user-1')).resolves.toEqual(rows);

    const emptyFixture = createCampaignDb({ data: null, error: null });
    mocks.createServerClient.mockReturnValue(emptyFixture.db);
    await expect(fetchUserProjects('user-1')).resolves.toEqual([]);
  });

  it('returns an empty list when project lookup fails', async () => {
    const fixture = createCampaignDb({ data: null, error: new Error('read failed') });
    mocks.createServerClient.mockReturnValue(fixture.db);

    await expect(fetchUserProjects('user-1')).resolves.toEqual([]);
    expect(mocks.logger.error).toHaveBeenCalled();
  });
});
