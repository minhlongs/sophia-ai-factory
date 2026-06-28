'use client';
/**
 * Post-setup CTA shown to users who completed onboarding but have no SOPs yet.
 * Surfaces 3 quick-action cards: create campaign, browse templates, read docs.
 * @module app/[locale]/dashboard/components/dashboard-first-campaign-cta
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';

const ACTIONS = [
  {
    key: 'create' as const,
    href: '/dashboard/create',
    titleKey: 'dashboard.firstCampaign.createCta' as const,
    icon: '🎬',
  },
  {
    key: 'templates' as const,
    href: '/dashboard/missions',
    titleKey: 'dashboard.firstCampaign.templatesCta' as const,
    icon: '📋',
  },
  {
    key: 'docs' as const,
    href: '/dashboard/api-docs',
    titleKey: 'dashboard.firstCampaign.docsCta' as const,
    icon: '📖',
  },
] as const;

export function DashboardFirstCampaignCta() {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">{t('dashboard.firstCampaign.title')}</h2>
        <p className="text-sm text-muted-foreground-400 mt-1">{t('dashboard.firstCampaign.description')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {ACTIONS.map(({ key, href, titleKey, icon }) => (
          <Card key={key} className="bg-muted-800/60 border-border-700 hover:border-border-500 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground-200 flex items-center gap-2">
                <span aria-hidden="true">{icon}</span>
                {t(titleKey)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm" className="w-full border-border-600 text-muted-foreground-300 hover:bg-muted-700">
                <Link href={href}>{t(titleKey)}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
