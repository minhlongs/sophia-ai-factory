'use client';

/**
 * AgentHealthCard — displays AI agent health metrics.
 * Polls /api/health/agents every 30s (matches page cadence).
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import type { AgentHealthSummary, AgentRoleHealth } from '@/forest/agents/agent-health-resolver';

function SuccessRateBadge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  if (pct >= 90) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
        <CheckCircle className="w-3 h-3" />
        {pct}%
      </span>
    );
  }
  if (pct >= 70) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
        <AlertCircle className="w-3 h-3" />
        {pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
      <AlertCircle className="w-3 h-3" />
      {pct}%
    </span>
  );
}

function RoleRow({ role }: { role: AgentRoleHealth }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 text-sm font-medium text-foreground">{role.role}</td>
      <td className="py-2 pr-4 text-sm text-muted-foreground text-right">{role.totalCount}</td>
      <td className="py-2 pr-4 text-right">
        <SuccessRateBadge rate={role.successRate} />
      </td>
      <td className="py-2 text-xs text-muted-foreground text-right">
        {role.lastFailureAt ? (
          <span className="flex items-center justify-end gap-1">
            <Clock className="w-3 h-3" />
            {new Date(role.lastFailureAt).toLocaleTimeString()}
          </span>
        ) : (
          <span className="text-green-600 dark:text-green-400">—</span>
        )}
      </td>
    </tr>
  );
}

export function AgentHealthCard() {
  const { data, isLoading, isError } = useQuery<AgentHealthSummary>({
    queryKey: ['agent-health'],
    queryFn: async () => {
      const res = await fetch('/api/health/agents');
      if (!res.ok) throw new Error('Failed to fetch agent health');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <section aria-label="AI Agent Health">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-foreground">AI Agent Health</h2>
        {data && (
          <span className="ml-auto text-xs text-muted-foreground">
            Tổng lỗi 24h: {data.totalErrors24h}
          </span>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        {isLoading && (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" role="status" aria-label="Loading agent health" />
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Không thể tải dữ liệu agent. Thử lại sau 30s.</span>
          </div>
        )}

        {data && data.roles.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Chưa có dữ liệu agent trong 24 giờ qua.
          </p>
        )}

        {data && data.roles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Tasks (24h)</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Success</th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Last Fail</th>
                </tr>
              </thead>
              <tbody>
                {data.roles.map((role) => (
                  <RoleRow key={role.role} role={role} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && (
          <p className="text-xs text-muted-foreground mt-4 text-right">
            Cập nhật: {new Date(data.resolvedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </section>
  );
}
