/**
 * Video Analytics & Net ROI Dashboard Page Route
 * Renders the Obsidian Cyber-Glass Analytics Cockpit.
 *
 * Layer: Land/App Route | File size: < 200 LOC | Zero :any.
 * @module app/(app)/dashboard/analytics-roi/page
 */

export const dynamic = 'force-dynamic';

import React from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { VideoAnalyticsCockpitView } from '@/components/analytics-cockpit/video-analytics-cockpit-view';
import {
  getUserAggregateMetrics,
  listUserAnalyticsSnapshots,
} from '@/land/analytics/video-analytics-store';
import { triggerAnalyticsSyncAction } from '@/land/analytics/actions/analytics-actions';
import type { ChannelAggregateMetrics, VideoAnalyticsSnapshot } from '@/seed/types/video-analytics-types';

export default async function AnalyticsRoiPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/vi/login');
  }

  let metrics: ChannelAggregateMetrics = {
    totalViews: 0,
    totalRevenueUsd: 0,
    totalCostUsd: 0,
    totalNetMarginUsd: 0,
    avgHookScore: 0,
    avgRetentionScore: 0,
    roiPercent: 0,
    publishedCount: 0,
  };

  let snapshots: VideoAnalyticsSnapshot[] = [];

  try {
    metrics = await getUserAggregateMetrics(user.id);
    snapshots = await listUserAnalyticsSnapshots(user.id, { limit: 50 });
  } catch {
    // Defaults on clean database tables
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <VideoAnalyticsCockpitView
        initialMetrics={metrics}
        initialSnapshots={snapshots}
        onTriggerSync={async (jobId: string) => {
          'use server';
          const res = await triggerAnalyticsSyncAction(jobId);
          return { success: res.success };
        }}
      />
    </div>
  );
}
