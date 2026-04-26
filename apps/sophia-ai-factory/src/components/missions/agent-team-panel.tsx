'use client';

/**
 * AgentTeamPanel — polls /api/agents/list every 5s, shows agent cards
 */

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AgentStatusBadge } from './agent-status-badge';
import type { AgentWithStatus, AgentStatus } from '@/app/api/agents/list/route';

const ROLE_ICONS: Record<string, string> = {
  CEO: 'person_pin',
  Developer: 'code',
  QA: 'bug_report',
  Ops: 'settings',
  Marketing: 'campaign',
};

export function AgentTeamPanel() {
  const t = useTranslations('dashboard.missions.control');
  const [agents, setAgents] = useState<AgentWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/list');
      if (!res.ok) return;
      const data = await res.json() as { agents: AgentWithStatus[] };
      setAgents(data.agents ?? []);
    } catch {
      // Silently retry on next interval
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAgents();
    const interval = setInterval(() => { void fetchAgents(); }, 5_000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const statusLabel = (status: AgentStatus): string => {
    const map: Record<AgentStatus, string> = {
      idle: t('agent_idle'),
      working: t('agent_working'),
      blocked: t('agent_blocked'),
      error: t('agent_error'),
    };
    return map[status] ?? status;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-base">group</span>
          {t('agent_team')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <p className="text-xs text-muted-foreground">Loading agents...</p>
        )}

        {!loading && agents.length === 0 && (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-muted-foreground">{t('no_agents')}</p>
            <button
              className="text-xs text-primary underline"
              onClick={() => { window.location.href = '/dashboard/settings'; }}
            >
              {t('create_team_cta')}
            </button>
          </div>
        )}

        {agents.map(agent => (
          <div key={agent.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/40">
            <span className="material-symbols-outlined text-lg text-muted-foreground mt-0.5">
              {ROLE_ICONS[agent.role] ?? 'smart_toy'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium truncate">{agent.name}</span>
                <AgentStatusBadge status={agent.status} label={statusLabel(agent.status)} />
              </div>
              {agent.currentTask && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {agent.currentTask}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
