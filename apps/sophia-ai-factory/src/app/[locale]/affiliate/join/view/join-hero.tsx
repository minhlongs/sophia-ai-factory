// i18n-namespace: affiliateProgram

/**
 * Hero for the public affiliate join page. Reuses the recruitment copy from
 * `affiliateProgram.*` so this page and the marketing landing cannot disagree.
 *
 * @module app/[locale]/affiliate/join/view/join-hero
 */

import Link from 'next/link';
import { ArrowRight, Coins, Wallet, Cookie } from 'lucide-react';
import { StatCard } from '@/app/[locale]/affiliate/components/affiliate-cards';

export interface JoinHeroProps {
  signupHref: string;
  loginHref: string;
  t: (key: string) => string;
}

export function JoinHero({ signupHref, loginHref, t }: JoinHeroProps) {
  return (
    <section className="text-center space-y-6">
      <p className="text-xs uppercase tracking-widest text-primary-400 font-semibold">
        {t('join.eyebrow')}
      </p>
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
        <span className="bg-gradient-to-r from-violet-500 to-cyan-400 bg-clip-text text-transparent">
          {t('hero.title')}
        </span>
      </h1>
      <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
        {t('hero.subtitle')}
      </p>

      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href={signupHref}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-6 py-3 font-semibold text-white shadow-lg transition-shadow hover:shadow-xl"
        >
          {t('join.ctaPrimary')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href={loginHref}
          className="inline-flex items-center rounded-lg border border-border px-6 py-3 font-semibold text-foreground transition-colors hover:bg-muted"
        >
          {t('join.ctaSecondary')}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Coins className="h-5 w-5 text-amber-400" aria-hidden="true" />}
          value={t('join.statTopRate')}
          label={t('join.statTopRateLabel')}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5 text-emerald-400" aria-hidden="true" />}
          value={t('stats.payout')}
          label={t('stats.payoutLabel')}
        />
        <StatCard
          icon={<Cookie className="h-5 w-5 text-cyan-400" aria-hidden="true" />}
          value={t('stats.cookie')}
          label={t('stats.cookieLabel')}
        />
      </div>
    </section>
  );
}
