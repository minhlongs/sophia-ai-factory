export const dynamic = 'force-dynamic';

/**
 * Autonomous Operations Cockpit Route (Admin Group)
 *
 * Route: /[locale]/(admin)/admin/autonomous
 * (and /vi/admin/autonomous, /en/admin/autonomous)
 *
 * Layer: land (Next.js App Router Page)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module app/[locale]/(admin)/admin/autonomous/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getAutonomousLoopStatusAction } from '@/land/autonomous/loop-actions';
import { OperationsCockpit } from '@/land/autonomous/operations-cockpit';

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
      ? 'Khoang Điều Khiển Tự Động Hoá (CHÚA CHÙM Swarm) — Sophia Admin'
      : 'Autonomous Operations Cockpit (CHÚA CHÙM Swarm) — Sophia Admin',
    description: isVi
      ? 'Hệ thống điều khiển vòng lặp tự chủ AGI 24/7, lập lịch heartbeat và giám sát biệt đội tác nhân.'
      : '24/7 Autonomous AGI Loop Control, heartbeat scheduler, and agent swarm supervisor.',
  };
}

export default async function AdminAutonomousPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=/admin/autonomous`);
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    redirect(`/${locale}/dashboard?error=admin_required`);
  }

  const res = await getAutonomousLoopStatusAction('default');

  const initialState = res.data?.loopState ?? {
    id: 'singleton_default',
    tenant_id: 'default',
    state: 'IDLE',
    current_cycle_id: null,
    consecutive_failures: 0,
    last_error: null,
    consciousness_score: 100,
    daily_mcu_consumed: 0,
    monthly_mcu_consumed: 0,
    daily_spend_cents: 0,
    monthly_spend_cents: 0,
    last_heartbeat_at: Math.floor(Date.now() / 1000),
    version: 1,
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
  };

  const initialTasks = res.data?.tasks ?? [];
  const initialRecentRuns = res.data?.recentRuns ?? [];
  const initialDlqTasks = res.data?.deadLetterTasks ?? [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <OperationsCockpit
        initialState={initialState}
        initialTasks={initialTasks}
        initialRecentRuns={initialRecentRuns}
        initialDlqTasks={initialDlqTasks}
        tenantId="default"
      />
    </div>
  );
}
