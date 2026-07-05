/**
 * CeoAgentDashboard — PREMIUM+ user view for the /dashboard/ceo-agent root.
 * Kept small because phase 2-5 will split into dedicated child routes.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

export function CeoAgentDashboard({ userId, locale }: { userId: string; locale: string }) {
  const t = useTranslations('dashboard.ceoAgent');

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{t('heading')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <a
          href={`/${locale}/dashboard/ceo-agent/briefing`}
          className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <h3 className="text-sm font-semibold text-foreground">{t('briefingTitle')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('briefingDesc')}</p>
        </a>
        <a
          href={`/${locale}/dashboard/ceo-agent/campaigns`}
          className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <h3 className="text-sm font-semibold text-foreground">{t('campaignsTitle')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('campaignsDesc')}</p>
        </a>
        <a
          href={`/${locale}/dashboard/ceo-agent/revenue`}
          className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <h3 className="text-sm font-semibold text-foreground">{t('revenueTitle')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('revenueDesc')}</p>
        </a>
      </section>

      <section className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
        <p className="text-xs text-muted-foreground">{t('featureFlagNotice')}</p>
      </section>
    </div>
  );
}
