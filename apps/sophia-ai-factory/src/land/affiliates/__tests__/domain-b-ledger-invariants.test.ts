/**
 * Scenario 8 + 3 + 5: renewal, partial refund, reversal after paid, duplicate
 * and out-of-order statements, multi-currency and tenant isolation — all at the
 * real SQLite/D1 boundary through the postback service and reconciliation.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { computeHmacSha256Hex } from '@/land/postback/hmac-verifier';
import { processSaasCryptoPostback } from '@/land/affiliates/postbacks/saas-crypto-postback-service';
import {
  computeDomainBReconciliation,
  fetchWorkspaceDomainBReconciliation,
  type DomainBCommissionRecord,
} from '@/land/affiliates/reconciliation/workspace-domain-b-reconciliation';

const SECRET = 'test_webhook_secret_key_1234567890';

function makeDb() {
  const prior = readFileSync(resolve(process.cwd(), 'migrations/0206_commission_events.sql'), 'utf8');
  const upgrade = readFileSync(
    resolve(process.cwd(), 'migrations/0482_opc_affiliate_execution_truth.sql'),
    'utf8',
  );
  return createFakeD1([prior, upgrade]) as unknown as D1Database;
}

async function send(
  db: D1Database,
  tenantId: string,
  network: 'partnerstack' | 'bybit',
  body: Record<string, unknown>,
  opts: { omitTenant?: boolean } = {},
) {
  const rawBody = JSON.stringify(body);
  const signature = await computeHmacSha256Hex(SECRET, rawBody);
  return processSaasCryptoPostback({
    db,
    ...(opts.omitTenant ? {} : { tenantId }),
    network,
    rawBody,
    signature,
    secret: SECRET,
  });
}

const rec = (
  id: string,
  status: DomainBCommissionRecord['status'],
  commissionCents: number,
  occurredAt: number,
  currency = 'USD',
  externalTxId = 'tx_1',
): DomainBCommissionRecord => ({
  id,
  tenantId: 'ws_a',
  network: 'partnerstack',
  externalTxId,
  grossAmountCents: 10000,
  commissionCents,
  status,
  currency,
  occurredAt,
});

describe('Domain B ledger invariants (source math)', () => {
  it('a reversal AFTER a paid receipt wins and does not inflate the balance', () => {
    const records = [
      rec('r1', 'pending', 1000, 100),
      rec('r2', 'approved', 1000, 200),
      rec('r3', 'paid_receipt', 1000, 300),
      rec('r4', 'reversed', 1000, 400),
      rec('r5', 'pending', 1000, 500), // delayed duplicate of an older statement
    ];
    const s = computeDomainBReconciliation('ws_a', records);
    expect(s.paidReceiptCents).toBe(0);
    expect(s.effectiveCommissionCents).toBe(0);
    expect(s.reversedCents).toBe(1000);
    expect(s.byCurrency.USD.effectiveCommissionCents).toBe(0);
  });

  it('a partial refund is an adjustment that reduces effective commission but keeps history', () => {
    const records = [
      rec('r1', 'approved', 1000, 100),
      rec('adj1', 'reversed', 400, 200, 'USD', 'tx_1#adj:aaa'),
      rec('adj2', 'reversed', 100, 300, 'USD', 'tx_1#adj:bbb'),
    ];
    const s = computeDomainBReconciliation('ws_a', records);
    expect(s.effectiveCommissionCents).toBe(500);
    expect(s.adjustmentCents).toBe(500);
    expect(s.reversedCents).toBe(500);
    expect(s.byCurrency.USD.effectiveCommissionCents).toBe(500);
  });

  it('a renewal with its own transaction id is a separate commission, not a duplicate', () => {
    const records = [
      rec('r1', 'paid_receipt', 1000, 100, 'USD', 'sub_month_1'),
      rec('r2', 'paid_receipt', 1000, 200, 'USD', 'sub_month_2'),
    ];
    const s = computeDomainBReconciliation('ws_a', records);
    expect(s.paidReceiptCents).toBe(2000);
    expect(s.effectiveCommissionCents).toBe(2000);
    expect(s.byNetwork.partnerstack.count).toBe(2);
  });

  it('does not mix currencies into one fake headline figure', () => {
    const records = [
      rec('r1', 'paid_receipt', 1000, 100, 'USD', 'tx_usd'),
      rec('r2', 'paid_receipt', 2000, 200, 'USDT', 'tx_usdt'),
      rec('r3', 'paid_receipt', 3000, 300, 'EUR', 'tx_eur'),
    ];
    const s = computeDomainBReconciliation('ws_a', records);
    expect(s.isSingleCurrency).toBe(false);
    expect(s.totalsAvailable).toBe(false);
    expect(s.effectiveCommissionCents).toBe(0);
    expect(s.currencies).toEqual(['EUR', 'USD', 'USDT']);
    expect(s.byCurrency.USD.effectiveCommissionCents).toBe(1000);
    expect(s.byCurrency.USDT.effectiveCommissionCents).toBe(2000);
    expect(s.byCurrency.EUR.effectiveCommissionCents).toBe(3000);
    expect(s.byNetwork.partnerstack.mixedCurrencies).toBe(true);
  });
});

describe('Domain B ledger invariants (DB boundary)', () => {
  it('requires a server-resolved tenant for any ledger write', async () => {
    const res = await send(makeDb(), '', 'partnerstack', { id: 'tx_1', reward_amount_cents: 100 }, { omitTenant: true });
    expect(res.success).toBe(false);
    expect(res.error).toBe('TENANT_REQUIRED');
  });

  it('replay is idempotent; lifecycle transition is not swallowed; partial refund is retained', async () => {
    const db = makeDb();
    const pending = { id: 'tx_renew_1', reward_amount_cents: 1000, status: 'pending', currency: 'USD' };
    const first = await send(db, 'ws_a', 'partnerstack', pending);
    expect(first.success).toBe(true);
    expect(first.isIdempotentDuplicate).toBe(false);

    const replay = await send(db, 'ws_a', 'partnerstack', pending);
    expect(replay.isIdempotentDuplicate).toBe(true);

    const approved = await send(db, 'ws_a', 'partnerstack', { ...pending, status: 'approved' });
    expect(approved.isIdempotentDuplicate).toBe(false);

    const paid = await send(db, 'ws_a', 'partnerstack', { ...pending, status: 'paid' });
    expect(paid.success).toBe(true);

    // Reversal arrives AFTER paid receipt.
    const reversed = await send(db, 'ws_a', 'partnerstack', {
      ...pending, status: 'reversed', reward_amount_cents: -1000,
    });
    expect(reversed.success).toBe(true);

    // Partial refund of a second invoice — an adjustment, not a dedup collision.
    const partial = await send(db, 'ws_a', 'partnerstack', {
      id: 'tx_renew_2', reward_amount_cents: 300, status: 'reversed',
      currency: 'USD', partial_refund: true, adjustment_id: 'adj_1',
    });
    expect(partial.success).toBe(true);

    const summary = await fetchWorkspaceDomainBReconciliation(db, 'ws_a');
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;
    // tx_renew_1 fully reversed; the partial adjustment reduces what remains.
    expect(summary.value.byCurrency.USD.effectiveCommissionCents).toBeLessThanOrEqual(0);
    expect(summary.value.byCurrency.USD.adjustmentCents).toBe(300);

    const rows = await db
      .prepare('SELECT COUNT(*) as cnt FROM workspace_external_commissions WHERE tenant_id = ?')
      .bind('ws_a')
      .first<{ cnt: number }>();
    // pending + approved + paid + reversed + partial adjustment = 5 rows.
    expect(rows?.cnt).toBe(5);
  });

  it('tenant A and B can process the same provider event id independently', async () => {
    const db = makeDb();
    const body = { id: 'shared_event', reward_amount_cents: 500, status: 'approved', currency: 'USD' };
    const a = await send(db, 'ws_a', 'partnerstack', body);
    const b = await send(db, 'ws_b', 'partnerstack', body);
    expect(a.success && b.success).toBe(true);
    expect(b.isIdempotentDuplicate).toBe(false);

    const countA = await db
      .prepare('SELECT COUNT(*) as cnt FROM workspace_external_commissions WHERE tenant_id = ?')
      .bind('ws_a')
      .first<{ cnt: number }>();
    const countB = await db
      .prepare('SELECT COUNT(*) as cnt FROM workspace_external_commissions WHERE tenant_id = ?')
      .bind('ws_b')
      .first<{ cnt: number }>();
    expect(countA?.cnt).toBe(1);
    expect(countB?.cnt).toBe(1);

    const events = await db
      .prepare('SELECT event_id FROM commission_events ORDER BY event_id')
      .all<{ event_id: string }>();
    expect(new Set(events.results.map((e) => e.event_id)).size).toBe(2);
  });
});
