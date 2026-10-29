"use client";

/**
 * OPC primary navigation — the six work groups a customer lands on, plus
 * the referral programme kept deliberately separate from external affiliate
 * earnings.
 *
 * Kept out of `dashboard-nav-modules.ts` so the canonical deep-link list stays
 * a single self-contained list: both dashboard shells are checked for parity
 * against it, and mixing primary groups into it would break that comparison.
 *
 * @module forest/dashboard/dashboard-opc-nav-items
 */

import {
  LayoutDashboard,
  DollarSign,
  Film,
  Megaphone,
  ShieldCheck,
  Activity,
  BookOpen,
  Target,
} from "lucide-react";
import type { DashboardNavModule } from "./dashboard-nav-types";

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
