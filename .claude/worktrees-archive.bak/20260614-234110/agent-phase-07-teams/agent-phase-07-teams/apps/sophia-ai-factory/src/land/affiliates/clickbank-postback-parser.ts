/**
 * ClickBank INS Postback Parser
 *
 * Parses and validates URL-encoded INS v6.0 postback payload from ClickBank.
 * Normalizes transaction type aliases (BILL→SALE, RFND→REFUND, CGBK→CHARGEBACK).
 *
 * @module affiliates/clickbank-postback-parser
 */

import { z } from 'zod'

/** Canonical event types stored in DB */
export type CanonicalEventType = 'SALE' | 'REFUND' | 'CHARGEBACK' | 'TEST'

/** Map ClickBank INS aliases to canonical event types */
const EVENT_TYPE_MAP: Record<string, CanonicalEventType> = {
  SALE: 'SALE',
  BILL: 'SALE',
  REFUND: 'REFUND',
  RFND: 'REFUND',
  CHARGEBACK: 'CHARGEBACK',
  CGBK: 'CHARGEBACK',
  TEST: 'TEST',
}

const PostbackSchema = z.object({
  receipt: z.string().min(1).max(128),
  transactionType: z.string().transform((val, ctx) => {
    const canonical = EVENT_TYPE_MAP[val.toUpperCase()]
    if (!canonical) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown transactionType: ${val}` })
      return z.NEVER
    }
    return canonical
  }),
  amount: z.coerce.number().finite(),
  currency: z.string().max(8).default('USD'),
  cvendthru: z.string().max(64).optional(),  // = our truncated click_id (tid sent in M3)
  vendor: z.string().max(64).optional(),
  affiliate: z.string().max(64).optional(),
})

export interface ParsedPostback {
  receipt: string
  transactionType: CanonicalEventType
  amount: number
  currency: string
  cvendthru: string | undefined
  vendor: string | undefined
  affiliate: string | undefined
}

/**
 * Parse a URL-encoded ClickBank INS postback body.
 *
 * @param rawBody - application/x-www-form-urlencoded body string
 * @returns Parsed and validated postback, or null if invalid
 */
export function parsePostback(rawBody: string): ParsedPostback | null {
  if (!rawBody) return null

  let params: URLSearchParams
  try {
    params = new URLSearchParams(rawBody)
  } catch {
    return null
  }

  const raw: Record<string, string> = {}
  params.forEach((value, key) => { raw[key] = value })

  const result = PostbackSchema.safeParse(raw)
  if (!result.success) return null

  return result.data as ParsedPostback
}
