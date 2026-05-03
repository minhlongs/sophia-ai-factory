'use client';
/**
 * MissionControlWidget — composite hero card: tier + quota + sparkline + CTA.
 * NEW file — does NOT modify plan-upgrade-widget.tsx (GAP2 scope).
 * @module components/dashboard/mission-control-widget
 */

import { TierBadge } from './mission-control/tier-badge';
import { RecentActivitySparkline } from './mission-control/recent-activity-sparkline';
import { PrimaryCtaButton } from './mission-control/primary-cta';
import { useMissionControlData } from './mission-control/use-mission-control-data';

interface MissionControlWidgetProps {
  isVi?: boolean;
}

export function MissionControlWidget({ isVi = false }: MissionControlWidgetProps) {
  const { data, isLoading, error } = useMissionControlData();

  if (isLoading) return <SkeletonCard />;
  if (error || !data) return null;

  const quotaPct = data.quota.total > 0 ? (data.quota.used / data.quota.total) * 100 : 0;
  const weeklyTotal = data.last7d.reduce((a, b) => a + b.count, 0);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: tier + quota */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <TierBadge tier={data.tier} href="/dashboard/billing" />
            <span className="text-zinc-500 text-xs">
              {isVi ? 'Gói hiện tại' : 'Current plan'}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-400">
                {isVi ? 'Hạn mức MCU' : 'MCU quota'}
              </span>
              <a href="/dashboard/usage" className="text-xs text-violet-400 hover:underline">
                {data.quota.used.toLocaleString()} / {data.quota.total.toLocaleString()}
              </a>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden w-48 max-w-full">
              <div
                className={`h-full rounded-full transition-all ${quotaPct > 95 ? 'bg-red-500' : quotaPct > 80 ? 'bg-amber-500' : 'bg-violet-500'}`}
                style={{ width: `${Math.min(quotaPct, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center: sparkline */}
        <div className="flex flex-col items-start sm:items-center gap-1">
          <RecentActivitySparkline data={data.last7d} />
          <span className="text-xs text-zinc-500">
            {weeklyTotal} {isVi ? 'calls / 7 ngày' : 'calls / 7d'}
          </span>
        </div>

        {/* Right: CTA */}
        <div>
          <PrimaryCtaButton ctaHint={data.ctaHint} isVi={isVi} />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-pulse">
      <div className="flex gap-4">
        <div className="h-5 w-20 bg-zinc-800 rounded-full" />
        <div className="h-5 w-32 bg-zinc-800 rounded" />
        <div className="ml-auto h-8 w-24 bg-zinc-800 rounded-lg" />
      </div>
    </div>
  );
}
