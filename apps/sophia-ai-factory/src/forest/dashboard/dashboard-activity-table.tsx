"use client";

/**
 * Obsidian Cyber-Glass Recent Activity & Missions Table
 * Layer: forest/dashboard (Infrastructure Orchestrators & UI; imports from @/seed)
 *
 * Implements:
 * 1. Unified view of video missions and subscriber transactions
 * 2. High-contrast status pills (completed, processing, failed)
 * 3. Quick action links to mission execution and billing
 * 4. Genuine empty state without dummy data
 *
 * @module forest/dashboard/dashboard-activity-table
 */

import React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import {
  Film,
  CreditCard,
  ArrowRight,
  Sparkles,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/seed/utils/cn";

export interface DashboardActivityItem {
  id: string;
  type?: "mission" | "campaign" | "payment" | string;
  title?: string;
  customer?: string;
  amount?: string;
  status: "completed" | "processing" | "running" | "queued" | "failed" | "paid" | string;
  date: string;
  href?: string;
}

export interface DashboardActivityTableProps {
  activities?: DashboardActivityItem[];
  transactions?: DashboardActivityItem[];
  className?: string;
}

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

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "completed" || s === "paid") {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
          data-testid={`status-pill-${status}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="capitalize">{status}</span>
        </span>
      );
    }
    if (s === "processing" || s === "running" || s === "queued" || s === "pending") {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25"
          data-testid={`status-pill-${status}`}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
          </span>
          <span className="capitalize">{status}</span>
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25"
        data-testid={`status-pill-${status}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        <span className="capitalize">{status}</span>
      </span>
    );
  };

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
                {items.map((row) => {
                  const title = row.title || row.customer || "AI Video Mission";
                  const isPayment = row.type === "payment" || Boolean(row.amount && row.amount !== "$0.00");
                  const detailText = row.amount || (row.type === "mission" ? "AI Video Render" : "Standard");
                  const actionHref = row.href || (row.type === "mission" ? "/dashboard/missions" : "/dashboard/missions");

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                      data-testid={`activity-row-${row.id}`}
                    >
                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                              isPayment
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-primary/10 text-primary border-primary/20"
                            )}
                          >
                            {isPayment ? (
                              <CreditCard className="w-3.5 h-3.5" />
                            ) : (
                              <Film className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <span className="font-semibold text-white tracking-wide truncate max-w-xs">
                            {title}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-300">
                        {detailText}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(row.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={actionHref}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/[0.06] transition-colors"
                          aria-label="View activity details"
                        >
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
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

// Backward compatibility re-export
export { DashboardActivityTable as DashboardTransactionsCard };
