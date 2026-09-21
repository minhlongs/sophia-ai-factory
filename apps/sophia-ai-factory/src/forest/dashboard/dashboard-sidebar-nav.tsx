"use client";

/**
 * Canonical Dashboard Sidebar Navigation Component
 * Layer: forest/dashboard (Infrastructure Orchestrators & UI; imports from @/seed)
 *
 * Implements the Obsidian Cyber-Glass dashboard navigation featuring:
 * 1. All 11 canonical Sophia AI Factory modules with verified routes
 * 2. Active route glows and electric indigo accent indicators
 * 3. Bottom user profile card with tier badge, quota bar, and single-line upgrade CTA
 * 4. Responsive mobile drawer navigation (< 768px viewport)
 * 5. Conditional admin operator links when isAdmin=true
 *
 * @module forest/dashboard/dashboard-sidebar-nav
 */

import React from "react";
import { Link } from "@/navigation";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/seed/utils/cn";
import {
  LayoutDashboard,
  PlusCircle,
  Film,
  Wand2,
  Youtube,
  BookOpen,
  Share2,
  ShoppingBag,
  ShieldCheck,
  Terminal,
  Activity,
  ArrowUpRight,
  X,
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
 * 11 Canonical Sophia AI Factory Navigation Modules
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

export function DashboardSidebarNav({
  currentPath,
  isAdmin = false,
  isVi = false,
  user = {
    name: "Sophia Founder",
    email: "founder@sophia.ai",
    tier: "PRO",
    quotaUsagePercent: 65,
    quotaUsed: 650,
    quotaTotal: 1000,
  },
  isMobileOpen = false,
  onCloseMobile,
  className,
}: DashboardSidebarNavProps) {
  const pathnameFromHook = usePathname();
  const rawPathname = currentPath || pathnameFromHook || "/dashboard";
  let t: (key: string) => string;
  try {
    const hookT = useTranslations("dashboard");
    t = (key: string) => hookT(key);
  } catch {
    t = (key: string) => key;
  }

  const isActive = (href: string) => {
    const cleanPath = rawPathname.replace(/^\/(en|vi)/, "") || "/";
    const cleanHref = href.replace(/^\/(en|vi)/, "") || "/";

    if (cleanHref === "/dashboard") {
      return cleanPath === "/dashboard";
    }
    return cleanPath === cleanHref || cleanPath.startsWith(`${cleanHref}/`);
  };

  const getTierBadgeClass = (tier: string) => {
    const normalized = tier.toUpperCase();
    if (normalized === "MASTER") {
      return "bg-gradient-to-r from-amber-500/20 to-primary/20 text-amber-300 border border-amber-500/30";
    }
    if (normalized === "ENTERPRISE") {
      return "bg-primary/20 text-primary border border-primary/30";
    }
    if (normalized === "PRO") {
      return "bg-violet-500/20 text-violet-300 border border-violet-500/30";
    }
    return "bg-muted text-muted-foreground border border-border";
  };

  const userInitials = user.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "SF";

  const quotaPercent = user.quotaUsagePercent ?? 65;
  const userTier = user.tier || "PRO";

  const renderNavItems = () => (
    <div className="space-y-1 px-3 py-2 flex-1 overflow-y-auto">
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {isVi ? "Nền Tảng AI" : "Platform Navigation"}
      </div>

      {SOPHIA_NAV_MODULES.map((item) => {
        const active = isActive(item.href);
        const IconComponent = item.icon;
        let label = item.fallbackLabel;
        try {
          const translated = t(item.labelKey);
          if (translated && !translated.includes(item.labelKey)) {
            label = translated;
          }
        } catch {
          label = item.fallbackLabel;
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onCloseMobile}
            className={cn(
              "relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300 group min-h-[42px]",
              active
                ? "text-white bg-primary/10 font-medium border border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
                : "text-muted-foreground hover:text-white hover:bg-muted/60 hover:translate-x-1.5 border border-transparent"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-gradient-to-b from-primary to-accent shadow-[0_0_8px_hsl(var(--primary))]" />
            )}
            <IconComponent
              className={cn(
                "w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110",
                active ? "text-primary" : "text-muted-foreground group-hover:text-white"
              )}
              aria-hidden="true"
            />
            <span className="text-xs tracking-wide truncate">{label}</span>
          </Link>
        );
      })}

      {isAdmin && (
        <div className="pt-3 mt-3 border-t border-border/50">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
            {isVi ? "Bảng Quản Trị" : "Admin Console"}
          </div>
          <Link
            href="/admin/handover"
            onClick={onCloseMobile}
            className={cn(
              "relative flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-white hover:bg-muted/60 transition-all",
              isActive("/admin/handover") && "text-white bg-primary/10 border border-primary/30 font-medium"
            )}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">Handover Console</span>
          </Link>
          <Link
            href="/dashboard/admin/ops"
            onClick={onCloseMobile}
            className={cn(
              "relative flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-white hover:bg-muted/60 transition-all",
              isActive("/dashboard/admin/ops") && "text-white bg-primary/10 border border-primary/30 font-medium"
            )}
          >
            <Activity className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">Ops Dashboard</span>
          </Link>
        </div>
      )}
    </div>
  );

  const renderUserCard = () => (
    <div className="p-3 border-t border-border/70 bg-[#0E1017]/80 shrink-0">
      <div className="bg-[#12141F] border border-border/80 rounded-xl p-3 space-y-2.5 shadow-md">
        {/* User Identity Row */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs shrink-0">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1 truncate">
            <p className="text-xs font-semibold text-white truncate leading-tight">{user.name}</p>
            <p className="text-[10px] text-muted-foreground truncate leading-tight">{user.email}</p>
          </div>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase shrink-0",
              getTierBadgeClass(userTier)
            )}
          >
            {userTier}
          </span>
        </div>

        {/* Quota Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
            <span>MCU Quota</span>
            <span className="font-mono text-slate-300">{quotaPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, quotaPercent))}%` }}
            />
          </div>
        </div>

        {/* Single-line Upgrade CTA */}
        <Link
          href="/pricing"
          onClick={onCloseMobile}
          className="w-full h-7 rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary hover:text-white text-xs font-semibold flex items-center justify-center gap-1 transition-all min-w-0 truncate"
        >
          <span>{isVi ? "Nâng Cấp Gói" : "Upgrade Tier"}</span>
          <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col w-[280px] h-screen fixed top-0 left-0 bg-[#08090D] border-r border-[#222536] z-30 select-none",
          className
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-border/70 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(99,102,241,0.4)]">
            S
          </div>
          <div className="min-w-0 flex-1 truncate">
            <h2 className="text-sm font-bold text-white tracking-tight truncate">Sophia AI Factory</h2>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest truncate">
              Autonomous Video
            </p>
          </div>
        </div>

        {/* Navigation Modules */}
        {renderNavItems()}

        {/* Bottom User Profile Card */}
        {renderUserCard()}
      </aside>

      {/* Mobile Drawer (< 768px) */}
      {isMobileOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
            onClick={onCloseMobile}
            data-testid="mobile-drawer-backdrop"
            aria-hidden="true"
          />
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#08090D] border-r border-[#222536] flex flex-col h-full shadow-2xl transition-transform duration-300 ease-in-out md:hidden",
              className
            )}
            data-testid="mobile-drawer"
            aria-label="Mobile navigation drawer"
          >
            {/* Mobile Header with Close Button */}
            <div className="h-16 px-5 border-b border-border/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xs shadow-sm">
                  S
                </div>
                <span className="text-sm font-bold text-white truncate">Sophia AI Factory</span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-muted/60 transition-colors"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Modules */}
            {renderNavItems()}

            {/* Bottom User Profile Card */}
            {renderUserCard()}
          </aside>
        </>
      )}
    </>
  );
}
