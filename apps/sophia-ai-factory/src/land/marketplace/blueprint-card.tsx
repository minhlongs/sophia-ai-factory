'use client';

/**
 * Blueprint Card Component — Displays a community video template
 *
 * Layer: land (pure UI component)
 *
 * @module land/marketplace/blueprint-card
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import {
  Sparkles,
  Coins,
  Copy,
  Clock,
  CheckCircle,
  Video,
} from 'lucide-react';
import type { MarketplaceBlueprintItem } from '@/seed/types/creator-marketplace';
import { estimateBlueprintStudioCost } from '@/tree/marketplace/preflight-cost-engine';

export interface BlueprintCardProps {
  blueprint: MarketplaceBlueprintItem;
}

export function BlueprintCard({ blueprint }: BlueprintCardProps) {
  const t = useTranslations('blueprintMarketplace');

  // Estimate pre-flight cost
  const cost = estimateBlueprintStudioCost(
    blueprint.estimatedScenes,
    blueprint.estimatedDurationSeconds,
    3,
  );

  const cvrPercent = (blueprint.conversionRate * 100).toFixed(1);
  const royaltyPct = blueprint.royaltyPct ?? 10;
  const creator = blueprint.creatorId || 'anonymous';

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#12131A]/90 p-5 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-indigo-500/10">
      {/* Top Header Row: Niche + Platform */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-400 uppercase tracking-wide">
            {blueprint.niche}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
            {blueprint.targetPlatform.replace('_', ' ')}
          </span>
        </div>

        {/* Blueprint Title & Hook */}
        <div className="mt-3 space-y-1">
          <h3 className="text-base font-bold text-foreground line-clamp-1 group-hover:text-indigo-300 transition">
            {blueprint.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('card.hookStyle', { style: blueprint.hookStyle.replace(/_/g, ' ') })}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            {t('card.byCreator', { name: creator })}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-white/[0.03] p-2.5 border border-white/5 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{cvrPercent}% CVR</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium text-indigo-300">
            <Copy className="h-3.5 w-3.5 shrink-0" />
            <span>{t('card.remixes', { count: blueprint.remixCount })}</span>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{t('card.duration', { seconds: blueprint.estimatedDurationSeconds })}</span>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Video className="h-3.5 w-3.5 shrink-0" />
            <span>{t('card.scenes', { count: blueprint.estimatedScenes })}</span>
          </div>
        </div>

        {/* Cost & Royalty Summary */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
          <span className="flex items-center gap-1">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            {t('card.estimatedCost', { mcu: cost.totalMCU, usd: cost.estimatedUsd })}
          </span>
          <span className="font-medium text-indigo-400">
            {t('card.royalty', { rate: royaltyPct })}
          </span>
        </div>
      </div>

      {/* 1-Click Clone to Studio Action */}
      <div className="mt-5 pt-3 border-t border-white/5">
        <Link
          href={`/dashboard/missions/new?blueprintId=${blueprint.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t('card.cloneCta')}
        </Link>
      </div>
    </div>
  );
}
