/**
 * New Mission Page — First-Run Experience & Guided Video Generation.
 * Provides a streamlined creation path for non-technical CEOs with zero dead-ends.
 *
 * @module app/dashboard/missions/new
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { ensureCustomerOrg } from '@/tree/handover/handover-account-setup';
import { FirstRunWizard } from '@/components/missions/first-run-wizard';
import { Link } from '@/navigation';
import { ArrowLeft } from 'lucide-react';

import { getBlueprintById } from '@/forest/marketplace/blueprint-service';
import { getBalance } from '@/tree/mcu/credits-repo';
import { getUserTier } from '@/seed/db/get-user-tier';
import type { MarketplaceBlueprintItem } from '@/seed/types/creator-marketplace';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ blueprintId?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.missions.wizard');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function NewMissionPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const blueprintId = sp.blueprintId;
  const t = await getTranslations('dashboard.missions.wizard');

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const d1 = await getD1();
  let workspaceId = '';

  if (d1) {
    // Find workspace or auto-provision default workspace to prevent vacuum dead-ends
    workspaceId = (await resolveOrgId(user.id, d1)) || '';
    if (!workspaceId) {
      workspaceId = await ensureCustomerOrg(d1, user.id, user.email || user.id);
    }
  }

  let initialBlueprint: MarketplaceBlueprintItem | null = null;
  if (blueprintId && d1) {
    initialBlueprint = await getBlueprintById(d1, blueprintId);
  }

  const userBalance = await getBalance(user.id).catch(() => ({ credits_remaining: 0 }));
  const userTier = await getUserTier(user.id).catch(() => 'BASIC');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
      {/* Back to Missions List */}
      <div className="mb-6">
        <Link
          href="/dashboard/missions"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('backToMissions')}
        </Link>
      </div>

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {t('pageTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('pageSubtitle')}
        </p>
      </div>

      {/* First Run Wizard Component */}
      <FirstRunWizard
        workspaceId={workspaceId}
        userId={user.id}
        locale={locale as 'vi' | 'en'}
        initialBlueprint={initialBlueprint}
        initialMcuBalance={userBalance.credits_remaining}
        userTier={userTier}
      />
    </div>
  );
}
