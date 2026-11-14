/**
 * Storyboard Preview Card Component
 *
 * Displays generated 5-scene video storyboard breakdown, narration scripts,
 * visual generation prompts, and affiliate tracking metadata.
 * @module components/niche-studio/storyboard-preview-card
 */

// i18n-namespace: nicheStudio
'use client';

import React, { useState } from 'react';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';

interface StoryboardPreviewCardProps {
  plan: NicheVideoCampaignPlan;
  t: (key: string) => string;
}

export function StoryboardPreviewCard({ plan, t }: StoryboardPreviewCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(plan.trackedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <div className="space-y-4 bg-card dark:bg-zinc-900/60 p-5 rounded-xl border border-border dark:border-zinc-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-border dark:border-zinc-800">
        <div>
          <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400 uppercase font-semibold">
            {plan.blueprint.id}
          </span>
          <h2 className="text-base font-bold text-foreground dark:text-white mt-0.5">
            {plan.blueprint.name}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-muted dark:bg-zinc-800 text-foreground dark:text-zinc-300">
            {Math.round(plan.storyboard.totalDurationMs / 1000)}s (9:16)
          </span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded font-bold uppercase ${
              plan.compliance.isAllowed
                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
            }`}
          >
            {plan.compliance.jurisdiction}
          </span>
        </div>
      </div>

      {/* Affiliate Link Bar */}
      <div className="p-3 rounded-lg bg-muted/60 dark:bg-zinc-950 border border-border dark:border-zinc-800 flex items-center justify-between gap-3">
        <div className="truncate text-xs text-foreground dark:text-zinc-300">
          <span className="text-muted-foreground mr-1.5 font-mono">🔗</span>
          <span className="font-mono text-amber-800 dark:text-amber-400">{plan.trackedUrl}</span>
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          className="shrink-0 px-2.5 py-1 text-xs rounded bg-muted hover:bg-muted/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-foreground dark:text-zinc-200 border border-border dark:border-transparent transition-colors font-medium"
        >
          {copied ? t('copied') : t('copyLink')}
        </button>
      </div>

      {/* 5-Scene Storyboard Breakdown */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t('scenesTitle')} ({plan.storyboard.scenes.length})
        </h3>
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {plan.storyboard.scenes.map((scene, idx) => (
            <div
              key={scene.sceneIndex ?? idx}
              className="p-3 rounded-lg bg-muted/40 dark:bg-zinc-950/60 border border-border dark:border-zinc-800/80 hover:border-border/80 dark:hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-amber-800 dark:text-amber-400">
                  {idx + 1}. {scene.name}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {Math.round(scene.durationMs / 1000)}s
                </span>
              </div>
              <p className="text-xs text-foreground/90 dark:text-zinc-300 italic mb-2">
                &ldquo;{scene.narrationText}&rdquo;
              </p>
              <div className="text-[11px] text-muted-foreground bg-muted/60 p-2 rounded border border-border/60">
                <span className="text-foreground font-semibold block mb-0.5">🎨 Visual Prompt:</span>
                {scene.visualPrompt}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Caption & Hashtags */}
      <div className="pt-3 border-t border-border dark:border-zinc-800/80 text-xs">
        <span className="text-muted-foreground font-semibold block mb-1">{t('captionTitle')}</span>
        <p className="text-foreground dark:text-zinc-300 bg-muted/60 dark:bg-zinc-950 p-2.5 rounded border border-border dark:border-zinc-800/60 font-mono text-[11px]">
          {plan.caption}
        </p>
      </div>
    </div>
  );
}
