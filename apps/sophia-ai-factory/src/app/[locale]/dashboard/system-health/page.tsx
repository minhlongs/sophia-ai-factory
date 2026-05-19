/**
 * Dashboard System Health Page — server gate
 *
 * Auth-gates via getCurrentUser(); renders SystemHealthClient for authenticated users.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import SystemHealthClient from './system-health-client';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function SystemHealthPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return <SystemHealthClient />;
}
