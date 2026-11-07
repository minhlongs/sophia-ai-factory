export const dynamic = 'force-dynamic';

import { NicheStudioView } from '@/components/niche-studio/niche-studio-view';

interface DashboardNicheStudioRouteProps {
  searchParams?: Promise<{ offerId?: string; campaignId?: string }>;
}

export default async function DashboardNicheStudioRoute({
  searchParams,
}: DashboardNicheStudioRouteProps = {}) {
  const params = searchParams ? await searchParams : undefined;
  const adoptedContext =
    params?.offerId && params?.campaignId
      ? { offerId: params.offerId, campaignId: params.campaignId }
      : undefined;
  return <NicheStudioView adoptedContext={adoptedContext} />;
}
