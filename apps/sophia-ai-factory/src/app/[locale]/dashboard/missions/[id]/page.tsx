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
import { buildVerifiedMissionWorkflowView } from '@/tree/mission/workflow-view-model';
import { CreativeAssemblyLine } from '@/components/workflow-anatomy/creative-assembly-line';
import { MissionReviewPanel } from '@/components/mission-review-panel';
import {
  MISSION_BADGE_CLASSES,
  formatMoney,
  formatDate,
  MissionAgentRunsSection,
} from './mission-runs-section';

interface MissionDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
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

  const result = await getMission({ missionId });
  const mission = result.ok ? result.value.mission : null;
  if (!mission) notFound();

  const runsResult = await listAgentRunsForMission(missionId, mission.workspaceId, 10);
  const runs = runsResult.ok ? runsResult.value : [];
  const workflowView = buildVerifiedMissionWorkflowView({
    missionId: mission.id,
    status: mission.status,
    spentCents: mission.spentCents,
    runs,
  });

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
          className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${MISSION_BADGE_CLASSES[mission.status] ?? MISSION_BADGE_CLASSES.draft}`}
        >
          {t(`statuses.${mission.status}`)}
        </span>
      </div>

      {mission.status === 'review' && (
        <div className="mt-5">
          <MissionReviewPanel missionId={mission.id} />
        </div>
      )}

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <CreativeAssemblyLine workflow={workflowView} />
      </section>

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

      <MissionAgentRunsSection runs={runs} localeTag={localeTag} t={(k) => t(k)} />
    </div>
  );
}
