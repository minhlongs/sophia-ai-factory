'use client';

/**
 * Deal Header and Quick Action Toolbar
 *
 * Layer: forest/deals/detail-drawer
 */

import React from 'react';
import {
  X,
  Building2,
  Cpu,
  Sparkles,
  FileText,
  RefreshCw,
} from 'lucide-react';
import type { EnterpriseDeal } from '@/seed/types/enterprise-deal';

interface DealHeaderProps {
  deal: EnterpriseDeal;
  onClose: () => void;
  onEnrich: () => Promise<void>;
  onOpenMeetingPrep: () => void;
  onOpenProposal: () => void;
  onOpenSandbox: () => void;
  isEnriching?: boolean;
}

export function DealHeader({
  deal,
  onClose,
  onEnrich,
  onOpenMeetingPrep,
  onOpenProposal,
  onOpenSandbox,
  isEnriching = false,
}: DealHeaderProps) {
  const tierBadge = {
    hot: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    warm: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    cold: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }[deal.pipelineTier];

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded border ${tierBadge}`}>
              {deal.pipelineTier.toUpperCase()} DEAL
            </span>
            <span className="text-xs text-zinc-400 font-mono">BANT {deal.bantScore}/100</span>
          </div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            {deal.companyName}
          </h2>
          <p className="text-xs text-zinc-400">{deal.companyDomain}</p>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          aria-label="Close drawer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Action Toolbar */}
      <div className="grid grid-cols-4 gap-2 px-6 py-3 bg-zinc-950/70 border-b border-zinc-800 text-[11px]">
        <button
          onClick={onEnrich}
          disabled={isEnriching}
          className="flex flex-col items-center gap-1 p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-emerald-400 ${isEnriching ? 'animate-spin' : ''}`} />
          <span>Enrich AI</span>
        </button>

        <button
          onClick={onOpenMeetingPrep}
          className="flex flex-col items-center gap-1 p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 transition"
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>AI Dossier</span>
        </button>

        <button
          onClick={onOpenProposal}
          className="flex flex-col items-center gap-1 p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 transition"
        >
          <FileText className="w-4 h-4 text-blue-400" />
          <span>Proposal</span>
        </button>

        <button
          onClick={onOpenSandbox}
          className="flex flex-col items-center gap-1 p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 transition"
        >
          <Cpu className="w-4 h-4 text-amber-400" />
          <span>Sandbox</span>
        </button>
      </div>
    </>
  );
}
