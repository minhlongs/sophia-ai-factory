/**
 * Auto-handover Types
 * Layer: tree/handover/auto
 */

import type { AgencyType } from '@/tree/handover/handover-types'
import type { Tier } from '@/seed/types'

export interface AutoHandoverOptions {
  paymentId: string
  userId?: string | null
  email: string
  fullName?: string | null
  tier: Tier
  agencyType?: AgencyType
  locale?: string
  isFirstPurchase: boolean
}

export interface AutoHandoverResult {
  handoverId: string | null
  isNewCustomer: boolean
  magicLink: string | null
  sopsInstalled: string[]
  skipped: boolean
  skipReason?: string
  /** Set when magic link generation or handover failed — surface to caller/client. */
  error?: string
}
