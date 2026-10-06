'use client';

/**
 * Autonomous Operations Cockpit Component
 *
 * Layer: land/autonomous (Interactive Client Component)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 * Bilingual: VI / EN via next-intl ('autonomous' namespace)
 *
 * @module land/autonomous/operations-cockpit
 */

import React, { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  AlertOctagon,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Cpu,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bot,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import type {
  AutonomousLoopStateRow,
  AutonomousScheduleTaskRow,
  AutonomousDeadLetterRow,
  AutonomousCycleRunRow,
} from '@/seed/types/autonomous-engine';
import {
  startAutonomousLoopAction,
  pauseAutonomousLoopAction,
  resumeAutonomousLoopAction,
  emergencyHaltAutonomousLoopAction,
  resetAutonomousCircuitBreakerAction,
  resetCircuitBreakerAction,
  triggerAutonomousCycleAction,
  replayDeadLetterTaskAction,
  getAutonomousLoopStatusAction,
} from './loop-actions';

export interface OperationsCockpitProps {
  initialState: AutonomousLoopStateRow;
  initialTasks: AutonomousScheduleTaskRow[];
  initialRecentRuns: AutonomousCycleRunRow[];
  initialDlqTasks: AutonomousDeadLetterRow[];
  tenantId?: string;
}

export function OperationsCockpit({
  initialState,
  initialTasks,
  initialRecentRuns,
  initialDlqTasks,
  tenantId = 'default',
}: OperationsCockpitProps) {
  const t = useTranslations('autonomous');
  const [isPending, startTransition] = useTransition();

  const [state, setState] = useState<AutonomousLoopStateRow>(initialState);
  const [tasks, setTasks] = useState<AutonomousScheduleTaskRow[]>(initialTasks);
  const [recentRuns, setRecentRuns] = useState<AutonomousCycleRunRow[]>(initialRecentRuns);
  const [dlqTasks, setDlqTasks] = useState<AutonomousDeadLetterRow[]>(initialDlqTasks);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refreshData = async () => {
    startTransition(async () => {
      const res = await getAutonomousLoopStatusAction(tenantId);
      if (res.success && res.data) {
        setState(res.data.loopState);
        setTasks(res.data.tasks);
        setRecentRuns(res.data.recentRuns);
        setDlqTasks(res.data.deadLetterTasks);
      }
    });
  };

  const handleStart = () => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await startAutonomousLoopAction(tenantId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.started') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const handlePause = () => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await pauseAutonomousLoopAction('Manual pause from cockpit', tenantId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.paused') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const handleResume = () => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await resumeAutonomousLoopAction(tenantId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.resumed') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const handleForceCycle = () => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await triggerAutonomousCycleAction({ force: true, tenantId });
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.cycleCompleted') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const handleEmergencyHalt = () => {
    if (!window.confirm(t('controls.confirmHalt'))) return;
    startTransition(async () => {
      setStatusMessage(null);
      const res = await emergencyHaltAutonomousLoopAction('Emergency halt by operator', tenantId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.halted') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const handleResetCircuit = () => {
    if (!window.confirm(t('controls.confirmReset'))) return;
    startTransition(async () => {
      setStatusMessage(null);
      const res = await resetCircuitBreakerAction(tenantId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.circuitReset') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const handleReplayDlq = (id: string) => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await replayDeadLetterTaskAction(id, tenantId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.replayed') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const getStateBadge = (loopState: string) => {
    switch (loopState) {
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {t('status.running')}
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Pause className="w-3 h-3" />
            {t('status.paused')}
          </span>
        );
      case 'RECOVERING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {t('status.recovering')}
          </span>
        );
      case 'CIRCUIT_BROKEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-3 h-3" />
            {t('status.circuitBroken')}
          </span>
        );
      case 'IDLE':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ShieldCheck className="w-3 h-3" />
            {t('status.idle')}
          </span>
        );
    }
  };

  const getTaskFriendlyName = (skillName: string) => {
    switch (skillName) {
      case 'affiliate-scout':
        return t('tasks.affiliateScout');
      case 'content-producer':
        return t('tasks.contentProducer');
      case 'auto-publisher':
        return t('tasks.autoPublisher');
      default:
        return skillName;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-card border border-border rounded-xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
            {getStateBadge(state.state)}
          </div>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {state.state === 'IDLE' && (
            <button
              onClick={handleStart}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {t('controls.start')}
            </button>
          )}

          {state.state === 'RUNNING' && (
            <button
              onClick={handlePause}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              {t('controls.pause')}
            </button>
          )}

          {state.state === 'PAUSED' && (
            <button
              onClick={handleResume}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {t('controls.resume')}
            </button>
          )}

          <button
            onClick={handleForceCycle}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors disabled:opacity-50"
          >
            <Zap className="w-4 h-4 text-amber-500" />
            {t('controls.forceCycle')}
          </button>

          {state.state === 'CIRCUIT_BROKEN' && (
            <button
              onClick={handleResetCircuit}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              {t('controls.resetCircuit')}
            </button>
          )}

          <button
            onClick={handleEmergencyHalt}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
          >
            <AlertOctagon className="w-4 h-4" />
            {t('controls.emergencyHalt')}
          </button>

          <button
            onClick={refreshData}
            disabled={isPending}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            title={t('controls.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold uppercase hover:underline"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Key Telemetry Metric Cards */}
      {(() => {
        const totalTasksExecuted = tasks.reduce((sum, t) => sum + (t.run_count || 0), 0);
        const totalAttempted = recentRuns.reduce((sum, r) => sum + (r.tasks_attempted || 0), 0);
        const totalSucceeded = recentRuns.reduce((sum, r) => sum + (r.tasks_succeeded || 0), 0);
        const successRatePct = totalAttempted > 0
          ? Math.round((totalSucceeded / totalAttempted) * 100)
          : state.consecutive_failures === 0 ? 100 : Math.max(0, 100 - state.consecutive_failures * 20);

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Card 1: Active Skills */}
            <div className="p-5 bg-card border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-sm font-medium">{t('metrics.activeAgents')}</span>
                <Bot className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">{tasks.filter((t) => t.enabled).length}</div>
              <p className="text-xs text-muted-foreground">{t('status.cycleCount')}: {recentRuns.length}</p>
            </div>

            {/* Card 2: Tasks Executed */}
            <div className="p-5 bg-card border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-sm font-medium">{t('metrics.tasksExecuted')}</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">{totalTasksExecuted}</div>
              <p className="text-xs text-muted-foreground">{recentRuns.length > 0 ? `${recentRuns[0].tasks_succeeded} in latest cycle` : t('status.idle')}</p>
            </div>

            {/* Card 3: MCU Consumed */}
            <div className="p-5 bg-card border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-sm font-medium">{t('metrics.computeConsumed')}</span>
                <Cpu className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {Math.round(state.daily_mcu_consumed)} <span className="text-sm font-normal text-muted-foreground">MCU</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('metrics.costEstimate')}: ~${(state.daily_spend_cents / 100).toFixed(2)}</p>
            </div>

            {/* Card 4: Success Rate */}
            <div className="p-5 bg-card border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-sm font-medium">{t('metrics.successRate')}</span>
                <CheckCircle2 className="w-4 h-4 text-teal-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400">
                {successRatePct}%
              </div>
              <p className="text-xs text-muted-foreground">{t('status.consecutiveFailures')}: {state.consecutive_failures}</p>
            </div>

            {/* Card 5: Consciousness Score (0-100) */}
            <div className="p-5 bg-card border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-sm font-medium">{t('status.consciousness')}</span>
                <Activity className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {state.consciousness_score}/100
              </div>
              <p className="text-xs text-muted-foreground">{t('status.lastHeartbeat')}: {new Date(state.last_heartbeat_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        );
      })()}

      {/* 3. Automated Workflows & Skills Table */}
      <div className="p-6 bg-card border border-border rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            {t('tasks.title')}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">{t('tasks.name')}</th>
                <th className="px-4 py-3 font-medium">{t('tasks.schedule')}</th>
                <th className="px-4 py-3 font-medium">{t('tasks.tier')}</th>
                <th className="px-4 py-3 font-medium">{t('tasks.priority')}</th>
                <th className="px-4 py-3 font-medium">{t('tasks.nextRun')}</th>
                <th className="px-4 py-3 font-medium">{t('tasks.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-foreground">
                    <div>{getTaskFriendlyName(task.skill_name)}</div>
                    <div className="text-xs text-muted-foreground font-mono">{task.skill_name}</div>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    <span className="capitalize">{task.schedule_type}</span>
                    {task.schedule_expression && (
                      <span className="ml-1.5 font-mono text-xs text-primary">({task.schedule_expression})</span>
                    )}
                    {task.interval_seconds && (
                      <span className="ml-1.5 text-xs">({task.interval_seconds}s)</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-secondary text-secondary-foreground">
                      {task.tier_requirement}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">P{task.priority}</td>
                  <td className="px-4 py-3.5 text-muted-foreground text-xs">
                    {task.next_run_at ? new Date(task.next_run_at * 1000).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    {task.enabled ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('tasks.enabled')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        {t('tasks.disabled')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Recent Execution Cycles & DLQ Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cycles */}
        <div className="p-6 bg-card border border-border rounded-xl space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {t('runs.title')}
          </h2>

          <div className="space-y-3">
            {recentRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Chưa có chu kỳ thực thi nào / No execution cycles recorded.
              </p>
            ) : (
              recentRuns.slice(0, 5).map((run) => (
                <div
                  key={run.id}
                  className="p-3.5 rounded-lg border border-border bg-muted/20 flex items-center justify-between text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-mono font-medium text-foreground">{run.id}</div>
                    <div className="text-muted-foreground flex items-center gap-1.5">
                      <span>{run.trigger_type}</span>
                      <span>•</span>
                      <span>{run.state_before} <ArrowRight className="inline w-3 h-3" /> {run.state_after}</span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="font-semibold text-foreground">
                      {run.tasks_succeeded}/{run.tasks_attempted} {t('runs.tasksCount')}
                    </div>
                    <div className="text-muted-foreground font-mono">
                      {run.mcu_consumed} MCU • {run.duration_ms}ms
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dead-Letter Queue */}
        <div className="p-6 bg-card border border-border rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t('dlq.title')}
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {dlqTasks.length}
            </span>
          </div>

          <div className="space-y-3">
            {dlqTasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p>{t('dlq.empty')}</p>
              </div>
            ) : (
              dlqTasks.map((dlq) => (
                <div
                  key={dlq.id}
                  className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rose-700 dark:text-rose-400 font-mono">
                      {dlq.skill_name}
                    </span>
                    <button
                      onClick={() => handleReplayDlq(dlq.id)}
                      disabled={isPending}
                      className="px-2.5 py-1 rounded bg-background border border-border text-foreground hover:bg-muted font-medium transition-colors disabled:opacity-50"
                    >
                      {t('dlq.replay')}
                    </button>
                  </div>
                  <p className="text-muted-foreground line-clamp-2">{dlq.error_message}</p>
                  <div className="text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                    <span>{t('dlq.retries')}: {dlq.retry_count}/{dlq.max_retries}</span>
                    <span>{new Date(dlq.first_failed_at * 1000).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
