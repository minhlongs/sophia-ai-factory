'use client';

/**
 * Creator Template Card Media & Quality Header Component
 *
 * Layer: land
 *
 * @module land/marketplace/template-card/card-media-preview
 */

import React from 'react';
import { Sparkles, Star, Play, TrendingUp } from 'lucide-react';
import type { CreatorTemplateItem } from '@/tree/marketplace/types';

export interface CardMediaPreviewProps {
  template: CreatorTemplateItem;
}

export function CardMediaPreview({ template }: CardMediaPreviewProps) {
  return (
    <div>
      {/* Header tags */}
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-400 uppercase tracking-wide">
          {template.niche}
        </span>
        <div className="flex items-center gap-1.5">
          {template.quality_score >= 75 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <Sparkles className="h-3 w-3" />
              Score {Math.round(template.quality_score)}
            </span>
          )}
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
            {template.target_platform.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Title & Hook */}
      <div className="mt-3 space-y-1">
        <h3 className="text-base font-bold text-foreground line-clamp-1 group-hover:text-indigo-300 transition">
          {template.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 italic">
          &ldquo;{template.script_template.slice(0, 100)}...&rdquo;
        </p>
      </div>

      {/* Ratings & Usage Velocity */}
      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1 text-amber-400">
          <Star className="h-3.5 w-3.5 fill-amber-400" />
          <span className="font-semibold">{template.rating > 0 ? template.rating.toFixed(1) : 'New'}</span>
          <span className="text-muted-foreground text-[11px]">({template.review_count})</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Play className="h-3.5 w-3.5 text-indigo-400" />
            <span>{template.use_count} uses</span>
          </div>
          {template.trendingScore !== undefined && template.trendingScore > 0 && (
            <div className="flex items-center gap-1 text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{template.trendingScore.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
