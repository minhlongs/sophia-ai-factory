/**
 * Unit Economics Dashboard Submodule: Simulator Comparison Results.
 * Layer: forest (Presentation component)
 *
 * @module forest/economics/dashboard/simulator-results
 */

import React from 'react';
import type { CostArbitrageDecision } from '@/seed/types/unit-economics-types';
import { StageCostBreakdown } from './simulator-stage-breakdown';

interface SimulatorResultsProps {
  simResult: CostArbitrageDecision;
  cloudSimResult: CostArbitrageDecision;
  locale: 'vi' | 'en';
}

export function SimulatorResults({
  simResult,
  cloudSimResult,
  locale,
}: SimulatorResultsProps) {
  const isVi = locale === 'vi';

  return (
    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
      {/* Box 1: Hybrid Mekong Edge Arbitrage */}
      <div className="bg-zinc-950/80 border border-emerald-500/30 rounded-2xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-emerald-400 tracking-wider">
              {isVi ? 'Định Tuyến Tối Ưu (Hybrid Edge)' : 'Arbitraged Hybrid Routing'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {simResult.isMekongGpuAccelerated ? 'GPU Accelerated' : 'Cloud BYOK'}
            </span>
          </div>

          <div className="mt-4">
            <div className="text-4xl font-extrabold text-emerald-400">
              ${simResult.totalEstimatedCostUsd.toFixed(4)}
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              ${simResult.costPerSecondUsd.toFixed(6)}{' '}
              {isVi ? 'trên mỗi giây video' : 'per second'}
            </div>
          </div>

          <StageCostBreakdown
            decision={simResult}
            labels={{
              script: isVi ? 'Kịch bản (Script):' : 'Script Cost:',
              visuals: isVi ? 'Khung hình (Visuals):' : 'Visuals Cost:',
              audio: isVi ? 'Giọng đọc (Audio):' : 'Audio Cost:',
              render: isVi ? 'Dựng video (Render):' : 'Render Cost:',
            }}
          />
        </div>

        <div className="mt-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
          <span>{isVi ? 'Tiết kiệm so với Cloud:' : 'Savings vs Cloud:'}</span>
          <span className="font-bold font-mono">
            ${simResult.savingsVsCloudUsd.toFixed(4)} ({simResult.savingsPercentage}%)
          </span>
        </div>
      </div>

      {/* Box 2: Pure Cloud Baseline */}
      <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">
              {isVi ? 'Chuẩn Cloud Thuần Túy' : 'Pure Cloud Baseline'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
              100% BYOK
            </span>
          </div>

          <div className="mt-4">
            <div className="text-4xl font-extrabold text-zinc-200">
              ${cloudSimResult.totalEstimatedCostUsd.toFixed(4)}
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              ${cloudSimResult.costPerSecondUsd.toFixed(6)}{' '}
              {isVi ? 'trên mỗi giây video' : 'per second'}
            </div>
          </div>

          <StageCostBreakdown
            decision={cloudSimResult}
            labels={{
              script: isVi ? 'Kịch bản (DeepSeek):' : 'Script (DeepSeek):',
              visuals: isVi ? 'Khung hình (fal Flux):' : 'Visuals (fal Flux):',
              audio: isVi ? 'Giọng đọc (ElevenLabs):' : 'Audio (ElevenLabs):',
              render: isVi ? 'Dựng video (Worker):' : 'Render (Worker):',
            }}
          />
        </div>

        <div className="mt-6 p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400 flex items-center justify-between">
          <span>{isVi ? 'Chi phí cho 1,000 video:' : 'Cost for 1,000 videos:'}</span>
          <span className="font-bold font-mono text-zinc-200">
            ${(cloudSimResult.totalEstimatedCostUsd * 1000).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
