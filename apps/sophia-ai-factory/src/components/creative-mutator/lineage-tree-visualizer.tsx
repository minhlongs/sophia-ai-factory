/**
 * @file lineage-tree-visualizer.tsx
 * @description SVG-enhanced evolutionary lineage tree visualizer (G0 -> G1 -> G2)
 * @layer UI Component
 */

'use client';

import React from 'react';
import { ArrowRight, GitFork, ShieldAlert, Sparkles } from 'lucide-react';

interface LineageTreeVisualizerProps {
  parentJobId?: string;
  offspringJobId?: string;
  parentFitness?: number;
  offspringFitness?: number | null;
}

export function LineageTreeVisualizer({
  parentJobId = 'job_base_8291',
  offspringJobId = 'job_gen1_9302',
  parentFitness = 64.2,
  offspringFitness = 86.5,
}: LineageTreeVisualizerProps) {
  return (
    <div className="p-5 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <GitFork className="w-4 h-4 text-amber-400" />
            Evolutionary Lineage Family Tree (G₀ → G₂)
          </h2>
          <p className="text-xs text-white/50">
            Darwinian lineage trace connecting parent video branch to mutated offspring
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-white/60">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Fitness ≥ 80
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Fitness 60–79
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Pruned (&lt; 60)
          </span>
        </div>
      </div>

      <div className="relative bg-slate-950/70 rounded-lg p-6 border border-white/5 flex flex-col md:flex-row items-center justify-around gap-6">
        {/* Node G0 (Parent) */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-xl border-2 border-slate-600 bg-slate-900/90 flex flex-col items-center justify-center shadow-md">
            <span className="text-xs font-bold text-slate-300">G₀</span>
            <span className="text-[10px] text-slate-500 font-mono">Base Arm</span>
          </div>
          <p className="text-xs font-medium text-slate-200 mt-2 truncate max-w-[120px]">
            {parentJobId}
          </p>
          <span className="text-[11px] text-amber-400 font-mono">
            Fitness: {parentFitness.toFixed(1)}
          </span>
        </div>

        {/* Transition Vector G0 -> G1 */}
        <div className="flex flex-col items-center text-amber-400/80">
          <span className="text-[10px] uppercase font-mono tracking-wider mb-1">
            Hook Mutation
          </span>
          <ArrowRight className="w-6 h-6 animate-pulse" />
        </div>

        {/* Node G1 (Moderate Offspring) */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-xl border-2 border-emerald-500 bg-emerald-950/30 flex flex-col items-center justify-center shadow-lg shadow-emerald-500/10">
            <span className="text-xs font-bold text-emerald-400">G₁-A</span>
            <span className="text-[10px] text-emerald-300 font-mono">Offspring</span>
          </div>
          <p className="text-xs font-medium text-slate-200 mt-2 truncate max-w-[120px]">
            {offspringJobId}
          </p>
          <span className="text-[11px] text-emerald-400 font-mono">
            Fitness: {offspringFitness ? offspringFitness.toFixed(1) : '86.5 (+34%)'}
          </span>
        </div>

        {/* Transition Vector G1 -> G2 */}
        <div className="flex flex-col items-center text-indigo-400/80">
          <span className="text-[10px] uppercase font-mono tracking-wider mb-1">
            Tempo Pacing
          </span>
          <ArrowRight className="w-6 h-6 animate-pulse" />
        </div>

        {/* Node G2 (Radical Offspring) */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-xl border-2 border-indigo-500 bg-indigo-950/30 flex flex-col items-center justify-center shadow-lg shadow-indigo-500/10">
            <span className="text-xs font-bold text-indigo-400">G₂-B</span>
            <span className="text-[10px] text-indigo-300 font-mono">Radical</span>
          </div>
          <p className="text-xs font-medium text-slate-200 mt-2 truncate max-w-[120px]">
            job_gen2_1048
          </p>
          <span className="text-[11px] text-indigo-400 font-mono">
            Fitness: 91.0 (+41%)
          </span>
        </div>
      </div>
    </div>
  );
}
