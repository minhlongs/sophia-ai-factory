/**
 * Additional coverage tests for tree/creative-identity.
 * Covers: newIdentityId, listIdentityVersions, D1-unavailable paths,
 * rowToDomain/domainToRow branch edges, and non-Error throw wrapping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

import {
  newIdentityId,
  getActiveIdentity,
  getIdentity,
  listIdentityVersions,
  createIdentity,
  updateIdentity,
  deactivateIdentity,
  CreativeIdentityError,
} from '../types';

interface PreparedStmt {
  first?: unknown;
  run?: unknown;
  all?: unknown;
}

function buildDb(stmts: PreparedStmt[]) {
  let i = 0;
  return {
    prepare: vi.fn(() => {
      const stmt = stmts[i++];
      if (!stmt) throw new Error('No more prepared stmts mocked');
      return {
        bind: () => ({
          first: async () => stmt.first,
          run: async () => (typeof stmt.run === 'function' ? stmt.run() : stmt.run),
          all: async () => stmt.all ?? { results: [], meta: { changes: 0, duration: 1 } },
        }),
      };
    }),
  };
}

function stmt(opts: PreparedStmt = {}): PreparedStmt {
  return { first: opts.first, run: opts.run, all: opts.all };
}

const BASE_ROW = () => ({
  id: 'ci_test',
  workspace_id: 'ws_001',
  brand_id: 'brand_001',
  voice_description: 'warm and approachable',
  tone: 'warm',
  formality: 3,
  energy: 4,
  beliefs: JSON.stringify(['innovation']),
  positioning: 'premium',
  target_audience: 'professionals',
  forbidden_patterns: JSON.stringify(['no jargon']),
  required_disclosures: JSON.stringify(['sponsored']),
  preferred_formats: JSON.stringify([{ type: 'video_short', platform: 'youtube', constraints: [] }]),
  reference_works: JSON.stringify(['ref_001']),
  version: 1,
  is_active: 1,
  created_at: 1000,
  updated_at: 1000,
  updated_by: 'user_001',
});

function makeIdentity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ci_new',
    workspaceId: 'ws_001',
    brandId: 'brand_001',
    voiceDescription: 'warm',
    tone: 'warm' as const,
    formality: 3,
    energy: 4,
    beliefs: ['trust'],
    positioning: 'approachable',
    targetAudience: 'general',
    forbiddenPatterns: ['no hype'],
    requiredDisclosures: [],
    preferredFormats: [{ type: 'video_short' as const, platform: 'youtube' as const, constraints: [] }],
    referenceWorks: [],
    version: 0,
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: 'user_001',
    ...overrides,
  };
}

describe('tree/creative-identity — extended coverage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('newIdentityId', () => {
    it('returns a string prefixed with ci_', () => {
      const id = newIdentityId();
      expect(id).toMatch(/^ci_[0-9a-f]{32}$/);
    });

    it('generates unique ids on successive calls', () => {
      const a = newIdentityId();
      const b = newIdentityId();
      expect(a).not.toBe(b);
    });
  });

  describe('listIdentityVersions', () => {
    it('returns all versions ordered by version desc', async () => {
      const row1 = { ...BASE_ROW(), id: 'ci_v2', version: 2 };
      const row2 = { ...BASE_ROW(), id: 'ci_v1', version: 1, is_active: 0 };
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ all: { results: [row1, row2], meta: {} } })]),
      );

      const result = await listIdentityVersions('ws_001');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ci_v2');
      expect(result[0].version).toBe(2);
      expect(result[1].id).toBe('ci_v1');
      expect(result[1].isActive).toBe(false);
    });

    it('returns empty array when no versions exist', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ all: { results: [], meta: {} } })]),
      );
      const result = await listIdentityVersions('ws_empty');
      expect(result).toEqual([]);
    });

    it('handles undefined results gracefully', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ all: { results: undefined, meta: {} } })]),
      );
      const result = await listIdentityVersions('ws_001');
      expect(result).toEqual([]);
    });

    it('throws CreativeIdentityError when D1 is unavailable', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      await expect(listIdentityVersions('ws_001')).rejects.toThrow('D1 not available');
    });
  });

  describe('getActiveIdentity — D1 unavailable', () => {
    it('throws CreativeIdentityError with D1_UNAVAILABLE code', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      await expect(getActiveIdentity('ws_001')).rejects.toThrow(CreativeIdentityError);
      await expect(getActiveIdentity('ws_001')).rejects.toThrow('D1 not available');
    });
  });

  describe('getIdentity — D1 unavailable', () => {
    it('throws CreativeIdentityError with D1_UNAVAILABLE code', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      await expect(getIdentity('ci_001')).rejects.toThrow(CreativeIdentityError);
    });
  });

  describe('deactivateIdentity — D1 unavailable', () => {
    it('throws CreativeIdentityError with D1_UNAVAILABLE code', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      await expect(deactivateIdentity('ci_001')).rejects.toThrow('D1 not available');
    });
  });

  describe('rowToDomain branch coverage', () => {
    it('maps brand_id null to undefined', async () => {
      const row = { ...BASE_ROW(), brand_id: null };
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ first: row })]));
      const result = await getIdentity('ci_test');
      expect(result).not.toBeNull();
      expect(result!.brandId).toBeUndefined();
    });

    it('maps is_active 0 to isActive false', async () => {
      const row = { ...BASE_ROW(), is_active: 0 };
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ first: row })]));
      const result = await getIdentity('ci_test');
      expect(result).not.toBeNull();
      expect(result!.isActive).toBe(false);
    });
  });

  describe('createIdentity — non-Error throw', () => {
    it('wraps non-Error thrown value with unknown message', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ run: async () => { throw 'string error'; } })]),
      );
      const identity = makeIdentity();
      await expect(createIdentity(identity)).rejects.toThrow('Failed to create identity: unknown');
    });
  });

  describe('updateIdentity — non-Error throw', () => {
    it('wraps non-Error thrown value with unknown message', async () => {
      const existingRow = { ...BASE_ROW(), id: 'ci_old', version: 2 };
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({ first: existingRow }),
          stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
          stmt({ run: async () => { throw 42; } }),
        ]),
      );
      const identity = makeIdentity({ id: 'ci_old' });
      await expect(updateIdentity(identity)).rejects.toThrow('Failed to update identity: unknown');
    });
  });

  describe('domainToRow branch coverage via createIdentity', () => {
    it('maps undefined brandId to null and isActive false to 0', async () => {
      let capturedBinds: unknown[] = [];
      const db = {
        prepare: vi.fn(() => ({
          bind: (...args: unknown[]) => {
            capturedBinds = args;
            return {
              run: async () => ({ success: true, meta: { changes: 1, duration: 1 } }),
            };
          },
        })),
      };
      mocks.mockGetD1.mockReturnValue(db);

      const identity = makeIdentity({ brandId: undefined, isActive: false });
      await createIdentity(identity);

      // brand_id is bind index 2 (0-based), is_active is index 15
      expect(capturedBinds[2]).toBeNull();
      expect(capturedBinds[15]).toBe(0);
    });
  });
});
