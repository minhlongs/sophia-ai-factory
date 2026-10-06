import {
  LayoutDashboard,
  PlusCircle,
  Film,
  Wand2,
  Youtube,
  BookOpen,
  Share2,
  ShoppingBag,
  Target,
  ShieldCheck,
  Terminal,
  Activity,
  type LucideIcon,
} from "lucide-react";

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

/**
 * 14 Canonical Sophia AI Factory Navigation Modules
 * Including SOP system and challenges integration
 */
export const SOPHIA_NAV_MODULES: DashboardNavModule[] = [
  {
    id: "overview",
    labelKey: "sidebar.overview",
    fallbackLabel: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "create_mission",
    labelKey: "sidebar.create_mission",
    fallbackLabel: "Create Mission",
    href: "/dashboard/missions/new",
    icon: PlusCircle,
  },
  {
    id: "missions",
    labelKey: "sidebar.missions",
    fallbackLabel: "AI Missions",
    href: "/dashboard/missions",
    icon: Film,
  },
  {
    id: "creative_studio",
    labelKey: "sidebar.creative_studio",
    fallbackLabel: "Creative Studio",
    href: "/dashboard/creative-economy",
    icon: Wand2,
  },
  {
    id: "youtube_automation",
    labelKey: "sidebar.youtube_automation",
    fallbackLabel: "YouTube Automation",
    href: "/dashboard/youtube",
    icon: Youtube,
  },
  {
    id: "playbooks",
    labelKey: "sidebar.playbook",
    fallbackLabel: "Playbooks",
    href: "/dashboard/playbooks",
    icon: BookOpen,
  },
  {
    id: "publish_queue",
    labelKey: "sidebar.publish_queue",
    fallbackLabel: "Distribution Queue",
    href: "/dashboard/publish/queue",
    icon: Share2,
  },
  {
    id: "marketplace",
    labelKey: "sidebar.marketplace",
    fallbackLabel: "Creator Marketplace",
    href: "/marketplace",
    icon: ShoppingBag,
  },
  {
    id: "my_sops",
    labelKey: "sidebar.my_sops",
    fallbackLabel: "My SOPs",
    href: "/dashboard/sops",
    icon: BookOpen,
  },
  {
    id: "sop_marketplace",
    labelKey: "sidebar.sop_marketplace",
    fallbackLabel: "SOP Marketplace",
    href: "/dashboard/sop-marketplace",
    icon: ShoppingBag,
  },
  {
    id: "challenges",
    labelKey: "sidebar.challenges",
    fallbackLabel: "Challenges",
    href: "/dashboard/challenges",
    icon: Target,
  },
  {
    id: "handover",
    labelKey: "sidebar.handover",
    fallbackLabel: "Handover & Acceptance",
    href: "/dashboard/handover",
    icon: ShieldCheck,
  },
  {
    id: "runbooks",
    labelKey: "sidebar.runbooks",
    fallbackLabel: "Runbooks",
    href: "/dashboard/docs/runbooks",
    icon: Terminal,
  },
  {
    id: "system_health",
    labelKey: "sidebar.system_health",
    fallbackLabel: "System Health",
    href: "/dashboard/system-health",
    icon: Activity,
  },
];
