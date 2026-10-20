export const dynamic = 'force-dynamic';

/**
 * Admin Affiliate Payout Approval Route
 *
 * Route: /[locale]/admin/affiliate-payouts
 * (e.g. /en/admin/affiliate-payouts, /vi/admin/affiliate-payouts)
 *
 * Server component gate: requires an authenticated admin, then loads the
 * payouts awaiting approval. The decision UI lives in a client component
 * because approve/reject is a mutation.
 *
 * Bilingual content is resolved from `locale` rather than translation keys,
 * matching the other admin routes in this directory.
 *
 * Layer: land (Next.js App Router Page)
 *
 * @module app/[locale]/admin/affiliate-payouts/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getD1 } from '@/seed/db/client';
import { listPendingApprovalPayouts, type PayoutListRow } from '@/app/api/admin/affiliate-payouts/route-helpers';
import { AffiliatePayoutsClient } from './affiliate-payouts-client';

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return {
    title: isVi
      ? 'Duyệt Chi Trả Hoa Hồng — Sophia Admin'
      : 'Approve Affiliate Payouts — Sophia Admin',
    description: isVi
      ? 'Duyệt hoặc từ chối các khoản chi trả hoa hồng vượt ngưỡng tự động $500.'
      : 'Approve or reject affiliate payouts above the $500 auto-approve ceiling.',
  };
}

export default async function AdminAffiliatePayoutsPage({ params }: PageProps) {
  const { locale } = await params;
  const activeLocale = locale === 'vi' ? 'vi' : 'en';

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${activeLocale}/login?redirect=/admin/affiliate-payouts`);
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    redirect(`/${activeLocale}/dashboard?error=admin_required`);
  }

  let payouts: PayoutListRow[] = [];
  let loadError: string | null = null;

  try {
    const db = await getD1();
    if (db) {
      payouts = await listPendingApprovalPayouts(db, 200);
    }
  } catch (err) {
    loadError = String(err);
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 md:px-8">
      <AffiliatePayoutsClient
        initialPayouts={payouts}
        locale={activeLocale}
        loadError={loadError}
        adminId={user.id}
      />
    </main>
  );
}
