/**
 * Billing Dashboard Page
 *
 * Displays billing status, usage analytics, overage charges, and payment history.
 * Integrates dunning status banner, usage summary cards, and quota gauges.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { use } from 'react';
import { FullUsageSummary } from '@/components/billing/usage-summary-card';
import { DunningStatusBanner, type DunningState } from '@/components/billing/dunning-status-banner';
import { QuotaGaugeList } from '@/components/analytics/QuotaGauge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CreditCard, DollarSign, TrendingUp, Calendar, Zap, Download } from 'lucide-react';
import Link from 'next/link';

interface UsageSummaryResponse {
  period: {
    start: number;
    end: number;
  };
  usage: {
    apiCalls: number;
    videoGenerations: number;
    storage: number;
  };
  limits: {
    apiCalls: number;
    videoGenerations: number;
    storage: number;
  };
  percentages: {
    apiCalls: number;
    videoGenerations: number;
    storage: number;
  };
  status: {
    apiCalls: 'ok' | 'warning' | 'critical' | 'overage';
    videoGenerations: 'ok' | 'warning' | 'critical' | 'overage';
    storage: 'ok' | 'warning' | 'critical' | 'overage';
  };
  overageEvents: {
    total: number;
    totalCredits: number;
    byType: Record<string, number>;
    billableEvents: number;
  };
  projectedCharges: {
    basePriceCents: number;
    overageChargesCents: number;
    totalCents: number;
    currency: string;
    gracePeriodCredits: number;
    billableCredits: number;
  };
  license: {
    nonce: string;
    tier: string;
  };
}

interface DunningStatusResponse {
  allowed: boolean;
  state: DunningState;
  gracePeriodEndsAt?: string | null;
  failedPaymentCount?: number;
  blockReason?: string;
}

export default function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);

  // Fetch usage summary
  const { data: usageData, isLoading: usageLoading, error: usageError } = useQuery<UsageSummaryResponse>({
    queryKey: ['/api/billing/usage-summary'],
    retry: 2,
  });

  // Fetch dunning status
  const { data: dunningData, isLoading: dunningLoading } = useQuery<DunningStatusResponse>({
    queryKey: ['/api/quota/dunning-status'],
    retry: 1,
    enabled: !!usageData?.license?.nonce,
  });

  if (usageLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Đang tải dữ liệu thanh toán...</p>
        </div>
      </div>
    );
  }

  if (usageError) {
    return (
      <div className="p-6">
        <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-lg">
          <AlertCircle className="h-5 w-5 inline mr-2" />
          Không thể tải dữ liệu thanh toán. Vui lòng thử lại sau.
        </div>
      </div>
    );
  }

  if (!usageData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Đang tải dữ liệu thanh toán...</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getStatusFromPercentage = (pct: number): 'ok' | 'warning' | 'critical' | 'overage' => {
    if (pct >= 100) return 'overage';
    if (pct >= 90) return 'critical';
    if (pct >= 75) return 'warning';
    return 'ok';
  };

  // Prepare usage data for FullUsageSummary
  const hourlyUsage = {
    used: Math.round(usageData.usage.apiCalls / 24), // Approximate hourly from daily
    limit: Math.round(usageData.limits.apiCalls / (30 * 24)),
    percentage: (usageData.percentages.apiCalls || 0) / 30, // Approximate
    status: getStatusFromPercentage((usageData.percentages.apiCalls || 0) / 30),
  };

  const dailyUsage = {
    used: usageData.usage.apiCalls,
    limit: usageData.limits.apiCalls,
    percentage: usageData.percentages.apiCalls || 0,
    status: usageData.status.apiCalls,
  };

  const monthlyUsage = {
    used: usageData.usage.apiCalls,
    limit: usageData.limits.apiCalls,
    percentage: usageData.percentages.apiCalls || 0,
    status: usageData.status.apiCalls,
    overage: usageData.overageEvents.totalCredits,
  };

  // Prepare quota data for gauges
  const quotaData = [
    {
      label: 'API Calls',
      used: usageData.usage.apiCalls,
      limit: usageData.limits.apiCalls,
    },
    {
      label: 'Video Generations',
      used: usageData.usage.videoGenerations,
      limit: usageData.limits.videoGenerations,
    },
    {
      label: 'Storage (MB)',
      used: usageData.usage.storage,
      limit: usageData.limits.storage,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Usage</h1>
          <p className="text-muted-foreground mt-1">
            Monitor your usage, overage charges, and billing status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <CreditCard className="h-4 w-4 mr-2" />
            Upgrade Plan
          </Button>
        </div>
      </div>

      {/* Dunning Status Banner */}
      {dunningData && dunningData.state !== 'current' && (
        <DunningStatusBanner
          state={dunningData.state}
          gracePeriodEndsAt={dunningData.gracePeriodEndsAt}
          failedPaymentCount={dunningData.failedPaymentCount}
          blockReason={dunningData.blockReason}
          allowed={dunningData.allowed}
        />
      )}

      {/* Billing Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Base Price</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(usageData.projectedCharges.basePriceCents)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {usageData.license.tier} tier subscription
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overage Charges</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(usageData.projectedCharges.overageChargesCents)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {usageData.overageEvents.totalCredits.toLocaleString()} credits over limit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Due</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(usageData.projectedCharges.totalCents)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Includes {usageData.projectedCharges.billableCredits.toLocaleString()} billable credits
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Summary Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Usage Breakdown</h2>
        <FullUsageSummary
          hourly={hourlyUsage}
          daily={dailyUsage}
          monthly={monthlyUsage}
        />
      </div>

      {/* Quota Gauges */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Sử Dụng Hạn Mức</h2>
        <Card>
          <CardHeader>
            <CardTitle>Mức Dùng Tài Nguyên</CardTitle>
            <CardDescription>
              Biểu đồ trực quan mức tiêu thụ tài nguyên
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuotaGaugeList quotas={quotaData} columns={3} />
          </CardContent>
        </Card>
      </div>

      {/* Overage Charges Table */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Chi Tiết Vượt Hạn</h2>
        <Card>
          <CardHeader>
            <CardTitle>Sự Kiện Vượt Hạn Kỳ Này</CardTitle>
            <CardDescription>
              Kỳ: {new Date(usageData.period.start).toLocaleDateString()} - {new Date(usageData.period.end).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại Tài Nguyên</TableHead>
                  <TableHead>Credits Vượt</TableHead>
                  <TableHead>Sự Kiện Tính Phí</TableHead>
                  <TableHead className="text-right">Phí Ước Tính</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(usageData.overageEvents.byType).map(([type, credits]) => (
                  <TableRow key={type}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {type === 'api_calls' && <Zap className="h-4 w-4" />}
                        {type === 'video_generations' && <CreditCard className="h-4 w-4" />}
                        {type === 'storage' && <Calendar className="h-4 w-4" />}
                        {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                    </TableCell>
                    <TableCell>{credits.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {Math.round(credits * 0.8).toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Math.round(credits * 0.5 * 100))}
                    </TableCell>
                  </TableRow>
                ))}
                {usageData.overageEvents.total === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Không có sự kiện vượt hạn trong kỳ này
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Tổng Credits Vượt</p>
                <p className="text-lg font-semibold">
                  {usageData.overageEvents.totalCredits.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ân Hạn</p>
                <p className="text-lg font-semibold">
                  {usageData.projectedCharges.gracePeriodCredits === Infinity
                    ? 'Không giới hạn'
                    : usageData.projectedCharges.gracePeriodCredits.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Tổng Ước Tính</p>
                <p className="text-lg font-bold text-primary">
                  {formatCurrency(usageData.projectedCharges.overageChargesCents)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lịch Sử Thanh Toán */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Lịch Sử Thanh Toán</h2>
        <Card>
          <CardHeader>
            <CardTitle>Thanh Toán Gần Đây</CardTitle>
            <CardDescription>
              Lịch sử thanh toán trong 6 tháng gần nhất
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Mô Tả</TableHead>
                  <TableHead>Trạng Thái</TableHead>
                  <TableHead className="text-right">Số Tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Placeholder rows - would be fetched from API */}
                <TableRow>
                  <TableCell className="font-medium">
                    {new Date().toLocaleDateString()}
                  </TableCell>
                  <TableCell>{usageData.license.tier} Đăng Ký</TableCell>
                  <TableCell>
                    <Badge variant="default">Đã Thanh Toán</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(usageData.projectedCharges.basePriceCents)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    {new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{usageData.license.tier} Đăng Ký</TableCell>
                  <TableCell>
                    <Badge variant="default">Đã Thanh Toán</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(usageData.projectedCharges.basePriceCents)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    {new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{usageData.license.tier} Đăng Ký</TableCell>
                  <TableCell>
                    <Badge variant="default">Đã Thanh Toán</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(usageData.projectedCharges.basePriceCents)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="mt-4 text-center">
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/billing/invoices">View All Invoices</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
