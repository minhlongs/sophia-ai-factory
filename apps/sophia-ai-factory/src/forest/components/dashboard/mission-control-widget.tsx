'use client';
/**
 * MissionControlWidget — composite hero card: tier + quota + sparkline + CTA.
 * @module components/dashboard/mission-control-widget
 */

import { useState } from 'react';
import { Link } from '@/navigation';
import { TierBadge } from './mission-control/tier-badge';
import { RecentActivitySparkline } from './mission-control/recent-activity-sparkline';
import { PrimaryCtaButton } from './mission-control/primary-cta';
import { useMissionControlData } from './mission-control/use-mission-control-data';
import {
  MissionControlErrorCard,
  MissionControlEmptyCard,
  MissionControlSkeletonCard,
} from './mission-control/mission-control-empty-error';

export function MissionControlWidget({ isVi = false }: { isVi?: boolean }) {
  const { data, isLoading, error, refetch } = useMissionControlData();
  const [retrying, setRetrying] = useState(false);

  if (isLoading) return <MissionControlSkeletonCard />;
  if (error || !data) {
    return (
      <MissionControlErrorCard
        error={error}
        isVi={isVi}
        retrying={retrying}
        onRetry={async () => {
          setRetrying(true);
          await refetch();
          setRetrying(false);
        }}
      />
    );
  }

  const quotaPct = data.quota.total > 0 ? (data.quota.used / data.quota.total) * 100 : 0;
  const weeklyTotal = data.last7d.reduce((a, b) => a + b.count, 0);

  if (data.quota.total === 0 && weeklyTotal === 0) {
    return <MissionControlEmptyCard isVi={isVi} />;
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <TierBadge tier={data.tier} href="/dashboard/billing" />
            <span className="text-muted-foreground text-xs">{isVi ? 'Gói hiện tại' : 'Current plan'}</span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{isVi ? 'Hạn mức MCU' : 'MCU quota'}</span>
              <Link href="/dashboard/billing" className="text-xs text-primary hover:underline">
                <span className="tabular-nums">{data.quota.used.toLocaleString()} / {data.quota.total.toLocaleString()}</span>
              </Link>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden w-48 max-w-full">
              <div
                className={`h-full rounded-full transition-all ${quotaPct > 95 ? 'bg-red-500' : quotaPct > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${Math.min(quotaPct, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-center gap-1">
          <RecentActivitySparkline data={data.last7d} />
          <span className="text-xs text-muted-foreground">
            {weeklyTotal} {isVi ? 'calls / 7 ngày' : 'calls / 7d'}
          </span>
        </div>

        <div>
          <PrimaryCtaButton ctaHint={data.ctaHint} isVi={isVi} />
        </div>
      </div>
    </div>
  );
}
