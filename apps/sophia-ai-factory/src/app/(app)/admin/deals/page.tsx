export const dynamic = 'force-dynamic';

/**
 * Bare Admin Enterprise Deals Route
 *
 * Route: /admin/deals
 *
 * @module app/(app)/admin/deals/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { getD1 } from '@/seed/db/client';
import { DealsAdminDashboard } from '@/forest/deals/deals-admin-dashboard';
import {
  queryEnterpriseDeals,
  getDealsPipelineMetrics,
} from '@/tree/sales/enterprise-deal-repo';
import type { EnterpriseDeal } from '@/seed/types/enterprise-deal';

export const metadata: Metadata = {
  title: 'Enterprise Deals & B2B Pipeline — Sophia Admin',
  description: 'Autonomous Enterprise Sales Pipeline, B2B Lead Enrichment & AI Sales Fleet',
};

export default async function BareAdminDealsPage() {
  const db = await getD1();
  let initialDeals: EnterpriseDeal[] = [];
  let initialMetrics: {
    totalDeals: number;
    hotDeals: number;
    warmDeals: number;
    coldDeals: number;
    totalEstimatedValueCents: number;
    avgBantScore: number;
    wonDeals: number;
  } | undefined = undefined;

  if (db) {
    try {
      const dealsRes = await queryEnterpriseDeals(db, { limit: 50 });
      initialDeals = dealsRes.deals;
    } catch {
      initialDeals = [];
    }

    try {
      initialMetrics = await getDealsPipelineMetrics(db);
    } catch {
      initialMetrics = undefined;
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 md:px-8">
      <DealsAdminDashboard
        initialDeals={initialDeals}
        initialMetrics={initialMetrics}
        locale="en"
      />
    </main>
  );
}
