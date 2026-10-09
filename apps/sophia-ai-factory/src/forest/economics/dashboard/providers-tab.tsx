/**
 * Unit Economics Dashboard Submodule: Providers Tab.
 * Layer: forest (Presentation component)
 *
 * @module forest/economics/dashboard/providers-tab
 */

import React from 'react';
import { Activity } from 'lucide-react';
import type { ProviderCostItem } from '@/seed/types/unit-economics-types';

interface ProvidersTabProps {
  providerCosts: ProviderCostItem[];
  locale: 'vi' | 'en';
}

export function ProvidersTab({ providerCosts, locale }: ProvidersTabProps) {
  const isVi = locale === 'vi';

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            {isVi ? 'Chi Tiết Chi Phí & Độ Tin Cậy Nhà Cung Cấp' : 'AI Provider Cost & Reliability Breakdown'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {isVi
              ? 'Theo dõi số lượng yêu cầu, chi phí thực tế, tỷ lệ lỗi và độ trễ phản hồi'
              : 'Track job volume, aggregated COGS, error rates, and response latency per provider'}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs font-semibold uppercase text-zinc-400 tracking-wider">
              <th className="py-3 px-4">{isVi ? 'Nhà Cung Cấp' : 'Provider'}</th>
              <th className="py-3 px-4">{isVi ? 'Tổng Tác Vụ' : 'Total Jobs'}</th>
              <th className="py-3 px-4">{isVi ? 'Thành Công' : 'Success'}</th>
              <th className="py-3 px-4">{isVi ? 'Chi Phí (COGS)' : 'Total Cost'}</th>
              <th className="py-3 px-4">{isVi ? 'TB / Tác Vụ' : 'Avg / Job'}</th>
              <th className="py-3 px-4">{isVi ? 'Tỷ Lệ Chi Phí' : 'Cost Share'}</th>
              <th className="py-3 px-4">{isVi ? 'Độ Trễ TB' : 'Avg Latency'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {providerCosts.map((p) => (
              <tr key={p.provider} className="hover:bg-zinc-800/30 transition-colors">
                <td className="py-3.5 px-4 font-medium text-zinc-200 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  {p.displayName}
                </td>
                <td className="py-3.5 px-4 text-zinc-300 font-mono">{p.totalJobs.toLocaleString()}</td>
                <td className="py-3.5 px-4 text-emerald-400 font-mono">
                  {p.successfulJobs.toLocaleString()} (
                  {((p.successfulJobs / Math.max(1, p.totalJobs)) * 100).toFixed(1)}%)
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-zinc-100">
                  ${p.totalCostUsd.toLocaleString()}
                </td>
                <td className="py-3.5 px-4 font-mono text-zinc-400">
                  ${p.avgCostPerJobUsd.toFixed(4)}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${Math.min(100, p.costSharePct)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-zinc-400">{p.costSharePct}%</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-zinc-400 font-mono">{p.avgLatencyMs} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
