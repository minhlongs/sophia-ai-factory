"use client";

import React from "react";
import { Link } from "@/navigation";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/seed/utils/cn";
import type { DashboardUserProps } from "./dashboard-nav-modules";

export interface DashboardUserCardProps {
  user: DashboardUserProps;
  isVi?: boolean;
  onCloseMobile?: () => void;
}

export function getTierBadgeClass(tier: string) {
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
}

export function DashboardUserCard({
  user,
  isVi = false,
  onCloseMobile,
}: DashboardUserCardProps) {
  const userInitials = user.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "SF";

  const rawQuota = user.quotaUsagePercent ?? 0;
  const quotaPercent = Number.isFinite(rawQuota) ? rawQuota : 0;
  const userTier = user.tier || "PRO";

  return (
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
}
