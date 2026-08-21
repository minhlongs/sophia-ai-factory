/**
 * IP Graph integration tests — DB-backed via D1 shim.
 * Tests: createIP, getIP, listIP, getIPChildren, getIPDerivatives,
 *        updateIPStatus, newIpId
 *
 * @module tree/ip-graph/__tests__/integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { IP, ContentStatus } from '@/seed/types/creative-domain';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (p: string) => {
    exec(s: string): void;
    prepare(s: string): {
      get(...p: unknown[]): unknown;
      all(...p: unknown[]): unknown[];
      run(...p: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

function makeD1(db: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: (s: string) => db.exec(s),
    batch: (stmts: unknown[]) => Promise.all(stmts),
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ip_entities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  parent_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
`;

const { getD1 } = await import('@/seed/db/client');
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getD1).mockReset();
});

function setupDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  return makeD1(db);
}

async function insertIP(d1: ReturnType<typeof makeD1>, row: Record<string, unknown>) {
  await d1
    .prepare(
      `INSERT INTO ip_entities (id, workspace_id, type, name, description, metadata, parent_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.workspace_id,
      row.type,
      row.name,
      row.description ?? '',
      JSON.stringify(row.metadata ?? {}),
      row.parent_id ?? null,
      row.status ?? 'draft',
      row.created_at ?? 0,
      row.updated_at ?? 0,
    )
    .run();
}

describe('IP Graph — createIP', () => {
  it('inserts an IP entity with generated id and returns it', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { createIP, newIpId } = await import('@/tree/ip-graph/types');

    const id = newIpId();
    expect(id).toMatch(/^ip_[0-9a-f]{32}$/);

    const ip = await createIP({
      id,
      workspaceId: 'ws_1',
      type: 'universe',
      name: 'Starfall',
      description: 'A space opera universe',
      metadata: {},
      status: 'approved' as ContentStatus,
      createdAt: 0,
      updatedAt: 0,
    });

    expect(ip.id).toBe(id);
    expect(ip.name).toBe('Starfall');
    expect(ip.type).toBe('universe');
    expect(ip.status).toBe('approved');
    expect(ip.createdAt).toBeGreaterThan(0);
    expect(ip.updatedAt).toBeGreaterThan(0);
  });

  it('defaults status to draft when omitted', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { createIP } = await import('@/tree/ip-graph/types');

    const ip = await createIP({
      id: 'ip_draft',
      workspaceId: 'ws_1',
      type: 'character',
      name: 'Hero',
      description: '',
      metadata: {},
      status: 'draft',
      createdAt: 0,
      updatedAt: 0,
    });

    expect(ip.status).toBe('draft');
  });

  it('throws IPGraphError when D1 unavailable', async () => {
    vi.mocked(getD1).mockResolvedValue(null as never);

    const { createIP, IPGraphError } = await import('@/tree/ip-graph/types');

    await expect(
      createIP({ id: 'ip_x', workspaceId: 'ws', type: 'brand', name: 'n', description: '', metadata: {}, status: 'draft', createdAt: 0, updatedAt: 0 }),
    ).rejects.toThrow(IPGraphError);
  });
});

describe('IP Graph — getIP', () => {
  it('returns the IP entity by id', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertIP(d1, {
      id: 'ip_get', workspace_id: 'ws', type: 'brand',
      name: 'Acme', description: 'desc', parent_id: null,
      status: 'approved', metadata: { foo: 'bar' },
      created_at: 100, updated_at: 200,
    });

    const { getIP } = await import('@/tree/ip-graph/types');
    const ip = await getIP('ip_get');

    expect(ip).not.toBeNull();
    expect(ip!.name).toBe('Acme');
    expect(ip!.metadata).toEqual({ foo: 'bar' });
    expect(ip!.parentId).toBeUndefined();
  });

  it('returns null for nonexistent id', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { getIP } = await import('@/tree/ip-graph/types');
    expect(await getIP('ghost')).toBeNull();
  });
});

describe('IP Graph — listIP', () => {
  it('lists all IP for a workspace', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertIP(d1, { id: 'l1', workspace_id: 'ws', type: 'universe', name: 'U1', created_at: 300, updated_at: 300 });
    await insertIP(d1, { id: 'l2', workspace_id: 'ws', type: 'character', name: 'C1', created_at: 100, updated_at: 100 });
    // other workspace
    await insertIP(d1, { id: 'l3', workspace_id: 'other', type: 'universe', name: 'U2', created_at: 100, updated_at: 100 });

    const { listIP } = await import('@/tree/ip-graph/types');
    const result = await listIP('ws');

    expect(result).toHaveLength(2);
    // ordered by created_at DESC
    expect(result[0].id).toBe('l1');
    expect(result[1].id).toBe('l2');
  });

  it('filters by type when provided', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertIP(d1, { id: 'f1', workspace_id: 'ws', type: 'universe', name: 'U', created_at: 100, updated_at: 100 });
    await insertIP(d1, { id: 'f2', workspace_id: 'ws', type: 'character', name: 'C', created_at: 100, updated_at: 100 });

    const { listIP } = await import('@/tree/ip-graph/types');
    const result = await listIP('ws', 'character');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f2');
  });
});

describe('IP Graph — getIPChildren', () => {
  it('returns direct children of a parent IP', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertIP(d1, { id: 'parent', workspace_id: 'ws', type: 'universe', name: 'Parent', created_at: 100, updated_at: 100 });
    await insertIP(d1, { id: 'child1', workspace_id: 'ws', type: 'series', name: 'Child1', parent_id: 'parent', created_at: 100, updated_at: 100 });
    await insertIP(d1, { id: 'child2', workspace_id: 'ws', type: 'series', name: 'Child2', parent_id: 'parent', created_at: 200, updated_at: 200 });
    // not a child
    await insertIP(d1, { id: 'other', workspace_id: 'ws', type: 'series', name: 'Other', parent_id: 'other_parent', created_at: 100, updated_at: 100 });

    const { getIPChildren } = await import('@/tree/ip-graph/types');
    const children = await getIPChildren('parent');

    expect(children).toHaveLength(2);
    expect(children.map((c) => c.id).sort()).toEqual(['child1', 'child2']);
    expect(children[0].parentId).toBe('parent');
  });

  it('returns empty array for leaf node', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { getIPChildren } = await import('@/tree/ip-graph/types');
    expect(await getIPChildren('leaf')).toEqual([]);
  });
});

describe('IP Graph — updateIPStatus', () => {
  it('updates status and returns the updated IP', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertIP(d1, { id: 'upd', workspace_id: 'ws', type: 'character', name: 'X', status: 'draft', created_at: 100, updated_at: 100 });

    const { updateIPStatus } = await import('@/tree/ip-graph/types');
    const updated = await updateIPStatus('upd', 'published');

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('published');
    expect(updated!.updatedAt).toBeGreaterThan(100);
  });

  it('returns null for nonexistent id', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { updateIPStatus } = await import('@/tree/ip-graph/types');
    expect(await updateIPStatus('ghost', 'draft')).toBeNull();
  });
});

describe('IP Graph — getIPDerivatives', () => {
  it('recursively collects all descendants via BFS', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    // universe → series → character → theme
    await insertIP(d1, { id: 'root', workspace_id: 'ws', type: 'universe', name: 'Root', created_at: 100, updated_at: 100 });
    await insertIP(d1, { id: 's1', workspace_id: 'ws', type: 'series', name: 'S1', parent_id: 'root', created_at: 100, updated_at: 100 });
    await insertIP(d1, { id: 's2', workspace_id: 'ws', type: 'series', name: 'S2', parent_id: 'root', created_at: 100, updated_at: 100 });
    await insertIP(d1, { id: 'c1', workspace_id: 'ws', type: 'character', name: 'C1', parent_id: 's1', created_at: 100, updated_at: 100 });
    await insertIP(d1, { id: 't1', workspace_id: 'ws', type: 'theme', name: 'T1', parent_id: 'c1', created_at: 100, updated_at: 100 });
    // unrelated
    await insertIP(d1, { id: 'other', workspace_id: 'ws', type: 'brand', name: 'Other', parent_id: 'other_parent', created_at: 100, updated_at: 100 });

    const { getIPDerivatives } = await import('@/tree/ip-graph/types');
    const derivatives = await getIPDerivatives('root');

    expect(derivatives).toHaveLength(4);
    const ids = derivatives.map((d) => d.id).sort();
    expect(ids).toEqual(['c1', 'other', 's1', 's2', 't1'].filter((x) => x !== 'other'));
    // 'other' should NOT be included since its parent is 'other_parent', not in the tree
    expect(ids).not.toContain('other');
    expect(ids).toEqual(['c1', 's1', 's2', 't1']);
  });

  it('returns empty array for leaf node with no children', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { getIPDerivatives } = await import('@/tree/ip-graph/types');
    expect(await getIPDerivatives('ghost')).toEqual([]);
  });
});