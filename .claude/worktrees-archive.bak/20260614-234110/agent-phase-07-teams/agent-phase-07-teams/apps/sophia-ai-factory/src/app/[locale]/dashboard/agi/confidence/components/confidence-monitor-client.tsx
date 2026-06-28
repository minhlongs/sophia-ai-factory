'use client';

/**
 * ConfidenceMonitorClient — Displays AGI confidence scores and escalation requests.
 * Shows gauge, trend chart, escalation table, and summary metric cards.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Shield, AlertTriangle, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Skeleton } from '@/seed/components/ui/skeleton';
import type { ConfidenceScore, EscalationRequest, EscalationStatus } from '@/seed/types/confidence';

// ── Helpers ───────────────────────────────────────────────────────────────────

const THRESHOLD = 0.75;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatPct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

type StatusConfig = {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'basic' | 'premium' | 'enterprise';
  icon: React.ReactNode;
};

function escalationStatusConfig(status: EscalationStatus): StatusConfig {
  switch (status) {
    case 'pending':     return { label: 'Pending',       variant: 'premium',     icon: <AlertTriangle size={12} /> };
    case 'approved':    return { label: 'Approved',      variant: 'basic',       icon: <CheckCircle size={12} /> };
    case 'rejected':    return { label: 'Rejected',      variant: 'destructive', icon: <XCircle size={12} /> };
    case 'auto_resolved': return { label: 'Auto-resolved', variant: 'enterprise', icon: <Shield size={12} /> };
  }
}

// ── Circular gauge ────────────────────────────────────────────────────────────

function ConfidenceGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference * (1 - score);
  const color = score >= 0.85 ? '#00f0ff' : score >= THRESHOLD ? '#7000ff' : '#ff00ff';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        <circle
          cx="70" cy="70" r="54"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="-mt-[100px] flex flex-col items-center">
        <span className="text-3xl font-bold" style={{ color }}>{pct}%</span>
        <span className="text-xs text-muted-foreground mt-1">Overall Confidence</span>
      </div>
      <div className="mt-[68px]" />
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ConfidenceMonitorClientProps {
  userId: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConfidenceMonitorClient({ userId: _userId }: ConfidenceMonitorClientProps) {
  const [scores, setScores] = useState<ConfidenceScore[]>([]);
  const [escalations, setEscalations] = useState<EscalationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/agi/confidence')
      .then((r) => r.json() as Promise<{ scores?: ConfidenceScore[]; escalations?: EscalationRequest[] }>)
      .then((data) => {
        setScores(data.scores ?? []);
        setEscalations(data.escalations ?? []);
      })
      .catch(() => { /* keep empty arrays */ })
      .finally(() => setLoading(false));
  }, []);

  const avgScore = useMemo(
    () => (scores.length > 0 ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length : 0),
    [scores]
  );
  const belowThreshold = useMemo(
    () => scores.filter((s) => s.score < THRESHOLD).length,
    [scores]
  );
  const escalationRate = useMemo(
    () => (scores.length > 0 ? Math.round((escalations.length / scores.length) * 100) : 0),
    [scores, escalations]
  );

  const trendData = useMemo(
    () =>
      [...scores]
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((s) => ({ date: formatDate(s.createdAt), confidence: Math.round(s.score * 100) })),
    [scores]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (scores.length === 0 && escalations.length === 0) {
    return (
      <Card glass>
        <CardContent className="p-12 text-center">
          <Shield className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-lg font-medium mb-2">No Confidence Data Yet</h3>
          <p className="text-sm text-muted-foreground">
            Confidence scores will appear here once SOP executions generate data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary metric cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <Shield className="text-agi-confidence shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Confidence</p>
              <p className="text-2xl font-bold text-agi-confidence">{formatPct(avgScore)}</p>
            </div>
          </CardContent>
        </Card>
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <AlertTriangle className="text-agi-danger shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Below Threshold</p>
              <p className="text-2xl font-bold text-agi-danger">{belowThreshold} steps</p>
            </div>
          </CardContent>
        </Card>
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <TrendingUp className="text-agi-escalation shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Escalation Rate</p>
              <p className="text-2xl font-bold text-agi-escalation">{escalationRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <CheckCircle className="text-agi-confidence shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Escalations</p>
              <p className="text-2xl font-bold">{escalations.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gauge + trend chart */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card glass>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield size={16} className="text-agi-confidence" />
              Overall Confidence Score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pb-4">
            <ConfidenceGauge score={avgScore} />
          </CardContent>
        </Card>

        <Card glass>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp size={16} className="text-agi-escalation" />
              Confidence Trend (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
                <Tooltip
                  contentStyle={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(val) => [`${val}%`, 'Confidence']}
                />
                <Line
                  type="monotone"
                  dataKey="confidence"
                  stroke="#00f0ff"
                  strokeWidth={2}
                  dot={{ fill: '#00f0ff', r: 4 }}
                  activeDot={{ r: 6, fill: '#00f0ff', filter: 'drop-shadow(0 0 6px #00f0ff)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Escalation requests table */}
      <Card glass>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle size={16} className="text-agi-danger" />
            Recent Escalation Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left py-3 pr-4">Execution / SOP</th>
                  <th className="text-left py-3 pr-4">Step</th>
                  <th className="text-left py-3 pr-4">Reason</th>
                  <th className="text-left py-3 pr-4">Status</th>
                  <th className="text-left py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {escalations.map((esc) => {
                  const cfg = escalationStatusConfig(esc.status);
                  return (
                    <tr key={esc.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{esc.executionId}</td>
                      <td className="py-3 pr-4 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-xs font-semibold">{esc.stepIndex}</span>
                      </td>
                      <td className="py-3 pr-4 max-w-[220px] truncate" title={esc.reason}>{esc.reason}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={cfg.variant} className="gap-1">
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">{formatDate(esc.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
