/**
 * Top-Up Types and Constants
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/topup/types
 */

export type { TopupInvoice, TopupIpnPayload } from '../overage-topup-types';
export {
  topupIpnPayloadSchema,
  TOPUP_PRICE_PER_MCU,
  TOPUP_MIN_MCU,
  TOPUP_MAX_MCU,
  TOPUP_CREDIT_EXPIRY_DAYS,
} from '../overage-topup-types';

export const UNDERPAYMENT_THRESHOLD = 0.99;

export interface TopupPriceCalculation {
  priceCents: number;
  priceUsd: number;
  orderId: string;
  expiresAt: string;
}

export interface ProcessTopupResult {
  success: boolean;
  message: string;
}
