import {
  LayoutDashboard, PlusCircle, Film, Wand2, Youtube, BookOpen,
  Share2, ShoppingBag, Target, ShieldCheck, Terminal, Activity, Image as ImageIcon, DollarSign, Megaphone,
} from "lucide-react";
import type { DashboardNavModule, DashboardUserProps, DashboardSidebarNavProps } from "./dashboard-nav-types";

export type { DashboardNavModule, DashboardUserProps, DashboardSidebarNavProps };

// Re-exported so existing `from './dashboard-nav-modules'` imports keep working.
export {
  OPC_PRIMARY_NAV_GROUPS,
  OPC_REFERRAL_NAV_ITEM,
} from "./dashboard-opc-nav-items";

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
    id: "campaigns",
    labelKey: "sidebar.campaigns",
    fallbackLabel: "Affiliate Campaigns",
    href: "/dashboard/campaigns",
    icon: Megaphone,
  },
  {
    id: "niche_studio",
    labelKey: "sidebar.niche_studio",
    fallbackLabel: "Niche Studio",
    href: "/dashboard/niche-studio",
    icon: Wand2,
  },
  {
    id: "creative_studio",
    labelKey: "sidebar.creative_studio",
    fallbackLabel: "Creative Studio",
    href: "/dashboard/creative-economy",
    icon: Wand2,
  },
  {
    id: "image_studio",
    labelKey: "sidebar.image_studio",
    fallbackLabel: "Image Studio",
    href: "/dashboard/image-studio",
    icon: ImageIcon,
  },
  {
    id: "youtube_automation",
    labelKey: "sidebar.youtube_automation",
    fallbackLabel: "YouTube Automation",
    href: "/dashboard/youtube",
    icon: Youtube,
  },
  {
    id: "affiliates",
    labelKey: "sidebar.affiliates",
    fallbackLabel: "My Affiliate Business",
    href: "/dashboard/affiliates",
    icon: DollarSign,
  },
  {
    id: "approvals",
    labelKey: "sidebar.approvals",
    fallbackLabel: "Approvals Needed",
    href: "/dashboard/approvals",
    icon: ShieldCheck,
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

