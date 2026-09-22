export const dynamic = 'force-dynamic';

/**
 * Bare Admin Unit Economics Route
 *
 * Route: /admin/unit-economics
 *
 * @module app/(app)/admin/unit-economics/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { getUnitEconomicsSummary } from '@/land/economics/unit-economics-service';
import { UnitEconomicsDashboard } from '@/forest/economics/unit-economics-dashboard';

export const metadata: Metadata = {
  title: 'Unit Economics & Gross Margin — Sophia Admin',
  description: 'Real-time Gross Margin %, video COGS, LTV:CAC ratio and multimodal AI cost arbitrage',
};

export default async function BareAdminUnitEconomicsPage() {
  const summary = await getUnitEconomicsSummary(30);

  return (
    <main className="min-h-screen bg-zinc-950">
      <UnitEconomicsDashboard initialData={summary} locale="vi" />
    </main>
  );
}
