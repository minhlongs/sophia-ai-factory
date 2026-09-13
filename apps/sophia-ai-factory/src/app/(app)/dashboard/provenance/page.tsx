export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { getTranslations } from 'next-intl/server';
import { ProvenanceChainClient } from '@/components/stitch/screens/provenance/provenance-chain-client';

export default async function ProvenancePage() {
  const user = await getCurrentUser();
  const t = await getTranslations('dashboard.provenance');

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">{t('unauthorized')}</div>;
  }

  const workspaceId = (await resolveOrgId(user.id)) ?? '';

  return <ProvenanceChainClient workspaceId={workspaceId} />;
}