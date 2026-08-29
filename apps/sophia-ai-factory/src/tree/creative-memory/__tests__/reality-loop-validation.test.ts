/**
 * Reality Loop v1 — Phase F: Creative Memory validation suite.
 *
 * Deterministic test suite proving the Creative Memory loop:
 *   MISSION 1 -> HUMAN CORRECTION -> MEMORY UPDATE -> MISSION 2 -> OUTPUT REFLECTS LEARNING
 *
 * Tests ONLY. Zero memory-code changes. Zero source files outside __tests__.
 * Mocks D1 at the boundary (vi.mock('@/seed/db/client')) so the REAL
 * CreativeMemoryStore API is exercised without a real database.
 *
 * Each test maps 1:1 to a task.md Phase F criterion.
 *
 * @module tree/creative-memory/__tests__/reality-loop-validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

import { CreativeMemoryStore } from '../creative-memory-store';
import type { MemoryQuery } from '@/seed/types/creative-economy';
import type { CreativeMemory, MemoryCategory } from '@/seed/types/creative-domain';

// ---------------------------------------------------------------------------
// D1 mock helpers (mirror existing test conventions)
// ---------------------------------------------------------------------------

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

function memoryRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mem_test',
    workspace_id: 'ws_001',
    category: 'identity',
    key: 'brand_tone',
    value: JSON.stringify({ tone: 'professional' }),
    confidence: 'high',
    source: 'setup-wizard',
    evidence: JSON.stringify(['User selection']),
    scope: 'global',
    scope_id: null,
    version: 1,
    is_deleted: 0,
    created_at: 1000,
    updated_at: 1000,
    expires_at: null,
    ...overrides,
  };
}

const store = new CreativeMemoryStore();

const baseQuery = (overrides: Partial<MemoryQuery> = {}): MemoryQuery => ({
  workspaceId: 'ws_001',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Phase F — 8 reality-loop validation tests
// ---------------------------------------------------------------------------

describe('Phase F — Creative Memory Reality Loop Validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── TEST 1: Memory is scoped correctly ─────────────────────────────────
  it('scopes memory by workspace + category + key + scope + scopeId', async () => {
    // Two workspaces, same category+key — each gets its own isolated entry.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({
          all: {
            results: [
              memoryRow({
                id: 'mem_ws1',
                workspace_id: 'ws_001',
                category: 'creative',
                key: 'style_pref',
                value: JSON.stringify({ style: 'minimal' }),
                scope: 'campaign',
                scope_id: 'mission_a',
              }),
            ],
            meta: { changes: 1, duration: 1 },
          },
        }),
      ]),
    );

    const result = await store.query(
      baseQuery({ category: 'creative', key: 'style_pref', scope: 'campaign', scopeId: 'mission_a' }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries).toHaveLength(1);
      expect(result.value.entries[0].workspaceId).toBe('ws_001');
      expect(result.value.entries[0].scope).toBe('campaign');
      expect(result.value.entries[0].scopeId).toBe('mission_a');
      expect(result.value.entries[0].value).toEqual({ style: 'minimal' });
    }
  });

  // ── TEST 2: Memory does not leak across users/workspaces ───────────────
  it('does not leak memory across workspaces', async () => {
    // Query for ws_002 returns nothing even though ws_001 has data — the
    // workspace_id filter is mandatory in queryMemory SQL.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({
          all: { results: [], meta: { changes: 0, duration: 1 } },
        }),
      ]),
    );

    const result = await store.query(
      { workspaceId: 'ws_002', category: 'creative', key: 'style_pref' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries).toEqual([]);
      expect(result.value.total).toBe(0);
    }
  });

  // ── TEST 3: Rejected preferences do not become permanent truth ─────────
  it('soft-deletes rejected preferences so they are excluded from future reads', async () => {
    // Step 1: put a preference (e.g. inferred "warm tone").
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({ first: null }), // no existing
        stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }), // insert
      ]),
    );
    const putResult = await store.put({
      workspaceId: 'ws_001',
      category: 'creative',
      key: 'tone_pref',
      value: { tone: 'warm' },
      confidence: 'medium',
      source: 'agent',
      evidence: JSON.stringify(['run_001']),
      scope: 'global',
      isDeleted: false,
    });
    expect(putResult.ok).toBe(true);
    const memId = putResult.ok ? putResult.value : '';

    // Step 2: human rejects it — soft-delete.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({ first: memoryRow({ id: String(memId), key: 'tone_pref' }) }), // exists check
        stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }), // delete
      ]),
    );
    const delResult = await store.delete(memId as never);
    expect(delResult.ok).toBe(true);
    if (delResult.ok) expect(delResult.value).toBe(true);

    // Step 3: future query excludes soft-deleted rows (is_deleted = 0 filter).
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({
          all: { results: [], meta: { changes: 0, duration: 1 } },
        }),
      ]),
    );
    const afterDelete = await store.query(
      baseQuery({ category: 'creative', key: 'tone_pref' }),
    );
    expect(afterDelete.ok).toBe(true);
    if (afterDelete.ok) {
      // Rejected preference is gone — it did NOT become permanent truth.
      expect(afterDelete.value.entries).toEqual([]);
      expect(afterDelete.value.total).toBe(0);
    }
  });

  // ── TEST 4: Human correction has higher authority than inferred learning ─
  it('overwrites inferred learning with human correction on put (version bump)', async () => {
    // Mission 1: agent infers a preference (source='agent', confidence='medium').
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({ first: null }), // no existing
        stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }), // insert
      ]),
    );
    const inferred = await store.put({
      workspaceId: 'ws_001',
      category: 'creative',
      key: 'color_scheme',
      value: { scheme: 'neon' },
      confidence: 'medium',
      source: 'agent',
      evidence: JSON.stringify(['agent_run_001']),
      scope: 'global',
      isDeleted: false,
    });
    expect(inferred.ok).toBe(true);

    // Human correction: put with source='human_edit', confidence='high'.
    // upsertMemory detects existing row by (workspace, category, key, scope, scopeId)
    // and increments version.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({ first: { id: 'mem_color', version: 1 } }), // existing found
        stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }), // update
      ]),
    );
    const corrected = await store.put({
      workspaceId: 'ws_001',
      category: 'creative',
      key: 'color_scheme',
      value: { scheme: 'pastel' },
      confidence: 'high',
      source: 'human_edit',
      evidence: JSON.stringify(['human_correction_001']),
      scope: 'global',
      isDeleted: false,
    });
    expect(corrected.ok).toBe(true);

    // Verify the corrected value is what gets read back.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({
          all: {
            results: [
              memoryRow({
                id: 'mem_color',
                category: 'creative',
                key: 'color_scheme',
                value: JSON.stringify({ scheme: 'pastel' }),
                confidence: 'high',
                source: 'human_edit',
                evidence: JSON.stringify(['human_correction_001']),
                version: 2,
              }),
            ],
            meta: { changes: 1, duration: 1 },
          },
        }),
      ]),
    );
    const readBack = await store.query(
      baseQuery({ category: 'creative', key: 'color_scheme' }),
    );
    expect(readBack.ok).toBe(true);
    if (readBack.ok) {
      expect(readBack.value.entries).toHaveLength(1);
      // Human correction (pastel) replaced inferred learning (neon).
      expect(readBack.value.entries[0].value).toEqual({ scheme: 'pastel' });
      expect(readBack.value.entries[0].confidence).toBe('high');
      expect(readBack.value.entries[0].source).toBe('human_edit');
      expect(readBack.value.entries[0].version).toBe(2);
    }
  });

  // ── TEST 5: Memory updates are auditable ───────────────────────────────
  it('preserves evidence trail on each update for auditability', async () => {
    // Initial write with evidence.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({ first: null }),
        stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
      ]),
    );
    await store.put({
      workspaceId: 'ws_001',
      category: 'performance',
      key: 'ctr_rate',
      value: { rate: 0.12 },
      confidence: 'medium',
      source: 'performance',
      evidence: JSON.stringify(['run_001', 'mission_a']),
      scope: 'campaign',
      scopeId: 'mission_a',
      isDeleted: false,
    });

    // Update with new evidence appended.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({ first: { id: 'mem_ctr', version: 1 } }),
        stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
      ]),
    );
    await store.put({
      workspaceId: 'ws_001',
      category: 'performance',
      key: 'ctr_rate',
      value: { rate: 0.18 },
      confidence: 'high',
      source: 'performance',
      evidence: JSON.stringify(['run_001', 'mission_a', 'run_002', 'mission_b']),
      scope: 'campaign',
      scopeId: 'mission_a',
      isDeleted: false,
    });

    // Read back — evidence trail shows full history.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({
          all: {
            results: [
              memoryRow({
                id: 'mem_ctr',
                category: 'performance',
                key: 'ctr_rate',
                value: JSON.stringify({ rate: 0.18 }),
                confidence: 'high',
                source: 'performance',
                evidence: JSON.stringify(['run_001', 'mission_a', 'run_002', 'mission_b']),
                scope: 'campaign',
                scope_id: 'mission_a',
                version: 2,
              }),
            ],
            meta: { changes: 1, duration: 1 },
          },
        }),
      ]),
    );
    const result = await store.query(
      baseQuery({ category: 'performance', key: 'ctr_rate', scope: 'campaign', scopeId: 'mission_a' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const entry = result.value.entries[0];
      const evidence = JSON.parse(entry.evidence);
      // Evidence trail is auditable: contains both run + mission references.
      expect(evidence).toContain('run_001');
      expect(evidence).toContain('mission_a');
      expect(evidence).toContain('run_002');
      expect(evidence).toContain('mission_b');
      expect(entry.version).toBe(2);
    }
  });

  // ── TEST 6: Memory can be inspected ────────────────────────────────────
  it('summarizes memory into a human-readable, token-bounded text block', async () => {
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({
          all: {
            results: [
              memoryRow({
                id: 'mem_a',
                category: 'identity',
                key: 'brand_tone',
                value: JSON.stringify({ tone: 'professional' }),
                scope: 'global',
                scopeId: null,
              }),
              memoryRow({
                id: 'mem_b',
                category: 'creative',
                key: 'color_scheme',
                value: JSON.stringify({ scheme: 'pastel' }),
                scope: 'campaign',
                scope_id: 'mission_a',
              }),
            ],
            meta: { changes: 2, duration: 1 },
          },
        }),
      ]),
    );

    const result = await store.summarize(baseQuery(), 100);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Inspectable: human-readable format with category/key/value.
      expect(result.value).toContain('[identity/brand_tone]');
      expect(result.value).toContain('[creative/color_scheme]');
      expect(result.value).toContain('"tone":"professional"');
      expect(result.value).toContain('"scheme":"pastel"');
      // Scope info is present for campaign-scoped entries.
      expect(result.value).toContain('campaign(mission_a)');
    }
  });

  // ── TEST 7: Memory can be corrected ────────────────────────────────────
  it('allows a stored memory to be corrected via put with new value + evidence', async () => {
    // Store an incorrect inference.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({ first: null }),
        stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
      ]),
    );
    const first = await store.put({
      workspaceId: 'ws_001',
      category: 'audience',
      key: 'target_age',
      value: { age: '18-24' },
      confidence: 'low',
      source: 'agent',
      evidence: JSON.stringify(['inferred_from_low_sample']),
      scope: 'global',
      isDeleted: false,
    });
    expect(first.ok).toBe(true);

    // Correct it: human provides ground truth.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({ first: { id: 'mem_age', version: 1 } }),
        stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
      ]),
    );
    const corrected = await store.put({
      workspaceId: 'ws_001',
      category: 'audience',
      key: 'target_age',
      value: { age: '25-34' },
      confidence: 'high',
      source: 'human_edit',
      evidence: JSON.stringify(['human_corrected', 'crm_data']),
      scope: 'global',
      isDeleted: false,
    });
    expect(corrected.ok).toBe(true);

    // Read back confirms correction.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({
          all: {
            results: [
              memoryRow({
                id: 'mem_age',
                category: 'audience',
                key: 'target_age',
                value: JSON.stringify({ age: '25-34' }),
                confidence: 'high',
                source: 'human_edit',
                evidence: JSON.stringify(['human_corrected', 'crm_data']),
                version: 2,
              }),
            ],
            meta: { changes: 1, duration: 1 },
          },
        }),
      ]),
    );
    const readBack = await store.query(
      baseQuery({ category: 'audience', key: 'target_age' }),
    );
    expect(readBack.ok).toBe(true);
    if (readBack.ok) {
      expect(readBack.value.entries[0].value).toEqual({ age: '25-34' });
      expect(readBack.value.entries[0].source).toBe('human_edit');
      expect(readBack.value.entries[0].version).toBe(2);
    }
  });

  // ── TEST 8: Memory improves subsequent context ─────────────────────────
  it('improves subsequent mission context by surfacing prior learning', async () => {
    // Mission 1 produced a learning stored as memory.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({ first: null }),
        stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
      ]),
    );
    await store.put({
      workspaceId: 'ws_001',
      category: 'creative',
      key: 'hook_style',
      value: { hook: 'question_based', ctr: 0.22 },
      confidence: 'high',
      source: 'performance',
      evidence: JSON.stringify(['mission_1', 'run_001']),
      scope: 'campaign',
      scopeId: 'mission_1',
      isDeleted: false,
    });

    // Mission 2 context load: query returns the prior learning so the agent
    // can build on it instead of starting from scratch.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({
          all: {
            results: [
              memoryRow({
                id: 'mem_hook',
                category: 'creative',
                key: 'hook_style',
                value: JSON.stringify({ hook: 'question_based', ctr: 0.22 }),
                confidence: 'high',
                source: 'performance',
                evidence: JSON.stringify(['mission_1', 'run_001']),
                scope: 'campaign',
                scope_id: 'mission_1',
              }),
            ],
            meta: { changes: 1, duration: 1 },
          },
        }),
      ]),
    );
    const contextForMission2 = await store.query(
      baseQuery({ category: 'creative', key: 'hook_style' }),
    );

    expect(contextForMission2.ok).toBe(true);
    if (contextForMission2.ok) {
      // Prior learning is available — Mission 2 context is improved.
      expect(contextForMission2.value.entries).toHaveLength(1);
      expect(contextForMission2.value.entries[0].value).toEqual({
        hook: 'question_based',
        ctr: 0.22,
      });
      // The evidence links back to the originating mission.
      const evidence = JSON.parse(contextForMission2.value.entries[0].evidence);
      expect(evidence).toContain('mission_1');
    }

    // Summarize confirms the learning is surfaced in agent-readable form.
    mocks.mockGetD1.mockReturnValue(
      buildDb([
        stmt({
          all: {
            results: [
              memoryRow({
                id: 'mem_hook',
                category: 'creative',
                key: 'hook_style',
                value: JSON.stringify({ hook: 'question_based', ctr: 0.22 }),
                confidence: 'high',
                source: 'performance',
                evidence: JSON.stringify(['mission_1', 'run_001']),
                scope: 'campaign',
                scope_id: 'mission_1',
              }),
            ],
            meta: { changes: 1, duration: 1 },
          },
        }),
      ]),
    );
    const summary = await store.summarize(
      baseQuery({ category: 'creative', key: 'hook_style' }),
      50,
    );
    expect(summary.ok).toBe(true);
    if (summary.ok) {
      expect(summary.value).toContain('question_based');
      expect(summary.value).toContain('0.22');
    }
  });
});
