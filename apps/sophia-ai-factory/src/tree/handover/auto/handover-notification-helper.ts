/**
 * Auto-handover Magic Link, Customer Resolution & Email Notification Helper
 * Layer: tree/handover/auto
 */

import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import type { Tier } from '@/seed/types'
import { createCustomerUser } from '@/tree/handover/handover-account-setup'
import { createMagicLinkToken } from '@/tree/handover/handover-magic-link'
import { sendTierUpgradeEmail } from '@/tree/handover/handover-email-service'
import { enqueueWelcomeEmail } from '@/tree/outbox'
import { installStarterSop } from '@/tree/handover/install-starter-sop'
import { findUserByEmail, localePath } from './handover-queries'

export async function resolveOrCreateHandoverUser(
  db: D1Database,
  params: {
    userId?: string | null
    email: string
    fullName: string
    tier: Tier
  },
): Promise<{ userId: string | null; isNewCustomer: boolean }> {
  let userId = params.userId ?? null
  let isNewCustomer = false

  if (!userId) {
    userId = await findUserByEmail(db, params.email)
  }

  if (!userId) {
    try {
      userId = await createCustomerUser(db, params.email, params.fullName)
      isNewCustomer = true
      logger.info('[AutoHandover] New customer created', { userId, email: params.email })
    } catch (err) {
      logger.error('[AutoHandover] createCustomerUser failed', err instanceof Error ? err : undefined)
      return { userId: null, isNewCustomer: false }
    }

    if (params.tier === 'MASTER') {
      installStarterSop(db, userId).catch((err) =>
        logger.warn('[AutoHandover] installStarterSop failed (non-fatal)', { error: String(err) }),
      )
    }
  }

  return { userId, isNewCustomer }
}

export async function notifyTierUpgradeSafe(params: {
  email: string
  fullName: string
  tier: Tier
  locale: string
}): Promise<void> {
  try {
    await sendTierUpgradeEmail({
      toEmail: params.email,
      ownerFullName: params.fullName,
      newTier: params.tier,
      locale: params.locale as 'vi' | 'en',
    })
  } catch (err) {
    logger.warn('[AutoHandover] Tier upgrade email failed (non-fatal)', { error: getErrorMessage(err) })
  }
}

export async function dispatchHandoverWelcomeNotification(
  db: D1Database,
  params: {
    handoverId: string
    paymentId: string
    email: string
    fullName: string
    tier: Tier
    locale: string
  },
): Promise<{ magicLink: string | null; magicLinkError?: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'
  let magicLink: string | null = null
  let magicLinkError: string | undefined

  try {
    const token = await createMagicLinkToken(params.handoverId, { source: 'auto_signup' })
    magicLink = `${appUrl}${localePath(params.locale)}/welcome/${token}`
  } catch (err) {
    magicLinkError = getErrorMessage(err)
    logger.warn('[AutoHandover] Magic link generation failed (non-fatal)', { error: magicLinkError })
  }

  try {
    await enqueueWelcomeEmail(db, {
      paymentId: params.paymentId,
      toEmail: params.email,
      template: 'welcome-magic-link',
      payload: {
        ownerFullName: params.fullName,
        tier: params.tier,
        locale: params.locale,
        magicLinkUrl: magicLink ?? `${appUrl}${localePath(params.locale)}/login`,
      },
    })
  } catch (err) {
    logger.warn('[AutoHandover] Welcome email enqueue failed (non-fatal)', { error: getErrorMessage(err) })
  }

  return { magicLink, magicLinkError }
}
