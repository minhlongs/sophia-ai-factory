/**
 * Unit Economics Simulator Stage Cost Breakdown Subcomponent.
 * Layer: forest (Presentation component)
 *
 * @module forest/economics/dashboard/simulator-stage-breakdown
 */

import React from 'react';
import type { CostArbitrageDecision } from '@/seed/types/unit-economics-types';

export interface StageCostBreakdownProps {
  decision: CostArbitrageDecision;
  labels: {
    script: string;
    visuals: string;
    audio: string;
    render: string;
  };
}

export function StageCostBreakdown({ decision, labels }: StageCostBreakdownProps) {
  return (
    <div className="mt-6 space-y-2 text-xs">
      <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800">
        <span>{labels.script}</span>
        <span className="text-zinc-200 font-mono">
          ${decision.selectedStages.script.estimatedCostUsd}
        </span>
      </div>
      <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800">
        <span>{labels.visuals}</span>
        <span className="text-zinc-200 font-mono">
          ${decision.selectedStages.visuals.estimatedCostUsd}
        </span>
      </div>
      <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800">
        <span>{labels.audio}</span>
        <span className="text-zinc-200 font-mono">
          ${decision.selectedStages.audio.estimatedCostUsd}
        </span>
      </div>
      <div className="flex justify-between text-zinc-400 py-1">
        <span>{labels.render}</span>
        <span className="text-zinc-200 font-mono">
          ${decision.selectedStages.render.estimatedCostUsd}
        </span>
      </div>
    </div>
  );
}
