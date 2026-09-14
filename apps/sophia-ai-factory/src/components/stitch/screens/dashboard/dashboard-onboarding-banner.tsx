'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { Sparkles, ArrowRight, Activity, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, Button, Badge } from '@/components/stitch';
import type { SystemReadiness } from '@/tree/readiness/readiness-checker';

interface DashboardOnboardingBannerProps {
  readiness?: SystemReadiness | null;
}

export function DashboardOnboardingBanner({ readiness }: DashboardOnboardingBannerProps) {
  const t = useTranslations('stitch.dashboard.onboardingBanner');

  // If readiness is not loaded yet or fully ready with at least 1 provider, show minimal banner or readiness badge
  const isReady = Boolean(readiness?.readyForMissions && readiness?.providersConfigured.length);

  if (isReady) {
    return (
      <div className="mb-lg p-sm px-md rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
        <div className="flex items-center gap-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="font-label-sm text-emerald-700 dark:text-emerald-300">
            {t('ready')}
          </span>
        </div>
        <Link
          href="/settings/system-health"
          className="font-label-sm text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-xs"
        >
          <Activity className="w-3.5 h-3.5" />
          {t('healthCheck')}
        </Link>
      </div>
    );
  }

  return (
    <Card className="mb-xl bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 border-primary/20 shadow-sm">
      <CardContent className="p-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-md">
        <div className="space-y-xs max-w-2xl">
          <div className="flex items-center gap-sm">
            <Badge variant="soft" color="primary" size="sm">
              <Sparkles className="w-3 h-3 mr-1" />
              Sophia Onboarding
            </Badge>
            {readiness && (
              <span className="text-xs text-on-surface-variant">
                {readiness.providersConfigured.length} AI Providers Configured
              </span>
            )}
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            {t('title')}
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {t('subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-sm">
          <Link href="/settings/system-health">
            <Button variant="outline" size="sm" iconLeft={<Activity className="w-4 h-4" />}>
              {t('healthCheck')}
            </Button>
          </Link>
          <Link href="/setup">
            <Button size="sm" iconRight={<ArrowRight className="w-4 h-4" />}>
              {t('cta')}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
