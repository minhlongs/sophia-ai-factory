/**
 * Campaign Dashboard Page
 *
 * Server component that renders the Campaign Dashboard.
 * This page shows analytics and performance metrics for user's campaigns.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import CampaignDashboardPage from '@/components/stitch/screens/campaigns/campaign-dashboard-page';

export const dynamic = 'force-dynamic';

export default async function CampaignDashboardRoutePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return <CampaignDashboardPage />;
}
