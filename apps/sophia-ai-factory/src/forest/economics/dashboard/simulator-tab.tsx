/**
 * Unit Economics Dashboard Submodule: Simulator Tab.
 * Layer: forest (Presentation component)
 *
 * @module forest/economics/dashboard/simulator-tab
 */

import React, { useState, useMemo } from 'react';
import { Zap } from 'lucide-react';
import { routeMultimodalCostArbitrage } from '@/tree/ai/multimodal-cost-router';
import { SimulatorControls } from './simulator-controls';
import { SimulatorResults } from './simulator-results';

interface SimulatorTabProps {
  locale: 'vi' | 'en';
}

export function SimulatorTab({ locale }: SimulatorTabProps) {
  const [simDuration, setSimDuration] = useState<number>(30);
  const [simBypassEdge, setSimBypassEdge] = useState<boolean>(false);

  const isVi = locale === 'vi';

  // Live simulation for video arbitrage calculator
  const simResult = useMemo(() => {
    return routeMultimodalCostArbitrage({
      targetDurationSeconds: simDuration,
      bypassEdge: simBypassEdge,
    });
  }, [simDuration, simBypassEdge]);

  // Pure cloud baseline for simulator comparison
  const cloudSimResult = useMemo(() => {
    return routeMultimodalCostArbitrage({
      targetDurationSeconds: simDuration,
      bypassEdge: true,
    });
  }, [simDuration]);

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          {isVi
            ? 'Công Cụ Mô Phỏng Giá Vốn Chiến Dịch (Campaign Cost Simulator)'
            : 'Interactive Campaign Cost & Arbitrage Simulator'}
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          {isVi
            ? 'Thay đổi thời lượng video để xem tính toán chi phí thực tế và tỷ lệ tiết kiệm giữa Cloud thuần túy vs Hybrid Edge'
            : 'Simulate per-second costs and savings across video durations comparing Pure Cloud vs Hybrid Mekong Edge'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <SimulatorControls
          simDuration={simDuration}
          onDurationChange={setSimDuration}
          simBypassEdge={simBypassEdge}
          onBypassEdgeChange={setSimBypassEdge}
          simResult={simResult}
          locale={locale}
        />

        <SimulatorResults
          simResult={simResult}
          cloudSimResult={cloudSimResult}
          locale={locale}
        />
      </div>
    </div>
  );
}
