/**
 * /dashboard/admin/payouts — payout queue management.
 *
 * Server Component — fetches queue from API server-side.
 * Protected by requireMasterTier.
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { PayoutsClient } from '@/forest/components/dashboard/payouts-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payouts | Sophia AI',
  description: 'Manage user payout queue — mark payouts as paid',
};

export default async function PayoutsPage(): Promise<React.JSX.Element> {
  await requireMasterTier();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          User payout queue — process withdrawals above the minimum threshold.
        </p>
      </div>
      <PayoutsClient />
    </div>
  );
}
