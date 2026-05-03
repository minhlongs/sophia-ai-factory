/**
 * /dashboard/sops/[id]/runs/[runId] — SOP run detail with mission timeline.
 *
 * Server Component: fetches run + verifies ownership.
 * SopRunTimeline (client) polls for live updates.
 */

import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getInstallation } from '@/lib/sop/sop-repo';
import { SopRunTimeline } from '@/components/sop/sop-run-timeline';
import { RunStatusBadge } from '@/components/sop/run-status-badge';
import { ArrowLeft } from 'lucide-react';
import type { SopRunRow } from '@/lib/sop/sop-types';

interface Props {
  params: Promise<{ id: string; runId: string; locale: string }>;
}

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

export default async function RunDetailPage({ params }: Props) {
  const { id, runId, locale } = await params;
  const t = await getTranslations('sop.run');

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const db = getD1();
  if (!db) notFound();

  const run = await db
    .prepare(`SELECT * FROM sop_runs WHERE id = ?1 LIMIT 1`)
    .bind(runId)
    .first<SopRunRow>();

  if (!run) notFound();

  // Ownership via installation
  const inst = await getInstallation(db, run.installation_id);
  if (!inst || inst.user_id !== user.id) notFound();

  // Parse missionIds
  let missionIds: string[] = [];
  try { missionIds = JSON.parse(run.mission_ids) as string[]; } catch { /* empty */ }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href={`/dashboard/sops/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('backToRuns')}
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <RunStatusBadge status={run.status} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{t('trigger')}</p>
          <p className="text-foreground capitalize">{run.trigger_type}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{t('missions')}</p>
          <p className="text-foreground">{missionIds.length}</p>
        </div>
      </div>

      <SopRunTimeline initialRun={{ ...run, missionIds }} />
    </div>
  );
}
