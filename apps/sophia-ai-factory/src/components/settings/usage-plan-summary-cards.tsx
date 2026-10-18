'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { CustomerUsageReport } from '@/land/billing/customer-usage-types';
import {
  RemainingOverageCard,
  NextBillingEventCard,
} from './usage-plan-billing-subcards';

interface UsagePlanSummaryCardsProps {
  report: CustomerUsageReport;
}

export function UsagePlanSummaryCards({ report }: UsagePlanSummaryCardsProps) {
  const { plan, limit, usage, remaining, overage, nextBillingEvent } = report;

  const progressPercent = Math.min(Math.max(usage.percentUsed, 0), 100);

  const getProgressColor = () => {
    if (progressPercent >= 100) return 'bg-destructive';
    if (progressPercent >= 80) return 'bg-amber-500';
    return 'bg-primary';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* 1. PLAN CARD */}
      <div className="bg-[#18181B] border border-outline-variant/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Plan • Gói dịch vụ
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              <ShieldCheck className="w-3 h-3" />
              {plan.tier}
            </span>
          </div>
          <div className="text-2xl font-black text-on-surface tracking-tight">
            {plan.name}
          </div>
          <div className="text-xs text-on-surface-variant mt-0.5">
            {plan.billingType === 'lifetime' ? '$' + plan.price + ' Lifetime' : '$' + plan.price + '/month'} • {plan.status === 'active' ? 'Active (Đang hoạt động)' : plan.status}
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-outline-variant/15 text-[11px] text-on-surface-variant/80 flex items-center justify-between">
          <span>Templates: {limit.videoTemplates >= 999 ? 'Unlimited' : limit.videoTemplates}</span>
          <span>Channels: {limit.youtubeChannels >= 999 ? 'Unlimited' : limit.youtubeChannels}</span>
          <span>Campaigns: {limit.campaignsPerMonth >= 999 ? 'Unlimited' : limit.campaignsPerMonth}/mo</span>
        </div>
      </div>

      {/* 2. USAGE & LIMIT GAUGE */}
      <div className="bg-[#18181B] border border-outline-variant/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Usage & Limit • Tiêu thụ & Hạn mức
            </span>
            <span className="text-[11px] font-bold font-mono text-primary">
              {progressPercent.toFixed(1)}%
            </span>
          </div>
          <div className="text-2xl font-black text-on-surface tracking-tight font-mono">
            {usage.mcuUsed.toFixed(1)} <span className="text-sm font-normal text-on-surface-variant">/ {limit.mcuMonthly.toLocaleString()} MCU</span>
          </div>
          <div className="w-full bg-surface-container-highest rounded-full h-2 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant">Quota Allowance:</span>
          <span className="font-semibold text-on-surface font-mono">{limit.mcuMonthly.toLocaleString()} MCU / kỳ</span>
        </div>
      </div>

      {/* 3. REMAINING & OVERAGE CARD */}
      <RemainingOverageCard remaining={remaining} overage={overage} />

      {/* 4. NEXT BILLING EVENT CARD */}
      <NextBillingEventCard nextBillingEvent={nextBillingEvent} />
    </div>
  );
}
