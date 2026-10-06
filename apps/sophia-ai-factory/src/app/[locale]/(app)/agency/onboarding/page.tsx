export const dynamic = 'force-dynamic';

/**
 * Agency Client Onboarding Wizard Page
 *
 * Route: /[locale]/(app)/agency/onboarding
 *
 * Provides a 5-step guided wizard for agency owners to onboard new clients:
 * 1. Client profile & workspace slug
 * 2. White-label branding & live unbranded preview
 * 3. Sovereign custom domain & DNS CNAME setup
 * 4. Seed agent deployment under AGY safety policies
 * 5. Review & launch confirmation
 *
 * Layer: app router (Presentation & Server Component)
 *
 * @module app/[locale]/(app)/agency/onboarding/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import {
  validateOnboardingStepAction,
  submitAgencyOnboardingAction,
} from '@/land/agency/agency-portal-actions';
import { AgencyOnboardingWizard } from '@/forest/agency';

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const isVi = resolved.locale === 'vi';

  return {
    title: isVi
      ? 'Khởi Tạo Khách Hàng Doanh Nghiệp — Sophia AI Factory'
      : 'Onboard New Agency Client — Sophia AI Factory',
    description: isVi
      ? 'Thiết lập không gian làm việc thương hiệu riêng, tên miền tùy chỉnh và trợ lý AI tự động.'
      : 'Set up an isolated client workspace with white-label branding, custom domain, and autonomous seed agents.',
  };
}

export default async function AgencyOnboardingPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=/agency/onboarding`);
  }

  const db = await getD1();
  const orgId = (await resolveOrgId(user.id, db)) || user.id;

  return (
    <main className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto mb-8 text-center space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          {locale === 'vi'
            ? 'Khởi Tạo Khách Hàng Doanh Nghiệp'
            : 'Agency Client Onboarding'}
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          {locale === 'vi'
            ? 'Thiết lập không gian làm việc thương hiệu riêng, tên miền tùy chỉnh và trợ lý AI tự động cho khách hàng.'
            : 'Provision sovereign client workspaces with white-label branding, custom domain mapping, and autonomous seed agents.'}
        </p>
      </div>

      <AgencyOnboardingWizard
        agencyOrgId={orgId}
        locale={locale}
        actions={{
          validateStep: validateOnboardingStepAction,
          submitOnboarding: submitAgencyOnboardingAction,
        }}
      />
    </main>
  );
}
