'use client';

import React from 'react';
import { Coins, HelpCircle } from 'lucide-react';
import type { ProviderUsageBreakdown } from '@/land/billing/customer-usage-types';

interface UsageProviderTableProps {
  providers: ProviderUsageBreakdown[];
}

export function UsageProviderTable({ providers }: UsageProviderTableProps) {
  return (
    <div className="bg-[#18181B] border border-outline-variant/30 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            Provider Rate & Consumption Accounting • Chi phí theo nhà cung cấp
          </h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Real-time tracking of AI compute, synthesis, and rendering units.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 text-on-surface-variant text-xs uppercase tracking-wider">
              <th className="pb-3 font-semibold">Service Provider</th>
              <th className="pb-3 font-semibold">Billing Model</th>
              <th className="pb-3 font-semibold">Metric</th>
              <th className="pb-3 font-semibold">Units Consumed</th>
              <th className="pb-3 font-semibold text-right">Estimated MCU</th>
              <th className="pb-3 font-semibold text-right">Est. Value (USD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10 text-on-surface">
            {providers.map((p) => (
              <tr key={p.provider} className="hover:bg-surface-variant/20 transition-colors">
                <td className="py-3 font-medium">{p.provider}</td>
                <td className="py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    p.costClassification === 'BYOK'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : 'bg-primary/10 text-primary border-primary/30'
                  }`}>
                    {p.costClassification === 'BYOK' ? 'BYOK (Customer Key)' : 'Platform Metered'}
                  </span>
                </td>
                <td className="py-3 text-on-surface-variant text-xs">{p.metricName}</td>
                <td className="py-3 font-mono font-medium">{p.totalUnits.toLocaleString()}</td>
                <td className="py-3 text-right font-mono text-primary font-semibold">
                  {p.creditsUsed.toFixed(2)} MCU
                </td>
                <td className="py-3 text-right font-mono text-on-surface-variant font-medium">
                  ${p.estimatedCostUsd.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CEO Educational Callout */}
      <div className="bg-surface-container-highest/40 border border-outline-variant/20 rounded-xl p-4 flex items-start gap-3">
        <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-on-surface-variant leading-relaxed space-y-1">
          <div>
            <strong className="text-on-surface">BYOK Transparency:</strong> Sophia AI Factory operates on Bring Your Own Key (BYOK) for LLM and voice generation. Platform Model Compute Units (MCU) meter video rendering and automation workflows.
          </div>
          <div className="text-[11px] text-on-surface-variant/80">
            <strong>Minh bạch chi phí:</strong> Khách hàng tự cấp khóa API (BYOK) cho OpenRouter, ElevenLabs, fal.ai. Nền tảng đo lường phút render video và tác vụ MCU. Phí vượt hạn mức được bảo đảm ở mức cố định $0.10/MCU.
          </div>
        </div>
      </div>
    </div>
  );
}
