/**
 * Auto-handover Orchestrator Engine
 * Layer: tree/handover/auto
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { upsertUserTier } from '@/tree/handover/handover-account-setup'
import type { AutoHandoverOptions, AutoHandoverResult } from './types'
import {
  handoverExistsForPayment,
  getExistingHandoverId,
  countUserPurchases,
} from './handover-queries'
import {
  resolveOrCreateHandoverUser,
  notifyTierUpgradeSafe,
} from './handover-notification-helper'
import { executeFirstTimeHandover } from './first-time-handover-runner'

/**
 * Trigger auto-handover from payment IPN.
 * Non-fatal — wrap in try/catch at call site.
 */
export async function triggerAutoHandover(opts: AutoHandoverOptions): Promise<AutoHandoverResult> {
  const {
    paymentId,
    email,
    tier,
    agencyType = 'other',
    locale = 'vi',
    isFirstPurchase,
  } = opts
  const fullName = opts.fullName ?? email.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  const _db = await getD1()
  if (!_db) throw new Error('D1 binding not available')
  const db = _db

  // Idempotency — skip if already processed this paymentId
  const alreadyProcessed = await handoverExistsForPayment(db, paymentId)
  if (alreadyProcessed) {
    const existingId = await getExistingHandoverId(db, opts.userId!)
    logger.info('[AutoHandover] Already processed — skip', { paymentId })
    return {
      handoverId: existingId,
      isNewCustomer: false,
      magicLink: null,
      sopsInstalled: [],
      skipped: true,
      skipReason: 'duplicate_payment_id',
    }
  }

  // Resolve or create userId
  const { userId, isNewCustomer } = await resolveOrCreateHandoverUser(db, {
    userId: opts.userId,
    email,
    fullName,
    tier,
  })
  if (!userId) {
    return {
      handoverId: null,
      isNewCustomer: false,
      magicLink: null,
      sopsInstalled: [],
      skipped: true,
      skipReason: 'user_create_failed',
    }
  }

  // Upsert tier
  await upsertUserTier(db, userId, tier, email)

  // Check existing handover
  const existingHandoverId = await getExistingHandoverId(db, userId)
  const purchaseCount = await countUserPurchases(db, userId)
  const isTierUpgrade = !!existingHandoverId && !isFirstPurchase && purchaseCount > 1

  if (isTierUpgrade) {
    await notifyTierUpgradeSafe({ email, fullName, tier, locale })
    return {
      handoverId: existingHandoverId,
      isNewCustomer: false,
      magicLink: null,
      sopsInstalled: [],
      skipped: false,
    }
  }

  // First handover — install SOPs + create record + magic link + welcome email
  return executeFirstTimeHandover({
    db,
    userId,
    isNewCustomer,
    paymentId,
    email,
    fullName,
    tier,
    agencyType,
    locale,
  })
}
