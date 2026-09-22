export const dynamic = 'force-dynamic';

/**
 * Bare Admin Growth Analytics Route
 *
 * Route: /admin/growth-analytics
 *
 * @module app/(app)/admin/growth-analytics/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { getGrowthAnalyticsSummary } from '@/land/growth/growth-analytics-service';
import { GrowthAnalyticsDashboard } from '@/forest/growth/growth-analytics-dashboard';

export const metadata: Metadata = {
  title: 'Growth & Revenue Analytics — Sophia Admin',
  description: 'Real-time $5,000 MRR milestone tracker and 4-stage omnichannel conversion funnel',
};

export default async function BareAdminGrowthAnalyticsPage() {
  const summary = await getGrowthAnalyticsSummary(30);

  return (
    <main className="min-h-screen bg-zinc-950">
      <GrowthAnalyticsDashboard initialData={summary} locale="vi" />
    </main>
  );
}
