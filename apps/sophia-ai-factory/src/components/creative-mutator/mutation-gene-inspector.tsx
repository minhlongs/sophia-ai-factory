/**
 * @file mutation-gene-inspector.tsx
 * @description Side-by-side comparative inspector between parent and mutated gene
 * @layer UI Component
 */

'use client';

import React from 'react';
import type { MutationGene, MutationDelta } from '@/seed/types/creative-mutator-types';
import { Sparkles, Dna, Gauge } from 'lucide-react';

interface MutationGeneInspectorProps {
  parentGene?: MutationGene;
  offspringGene?: MutationGene;
  delta?: MutationDelta;
}

const DEFAULT_PARENT_GENE: MutationGene = {
  hookArchetype: 'STATISTIC_PAIN',
  hookScriptText: 'Here are 3 reasons why tool X might be slowing down your team.',
  visualStyle: 'Standard UI recording with screen capture zoom.',
  cameraMotion: 'Subtle slow zoom-in',
  pacingMultiplier: 1.0,
  ctaText: 'Link in bio for full review.',
};

const DEFAULT_OFFSPRING_GENE: MutationGene = {
  hookArchetype: 'POLARIZING_VERDICT',
  hookScriptText: 'Stop using tool X in 2026. You are literally burning 15 hours a week.',
  visualStyle: 'Cinematic fast-cut B-roll, red glitch transition.',
  cameraMotion: 'Dynamic push-in with macro focus',
  pacingMultiplier: 1.1,
  ctaText: 'Get the automation stack now.',
};

export function MutationGeneInspector({
  parentGene = DEFAULT_PARENT_GENE,
  offspringGene = DEFAULT_OFFSPRING_GENE,
}: MutationGeneInspectorProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Parent Gene Card */}
      <div className="p-5 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Dna className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-white">Parent Gene (G₀: Base Arm)</h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300">
            {parentGene.hookArchetype}
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="p-3 bg-slate-950/60 rounded border border-white/5">
            <span className="text-white/40 block font-semibold mb-1">Opening Hook (0–3s):</span>
            <p className="text-slate-200 italic font-medium">&ldquo;{parentGene.hookScriptText}&rdquo;</p>
          </div>

          <div className="p-3 bg-slate-950/60 rounded border border-white/5">
            <span className="text-white/40 block font-semibold mb-1">Visual Prompt & Motion:</span>
            <p className="text-slate-300">{parentGene.visualStyle}</p>
            <span className="text-slate-400 text-[11px] block mt-1 font-mono">
              Motion: {parentGene.cameraMotion}
            </span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-white/40 block font-semibold">Audio Tempo Pacing:</span>
              <p className="text-slate-300 font-mono mt-0.5">{parentGene.pacingMultiplier}x Natural Pace</p>
            </div>
            <Gauge className="w-5 h-5 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Mutated Gene Card */}
      <div className="p-5 rounded-xl bg-slate-900/60 backdrop-blur-md border border-amber-500/30 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-400">Darwinian Mutated Gene (G₁: Offspring)</h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            {offspringGene.hookArchetype}
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="p-3 bg-amber-950/20 rounded border border-amber-500/20">
            <span className="text-amber-400 block font-semibold mb-1">Opening Hook (0–3s) [MUTATED]:</span>
            <p className="text-slate-100 italic font-medium">&ldquo;{offspringGene.hookScriptText}&rdquo;</p>
          </div>

          <div className="p-3 bg-indigo-950/20 rounded border border-indigo-500/20">
            <span className="text-indigo-400 block font-semibold mb-1">Visual Prompt & Motion [MUTATED]:</span>
            <p className="text-slate-100">{offspringGene.visualStyle}</p>
            <span className="text-indigo-300 text-[11px] block mt-1 font-mono">
              Motion: {offspringGene.cameraMotion}
            </span>
          </div>

          <div className="p-3 bg-emerald-950/20 rounded border border-emerald-500/20 flex items-center justify-between">
            <div>
              <span className="text-emerald-400 block font-semibold">Audio Tempo Pacing [MUTATED]:</span>
              <p className="text-emerald-300 font-mono mt-0.5">{offspringGene.pacingMultiplier}x High-Energy Compression</p>
            </div>
            <Gauge className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
