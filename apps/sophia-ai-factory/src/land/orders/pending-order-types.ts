/**
 * Types and Zod schemas for pending_orders table.
 * Used by pending-order-repo.ts and checkout API.
 * @module orders/pending-order-types
 */

import { z } from 'zod'

export type PendingOrderStatus = 'pending' | 'completed' | 'failed' | 'expired'
export type PaymentMethod = 'nowpayments' | 'payos' | 'offline' | 'cash'
export type PendingOrderPeriod = 'monthly' | 'yearly' | 'lifetime'
export type PendingOrderPurpose = 'subscription' | 'contract'

export interface PendingOrder {
  order_id: string
  user_id: string
  tier: string
  period: PendingOrderPeriod
  payment_method: PaymentMethod
  amount_usd_cents: number
  amount_vnd?: number | null
  promo_code: string | null
  customer_email: string | null
  invoice_url: string | null
  status: PendingOrderStatus
  payment_id: string | null
  created_at: string | null
  completed_at: string | null
  provider_payment_id?: string | null // For PayOS paymentLinkId direct lookup
  purpose?: PendingOrderPurpose
  contract_id?: string | null
  invoice_id?: string | null
  provider_order_code?: number | null
}

export const pendingOrderInputSchema = z.object({
  order_id: z.string().min(1),
  user_id: z.string().min(1),
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']),
  period: z.enum(['monthly', 'yearly', 'lifetime']).default('monthly'),
  payment_method: z.enum(['nowpayments', 'payos', 'offline', 'cash']).default('nowpayments'),
  amount_usd_cents: z.number().int().positive(),
  amount_vnd: z.number().int().positive().optional(),
  promo_code: z.string().optional(),
  customer_email: z.string().email().optional(),
  invoice_url: z.string().url().optional(),
  provider_payment_id: z.string().optional(),
  status: z.enum(["pending", "completed", "failed", "expired"]).default("pending").optional(),
  purpose: z.enum(['subscription', 'contract']).default('subscription').optional(),
  contract_id: z.string().min(1).optional(),
  invoice_id: z.string().min(1).optional(),
  provider_order_code: z.number().int().positive().optional(),
}).superRefine((order, context) => {
  if (order.purpose === 'contract') {
    for (const field of ['contract_id', 'invoice_id', 'provider_order_code', 'amount_vnd'] as const) {
      if (order[field] == null) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `Contract orders require ${field}` });
      }
    }
  }
})

export type PendingOrderInput = z.infer<typeof pendingOrderInputSchema>
