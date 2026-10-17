import React from 'react';
import { Gift } from 'lucide-react';
import type { CustomerHealthMetrics } from '@/seed/types/retention-types';
import {
  getScoreBadgeColor,
  getScoreProgressColor,
  renderStatusBadge,
} from './health-badges';

export interface RiskAlertRowProps {
  cust: CustomerHealthMetrics;
  isVi: boolean;
  onOpenIntervention: (cust: CustomerHealthMetrics) => void;
}

export function RiskAlertRow({
  cust,
  isVi,
  onOpenIntervention,
}: RiskAlertRowProps) {
  const initials = (cust.userName || cust.userEmail.split('@')[0])
    .slice(0, 2)
    .toUpperCase();

  return (
    <tr className="hover:bg-zinc-800/30 transition group">
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
            <span className="font-semibold text-zinc-200">{cust.recencyScore}/25</span>{' '}
            <span className="text-[10px] text-zinc-500">({cust.rawMetrics.daysSinceLastActive}d)</span>
          </div>
          <div>
            <span className="text-zinc-500">{isVi ? 'Sản lượng:' : 'Velocity:'}</span>{' '}
            <span className="font-semibold text-zinc-200">{cust.velocityScore}/25</span>{' '}
            <span className="text-[10px] text-zinc-500">({cust.rawMetrics.videosCreated30d} vid)</span>
          </div>
          <div>
            <span className="text-zinc-500">{isVi ? 'MCU dư:' : 'Capacity:'}</span>{' '}
            <span className="font-semibold text-zinc-200">{cust.capacityScore}/25</span>{' '}
            <span className="text-[10px] text-zinc-500">({cust.rawMetrics.creditsRemaining})</span>
          </div>
          <div>
            <span className="text-zinc-500">{isVi ? 'Độ ổn định:' : 'Reliability:'}</span>{' '}
            <span className="font-semibold text-zinc-200">{cust.reliabilityScore}/25</span>{' '}
            <span className="text-[10px] text-zinc-500">
              ({Math.round(cust.rawMetrics.renderSuccessRate * 100)}%)
            </span>
          </div>
        </div>
      </td>

      {/* Status & Cooldown */}
      <td className="py-3.5 px-4">{renderStatusBadge(cust, isVi)}</td>

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
}
