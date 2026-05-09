/**
 * POST /api/raas/missions tests — BYOK wiring (Wave 14 J3)
 *
 * Covers:
 *  1. Happy path with model field → INSERT includes byok columns
 *  2. Missing BYOK provider → 400 error
 *  3. No model field → INSERT with NULL byok columns (backwards compat)
 *  4. Invalid model schema → 400 error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock user auth ───────────────────────────────────────────────────────────
const MOCK_USER = { id: 'user-abc-123', email: 'test@example.com' };

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(async () => MOCK_USER),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// ── Track last inserted row ──────────────────────────────────────────────────
let lastInserted: Record<string, unknown> | null = null;
let mockUserApiKeyRows: Array<{ user_id: string }> = [];

/** Build a thenable chain that resolves to `result` when awaited. */
function makeThenable<T>(result: T) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'is', 'limit', 'order', 'range'];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (res?: (v: T) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res as never, rej as never);
  return chain;
}

const mockInsertChain = {
  select: vi.fn().mockReturnThis(),
  single: vi.fn(async () => ({
    data: { id: 'mission-xyz', ...lastInserted },
    error: null,
  })),
};

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'user_api_keys') {
      const rows = mockUserApiKeyRows.length > 0 ? mockUserApiKeyRows : null;
      return makeThenable({ data: rows, error: null });
    }
    // missions table
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn(async () => ({ data: [], error: null, count: 0 })),
      insert: vi.fn((row: Record<string, unknown>) => {
        lastInserted = row;
        return mockInsertChain;
      }),
    };
  }),
};

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => mockDb),
}));

import { POST } from '../route';

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/raas/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/raas/missions — BYOK wiring', () => {
  beforeEach(() => {
    lastInserted = null;
    mockUserApiKeyRows = [];
    vi.clearAllMocks();
  });

  it('happy path — model field present, provider configured → 201 with byok columns', async () => {
    mockUserApiKeyRows = [{ user_id: MOCK_USER.id }];

    const req = makePostRequest({
      title: 'Test Mission',
      command: 'content:blog',
      params: { topic: 'AI' },
      model: { providerId: 'anthropic', modelId: 'claude-sonnet-4-6' },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(lastInserted?.byok_provider_id).toBe('anthropic');
    expect(lastInserted?.byok_model_id).toBe('claude-sonnet-4-6');
  });

  it('missing BYOK provider → 400 with provider not configured error', async () => {
    mockUserApiKeyRows = []; // no rows = provider not configured

    const req = makePostRequest({
      title: 'Test Mission',
      command: 'content:blog',
      params: {},
      model: { providerId: 'openrouter', modelId: 'openai/gpt-4o' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string; provider: string };
    expect(body.error).toBe('Provider not configured');
    expect(body.provider).toBe('openrouter');
    expect(lastInserted).toBeNull();
  });

  it('no model field → INSERT with NULL byok columns (backwards compat)', async () => {
    const req = makePostRequest({
      title: 'Legacy Mission',
      command: 'proposal:create',
      params: { company: 'Acme' },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(lastInserted?.byok_provider_id).toBeNull();
    expect(lastInserted?.byok_model_id).toBeNull();
  });

  it('invalid model schema — missing modelId → 400 validation error', async () => {
    const req = makePostRequest({
      title: 'Bad Mission',
      command: 'proposal:create',
      params: {},
      model: { providerId: 'anthropic' }, // missing modelId
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(lastInserted).toBeNull();
  });

  it('invalid model schema — empty providerId → 400 validation error', async () => {
    const req = makePostRequest({
      title: 'Bad Mission',
      command: 'proposal:create',
      params: {},
      model: { providerId: '', modelId: 'gpt-4o' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(lastInserted).toBeNull();
  });

  it('NL mode with model field, provider configured → 201 with byok columns', async () => {
    mockUserApiKeyRows = [{ user_id: MOCK_USER.id }];

    const req = makePostRequest({
      mode: 'nl',
      prompt: 'Write a blog post about AI automation',
      model: { providerId: 'openrouter', modelId: 'openai/gpt-4o' },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(lastInserted?.byok_provider_id).toBe('openrouter');
    expect(lastInserted?.byok_model_id).toBe('openai/gpt-4o');
    expect(lastInserted?.command).toBe('nl_decompose');
  });
});
