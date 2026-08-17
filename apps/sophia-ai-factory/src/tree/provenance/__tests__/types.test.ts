/**
 * Tests for tree/provenance append-only audit trail (Sophia 2027 Phase 1).
 *
 * Covers: recordProvenance, getProvenanceChain, getDerivatives,
 *         D1_UNAVAILABLE error paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

import {
  recordProvenance,
  getProvenanceChain,
  getDerivatives,
} from '../types';
import type { ProvenanceRecord, ProvenanceAction } from '@/seed/types/creative-domain';

interface PreparedStmt {
  first?: unknown;
  run?: any;
  all?: { results: unknown[]; meta: { changes: number; duration: number } };
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
          run: async () => (typeof stmt.run === 'function' ? stmt.run() : (stmt.run ?? { success: true, meta: { changes: 0, duration: 1 } })),
          all: async () => stmt.all ?? { results: [], meta: { changes: 0, duration: 1 } },
        }),
      };
    }),
  };
}

function stmt(opts: PreparedStmt = {}): PreparedStmt {
  return {
    first: opts.first,
    run: opts.run,
    all: opts.all,
  };
}

function makeProvenanceRecord(overrides: Partial<ProvenanceRecord> = {}): ProvenanceRecord {
  return {
    id: 'prov_' + Math.random().toString(36).slice(2, 10),
    workspaceId: 'ws_001',
    assetId: 'asset_001',
    agentRunId: undefined,
    action: 'generated' as ProvenanceRecord['action'],
    actorType: 'agent',
    actorId: 'agent_001',
    model: 'gpt-4',
    modelVersion: '2024-01',
    prompt: 'Generate a video about sustainability',
    sourceAssetId: undefined,
    humanEdits: undefined,
    approvalId: undefined,
    derivativeOf: undefined,
    metadata: {},
    createdAt: 1000,
    ...overrides,
  };
}

describe('tree/provenance', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('recordProvenance', () => {
    it('inserts a provenance record and returns it', async () => {
      const record = makeProvenanceRecord();
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            run: {
              success: true,
              meta: { changes: 1, duration: 1 },
            },
          }),
          stmt({
            first: {
              id: record.id,
              workspace_id: record.workspaceId,
              asset_id: record.assetId,
              agent_run_id: record.agentRunId,
              action: record.action,
              actor_type: record.actorType,
              actor_id: record.actorId,
              model: record.model,
              model_version: record.modelVersion,
              prompt: record.prompt,
              source_asset_id: record.sourceAssetId,
              human_edits: JSON.stringify(record.humanEdits),
              approval_id: record.approvalId,
              derivative_of: record.derivativeOf,
              metadata: JSON.stringify(record.metadata),
              created_at: record.createdAt,
            },
          }),
        ]),
      );

      const result = await recordProvenance(record);
      expect(result).toBeDefined();
      expect(result.id).toBe(record.id);
      expect(result.action).toBe('generated');
    });

    it('throws D1_UNAVAILABLE when db is null', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const record = makeProvenanceRecord();
      await expect(recordProvenance(record)).rejects.toThrow('D1 not available');
    });

    it('wraps thrown errors with INSERT_FAILED code', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            run: async () => {
              throw new Error('Simulated DB error');
            },
          }),
        ]),
      );
      const record = makeProvenanceRecord();
      try {
        await recordProvenance(record);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error & { code?: string }).code).toBe('INSERT_FAILED');
        expect((err as Error).message).toContain('Simulated DB error');
      }
    });

    it('stores derivative_of when provided', async () => {
      const record = makeProvenanceRecord({ derivativeOf: 'asset_parent' });
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            run: {
              success: true,
              meta: { changes: 1, duration: 1 },
            },
          }),
          stmt({
            first: {
              ...record,
              derivative_of: 'asset_parent',
              source_asset_id: null,
              human_edits: '[]',
              metadata: '{}',
            },
          }),
        ]),
      );

      const result = await recordProvenance(record);
      expect(result.derivativeOf).toBe('asset_parent');
    });
  });

  describe('getProvenanceChain', () => {
    it('returns all provenance records for an asset', async () => {
      const records = [
        makeProvenanceRecord({ assetId: 'asset_001', action: 'generated', createdAt: 1000 }),
        makeProvenanceRecord({ assetId: 'asset_001', action: 'edited', createdAt: 2000 }),
      ];
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            all: {
              results: records.map((r) => ({
                ...r,
                human_edits: JSON.stringify(r.humanEdits),
                metadata: JSON.stringify(r.metadata),
                source_asset_id: r.sourceAssetId,
                derivative_of: r.derivativeOf,
              })),
              meta: { changes: 2, duration: 1 },
            },
          }),
        ]),
      );

      const result = await getProvenanceChain('asset_001');
      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('generated');
      expect(result[1].action).toBe('edited');
    });

    it('returns empty array when no records exist', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ all: { results: [], meta: { changes: 0, duration: 1 } } })]));

      const result = await getProvenanceChain('asset_unknown');
      expect(result).toEqual([]);
    });
  });

  describe('getDerivatives', () => {
    it('returns all records where derivative_of matches the asset id', async () => {
      const child = makeProvenanceRecord({ assetId: 'asset_child', derivativeOf: 'asset_001' });
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            all: {
              results: [
                {
                  ...child,
                  human_edits: '[]',
                  metadata: '{}',
                  source_asset_id: null,
                  derivative_of: 'asset_001',
                },
              ],
              meta: { changes: 1, duration: 1 },
            },
          }),
        ]),
      );

      const result = await getDerivatives('asset_001');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(child.id);
    });

    it('returns empty array when no derivatives exist', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ all: { results: [], meta: { changes: 0, duration: 1 } } })]));

      const result = await getDerivatives('asset_orphan');
      expect(result).toEqual([]);
    });
  });
});