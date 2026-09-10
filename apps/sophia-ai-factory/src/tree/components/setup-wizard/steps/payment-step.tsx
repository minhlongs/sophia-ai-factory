"use client";

import React from 'react';
import { CreditCard, CheckCircle2, Zap, Calendar, ArrowRight, ArrowLeft } from 'lucide-react';

export type TierType = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

interface PaymentStepProps {
  onNext: () => void;
  onBack: () => void;
  currentTier?: TierType;
}

const TIER_DETAILS: Record<TierType, { name: string; mcu: string; videos: string; price: string }> = {
  BASIC: { name: 'Basic Tier', mcu: '200 MCU', videos: '~5 full videos', price: '$29/mo' },
  PREMIUM: { name: 'Premium Tier', mcu: '1,000 MCU', videos: '~25 full videos', price: '$99/mo' },
  ENTERPRISE: { name: 'Enterprise Tier', mcu: '5,000 MCU', videos: '~120 full videos', price: '$299/mo' },
  MASTER: { name: 'Master Tier', mcu: 'Unlimited MCU', videos: 'Infinite scaling', price: '$999/mo' },
};

export function PaymentStep({ onNext, onBack, currentTier = 'PREMIUM' }: PaymentStepProps) {
  const details = TIER_DETAILS[currentTier] ?? TIER_DETAILS.PREMIUM;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Billing Verified / Thanh toán đã xác thực
        </div>
        <h2 className="text-xl font-semibold text-foreground">
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
        <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                  Active Tier / Gói hiện tại
                </span>
                <h3 className="text-lg font-bold text-foreground">
                  {details.name}
                </h3>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              ACTIVE
            </span>
          </div>

          <div className="pt-2 border-t border-primary/10 space-y-2 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Monthly Rate:</span>
              <span className="font-semibold text-foreground">{details.price}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Renewal Cycle:</span>
              <span className="font-medium text-foreground">30 Days Auto-renew</span>
            </div>
          </div>
        </div>

        {/* MCU Quota Card */}
        <div className="p-5 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Compute Allowance
              </span>
              <h3 className="text-lg font-bold text-foreground">
                {details.mcu}
              </h3>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 space-y-2 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Estimated Production:</span>
              <span className="font-semibold text-primary">{details.videos}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">BYOK AI Costs:</span>
              <span className="text-emerald-600 font-medium">Billed directly by providers (0% fee)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transparency Guarantee */}
      <div className="p-4 rounded-xl border border-border bg-card/60 flex items-start gap-3">
        <Calendar className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-foreground">
            Non-Technical Transparency Guarantee / Cam kết minh bạch tuyệt đối
          </p>
          <p className="text-muted-foreground">
            Sophia does not mark up AI provider API usage. Your compute quota (MCU) covers orchestration, rendering pipelines, and viral campaign optimization.
            <br />
            Sophia không thu thêm phí chênh lệch API của nhà cung cấp. Hạn mức MCU được dùng trọn vẹn cho tiến trình dựng và tối ưu chiến dịch.
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-border">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground font-medium px-4 py-2 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại / Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200"
        >
          Tiếp tục / Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
