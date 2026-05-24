'use client';

/**
 * AgentSessionsClient — Displays multi-agent execution sessions.
 * Shows active session count, role distribution chart, and session list with expandable tasks.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Bot, Users, Activity, CheckCircle2, XCircle, Clock } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Skeleton } from '@/seed/components/ui/skeleton';
import type {
  AgentRole,
  AgentSession,
  AgentStatus,
  AgentTaskAssignment,
} from '@/seed/types/multi-agent';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLES: AgentRole[] = ['supervisor', 'script_writer', 'voice_generator', 'video_producer', 'publisher', 'analyst'];

const ROLE_COLORS: Record<AgentRole, string> = {
  supervisor:      '#00f0ff',
  script_writer:   '#7000ff',
  voice_generator: '#ff00ff',
  video_producer:  '#f59e0b',
  publisher:       '#10b981',
  analyst:         '#6366f1',
};

function formatDuration(startedAt?: number, completedAt?: number): string {
  if (!startedAt) return '—';
  const end = completedAt ?? Date.now();
  const ms = end - startedAt;
  const mins = Math.floor(ms / 60000);
  return mins < 1 ? '<1m' : `${mins}m`;
}

type StatusConfig = {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'basic' | 'premium' | 'enterprise';
  icon: React.ReactNode;
};

function sessionStatusConfig(status: AgentStatus): StatusConfig {
  switch (status) {
    case 'pending':   return { label: 'Pending',   variant: 'default',     icon: <Clock size={12} /> };
    case 'running':   return { label: 'Running',   variant: 'basic',       icon: <Activity size={12} /> };
    case 'completed': return { label: 'Completed', variant: 'enterprise',  icon: <CheckCircle2 size={12} /> };
    case 'failed':    return { label: 'Failed',    variant: 'destructive', icon: <XCircle size={12} /> };
    case 'cancelled': return { label: 'Cancelled', variant: 'secondary',   icon: <XCircle size={12} /> };
  }
}

// ── Expandable session row ────────────────────────────────────────────────────

function SessionRow({ session, tasks }: { session: AgentSession; tasks: AgentTaskAssignment[] }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = sessionStatusConfig(session.status);

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full text-left py-3 px-1 hover:bg-white/5 transition-colors grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center text-sm"
      >
        <span className="font-mono text-xs text-muted-foreground">{session.executionId}</span>
        <span className="text-xs text-muted-foreground">{session.supervisorAgent}</span>
        <span className="text-xs text-muted-foreground">{session.workerCount} workers</span>
        <span className="text-xs text-muted-foreground">{formatDuration(session.startedAt, session.completedAt)}</span>
        <Badge variant={cfg.variant} className="gap-1 text-xs">
          {cfg.icon}
          {cfg.label}
        </Badge>
      </button>

      {expanded && tasks.length > 0 && (
        <div className="ml-4 mb-3 space-y-1">
          {tasks.map((task) => {
            const tc = sessionStatusConfig(task.status);
            return (
              <div key={task.id} className="flex items-center gap-3 text-xs py-1 px-3 rounded bg-white/5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: ROLE_COLORS[task.agentRole] }}
                />
                <span className="text-muted-foreground capitalize w-32 shrink-0">{task.agentRole.replace('_', ' ')}</span>
                <span className="text-muted-foreground w-14 shrink-0">Step {task.stepIndex}</span>
                <Badge variant={tc.variant} className="gap-1 text-xs">{tc.icon}{tc.label}</Badge>
                {task.errorMessage && (
                  <span className="text-red-400 truncate max-w-[180px]" title={task.errorMessage}>{task.errorMessage}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AgentSessionsClientProps {
  userId: string;
}

// ── Main component ────────────────────────────────────────────────────────────

interface ApiResponse {
  sessions?: AgentSession[];
  tasksBySession?: Record<string, AgentTaskAssignment[]>;
  stats?: { active: number; completed: number; failed: number };
}

export function AgentSessionsClient({ userId: _userId }: AgentSessionsClientProps) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [tasksBySession, setTasksBySession] = useState<Record<string, AgentTaskAssignment[]>>({});
  const [stats, setStats] = useState({ active: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/agi/agents')
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((data) => {
        setSessions(data.sessions ?? []);
        setTasksBySession(data.tasksBySession ?? {});
        setStats(data.stats ?? { active: 0, completed: 0, failed: 0 });
      })
      .catch(() => { /* keep empty */ })
      .finally(() => setLoading(false));
  }, []);

  const allTasks = useMemo(
    () => Object.values(tasksBySession).flat(),
    [tasksBySession]
  );

  const roleDistribution = useMemo(() =>
    ROLES.map((role) => ({
      role: role.replace('_', ' '),
      count: allTasks.filter((t) => t.agentRole === role).length,
      color: ROLE_COLORS[role],
    })).filter((r) => r.count > 0),
    [allTasks]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card glass>
        <CardContent className="p-12 text-center">
          <Bot className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-lg font-medium mb-2">No Agent Sessions Yet</h3>
          <p className="text-sm text-muted-foreground">
            Agent sessions will appear here once multi-agent SOP executions start.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary metric cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <Activity className="text-[#00f0ff] shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Sessions</p>
              <p className="text-2xl font-bold text-[#00f0ff]">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <CheckCircle2 className="text-[#00f0ff] shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-bold">{stats.completed}</p>
            </div>
          </CardContent>
        </Card>
        <Card glass hover>
          <CardContent className="p-5 flex items-center gap-4">
            <XCircle className="text-[#ff00ff] shrink-0" size={28} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Failed</p>
              <p className="text-2xl font-bold text-[#ff00ff]">{stats.failed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role distribution + session list */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card glass>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users size={16} className="text-[#7000ff]" />
              Agent Role Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                layout="vertical"
                data={roleDistribution}
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <YAxis dataKey="role" type="category" width={110} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(val) => [String(val), 'Tasks']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {roleDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card glass>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot size={16} className="text-[#00f0ff]" />
              All Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 text-xs uppercase tracking-wider text-muted-foreground pb-2 px-1 border-b border-white/10">
                <span>Execution</span>
                <span>Supervisor</span>
                <span>Workers</span>
                <span>Duration</span>
                <span>Status</span>
              </div>
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  tasks={tasksBySession[session.id] ?? []}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
