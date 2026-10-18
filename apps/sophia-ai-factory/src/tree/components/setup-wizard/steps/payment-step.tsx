"use client";

import React from 'react';
import { CheckCircle2, Calendar, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  TIER_DETAILS,
  PaymentCardsGrid,
  type TierType,
} from './payment-step-cards';

export type { TierType };

interface PaymentStepProps {
  onNext: () => void;
  onBack: () => void;
  currentTier?: TierType;
  mcuBalance?: number;
  subscriptionStatus?: string;
  renewalDate?: string;
}

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

      <PaymentCardsGrid
        details={details}
        subscriptionStatus={subscriptionStatus}
        renewalDate={renewalDate}
        mcuBalance={mcuBalance}
      />

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
