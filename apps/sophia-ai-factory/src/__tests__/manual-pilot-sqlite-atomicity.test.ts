// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { deductCredits } from '@/tree/mcu/credits-repo';

const creditDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/seed/db/client', () => ({ getD1: () => creditDb.current }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: { debug: vi.fn(), error: vi.fn() } }));

// These tests exercise real SQL, not the unrelated repository migration loader.
vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));

async function database() {
  const db = new NodeSqliteD1Database(':memory:');
  await db.exec('CREATE TABLE effects (id INTEGER PRIMARY KEY, amount INTEGER CHECK(amount >= 0))');
  return db;
}

describe('local SQLite financial batch atomicity', () => {
  it('commits every mandatory effect', async () => {
    const db = await database();
    const results = await db.batch([
      db.prepare('INSERT INTO effects VALUES (?, ?)').bind(1, 500),
      db.prepare('INSERT INTO effects VALUES (?, ?)').bind(2, 14),
    ]);
    expect(results.map((result) => result.meta.changes)).toEqual([1, 1]);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM effects').first('n')).toBe(2);
  });

  it('rolls back earlier effects when a later mandatory effect fails', async () => {
    const db = await database();
    await expect(db.batch([
      db.prepare('INSERT INTO effects VALUES (1, 500)'),
      db.prepare('INSERT INTO effects VALUES (2, -1)'),
    ])).rejects.toThrow();
    expect(await db.prepare('SELECT COUNT(*) AS n FROM effects').first('n')).toBe(0);
    await db.batch([db.prepare('INSERT INTO effects VALUES (3, 1)')]);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM effects').first('n')).toBe(1);
  });

  it('does not yield between statements to concurrent requests', async () => {
    const db = await database();
    const failedBatch = db.batch([
      db.prepare('INSERT INTO effects VALUES (1, 500)'),
      db.prepare('INSERT INTO effects VALUES (2, -1)'),
    ]);
    const concurrent = db.prepare('INSERT INTO effects VALUES (3, 7)').run();
    await expect(failedBatch).rejects.toThrow();
    await concurrent;
    expect(await db.prepare('SELECT id FROM effects').first('id')).toBe(3);
  });

  it('rejects statements from a different database before any mutation', async () => {
    const db = await database();
    const other = await database();
    await expect(db.batch([
      db.prepare('INSERT INTO effects VALUES (1, 500)'),
      other.prepare('INSERT INTO effects VALUES (2, 14)'),
    ])).rejects.toThrow('Batch requires statements');
    expect(await db.prepare('SELECT COUNT(*) AS n FROM effects').first('n')).toBe(0);
    expect(await other.prepare('SELECT COUNT(*) AS n FROM effects').first('n')).toBe(0);
  });
});

async function walletDatabase() {
  const db = new NodeSqliteD1Database(':memory:');
  await db.exec(`
    CREATE TABLE user_mcu_balance (
      user_id TEXT PRIMARY KEY, credits_remaining REAL,
      credits_total_used REAL DEFAULT 0, updated_at TEXT
    );
    CREATE TABLE mcu_transactions (
      user_id TEXT, delta REAL, reason TEXT, mission_id TEXT, metadata TEXT
    );
    INSERT INTO user_mcu_balance (user_id, credits_remaining) VALUES ('user', 500);
  `);
  creditDb.current = db;
  return db;
}

describe('live MCU debit atomicity', () => {
  it('commits debit and ledger together', async () => {
    const db = await walletDatabase();
    expect(await deductCredits('user', 100, 'mission', 'test')).toBe(true);
    expect(await db.prepare('SELECT credits_remaining FROM user_mcu_balance').first('credits_remaining')).toBe(400);
    expect(await db.prepare('SELECT delta FROM mcu_transactions').first('delta')).toBe(-100);
  });

  it('does not write a ledger row for insufficient balance', async () => {
    const db = await walletDatabase();
    expect(await deductCredits('user', 501, 'mission', 'test')).toBe(false);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM mcu_transactions').first('n')).toBe(0);
  });

  it('rolls back debit when ledger insert fails', async () => {
    const db = await walletDatabase();
    await db.exec(`CREATE TRIGGER fail_ledger BEFORE INSERT ON mcu_transactions
      BEGIN SELECT RAISE(ABORT, 'injected ledger failure'); END`);
    expect(await deductCredits('user', 100, 'mission', 'test')).toBe(false);
    expect(await db.prepare('SELECT credits_remaining FROM user_mcu_balance').first('credits_remaining')).toBe(500);
  });

  it('does not overspend under concurrent attempts', async () => {
    const db = await walletDatabase();
    const attempts = await Promise.all([
      deductCredits('user', 400, 'one', 'test'),
      deductCredits('user', 400, 'two', 'test'),
    ]);
    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(await db.prepare('SELECT credits_remaining FROM user_mcu_balance').first('credits_remaining')).toBe(100);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM mcu_transactions').first('n')).toBe(1);
  });
});
