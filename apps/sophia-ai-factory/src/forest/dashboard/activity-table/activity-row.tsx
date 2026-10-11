'use client';

/**
 * Dashboard Activity Table Row
 * Layer: forest/dashboard/activity-table
 */

import React from 'react';
import { Link } from '@/navigation';
import { Film, CreditCard, ArrowRight } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import { DashboardActivityItem } from './types';
import { StatusBadge } from './status-badge';

export function ActivityRow({ row }: { row: DashboardActivityItem }) {
  const title = row.title || row.customer || "AI Video Mission";
  const isPayment = row.type === "payment" || Boolean(row.amount && row.amount !== "$0.00");
  const detailText = row.amount || (row.type === "mission" ? "AI Video Render" : "Standard");
  const actionHref = row.href || (row.type === "mission" ? "/dashboard/missions" : "/dashboard/missions");

  return (
    <tr
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
        <StatusBadge status={row.status} />
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
}
