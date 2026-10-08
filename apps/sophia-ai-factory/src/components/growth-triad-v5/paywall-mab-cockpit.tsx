/**
 * @file paywall-mab-cockpit.tsx
 * @description Presentation component for Dynamic Paywall Thompson Sampling & Recalibration
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import type { PaywallArm } from '@/seed/types/growth-triad-v5-types';

interface PaywallMabCockpitProps {
  arms: PaywallArm[];
  campaignId: string;
  onSelectArm?: (campaignId: string) => void;
  onRecordConversion?: (armId: string, converted: boolean) => void;
}

export function PaywallMabCockpit({
  arms,
  campaignId,
  onSelectArm,
  onRecordConversion,
}: PaywallMabCockpitProps) {
  const [selectedArmId, setSelectedArmId] = useState<string | null>(
    arms[0]?.id ?? null
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>⚡</span> Dynamic LTV Paywall Thompson Sampling
          </h3>
          <p className="text-xs text-slate-400">
            Tối ưu hóa độ co giãn giá & phân bổ lưu lượng truy cập qua phân phối Beta Conjugate
          </p>
        </div>
        <span className="text-xs bg-amber-950 border border-amber-600 text-amber-400 px-2 py-0.5 rounded-full font-mono">
          Beta-Bernoulli MAB
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {arms.map((arm) => {
          const ctr = arm.impressions > 0
            ? ((arm.conversions / arm.impressions) * 100).toFixed(1)
            : '0.0';
          const isSelected = selectedArmId === arm.id;

          return (
            <div
              key={arm.id}
              onClick={() => setSelectedArmId(arm.id)}
              className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                isSelected
                  ? 'bg-slate-950 border-amber-500/50 ring-1 ring-amber-500/30'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-slate-200">{arm.priceTier}</span>
                <span className="text-amber-400 font-mono font-bold">${arm.priceUsd.toFixed(2)}</span>
              </div>

              <div className="space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Lượt hiển thị:</span>
                  <span className="text-slate-200 font-mono">{arm.impressions}</span>
                </div>
                <div className="flex justify-between">
                  <span>Chuyển đổi (CVR):</span>
                  <span className="text-slate-200 font-mono">{arm.conversions} ({ctr}%)</span>
                </div>
                <div className="flex justify-between">
                  <span>Doanh thu:</span>
                  <span className="text-emerald-400 font-mono">${arm.revenueUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                  <span>Posterior:</span>
                  <span>α={arm.alphaSuccess.toFixed(1)} / β={arm.betaFailure.toFixed(1)}</span>
                </div>
              </div>

              {isSelected && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRecordConversion?.(arm.id, true);
                    }}
                    className="flex-1 py-1 text-[11px] font-medium bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-600/50 text-emerald-300 rounded transition"
                  >
                    + Ghi nhận mua
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRecordConversion?.(arm.id, false);
                    }}
                    className="flex-1 py-1 text-[11px] font-medium bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 text-rose-300 rounded transition"
                  >
                    Bỏ qua
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={() => onSelectArm?.(campaignId)}
          className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded-lg transition"
        >
          Lấy mức giá tối ưu (Sample Arm)
        </button>
      </div>
    </div>
  );
}
