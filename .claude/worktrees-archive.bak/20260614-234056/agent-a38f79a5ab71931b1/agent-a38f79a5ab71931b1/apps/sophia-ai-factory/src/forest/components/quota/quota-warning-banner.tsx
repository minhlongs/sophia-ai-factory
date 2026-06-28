'use client';

/**
 * Quota Warning Banner
 * Critical/warning banner when quota usage is high
 */

import Link from 'next/link';
import { AlertCircle, AlertTriangle } from 'lucide-react';

interface QuotaWarningBannerProps {
  maxUsage: number;
}

export function QuotaWarningBanner({ maxUsage }: QuotaWarningBannerProps) {
  const isCritical = maxUsage >= 100;
  const isWarning = maxUsage >= 80 && maxUsage < 100;

  if (!isWarning && !isCritical) return null;

  return (
    <div
      className={`rounded-lg border p-4 ${
        isCritical ? 'bg-red-500/10 border-red-500/50' : 'bg-amber-500/10 border-amber-500/50'
      }`}
    >
      <div className="flex items-center gap-3">
        {isCritical ? (
          <AlertTriangle className="w-5 h-5 text-red-500" aria-hidden="true" />
        ) : (
          <AlertCircle className="w-5 h-5 text-amber-500" aria-hidden="true" />
        )}
        <div className="flex-1">
          <h3 className={`font-semibold ${isCritical ? 'text-red-500' : 'text-amber-500'}`}>
            {isCritical ? 'Quota Exceeded' : 'Quota Warning'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isCritical
              ? "You've reached your usage limit. Upgrade to continue."
              : `You've used ${maxUsage.toFixed(0)}% of your quota. Consider upgrading.`}
          </p>
        </div>
        <Link
          href="/dashboard/billing"
          className={`px-4 py-2 rounded-md font-medium text-white ${
            isCritical ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
          }`}
        >
          {isCritical ? 'Upgrade Now' : 'View Plans'}
        </Link>
      </div>
    </div>
  );
}
