'use client';

import React from 'react';
import {
  Building2,
  DollarSign,
  User,
  Sparkles,
  FileText,
  Cpu,
  Flame,
  Zap,
  Snowflake,
} from 'lucide-react';
import type { EnterpriseDeal, PipelineTier } from '@/seed/types/enterprise-deal';

export interface ColumnConfig {
  tier: PipelineTier;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  headerClass: string;
  badgeClass: string;
}

export const KANBAN_COLUMNS: ColumnConfig[] = [
  {
    tier: 'hot',
    title: 'Hot Deals',
    subtitle: 'BANT Score ≥ 75 • Priority Executive Outreach',
    icon: Flame,
    headerClass: 'border-rose-500/30 bg-rose-500/5 text-rose-400',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  {
    tier: 'warm',
    title: 'Warm Deals',
    subtitle: 'BANT Score 50–74 • Discovery & Nurturing',
    icon: Zap,
    headerClass: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  {
    tier: 'cold',
    title: 'Cold Deals',
    subtitle: 'BANT Score < 50 • Automated Educational Drip',
    icon: Snowflake,
    headerClass: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
];

export function DealKanbanCard({
  deal,
  badgeClass,
  onSelectDeal,
  onOpenMeetingPrep,
  onOpenProposal,
  onOpenSandbox,
}: {
  deal: EnterpriseDeal;
  badgeClass: string;
  onSelectDeal: (deal: EnterpriseDeal) => void;
  onOpenMeetingPrep: (deal: EnterpriseDeal) => void;
  onOpenProposal: (deal: EnterpriseDeal) => void;
  onOpenSandbox: (deal: EnterpriseDeal) => void;
}) {
  return (
    <div
      onClick={() => onSelectDeal(deal)}
      className="p-4 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 hover:shadow-lg hover:shadow-black/40 transition cursor-pointer group space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-white text-sm group-hover:text-emerald-400 transition flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-zinc-400" />
            {deal.companyName}
          </h4>
          <span className="text-[11px] text-zinc-400 font-mono">{deal.companyDomain}</span>
        </div>
        <div className="text-right">
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${badgeClass}`}>
            {deal.bantScore} pts
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-300 pt-1 border-t border-zinc-800/60">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <User className="w-3.5 h-3.5" />
          <span className="truncate max-w-[130px]">{deal.leadName}</span>
        </div>
        <div className="flex items-center gap-1 font-semibold text-emerald-400">
          <DollarSign className="w-3.5 h-3.5" />
          <span>${((deal.dealValueEstimateCents || 0) / 100).toLocaleString()}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px]">
        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 capitalize text-[10px]">
          {deal.dealStage.replace('_', ' ')}
        </span>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            title="Generate AI Dossier"
            onClick={() => onOpenMeetingPrep(deal)}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-purple-400 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          <button
            title="Generate Proposal"
            onClick={() => onOpenProposal(deal)}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 transition"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
          <button
            title="Activate Demo Sandbox"
            onClick={() => onOpenSandbox(deal)}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition"
          >
            <Cpu className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
