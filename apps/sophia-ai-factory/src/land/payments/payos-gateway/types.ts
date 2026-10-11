import { z } from 'zod';
import type { Tier } from '@/seed/types';

export interface PayOsTierConfig {
  tier: Tier;
  vndAmount: number;
  usdAmount: number;
}

export interface PayOsCheckoutInput {
  tier: Tier;
  period: 'monthly' | 'lifetime';
  userId: string;
  orderId: string;
  customerEmail?: string;
  amountVndOverride?: number;
}

export interface PayOsCheckoutResult {
  qrUrl: string;
  checkoutUrl: string;
  paymentLinkId: string;
  orderCode: number;
  expiresAt: string;
}

export interface PayOsIpnPayload {
  code: string;
  desc: string;
  success: boolean;
  data: {
    orderCode: number;
    amount: number;
    description: string;
    accountNumber: string;
    reference: string;
    transactionDateTime: string;
    currency: string;
    paymentLinkId: string;
    code: string;
    desc: string;
    counterAccountBankId?: string;
    counterAccountBankName?: string;
    counterAccountName?: string;
    counterAccountNumber?: string;
    virtualAccountName?: string;
    virtualAccountNumber?: string;
  };
  signature: string;
}

export const payOsIpnSchema = z.object({
  code: z.string(),
  desc: z.string(),
  success: z.boolean(),
  data: z.object({
    orderCode: z.number(),
    amount: z.number(),
    description: z.string(),
    accountNumber: z.string().optional(),
    reference: z.string().optional(),
    transactionDateTime: z.string().optional(),
    currency: z.string().optional(),
    paymentLinkId: z.string(),
    code: z.string().optional(),
    desc: z.string().optional(),
    counterAccountBankId: z.string().optional(),
    counterAccountBankName: z.string().optional(),
    counterAccountName: z.string().optional(),
    counterAccountNumber: z.string().optional(),
    virtualAccountName: z.string().optional(),
    virtualAccountNumber: z.string().optional(),
  }),
  signature: z.string(),
});

export interface PayOsCreatePaymentResponse {
  code: string;
  desc: string;
  data?: {
    paymentLinkId: string;
    checkoutUrl: string;
    qrCode: string;
    orderCode: number;
  };
}
