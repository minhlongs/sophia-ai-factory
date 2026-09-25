'use client';

/**
 * AI Meeting Prep Dossier Modal
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/meeting-prep-modal
 */

import React, { useState } from 'react';
import { X, Copy, Check, Sparkles, Building2, Target, Shield, DollarSign } from 'lucide-react';
import type { EnterpriseDeal, MeetingPrepDossier } from '@/seed/types/enterprise-deal';

interface MeetingPrepModalProps {
  deal: EnterpriseDeal;
  dossier: MeetingPrepDossier | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerate: () => Promise<void>;
  isLoading?: boolean;
}

export function MeetingPrepModal({
  deal,
  dossier,
  isOpen,
  onClose,
  onGenerate,
  isLoading = false,
}: MeetingPrepModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!dossier?.fullBriefMarkdown) return;
    await navigator.clipboard.writeText(dossier.fullBriefMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Executive Sales Dossier & Demo Prep
              </h2>
              <p className="text-xs text-zinc-400">
                {deal.companyName} ({deal.companyDomain}) • BANT Score: {deal.bantScore}/100
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dossier && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Dossier'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!dossier ? (
            <div className="text-center py-12 space-y-4">
              <Building2 className="w-12 h-12 mx-auto text-zinc-600" />
              <div>
                <h3 className="text-base font-medium text-white">No Dossier Generated Yet</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                  Synthesize an executive briefing with company intelligence, pain points, objection battlecards, and commercial recommendations.
                </p>
              </div>
              <button
                onClick={onGenerate}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition"
              >
                {isLoading ? (
                  <>Generating Dossier...</>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate AI Dossier
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Snapshot Card */}
              <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <Building2 className="w-4 h-4" /> 1. Company & Stakeholders
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{dossier.companyOverview}</p>
                <div className="text-xs text-zinc-400 pt-1 border-t border-zinc-800/60">
                  <span className="font-semibold text-zinc-300">Decision Makers:</span> {dossier.keyStakeholders}
                </div>
              </div>

              {/* Pain Point Analysis */}
              <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                  <Target className="w-4 h-4" /> 2. Pain Points & Bottlenecks
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{dossier.painPointAnalysis}</p>
              </div>

              {/* Solution Blueprint */}
              <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                  <Shield className="w-4 h-4" /> 3. Sophia Solution Blueprint
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{dossier.proposedSolutionBlueprint}</p>
              </div>

              {/* Battlecards */}
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> 4. Competitive Battlecards & Objection Handling
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {dossier.battlecards.map((card, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2 text-xs"
                    >
                      <div className="font-semibold text-zinc-200">{card.competitorOrObjection}</div>
                      <div className="text-emerald-400 font-medium">{card.ourDifferentiator}</div>
                      <p className="text-zinc-400 leading-relaxed">{card.talkingPoint}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Commercial Terms */}
              <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <DollarSign className="w-4 h-4" /> 5. Commercial Recommendation
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{dossier.commercialRecommendation}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-3 bg-zinc-950 text-xs text-zinc-400">
          <span>Sophia Autonomous Sales Fleet • Model: GPT-4o Mini / Resilient Edge</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
