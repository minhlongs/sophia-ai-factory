/**
 * Additional coverage tests for tree/autonomy.
 * Covers: parseOverrides edge cases, toErrorCode branches,
 * getAutonomyConfig/setAutonomyLevel catch paths, isActionAllowed default branch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getAutonomyConfig,
  setAutonomyLevel,
  isActionAllowed,
  checkActionAllowed,
  type AutonomyLevel,
} from '../autonomy-repo';

function buildDb(overrides: {
  first?: unknown;
  run?: unknown;
  prepareThrows?: boolean;
} = {}) {
  return {
    prepare: vi.fn(() => {
      if (overrides.prepareThrows) throw new Error('D1 binding not available');
      return {
        bind: () => ({
          first: async () => overrides.first ?? null,
          run: async () => {
            if (typeof overrides.run === 'function') return overrides.run();
            return overrides.run ?? { success: true, meta: { changes: 1 } };
          },
        }),
      };
    }),
  };
}

const WORKSPACE_ID = 'ws_cov_001';

describe('tree/autonomy — extended coverage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('parseOverrides edge cases (via getAutonomyConfig)', () => {
    it('returns empty overrides for invalid JSON', async () => {
      const row = {
        id: 'cfg-bad',
        workspace_id: WORKSPACE_ID,
        agent_type: 'global',
        level: 2,
        overrides_json: '{invalid json!!!',
        created_at: 1000,
        updated_at: 1000,
      };
      mocks.mockGetD1.mockReturnValue(buildDb({ first: row }));
      const result = await getAutonomyConfig(WORKSPACE_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.overrides).toEqual({});
    });

    it('returns empty overrides for JSON array', async () => {
      const row = {
        id: 'cfg-arr',
        workspace_id: WORKSPACE_ID,
        agent_type: 'global',
        level: 1,
        overrides_json: '[1,2,3]',
        created_at: 1000,
        updated_at: 1000,
      };
      mocks.mockGetD1.mockReturnValue(buildDb({ first: row }));
      const result = await getAutonomyConfig(WORKSPACE_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.overrides).toEqual({});
    });

    it('returns empty overrides for JSON primitive (string)', async () => {
      const row = {
        id: 'cfg-str',
        workspace_id: WORKSPACE_ID,
        agent_type: 'global',
        level: 1,
        overrides_json: '"just a string"',
        created_at: 1000,
        updated_at: 1000,
      };
      mocks.mockGetD1.mockReturnValue(buildDb({ first: row }));
      const result = await getAutonomyConfig(WORKSPACE_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.overrides).toEqual({});
    });

    it('returns empty overrides for null overrides_json', async () => {
      const row = {
        id: 'cfg-null',
        workspace_id: WORKSPACE_ID,
        agent_type: 'global',
        level: 3,
        overrides_json: null,
        created_at: 1000,
        updated_at: 1000,
      };
      mocks.mockGetD1.mockReturnValue(buildDb({ first: row }));
      const result = await getAutonomyConfig(WORKSPACE_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.overrides).toEqual({});
    });

    it('parses valid object overrides correctly', async () => {
      const row = {
        id: 'cfg-obj',
        workspace_id: WORKSPACE_ID,
        agent_type: 'global',
        level: 3,
        overrides_json: JSON.stringify({ maxSpend: 100 }),
        created_at: 1000,
        updated_at: 1000,
      };
      mocks.mockGetD1.mockReturnValue(buildDb({ first: row }));
      const result = await getAutonomyConfig(WORKSPACE_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.overrides).toEqual({ maxSpend: 100 });
    });
  });

  describe('getAutonomyConfig — catch path (prepare throws)', () => {
    it('returns DB_UNAVAILABLE when prepare throws binding error', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb({ prepareThrows: true }));
      const result = await getAutonomyConfig(WORKSPACE_ID);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DB_UNAVAILABLE');
    });
  });

  describe('setAutonomyLevel — catch path (prepare throws)', () => {
    it('returns DB_UNAVAILABLE when prepare throws binding error', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb({ prepareThrows: true }));
      const result = await setAutonomyLevel(WORKSPACE_ID, 2);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DB_UNAVAILABLE');
    });

    it('returns DB_ERROR for non-binding errors', async () => {
      const db = {
        prepare: vi.fn(() => {
          throw new Error('disk full');
        }),
      };
      mocks.mockGetD1.mockReturnValue(db);
      const result = await setAutonomyLevel(WORKSPACE_ID, 3);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DB_ERROR');
      expect(result.error.message).toContain('disk full');
    });
  });

  describe('setAutonomyLevel — negative level', () => {
    it('rejects level -1', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb());
      const result = await setAutonomyLevel(WORKSPACE_ID, -1);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DB_ERROR');
      expect(result.error.message).toContain('Must be 0-4');
    });
  });

  describe('isActionAllowed — default branch (invalid level from DB)', () => {
    it('returns false for out-of-range level stored in DB', async () => {
      const row = {
        id: 'cfg-weird',
        workspace_id: WORKSPACE_ID,
        agent_type: 'global',
        level: 99,
        overrides_json: '{}',
        created_at: 1000,
        updated_at: 1000,
      };
      mocks.mockGetD1.mockReturnValue(buildDb({ first: row }));
      const allowed = await isActionAllowed(WORKSPACE_ID, 'read_mission');
      expect(allowed).toBe(false);
    });
  });

  describe('isActionAllowed — agent-specific fallback to global', () => {
    it('uses global config when agent-specific not found', async () => {
      let callCount = 0;
      const db = {
        prepare: vi.fn(() => ({
          bind: () => ({
            first: async () => {
              callCount++;
              if (callCount === 1) return null; // agent-specific miss
              return {
                id: 'cfg-global',
                workspace_id: WORKSPACE_ID,
                agent_type: 'global',
                level: 4,
                overrides_json: '{}',
                created_at: 1000,
                updated_at: 1000,
              };
            },
          }),
        })),
      };
      mocks.mockGetD1.mockReturnValue(db);
      const allowed = await isActionAllowed(WORKSPACE_ID, 'spend_credits', 'editor');
      expect(allowed).toBe(true);
    });
  });

  describe('checkActionAllowed — default branch', () => {
    it('returns false for out-of-range level', () => {
      expect(checkActionAllowed(99 as unknown as AutonomyLevel, 'read_mission')).toBe(false);
      expect(checkActionAllowed(-1 as unknown as AutonomyLevel, 'get_status')).toBe(false);
    });
  });

  describe('toErrorCode — non-Error thrown value', () => {
    it('handles string thrown from getD1 resolution', async () => {
      mocks.mockGetD1.mockImplementation(async () => {
        throw 'raw string failure';
      });
      const result = await getAutonomyConfig(WORKSPACE_ID);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DB_ERROR');
      expect(result.error.message).toBe('raw string failure');
    });
  });
});
