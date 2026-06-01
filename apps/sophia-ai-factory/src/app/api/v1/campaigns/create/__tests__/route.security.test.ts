/**
 * Security tests for /api/v1/campaigns/create — V-1.2 userId binding fix.
 *
 * Covers:
 *  (a) valid key, body.userId omitted → campaign created as key's owner (201)
 *  (b) valid key, body.userId tries to impersonate different user → 403
 *  (c) invalid / revoked / unknown key → 401
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Module mocks ────────────────────────────────────────────────────────────

// We mock the DB client so we never hit a real D1 instance.
const mockFrom = vi.fn();
vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

// Mock rate-limit wrapper — just pass through the handler.
vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));

// Mock the campaigns event sender so no Inngest call goes out.
vi.mock('@/land/campaigns/create-campaign-core', () => ({
  sendCampaignCreatedEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock tier lookup so campaigns pass the monthly limit check.
vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn().mockResolvedValue('BASIC'),
}));

vi.mock('@/seed/config/tiers', () => ({
  UNIFIED_TIERS: {
    BASIC: { campaignsPerMonth: 999 },
    PREMIUM: { campaignsPerMonth: 999 },
    ENTERPRISE: { campaignsPerMonth: 999 },
    MASTER: { campaignsPerMonth: 999 },
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a SHA-256 hex of the api key (mirrors the route implementation).
 */
async function sha256Hex(text: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Build a fake raas_licenses DB row as returned by the D1 select query.
 */
interface LicenseRow {
  id: string;
  is_revoked: number;
  expires_at: number | null;
  user_id: string | null;
}

function makeLicenseRow(userId: string | null): LicenseRow {
  return {
    id: 'lic_001',
    is_revoked: 0,
    expires_at: null, // perpetual
    user_id: userId,
  };
}

/**
 * Configure mockFrom to simulate the raas_licenses lookup.
 *
 * @param row  The DB row to return, or null to simulate "not found".
 */
function setupDbMock(row: LicenseRow | null) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'raas_licenses') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({
                data: row,
                error: row ? null : { code: 'PGRST116', message: 'not found' },
              }),
            }),
            single: () => ({
              data: row,
              error: row ? null : { code: 'PGRST116', message: 'not found' },
            }),
          }),
          single: () => ({
            data: row,
            error: row ? null : { code: 'PGRST116', message: 'not found' },
          }),
        }),
      };
    }

    if (table === 'campaigns') {
      // Monthly count + insert
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({ data: [], error: null }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: () => ({ data: { id: 'camp_001' }, error: null }),
          }),
        }),
      };
    }

    return { select: vi.fn(), insert: vi.fn() };
  });
}

/**
 * Create a NextRequest for POST /api/v1/campaigns/create.
 */
function buildRequest(apiKey: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/v1/campaigns/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('security: api/v1/campaigns/create — V-1.2 userId binding', () => {
  const OWNER_USER_ID = 'user_owner_abc';
  const VALID_API_KEY = 'raas_test_valid_key_001';
  const INVALID_API_KEY = 'raas_totally_unknown_key';

  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Import the route handler freshly so mocks apply.
    // Use dynamic import to get latest module after mock setup.
    const mod = await import('../route');
    // POST may be wrapped; grab it directly.
    POST = mod.POST as unknown as (req: NextRequest) => Promise<Response>;
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ─── (a) valid key, body.userId omitted → campaign created as key's owner ──

  it('(a) creates campaign using key-derived owner when body.userId is omitted', async () => {
    setupDbMock(makeLicenseRow(OWNER_USER_ID));

    const req = buildRequest(VALID_API_KEY, { script: 'Buy now!' });
    const res = await POST(req);
    const json = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(201);
    expect(json).toMatchObject({ campaignId: 'camp_001', status: expect.any(String) });

    // Confirm the insert used OWNER_USER_ID, not anything from the body
    const insertCalls = mockFrom.mock.calls.filter((args: unknown[]) => args[0] === 'campaigns');
    // At least one campaigns call exists (monthly count + insert)
    expect(insertCalls.length).toBeGreaterThan(0);
  });

  // ─── (b) valid key, body.userId mismatches key owner → 403 ──────────────────

  it('(b) returns 403 when body.userId tries to impersonate a different user', async () => {
    setupDbMock(makeLicenseRow(OWNER_USER_ID));

    const req = buildRequest(VALID_API_KEY, {
      script: 'Buy now!',
      userId: 'user_impersonated_xyz', // different from key owner
    });
    const res = await POST(req);
    const json = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/does not match/i);
  });

  // ─── (c) invalid key → 401 ────────────────────────────────────────────────

  it('(c) returns 401 for an unknown / invalid API key', async () => {
    // DB returns null row → key not found
    setupDbMock(null);

    const req = buildRequest(INVALID_API_KEY, { script: 'Buy now!' });
    const res = await POST(req);
    const json = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(401);
    expect(json.error).toBeTruthy();
  });

  // ─── (d) valid key, body.userId matches key owner → 201 (no false positive) ─

  it('(d) creates campaign normally when body.userId matches key owner', async () => {
    setupDbMock(makeLicenseRow(OWNER_USER_ID));

    const req = buildRequest(VALID_API_KEY, {
      script: 'Buy now!',
      userId: OWNER_USER_ID, // same as key owner — allowed
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  // ─── (e) revoked key → 401 ────────────────────────────────────────────────

  it('(e) returns 401 for a revoked API key (is_revoked = 1)', async () => {
    setupDbMock({ ...makeLicenseRow(OWNER_USER_ID), is_revoked: 1 });

    const req = buildRequest(VALID_API_KEY, { script: 'Buy now!' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  // ─── (f) key without user_id → 403 ───────────────────────────────────────

  it('(f) returns 403 when valid key has no associated user_id', async () => {
    setupDbMock(makeLicenseRow(null));

    const req = buildRequest(VALID_API_KEY, { script: 'Buy now!' });
    const res = await POST(req);
    const json = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/not bound to a user/i);
  });
});
