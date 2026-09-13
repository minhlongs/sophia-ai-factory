export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { getTranslations } from 'next-intl/server';
import { IpGraphClient } from '@/components/stitch/screens/ip/ip-graph-client';

export default async function IpGraphPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('dashboard.ip');

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">{t('unauthorized')}</div>;
  }

  const workspaceId = (await resolveOrgId(user.id)) ?? '';

  return <IpGraphClient workspaceId={workspaceId} />;
}