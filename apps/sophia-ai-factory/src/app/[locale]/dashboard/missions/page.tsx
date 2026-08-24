/**
 * Missions list page — creative missions across every workspace the
 * authenticated user belongs to. Data flows exclusively through the
 * membership-checked land action (listMissions); a workspace whose query
 * fails is skipped and logged, never rendered cross-tenant.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getTranslations } from 'next-intl/server';
import { logger } from '@/seed/utils/logger-utility';
import { Link } from '@/navigation';
import { listMissions } from '@/land/creative-mission/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('missionConsole');
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

// Presentation-only status chip colors (badge pattern from ApprovalQueue).
const STATUS_BADGE_CLASSES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  planned: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  approval_required: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  running: 'bg-primary/10 text-primary',
  paused: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  review: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  learning: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  iterating: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
};

type MissionRow = { id: string; title: string; status: string };

export default async function MissionsPage() {
  const t = await getTranslations('missionConsole');

  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  const d1 = await getD1();
  if (!d1) {
    notFound();
  }

  // All workspaces this user belongs to.
  const memberships = await d1
    .prepare('SELECT org_id FROM org_members WHERE user_id = ?')
    .bind(user.id)
    .all<{ org_id: string }>();

  const workspaceIds = (memberships.results ?? []).map((m) => m.org_id);

  if (workspaceIds.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageDescription')}</p>
        <div className="mt-6 rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('noWorkspace')}</p>
        </div>
      </div>
    );
  }

  // Per-workspace aggregation: one failed workspace is skipped and logged —
  // partial data never crosses tenant boundaries.
  const perWorkspace = await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      const result = await listMissions({ workspaceId });
      if (!result.ok) {
        logger.warn('[MissionConsole] listMissions failed for workspace, skipping', {
          code: result.error.code,
        });
        return [] as MissionRow[];
      }
      return result.value.missions;
    })
  );
  const missions = perWorkspace.flat();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('pageDescription')}</p>

      {missions.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold text-foreground">{t('emptyTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyDescription')}</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {missions.map((mission) => (
            <li key={mission.id}>
              <Link
                href={`/dashboard/missions/${mission.id}`}
                className="block rounded-lg border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{mission.title}</p>
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_BADGE_CLASSES[mission.status] ?? STATUS_BADGE_CLASSES.draft
                      }`}
                    >
                      {t(`statuses.${mission.status}`)}
                    </span>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary">
                    {t('viewDetails')}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
