/**
 * Tests for the IProvenanceLedger adapter over tree/provenance.
 *
 * Mocks D1 at the boundary (vi.mock('@/seed/db/client')) so the adapter is
 * exercised without a real database. Persistence behaviour is delegated to
 * recordProvenance / getProvenanceChain / getAgentRunProvenance — those are
 * covered by types.test.ts; here we verify the adapter's own contract:
 * Result envelopes, by-id get, filtered query, hasAction, and append-only
 * semantics (no mutation/deletion of records).
 *
 * @module tree/provenance/__tests__
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

import { ProvenanceLedger } from '../provenance-ledger';
import type { ProvenanceQuery } from '@/seed/types/creative-economy';
import type { ProvenanceRecord, ProvenanceAction } from '@/seed/types/creative-domain';

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

function provenanceRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'prov_test',
    workspace_id: 'ws_001',
    asset_id: 'asset_001',
    agent_run_id: null,
    action: 'generated',
    actor_type: 'agent',
    actor_id: 'agent_001',
    model: 'gpt-4',
    model_version: '2024-01',
    prompt: 'Generate a video',
    source_asset_id: null,
    human_edits: null,
    approval_id: null,
    derivative_of: null,
    metadata: JSON.stringify({}),
    created_at: 1000,
    ...overrides,
  };
}

const ledger = new ProvenanceLedger();

const baseRecord = (
  overrides: Partial<Omit<ProvenanceRecord, 'id' | 'createdAt'>> = {},
): Omit<ProvenanceRecord, 'id' | 'createdAt'> => ({
  workspaceId: 'ws_001',
  assetId: 'asset_001',
  action: 'generated' as ProvenanceAction,
  actorType: 'agent',
  actorId: 'agent_001',
  metadata: {},
  ...overrides,
});

describe('ProvenanceLedger', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('append', () => {
    it('inserts a record and returns a branded id', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } })]),
      );
      const result = await ledger.append(baseRecord());
      expect(result.ok).toBe(true);
      if (result.ok) expect(typeof result.value).toBe('string');
    });

    it('propagates D1 unavailability as failure', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const result = await ledger.append(baseRecord());
      expect(result.ok).toBe(false);
    });

    it('propagates insert errors as failure', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            run: async () => {
              throw new Error('Simulated DB error');
            },
          }),
        ]),
      );
      const result = await ledger.append(baseRecord());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('Simulated DB error');
    });
  });

  describe('get', () => {
    it('returns a record by branded id', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ first: provenanceRow({ id: 'prov_1' }) })]),
      );
      const result = await ledger.get('prov_1' as never);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.id).toBe('prov_1');
    });

    it('returns failure when the row is missing', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ first: null })]));
      const result = await ledger.get('prov_missing' as never);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('not found');
    });

    it('returns failure when D1 is unavailable', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const result = await ledger.get('prov_x' as never);
      expect(result.ok).toBe(false);
    });
  });

  describe('byAsset', () => {
    it('returns all records for an asset in chronological order', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            all: {
              results: [
                provenanceRow({ id: 'prov_a', action: 'generated', created_at: 1000 }),
                provenanceRow({ id: 'prov_b', action: 'edited', created_at: 2000 }),
              ],
              meta: { changes: 2, duration: 1 },
            },
          }),
        ]),
      );
      const result = await ledger.byAsset('asset_001');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].action).toBe('generated');
        expect(result.value[1].action).toBe('edited');
      }
    });

    it('returns an empty array when no records exist', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ all: { results: [], meta: { changes: 0, duration: 1 } } })]),
      );
      const result = await ledger.byAsset('asset_unknown');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([]);
    });

    it('returns failure when D1 is unavailable', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const result = await ledger.byAsset('asset_001');
      expect(result.ok).toBe(false);
    });
  });

  describe('byRun', () => {
    it('returns all records for an agent run', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            all: {
              results: [provenanceRow({ id: 'prov_r', agent_run_id: 'run_1' })],
              meta: { changes: 1, duration: 1 },
            },
          }),
        ]),
      );
      const result = await ledger.byRun('run_1' as never);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].agentRunId).toBe('run_1');
      }
    });

    it('returns failure when D1 is unavailable', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const result = await ledger.byRun('run_1' as never);
      expect(result.ok).toBe(false);
    });
  });

  describe('query', () => {
    it('returns matching records with filters applied', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            all: {
              results: [provenanceRow({ id: 'prov_q', action: 'approved' })],
              meta: { changes: 1, duration: 1 },
            },
          }),
        ]),
      );
      const query: ProvenanceQuery = { workspaceId: 'ws_001', action: 'approved' };
      const result = await ledger.query(query);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].action).toBe('approved');
      }
    });

    it('returns an empty array when nothing matches', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ all: { results: [], meta: { changes: 0, duration: 1 } } })]),
      );
      const result = await ledger.query({ workspaceId: 'ws_none' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([]);
    });

    it('returns failure when D1 is unavailable', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const result = await ledger.query({ workspaceId: 'ws_001' });
      expect(result.ok).toBe(false);
    });
  });

  describe('hasAction', () => {
    it('returns true when a matching record exists', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ first: { 1: 1 } })]));
      const result = await ledger.hasAction('asset_001', 'approved');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(true);
    });

    it('returns false when no matching record exists', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ first: null })]));
      const result = await ledger.hasAction('asset_001', 'published');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(false);
    });

    it('returns failure when D1 is unavailable', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const result = await ledger.hasAction('asset_001', 'approved');
      expect(result.ok).toBe(false);
    });
  });
});