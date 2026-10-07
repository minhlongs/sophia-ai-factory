import { describe, it, expect } from 'vitest';
import {
  reconcileEcommerceBatch,
} from '../ecommerce-reconciliation-engine';
import type { NormalizedEcommercePostbackEvent } from '../../postbacks/ecommerce-postback-types';

describe('E-commerce Commission Reconciliation Engine', () => {
  const now = 1700000000000;

  const mockOrderSettled: NormalizedEcommercePostbackEvent = {
    eventId: 'tt_1',
    network: 'tiktok_shop',
    orderId: 'ORD_101',
    creatorId: 'c_1',
    campaignId: 'camp_1',
    subId: null,
    productSku: 'SKU_1',
    productTitle: 'Mini Projector',
    itemCount: 1,
    itemPriceCents: 5000,
    commissionCents: 1000, // $10.00
    currency: 'USD',
    status: 'ORDER_SETTLED',
    clearanceDueMs: now + 50000, // future
    isClearanceMatured: false,
    timestampMs: now,
    rawPayload: {},
  };

  const mockOrderMatured: NormalizedEcommercePostbackEvent = {
    ...mockOrderSettled,
    orderId: 'ORD_102',
    eventId: 'tt_2',
    clearanceDueMs: now - 10000, // past clearance date
  };

  const mockOrderRefunded: NormalizedEcommercePostbackEvent = {
    ...mockOrderSettled,
    orderId: 'ORD_103',
    eventId: 'tt_3',
    status: 'ORDER_REFUNDED',
    commissionCents: 1000,
  };

  it('calculates gross, holdback, and net payable accurately', () => {
    const summary = reconcileEcommerceBatch(
      {
        tenantId: 'tenant_test',
        orders: [mockOrderSettled, mockOrderMatured],
        defaultHoldbackRatePercent: 10,
      },
      now
    );

    expect(summary.totalOrdersProcessed).toBe(2);
    expect(summary.totalGrossCommissionCents).toBe(2000);
    expect(summary.totalHoldbackCents).toBe(200); // 10% of 2000
    expect(summary.totalNetPayableCents).toBe(1800);
    expect(summary.highRiskRefundRate).toBe(false);

    // First order is still in clearance
    expect(summary.entries[0].status).toBe('PENDING_CLEARANCE');
    expect(summary.entries[0].isUnlockedForPayout).toBe(false);

    // Second order is matured
    expect(summary.entries[1].status).toBe('RECONCILED_MATURED');
    expect(summary.entries[1].isUnlockedForPayout).toBe(true);
  });

  it('detects high refund rate risk and voids refunded commissions', () => {
    const summary = reconcileEcommerceBatch(
      {
        tenantId: 'tenant_test',
        orders: [mockOrderSettled, mockOrderRefunded], // 50% refund rate
      },
      now
    );

    expect(summary.totalRefundedCents).toBe(1000);
    expect(summary.highRiskRefundRate).toBe(true); // > 15%
    expect(summary.entries[1].status).toBe('VOIDED_REFUNDED');
    expect(summary.entries[1].netPayableCommissionCents).toBe(0);
  });
});
