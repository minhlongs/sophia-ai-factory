import type { LucideIcon } from "lucide-react";

export type DashboardNavGroup =
  | "today"
  | "offers"
  | "campaigns"
  | "approvals"
  | "results"
  | "connections"
  | "advanced";

export interface DashboardNavGroupConfig {
  id: DashboardNavGroup;
  labelKey: string;
  fallbackLabel: string;
  fallbackLabelVi: string;
  collapsible?: boolean;
}

export interface DashboardNavModule {
  id: string;
  labelKey: string;
  fallbackLabel: string;
  href: string;
  icon: LucideIcon;
  group?: DashboardNavGroup;
  badge?: string;
}

export interface DashboardUserProps {
  name: string;
  email: string;
  avatarUrl?: string | null;
  tier?: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE' | 'MASTER' | string;
  quotaUsagePercent?: number;
  quotaUsed?: number;
  quotaTotal?: number;
}

export interface DashboardSidebarNavProps {
  currentPath?: string;
  isAdmin?: boolean;
  isVi?: boolean;
  user?: DashboardUserProps;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  className?: string;
}
