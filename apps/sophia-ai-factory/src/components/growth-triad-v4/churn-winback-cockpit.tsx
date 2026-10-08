/**
 * @file churn-winback-cockpit.tsx
 * @description Presentation component for AI Retargeting & Churn Win-Back Engine
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import type { ChurnRiskLevel } from '@/seed/types/growth-triad-v4-types';

export interface ChurnCandidate {
  userId: string;
  email: string;
  daysInactive: number;
  hazardScore: number;
  riskLevel: ChurnRiskLevel;
}

interface ChurnWinbackCockpitProps {
  candidates: ChurnCandidate[];
  onTriggerWinback?: (userId: string) => void;
}

export function ChurnWinbackCockpit({
  candidates,
  onTriggerWinback,
}: ChurnWinbackCockpitProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(
    candidates[0]?.userId ?? null
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>🔄</span> AI Churn Win-Back Engine
          </h3>
          <p className="text-xs text-slate-400">
            Dự báo nguy cơ rời bỏ dịch vụ & phân phối khuyến mãi theo nấc biên độ
          </p>
        </div>
        <span className="text-xs bg-amber-950 border border-amber-600 text-amber-400 px-2 py-0.5 rounded-full font-mono">
          Weibull Hazard
        </span>
      </div>

      <div className="space-y-3">
        {candidates.map((c) => (
          <div
            key={c.userId}
            onClick={() => setSelectedUser(c.userId)}
            className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
              selectedUser === c.userId
                ? 'bg-slate-950 border-amber-500/50 ring-1 ring-amber-500/30'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-slate-200">{c.email}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  c.riskLevel === 'CRITICAL'
                    ? 'bg-rose-900/60 text-rose-300'
                    : c.riskLevel === 'HIGH'
                    ? 'bg-amber-900/60 text-amber-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {c.riskLevel} ({Math.round(c.hazardScore * 100)}%)
              </span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Vắng mặt: {c.daysInactive} ngày</span>
              {onTriggerWinback && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTriggerWinback(c.userId);
                  }}
                  className="text-amber-400 hover:underline font-semibold"
                >
                  Kích hoạt Win-Back →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
