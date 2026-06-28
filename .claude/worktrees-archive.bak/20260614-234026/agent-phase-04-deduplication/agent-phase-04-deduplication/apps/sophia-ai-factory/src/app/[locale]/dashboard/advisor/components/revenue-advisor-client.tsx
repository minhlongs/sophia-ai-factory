'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Wallet,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Skeleton } from '@/seed/components/ui/skeleton';
import type { RevenueSnapshot, TierRevenueRow, ARRTrendPoint } from '@/seed/types/analytics-revenue';
import type { UnifiedRevenueSummary } from '@/land/analytics/queries/revenue-unified-query';

// ── Types ────────────────────────────────────────────────────────────────────

interface CommissionSummary {
  pending_usd: number;
  payable_usd: number;
  paid_usd: number;
  total_entries: number;
}

interface ApiResponse {
  snapshot?: RevenueSnapshot;
  unified?: UnifiedRevenueSummary;
  commissions?: CommissionSummary;
  totalCustomers?: number;
}

interface Recommendation {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  BASIC: '#94a3b8',
  PREMIUM: '#7000ff',
  ENTERPRISE: '#00f0ff',
  MASTER: '#f59e0b',
};

const VERTICAL_COLORS: Record<string, string> = {
  saas: '#00f0ff',
  crypto: '#f59e0b',
  product: '#10b981',
};

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null): string {
  if (n === null) return 'N/A';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function generateRecommendations(
  snapshot: RevenueSnapshot,
  commissions: CommissionSummary,
  totalCustomers: number,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const basicCount = snapshot.byTier.find((t) => t.tier === 'BASIC')?.customers ?? 0;
  const premiumCount = snapshot.byTier.find((t) => t.tier === 'PREMIUM')?.customers ?? 0;

  if (basicCount > 0 && basicCount >= totalCustomers * 0.5) {
    recs.push({
      title: 'Upsell BASIC users',
      description: `${basicCount} BASIC users (${Math.round((basicCount / Math.max(totalCustomers, 1)) * 100)}% of base) — targeted upgrade campaigns could boost MRR significantly.`,
      impact: 'high',
      icon: <ArrowUpRight size={16} />,
    });
  }

  if (snapshot.mrrGrowthPct !== null && snapshot.mrrGrowthPct < 5) {
    recs.push({
      title: 'Accelerate growth',
      description: `MRR growth at ${fmtPct(snapshot.mrrGrowthPct)} — consider new acquisition channels or pricing experiments.`,
      impact: snapshot.mrrGrowthPct < 0 ? 'high' : 'medium',
      icon: <TrendingUp size={16} />,
    });
  }

  if (commissions.pending_usd > 100) {
    recs.push({
      title: 'Process pending commissions',
      description: `${fmtUsd(commissions.pending_usd)} in pending affiliate commissions — timely payouts improve affiliate retention.`,
      impact: 'medium',
      icon: <Wallet size={16} />,
    });
  }

  if (premiumCount > 0 && premiumCount >= 3) {
    recs.push({
      title: 'Enterprise upgrade path',
      description: `${premiumCount} PREMIUM users may benefit from ENTERPRISE features — consider targeted outreach.`,
      impact: 'medium',
      icon: <ArrowUpRight size={16} />,
    });
  }

  if (recs.length === 0) {
    recs.push({
      title: 'Maintain momentum',
      description: 'Revenue metrics look healthy. Focus on retention and expanding per-user value.',
      impact: 'low',
      icon: <Lightbulb size={16} />,
    });
  }

  return recs;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface RevenueAdvisorClientProps {
  userId: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function RevenueAdvisorClient({ userId: _userId }: RevenueAdvisorClientProps) {
  const [snapshot, setSnapshot] = useState<RevenueSnapshot | null>(null);
  const [unified, setUnified] = useState<UnifiedRevenueSummary | null>(null);
  const [commissions, setCommissions] = useState<CommissionSummary>({
    pending_usd: 0, payable_usd: 0, paid_usd: 0, total_entries: 0,
  });
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/advisor/revenue')
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json() as Promise<ApiResponse>;
      })
      .then((data) => {
        if (data.snapshot) setSnapshot(data.snapshot);
        if (data.unified) setUnified(data.unified);
        if (data.commissions) setCommissions(data.commissions);
        if (data.totalCustomers) setTotalCustomers(data.totalCustomers);
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => setLoading(false));
  }, []);

  const recommendations = useMemo(
    () => snapshot ? generateRecommendations(snapshot, commissions, totalCustomers) : [],
    [snapshot, commissions, totalCustomers],
  );

  const trendData = useMemo(
    () => snapshot?.trend30d.map((p) => ({ date: p.date.slice(5), mrr: Math.round(p.mrr) })) ?? [],
    [snapshot],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[380px] rounded-xl" />
          <Skeleton className="h-[380px] rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <Card glass>
        <CardContent className="p-12 text-center">
          <DollarSign className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-lg font-medium mb-2">No Revenue Data Yet</h3>
          <p className="text-sm text-muted-foreground">
            Revenue metrics will appear here once subscriptions and payments are recorded.
          </p>
        </CardContent>
      </Card>
    );
  }

  const growthPositive = snapshot.mrrGrowthPct !== null && snapshot.mrrGrowthPct >= 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <DollarSign className="text-agi-confidence shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">ARR</p>
              <p className="text-2xl font-bold text-agi-confidence">{fmtUsd(snapshot.arr)}</p>
            </div>
          </CardContent>
        </Card>
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <DollarSign className="text-agi-escalation shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">MRR</p>
              <p className="text-2xl font-bold text-agi-escalation">{fmtUsd(snapshot.mrr)}</p>
            </div>
          </CardContent>
        </Card>
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            {growthPositive
              ? <TrendingUp className="text-emerald-500 shrink-0" size={28} />
              : <TrendingDown className="text-agi-danger shrink-0" size={28} />
            }
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">MRR Growth</p>
              <p className={`text-2xl font-bold ${growthPositive ? 'text-emerald-500' : 'text-agi-danger'}`}>
                {fmtPct(snapshot.mrrGrowthPct)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <Users className="text-amber-500 shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Customers</p>
              <p className="text-2xl font-bold">{totalCustomers}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend + Tier Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card glass>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp size={16} className="text-agi-confidence" />
              Revenue Trend (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(val) => [fmtUsd(Number(val ?? 0)), 'Revenue']}
                  />
                  <Line
                    type="monotone"
                    dataKey="mrr"
                    stroke="hsl(var(--agi-confidence))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--agi-confidence))', r: 3 }}
                    activeDot={{ r: 5, fill: 'hsl(var(--agi-confidence))', filter: 'drop-shadow(0 0 6px #00f0ff)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No trend data yet</p>
            )}
          </CardContent>
        </Card>

        <Card glass>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users size={16} className="text-agi-escalation" />
              Tier Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.byTier.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  layout="vertical"
                  data={snapshot.byTier.map((t) => ({
                    tier: t.tier,
                    customers: t.customers,
                    mrr: t.mrr,
                    color: TIER_COLORS[t.tier] ?? '#94a3b8',
                  }))}
                  margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis dataKey="tier" type="category" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(val) => [fmtUsd(Number(val ?? 0)), 'MRR']}
                  />
                  <Bar dataKey="mrr" radius={[0, 4, 4, 0]}>
                    {snapshot.byTier.map((entry, index) => (
                      <Cell key={index} fill={TIER_COLORS[entry.tier] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No tier data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commission Summary + Vertical Revenue */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card glass>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet size={16} className="text-emerald-500" />
              Affiliate Commission Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'Pending', value: commissions.pending_usd, color: '#f59e0b' },
                { label: 'Payable', value: commissions.payable_usd, color: '#00f0ff' },
                { label: 'Paid', value: commissions.paid_usd, color: '#10b981' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold">{fmtUsd(item.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">Total Entries</span>
                <span className="text-xs font-mono">{commissions.total_entries}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {unified && (
          <Card glass>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign size={16} className="text-amber-500" />
                Revenue by Vertical (30d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-4">
                {(['saas', 'crypto', 'product'] as const).map((v) => (
                  <div key={v} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: VERTICAL_COLORS[v] }} />
                      <span className="text-sm text-muted-foreground capitalize">{v}</span>
                    </div>
                    <span className="text-sm font-semibold">{fmtUsd(unified.byVertical[v])}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-sm font-medium">Total</span>
                <span className="text-sm font-bold text-agi-confidence">{fmtUsd(unified.totalThisMonth)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Growth Recommendations */}
      {recommendations.length > 0 && (
        <Card glass>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-500" />
              Growth Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <span className="mt-0.5 text-amber-500">{rec.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{rec.title}</span>
                      <Badge
                        variant={rec.impact === 'high' ? 'destructive' : rec.impact === 'medium' ? 'premium' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {rec.impact}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
