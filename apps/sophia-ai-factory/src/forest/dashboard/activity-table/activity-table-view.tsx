'use client';

/**
 * Dashboard Activity Table View Component
 * Layer: forest/dashboard/activity-table
 */

import React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/seed/utils/cn";
import { DashboardActivityItem, DashboardActivityTableProps } from "./types";
import { ActivityRow } from "./activity-row";
import { ActivityTableEmpty, type ActivityTableEmptyProps } from "./activity-table-empty";

export { ActivityTableEmpty, type ActivityTableEmptyProps };

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

  // Support both activities and transactions props for backwards compatibility.
  // `undefined` from both means the activity data is unavailable, which is not
  // the same as a verified empty account.
  const resolved: DashboardActivityItem[] | undefined = activities ?? transactions;
  const items: DashboardActivityItem[] = resolved ?? [];

  return (
    <div
      className={cn(
        "bg-card dark:bg-[#11131F] backdrop-blur-xl border border-border dark:border-white/[0.08] rounded-xl overflow-hidden shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.35)]",
        className
      )}
      data-testid="dashboard-activity-table"
    >
      {/* Header */}
      <div className="p-5 border-b border-border dark:border-white/[0.08] flex items-center justify-between">
        <div>
          <h4 className="text-base font-bold text-foreground dark:text-white tracking-tight">
            {t("recentTransactions.title")}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("recentTransactions.subtitle")}
          </p>
        </div>
        <Link
          href="/dashboard/missions"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Content */}
      {resolved === undefined ? (
        <div className="p-5" data-testid="dashboard-activity-unavailable" data-status="error">
          <p className="text-sm text-muted-foreground">
            {t("recentTransactions.unavailableTitle")}
          </p>
        </div>
      ) : items.length === 0 ? (
        <ActivityTableEmpty
          emptyTitle={t("recentTransactions.emptyTitle")}
          emptyDesc={t("recentTransactions.emptyDesc")}
          buttonLabel={t("recentTransactions.topup") || "Create New Mission"}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border dark:border-white/[0.06] bg-muted/40 dark:bg-white/[0.02] text-muted-foreground font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Activity</th>
                  <th className="py-3 px-4 font-semibold text-right">Details</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-white/[0.04]">
                {items.map((row) => (
                  <ActivityRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="p-3.5 bg-muted/20 dark:bg-white/[0.01] flex items-center justify-between border-t border-border dark:border-white/[0.06] text-xs font-mono text-muted-foreground">
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
                className="px-2.5 py-1 rounded bg-muted dark:bg-white/[0.03] border border-border dark:border-white/[0.06] text-muted-foreground text-xs disabled:opacity-50 cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={items.length <= 10}
                className="px-2.5 py-1 rounded bg-muted dark:bg-white/[0.03] border border-border dark:border-white/[0.06] text-foreground dark:text-slate-400 hover:text-primary dark:hover:text-white text-xs disabled:opacity-50"
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
