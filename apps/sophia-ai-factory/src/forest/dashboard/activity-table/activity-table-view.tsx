'use client';

/**
 * Dashboard Activity Table View Component
 * Layer: forest/dashboard/activity-table
 */

import React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Film, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/seed/utils/cn";
import { DashboardActivityItem, DashboardActivityTableProps } from "./types";
import { ActivityRow } from "./activity-row";

export function DashboardActivityTable({
  activities,
  transactions,
  className,
}: DashboardActivityTableProps) {
  let t: (key: string, params?: Record<string, unknown>) => string;
  try {
    const hookT = useTranslations("stitch.dashboard");
    t = (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return hookT(key);
    };
  } catch {
    t = (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    };
  }

  // Support both activities and transactions props for backwards compatibility
  const items: DashboardActivityItem[] = activities || transactions || [];

  return (
    <div
      className={cn(
        "bg-[#12141F]/85 backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.35)]",
        className
      )}
      data-testid="dashboard-activity-table"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
        <div>
          <h4 className="text-base font-bold text-white tracking-tight">
            {t("recentTransactions.title")}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("recentTransactions.subtitle")}
          </p>
        </div>
        <Link
          href="/dashboard/missions"
          className="text-xs font-semibold text-primary hover:text-primary-foreground flex items-center gap-1 transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-muted-foreground mb-3">
            <Film className="w-6 h-6 text-primary/70" />
          </div>
          <p className="text-sm font-semibold text-white mb-1">
            {t("recentTransactions.emptyTitle")}
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mb-5">
            {t("recentTransactions.emptyDesc")}
          </p>
          <Link
            href="/dashboard/missions/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t("recentTransactions.topup") || "Create New Mission"}</span>
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-muted-foreground font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Activity</th>
                  <th className="py-3 px-4 font-semibold text-right">Details</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {items.map((row) => (
                  <ActivityRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="p-3.5 bg-white/[0.01] flex items-center justify-between border-t border-white/[0.06] text-xs text-muted-foreground">
            <span>
              {t("recentTransactions.showing", {
                from: 1,
                to: items.length,
                total: items.length,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="px-2.5 py-1 rounded bg-white/[0.03] border border-white/[0.06] text-slate-500 text-xs disabled:opacity-50 cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={items.length <= 10}
                className="px-2.5 py-1 rounded bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-white text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { DashboardActivityTable as DashboardTransactionsCard };
