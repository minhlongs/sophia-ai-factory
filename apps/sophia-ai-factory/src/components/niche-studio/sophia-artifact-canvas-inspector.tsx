/**
 * Sophia Artifact Canvas Inspector (Tweaks Panel & Pin Comments Thread)
 *
 * Extracted from `sophia-artifact-canvas.tsx` to keep each Niche Studio module
 * concise and maintainable (<200 LOC).
 *
 * @module components/niche-studio/sophia-artifact-canvas-inspector
 */

// i18n-namespace: nicheStudio
'use client';

import React from 'react';
import type { BaoyuCommentItem } from '@/seed/baoyu-design';

export interface SophiaArtifactCanvasInspectorProps {
  t: (key: string) => string;
  isVi: boolean;
  accentOptions: readonly string[];
  accentColor: string;
  onSelectAccentColor: (hex: string) => void;
  displayWidth: number;
  onChangeDisplayWidth: (width: number) => void;
  showComplianceBadge: boolean;
  onToggleComplianceBadge: (checked: boolean) => void;
  comments: readonly BaoyuCommentItem[];
  onToggleCommentResolved: (id: string) => void;
}

export function SophiaArtifactCanvasInspector({
  t,
  isVi,
  accentOptions,
  accentColor,
  onSelectAccentColor,
  displayWidth,
  onChangeDisplayWidth,
  showComplianceBadge,
  onToggleComplianceBadge,
  comments,
  onToggleCommentResolved,
}: SophiaArtifactCanvasInspectorProps) {
  return (
    <div className="lg:col-span-4 space-y-4">
      {/* Tweaks Panel (data-props) */}
      <div
        data-testid="baoyu-tweaks-panel"
        className="rounded-xl border border-border bg-muted/40 p-4 space-y-3"
      >
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
          {t('baoyuCanvas.tweaksTitle')}
        </h3>

        <div className="space-y-1.5">
          <span className="block text-xs text-muted-foreground">
            {t('baoyuCanvas.accentLabel')}
          </span>
          <div className="flex items-center gap-2">
            {accentOptions.map((colorHex) => (
              <button
                key={colorHex}
                type="button"
                data-testid={`baoyu-tweak-color-${colorHex.replace('#', '')}`}
                onClick={() => onSelectAccentColor(colorHex)}
                aria-pressed={accentColor === colorHex}
                className={`px-2.5 py-1 rounded-md font-mono text-xs border transition-all ${
                  accentColor === colorHex
                    ? 'border-primary bg-primary/15 text-foreground dark:text-white font-bold'
                    : 'border-border text-muted-foreground hover:text-foreground dark:hover:text-white'
                }`}
              >
                {colorHex}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="baoyu-display-width-slider"
            className="flex items-center justify-between text-xs text-muted-foreground"
          >
            <span>{t('baoyuCanvas.widthLabel')}</span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400">
              {displayWidth}
            </span>
          </label>
          <input
            id="baoyu-display-width-slider"
            data-testid="baoyu-tweak-width-slider"
            type="range"
            min={100}
            max={112}
            value={displayWidth}
            aria-valuetext={`${displayWidth}% width`}
            onChange={(e) => onChangeDisplayWidth(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-foreground dark:text-slate-200 cursor-pointer pt-1">
          <input
            data-testid="baoyu-tweak-compliance-checkbox"
            type="checkbox"
            checked={showComplianceBadge}
            onChange={(e) => onToggleComplianceBadge(e.target.checked)}
            className="rounded border-border accent-indigo-500"
          />
          <span>{t('baoyuCanvas.complianceToggle')}</span>
        </label>
      </div>

      {/* Pin Comments (comments.json) */}
      <div
        data-testid="baoyu-comments-panel"
        className="rounded-xl border border-border bg-muted/40 p-4 space-y-2.5"
      >
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-primary-text">
          {t('baoyuCanvas.commentsTitle')}
        </h3>
        <ul className="space-y-2">
          {comments.map((cmt) => (
            <li
              key={cmt.id}
              data-testid={`baoyu-comment-${cmt.id}`}
              className="rounded-lg border border-border/60 dark:border-white/10 p-2.5 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="text-amber-800 dark:text-amber-300 font-semibold">
                  {cmt.author}
                </span>
                <button
                  type="button"
                  data-testid={`baoyu-comment-toggle-${cmt.id}`}
                  onClick={() => onToggleCommentResolved(cmt.id)}
                  className="underline text-primary-text hover:text-foreground dark:hover:text-white"
                >
                  {cmt.resolved ? t('baoyuCanvas.reopenBtn') : t('baoyuCanvas.resolveBtn')}
                </button>
              </div>
              <p
                className={
                  cmt.resolved
                    ? 'line-through text-muted-foreground'
                    : 'text-foreground dark:text-slate-200'
                }
              >
                {isVi ? cmt.textVi : cmt.textEn}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
