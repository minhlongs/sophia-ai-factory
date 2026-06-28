/**
 * /dashboard/handover — user-facing handover status page.
 *
 * Shows the current user's onboarding progress.
 * No admin gate — any authenticated user can view their own handover.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { HandoverClient } from '@/forest/components/dashboard/handover-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Handover | Sophia AI',
  description: 'Your onboarding and handover progress',
};

export default async function HandoverPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <HandoverClient />
    </div>
  );
}
