/**
 * Tests for Workspace Domain B Affiliate Reconciliation Engine
 */

import { describe, it, expect, vi } from 'vitest';
import {
  computeDomainBReconciliation,
  fetchWorkspaceDomainBReconciliation,
  type DomainBCommissionRecord,
} from '../workspace-domain-b-reconciliation';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';

describe('workspace-domain-b-reconciliation', () => {
  const sampleRecords: DomainBCommissionRecord[] = [
    { id: 'rec_1', tenantId: 'ws_1', network: 'binance', externalTxId: 'tx_bn_1', grossAmountCents: 100000, commissionCents: 3500, status: 'pending', currency: 'USD', occurredAt: 1000 },
    { id: 'rec_2', tenantId: 'ws_1', network: 'binance', externalTxId: 'tx_bn_2', grossAmountCents: 200000, commissionCents: 7000, status: 'approved', currency: 'USD', occurredAt: 2000 },
    { id: 'rec_3', tenantId: 'ws_1', network: 'partnerstack', externalTxId: 'tx_ps_1', grossAmountCents: 50000, commissionCents: 15000, status: 'paid_receipt', currency: 'USD', occurredAt: 3000 },
    { id: 'rec_4', tenantId: 'ws_1', network: 'partnerstack', externalTxId: 'tx_ps_2', grossAmountCents: 30000, commissionCents: 9000, status: 'reversed', currency: 'USD', occurredAt: 4000 },
    { id: 'rec_other', tenantId: 'ws_other', network: 'bybit', externalTxId: 'tx_byb_99', grossAmountCents: 999999, commissionCents: 99999, status: 'paid_receipt', currency: 'USD', occurredAt: 5000 },
  ];

  it('aggregates 4-state lifecycle accurately with 0% platform fee and strict tenant isolation', () => {
    const summary = computeDomainBReconciliation('ws_1', sampleRecords);

    expect(summary.workspaceId).toBe('ws_1');
    expect(summary.pendingCents).toBe(3500);
    expect(summary.approvedUnpaidCents).toBe(7000);
    expect(summary.paidReceiptCents).toBe(15000);
    expect(summary.reversedCents).toBe(9000);
    expect(summary.platformFeeCents).toBe(0);
    expect(summary.effectiveCommissionCents).toBe(22000); // approved (7000) + paid_receipt (15000)
    expect(summary.totalGrossVolumeCents).toBe(380000);
    expect(summary.byNetwork.binance.commissionCents).toBe(10500);
    expect(summary.byNetwork.partnerstack.paidCents).toBe(15000);
    expect(summary.byNetwork.bybit).toBeUndefined();
    expect(summary.byCurrency.USD.effectiveCommissionCents).toBe(22000);
  });

  it('handles state progression and protects terminal states from out-of-order pending webhooks', () => {
    const progressionRecords: DomainBCommissionRecord[] = [
      { id: 'rec_tx1_pending', tenantId: 'ws_1', network: 'bybit', externalTxId: 'order_123', grossAmountCents: 50000, commissionCents: 2000, status: 'pending', currency: 'USDT', occurredAt: 100 },
      { id: 'rec_tx1_approved', tenantId: 'ws_1', network: 'bybit', externalTxId: 'order_123', grossAmountCents: 50000, commissionCents: 2000, status: 'approved', currency: 'USDT', occurredAt: 200 },
      { id: 'rec_tx1_paid', tenantId: 'ws_1', network: 'bybit', externalTxId: 'order_123', grossAmountCents: 50000, commissionCents: 2000, status: 'paid_receipt', currency: 'USDT', occurredAt: 300 },
      { id: 'rec_tx1_late_pending', tenantId: 'ws_1', network: 'bybit', externalTxId: 'order_123', grossAmountCents: 50000, commissionCents: 2000, status: 'pending', currency: 'USDT', occurredAt: 999 },
    ];

    const summary = computeDomainBReconciliation('ws_1', progressionRecords);
    expect(summary.pendingCents).toBe(0);
    expect(summary.approvedUnpaidCents).toBe(0);
    expect(summary.paidReceiptCents).toBe(2000);
    expect(summary.effectiveCommissionCents).toBe(2000);
    expect(summary.totalGrossVolumeCents).toBe(50000);
    expect(summary.byCurrency.USDT.paidReceiptCents).toBe(2000);
    expect(summary.byNetwork.bybit.count).toBe(1);
  });

  it('executes real SQLite D1 queries on migration 0480 schema and returns Result summary', async () => {
    const fakeDb = createFakeD1([
      `CREATE TABLE workspace_external_commissions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        campaign_id TEXT,
        network TEXT NOT NULL,
        niche TEXT NOT NULL,
        external_tx_id TEXT NOT NULL,
        sub_id TEXT,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        gross_amount_cents INTEGER NOT NULL DEFAULT 0,
        commission_cents INTEGER NOT NULL,
        platform_fee_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        is_recurring INTEGER NOT NULL DEFAULT 0,
        payout_receipt_ref TEXT,
        raw_payload TEXT,
        occurred_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );`,
    ]);

    // Insert sample records for ws_1 and ws_other
    for (const rec of sampleRecords) {
      await fakeDb
        .prepare(
          `INSERT INTO workspace_external_commissions
           (id, tenant_id, network, niche, external_tx_id, event_type, status, gross_amount_cents, commission_cents, platform_fee_cents, currency, occurred_at)
           VALUES (?, ?, ?, 'crypto_global', ?, 'rebate', ?, ?, ?, 0, ?, ?)`
        )
        .bind(rec.id, rec.tenantId, rec.network, rec.externalTxId, rec.status, rec.grossAmountCents, rec.commissionCents, rec.currency, rec.occurredAt ?? 1000)
        .run();
    }

    const res = await fetchWorkspaceDomainBReconciliation(fakeDb as unknown as D1Database, 'ws_1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.workspaceId).toBe('ws_1');
      expect(res.value.paidReceiptCents).toBe(15000);
      expect(res.value.platformFeeCents).toBe(0);
      expect(res.value.effectiveCommissionCents).toBe(22000);
      expect(res.value.byNetwork.bybit).toBeUndefined(); // strictly isolated from ws_other
    }
  });

  it('returns failure Result on D1 query error', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockRejectedValue(new Error('D1 query error')),
        }),
      }),
    } as unknown as D1Database;

    const res = await fetchWorkspaceDomainBReconciliation(mockDb, 'ws_1');
    expect(res.ok).toBe(false);
  });
});
