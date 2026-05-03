'use client';

/**
 * AgentPerformanceCard — Phase 03 Forest: Feedback Loop
 *
 * Displays per-role agent task metrics (start / complete / fail counts,
 * completion rate, avg duration). Auto-refreshes every 60s via React Query.
 *
 * Fetches from GET /api/analytics/agent-performance.
 * Lazy-loaded — no impact on analytics initial paint.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Bot, RefreshCw, AlertCircle } from 'lucide-react';
import type { AgentPerformanceReport, AgentRoleMetrics, WindowOption } from '@/lib/analytics/agent-performance-resolver';

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchAgentPerformance(window: WindowOption): Promise<AgentPerformanceReport> {
  const res = await fetch(`/api/analytics/agent-performance?window=${window}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<AgentPerformanceReport>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleRow({ metrics }: { metrics: AgentRoleMetrics }) {
  const rate = metrics.completion_rate;
  const rateStr = rate !== null ? `${(rate * 100).toFixed(0)}%` : '—';
  const durationStr =
    metrics.avg_duration_ms !== null
      ? `${(metrics.avg_duration_ms / 1000).toFixed(1)}s`
      : '—';

  const badgeVariant =
    rate === null ? 'secondary' : rate >= 0.9 ? 'default' : rate >= 0.7 ? 'secondary' : 'destructive';

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 font-medium text-sm">{metrics.role}</td>
      <td className="py-2 pr-4 text-sm text-muted-foreground text-right">{metrics.start_count}</td>
      <td className="py-2 pr-4 text-sm text-muted-foreground text-right">{metrics.complete_count}</td>
      <td className="py-2 pr-4 text-sm text-muted-foreground text-right">{metrics.fail_count}</td>
      <td className="py-2 pr-4 text-right">
        <Badge variant={badgeVariant} className="text-xs">{rateStr}</Badge>
      </td>
      <td className="py-2 text-sm text-muted-foreground text-right">{durationStr}</td>
    </tr>
  );
}

function WindowToggle({
  value,
  onChange,
}: {
  value: WindowOption;
  onChange: (v: WindowOption) => void;
}) {
  return (
    <div className="flex gap-1">
      {(['24h', '7d'] as WindowOption[]).map((w) => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className={[
            'px-2 py-0.5 rounded text-xs font-medium transition-colors',
            value === w
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          ].join(' ')}
        >
          {w}
        </button>
      ))}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function AgentPerformanceCard() {
  const [window, setWindow] = useState<WindowOption>('24h');

  const { data, isLoading, isError, dataUpdatedAt } = useQuery<AgentPerformanceReport>({
    queryKey: ['agent-performance', window],
    queryFn: () => fetchAgentPerformance(window),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const lastRefresh = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot size={16} />
            Agent Performance
          </CardTitle>
          <div className="flex items-center gap-3">
            <WindowToggle value={window} onChange={setWindow} />
            {lastRefresh && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw size={10} />
                {lastRefresh}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            Loading agent metrics…
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle size={14} />
            Failed to load agent metrics.
          </div>
        )}

        {data && data.roles.length === 0 && (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            No agent tasks recorded in the last {window}.
          </div>
        )}

        {data && data.roles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Role</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground text-right">Start</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground text-right">Done</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground text-right">Fail</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground text-right">Rate</th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground text-right">Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {data.roles.map((m) => (
                  <RoleRow key={`${m.role}-${m.variant}`} metrics={m} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
