/**
 * Zod schema for NOWPayments IPN payload.
 * Applied in webhook route AFTER signature verification but BEFORE dispatch.
 * Prevents injection via unexpected/malformed fields.
 * @module billing/ipn-payload-schema
 */

import { z } from 'zod'

export const ipnPayloadSchema = z.object({
  payment_id: z.string().min(1),
  payment_status: z.enum([
    'waiting',
    'confirming',
    'confirmed',
    'sending',
    'partially_paid',
    'finished',
    'failed',
    'refunded',
    'expired',
  ]),
  pay_address: z.string().optional(),
  price_amount: z.number().positive(),
  price_currency: z.string().min(1),
  pay_amount: z.number().optional(),
  pay_currency: z.string().optional(),
  order_id: z.string().optional(),
  order_description: z.string().optional(),
  invoice_id: z.string().optional(),
  actually_paid: z.number().optional(),
  outcome_amount: z.number().optional(),
  outcome_currency: z.string().optional(),
  customer_email: z.string().email().optional(),
})

export type IpnPayload = z.infer<typeof ipnPayloadSchema>
