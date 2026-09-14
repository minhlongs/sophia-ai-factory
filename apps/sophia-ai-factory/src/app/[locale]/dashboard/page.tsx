export const dynamic = 'force-dynamic';

import DashboardPage from '@/components/stitch/screens/dashboard/dashboard-page';
import { fetchCurrentUserDashboard } from '@/forest/dashboard/metrics';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyUserReadiness } from '@/tree/readiness/readiness-checker';

export default async function DashboardRoute() {
  const user = await getCurrentUser();
  const initialData = user ? await fetchCurrentUserDashboard() : { ok: false, error: 'Unauthenticated' } as const;

  let readiness = null;
  if (user) {
    try {
      readiness = await verifyUserReadiness({
        userId: user.id,
        userEmail: user.email,
        emailVerified: (user as { emailVerified?: boolean }).emailVerified,
      });
    } catch {
      // Graceful fallback if readiness check encounters issues
      readiness = null;
    }
  }

  return (
    <DashboardPage
      initialData={initialData.ok ? initialData.data : undefined}
      readiness={readiness}
    />
  );
}
