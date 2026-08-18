export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getTranslations } from 'next-intl/server';
import { RepurposeWorkflowClient } from './RepurposeWorkflowClient';

export default async function RepurposeWorkflowPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('dashboard.repurpose');

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">{t('unauthorized')}</div>;
  }

  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
    .bind(user.id)
    .first<{ org_id: string }>();

  const workspaceId = membership?.org_id ?? '';

  const jobs = workspaceId
    ? await d1
        .prepare(
          `SELECT id, source_video_id AS sourceVideoId, user_id AS userId,
                  status, created_at AS createdAt, updated_at AS updatedAt
           FROM repurpose_jobs
           WHERE user_id = ?1
           ORDER BY created_at DESC`,
        )
        .bind(user.id)
        .all<{
          id: string;
          sourceVideoId: string;
          userId: string;
          status: string;
          createdAt: number;
          updatedAt: number;
        }>()
    : { results: [] };

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">{t('loading')}</div>}>
      <RepurposeWorkflowClient jobs={jobs.results ?? []} userId={user.id} />
    </Suspense>
  );
}