import {
  LayoutDashboard, PlusCircle, Film, Wand2, Youtube, BookOpen,
  Share2, ShoppingBag, Target, ShieldCheck, Terminal, Activity, Image as ImageIcon, DollarSign, Megaphone,
} from "lucide-react";
import type {
  DashboardNavGroup,
  DashboardNavModule,
  DashboardUserProps,
  DashboardSidebarNavProps,
} from "./dashboard-nav-types";

export type {
  DashboardNavGroup,
  DashboardNavModule,
  DashboardUserProps,
  DashboardSidebarNavProps,
};

export interface TaskNavGroupDef {
  id: DashboardNavGroup;
  labelKey: string;
  fallbackLabelEn: string;
  fallbackLabelVi: string;
  collapsible?: boolean;
}

/**
 * 6 primary operator task groups + 1 collapsible Advanced group.
 * Keeps daily affiliate & campaign decisions at the top of the sidebar while
 * tucking secondary studio/ops utilities into an expandable drawer.
 */
export const TASK_NAV_GROUPS: TaskNavGroupDef[] = [
  { id: "today", labelKey: "sidebar.groups.today", fallbackLabelEn: "Today", fallbackLabelVi: "Hôm nay" },
  { id: "offers", labelKey: "sidebar.groups.offers", fallbackLabelEn: "Offers", fallbackLabelVi: "Offers" },
  { id: "campaigns", labelKey: "sidebar.groups.campaigns", fallbackLabelEn: "Campaigns", fallbackLabelVi: "Chiến dịch" },
  { id: "approvals", labelKey: "sidebar.groups.approvals", fallbackLabelEn: "Approvals", fallbackLabelVi: "Cần duyệt" },
  { id: "results", labelKey: "sidebar.groups.results", fallbackLabelEn: "Results", fallbackLabelVi: "Kết quả" },
  { id: "connections", labelKey: "sidebar.groups.connections", fallbackLabelEn: "Connections", fallbackLabelVi: "Kết nối" },
  { id: "advanced", labelKey: "sidebar.groups.advanced", fallbackLabelEn: "Studio & Ops Tools", fallbackLabelVi: "Công cụ nâng cao", collapsible: true },
];

/** 18 Canonical Sophia AI Factory Navigation Modules (affiliate business, approvals, campaigns, image studio, SOP system and challenges). */
export const SOPHIA_NAV_MODULES: DashboardNavModule[] = [
  {
    id: "overview",
    labelKey: "sidebar.overview",
    fallbackLabel: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    group: "today",
  },
  {
    id: "create_mission",
    labelKey: "sidebar.create_mission",
    fallbackLabel: "Create Mission",
    href: "/dashboard/missions/new",
    icon: PlusCircle,
    group: "campaigns",
  },
  {
    id: "missions",
    labelKey: "sidebar.missions",
    fallbackLabel: "AI Missions",
    href: "/dashboard/missions",
    icon: Film,
    group: "campaigns",
  },
  {
    id: "campaigns",
    labelKey: "sidebar.campaigns",
    fallbackLabel: "Affiliate Campaigns",
    href: "/dashboard/campaigns",
    icon: Megaphone,
    group: "campaigns",
  },
  {
    id: "niche_studio",
    labelKey: "sidebar.niche_studio",
    fallbackLabel: "Niche Studio",
    href: "/dashboard/niche-studio",
    icon: Wand2,
    group: "campaigns",
  },
  {
    id: "creative_studio",
    labelKey: "sidebar.creative_studio",
    fallbackLabel: "Creative Studio",
    href: "/dashboard/creative-economy",
    icon: Wand2,
    group: "advanced",
  },
  {
    id: "image_studio",
    labelKey: "sidebar.image_studio",
    fallbackLabel: "Image Studio",
    href: "/dashboard/image-studio",
    icon: ImageIcon,
    group: "campaigns",
  },
  {
    id: "youtube_automation",
    labelKey: "sidebar.youtube_automation",
    fallbackLabel: "YouTube Automation",
    href: "/dashboard/youtube",
    icon: Youtube,
    group: "connections",
  },
  {
    id: "affiliates",
    labelKey: "sidebar.affiliates",
    fallbackLabel: "My Affiliate Business",
    href: "/dashboard/affiliates",
    icon: DollarSign,
    group: "offers",
  },
  {
    id: "approvals",
    labelKey: "sidebar.approvals",
    fallbackLabel: "Approvals Needed",
    href: "/dashboard/approvals",
    icon: ShieldCheck,
    group: "approvals",
  },
  {
    id: "playbooks",
    labelKey: "sidebar.playbook",
    fallbackLabel: "Playbooks",
    href: "/dashboard/playbooks",
    icon: BookOpen,
    group: "results",
  },
  {
    id: "publish_queue",
    labelKey: "sidebar.publish_queue",
    fallbackLabel: "Distribution Queue",
    href: "/dashboard/publish/queue",
    icon: Share2,
    group: "connections",
  },
  {
    id: "marketplace",
    labelKey: "sidebar.marketplace",
    fallbackLabel: "Creator Marketplace",
    href: "/marketplace",
    icon: ShoppingBag,
    group: "offers",
  },
  {
    id: "my_sops",
    labelKey: "sidebar.my_sops",
    fallbackLabel: "My SOPs",
    href: "/dashboard/sops",
    icon: BookOpen,
    group: "advanced",
  },
  {
    id: "challenges",
    labelKey: "sidebar.challenges",
    fallbackLabel: "Challenges",
    href: "/dashboard/challenges",
    icon: Target,
    group: "results",
  },
  {
    id: "handover",
    labelKey: "sidebar.handover",
    fallbackLabel: "Handover & Acceptance",
    href: "/dashboard/handover",
    icon: ShieldCheck,
    group: "advanced",
  },
  {
    id: "runbooks",
    labelKey: "sidebar.runbooks",
    fallbackLabel: "Runbooks",
    href: "/dashboard/docs/runbooks",
    icon: Terminal,
    group: "advanced",
  },
  {
    id: "system_health",
    labelKey: "sidebar.system_health",
    fallbackLabel: "System Health",
    href: "/dashboard/system-health",
    icon: Activity,
    group: "connections",
  },
];

export function groupNavModules(
  modules: DashboardNavModule[] = SOPHIA_NAV_MODULES,
): Array<{ group: TaskNavGroupDef; items: DashboardNavModule[] }> {
  return TASK_NAV_GROUPS.map((group) => ({
    group,
    items: modules.filter((m) => m.group === group.id),
  })).filter((entry) => entry.items.length > 0);
}
