import React from 'react';

export interface ControlDeckSkeletonProps {
  readonly isVi?: boolean;
}

const SKELETON_TABS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const SKELETON_CARDS = [1, 2, 3, 4] as const;

export function ControlDeckSkeleton({
  isVi = false,
}: ControlDeckSkeletonProps = {}) {
  const label = isVi
    ? 'Đang tải Bàn Chỉ Huy Đạo Diễn Stitch v4.2...'
    : "Loading Stitch v4.2 Director's Control Deck...";

  return (
    <div
      data-testid="control-deck-skeleton"
      role="status"
      aria-busy="true"
      aria-label={label}
      className="min-h-screen overflow-x-hidden bg-[#0B0E14] px-4 py-6 text-[#F8FAFC] md:px-8"
    >
      <span className="sr-only">{label}</span>

      {/* Demo Notice Banner Skeleton */}
      <div className="mb-4 h-11 w-full animate-pulse rounded-xl border border-amber-400/20 bg-[#121722] motion-reduce:animate-none" />

      {/* Top Executive Header Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#121722] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
        <div className="min-w-0 space-y-2.5">
          <div className="h-3.5 w-48 animate-pulse rounded bg-indigo-400/20 motion-reduce:animate-none" />
          <div className="h-8 w-72 max-w-full animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none md:w-96" />
        </div>
        <div className="h-11 w-36 animate-pulse rounded-lg border border-amber-400/30 bg-amber-400/10 motion-reduce:animate-none" />
      </div>

      {/* 9-Screen Navigation Tab Strip Skeleton (min-h-[44px] touch targets) */}
      <div
        aria-hidden="true"
        className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-9"
      >
        {SKELETON_TABS.map((idx) => (
          <div
            key={idx}
            className="flex min-h-[44px] flex-col justify-between rounded-xl border border-white/10 bg-[#121722] p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
          >
            <div className="h-2.5 w-12 animate-pulse rounded bg-amber-400/25 motion-reduce:animate-none" />
            <div className="mt-2 h-3.5 w-20 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
          </div>
        ))}
      </div>

      {/* Inspector Card Skeleton */}
      <div
        aria-hidden="true"
        className="mt-6 rounded-xl border border-white/10 bg-[#121722] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3.5 w-40 animate-pulse rounded bg-emerald-400/25 motion-reduce:animate-none" />
            <div className="h-6 w-64 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
          </div>
          <div className="flex gap-2">
            <div className="h-11 w-32 animate-pulse rounded-lg bg-white/5 motion-reduce:animate-none" />
            <div className="h-11 w-32 animate-pulse rounded-lg bg-amber-400/15 motion-reduce:animate-none" />
          </div>
        </div>
      </div>

      {/* 2-Column Panel Grid Skeleton */}
      <div
        aria-hidden="true"
        className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        {SKELETON_CARDS.map((cardIdx) => (
          <div
            key={cardIdx}
            className="rounded-xl border border-white/10 bg-[#121722] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-44 animate-pulse rounded bg-amber-400/20 motion-reduce:animate-none" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-emerald-400/15 motion-reduce:animate-none" />
            </div>
            <div className="mt-4 space-y-3">
              <div className="h-16 w-full animate-pulse rounded-lg bg-white/5 motion-reduce:animate-none" />
              <div className="h-16 w-full animate-pulse rounded-lg bg-white/5 motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
