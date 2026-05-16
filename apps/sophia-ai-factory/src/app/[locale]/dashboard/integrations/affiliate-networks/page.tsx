/**
 * Affiliate Networks BYOK page — /dashboard/integrations/affiliate-networks
 * Users connect personal API credentials for 9 networks.
 * @module app/[locale]/dashboard/integrations/affiliate-networks/page
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import AffiliateNetworksClient from './affiliate-networks-client';
import { RouteHelpTooltip } from '@/components/help/route-help-tooltip';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function AffiliateNetworksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const jar = await cookies();
  const locale = jar.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'vi';

  return (
    <div className="relative">
      {/* Help tooltip floats top-right, independent of client component's h1 */}
      <div className="absolute top-0 right-0 z-10">
        <RouteHelpTooltip locale={locale} routeKey="affiliate-networks" />
      </div>
      <AffiliateNetworksClient />
    </div>
  );
}
