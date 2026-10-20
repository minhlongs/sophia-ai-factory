/**
 * Referral Landing Page — /ref/[code]
 *
 * Public page (no auth required). Resolves an affiliate link by code,
 * records a click event in D1, sets a 30-day `ref` attribution cookie,
 * then renders a marketing landing page with CTA to /register.
 *
 * Invalid codes → redirect to homepage.
 */

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { getD1Raw } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { decodeConsentCookie } from '@/seed/compliance/consent-resolver'
import { CONSENT_COOKIE_NAME } from '@/seed/compliance/consent-types'
import { ReferralLandingView } from './referral-landing-view'

interface Props {
  params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  const t = await getTranslations('landing.ref')
  return {
    title: t('brand'),
    description: t('subtitle'),
    openGraph: {
      title: t('brand'),
      description: t('subtitle'),
      url: `https://sophia.agencyos.network/ref/${code}`,
      siteName: 'Sophia AI Factory',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('brand'),
      description: t('subtitle'),
    },
  }
}

interface AffiliateLinkRow {
  id: string
  offer_id: string
  user_id: string
}

export default async function ReferralPage({ params }: Props) {
  const { code } = await params
  const t = await getTranslations('landing.ref')

  let db: D1Database
  try {
    db = await getD1Raw()
  } catch {
    redirect('/')
  }

  const link = await db
    .prepare(`SELECT id, offer_id, user_id FROM affiliate_links WHERE code = ?1 LIMIT 1`)
    .bind(code)
    .first<AffiliateLinkRow>()

  if (!link) redirect('/')

  // Attribution cookie is a non-essential (marketing) tracker: only set it once the
  // visitor has granted marketing consent. Without consent, attribution still works
  // via the `?ref=CODE` link parameter handled server-side.
  const cookieStore = await cookies()
  let marketingConsent = false
  try {
    const rawConsent = cookieStore.get(CONSENT_COOKIE_NAME)?.value
    if (rawConsent) {
      marketingConsent = decodeConsentCookie(rawConsent)?.marketing === true
    }
  } catch (err) {
    logger.warn('[ref-page] consent cookie read failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  if (marketingConsent) {
    cookieStore.set('ref', code, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
  }

  // Record click — non-critical, never blocks render
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO click_events
      (id, tenant_id, link_id, offer_id, ip_hash, ua, referrer, country, clicked_at)
      VALUES (?1, 'default', ?2, ?3, NULL, NULL, NULL, NULL, ?4)`,
      )
      .bind(crypto.randomUUID(), link.id, link.offer_id, Math.floor(Date.now() / 1000))
      .run()
  } catch (err) {
    logger.warn('[ref-page] click_events insert failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return (
    <ReferralLandingView
      brand={t('brand')}
      subtitle={t('subtitle')}
      cta={t('cta')}
      footer={t('footer')}
    />
  )
}
