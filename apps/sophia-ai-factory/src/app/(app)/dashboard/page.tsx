export const dynamic = 'force-dynamic';

import DashboardPage from '@/components/stitch/screens/dashboard/dashboard-page';
import { fetchCurrentUserDashboard } from '@/forest/dashboard/metrics';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

export default async function DashboardRoute() {
  const user = await getCurrentUser();
  const initialData = user ? await fetchCurrentUserDashboard() : { ok: false, error: 'Unauthenticated' } as const;

  return <DashboardPage initialData={initialData.ok ? initialData.data : undefined} />;
}
