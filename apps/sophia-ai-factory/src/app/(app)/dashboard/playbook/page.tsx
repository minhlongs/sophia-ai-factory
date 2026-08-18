export const dynamic = 'force-dynamic';

import { PlaybookClient } from '@/components/stitch/screens/dashboard/playbook-page';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

export default async function PlaybookDashboardRoute() {
  const user = await getCurrentUser();
  return <PlaybookClient userId={user?.id ?? ''} />;
}