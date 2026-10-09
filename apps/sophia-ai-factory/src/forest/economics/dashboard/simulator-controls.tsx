/**
 * Unit Economics Dashboard Submodule: Simulator Input Controls.
 * Layer: forest (Presentation component)
 *
 * @module forest/economics/dashboard/simulator-controls
 */

import React from 'react';
import type { CostArbitrageDecision } from '@/seed/types/unit-economics-types';

interface SimulatorControlsProps {
  simDuration: number;
  onDurationChange: (duration: number) => void;
  simBypassEdge: boolean;
  onBypassEdgeChange: (bypass: boolean) => void;
  simResult: CostArbitrageDecision;
  locale: 'vi' | 'en';
}

export function SimulatorControls({
  simDuration,
  onDurationChange,
  simBypassEdge,
  onBypassEdgeChange,
  simResult,
  locale,
}: SimulatorControlsProps) {
  const isVi = locale === 'vi';

  return (
    <div className="space-y-6 bg-zinc-950/60 border border-zinc-800 rounded-xl p-5">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300 block mb-2">
          {isVi
            ? `Thời lượng video: ${simDuration} giây`
            : `Video Duration: ${simDuration} seconds`}
        </label>
        <input
          type="range"
          min="10"
          max="90"
          step="5"
          value={simDuration}
          onChange={(e) => onDurationChange(Number(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <div className="flex justify-between text-[11px] text-zinc-500 mt-1 font-mono">
          <span>10s</span>
          <span>30s</span>
          <span>60s</span>
          <span>90s</span>
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-800">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={simBypassEdge}
            onChange={(e) => onBypassEdgeChange(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-900"
          />
          <div>
            <span className="text-sm font-medium text-zinc-200">
              {isVi
                ? 'Bỏ qua Mekong GPU (Cloud thuần túy)'
                : 'Bypass Mekong GPU (Pure Cloud)'}
            </span>
            <p className="text-xs text-zinc-500">
              {isVi
                ? 'Mô phỏng trường hợp tất cả nút GPU đều offline'
                : 'Force all stages to cloud BYOK'}
            </p>
          </div>
        </label>
      </div>

      <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800 text-xs space-y-2">
        <div className="font-semibold text-zinc-300 mb-1">
          {isVi ? 'Cấu hình định tuyến:' : 'Routing Matrix:'}
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>{isVi ? 'Kịch bản:' : 'Script:'}</span>
          <span className="text-zinc-200 font-mono">
            {simResult.selectedStages.script.model}
          </span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>{isVi ? 'Khung hình:' : 'Visuals:'}</span>
          <span className="text-zinc-200 font-mono">
            {simResult.selectedStages.visuals.model}
          </span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>{isVi ? 'Giọng đọc:' : 'Audio:'}</span>
          <span className="text-zinc-200 font-mono">
            {simResult.selectedStages.audio.model}
          </span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>{isVi ? 'Dựng video:' : 'Render:'}</span>
          <span className="text-zinc-200 font-mono">
            {simResult.selectedStages.render.model}
          </span>
        </div>
      </div>
    </div>
  );
}
