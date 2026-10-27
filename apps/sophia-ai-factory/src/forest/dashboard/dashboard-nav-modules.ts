import {
  LayoutDashboard, PlusCircle, Film, Wand2, Youtube, BookOpen,
  Share2, ShoppingBag, Target, ShieldCheck, Terminal, Activity, Image as ImageIcon, DollarSign,
} from "lucide-react";
import type { DashboardNavModule, DashboardUserProps, DashboardSidebarNavProps } from "./dashboard-nav-types";

export type { DashboardNavModule, DashboardUserProps, DashboardSidebarNavProps };

/** 16 Canonical Sophia AI Factory Navigation Modules (including Affiliate Hub, Image Studio, SOP system and challenges). */
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
    id: "affiliate",
    labelKey: "sidebar.affiliate",
    fallbackLabel: "Affiliate Hub",
    href: "/dashboard/affiliate",
    icon: DollarSign,
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

/**
 * OPC primary work groups (max six). These are the ONLY primary navigation
 * items; the 16 canonical modules remain available as deep links in the
 * secondary "More tools" section so no existing route or permission is lost.
 * Every href below resolves to an existing page in app/[locale]/dashboard.
 */
export const OPC_PRIMARY_NAV_GROUPS: DashboardNavModule[] = [
  {
    id: "opc_today",
    labelKey: "opcNav.today",
    fallbackLabel: "Today",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "opc_offers",
    labelKey: "opcNav.offers",
    fallbackLabel: "Offers",
    href: "/dashboard/affiliate",
    icon: DollarSign,
  },
  {
    id: "opc_campaigns",
    labelKey: "opcNav.campaigns",
    fallbackLabel: "Campaigns",
    href: "/dashboard/campaigns",
    icon: Film,
  },
  {
    id: "opc_approvals",
    labelKey: "opcNav.approvals",
    fallbackLabel: "Needs approval",
    href: "/dashboard/approvals",
    icon: ShieldCheck,
  },
  {
    id: "opc_results",
    labelKey: "opcNav.results",
    fallbackLabel: "Results",
    href: "/dashboard/affiliates",
    icon: Activity,
  },
  {
    id: "opc_connections",
    labelKey: "opcNav.connections",
    fallbackLabel: "Connections",
    href: "/dashboard/settings",
    icon: BookOpen,
  },
];

/** Separate referral programme — never mixed with external affiliate earnings. */
export const OPC_REFERRAL_NAV_ITEM: DashboardNavModule = {
  id: "refer_sophia",
  labelKey: "opcNav.referSophia",
  fallbackLabel: "Refer Sophia",
  href: "/partner",
  icon: Target,
};
