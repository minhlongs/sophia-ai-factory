'use client';

/**
 * Dashboard Activity Status Badge
 * Layer: forest/dashboard/activity-table
 */

import React from 'react';

export function StatusBadge({ status }: { status: string }) {
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
}

export function getStatusBadge(status: string) {
  return <StatusBadge status={status} />;
}
