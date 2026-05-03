'use client';
/**
 * 90-cell uptime grid — CSS grid, colored by uptime %.
 * @module app/status/uptime-grid
 */

import type { DayRollup } from '@/lib/status/status-store';

interface UptimeGridProps {
  rollup: DayRollup[];
}

function uptimeColor(row: DayRollup | undefined): string {
  if (!row || row.totalChecks === 0) return 'bg-zinc-700';
  if (row.uptimePct >= 99.5) return 'bg-emerald-600';
  if (row.uptimePct >= 95) return 'bg-amber-600';
  return 'bg-red-700';
}

export function UptimeGrid({ rollup }: UptimeGridProps) {
  const dateMap = new Map<string, DayRollup>(rollup.map(r => [r.date, r]));

  // Generate 90 days ending today
  const days: string[] = Array.from({ length: 90 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (89 - i));
    return d.toISOString().slice(0, 10);
  });

  return (
    <div className="grid grid-cols-[repeat(13,1fr)] gap-1" aria-label="90-day uptime grid">
      {days.map(date => {
        const row = dateMap.get(date);
        const color = uptimeColor(row);
        const label = row
          ? `${date}: ${row.uptimePct.toFixed(1)}% uptime (${row.okChecks}/${row.totalChecks} checks)`
          : `${date}: No data`;
        return (
          <div
            key={date}
            title={label}
            className={`h-4 rounded-sm ${color}`}
          />
        );
      })}
    </div>
  );
}
