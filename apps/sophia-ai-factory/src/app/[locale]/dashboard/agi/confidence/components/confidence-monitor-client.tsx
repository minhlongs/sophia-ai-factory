'use client';

/**
 * ConfidenceMonitorClient — Displays AGI confidence scores and escalation requests.
 * Shows gauge, trend chart, escalation table, and summary metric cards.
 */

import React, { useMemo } from 'react';
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
import type { EscalationStatus } from '@/seed/types/confidence';
import { MOCK_SCORES, MOCK_ESCALATIONS } from './confidence-mock-data';

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
  const avgScore = useMemo(
    () => MOCK_SCORES.reduce((sum, s) => sum + s.score, 0) / MOCK_SCORES.length,
    []
  );
  const belowThreshold = useMemo(
    () => MOCK_SCORES.filter((s) => s.score < THRESHOLD).length,
    []
  );
  const escalationRate = useMemo(
    () => Math.round((MOCK_ESCALATIONS.length / MOCK_SCORES.length) * 100),
    []
  );

  const trendData = useMemo(
    () =>
      [...MOCK_SCORES]
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((s) => ({ date: formatDate(s.createdAt), confidence: Math.round(s.score * 100) })),
    []
  );

  return (
    <div className="space-y-6">
      {/* Summary metric cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <Shield className="text-[#00f0ff] shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Confidence</p>
              <p className="text-2xl font-bold text-[#00f0ff]">{formatPct(avgScore)}</p>
            </div>
          </CardContent>
        </Card>
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <AlertTriangle className="text-[#ff00ff] shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Below Threshold</p>
              <p className="text-2xl font-bold text-[#ff00ff]">{belowThreshold} steps</p>
            </div>
          </CardContent>
        </Card>
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <TrendingUp className="text-[#7000ff] shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Escalation Rate</p>
              <p className="text-2xl font-bold text-[#7000ff]">{escalationRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <CheckCircle className="text-[#00f0ff] shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Escalations</p>
              <p className="text-2xl font-bold">{MOCK_ESCALATIONS.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gauge + trend chart */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card glass>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield size={16} className="text-[#00f0ff]" />
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
              <TrendingUp size={16} className="text-[#7000ff]" />
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
            <AlertTriangle size={16} className="text-[#ff00ff]" />
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
                {MOCK_ESCALATIONS.map((esc) => {
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
