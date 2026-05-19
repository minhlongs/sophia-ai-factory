/**
 * Dashboard Proposals Page — server gate
 *
 * Auth-gates via getCurrentUser(); renders ProposalsClient for authenticated users.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import ProposalsClient from './proposals-client';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProposalsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return <ProposalsClient />;
}
