import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite');

function makeD1(db: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => ({
          first: async <T = Record<string, unknown>>() => stmt.get(...params) as T | undefined,
          run: async () => {
            const r = stmt.run(...params);
            return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
          },
          all: async <T = Record<string, unknown>>() => {
            const rows = stmt.all(...params);
            return { results: rows as T[], meta: { changes: 0, duration: 0 } };
          },
        }),
        first: async <T = Record<string, unknown>>() => stmt.get() as T | undefined,
        run: async () => { const r = stmt.run(); return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } }; },
        all: async <T = Record<string, unknown>>() => ({ results: stmt.all() as T[], meta: { changes: 0, duration: 0 } }),
      };
    },
    exec: (sql: string) => db.exec(sql),
    batch: (stmts: unknown[]) => Promise.all(stmts),
  };
}

describe('node:sqlite D1 shim', () => {
  it('executes real SQL through the D1 chain API', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('CREATE TABLE creative_missions (id TEXT PRIMARY KEY, title TEXT, status TEXT, channels TEXT, created_at INTEGER, updated_at INTEGER)');
    const d1 = makeD1(db);

    await d1.prepare('INSERT INTO creative_missions (id, title, status, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind('m1', 'Build media business', 'draft', JSON.stringify(['youtube']), 1000, 1000).run();

    const row = await d1.prepare('SELECT * FROM creative_missions WHERE id = ?1').bind('m1').first<any>();
    expect(row?.title).toBe('Build media business');
    expect(JSON.parse(row.channels)).toEqual(['youtube']);

    const all = await d1.prepare('SELECT * FROM creative_missions').all<any>();
    expect(all.results).toHaveLength(1);
  });

  it('enforces primary key uniqueness', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE t (id TEXT PRIMARY KEY, v INTEGER)');
    const d1 = makeD1(db);
    await d1.prepare('INSERT INTO t (id, v) VALUES (?, ?)').bind('a', 1).run();
    await expect(d1.prepare('INSERT INTO t (id, v) VALUES (?, ?)').bind('a', 2).run()).rejects.toThrow();
  });
});
