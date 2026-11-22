/**
 * Authenticated BASIC First-Value Journey Page (Track B1.1).
 *
 * Minimal Material 3 dashboard surface enabling a user to complete the durable,
 * simulated BASIC first-value journey end-to-end through HTTP without dev tools.
 *
 * @module app/[locale]/dashboard/first-value/page
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { ensureCustomerOrg } from '@/tree/handover/handover-account-setup';
import { FirstValueJourneyClient } from '@/components/first-value/first-value-journey-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('firstValue');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function FirstValueDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations('firstValue');

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const d1 = await getD1();
  let orgId = '';
  if (d1) {
    orgId = (await resolveOrgId(user.id, d1)) || '';
    if (!orgId) {
      try {
        orgId = await ensureCustomerOrg(d1, user.id, user.email || user.id);
      } catch {
        orgId = (await resolveOrgId(user.id, d1)) || '';
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('backToDashboard')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <FirstValueJourneyClient orgId={orgId} />
    </main>
  );
}
