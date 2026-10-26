export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { loadUserCampaigns } from '@/land/campaigns';
import CampaignsPage from '@/components/stitch/screens/campaigns/campaigns-page';

export default async function DashboardCampaignsRoute() {
  const user = await getCurrentUser();
  const campaigns = user ? await loadUserCampaigns(user.id) : [];

  return <CampaignsPage initialCampaigns={campaigns} totalCampaigns={campaigns.length} />;
}
