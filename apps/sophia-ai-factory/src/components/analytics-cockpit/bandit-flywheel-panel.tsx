/**
 * Bayesian Bandit Flywheel Panel Component
 * Telemetry cockpit for Thompson Sampling Beta posteriors & Creative Memory.
 *
 * Layer: UI Component | File size: < 200 LOC | Zero :any.
 * @module components/analytics-cockpit/bandit-flywheel-panel
 */

'use client';

import React from 'react';
import { Cpu, Zap, Award, Sparkles, RefreshCw } from 'lucide-react';
import type { BanditArmLifecycle } from '@/seed/types/video-analytics-types';

export interface BanditArmSummary {
  id: string;
  name: string;
  niche: string;
  impressions: number;
  conversions: number;
  status: BanditArmLifecycle;
  winProbability: number;
  sampleScore: number;
}

interface BanditFlywheelPanelProps {
  arms?: BanditArmSummary[];
  onTriggerOptimization?: () => void;
}

const DEFAULT_ARMS: BanditArmSummary[] = [
  { id: 'arm_yt_01', name: 'Shock & Awe Numerical Hook', niche: 'saas_global', impressions: 4500, conversions: 84, status: 'WINNING_ARM', winProbability: 0.94, sampleScore: 88.5 },
  { id: 'arm_tt_02', name: 'Curiosity Gap Question Hook', niche: 'ecommerce_tiktok', impressions: 3200, conversions: 42, status: 'ACTIVE_ARM', winProbability: 0.72, sampleScore: 74.2 },
  { id: 'arm_ig_03', name: 'Contrarian Statement Hook', niche: 'saas_global', impressions: 1800, conversions: 18, status: 'ACTIVE_ARM', winProbability: 0.58, sampleScore: 66.8 },
  { id: 'arm_yt_04', name: 'Story Pacing Hook (Cold)', niche: 'crypto_global', impressions: 350, conversions: 2, status: 'COLD_START', winProbability: 0.31, sampleScore: 48.0 },
];

export function BanditFlywheelPanel({ arms = DEFAULT_ARMS, onTriggerOptimization }: BanditFlywheelPanelProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Vòng Lặp Bayesian MAB / Thompson Bandit Flywheel</h3>
        </div>
        <button
          onClick={onTriggerOptimization}
          className="text-[11px] px-2.5 py-1 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 flex items-center gap-1 transition-all"
        >
          <RefreshCw className="w-3 h-3" /> Re-sample
        </button>
      </div>

      <div className="space-y-2.5 my-1">
        {arms.map((arm) => {
          const isWinning = arm.status === 'WINNING_ARM';
          const isPromoted = arm.winProbability >= 0.85;

          return (
            <div
              key={arm.id}
              className={`p-3 rounded-lg border transition-all ${
                isWinning
                  ? 'border-emerald-500/30 bg-emerald-950/20'
                  : 'border-white/5 bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-white flex items-center gap-1.5">
                  {isWinning ? <Award className="w-3.5 h-3.5 text-emerald-400" /> : <Zap className="w-3.5 h-3.5 text-purple-400" />}
                  {arm.name}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  isWinning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/60'
                }`}>
                  {arm.status}
                </span>
              </div>

              {/* Posterior Progress Bar */}
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isWinning ? 'bg-emerald-400' : 'bg-purple-400'}`}
                    style={{ width: `${arm.winProbability * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-white/60 min-w-[36px] text-right">
                  {(arm.winProbability * 100).toFixed(0)}% p(w)
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-white/40 mt-2">
                <span>{arm.impressions.toLocaleString()} views • {arm.conversions} conv</span>
                {isPromoted && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> Promoted to Creative Memory
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-white/40 border-t border-white/5 pt-2 mt-2">
        Beta prior update theo thời gian thực — Tự động chọn góc Hook có ROI cao nhất.
      </div>
    </div>
  );
}
