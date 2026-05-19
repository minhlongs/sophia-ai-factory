/**
 * Dashboard Missions Page — server gate
 *
 * Auth-gates via getCurrentUser(); renders MissionsClient for authenticated users.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import MissionsClient from './missions-client';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function MissionsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return <MissionsClient />;
}
