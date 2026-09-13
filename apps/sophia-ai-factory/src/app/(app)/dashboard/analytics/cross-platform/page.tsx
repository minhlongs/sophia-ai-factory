export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { getTranslations } from 'next-intl/server';
import { CrossPlatformAnalyticsClient } from './CrossPlatformAnalyticsClient';

export default async function CrossPlatformAnalyticsPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('dashboard.analytics');

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">{t('unauthorized')}</div>;
  }

  const workspaceId = (await resolveOrgId(user.id)) ?? '';

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">{t('loading')}</div>}>
      <CrossPlatformAnalyticsClient workspaceId={workspaceId} />
    </Suspense>
  );
}