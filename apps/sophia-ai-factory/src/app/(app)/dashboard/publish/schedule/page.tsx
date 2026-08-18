export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getTranslations } from 'next-intl/server';
import { ScheduleManagementClient } from './ScheduleManagementClient';

export default async function ScheduleManagementPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('dashboard.publish');

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">{t('unauthorized')}</div>;
  }

  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
    .bind(user.id)
    .first<{ org_id: string }>();

  const workspaceId = membership?.org_id ?? '';

  const scheduled = workspaceId
    ? await d1
        .prepare(
          `SELECT pj.id, pj.video_id AS videoId, pj.channel_id AS target,
                  pj.provider, pj.status, pj.caption, pj.scheduled_at AS scheduledAt,
                  pj.created_at AS createdAt, pj.retry_count AS retryCount
           FROM publishing_jobs pj
           WHERE pj.tenant_id = ?1 AND pj.status = 'scheduled'
           ORDER BY pj.scheduled_at ASC`,
        )
        .bind(workspaceId)
        .all<{
          id: string;
          videoId: string;
          target: string;
          provider: string;
          status: string;
          caption: string | null;
          scheduledAt: number;
          createdAt: number;
          retryCount: number;
        }>()
    : { results: [] };

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">{t('loading')}</div>}>
      <ScheduleManagementClient
        workspaceId={workspaceId}
        initialJobs={scheduled.results ?? []}
      />
    </Suspense>
  );
}