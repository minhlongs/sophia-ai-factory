/**
 * @file page.tsx
 * @description Master Cockpit Page for Live-Commerce Streamer, Newsjacking & DM Funnel
 * @layer Land/App Route
 */

export const dynamic = 'force-dynamic';

import React from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { TriadCockpitView } from '@/components/live-commerce-growth/triad-cockpit-view';

export default async function LiveCommerceGrowthPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/vi/login');
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <TriadCockpitView />
    </div>
  );
}
