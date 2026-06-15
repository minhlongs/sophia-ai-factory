/**
 * Tests for affiliate-openrouter-niche-enhancer routing branches.
 *
 * Covers Phase 7C BYOK OpenRouter key resolution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AffiliateProgram } from '@/seed/types';
import { enhanceNicheScoreWithAI } from './affiliate-openrouter-niche-enhancer';
import { resetOpenRouterCircuit } from '@/seed/inference/openrouter-client';

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn((_userId, _provider, envFallback) =>
    Promise.resolve(envFallback ?? null),
  ),
}));

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';

const mockResolveByokKey = vi.mocked(resolveUserApiKey);

const program: AffiliateProgram = {
  id: 'p1',
  name: 'TestProgram',
  category: 'finance',
  description: 'demo',
} as AffiliateProgram;

const ORIGINAL_ENV = { ...process.env };

describe('enhanceNicheScoreWithAI()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
    mockResolveByokKey.mockImplementation((_u, _p, envFallback) =>
      Promise.resolve(envFallback ?? null),
    );
    resetOpenRouterCircuit();
    // Stub fetch globally for tests that hit OpenRouter
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it('returns null when OpenRouter key is not set', async () => {
    const score = await enhanceNicheScoreWithAI(program, 'fintech');
    expect(score).toBeNull();
  });

  it('calls OpenRouter and parses score successfully', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ choices: [{ message: { content: '72' } }] }),
    } as Response);

    const score = await enhanceNicheScoreWithAI(program, 'fintech');

    expect(score).toBe(72);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('7C: OpenRouter fetch uses BYOK-resolved key (user key wins over env)', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-env';
    mockResolveByokKey.mockResolvedValueOnce('sk-or-user-byok');
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ choices: [{ message: { content: '91' } }] }),
    } as Response);

    const score = await enhanceNicheScoreWithAI(program, 'fintech', 'user-xyz');

    expect(score).toBe(91);
    expect(mockResolveByokKey).toHaveBeenCalledWith(
      'user-xyz',
      'openrouter',
      'sk-or-env',
    );
    // Verify fetch called with Authorization header using BYOK key
    const fetchCall = mockFetch.mock.calls[0];
    const init = fetchCall[1] as RequestInit;
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer sk-or-user-byok',
      })
    );
  });

  it('7C: OpenRouter fetch skipped when BYOK resolver returns null (no env, no user key)', async () => {
    mockResolveByokKey.mockResolvedValueOnce(null);
    const mockFetch = vi.mocked(globalThis.fetch);

    const score = await enhanceNicheScoreWithAI(program, 'fintech', 'user-xyz');

    expect(score).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
