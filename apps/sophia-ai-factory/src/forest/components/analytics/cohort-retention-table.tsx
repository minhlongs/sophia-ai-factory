'use client';

/**
 * CohortRetentionTable — Heatmap table presentation for cohort retention.
 */

import React from 'react';
import type { CohortRow } from '@/seed/types/analytics-cohort';

/** Map a retention percentage (0–100) to a Tailwind bg class */
export function retentionColor(pct: number): string {
  if (pct >= 90) return 'bg-green-700 text-white';
  if (pct >= 75) return 'bg-green-500 text-white';
  if (pct >= 60) return 'bg-green-400 text-foreground';
  if (pct >= 40) return 'bg-green-300 text-foreground';
  if (pct >= 20) return 'bg-green-200 text-foreground';
  if (pct > 0)   return 'bg-green-100 text-foreground';
  return 'bg-muted text-muted-foreground';
}

export interface CohortRetentionTableProps {
  cohorts: CohortRow[];
  colHeaders: string[];
}

export function CohortRetentionTable({ cohorts, colHeaders }: CohortRetentionTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-separate border-spacing-0.5 min-w-max">
        <thead>
          <tr>
            <th className="text-left pr-2 font-medium text-muted-foreground whitespace-nowrap">
              Cohort
            </th>
            <th className="px-1 font-medium text-muted-foreground">Users</th>
            {colHeaders.map(col => (
              <th key={col} className="px-1 font-medium text-muted-foreground min-w-[3rem]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((row: CohortRow) => (
            <tr key={row.cohortMonth}>
              <td className="pr-2 text-foreground font-medium whitespace-nowrap">
                {row.cohortMonth}
              </td>
              <td className="px-1 text-center text-muted-foreground">
                {row.usersAtStart}
              </td>
              {row.retentionByMonth.map((pct, idx) => (
                <td
                  key={idx}
                  className={`px-1 text-center rounded ${retentionColor(pct)}`}
                  title={`${row.cohortMonth} — Month ${idx}: ${pct}%`}
                >
                  {pct > 0 ? `${pct}%` : '—'}
                </td>
              ))}
            </tr>
          ))}
          {cohorts.length === 0 && (
            <tr>
              <td colSpan={colHeaders.length + 2} className="text-center text-muted-foreground py-4">
                No cohort data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
