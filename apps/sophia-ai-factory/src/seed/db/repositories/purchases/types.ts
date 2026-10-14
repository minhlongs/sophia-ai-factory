/**
 * User Purchases Repository Types
 * Layer: SEED (Foundational Primitives)
 */

import type { PurchaseKind, PurchaseStatus } from '@/seed/types';

export interface InsertPurchaseInput {
  userId: string;
  kind: PurchaseKind;
  sku: string;
  paymentId: string;
  invoiceId?: string | null;
  amountCents: number;
  creditsTotal: number;
  expiresAt?: number | null;
  status?: PurchaseStatus;
}
