export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getTranslations } from 'next-intl/server';
import { IpGraphClient } from '@/components/stitch/screens/ip/ip-graph-client';

export default async function IpGraphPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('dashboard.ip');

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">{t('unauthorized')}</div>;
  }

  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
    .bind(user.id)
    .first<{ org_id: string }>();

  const workspaceId = membership?.org_id ?? '';

  return <IpGraphClient workspaceId={workspaceId} />;
}