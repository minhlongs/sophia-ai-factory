'use client';

import React from 'react';
import {
  LayoutDashboard,
  Send,
  Play,
  BarChart3,
  CreditCard,
  Link2,
  Settings,
  Users,
  Monitor,
  History,
  Activity,
  Network,
  GitBranch,
} from 'lucide-react';

/* ───────────────────────────────────────────────────────────────
 * Types
 * ─────────────────────────────────────────────────────────────── */

export interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  active?: boolean;
}

export interface ProjectCard {
  id: string;
  title: string;
  duration: string;
  modifiedLabel: string;
  statusLabel?: string;
  isRendering?: boolean;
}

export interface DashboardShellProps {
  /** Current user's display name */
  userName?: string;
  /** Current user's email */
  userEmail?: string;
  /** Number of active campaigns */
  activeCampaigns?: number;
  /** Total impressions (formatted string, e.g. "1.2M") */
  totalImpressions?: string;
  /** Engagement rate (formatted string, e.g. "4.8%") */
  engagementRate?: string;
  /** Average conversion rate (formatted string, e.g. "3.2%") */
  avgConversion?: string;
  /** Active renders count */
  activeRenders?: number;
  /** GPU cores used */
  gpuUsed?: number;
  /** GPU cores total */
  gpuTotal?: number;
  /** Project cards to display */
  projects?: ProjectCard[];
  /** Children rendered inside content area (wraps the default content if provided) */
  children?: React.ReactNode;
}

/* ───────────────────────────────────────────────────────────────
 * Navigation data
 * ─────────────────────────────────────────────────────────────── */

export const MAIN_NAV: NavItem[] = [
  { label: 'dashboard', icon: LayoutDashboard, href: '/dashboard', active: true },
  { label: 'campaigns', icon: Send, href: '/campaigns' },
  { label: 'videos', icon: Play, href: '/videos' },
  { label: 'analytics', icon: BarChart3, href: '/analytics' },
  { label: 'ip', icon: Network, href: '/ip' },
  { label: 'provenance', icon: GitBranch, href: '/provenance' },
];

export const MANAGEMENT_NAV: NavItem[] = [
  { label: 'billing', icon: CreditCard, href: '/billing' },
  { label: 'affiliates', icon: Link2, href: '/affiliates' },
  { label: 'settings', icon: Settings, href: '/settings' },
];

export const ADMIN_NAV: NavItem[] = [
  { label: 'users', icon: Users, href: '/admin/users' },
  { label: 'licenses', icon: Monitor, href: '/admin/licenses' },
  { label: 'auditLog', icon: History, href: '/admin/audit-log' },
  { label: 'systemHealth', icon: Activity, href: '/admin/system-health' },
];
