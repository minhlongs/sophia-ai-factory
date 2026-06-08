/**
 * Referral Landing Page — /ref/[code]
 *
 * Public page (no auth required). Resolves an affiliate link by code,
 * records a click event in D1, sets a 30-day `ref` attribution cookie,
 * then renders a marketing landing page with CTA to /en/register.
 *
 * Invalid codes → redirect to homepage.
 */

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { Sparkles, Zap, TrendingUp, ArrowRight } from 'lucide-react'
import { getD1Raw } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

interface Props {
  params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  return {
    title: 'Sophia AI — Solo Creator SOPs Platform',
    description:
      'Build, sell, and execute video production SOPs. Join the creator economy with AI-powered automation.',
    openGraph: {
      title: 'Sophia AI — Solo Creator SOPs Platform',
      description:
        'Build, sell, and execute video production SOPs with AI automation.',
      url: `https://sophia.agencyos.network/ref/${code}`,
      siteName: 'Sophia AI Factory',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Sophia AI — Solo Creator SOPs Platform',
      description:
        'Build, sell, and execute video production SOPs with AI automation.',
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

  // Set 30-day attribution cookie
  const cookieStore = await cookies()
  cookieStore.set('ref', code, {
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  })

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
    <div className="min-h-screen bg-background text-white">
      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Sparkles className="w-8 h-8 text-violet-400" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            Sophia AI
          </h1>
        </div>

        <p className="text-xl text-foreground/70 mb-8 max-w-xl mx-auto">
          Build, sell, and execute video production SOPs. Join the creator
          economy with AI-powered automation.
        </p>

        <Link
          href="/en/register"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-lg font-semibold transition-colors"
        >
          Get Started Free
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 pb-20 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {(
          [
            {
              icon: Zap,
              title: 'AI Video SOPs',
              desc: 'Step-by-step automation for faceless YouTube, TikTok, and UGC content',
            },
            {
              icon: TrendingUp,
              title: 'Earn Revenue',
              desc: 'Create SOPs, sell on marketplace, earn 70% commission on every sale',
            },
            {
              icon: Sparkles,
              title: 'Community',
              desc: 'Join creators earning $1K–$50K/mo with AI-powered video production',
            },
          ] as const
        ).map((f) => (
          <div
            key={f.title}
            className="rounded-2xl bg-muted/20 border border-border p-6 text-center"
          >
            <f.icon className="w-8 h-8 text-violet-400 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center pb-10 text-xs text-muted-foreground/50">
        Sophia AI Factory — Solo Creator SOPs Platform
      </div>
    </div>
  )
}
