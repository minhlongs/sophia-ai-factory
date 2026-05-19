/**
 * Dashboard Workflows Page — server gate
 *
 * Auth-gates via getCurrentUser(); renders WorkflowsClient for authenticated users.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import WorkflowsClient from './workflows-client';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function WorkflowsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return <WorkflowsClient />;
}
