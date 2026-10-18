export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getPlaybookOverviewAction } from '@/land/playbook/actions';
import { PlaybookPage } from '@/components/stitch/screens/dashboard/playbook-page';
import { StitchWave2RouteBanner } from '@/components/stitch/screens/control-deck/stitch-wave2-route-banner';

export default async function PlaybooksDashboardPage() {
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
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <StitchWave2RouteBanner routeKey="playbooks" defaultShowCanvas={true} className="" />
      <PlaybookPage
        userId={user?.id ?? ''}
        workspaceId={workspaceId}
        initialData={initialData}
      />
    </div>
  );
}
