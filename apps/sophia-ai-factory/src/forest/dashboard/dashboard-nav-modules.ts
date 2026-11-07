import {
  LayoutDashboard, PlusCircle, Film, Wand2, Youtube, BookOpen,
  Share2, ShoppingBag, Target, ShieldCheck, Terminal, Activity, Image as ImageIcon, DollarSign, Megaphone,
} from "lucide-react";
import type {
  DashboardNavGroup,
  DashboardNavGroupConfig,
  DashboardNavModule,
  DashboardUserProps,
  DashboardSidebarNavProps,
} from "./dashboard-nav-types";

export type {
  DashboardNavGroup,
  DashboardNavGroupConfig,
  DashboardNavModule,
  DashboardUserProps,
  DashboardSidebarNavProps,
};

// Re-exported so existing `from './dashboard-nav-modules'` imports keep working.
export {
  OPC_PRIMARY_NAV_GROUPS,
  OPC_REFERRAL_NAV_ITEM,
} from "./dashboard-opc-nav-items";

export const TASK_NAV_GROUPS: DashboardNavGroupConfig[] = [
  { id: "today", labelKey: "sidebar.groups.today", fallbackLabel: "Today", fallbackLabelVi: "Hôm Nay" },
  { id: "offers", labelKey: "sidebar.groups.offers", fallbackLabel: "Offers", fallbackLabelVi: "Sản Phẩm" },
  { id: "campaigns", labelKey: "sidebar.groups.campaigns", fallbackLabel: "Campaigns", fallbackLabelVi: "Chiến Dịch" },
  { id: "approvals", labelKey: "sidebar.groups.approvals", fallbackLabel: "Approvals", fallbackLabelVi: "Duyệt Bài" },
  { id: "results", labelKey: "sidebar.groups.results", fallbackLabel: "Results", fallbackLabelVi: "Kết Quả" },
  { id: "connections", labelKey: "sidebar.groups.connections", fallbackLabel: "Connections", fallbackLabelVi: "Kết Nối" },
  { id: "advanced", labelKey: "sidebar.groups.advanced", fallbackLabel: "Advanced", fallbackLabelVi: "Nâng Cao", collapsible: true },
];

/**
 * Canonical Sophia AI Factory navigation modules. Every href resolves to an
 * existing route under `src/app/[locale]`, so no entry can point a customer at
 * a page that does not render.
 */
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
    group: "results",
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
    group: "offers",
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
    group: "advanced",
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
    group: "advanced",
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
    group: "results",
  },
];

export function groupNavModules(
  modules: DashboardNavModule[] = SOPHIA_NAV_MODULES,
): Array<{ group: DashboardNavGroupConfig; items: DashboardNavModule[] }> {
  return TASK_NAV_GROUPS.map((group) => ({
    group,
    items: modules.filter((item) => item.group === group.id),
  })).filter((entry) => entry.items.length > 0);
}

