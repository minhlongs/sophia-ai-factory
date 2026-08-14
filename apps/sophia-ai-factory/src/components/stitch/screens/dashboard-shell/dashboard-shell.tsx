'use client';

import React from 'react';
import { Sidebar } from './dashboard-shell-sidebar';
import { DashboardContent } from './dashboard-shell-content';
import type { DashboardShellProps } from './dashboard-shell-types';

/* ───────────────────────────────────────────────────────────────
 * DashboardShell — top-level layout shell
 * Renders a fixed Sidebar + scrollable DashboardContent.
 * ─────────────────────────────────────────────────────────────── */

export default function DashboardShell({
  userName,
  userEmail,
  activeCampaigns,
  totalImpressions,
  engagementRate,
  avgConversion,
  activeRenders,
  children,
  projects,
}: DashboardShellProps) {
  return (
    <div className="h-screen overflow-hidden flex bg-background text-on-surface">
      <Sidebar userName={userName} userEmail={userEmail} />
      <div className="flex-1 flex flex-col relative overflow-hidden ml-60">
        {children ?? (
          <DashboardContent
            userName={userName}
            welcomeName={userName}
            activeCampaigns={activeCampaigns}
            totalImpressions={totalImpressions}
            engagementRate={engagementRate}
            avgConversion={avgConversion}
            activeRenders={activeRenders}
            projects={projects}
          />
        )}
      </div>
    </div>
  );
}

export type { DashboardShellProps, NavItem, ProjectCard } from './dashboard-shell-types';
