/**
 * Authenticated Compliance Publish Gate Page (MOCK_ONLY).
 *
 * Fail-closed behind `FEATURE_B2_COMPLIANCE_PUBLISH_GATE === 'true'`.
 * Bilingual EN/VI UI for preflight capability inspection, explicit human approval,
 * and deterministic mock execution receipt verification.
 *
 * @module app/[locale]/dashboard/publish-gate/page
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Link } from '@/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { isB2CompliancePublishGateEnabled } from '@/seed/config/flags';
import { getD1 } from '@/seed/db/client';
import { ensureCustomerOrg } from '@/tree/handover/handover-account-setup';
import { PublishGateClient } from '@/components/publish-gate/publish-gate-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publishGate');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function PublishGateDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations('publishGate');

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  if (!isB2CompliancePublishGateEnabled()) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-8 pb-24 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('backToDashboard')}
        </Link>
        <section className="rounded-xl border border-border bg-card p-6 text-card-foreground">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" aria-hidden="true" />
            <div className="flex flex-col gap-1.5">
              <h1 className="text-lg font-semibold text-foreground">{t('disabledTitle')}</h1>
              <p className="text-sm text-muted-foreground">{t('disabledDescription')}</p>
            </div>
          </div>
        </section>
      </main>
    );
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
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-8 pb-40 sm:px-6">
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

      <PublishGateClient orgId={orgId} />
    </main>
  );
}
