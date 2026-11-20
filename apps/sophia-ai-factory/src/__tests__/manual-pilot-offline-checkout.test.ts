// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';

const state = vi.hoisted(() => ({ db: null as NodeSqliteD1Database | null, configured: true }));
vi.mock('@/seed/db/client', () => ({ getD1Safe: async () => state.db }));
vi.mock('@/seed/config/pilot-bank-config', () => ({
  resolvePilotBankConfig: async () => state.configured
    ? { configured: true, bankName: 'Bank', accountNumber: '123', accountHolder: 'Holder', transferPrefix: 'PILOT' }
    : { configured: false, transferPrefix: 'PILOT', reason: 'PILOT_BANK_NOT_CONFIGURED' },
  buildManualTransferReference: async (orderId: string) => `PILOT-${orderId}`,
}));

import { dispatchManualPilotOfflineCheckout } from '@/app/api/checkout/modules/manual-pilot-offline-checkout';

const consent = { accepted: true as const, version: OPTION_A_PILOT_CONTRACT.termsVersion, hash: OPTION_A_PILOT_CONTRACT.termsHash, locale: 'en' as const };

describe('offline pilot checkout adversarial cases', () => {
  let db: NodeSqliteD1Database;
  beforeEach(async () => {
    db = new NodeSqliteD1Database(':memory:');
    state.db = db; state.configured = true;
    await db.prepare('INSERT INTO organizations(id,name) VALUES (?,?)').bind('o','Org').run().catch(() => undefined);
    await db.prepare('INSERT INTO users(id,email) VALUES (?,?)').bind('u','u@example.test').run().catch(() => undefined);
    await db.prepare("INSERT INTO org_members(id,org_id,user_id,role) VALUES ('m','o','u','owner')").run();
    await db.exec(readFileSync('migrations/0070-pending-orders.sql','utf8'));
    await db.exec('ALTER TABLE pending_orders ADD COLUMN amount_vnd INTEGER');
    await db.exec(readFileSync('migrations/0506_manual_pilot_settlement_ledger.sql','utf8'));
    await db.exec(readFileSync('migrations/0507_manual_pilot_financial_state.sql','utf8'));
    await db.exec(readFileSync('migrations/0514_manual_pilot_terms_acceptance.sql','utf8'));
  });
  afterEach(() => { state.db = null; });
  const invoke = (override = {}) => dispatchManualPilotOfflineCheckout({ tier: 'BASIC', period: 'pilot_14d', paymentMethod: 'nowpayments', userId: 'u', agreement: consent, ...override } as Parameters<typeof dispatchManualPilotOfflineCheckout>[0]);

  it('rejects consent before creating any order side effect', async () => {
    const response = await invoke({ agreement: { ...consent, accepted: false } });
    expect(response.status).toBe(400);
    expect(await db.prepare('SELECT COUNT(*) n FROM pending_orders').first('n')).toBe(0);
  });
  it('returns truthful unavailable before creating rows when bank config is absent', async () => {
    state.configured = false;
    const response = await invoke();
    expect(response.status).toBe(503);
    expect(await db.prepare('SELECT COUNT(*) n FROM pending_orders').first('n')).toBe(0);
  });
  it('atomically creates a manual offline order and matching immutable acceptance, idempotently', async () => {
    const first = await invoke(); const firstBody = await first.json() as { orderId: string };
    const second = await invoke(); const secondBody = await second.json() as { orderId: string };
    expect(firstBody).toMatchObject({ paymentMethod: 'offline_bank_transfer' });
    expect(first.status).toBe(200); expect(second.status).toBe(200);
    expect(secondBody.orderId).toBe(firstBody.orderId);
    expect(await db.prepare('SELECT payment_method,invoice_url FROM pending_orders WHERE order_id=?').bind(firstBody.orderId).first()).toEqual({ payment_method: 'offline', invoice_url: null });
    expect(await db.prepare('SELECT user_id,org_id,agreement_hash,legal_status FROM manual_pilot_terms_acceptances WHERE order_id=?').bind(firstBody.orderId).first()).toMatchObject({ user_id: 'u', org_id: 'o', agreement_hash: consent.hash, legal_status: 'pending_legal_review' });
  });
  it('rolls back all writes if acceptance insertion fails', async () => {
    await db.exec("CREATE TRIGGER reject_accept BEFORE INSERT ON manual_pilot_terms_acceptances BEGIN SELECT RAISE(ABORT,'no'); END");
    const response = await invoke();
    expect(response.status).toBe(503);
    expect(await db.prepare('SELECT COUNT(*) n FROM pending_orders').first('n')).toBe(0);
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_settlements').first('n')).toBe(0);
  });
  it('serializes concurrent retries with a single order and immutable consent', async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () => invoke()));
    expect(responses.map(response => response.status)).toEqual(Array(8).fill(200));
    const bodies = await Promise.all(responses.map(async response => await response.json() as { orderId: string }));
    expect(new Set(bodies.map(body => body.orderId)).size).toBe(1);
    for (const table of ['pending_orders', 'manual_pilot_settlements', 'manual_pilot_terms_acceptances', 'manual_pilot_audit_log']) {
      expect(await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first('n')).toBe(1);
    }
  });
  it.each(['payos', 'nowpayments', 'offline'])('rejects legacy %s invoice reuse without new side effects', async method => {
    const response = await invoke();
    const { orderId } = await response.json() as { orderId: string };
    // Remove only the disposable fixture protection to reproduce a pre-consent order.
    await db.exec('DROP TRIGGER manual_pilot_terms_acceptances_no_delete');
    await db.prepare('DELETE FROM manual_pilot_terms_acceptances WHERE order_id=?').bind(orderId).run();
    await db.prepare('UPDATE pending_orders SET payment_method=?,invoice_url=? WHERE order_id=?').bind(method,'https://provider.test/invoice',orderId).run();
    const before = await db.prepare('SELECT COUNT(*) n FROM manual_pilot_audit_log').first('n');
    expect((await invoke()).status).toBe(503);
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_terms_acceptances').first('n')).toBe(0);
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_audit_log').first('n')).toBe(before);
  });
  it('rejects cross-tenant organization before writes', async () => {
    const response = await invoke({ orgId: 'other' });
    expect(response.status).toBe(403);
    expect(await db.prepare('SELECT COUNT(*) n FROM pending_orders').first('n')).toBe(0);
  });
});
