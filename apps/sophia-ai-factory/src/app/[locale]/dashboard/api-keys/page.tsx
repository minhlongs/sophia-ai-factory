/**
 * Dashboard API Keys Page — server gate
 *
 * Auth-gates via getCurrentUser(); renders ApiKeysClient for authenticated users.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import ApiKeysClient from './api-keys-client';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ApiKeysPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return <ApiKeysClient />;
}
