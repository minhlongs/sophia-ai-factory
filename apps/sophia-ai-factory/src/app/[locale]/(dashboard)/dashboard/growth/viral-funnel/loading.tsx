import React from 'react';

export default function ViralFunnelLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-neutral-800 rounded-lg" />
          <div className="h-4 w-96 bg-neutral-800/60 rounded" />
        </div>
        <div className="h-10 w-44 bg-neutral-800 rounded-lg" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-neutral-900 border border-neutral-800 p-5 space-y-3">
            <div className="h-4 w-24 bg-neutral-800 rounded" />
            <div className="h-7 w-32 bg-neutral-800 rounded" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="h-96 rounded-xl bg-neutral-900 border border-neutral-800 p-6 space-y-4">
        <div className="h-8 w-full bg-neutral-800 rounded" />
        <div className="h-12 w-full bg-neutral-800/50 rounded" />
        <div className="h-12 w-full bg-neutral-800/50 rounded" />
        <div className="h-12 w-full bg-neutral-800/50 rounded" />
      </div>
    </div>
  );
}
