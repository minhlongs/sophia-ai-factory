import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { fetchPartnerLedgerDataAction } from '@/forest/actions/affiliate-partner-actions';
import { AffiliatePortalView } from '@/components/affiliates/portal/affiliate-portal-view';

export const dynamic = 'force-dynamic';

export default async function AffiliatePortalPage() {
  const user = await getCurrentUser().catch(() => null);
  const data = await fetchPartnerLedgerDataAction(user?.id);

  const fallbackKpi = {
    availablePayoutCents: 12500,
    availablePayoutVnd: 3181250,
    pendingHoldCents: 4500,
    nextHoldReleaseDays: 6,
    totalSettledCents: 32000,
    totalClicks: 1420,
    totalReferrals: 38,
    conversionRatePct: 2.7,
    partnerCode: 'SOPHIA_VIP_88',
    commissionRatePct: 20.0,
    defaultRail: 'VIETQR' as const,
    maskedDestination: '••••••••5678 (MBBank)',
  };

  const kpi = data.kpi || fallbackKpi;
  const items = data.items || [];
  const partnerId = user?.id || 'partner_demo';

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Affiliate Partner Portal
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor referral performance, manage 14-day hold releases, and withdraw earnings.
          </p>
        </div>
      </div>

      <AffiliatePortalView
        partnerId={partnerId}
        initialKpi={kpi}
        initialItems={items}
      />
    </div>
  );
}
