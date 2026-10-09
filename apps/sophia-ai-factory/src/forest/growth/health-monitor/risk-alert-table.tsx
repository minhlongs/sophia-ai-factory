/**
 * Customer Health & Risk Alert Table
 *
 * Layer: Forest (UI components & presentation)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/health-monitor/risk-alert-table
 */

import React from 'react';
import { RefreshCw, Gift } from 'lucide-react';
import type { CustomerHealthMetrics } from '@/seed/types/retention-types';
import {
  getScoreBadgeColor,
  getScoreProgressColor,
  renderStatusBadge,
} from './health-badges';

interface RiskAlertTableProps {
  loading: boolean;
  filteredCustomers: CustomerHealthMetrics[];
  isVi: boolean;
  onOpenIntervention: (cust: CustomerHealthMetrics) => void;
}

export function RiskAlertTable({
  loading,
  filteredCustomers,
  isVi,
  onOpenIntervention,
}: RiskAlertTableProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-sm">
      {loading ? (
        <div className="p-12 text-center text-zinc-500 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
          {isVi
            ? 'Đang phân tích telemetry khách hàng...'
            : 'Analyzing telemetry health metrics...'}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-12 text-center text-zinc-500 text-xs">
          {isVi
            ? 'Không có khách hàng nào trong nhóm lọc này'
            : 'No customers match the selected filter'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">{isVi ? 'Khách hàng' : 'Customer'}</th>
                <th className="py-3 px-4">{isVi ? 'Điểm Sức khỏe' : 'Health Score'}</th>
                <th className="py-3 px-4">{isVi ? 'Chi tiết 4 Yếu tố' : '4-Factor Breakdown'}</th>
                <th className="py-3 px-4">{isVi ? 'Trạng thái' : 'Status'}</th>
                <th className="py-3 px-4 text-right">{isVi ? 'Can thiệp Founder' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredCustomers.map((cust) => {
                const initials = (cust.userName || cust.userEmail.split('@')[0])
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <tr
                    key={cust.userId}
                    className="hover:bg-zinc-800/30 transition group"
                  >
                    {/* Customer info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-300 text-[11px] border border-zinc-700/60 shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {cust.userName || cust.userEmail.split('@')[0]}
                          </div>
                          <div className="text-[11px] text-zinc-400">{cust.userEmail}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            ID: {cust.userId.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Total Health Score Pill */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-md font-bold text-sm border font-mono ${getScoreBadgeColor(
                            cust.totalHealthScore,
                          )}`}
                        >
                          {cust.totalHealthScore}
                          <span className="text-[10px] font-normal text-zinc-400">/100</span>
                        </span>
                      </div>
                      <div className="w-24 bg-zinc-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${getScoreProgressColor(cust.totalHealthScore)}`}
                          style={{ width: `${cust.totalHealthScore}%` }}
                        />
                      </div>
                    </td>

                    {/* 4 Factor Breakdown */}
                    <td className="py-3.5 px-4">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        <div>
                          <span className="text-zinc-500">{isVi ? 'Đăng nhập:' : 'Recency:'}</span>{' '}
                          <span className="font-semibold text-zinc-200">
                            {cust.recencyScore}/25
                          </span>{' '}
                          <span className="text-[10px] text-zinc-500">
                            ({cust.rawMetrics.daysSinceLastActive}d)
                          </span>
                        </div>

                        <div>
                          <span className="text-zinc-500">{isVi ? 'Sản lượng:' : 'Velocity:'}</span>{' '}
                          <span className="font-semibold text-zinc-200">
                            {cust.velocityScore}/25
                          </span>{' '}
                          <span className="text-[10px] text-zinc-500">
                            ({cust.rawMetrics.videosCreated30d} vid)
                          </span>
                        </div>

                        <div>
                          <span className="text-zinc-500">{isVi ? 'MCU dư:' : 'Capacity:'}</span>{' '}
                          <span className="font-semibold text-zinc-200">
                            {cust.capacityScore}/25
                          </span>{' '}
                          <span className="text-[10px] text-zinc-500">
                            ({cust.rawMetrics.creditsRemaining})
                          </span>
                        </div>

                        <div>
                          <span className="text-zinc-500">{isVi ? 'Độ ổn định:' : 'Reliability:'}</span>{' '}
                          <span className="font-semibold text-zinc-200">
                            {cust.reliabilityScore}/25
                          </span>{' '}
                          <span className="text-[10px] text-zinc-500">
                            ({Math.round(cust.rawMetrics.renderSuccessRate * 100)}%)
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status & Cooldown */}
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(cust, isVi)}
                    </td>

                    {/* 1-Click Founder Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onOpenIntervention(cust)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition shadow-sm"
                      >
                        <Gift className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{isVi ? 'Can thiệp 1-Click' : '1-Click Action'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
