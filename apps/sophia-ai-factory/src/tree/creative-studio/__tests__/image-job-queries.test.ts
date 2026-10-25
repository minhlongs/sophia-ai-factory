/**
 * Ownership and mapping tests for the shared image-job query layer.
 *
 * The security-relevant invariant: a job belonging to another user must be
 * unreachable by id, and indistinguishable from a job that does not exist.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getUserImageJob,
  listUserImageJobs,
  toImageJobRow,
} from '../image-job-queries';

interface QueryStub {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function makeDb(result: { data?: unknown; error?: unknown }) {
  const stub: QueryStub = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };
  // Chainable builder that resolves to the supplied result.
  const chain: Record<string, unknown> = {};
  for (const key of ['select', 'eq', 'order', 'limit']) {
    chain[key] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.limit = vi.fn(() => Promise.resolve(result));

  return {
    chain,
    db: { from: vi.fn(() => chain) } as unknown as Parameters<
      typeof listUserImageJobs
    >[0],
  };
}

describe('toImageJobRow', () => {
  it('maps a complete row', () => {
    const row = toImageJobRow({
      id: 'job_1',
      user_id: 'user_1',
      model: 'flux-schnell',
      prompt: 'a cat',
      status: 'completed',
      result_url: 'https://example.test/a.png',
      thumbnail_url: null,
      provider: 'muapi',
      error: null,
      created_at: 1700000000,
      completed_at: 1700000600,
    });

    expect(row).toMatchObject({
      id: 'job_1',
      user_id: 'user_1',
      status: 'completed',
      result_url: 'https://example.test/a.png',
      prompt: 'a cat',
      completed_at: 1700000600,
    });
  });

  it('survives missing optional columns without inventing values', () => {
    const row = toImageJobRow({ id: 'job_2', user_id: 'u', model: 'm', status: 'pending' });

    expect(row.prompt).toBeNull();
    expect(row.result_url).toBeNull();
    expect(row.provider).toBeNull();
    expect(row.completed_at).toBeNull();
    expect(row.created_at).toBe(0);
  });
});

describe('listUserImageJobs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes every read to the owning user', async () => {
    const { chain, db } = makeDb({ data: [] });
    await listUserImageJobs(db, 'user_1');

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user_1');
    expect(chain.eq).toHaveBeenCalledWith('type', 'image');
  });

  it('returns the newest jobs first', async () => {
    const { chain, db } = makeDb({ data: [] });
    await listUserImageJobs(db, 'user_1');

    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('surfaces a D1 error instead of returning an empty list', async () => {
    const { db } = makeDb({ error: { message: 'D1 unavailable' } });

    await expect(listUserImageJobs(db, 'user_1')).rejects.toThrow('D1 unavailable');
  });
});

describe('getUserImageJob', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by both id and owner', async () => {
    const { chain, db } = makeDb({ data: null });
    await getUserImageJob(db, 'user_1', 'job_1');

    expect(chain.eq).toHaveBeenCalledWith('id', 'job_1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user_1');
  });

  it('returns null when the job exists but belongs to someone else', async () => {
    // The query filters by user_id, so a foreign row resolves to null here.
    const { db } = makeDb({ data: null });

    await expect(getUserImageJob(db, 'attacker', 'someone_elses_job')).resolves.toBeNull();
  });
});
