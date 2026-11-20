// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { buildManualTransferReference } from '@/seed/config/pilot-bank-config';
import { createManualPilotSettlementRow } from '@/land/payments/manual-pilot/manual-pilot-repo';

vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));
const migration = () => readFileSync(resolve('migrations/0512_manual_pilot_transfer_reference_unique.sql'), 'utf8');
const aliceOrder = 'sophia_alice_1795090500000';
const bobOrder = 'sophia_bob_1795090500000';

describe('manual pilot cryptographic transfer references', () => {
  it('distinguishes different full order IDs with the same timestamp', async () => {
    expect(await buildManualTransferReference(aliceOrder)).not.toBe(await buildManualTransferReference(bobOrder));
  });

  it('uses a stable SHA256 digest of the exact full ID without lossy cleaning', async () => {
    const expected = createHash('sha256').update(aliceOrder).digest('hex').slice(0, 32).toUpperCase();
    expect(await buildManualTransferReference(aliceOrder)).toBe(`SOPHIA-PILOT-${expected}`);
    expect(await buildManualTransferReference('a-b')).not.toBe(await buildManualTransferReference('ab'));
    expect(await buildManualTransferReference('Alice')).not.toBe(await buildManualTransferReference('alice'));
  });

  it('keeps sanitized bank memos within 49 characters', async () => {
    const reference = await buildManualTransferReference(aliceOrder, 'lower case ++ prefix that is too long');
    expect(reference).toMatch(/^[A-Z0-9-]+-[A-F0-9]{32}$/);
    expect(reference.length).toBeLessThanOrEqual(49);
    expect(await buildManualTransferReference(aliceOrder, '!')).toMatch(/^SOPHIA-PILOT-/);
  });
});

describe('durable transfer reference uniqueness in SQLite', () => {
  let db: NodeSqliteD1Database;
  beforeEach(async () => {
    db = new NodeSqliteD1Database(':memory:');
    await db.exec(readFileSync(resolve('migrations/0506_manual_pilot_settlement_ledger.sql'), 'utf8'));
    await db.exec(readFileSync(resolve('migrations/0507_manual_pilot_financial_state.sql'), 'utf8'));
    await db.exec("CREATE TABLE org_members(user_id TEXT, org_id TEXT); INSERT INTO org_members VALUES ('alice','org-a'),('bob','org-b')");
  });

  const params = (orderId: string, userId: string, transferReference: string) => ({ orderId, userId, transferReference });

  it('persists same-millisecond orders for different users with distinct references', async () => {
    await db.exec(migration());
    const references = await Promise.all([buildManualTransferReference(aliceOrder), buildManualTransferReference(bobOrder)]);
    const results = await Promise.all([
      createManualPilotSettlementRow(db, params(aliceOrder, 'alice', references[0])),
      createManualPilotSettlementRow(db, params(bobOrder, 'bob', references[1])),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(await db.prepare('SELECT COUNT(DISTINCT transfer_reference) n FROM manual_pilot_settlements').first('n')).toBe(2);
  });

  it('keeps matching order retries idempotent with one audit and financial state row', async () => {
    await db.exec(migration());
    const input = params(aliceOrder, 'alice', await buildManualTransferReference(aliceOrder));
    const original = await createManualPilotSettlementRow(db, input);
    expect(original.ok).toBe(true);
    expect(await createManualPilotSettlementRow(db, input)).toEqual(original);
    for (const table of ['manual_pilot_settlements', 'manual_pilot_audit_log', 'manual_pilot_financial_state']) {
      expect(await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first('n')).toBe(1);
    }
  });

  it('fails closed on a retry with a different reference without changing the original', async () => {
    await db.exec(migration());
    const original = await createManualPilotSettlementRow(db, params(aliceOrder, 'alice', 'ORIGINAL'));
    expect(original.ok).toBe(true);
    expect(await createManualPilotSettlementRow(db, params(aliceOrder, 'alice', 'DIFFERENT')))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await db.prepare('SELECT transfer_reference FROM manual_pilot_settlements').first('transfer_reference')).toBe('ORIGINAL');
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_audit_log').first('n')).toBe(1);
  });

  it('rejects another order reusing a durable reference and rolls back its entire batch', async () => {
    await db.exec(migration());
    expect((await createManualPilotSettlementRow(db, params(aliceOrder, 'alice', 'SHARED'))).ok).toBe(true);
    expect(await createManualPilotSettlementRow(db, params(bobOrder, 'bob', 'SHARED')))
      .toMatchObject({ ok: false, error: { code: 'DB_ERROR' } });
    for (const table of ['manual_pilot_settlements', 'manual_pilot_audit_log', 'manual_pilot_financial_state']) {
      expect(await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first('n')).toBe(1);
    }
  });

  it('rejects a direct SQL update to a reference already held by another order', async () => {
    await db.exec(migration());
    expect((await createManualPilotSettlementRow(db, params(aliceOrder, 'alice', 'FIRST'))).ok).toBe(true);
    expect((await createManualPilotSettlementRow(db, params(bobOrder, 'bob', 'SECOND'))).ok).toBe(true);
    await expect(db.prepare("UPDATE manual_pilot_settlements SET transfer_reference='FIRST' WHERE user_id='bob'").run())
      .rejects.toThrow(/UNIQUE/);
    expect(await db.prepare("SELECT transfer_reference FROM manual_pilot_settlements WHERE user_id='bob'").first('transfer_reference')).toBe('SECOND');
  });

  it('fails migration safely on historical duplicates, preserving all historical rows', async () => {
    expect((await createManualPilotSettlementRow(db, params(aliceOrder, 'alice', 'LEGACY-SHARED'))).ok).toBe(true);
    expect((await createManualPilotSettlementRow(db, params(bobOrder, 'bob', 'LEGACY-SHARED'))).ok).toBe(true);
    const before = await db.prepare('SELECT * FROM manual_pilot_settlements ORDER BY order_id').all();
    await expect(db.exec(migration())).rejects.toThrow(/UNIQUE/);
    expect(await db.prepare('SELECT * FROM manual_pilot_settlements ORDER BY order_id').all()).toEqual(before);
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_audit_log').first('n')).toBe(2);
  });

  it('adds uniqueness idempotently without rewriting existing unique references', async () => {
    expect((await createManualPilotSettlementRow(db, params(aliceOrder, 'alice', 'LEGACY-UNIQUE'))).ok).toBe(true);
    const before = await db.prepare('SELECT * FROM manual_pilot_settlements').first();
    await db.exec(migration());
    await db.exec(migration());
    expect(await db.prepare('SELECT * FROM manual_pilot_settlements').first()).toEqual(before);
  });
});
