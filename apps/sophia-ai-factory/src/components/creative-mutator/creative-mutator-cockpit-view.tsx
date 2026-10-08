/**
 * @file creative-mutator-cockpit-view.tsx
 * @description Master cockpit view for Darwinian Creative Auto-Mutator
 * @layer UI Component
 */

'use client';

import React, { useState } from 'react';
import type { CreativeMutationRecord } from '@/seed/types/creative-mutator-types';
import { MutationKpiSummary } from './mutation-kpi-summary';
import { LineageTreeVisualizer } from './lineage-tree-visualizer';
import { MutationGeneInspector } from './mutation-gene-inspector';
import { MutationControlsPanel } from './mutation-controls-panel';
import { Dna } from 'lucide-react';

interface CreativeMutatorCockpitViewProps {
  initialMutations: CreativeMutationRecord[];
  onTriggerMutation?: (params: {
    parentJobId: string;
    intensity: 'CONSERVATIVE' | 'MODERATE' | 'RADICAL';
    reason: 'HOOK_FATIGUE' | 'LOW_RETENTION' | 'WINNING_ARM_EXPLORE' | 'MANUAL';
  }) => Promise<{ success: boolean; error?: string }>;
}

export function CreativeMutatorCockpitView({
  initialMutations,
  onTriggerMutation,
}: CreativeMutatorCockpitViewProps) {
  const [mutations] = useState<CreativeMutationRecord[]>(initialMutations);
  const activeRecord = mutations[0];

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Dna className="w-5 h-5 text-amber-400" />
              Darwinian Creative Auto-Mutator Cockpit
            </h1>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Tự động sinh biến thể kịch bản mở đầu, hoán đổi prompt visual và nén nhịp độ âm thanh cho video bão hòa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
            Obsidian Cyber-Glass v3.2
          </span>
        </div>
      </div>

      {/* 1. Executive KPI Summary Cards */}
      <MutationKpiSummary
        activeLineagesCount={mutations.length > 0 ? mutations.length : 18}
        avgHookDeltaPercent={24.6}
        offspringWinRatePercent={68.2}
        mcuSavedCount={4200}
      />

      {/* 2. Controls Panel */}
      <MutationControlsPanel onTriggerMutation={onTriggerMutation} />

      {/* 3. Lineage Tree Visualizer */}
      <LineageTreeVisualizer
        parentJobId={activeRecord?.parentJobId ?? 'job_saas_battle_demo'}
        offspringJobId={activeRecord?.offspringJobId ?? 'job_gen1_polarizing'}
        parentFitness={activeRecord?.parentFitness ?? 64.2}
        offspringFitness={activeRecord?.offspringFitness ?? 86.5}
      />

      {/* 4. Mutation Diff & Gene Inspector */}
      <MutationGeneInspector
        parentGene={activeRecord?.parentGene}
        offspringGene={activeRecord?.offspringGene}
        delta={activeRecord?.delta}
      />
    </div>
  );
}
