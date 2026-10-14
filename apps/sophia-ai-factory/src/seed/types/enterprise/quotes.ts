export type EnterpriseQuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired';

export interface EnterpriseQuote {
  id: string;
  dealId?: string | null;
  orgId: string;
  quoteNumber: string;
  mcuCapacityMonthly: number;
  slaUptimePercent: number;
  billingCycle: 'monthly' | 'annual';
  basePriceCents: number;
  volumeDiscountPercent: number;
  annualDiscountPercent: number;
  finalPriceCents: number;
  finalPriceVnd?: number | null;
  currency: 'USD' | 'VND';
  status: EnterpriseQuoteStatus;
  expiresAt: number; // Unix timestamp seconds
  createdAt: number;
  updatedAt: number;
}
