/**
 * Affiliate Networks BYOK page — /dashboard/integrations/affiliate-networks
 * Users connect personal API credentials for 9 networks.
 * @module app/[locale]/dashboard/integrations/affiliate-networks/page
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import AffiliateNetworksClient from './affiliate-networks-client';

export const dynamic = 'force-dynamic';

export default async function AffiliateNetworksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  return <AffiliateNetworksClient />;
}
