/**
 * First-Time Customer Handover Provisioning Runner
 * Layer: tree/handover/auto
 *
 * @module tree/handover/auto/first-time-handover-runner
 */

import type { D1Database } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { preInstallSops, createHandoverRecord } from '@/tree/handover/handover-account-setup'
import type { AutoHandoverOptions, AutoHandoverResult } from './types'
import { getStarterSops } from './handover-queries'
import { dispatchHandoverWelcomeNotification } from './handover-notification-helper'

export interface FirstTimeHandoverParams {
  db: D1Database
  userId: string
  isNewCustomer: boolean
  paymentId: string
  email: string
  fullName: string
  tier: AutoHandoverOptions['tier']
  agencyType: NonNullable<AutoHandoverOptions['agencyType']>
  locale: NonNullable<AutoHandoverOptions['locale']>
}

/**
 * Installs starter SOPs, records handover in D1, and sends welcome magic link notification.
 */
export async function executeFirstTimeHandover(
  params: FirstTimeHandoverParams
): Promise<AutoHandoverResult> {
  const { db, userId, isNewCustomer, paymentId, email, fullName, tier, agencyType, locale } = params

  const sopSlugs = getStarterSops(tier, agencyType)
  const installedSops = await preInstallSops(db, userId, sopSlugs)

  let handoverId: string | null = null
  try {
    handoverId = await createHandoverRecord(db, {
      userId,
      agencyName: fullName,
      agencyType,
      tier,
      installedSops,
      adminId: 'SYSTEM_AUTO',
      source: 'auto_payment',
      triggerPaymentId: paymentId,
    })
  } catch (err) {
    logger.error('[AutoHandover] createHandoverRecord failed', err instanceof Error ? err : undefined)
    return {
      handoverId: null,
      isNewCustomer,
      magicLink: null,
      sopsInstalled: installedSops,
      skipped: true,
      skipReason: 'record_create_failed',
    }
  }

  const { magicLink, magicLinkError } = await dispatchHandoverWelcomeNotification(db, {
    handoverId,
    paymentId,
    email,
    fullName,
    tier,
    locale,
  })

  logger.info('[AutoHandover] Handover complete', {
    handoverId,
    userId,
    tier,
    isNewCustomer,
    sopsInstalled: installedSops.length,
    paymentId,
  })

  return {
    handoverId,
    isNewCustomer,
    magicLink,
    sopsInstalled: installedSops,
    skipped: false,
    error: magicLinkError,
  }
}
