// i18n-namespace: missionConsole
import React from 'react';
import type { AgentRunRecord } from '@/tree/mission/agent-run-repo';

export const MISSION_BADGE_CLASSES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  queued: 'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground',
  planned: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  approval_required: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  awaiting_approval: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  running: 'bg-primary/10 text-primary',
  paused: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  review: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  learning: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  iterating: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  failed: 'bg-destructive/10 text-destructive',
};

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(ts: number | undefined, localeTag: string): string {
  return ts
    ? new Date(ts * 1000).toLocaleDateString(localeTag, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';
}

function outputPreview(output: Record<string, unknown> | undefined, max = 300): string | null {
  if (!output || Object.keys(output).length === 0) return null;
  const s = JSON.stringify(output);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function MissionAgentRunsSection({
  runs,
  localeTag,
  t,
}: {
  runs: AgentRunRecord[];
  localeTag: string;
  t: (key: string) => string;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold text-foreground">{t('runs.title')}</h2>
      {runs.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t('runs.empty')}</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {runs.map((run) => (
            <li key={run.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <span className="font-medium text-foreground">
                  {t('runs.agent')}: {run.agentId}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">#{run.phase}</span>
                </span>
                <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${MISSION_BADGE_CLASSES[run.status]}`}>
                  {t(`runs.statuses.${run.status}`)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <span>{`${t('runs.cost')}: ${formatMoney(run.totalCostCents)}`}</span>
                <span>{`${t('runs.tokens')}: ${run.totalTokens.toLocaleString(localeTag)}`}</span>
                <span>{`${t('runs.started')}: ${formatDate(run.startedAt, localeTag)}`}</span>
                <span>{`${t('runs.ended')}: ${formatDate(run.endedAt, localeTag)}`}</span>
              </div>
              {outputPreview(run.outputJson) && (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2.5 text-xs text-foreground">
                  {`${t('runs.output')}: ${outputPreview(run.outputJson)}`}
                </pre>
              )}
              {run.status === 'failed' && run.errorMessage && (
                <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                  {t('runs.error')}: {run.errorMessage}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
