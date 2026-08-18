export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getTranslations } from 'next-intl/server';
import { CrossPlatformAnalyticsClient } from './CrossPlatformAnalyticsClient';

export default async function CrossPlatformAnalyticsPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('dashboard.analytics');

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">{t('unauthorized')}</div>;
  }

  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
    .bind(user.id)
    .first<{ org_id: string }>();

  const workspaceId = membership?.org_id ?? '';

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">{t('loading')}</div>}>
      <CrossPlatformAnalyticsClient workspaceId={workspaceId} />
    </Suspense>
  );
}