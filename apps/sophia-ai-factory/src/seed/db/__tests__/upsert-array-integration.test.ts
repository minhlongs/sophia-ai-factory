/**
 * Integration test for D1Client.upsert against a real SQLite backend
 * (better-sqlite3 via createFakeD1). Pinned because the array-payload
 * execUpsert branch used to be missing — `Object.keys(arr)` produced
 * numeric-index SQL columns, silently masked by `as any` at every
 * call site. Caught by code-reviewer in commit 5d644d03 follow-up;
 * fixed in commit 6d40c995.
 *
 * @module seed/db/__tests__/upsert-array-integration.test
 */

import { describe, it, expect } from 'vitest'
import { createClientFromBinding } from '@/seed/db/client'
import { createFakeD1 } from '@/lib/publishing/__tests__/fake-d1-sqlite'
import type { D1Database } from '@cloudflare/workers-types'

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS network_products (
    network_id TEXT NOT NULL,
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    PRIMARY KEY (network_id, external_id)
  )`,
]

describe('D1Client.upsert — array payload integration', () => {
  it('runs N independent INSERT ... ON CONFLICT statements for an array', async () => {
    const fake = createFakeD1(SCHEMA)
    const db = createClientFromBinding(fake as unknown as D1Database)

    const rows = [
      { id: 'p1', name: 'Alpha', price: 100, updated_at: '2026-05-11' },
      { id: 'p2', name: 'Beta', price: 200, updated_at: '2026-05-11' },
      { id: 'p3', name: 'Gamma', price: 300, updated_at: '2026-05-11' },
    ]

    const { error } = await db.from('products').upsert(rows)
    expect(error).toBeNull()

    const inserted = fake._db.prepare('SELECT id, name, price FROM products ORDER BY id').all()
    expect(inserted).toEqual([
      { id: 'p1', name: 'Alpha', price: 100 },
      { id: 'p2', name: 'Beta', price: 200 },
      { id: 'p3', name: 'Gamma', price: 300 },
    ])
  })

  it('preserves column names — never serialises numeric array indices as columns', async () => {
    const fake = createFakeD1(SCHEMA)
    const db = createClientFromBinding(fake as unknown as D1Database)

    // Regression guard: pre-fix `execUpsert` did `Object.keys(payload)` on
    // the raw array, generating SQL like `INSERT INTO products (0, 1, 2)`.
    // SQLite would reject that with `no such column: 0`. If this test ever
    // fails with a SQL syntax/column error, execUpsert lost its array branch.
    const rows = [
      { id: 'col-check-1', name: 'One', price: 1 },
      { id: 'col-check-2', name: 'Two', price: 2 },
    ]

    await expect(db.from('products').upsert(rows)).resolves.toEqual(
      expect.objectContaining({ error: null }),
    )

    // Count assertion proves INSERT actually executed — guards against a future
    // execUpsert regression that silently no-ops (returns `error: null` without
    // running SQL); the row count would expose that loophole.
    const count = fake._db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }
    expect(count.c).toBe(2)

    const stored = fake._db.prepare('SELECT id, name FROM products WHERE id LIKE ?').all('col-check-%') as Array<{ id: string; name: string }>
    expect(stored).toHaveLength(2)
    expect(stored.map((r) => r.name).sort()).toEqual(['One', 'Two'])
  })

  it('empty array `[]` is a no-op (does not throw, persists nothing)', async () => {
    const fake = createFakeD1(SCHEMA)
    const db = createClientFromBinding(fake as unknown as D1Database)

    const { error } = await db.from('products').upsert([])
    expect(error).toBeNull()

    const count = fake._db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }
    expect(count.c).toBe(0)
  })

  it('length-1 array stays an array (distinct from single-row payload return contract)', async () => {
    const fake = createFakeD1(SCHEMA)
    const db = createClientFromBinding(fake as unknown as D1Database)

    const result = await db.from('products').upsert([
      { id: 'len1', name: 'Solo-in-Array', price: 42 },
    ])
    expect(result.error).toBeNull()
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.data).toHaveLength(1)

    const row = fake._db.prepare('SELECT id, name, price FROM products WHERE id = ?').get('len1')
    expect(row).toEqual({ id: 'len1', name: 'Solo-in-Array', price: 42 })
  })

  it('ON CONFLICT updates existing rows on second upsert', async () => {
    const fake = createFakeD1(SCHEMA)
    const db = createClientFromBinding(fake as unknown as D1Database)

    await db.from('products').upsert([
      { id: 'x', name: 'Initial', price: 10 },
    ])

    await db.from('products').upsert([
      { id: 'x', name: 'Updated', price: 99 },
      { id: 'y', name: 'New', price: 50 },
    ])

    const all = fake._db.prepare('SELECT id, name, price FROM products ORDER BY id').all()
    expect(all).toEqual([
      { id: 'x', name: 'Updated', price: 99 },
      { id: 'y', name: 'New', price: 50 },
    ])
  })

  it('still accepts a single-row payload (no array)', async () => {
    const fake = createFakeD1(SCHEMA)
    const db = createClientFromBinding(fake as unknown as D1Database)

    const { error } = await db.from('products').upsert({
      id: 'solo',
      name: 'Lone',
      price: 7,
    })
    expect(error).toBeNull()

    const row = fake._db.prepare('SELECT id, name, price FROM products WHERE id = ?').get('solo')
    expect(row).toEqual({ id: 'solo', name: 'Lone', price: 7 })
  })

  it('upserts onto a composite UNIQUE key (network_id, external_id)', async () => {
    const fake = createFakeD1(SCHEMA)
    const db = createClientFromBinding(fake as unknown as D1Database)

    await db.from('network_products').upsert([
      { network_id: 'cb', external_id: 'a', title: 'First', score: 1 },
      { network_id: 'cb', external_id: 'b', title: 'Second', score: 2 },
    ])

    // Re-upsert "a" — should update, not duplicate.
    await db.from('network_products').upsert([
      { network_id: 'cb', external_id: 'a', title: 'First Updated', score: 99 },
    ])

    const rows = fake._db.prepare('SELECT network_id, external_id, title, score FROM network_products ORDER BY external_id').all()
    expect(rows).toEqual([
      { network_id: 'cb', external_id: 'a', title: 'First Updated', score: 99 },
      { network_id: 'cb', external_id: 'b', title: 'Second', score: 2 },
    ])
  })
})
