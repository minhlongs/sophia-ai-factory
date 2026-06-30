/**
 * Overage Top-Up Types
 *
 * Types for the top-up flow used by overage-topup.ts and callers.
 * Defines invoices, IPN payloads, and credit-grant structures.
 *
 * @module billing/overage-topup-types
 */

import { z } from 'zod'

/** Top-up invoice created by createTopupInvoice */
export interface TopupInvoice {
  invoiceId: string
  invoiceUrl: string
  mcuAmount: number
  priceCents: number
  expiresAt: string
}

/** IPN payload for a top-up payment */
export interface TopupIpnPayload {
  payment_id: string
  payment_status: string
  order_id: string
  price_amount: number
  price_currency: string
}

/** Zod schema for top-up IPN payload — validated at webhook boundary */
export const topupIpnPayloadSchema = z.object({
  payment_id: z.string().min(1),
  payment_status: z.enum([
    'waiting', 'confirming', 'confirmed', 'sending',
    'partially_paid', 'finished', 'failed', 'refunded', 'expired',
  ]),
  order_id: z.string().min(1),
  price_amount: z.number().positive(),
  price_currency: z.string().min(1),
  invoice_id: z.string().optional(),
  actually_paid: z.number().optional(),
})

/** Configuration for top-up pricing (MCU → USD) */
export const TOPUP_PRICE_PER_MCU = 0.10 // $0.10 per MCU credit

/** Minimum top-up amount in MCU */
export const TOPUP_MIN_MCU = 50

/** Maximum top-up amount in MCU */
export const TOPUP_MAX_MCU = 10000

/** Credit expiry in days after purchase */
export const TOPUP_CREDIT_EXPIRY_DAYS = 30
