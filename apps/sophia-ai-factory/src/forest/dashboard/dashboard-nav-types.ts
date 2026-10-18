import type { LucideIcon } from "lucide-react";

export interface DashboardNavModule {
  id: string;
  labelKey: string;
  fallbackLabel: string;
  href: string;
  icon: LucideIcon;
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
