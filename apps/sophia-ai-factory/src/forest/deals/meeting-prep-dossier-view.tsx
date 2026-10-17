'use client';

/**
 * AI Meeting Prep Dossier Sections View
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/meeting-prep-dossier-view
 */

import React from 'react';
import { Building2, Target, Shield, DollarSign } from 'lucide-react';
import type { MeetingPrepDossier } from '@/seed/types/enterprise-deal';

export interface MeetingPrepDossierViewProps {
  dossier: MeetingPrepDossier;
}

export function MeetingPrepDossierView({ dossier }: MeetingPrepDossierViewProps) {
  return (
    <div className="space-y-6">
      {/* Snapshot Card */}
      <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
          <Building2 className="w-4 h-4" /> 1. Company & Stakeholders
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">{dossier.companyOverview}</p>
        <div className="text-xs text-zinc-400 pt-1 border-t border-zinc-800/60">
          <span className="font-semibold text-zinc-300">Decision Makers:</span>{' '}
          {dossier.keyStakeholders}
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
        <p className="text-sm text-zinc-300 leading-relaxed">
          {dossier.commercialRecommendation}
        </p>
      </div>
    </div>
  );
}
