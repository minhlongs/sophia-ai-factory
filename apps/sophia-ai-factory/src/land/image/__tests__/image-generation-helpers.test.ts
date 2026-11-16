/**
 * Tier entitlement is enforced inside the MuAPI spending path.
 *
 * `submitMuApiImageJob` refuses a model the customer's tier does not include
 * before it resolves any credential or dispatches a provider call, so a caller
 * that forgets its own pre-check cannot buy a model the tier did not pay for.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSubmitMediaJob, mockInsert, mockResolveUserApiKey, mockFrom } = vi.hoisted(() => ({
  mockSubmitMediaJob: vi.fn(),
  mockInsert: vi.fn(),
  mockResolveUserApiKey: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/tree/clients/muapi-media-client', () => ({
  submitMediaJob: mockSubmitMediaJob,
}));

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: mockResolveUserApiKey,
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { submitMuApiImageJob } from '../image-generation-helpers';
import type { GenerateImageJobInput } from '../image-generation-orchestrator';

/** Dedupe lookup chain: select → eq → eq → eq → order → limit. */
interface DedupeQuery {
  select: (columns: string) => DedupeQuery;
  eq: (column: string, value: unknown) => DedupeQuery;
  order: (column: string, options: unknown) => DedupeQuery;
  limit: (count: number) => Promise<{ data: unknown[]; error: null }>;
}

function buildDedupeQuery(rows: unknown[] = []): DedupeQuery {
  const query: DedupeQuery = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => Promise.resolve({ data: rows, error: null }),
  };
  return query;
}

function baseInput(overrides: Partial<GenerateImageJobInput> = {}): GenerateImageJobInput {
  return {
    userId: 'user-1',
    tier: 'BASIC',
    prompt: 'A sunset over Hanoi',
    model: 'flux-schnell',
    aspectRatio: '1:1',
    ...overrides,
  };
}

describe('submitMuApiImageJob tier entitlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => ({
      select: () => buildDedupeQuery(),
      insert: mockInsert.mockResolvedValue({ error: null }),
    }));
  });

  it('refuses a model outside the tier without resolving credentials or dispatching', async () => {
    const result = await submitMuApiImageJob(baseInput({ tier: 'BASIC', model: 'flux-dev' }));

    expect(result).toEqual({
      success: false,
      error: 'Model "flux-dev" is not available for your BASIC plan.',
      code: 'TIER_GATE',
    });
    expect(mockResolveUserApiKey).not.toHaveBeenCalled();
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('refuses an unknown tier rather than granting the full model set', async () => {
    const result = await submitMuApiImageJob(baseInput({ tier: 'ULTRAMAX', model: 'flux-dev' }));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('TIER_GATE');
    expect(mockResolveUserApiKey).not.toHaveBeenCalled();
  });

  it('dispatches a tier-entitled model with the customer key', async () => {
    mockResolveUserApiKey.mockResolvedValue('customer_byok_muapi_key');
    mockSubmitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'muapi_job_7', status: 'pending', type: 'image', model: 'flux-schnell' },
    });

    const result = await submitMuApiImageJob(baseInput({ tier: 'BASIC', model: 'flux-schnell' }));

    expect(result).toEqual({ success: true, jobId: 'muapi_job_7' });
    expect(mockResolveUserApiKey).toHaveBeenCalledWith('user-1', 'muapi');
    expect(mockSubmitMediaJob).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'image', model: 'flux-schnell' }),
      'customer_byok_muapi_key',
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'muapi', cost_classification: 'UNMETERED' }),
    );
  });

  it('still refuses a tier-entitled model when the customer has no BYOK key', async () => {
    mockResolveUserApiKey.mockResolvedValue(null);

    const result = await submitMuApiImageJob(baseInput({ tier: 'PREMIUM', model: 'hidream' }));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('NO_API_KEY');
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });
});

/**
 * `tier` reaches this function as an unvalidated string. Only a canonical tier
 * name may reach a model allowlist: an unrecognised value must not fall back to
 * BASIC's models, and an inherited Object.prototype key must not resolve to a
 * non-list that throws instead of returning a refusal.
 */
describe('submitMuApiImageJob rejects any tier outside the server allowlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => ({
      select: () => buildDedupeQuery(),
      insert: mockInsert.mockResolvedValue({ error: null }),
    }));
    mockResolveUserApiKey.mockResolvedValue('customer_byok_muapi_key');
    mockSubmitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'muapi_job_7', status: 'pending', type: 'image', model: 'flux-schnell' },
    });
  });

  const rejectedTiers: Array<[string, unknown]> = [
    ['an unrecognised plan name', 'ULTRAMAX'],
    ['an empty string', ''],
    ['null', null],
    ['undefined', undefined],
    ['a lowercase plan name', 'basic'],
    ['a whitespace-padded plan name', ' BASIC '],
    ['a numeric value', 1],
    ['a non-array object', {}],
    ['a Symbol', Symbol('BASIC')],
    ['a BigInt', 1n],
    ['the inherited __proto__ key', '__proto__'],
    ['the inherited constructor key', 'constructor'],
    ['the inherited toString key', 'toString'],
  ];

  it.each(rejectedTiers)(
    'refuses %s before resolving credentials or dispatching, even for a BASIC model',
    async (_label, tier) => {
      const result = await submitMuApiImageJob(
        baseInput({ tier: tier as string, model: 'flux-schnell' }),
      );

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.code).toBe('TIER_GATE');
      expect(mockResolveUserApiKey).not.toHaveBeenCalled();
      expect(mockSubmitMediaJob).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    },
  );

  it.each(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const)(
    'still admits the canonical %s tier with an entitled model',
    async (tier) => {
      const result = await submitMuApiImageJob(baseInput({ tier, model: 'flux-schnell' }));

      expect(result).toEqual({ success: true, jobId: 'muapi_job_7' });
      expect(mockSubmitMediaJob).toHaveBeenCalledTimes(1);
    },
  );
});
