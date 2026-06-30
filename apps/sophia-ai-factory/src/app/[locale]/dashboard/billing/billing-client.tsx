'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { use } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { fetchJson } from '@/seed/utils/fetch-json';
import { FullUsageSummary } from '@/forest/components/billing/usage-summary-card';
import { DunningStatusBanner } from '@/forest/components/billing/dunning-status-banner';
import { QuotaGaugeList } from '@/forest/components/analytics/QuotaGauge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { AlertCircle, CreditCard, Download, Infinity as InfinityIcon, RotateCcw, ArrowUpDown, XCircle } from 'lucide-react';
import { CancelSubscriptionModal } from '@/components/billing/cancel-subscription-modal';
import { BillingChargeSummary } from './billing-charge-summary';
import { BillingOverageTable } from './billing-overage-table';
import { BillingPaymentHistory } from './billing-payment-history';
import { SubscriptionPlanCard } from './subscription-plan-card';
import { InvoiceHistoryTable } from './invoice-history-table';
import { PaymentMethodDisplay } from './payment-method-display';
import { TierChangeDialog } from './tier-change-dialog';
import type { UsageSummaryResponse, DunningStatusResponse } from './billing-page-types';
import type { Tier } from '@/seed/types';

const formatCurrency = (cents: number, locale = 'en-US') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(cents / 100);

const getStatusFromPct = (pct: number): 'ok' | 'warning' | 'critical' | 'overage' => {
  if (pct >= 100) return 'overage';
  if (pct >= 90) return 'critical';
  if (pct >= 75) return 'warning';
  return 'ok';
};

function BillingSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="space-y-4">
        <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function BillingClient({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const t = useTranslations('dashboard.billing');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [tierChangeOpen, setTierChangeOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: usageData, isLoading, error } = useQuery<UsageSummaryResponse>({
    queryKey: ['/api/billing/usage-summary'],
    queryFn: () => fetchJson<UsageSummaryResponse>('/api/billing/usage-summary'),
    retry: 2,
  });

  const { data: dunningData } = useQuery<DunningStatusResponse>({
    queryKey: ['/api/quota/dunning-status'],
    queryFn: () => fetchJson<DunningStatusResponse>('/api/quota/dunning-status'),
    retry: 1,
    enabled: !!usageData?.license?.nonce,
  });

  if (isLoading) return <BillingSpinner label={t('loading')} />;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-lg">
          <AlertCircle className="h-5 w-5 inline mr-2" />
          {t('loadError')}
        </div>
      </div>
    );
  }

  if (!usageData) return <BillingSpinner label={t('loading')} />;

  const pct = usageData.percentages.apiCalls || 0;
  const hourlyUsage = {
    used: Math.round(usageData.usage.apiCalls / 24),
    limit: Math.round(usageData.limits.apiCalls / (30 * 24)),
    percentage: pct / 30,
    status: getStatusFromPct(pct / 30),
  };
  const dailyUsage = {
    used: usageData.usage.apiCalls,
    limit: usageData.limits.apiCalls,
    percentage: pct,
    status: usageData.status.apiCalls,
  };
  const monthlyUsage = {
    used: usageData.usage.apiCalls,
    limit: usageData.limits.apiCalls,
    percentage: pct,
    status: usageData.status.apiCalls,
    overage: usageData.overageEvents.totalCredits,
  };
  const quotaData = [
    { label: t('apiCallsLabel'), used: usageData.usage.apiCalls, limit: usageData.limits.apiCalls },
    { label: t('videoGenerationsLabel'), used: usageData.usage.videoGenerations, limit: usageData.limits.videoGenerations },
    { label: t('storageLabel'), used: usageData.usage.storage, limit: usageData.limits.storage },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('pageTitle')}</h1>
            <p className="text-muted-foreground mt-1">{t('pageSubtitle')}</p>
          </div>
          {usageData.license.tier === 'MASTER' && (
            <span
              title={t('lifetimeBadgeTooltip')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/15 to-yellow-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold"
            >
              <InfinityIcon className="h-3.5 w-3.5" />
              {t('lifetimeBadge')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />{t('exportButton')}</Button>
          {usageData.license.tier !== 'MASTER' && (
            <Button size="sm"><CreditCard className="h-4 w-4 mr-2" />{t('upgradeButton')}</Button>
          )}
        </div>
      </div>

      {dunningData && dunningData.state !== 'current' && (
        <DunningStatusBanner
          state={dunningData.state}
          gracePeriodEndsAt={dunningData.gracePeriodEndsAt}
          failedPaymentCount={dunningData.failedPaymentCount}
          blockReason={dunningData.blockReason}
          allowed={dunningData.allowed}
        />
      )}

      <BillingChargeSummary data={usageData} formatCurrency={(c) => formatCurrency(c, locale)} />

      {/* Subscription plan card — self-service plan display */}
      <SubscriptionPlanCard
        currentTier={usageData.license.tier as Tier}
        nextBillingDate={new Date(usageData.period.end * 1000).toISOString()}
        onOpenChangeTier={() => setTierChangeOpen(true)}
        onOpenCancel={() => setCancelOpen(true)}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <PaymentMethodDisplay
          hasPaymentMethod={false}
          updateUrl="./billing/settings"
        />
        <InvoiceHistoryTable />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">{t('usageBreakdown')}</h2>
        <FullUsageSummary hourly={hourlyUsage} daily={dailyUsage} monthly={monthlyUsage} />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">{t('quotaSection')}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t('quotaCardTitle')}</CardTitle>
            <CardDescription>{t('quotaCardSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <QuotaGaugeList quotas={quotaData} columns={3} />
          </CardContent>
        </Card>
      </div>

      <BillingOverageTable data={usageData} formatCurrency={(c) => formatCurrency(c, locale)} />
      <BillingPaymentHistory />

      {/* Self-serve billing actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t('selfServeTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <ArrowUpDown className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{t('changeTierTitle')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('changeTierDesc')}</p>
                  <Link href="./billing/change-tier" className="mt-3 inline-block">
                    <Button size="sm" variant="outline">{t('changeTierCta')}</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <RotateCcw className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{t('refundTitle')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('refundDesc')}</p>
                  <Link href="./billing/refund" className="mt-3 inline-block">
                    <Button size="sm" variant="outline">{t('refundCta')}</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {usageData.license.tier !== 'MASTER' && (
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{t('cancelTitle')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('cancelDesc')}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => setCancelOpen(true)}
                    >
                      {t('cancelCta')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CancelSubscriptionModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        currentTier={usageData.license.tier as Tier}
      />

      <TierChangeDialog
        open={tierChangeOpen}
        onOpenChange={setTierChangeOpen}
        currentTier={usageData.license.tier as Tier}
        onSuccess={() => { queryClient.invalidateQueries(); setTierChangeOpen(false); }}
      />
    </div>
  );
}
