export const dynamic = 'force-dynamic';

/**
 * Operator Handover Console Route
 * Layer: app router (Next.js App Router; can import from all layers)
 *
 * Route: /admin/handover
 * Loads all customer handovers, summary statistics, and provides verification controls.
 *
 * @module app/(app)/admin/handover/page
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { getD1 } from '@/seed/db/client';
import type { CustomerHandoverRecord } from '@/seed/handover/handover-types';
import {
  listAllCustomerHandovers,
  getHandoverStats,
} from '@/tree/handover/customer-handover-service';
import {
  triggerHandoverVerificationAction,
  exportSanitizedEnvAction,
} from '@/land/actions/handover-actions';
import { HandoverAdminConsoleClient } from '@/forest/components/handover/handover-admin-console-client';

export default async function AdminHandoverPageRoute() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?redirect=/admin/handover');
  }

  const isAdmin = await isUserAdmin(user);
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const db = await getD1();
  let handovers: CustomerHandoverRecord[] = [];
  let stats = {
    total: 0,
    pending: 0,
    active: 0,
    accepted: 0,
    rejected: 0,
  };

  if (db) {
    handovers = await listAllCustomerHandovers(db);
    stats = await getHandoverStats(db);
  }

  return (
    <HandoverAdminConsoleClient
      handovers={handovers}
      initialStats={stats}
      onVerifyAction={triggerHandoverVerificationAction}
      onExportEnvAction={exportSanitizedEnvAction}
    />
  );
}
