/**
 * @file commerce-payout-events.ts
 * @description Inngest event contracts for commerce, conversions, ledger recordings, and payouts.
 * @layer seed
 */

export type ConversionCreatedEvent = { data: { conversionEventId: string; tenantId: string } };

export type DistributionPlanCreatedEvent = { data: { planId: string; workspaceId: string } };

export type CommissionMaturedEvent = { data: { updatedCount: number; promotedAt: number } };

export type RevenueEventRecordedEvent = {
  data: {
    source: 'ad-revenue' | 'sponsorship' | 'affiliate' | 'commerce';
    externalId: string;
    amountCents: number;
    currency: string;
    workspaceId: string;
    assetId?: string;
    projectId?: string;
    recordedAtMs: number;
    metadata?: Record<string, unknown>;
  };
};

export type CommercePaymentConfirmedEvent = {
  data: {
    orderId: string;
    productId: string;
    workspaceId: string;
    paymentId: string;
    /** Order total in INTEGER cents. */
    amountCents: number;
    currency: string;
  };
};

export type PayoutBatchedEvent = {
  data: {
    batchId: string;
    affiliateId: string;
    /** Payout amount in INTEGER cents (no float drift). */
    totalCents: number;
    externalPaymentId: string;
  };
};

export type PayoutConfirmedEvent = {
  data: { batchId: string; externalPaymentId: string; confirmedAt: number };
};

export type PayoutReconcileAlertEvent = {
  data: {
    tenantId: string;
    /** All amounts in INTEGER cents. */
    ledgerTotalCents: number;
    batchTotalCents: number;
    diffCents: number;
  };
};
