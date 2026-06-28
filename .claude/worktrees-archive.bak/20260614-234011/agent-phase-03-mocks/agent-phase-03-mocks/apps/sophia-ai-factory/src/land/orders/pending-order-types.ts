/**
 * Types and Zod schemas for pending_orders table.
 * Used by pending-order-repo.ts and checkout API.
 * @module orders/pending-order-types
 */

import { z } from 'zod'

export type PendingOrderStatus = 'pending' | 'completed' | 'failed' | 'expired'
export type PaymentMethod = 'nowpayments' | 'payos' | 'offline' | 'cash'
export type PendingOrderPeriod = 'monthly' | 'yearly' | 'lifetime'

export interface PendingOrder {
  order_id: string
  user_id: string
  tier: string
  period: PendingOrderPeriod
  payment_method: PaymentMethod
  amount_usd_cents: number
  promo_code: string | null
  customer_email: string | null
  invoice_url: string | null
  status: PendingOrderStatus
  payment_id: string | null
  created_at: string | null
  completed_at: string | null
}

export const pendingOrderInputSchema = z.object({
  order_id: z.string().min(1),
  user_id: z.string().min(1),
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']),
  period: z.enum(['monthly', 'yearly', 'lifetime']).default('monthly'),
  payment_method: z.enum(['nowpayments', 'payos', 'offline', 'cash']).default('nowpayments'),
  amount_usd_cents: z.number().int().positive(),
  promo_code: z.string().optional(),
  customer_email: z.string().email().optional(),
  invoice_url: z.string().url().optional(),
 status: z.enum(["pending", "completed", "failed", "expired"]).default("pending").optional(),
})

export type PendingOrderInput = z.infer<typeof pendingOrderInputSchema>
