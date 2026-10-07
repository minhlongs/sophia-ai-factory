/**
 * Zod Schemas and Types for Dual-Rail Affiliate Payouts and Onboarding
 *
 * Isolated schema module to satisfy Next.js 16 Server Action boundary requirements
 * (Server Action files must only export async functions).
 *
 * Layer: forest (actions / schemas)
 * @module forest/actions/affiliate-payout-actions-schema
 */

import { z } from 'zod';

export const PayoutRailEnum = z.enum(['VIETQR', 'USDT']);
export type PayoutRail = z.infer<typeof PayoutRailEnum>;

export const UsdtNetworkEnum = z.enum(['TRC20', 'ERC20']);
export type UsdtNetwork = z.infer<typeof UsdtNetworkEnum>;

export const requestDualRailPayoutSchema = z
  .object({
    partnerId: z.string().min(1, 'Partner ID is required'),
    rail: PayoutRailEnum,
    amountCents: z.number().int().min(5000, 'Minimum payout amount is $50.00 (5,000 cents)'),
    bankBin: z.string().regex(/^\d{6}$/, 'Bank BIN must be 6 digits').optional(),
    bankAccountNumber: z.string().min(6).max(24).optional(),
    bankAccountName: z.string().min(2).max(100).optional(),
    usdtAddress: z.string().optional(),
    usdtNetwork: UsdtNetworkEnum.optional(),
  })
  .refine(
    (data) => {
      if (data.rail === 'VIETQR') {
        return !!data.bankBin && !!data.bankAccountNumber && !!data.bankAccountName;
      }
      if (data.rail === 'USDT') {
        if (!data.usdtAddress || !data.usdtNetwork) return false;
        if (data.usdtNetwork === 'TRC20') {
          return /^T[1-9A-HJ-NP-za-km-z]{33}$/.test(data.usdtAddress);
        }
        if (data.usdtNetwork === 'ERC20') {
          return /^0x[a-fA-F0-9]{40}$/.test(data.usdtAddress);
        }
      }
      return false;
    },
    {
      message: 'Missing or invalid payment destination parameters for selected rail',
    }
  );

export type RequestDualRailPayoutInput = z.infer<typeof requestDualRailPayoutSchema>;

export const updatePartnerPayoutDestinationSchema = z
  .object({
    partnerId: z.string().min(1),
    rail: PayoutRailEnum,
    bankBin: z.string().regex(/^\d{6}$/).optional(),
    bankAccountNumber: z.string().min(6).max(24).optional(),
    bankAccountName: z.string().min(2).max(100).optional(),
    usdtAddress: z.string().optional(),
    usdtNetwork: UsdtNetworkEnum.optional(),
  })
  .refine(
    (data) => {
      if (data.rail === 'VIETQR') {
        return !!data.bankBin && !!data.bankAccountNumber && !!data.bankAccountName;
      }
      if (data.rail === 'USDT') {
        return !!data.usdtAddress && !!data.usdtNetwork;
      }
      return false;
    },
    { message: 'Incomplete payout destination details' }
  );

export type UpdatePartnerPayoutDestinationInput = z.infer<
  typeof updatePartnerPayoutDestinationSchema
>;

export const redeemInviteSchema = z.object({
  token: z.string().min(16, 'Invalid invitation token format'),
  fullName: z.string().min(2, 'Full name is required (min 2 chars)'),
  email: z.string().email('Valid email address is required'),
  trafficChannel: z.enum(['youtube', 'tiktok', 'facebook', 'blog_seo', 'newsletter', 'agency']),
  preferredRail: PayoutRailEnum.default('VIETQR'),
  termsAccepted: z.literal(true),
});

export type RedeemInviteInput = z.infer<typeof redeemInviteSchema>;

export interface PartnerLedgerKpiData {
  availablePayoutCents: number;
  availablePayoutVnd: number;
  pendingHoldCents: number;
  nextHoldReleaseDays: number;
  totalSettledCents: number;
  totalClicks: number;
  totalReferrals: number;
  conversionRatePct: number;
  partnerCode: string;
  commissionRatePct: number;
  defaultRail: PayoutRail;
  maskedDestination: string;
}

export interface CommissionLedgerItem {
  id: string;
  orderId: string;
  grossAmountCents: number;
  commissionCents: number;
  ratePct: number;
  status: 'pending' | 'payable' | 'settled' | 'clawback';
  holdRemainingDays: number;
  createdAt: number;
}
