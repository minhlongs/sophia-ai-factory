/**
 * Commission Ledger — row and input types.
 * All money values are INTEGER cents.
 */

export type LedgerStatus =
  | 'pending'
  | 'payable'
  | 'paying'
  | 'paid'
  | 'clawed_back'
  | 'clawback'
  | 'rejected'

export interface LedgerRow {
  id: string
  tenant_id: string
  affiliate_id: string
  conversion_event_id: string
  offer_id: string
  gross_cents: number
  commission_pct: number
  commission_cents: number
  withheld_cents: number
  parent_conversion_id: string | null
  status: LedgerStatus
  payable_at: number
  paid_at: number | null
  payout_batch_id: string | null
  clawback_reason: string | null
  created_at: number
  updated_at: number
}

export interface InsertLedgerInput {
  id: string
  tenant_id: string
  affiliate_id: string
  conversion_event_id: string
  offer_id: string
  /** USD float — converted to cents internally (C1) */
  gross_amount_usd: number
  commission_pct: number
  /** USD float — converted to cents internally (C1) */
  commission_usd: number
  payable_at: number
  /** Optional: VN PIT withheld in cents (H1) */
  withheld_cents?: number
}
