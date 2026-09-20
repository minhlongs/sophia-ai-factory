/**
 * Loading Skeleton Grid for Marketplace Catalog
 *
 * Layer: land (pure UI component)
 *
 * @module land/marketplace/marketplace-skeleton
 */

import React from 'react';

export function MarketplaceSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-2xl border border-white/5 bg-[#12131A]/60 p-5 shadow-lg animate-pulse"
        >
          <div>
            {/* Tag row */}
            <div className="flex justify-between items-center">
              <div className="h-4 w-16 rounded-full bg-white/10" />
              <div className="h-4 w-14 rounded-full bg-white/5" />
            </div>

            {/* Title & Hook */}
            <div className="mt-4 space-y-2">
              <div className="h-5 w-3/4 rounded-md bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/5" />
              <div className="h-3 w-1/3 rounded bg-white/5" />
            </div>

            {/* Metrics block */}
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-white/[0.02] p-2.5">
              <div className="h-4 w-16 rounded bg-white/5" />
              <div className="h-4 w-16 rounded bg-white/5" />
              <div className="h-4 w-16 rounded bg-white/5" />
              <div className="h-4 w-16 rounded bg-white/5" />
            </div>

            {/* Price line */}
            <div className="mt-4 flex justify-between">
              <div className="h-3 w-20 rounded bg-white/5" />
              <div className="h-3 w-16 rounded bg-white/5" />
            </div>
          </div>

          {/* CTA Button */}
          <div className="mt-6 pt-3 border-t border-white/5">
            <div className="h-9 w-full rounded-xl bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
