'use client';

/**
 * Deals Admin Dashboard Table View Component
 *
 * Layer: forest/deals
 *
 * @module app/components/deals/dashboard/deals-table-view
 */

import React from 'react';
import { Building2, Sparkles, FileText, Cpu } from 'lucide-react';
import type { EnterpriseDeal } from '@/seed/types/enterprise-deal';

export interface DealsTableViewProps {
  deals: EnterpriseDeal[];
  onSelectDeal: (deal: EnterpriseDeal) => void;
  onOpenMeetingPrep: (deal: EnterpriseDeal) => void;
  onOpenProposal: (deal: EnterpriseDeal) => void;
  onOpenSandbox: (deal: EnterpriseDeal) => void;
}

export function DealsTableView({
  deals,
  onSelectDeal,
  onOpenMeetingPrep,
  onOpenProposal,
  onOpenSandbox,
}: DealsTableViewProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3">Company &amp; Domain</th>
              <th className="px-4 py-3">Lead Contact</th>
              <th className="px-4 py-3">BANT Score</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Est. Value</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {deals.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                  No matching enterprise deals found.
                </td>
              </tr>
            ) : (
              deals.map((deal) => (
                <tr
                  key={deal.id}
                  onClick={() => onSelectDeal(deal)}
                  className="hover:bg-zinc-900/60 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                      {deal.companyName}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono">{deal.companyDomain}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-zinc-200">{deal.leadName}</div>
                    <div className="text-[11px] text-zinc-400">{deal.leadEmail}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-200">
                    {deal.bantScore}/100
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        deal.pipelineTier === 'hot'
                          ? 'bg-rose-500/10 text-rose-400'
                          : deal.pipelineTier === 'warm'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}
                    >
                      {deal.pipelineTier}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-300">
                    {deal.dealStage.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-400">
                    ${((deal.dealValueEstimateCents || 0) / 100).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="AI Dossier"
                        onClick={() => onOpenMeetingPrep(deal)}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-purple-400"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Generate Proposal"
                        onClick={() => onOpenProposal(deal)}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-blue-400"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Demo Sandbox"
                        onClick={() => onOpenSandbox(deal)}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
