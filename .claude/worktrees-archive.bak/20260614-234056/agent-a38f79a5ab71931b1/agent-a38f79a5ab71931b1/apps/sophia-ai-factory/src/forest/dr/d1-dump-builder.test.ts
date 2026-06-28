/**
 * Tests for d1-dump-builder.
 *
 * Uses an in-memory mock D1Database that responds to `prepare(sql).all<T>()`
 * with table introspection and row data based on a fixture map.
 */

import { describe, it, expect } from 'vitest';
import { buildD1Dump, sqlEscape } from './d1-dump-builder';

interface MockTableData {
  rows: Record<string, unknown>[];
}

function makeMockDb(fixtures: Record<string, MockTableData>): D1Database {
  const tableNames = Object.keys(fixtures);
  return {
    prepare(sql: string) {
      const sqlLower = sql.toLowerCase().trim();
      return {
        async all<T>(): Promise<{ results: T[] }> {
          // Match table-list query
          if (sqlLower.startsWith('select name from sqlite_master')) {
            return { results: tableNames.map((name) => ({ name })) as T[] };
          }
          // Match `SELECT * FROM "table" LIMIT N`
          const fromMatch = /from\s+"([^"]+)"/i.exec(sql);
          if (fromMatch) {
            const tableName = fromMatch[1];
            const data = fixtures[tableName];
            return { results: (data?.rows ?? []) as T[] };
          }
          return { results: [] as T[] };
        },
      } as unknown as ReturnType<D1Database['prepare']>;
    },
  } as unknown as D1Database;
}

describe('sqlEscape', () => {
  it('escapes null/undefined to NULL', () => {
    expect(sqlEscape(null)).toBe('NULL');
    expect(sqlEscape(undefined)).toBe('NULL');
  });

  it('serializes numbers, booleans, bigints', () => {
    expect(sqlEscape(42)).toBe('42');
    expect(sqlEscape(3.14)).toBe('3.14');
    expect(sqlEscape(true)).toBe('1');
    expect(sqlEscape(false)).toBe('0');
    expect(sqlEscape(BigInt('9999999999999999'))).toBe('9999999999999999');
  });

  it("doubles single quotes in strings", () => {
    expect(sqlEscape("it's a test")).toBe("'it''s a test'");
    expect(sqlEscape('plain')).toBe("'plain'");
    expect(sqlEscape('')).toBe("''");
  });

  it('encodes ArrayBuffer as X-prefixed hex literal', () => {
    const buf = new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer;
    expect(sqlEscape(buf)).toBe("X'deadbeef'");
  });
});

describe('buildD1Dump', () => {
  it('produces header + per-table INSERT statements', async () => {
    const db = makeMockDb({
      users: {
        rows: [
          { id: 1, email: 'alice@example.com', name: 'Alice' },
          { id: 2, email: 'bob@example.com', name: "O'Brian" },
        ],
      },
      orders: {
        rows: [{ id: 'ord_1', user_id: 1, amount: 9999 }],
      },
    });

    const dump = await buildD1Dump(db);

    expect(dump).toContain('-- Sophia AI Factory D1 dump');
    expect(dump).toContain('-- Generated:');
    expect(dump).toContain('INSERT INTO "users" ("id", "email", "name") VALUES');
    expect(dump).toContain("(1, 'alice@example.com', 'Alice')");
    expect(dump).toContain("(2, 'bob@example.com', 'O''Brian')");
    expect(dump).toContain('INSERT INTO "orders" ("id", "user_id", "amount") VALUES');
    expect(dump).toContain("('ord_1', 1, 9999)");
    expect(dump).toContain('-- Tables: 2');
  });

  it('emits empty-table marker for tables with no rows', async () => {
    const db = makeMockDb({
      empty_table: { rows: [] },
      filled_table: { rows: [{ id: 1, value: 'x' }] },
    });

    const dump = await buildD1Dump(db);

    expect(dump).toContain('-- Table: empty_table (0 rows)');
    expect(dump).toContain('INSERT INTO "filled_table"');
    expect(dump).toContain('-- Tables: 2');
  });

  it('handles null and ArrayBuffer values', async () => {
    const buf = new Uint8Array([0x01, 0xff]).buffer;
    const db = makeMockDb({
      mixed: {
        rows: [{ id: 1, optional: null, blob_col: buf }],
      },
    });

    const dump = await buildD1Dump(db);
    expect(dump).toContain("(1, NULL, X'01ff')");
  });
});
