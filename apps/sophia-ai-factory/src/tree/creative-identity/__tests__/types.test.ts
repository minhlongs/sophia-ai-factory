/**
 * Tests for tree/creative-identity CRUD + versioning (Sophia 2027 Phase 1).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

import {
  createIdentity,
  getActiveIdentity,
  updateIdentity,
  deactivateIdentity,
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
  voice_description: JSON.stringify([]),
  tone: 'professional',
  formality: 3,
  energy: 4,
  beliefs: JSON.stringify([]),
  positioning: 'premium',
  target_audience: 'professionals',
  forbidden_patterns: JSON.stringify([]),
  required_disclosures: JSON.stringify([]),
  preferred_formats: JSON.stringify([]),
  reference_works: JSON.stringify([]),
  version: 1,
  is_active: 1,
  created_at: 1000,
  updated_at: 1000,
  updated_by: '',
});

describe('tree/creative-identity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('createIdentity', () => {
    it('mutates input identity with version 1 and timestamps', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } })]),
      );

      const identity = {
        workspaceId: 'ws_001',
        brandId: 'brand_001',
        voiceDescription: 'warm',
        tone: 'warm',
        formality: 3,
        energy: 4,
        beliefs: ['innovation'],
        positioning: 'approachable',
        targetAudience: 'general',
        forbiddenPatterns: [],
        requiredDisclosures: [],
        preferredFormats: ['short'],
        referenceWorks: [],
      } as any;

      const result = await createIdentity(identity);
      expect(result).toBe(identity);
      expect(result.version).toBe(1);
      expect(result.createdAt).toBeGreaterThan(0);
      expect(result.updatedAt).toBe(result.createdAt);
    });

    it('throws when db is null', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      await expect(
        createIdentity({
          workspaceId: 'ws_001',
          brandId: 'brand_001',
          voiceDescription: 'v',
          tone: 'warm',
          formality: 1,
          energy: 1,
          beliefs: [],
          positioning: 'test',
          targetAudience: 'test',
          forbiddenPatterns: [],
          requiredDisclosures: [],
          preferredFormats: [],
          referenceWorks: [],
        } as any),
      ).rejects.toThrow('D1 not available');
    });

    it('wraps insert errors', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ run: async () => { throw new Error('Simulated DB error'); } })]),
      );
      await expect(
        createIdentity({
          workspaceId: 'ws_001',
          brandId: 'brand_001',
          voiceDescription: 'v',
          tone: 'warm',
          formality: 1,
          energy: 1,
          beliefs: [],
          positioning: 'test',
          targetAudience: 'test',
          forbiddenPatterns: [],
          requiredDisclosures: [],
          preferredFormats: [],
          referenceWorks: [],
        } as any),
      ).rejects.toThrow('Failed to create identity');
    });
  });

  describe('getActiveIdentity', () => {
    it('returns active identity for workspace', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            first: {
              ...BASE_ROW(),
              id: 'ci_active',
              version: 3,
              is_active: 1,
              beliefs: JSON.stringify(['trust']),
              preferred_formats: JSON.stringify(['short']),
            },
          }),
        ]),
      );

      const result = await getActiveIdentity('ws_001');
      expect(result).toBeDefined();
      expect(result!.id).toBe('ci_active');
      expect(result!.version).toBe(3);
      expect(result!.isActive).toBe(true);
      expect(result!.beliefs).toEqual(['trust']);
    });

    it('returns null when no active identity exists', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ first: null })]));
      const result = await getActiveIdentity('ws_001');
      expect(result).toBeNull();
    });
  });

  describe('updateIdentity', () => {
    it('bumps version and returns updated identity', async () => {
      const existingRow = { ...BASE_ROW(), id: 'ci_old', version: 2, tone: 'old' };
      const updatedRow = { ...existingRow, tone: 'new', version: 3, updated_at: 3000 };
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({ first: existingRow }),
          stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
          stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
          stmt({ first: updatedRow }),
        ]),
      );

      const identity = {
        id: 'ci_old',
        workspaceId: 'ws_001',
        brandId: 'brand_001',
        voiceDescription: 'new voice',
        tone: 'new',
        formality: 3,
        energy: 4,
        beliefs: ['trust'],
        positioning: 'new',
        targetAudience: 'new',
        forbiddenPatterns: [],
        requiredDisclosures: [],
        preferredFormats: ['long'],
        referenceWorks: [],
      } as any;

      const result = await updateIdentity(identity);
      expect(result.version).toBe(3);
      expect(result.tone).toBe('new');
    });

    it('throws when identity not found', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ first: null })]));
      const identity = {
        id: 'ci_nonexistent',
        workspaceId: 'ws_001',
        brandId: 'brand_001',
        voiceDescription: 'v',
        tone: 't',
        formality: 1,
        energy: 1,
        beliefs: [],
        positioning: 'p',
        targetAudience: 'a',
        forbiddenPatterns: [],
        requiredDisclosures: [],
        preferredFormats: [],
        referenceWorks: [],
      } as any;
      await expect(updateIdentity(identity)).rejects.toThrow();
    });

    it('wraps update errors', async () => {
      const existingRow = { ...BASE_ROW(), id: 'ci_old', version: 2, tone: 'old' };
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({ first: existingRow }),
          stmt({ run: { success: true, meta: { changes: 0, duration: 1 } } }),
          stmt({ run: async () => { throw new Error('Simulated DB error'); } }),
        ]),
      );

      const identity = {
        id: 'ci_old',
        workspaceId: 'ws_001',
        brandId: 'brand_001',
        voiceDescription: 'v',
        tone: 'new',
        formality: 1,
        energy: 1,
        beliefs: [],
        positioning: 'p',
        targetAudience: 'a',
        forbiddenPatterns: [],
        requiredDisclosures: [],
        preferredFormats: [],
        referenceWorks: [],
      } as any;

      await expect(updateIdentity(identity)).rejects.toThrow('Failed to update identity');
    });
  });

  describe('deactivateIdentity', () => {
    it('sets is_active = 0', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } })]),
      );
      await expect(deactivateIdentity('ci_001')).resolves.toBeUndefined();
    });

    it('succeeds even when no rows affected', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ run: { success: true, meta: { changes: 0, duration: 1 } } })]),
      );
      await expect(deactivateIdentity('ci_already_inactive')).resolves.toBeUndefined();
    });
  });
});