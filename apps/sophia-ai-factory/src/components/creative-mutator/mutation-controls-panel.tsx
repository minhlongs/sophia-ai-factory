/**
 * @file mutation-controls-panel.tsx
 * @description Evolutionary dial controls and manual mutation cycle trigger
 * @layer UI Component
 */

'use client';

import React, { useState } from 'react';
import type { MutationIntensity, TriggerReason } from '@/seed/types/creative-mutator-types';
import { Sliders, Flame, RefreshCw, CheckCircle2 } from 'lucide-react';

interface MutationControlsPanelProps {
  onTriggerMutation?: (params: {
    parentJobId: string;
    intensity: MutationIntensity;
    reason: TriggerReason;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function MutationControlsPanel({ onTriggerMutation }: MutationControlsPanelProps) {
  const [parentJobId, setParentJobId] = useState('job_saas_battle_demo');
  const [intensity, setIntensity] = useState<MutationIntensity>('MODERATE');
  const [reason, setReason] = useState<TriggerReason>('HOOK_FATIGUE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleTrigger = async () => {
    if (!onTriggerMutation) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await onTriggerMutation({ parentJobId, intensity, reason });
    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage('Mutation cycle dispatched successfully!');
    } else {
      setStatusMessage(res.error ?? 'Failed to trigger mutation.');
    }
  };

  return (
    <div className="p-5 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Mutation Breeding Dial Controls</h3>
        </div>
        <span className="text-[11px] text-amber-400 font-mono">Autonomous Darwinian Loop</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        {/* Parent Video Job ID */}
        <div>
          <label className="text-white/50 block font-medium mb-1">Parent Video Job ID</label>
          <input
            type="text"
            value={parentJobId}
            onChange={(e) => setParentJobId(e.target.value)}
            className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Mutation Intensity */}
        <div>
          <label className="text-white/50 block font-medium mb-1">Mutation Intensity</label>
          <select
            value={intensity}
            onChange={(e) => setIntensity(e.target.value as MutationIntensity)}
            className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500/50"
          >
            <option value="CONSERVATIVE">Conservative (1.04x, Subtle UI)</option>
            <option value="MODERATE">Moderate (1.08x, Cinematic B-Roll)</option>
            <option value="RADICAL">Radical (1.15x, Hyper-Kinetic Inversion)</option>
          </select>
        </div>

        {/* Trigger Reason */}
        <div>
          <label className="text-white/50 block font-medium mb-1">Evolutionary Trigger Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as TriggerReason)}
            className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500/50"
          >
            <option value="HOOK_FATIGUE">Hook Fatigue (&lt; 65 Score)</option>
            <option value="LOW_RETENTION">Low Retention (Drop-off &gt; 50%)</option>
            <option value="WINNING_ARM_EXPLORE">Winning Arm Exploration</option>
            <option value="MANUAL">Manual Creator Trigger</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        {statusMessage ? (
          <span className="text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {statusMessage}
          </span>
        ) : (
          <span className="text-[11px] text-white/40">
            Breeds 1 child generation variant with deterministic genetic mutation operator.
          </span>
        )}

        <button
          onClick={handleTrigger}
          disabled={isSubmitting}
          className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Flame className="w-4 h-4" />
          )}
          Trigger Mutation Cycle
        </button>
      </div>
    </div>
  );
}
