'use client';

/**
 * SOP Analytics Drill-Down Modal/Panel Component
 *
 * Layer: components/sop/detail/analytics
 */

import React from 'react';
import type { DrillDownPanelProps } from './types';

export function DrillDownPanel({ drillDownDate, setDrillDownDate, dayDrillDown }: DrillDownPanelProps) {
  if (!drillDownDate || !dayDrillDown) return null;

  return (
    <div className="mt-3 rounded-md border border-border bg-muted p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">
          {dayDrillDown[0]
            ? new Date(dayDrillDown[0].created_at! * 1000).toLocaleDateString(
                undefined,
                { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
              )
            : drillDownDate}
        </h4>
        <button
          type="button"
          onClick={() => setDrillDownDate(null)}
          className="text-xs text-foreground hover:text-foreground underline"
        >
          Close
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-border text-muted-foreground">
              <th className="pb-1 pr-3 font-medium">Run ID</th>
              <th className="pb-1 pr-3 font-medium">Status</th>
              <th className="pb-1 pr-3 font-medium">Trigger</th>
              <th className="pb-1 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {dayDrillDown.map((run) => (
              <tr key={run.id} className="border-border">
                <td className="py-1.5 pr-3 font-mono text-foreground">
                  {run.id.slice(0, 12)}
                </td>
                <td className="py-1.5 pr-3">
                  <span
                    className={`
                      inline-flex rounded-full px-2 py-0.5
                      text-[10px] font-medium
                      ${run.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : run.status === 'running'
                        ? 'bg-blue-100 text-blue-700'
                        : run.status === 'paused'
                        ? 'bg-amber-100 text-amber-700'
                        : run.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-muted text-muted-foreground'}
                    `}
                  >
                    {run.status}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-muted-foreground">
                  {run.trigger_type}
                </td>
                <td className="py-1.5 text-muted-foreground">
                  {run.created_at
                    ? new Date(run.created_at * 1000).toLocaleString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dayDrillDown.length === 0 && (
          <p className="py-2 text-xs text-muted-foreground">
            No runs found for this day.
          </p>
        )}
      </div>
    </div>
  );
}
