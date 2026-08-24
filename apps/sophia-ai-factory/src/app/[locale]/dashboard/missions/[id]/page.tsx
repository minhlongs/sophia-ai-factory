/**
 * Mission detail page — brief, goals, latest agent runs (status/output/cost/
 * tokens), and the human review decision panel when the mission is in
 * 'review'. Access flows through getMission (membership + creator-or-admin);
 * any failure renders 404 so no cross-tenant data leaks.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { getMission } from '@/land/creative-mission/actions';
import { listAgentRunsForMission } from '@/tree/mission/agent-run-repo';
import { MissionReviewPanel } from '@/components/mission-review-panel';

interface MissionDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

// Presentation-only badge colors keyed by status string. Mission and run
// status enums share this lookup safely (badge pattern from ApprovalQueue).
const BADGE_CLASSES: Record<string, string> = {
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

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(ts: number | undefined, localeTag: string): string {
  return ts
    ? new Date(ts * 1000).toLocaleDateString(localeTag, { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';
}

// Output artifacts can be arbitrarily large JSON — preview only.
function outputPreview(output: Record<string, unknown> | undefined, max = 300): string | null {
  if (!output || Object.keys(output).length === 0) return null;
  const s = JSON.stringify(output);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('missionConsole');
  return { title: t('pageTitle'), description: t('pageDescription') };
}

export default async function MissionDetailPage({ params }: MissionDetailPageProps) {
  const { locale, id: missionId } = await params;
  const t = await getTranslations('missionConsole');
  const localeTag = locale === 'vi' ? 'vi-VN' : 'en-US';

  const user = await getCurrentUser();
  if (!user) notFound();

  // Membership + creator-or-admin enforced inside the land action.
  const result = await getMission({ missionId });
  const mission = result.ok ? result.value.mission : null;
  if (!mission) notFound();

  const runsResult = await listAgentRunsForMission(missionId, mission.workspaceId, 10);
  const runs = runsResult.ok ? runsResult.value : [];

  const briefRows: Array<[string, string]> = [
    [t('brief.objective'), mission.objective],
    [t('brief.audience'), mission.audience],
    [t('brief.geography'), mission.geography],
    [
      t('brief.timeframe'),
      `${formatDate(mission.timeframeStart, localeTag)} – ${formatDate(mission.timeframeEnd, localeTag)}`,
    ],
    [t('brief.budget'), formatMoney(mission.budgetCents)],
    [t('brief.spent'), formatMoney(mission.spentCents)],
    [t('brief.autonomyLevel'), `${mission.autonomyLevel}/4`],
    [t('brief.channels'), mission.channels.length > 0 ? mission.channels.join(', ') : t('brief.none')],
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
      <Link
        href="/dashboard/missions"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-foreground">{mission.title}</h1>
        <span
          className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_CLASSES[mission.status] ?? BADGE_CLASSES.draft}`}
        >
          {t(`statuses.${mission.status}`)}
        </span>
      </div>

      {mission.status === 'review' && (
        <div className="mt-5">
          <MissionReviewPanel missionId={mission.id} />
        </div>
      )}

      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {briefRows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">{t('brief.goals')}</h2>
        {mission.goals.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('brief.goalsEmpty')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {mission.goals.map((goal) => (
              <li
                key={goal.id}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-foreground">{goal.description}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {goal.targetMetric}: {goal.currentValue}/{goal.targetValue}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
                  <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_CLASSES[run.status]}`}>
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
    </div>
  );
}
