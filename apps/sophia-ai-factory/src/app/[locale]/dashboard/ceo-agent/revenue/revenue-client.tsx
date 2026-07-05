'use client';

/** Revenue insights client for /dashboard/ceo-agent/revenue. */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { DollarSign, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import {
  getRevenueInsights,
  getRecentTransactions,
} from './actions';
import type { TrendPoint, RevenueInsights, RevenueActionResult } from './actions';

// ── Local shapes ──────────────────────────────────────────────────────────────

interface ClientProps {
  locale: string;
  userId: string;
  initialInsights: RevenueInsights;
  titleLabel: string;
  subtitleLabel: string;
  spentLabel: string;
  purchasedLabel: string;
  usedLabel: string;
  remainingLabel: string;
  avgSpendLabel: string;
  trendLabel: string;
  noDataLabel: string;
  tierLabel: string;
  refreshLabel: string;
  refreshingLabel: string;
  retryLabel: string;
  errorLabel: string;
  txTitleLabel: string;
  txDateLabel: string;
  txAmountLabel: string;
  txCreditsLabel: string;
  txSkuLabel: string;
  emptyTxLabel: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        positive
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      }`}
    >
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {positive ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}

interface StatTileProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}

function StatTile({ label, value, icon, badge }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl bg-muted/40">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {badge && <div className="mt-1">{badge}</div>}
    </div>
  );
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function CustomTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg text-sm min-w-[140px]">
      <p className="font-medium text-muted-foreground mb-2">{label ?? ''}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-medium tabular-nums">{fmtCurrency(p.value)}</span>
        </div>
      ))}
      <div className="mt-2 pt-2 border-t flex justify-between font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{fmtCurrency(total)}</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RevenueClient(props: ClientProps) {
  const {
    locale,
    userId,
    initialInsights,
    titleLabel,
    subtitleLabel,
    spentLabel,
    purchasedLabel,
    usedLabel,
    remainingLabel,
    avgSpendLabel,
    trendLabel,
    noDataLabel,
    tierLabel,
    refreshLabel,
    refreshingLabel,
    retryLabel,
    errorLabel,
    txTitleLabel,
    txDateLabel,
    txAmountLabel,
    txCreditsLabel,
    txSkuLabel,
    emptyTxLabel,
  } = props;

  const [insights, setInsights] = useState<RevenueInsights>(initialInsights);
  const [transactions, setTransactions] = useState<Array<{ id: string; date: string; amountUsd: number; credits: number; sku: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate transactions and latest snapshot after mount.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const txRes: RevenueActionResult & { transactions?: Array<{ id: string; date: string; amountUsd: number; credits: number; sku: string }> } = await getRecentTransactions();
      const insightsRes: RevenueActionResult = await getRevenueInsights();

      if (cancelled) return;
      if (txRes.ok && txRes.transactions) setTransactions(txRes.transactions);
      if (insightsRes.ok && insightsRes.insights) setInsights(insightsRes.insights);
      if (!txRes.ok || !insightsRes.ok) setError(errorLabel);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, errorLabel]);

  const chartData = useMemo<TrendPoint[]>(() => insights.trend30d ?? [], [insights.trend30d]);

  const renderEmptyState = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign size={18} />
          {titleLabel}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{noDataLabel}</p>
      </CardContent>
    </Card>
  );

  const renderErrorState = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign size={18} />
          {titleLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-red-500">{error ?? errorLabel}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            getRevenueInsights().then((res) => {
              if (res.ok && res.insights) setInsights(res.insights);
              else setError(errorLabel);
              setLoading(false);
            });
          }}
          className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm"
        >
          {retryLabel}
        </button>
      </CardContent>
    </Card>
  );

  const renderBody = () => {
    if (error) return renderErrorState();
    if (!loading && chartData.length === 0 && insights.totalSpentUsd === 0) return renderEmptyState();

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign size={18} />
            {titleLabel}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{subtitleLabel}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* KPI tiles */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label={spentLabel}
              value={fmtCurrency(insights.totalSpentUsd)}
              icon={<DollarSign size={14} />}
              badge={<GrowthBadge pct={null} />}
            />
            <StatTile
              label={purchasedLabel}
              value={String(insights.totalCreditsPurchased)}
              icon={<Zap size={14} />}
            />
            <StatTile
              label={usedLabel}
              value={String(insights.totalCreditsUsed)}
              icon={<TrendingDown size={14} />}
            />
            <StatTile
              label={remainingLabel}
              value={String(insights.remainingCredits)}
              icon={<TrendingUp size={14} />}
              badge={
                insights.remainingCredits > 0
                  ? <span className="text-xs text-green-600">Active</span>
                  : <span className="text-xs text-muted-foreground">None</span>
              }
            />
          </div>

          {/* 7d avg */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              {avgSpendLabel}: <span className="font-bold tabular-nums">{fmtCurrency(insights.avgDailySpend7d)}</span>
            </p>
          </div>

          {/* Trend chart */}
          {chartData.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">{trendLabel}</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="spentUsd"
                    name="Spend"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#spendGradient)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tier badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{tierLabel}:</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold">{insights.tier}</span>
          </div>

          {/* Recent transactions */}
          {transactions.length > 0 && (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{txDateLabel}</th>
                    <th className="px-3 py-2 text-right font-medium">{txAmountLabel}</th>
                    <th className="px-3 py-2 text-right font-medium">{txCreditsLabel}</th>
                    <th className="px-3 py-2 text-left font-medium">{txSkuLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.slice(0, 10).map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2">{tx.date}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(tx.amountUsd)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{tx.credits}</td>
                      <td className="px-3 py-2">{tx.sku}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{titleLabel}</h1>
        <p className="text-sm text-muted-foreground">{subtitleLabel}</p>
      </header>

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72 mt-2" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </CardContent>
        </Card>
      ) : (
        renderBody()
      )}
    </div>
  );
}
