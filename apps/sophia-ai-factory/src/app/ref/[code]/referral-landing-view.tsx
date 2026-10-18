/**
 * Referral Landing Page View Component
 *
 * Extracted presentation layout for /ref/[code].
 *
 * @module app/ref/[code]/referral-landing-view
 */

import { Link } from '@/navigation'
import { Sparkles, Zap, TrendingUp, ArrowRight } from 'lucide-react'

export interface ReferralLandingViewProps {
  brand: string
  subtitle: string
  cta: string
  footer: string
}

const FEATURE_CARDS = [
  {
    icon: Zap,
    title: 'landing.features.items.ai_engine.title',
    desc: 'landing.features.items.ai_engine.description',
  },
  {
    icon: TrendingUp,
    title: 'landing.features.items.video_factory.title',
    desc: 'landing.features.items.video_factory.description',
  },
  {
    icon: Sparkles,
    title: 'landing.features.items.api.title',
    desc: 'landing.features.items.api.description',
  },
] as const

export function ReferralLandingView({
  brand,
  subtitle,
  cta,
  footer,
}: ReferralLandingViewProps) {
  return (
    <main className="min-h-screen bg-background text-white">
      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Sparkles className="w-8 h-8 text-primary-400" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            {brand}
          </h1>
        </div>

        <p className="text-xl text-foreground/70 mb-8 max-w-xl mx-auto">
          {subtitle}
        </p>

        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-lg font-semibold transition-colors"
        >
          {cta}
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 pb-20 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {FEATURE_CARDS.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl bg-muted/20 border border-border p-6 text-center"
          >
            <f.icon className="w-8 h-8 text-primary-400 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center pb-10 text-xs text-muted-foreground/50">
        {footer}
      </div>
    </main>
  )
}
