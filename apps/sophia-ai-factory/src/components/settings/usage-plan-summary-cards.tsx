'use client';

import React from 'react';
import { ShieldCheck, Zap, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { CustomerUsageReport } from '@/land/billing/customer-usage-types';

interface UsagePlanSummaryCardsProps {
  report: CustomerUsageReport;
}

export function UsagePlanSummaryCards({ report }: UsagePlanSummaryCardsProps) {
  const { plan, limit, usage, remaining, overage, nextBillingEvent } = report;

  const isOverage = overage.isAccruing;
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
      <div className={`rounded-2xl p-5 shadow-lg border flex flex-col justify-between ${
        isOverage ? 'bg-destructive/10 border-destructive/40' : 'bg-[#18181B] border-outline-variant/30'
      }`}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              {isOverage ? 'Overage • Vượt hạn mức' : 'Remaining • Còn lại'}
            </span>
            {isOverage ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/20 text-destructive border border-destructive/30">
                <AlertTriangle className="w-3 h-3" /> Accruing
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" /> In Quota
              </span>
            )}
          </div>
          {isOverage ? (
            <div>
              <div className="text-2xl font-black text-destructive tracking-tight font-mono">
                +{overage.overageCredits.toFixed(1)} MCU
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                Est. Charge: <span className="font-semibold text-destructive">${overage.estimatedOverageCost.toFixed(2)}</span> (${overage.pricePerCredit}/MCU)
              </div>
            </div>
          ) : (
            <div>
              <div className="text-2xl font-black text-emerald-400 tracking-tight font-mono">
                {remaining.mcuRemaining.toFixed(1)} MCU
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                Overage charge: <span className="font-semibold text-on-surface">$0.00</span> (Trong định mức)
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 pt-3 border-t border-outline-variant/15 text-[11px] text-on-surface-variant flex items-center justify-between">
          <span>Overage Unit Rate:</span>
          <span className="font-mono text-on-surface font-semibold">${overage.pricePerCredit.toFixed(2)} / MCU</span>
        </div>
      </div>

      {/* 4. NEXT BILLING EVENT CARD */}
      <div className="bg-[#18181B] border border-outline-variant/30 rounded-2xl p-5 shadow-lg md:col-span-2 lg:col-span-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Next Billing Event • Kỳ thanh toán tiếp theo
              </span>
              {nextBillingEvent.isLifetime && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/20 text-primary">
                  Lifetime
                </span>
              )}
            </div>
            <div className="text-lg font-bold text-on-surface mt-0.5">
              {nextBillingEvent.isLifetime ? 'Master Lifetime License (Vĩnh viễn)' : (nextBillingEvent.date ? new Date(nextBillingEvent.date).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Next Cycle End')}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {nextBillingEvent.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:border-l sm:border-outline-variant/20 sm:pl-6 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
          <div>
            <div className="text-[10px] uppercase font-bold text-on-surface-variant">Estimated Amount</div>
            <div className="text-xl font-black text-on-surface font-mono">
              {nextBillingEvent.isLifetime ? '$0.00' : (nextBillingEvent.amount ? `$${nextBillingEvent.amount.toFixed(2)}` : '--')}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-surface-container-highest text-primary">
            <Zap className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
