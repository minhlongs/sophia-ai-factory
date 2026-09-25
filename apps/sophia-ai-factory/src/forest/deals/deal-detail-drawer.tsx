'use client';

/**
 * Enterprise Deal Detail Drawer
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/deal-detail-drawer
 */

import React, { useState } from 'react';
import {
  X,
  Building2,
  Mail,
  Phone,
  DollarSign,
  Cpu,
  Sparkles,
  FileText,
  ShieldCheck,
  Globe,
  Tag,
  Clock,
  User,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type {
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
  DealStage,
} from '@/seed/types/enterprise-deal';

interface DealDetailDrawerProps {
  deal: EnterpriseDeal | null;
  enrichment: EnterpriseLeadEnrichment | null;
  isOpen: boolean;
  onClose: () => void;
  onStageChange: (stage: DealStage) => Promise<void>;
  onEnrich: () => Promise<void>;
  onOpenMeetingPrep: () => void;
  onOpenProposal: () => void;
  onOpenSandbox: () => void;
  isEnriching?: boolean;
}

export function DealDetailDrawer({
  deal,
  enrichment,
  isOpen,
  onClose,
  onStageChange,
  onEnrich,
  onOpenMeetingPrep,
  onOpenProposal,
  onOpenSandbox,
  isEnriching = false,
}: DealDetailDrawerProps) {
  const [updatingStage, setUpdatingStage] = useState(false);

  if (!isOpen || !deal) return null;

  const handleStageSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      setUpdatingStage(true);
      await onStageChange(e.target.value as DealStage);
    } finally {
      setUpdatingStage(false);
    }
  };

  const tierBadge = {
    hot: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    warm: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    cold: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }[deal.pipelineTier];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl h-full bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col text-zinc-100 overflow-hidden">
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Stage Changer */}
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
            <label className="block text-zinc-400 font-medium">Deal Pipeline Stage</label>
            <select
              value={deal.dealStage}
              disabled={updatingStage}
              onChange={handleStageSelect}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-medium capitalize"
            >
              <option value="new_lead">New Lead</option>
              <option value="enriching">Enriching</option>
              <option value="qualified">Qualified</option>
              <option value="demo_prepared">Demo Prepared</option>
              <option value="demo_active">Demo Active (Sandbox)</option>
              <option value="proposal_sent">Proposal Sent</option>
              <option value="negotiating">Negotiating</option>
              <option value="closed_won">Closed Won 🎉</option>
              <option value="closed_lost">Closed Lost</option>
            </select>
          </div>

          {/* BANT 4-Factor Breakdown */}
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> BANT Qualification Matrix
              </span>
              <span className="text-base font-bold text-white">{deal.bantScore}/100</span>
            </div>

            <div className="space-y-2.5">
              {/* Budget */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Budget (ARR &amp; MCU)</span>
                  <span className="font-mono text-zinc-200">{deal.bantBudgetScore}/25</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(deal.bantBudgetScore / 25) * 100}%` }}
                  />
                </div>
              </div>

              {/* Authority */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Authority (Role &amp; Domain)</span>
                  <span className="font-mono text-zinc-200">{deal.bantAuthorityScore}/25</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(deal.bantAuthorityScore / 25) * 100}%` }}
                  />
                </div>
              </div>

              {/* Need */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Need (Workload &amp; Dubbing)</span>
                  <span className="font-mono text-zinc-200">{deal.bantNeedScore}/25</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${(deal.bantNeedScore / 25) * 100}%` }}
                  />
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Timeline (Urgency)</span>
                  <span className="font-mono text-zinc-200">{deal.bantTimelineScore}/25</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${(deal.bantTimelineScore / 25) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {deal.bantAnalysis?.recommendation && (
              <p className="p-3 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] leading-relaxed">
                💡 <span className="font-semibold text-zinc-200">AI Next Step:</span> {deal.bantAnalysis.recommendation}
              </p>
            )}
          </div>

          {/* Lead Stakeholder Details */}
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
            <span className="font-semibold text-zinc-200 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" /> Stakeholder Information
            </span>
            <div className="grid grid-cols-2 gap-3 text-zinc-300">
              <div>
                <span className="text-zinc-500 block text-[11px]">Full Name</span>
                <span className="font-medium text-white">{deal.leadName}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px]">Job Title</span>
                <span>{deal.leadTitle || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <Mail className="w-3.5 h-3.5 text-zinc-500" />
                <a href={`mailto:${deal.leadEmail}`} className="text-blue-400 hover:underline">
                  {deal.leadEmail}
                </a>
              </div>
              {deal.leadPhone && (
                <div className="flex items-center gap-1.5 col-span-2">
                  <Phone className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{deal.leadPhone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Enriched Intelligence */}
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-200 flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" /> Enriched Organization Intelligence
              </span>
              {enrichment && (
                <span className="text-[10px] text-zinc-400 font-mono">
                  Source: {enrichment.enrichmentSource}
                </span>
              )}
            </div>

            {enrichment ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-zinc-300">
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Industry</span>
                    <span>{enrichment.industry || 'Technology'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Employee Scale</span>
                    <span>{enrichment.employeeCountRange || '50-250'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Est. Revenue</span>
                    <span>{enrichment.estimatedAnnualRevenue || '$10M-$50M'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Location</span>
                    <span>{enrichment.headquartersLocation || 'APAC'}</span>
                  </div>
                </div>

                {enrichment.techStack.length > 0 && (
                  <div>
                    <span className="text-zinc-500 block text-[11px] mb-1.5">Detected Tech Stack</span>
                    <div className="flex flex-wrap gap-1.5">
                      {enrichment.techStack.map((tech, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-zinc-500 italic">No enrichment recorded yet. Click &apos;Enrich AI&apos; above.</p>
            )}
          </div>

          {/* Commercial Estimates */}
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
            <span className="font-semibold text-zinc-200 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Commercial Terms
            </span>
            <div className="grid grid-cols-2 gap-3 text-zinc-300">
              <div>
                <span className="text-zinc-500 block text-[11px]">Estimated Contract Value</span>
                <span className="text-base font-bold text-white">
                  ${((deal.dealValueEstimateCents || 0) / 100).toLocaleString()} {deal.currency}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px]">Monthly MCUs Requested</span>
                <span className="text-base font-bold text-white">
                  {deal.requestedMcuMonthly.toLocaleString()} MCU
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
