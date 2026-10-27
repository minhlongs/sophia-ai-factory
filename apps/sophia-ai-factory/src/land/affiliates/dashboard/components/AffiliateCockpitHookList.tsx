'use client';

import React from 'react';
import type { CockpitExecutiveSnapshot } from '../affiliate-cockpit-types';

interface AffiliateCockpitHookListProps {
  topHooksTitle: string;
  topPerformingHooks: CockpitExecutiveSnapshot['topPerformingHooks'];
  emptyHooksText?: string;
}

export function AffiliateCockpitHookList({
  topHooksTitle,
  topPerformingHooks,
  emptyHooksText = 'Chưa có dữ liệu chiến dịch hoặc video hook được ghi nhận.',
}: AffiliateCockpitHookListProps) {
  return (
    <div className="rounded-lg border border-border/50">
      <div className="border-b border-border/50 bg-muted/40 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{topHooksTitle}</h3>
      </div>
      {topPerformingHooks.length === 0 ? (
        <div
          data-testid="cockpit-hooks-empty-state"
          className="p-4 text-xs text-muted-foreground"
        >
          {emptyHooksText}
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {topPerformingHooks.map((hook) => (
            <div
              key={hook.campaignId}
              className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{hook.hookName}</p>
                <p className="text-xs text-muted-foreground">
                  CTR: {hook.ctrPercent}% | CVR: {hook.cvrPercent}% | EPC: $
                  {(hook.epcCents / 100).toFixed(2)} | Niche: {hook.niche}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {hook.recommendedDailyVideos} video/ngày
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    hook.action === 'SCALE_AGGRESSIVE'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : hook.action === 'KILL_PRUNE'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {hook.action}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
