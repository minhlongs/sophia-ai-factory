"use client";

import React from 'react';
import { CreditCard, CheckCircle2, Zap, Calendar, ArrowRight, ArrowLeft } from 'lucide-react';

export type TierType = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

interface PaymentStepProps {
  onNext: () => void;
  onBack: () => void;
  currentTier?: TierType;
  mcuBalance?: number;
  subscriptionStatus?: string;
  renewalDate?: string;
}

const TIER_DETAILS: Record<TierType, { name: string; mcu: string; videos: string; price: string }> = {
  BASIC: { name: 'Basic Tier', mcu: '200 MCU', videos: '~5 full videos', price: '$29/mo' },
  PREMIUM: { name: 'Premium Tier', mcu: '1,000 MCU', videos: '~25 full videos', price: '$99/mo' },
  ENTERPRISE: { name: 'Enterprise Tier', mcu: '5,000 MCU', videos: '~120 full videos', price: '$299/mo' },
  MASTER: { name: 'Master Tier', mcu: 'Unlimited MCU', videos: 'Infinite scaling', price: '$999/mo' },
};

export function PaymentStep({
  onNext,
  onBack,
  currentTier = 'PREMIUM',
  mcuBalance,
  subscriptionStatus = 'ACTIVE',
  renewalDate,
}: PaymentStepProps) {
  const details = TIER_DETAILS[currentTier] ?? TIER_DETAILS.PREMIUM;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Billing Verified / Thanh toán đã xác thực
        </div>
        <h2 className="text-xl font-bold text-foreground tracking-tight">
          Subscription & Capacity / Gói dịch vụ & Hạn mức
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your active plan, compute quota (MCU), and video production allowance.
          <br />
          Xem gói dịch vụ đang kích hoạt, hạn mức điện toán (MCU) và công suất tạo video.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Tier Card */}
        <div className="p-5 rounded-xl border border-[#4338CA]/25 dark:border-[#6366F1]/25 bg-[#F8F9FC] dark:bg-[#090A10]/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-[#4338CA]/10 dark:bg-[#6366F1]/15 border border-[#4338CA]/20 dark:border-[#6366F1]/25 flex items-center justify-center text-[#4338CA] dark:text-[#6366F1]">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#4338CA] dark:text-[#6366F1] uppercase tracking-wider">
                  Active Tier / Gói hiện tại
                </span>
                <h3 className="text-lg font-bold text-foreground">
                  {details.name}
                </h3>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
              {subscriptionStatus}
            </span>
          </div>

          <div className="pt-2 border-t border-border dark:border-white/[0.08] space-y-2 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Monthly Rate:</span>
              <span className="font-mono font-semibold text-foreground">{details.price}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Renewal Cycle:</span>
              <span className="font-medium text-foreground">30 Days Auto-renew / Gia hạn 30 ngày</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Next Renewal:</span>
              <span className="font-mono font-medium text-foreground">{renewalDate || '30 days after activation'}</span>
            </div>
          </div>
        </div>

        {/* MCU Quota Card */}
        <div className="p-5 rounded-xl border border-border dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10]/60 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-[#D97706]/10 dark:bg-[#F59E0B]/15 border border-[#D97706]/20 dark:border-[#F59E0B]/25 flex items-center justify-center text-[#D97706] dark:text-[#F59E0B]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Compute Allowance / Hạn mức MCU
              </span>
              <h3 className="font-mono text-lg font-bold text-foreground">
                {mcuBalance !== undefined ? `${mcuBalance} MCU` : details.mcu}
              </h3>
            </div>
          </div>

          <div className="pt-2 border-t border-border dark:border-white/[0.08] space-y-2 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Estimated Production:</span>
              <span className="font-mono font-semibold text-[#4338CA] dark:text-[#6366F1]">{details.videos}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Plan Base Quota:</span>
              <span className="font-mono font-medium text-foreground">{details.mcu}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">BYOK AI Costs:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Billed directly by providers (0% fee)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transparency Guarantee */}
      <div className="p-4 rounded-xl border border-border dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10]/60 flex items-start gap-3">
        <Calendar className="w-5 h-5 text-[#D97706] dark:text-[#F59E0B] shrink-0 mt-0.5" />
        <div className="text-xs space-y-1 text-left">
          <p className="font-semibold text-foreground">
            Non-Technical Transparency Guarantee / Cam kết minh bạch tuyệt đối
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Sophia does not mark up AI provider API usage. Your compute quota (MCU) covers orchestration, rendering pipelines, and viral campaign optimization.
            <br />
            Sophia không thu thêm phí chênh lệch API của nhà cung cấp. Hạn mức MCU được dùng trọn vẹn cho tiến trình dựng và tối ưu chiến dịch.
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-border dark:border-white/[0.08]">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground font-medium px-4 py-2 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại / Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="bg-[#4338CA] dark:bg-[#6366F1] hover:opacity-95 text-white px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 shadow-xs"
        >
          Tiếp tục / Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
