'use client';

import { useQuery } from '@tanstack/react-query';
import { use } from 'react';
import { FullUsageSummary } from '@/forest/components/billing/usage-summary-card';
import { DunningStatusBanner } from '@/forest/components/billing/dunning-status-banner';
import { QuotaGaugeList } from '@/forest/components/analytics/QuotaGauge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { AlertCircle, CreditCard, Download } from 'lucide-react';
import { BillingChargeSummary } from './billing-charge-summary';
import { BillingOverageTable } from './billing-overage-table';
import { BillingPaymentHistory } from './billing-payment-history';
import type { UsageSummaryResponse, DunningStatusResponse } from './billing-page-types';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

const getStatusFromPct = (pct: number): 'ok' | 'warning' | 'critical' | 'overage' => {
  if (pct >= 100) return 'overage';
  if (pct >= 90) return 'critical';
  if (pct >= 75) return 'warning';
  return 'ok';
};

function BillingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground">Đang tải dữ liệu thanh toán...</p>
      </div>
    </div>
  );
}

export default function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: _locale } = use(params);

  const { data: usageData, isLoading, error } = useQuery<UsageSummaryResponse>({
    queryKey: ['/api/billing/usage-summary'],
    retry: 2,
  });

  const { data: dunningData } = useQuery<DunningStatusResponse>({
    queryKey: ['/api/quota/dunning-status'],
    retry: 1,
    enabled: !!usageData?.license?.nonce,
  });

  if (isLoading) return <BillingSpinner />;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-lg">
          <AlertCircle className="h-5 w-5 inline mr-2" />
          Không thể tải dữ liệu thanh toán. Vui lòng thử lại sau.
        </div>
      </div>
    );
  }

  if (!usageData) return <BillingSpinner />;

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
    { label: 'API Calls', used: usageData.usage.apiCalls, limit: usageData.limits.apiCalls },
    { label: 'Video Generations', used: usageData.usage.videoGenerations, limit: usageData.limits.videoGenerations },
    { label: 'Storage (MB)', used: usageData.usage.storage, limit: usageData.limits.storage },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Usage</h1>
          <p className="text-muted-foreground mt-1">Monitor your usage, overage charges, and billing status</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Export</Button>
          <Button size="sm"><CreditCard className="h-4 w-4 mr-2" />Upgrade Plan</Button>
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

      <BillingChargeSummary data={usageData} formatCurrency={formatCurrency} />

      <div>
        <h2 className="text-xl font-semibold mb-4">Usage Breakdown</h2>
        <FullUsageSummary hourly={hourlyUsage} daily={dailyUsage} monthly={monthlyUsage} />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Sử Dụng Hạn Mức</h2>
        <Card>
          <CardHeader>
            <CardTitle>Mức Dùng Tài Nguyên</CardTitle>
            <CardDescription>Biểu đồ trực quan mức tiêu thụ tài nguyên</CardDescription>
          </CardHeader>
          <CardContent>
            <QuotaGaugeList quotas={quotaData} columns={3} />
          </CardContent>
        </Card>
      </div>

      <BillingOverageTable data={usageData} formatCurrency={formatCurrency} />
      <BillingPaymentHistory data={usageData} formatCurrency={formatCurrency} />
    </div>
  );
}
