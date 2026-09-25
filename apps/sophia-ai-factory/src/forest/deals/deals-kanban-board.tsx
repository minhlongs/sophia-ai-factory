'use client';

/**
 * Enterprise Deals Kanban Board Component
 *
 * Visualizes pipeline deals across Hot (>=75), Warm (50-74), and Cold (<50) BANT tiers.
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/deals-kanban-board
 */

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
  ExternalLink,
} from 'lucide-react';
import type { EnterpriseDeal, PipelineTier } from '@/seed/types/enterprise-deal';

interface DealsKanbanBoardProps {
  deals: EnterpriseDeal[];
  onSelectDeal: (deal: EnterpriseDeal) => void;
  onOpenMeetingPrep: (deal: EnterpriseDeal) => void;
  onOpenProposal: (deal: EnterpriseDeal) => void;
  onOpenSandbox: (deal: EnterpriseDeal) => void;
}

interface ColumnConfig {
  tier: PipelineTier;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  headerClass: string;
  badgeClass: string;
}

const COLUMNS: ColumnConfig[] = [
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

export function DealsKanbanBoard({
  deals,
  onSelectDeal,
  onOpenMeetingPrep,
  onOpenProposal,
  onOpenSandbox,
}: DealsKanbanBoardProps) {
  const getDealsForTier = (tier: PipelineTier) =>
    deals.filter((d) => d.pipelineTier === tier);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
      {COLUMNS.map((col) => {
        const tierDeals = getDealsForTier(col.tier);
        const Icon = col.icon;
        const totalValue = tierDeals.reduce((sum, d) => sum + (d.dealValueEstimateCents || 0), 0);

        return (
          <div
            key={col.tier}
            className="flex flex-col rounded-xl bg-zinc-950/40 border border-zinc-800/80 overflow-hidden"
          >
            {/* Column Header */}
            <div className={`p-4 border-b ${col.headerClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5" />
                  <h3 className="font-bold text-sm text-white">{col.title}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-zinc-900 border border-zinc-700 text-zinc-300">
                    {tierDeals.length}
                  </span>
                </div>
                <span className="text-xs font-semibold text-zinc-200">
                  ${(totalValue / 100).toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">{col.subtitle}</p>
            </div>

            {/* Cards Container */}
            <div className="p-3 space-y-3 min-h-[400px]">
              {tierDeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-600 text-xs">
                  <span>No deals in this tier</span>
                </div>
              ) : (
                tierDeals.map((deal) => (
                  <div
                    key={deal.id}
                    onClick={() => onSelectDeal(deal)}
                    className="p-4 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 hover:shadow-lg hover:shadow-black/40 transition cursor-pointer group space-y-3"
                  >
                    {/* Top Row: Company & BANT Score */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-white text-sm group-hover:text-emerald-400 transition flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-zinc-400" />
                          {deal.companyName}
                        </h4>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          {deal.companyDomain}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${col.badgeClass}`}>
                          {deal.bantScore} pts
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Contact & Value */}
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

                    {/* Stage & Quick Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 capitalize text-[10px]">
                        {deal.dealStage.replace('_', ' ')}
                      </span>

                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
