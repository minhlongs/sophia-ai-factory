export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getPlaybookOverviewAction } from '@/land/playbook/actions';
import { PlaybookPage } from '@/components/stitch/screens/dashboard/playbook-page';

export default async function PlaybookDashboardPage() {
  const user = await getCurrentUser();
  const workspaceId = user?.id ?? '';
  let initialData = null;

  if (workspaceId) {
    const res = await getPlaybookOverviewAction(workspaceId);
    if (res.success && res.data) {
      initialData = res.data;
    }
  }

  return (
    <PlaybookPage
      userId={user?.id ?? ''}
      workspaceId={workspaceId}
      initialData={initialData}
    />
  );
}
