/**
 * /dashboard/admin/billing — admin billing overview.
 *
 * Server Component — fetches billing summary server-side.
 * Protected by requireMasterTier.
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { AdminBillingClient } from '@/forest/components/dashboard/admin-billing-client';

interface BillingSummary {
  mrr: number;
  activeLicensesCount: number;
  dunningStates: Record<string, number>;
  unbilledOverageTotal: number;
  totalRevenue30d: number;
  refundCount30d: number;
  refundTotal30d: number;
}

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Billing Admin | Sophia AI',
  description: 'Revenue metrics, overage events, and dunning management',
};

export default async function AdminBillingPage(): Promise<React.JSX.Element> {
  await requireMasterTier();

  // Fetch summary server-side for instant render
  let initialSummary;
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/admin/billing/summary`, {
      cache: 'no-store',
    });
    if (res.ok) {
      initialSummary = (await res.json()) as BillingSummary;
    }
  } catch {
    // Client will refetch
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing Admin</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Revenue overview, overage events, and dunning management for admins.
        </p>
      </div>
      <AdminBillingClient initialSummary={initialSummary} />
    </div>
  );
}
