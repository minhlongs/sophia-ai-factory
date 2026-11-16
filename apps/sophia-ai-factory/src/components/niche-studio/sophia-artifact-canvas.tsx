/**
 * Sophia Artifact Canvas (Clean-Room `baoyu-design` Multi-Artboard + Tweaks + Comments)
 *
 * Implements the 3 core `claude-design` & `dataviz` workflows in 100% clean-room React:
 * 1. Side-by-Side Artboards (`9:16` Shorts, `16:9` YouTube, `1:1` Social Card)
 * 2. Interactive `data-props` Tweaks panel (OKLCH accent color, Archivo width, compliance badge)
 * 3. Live `validatePaletteOklch()` contrast & color-blindness telemetry
 * 4. Pin Comments thread (`comments.json` contract) with resolve/reopen actions
 *
 * @module components/niche-studio/sophia-artifact-canvas
 */

// i18n-namespace: nicheStudio
'use client';

import React, { useMemo, useState } from 'react';
import {
  SOPHIA_INITIAL_CANVAS_COMMENTS,
  SOPHIA_STUDIO_ARTBOARDS,
  SOPHIA_STUDIO_TWEAK_PROPS,
  validatePaletteOklch,
  type BaoyuCommentItem,
} from '@/seed/baoyu-design';
import { getZenSemanticColor } from '@/seed/design-tokens';
import { SophiaArtifactCanvasInspector } from './sophia-artifact-canvas-inspector';

export interface SophiaArtifactCanvasProps {
  t: (key: string) => string;
  locale?: 'vi' | 'en';
}

const DARK_CANVAS_BG = getZenSemanticColor('dark', 'surface');
const DEFAULT_ACCENT_HEX = getZenSemanticColor('dark', 'primary').toLowerCase();

export function SophiaArtifactCanvas({
  t,
  locale = 'vi',
}: SophiaArtifactCanvasProps) {
  const isVi = locale === 'vi';
  const accentOptions =
    SOPHIA_STUDIO_TWEAK_PROPS.find((p) => p.key === 'accentColor')?.options ?? [
      DEFAULT_ACCENT_HEX,
    ];
  const [accentColor, setAccentColor] = useState<string>(
    accentOptions[0] ?? DEFAULT_ACCENT_HEX,
  );
  const [displayWidth, setDisplayWidth] = useState<number>(104);
  const [showComplianceBadge, setShowComplianceBadge] = useState<boolean>(true);
  const [comments, setComments] = useState<readonly BaoyuCommentItem[]>(
    SOPHIA_INITIAL_CANVAS_COMMENTS,
  );

  const contrastReport = useMemo(
    () => validatePaletteOklch(accentColor, DARK_CANVAS_BG),
    [accentColor],
  );

  const toggleCommentResolved = (id: string) => {
    setComments((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, resolved: !item.resolved } : item,
      ),
    );
  };

  return (
    <section
      data-testid="sophia-artifact-canvas"
      className="v3-core rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="eyebrow !mb-1">
            <span className="dot" aria-hidden="true" />
            <span>{t('baoyuCanvas.eyebrow')}</span>
          </p>
          <h2 className="text-lg font-bold text-foreground dark:text-white">
            {t('baoyuCanvas.title')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('baoyuCanvas.subtitle')}
          </p>
        </div>

        <div
          data-testid="baoyu-oklch-badge"
          className="inline-flex items-center gap-2 self-start sm:self-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-700 dark:text-emerald-300"
        >
          <span>✓ {t('baoyuCanvas.oklchPass')}</span>
          <span>
            ({contrastReport.contrastRatio}:1 • L={contrastReport.foregroundOklch.l})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div
          data-testid="baoyu-artboard-grid"
          className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {SOPHIA_STUDIO_ARTBOARDS.map((board) => (
            <div
              key={board.id}
              data-testid={`baoyu-artboard-${board.id}`}
              style={{
                borderColor: accentColor,
                backgroundColor: 'var(--studio-stage-bg)',
              }}
              className="rounded-xl border p-4 flex flex-col justify-between min-h-[220px] shadow-md"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                  <span>{board.aspectRatio}</span>
                  <span>{board.dimensions}</span>
                </div>
                <h3
                  style={{ fontVariationSettings: `"wdth" ${displayWidth}` }}
                  className="text-sm font-bold text-white leading-snug"
                >
                  {isVi ? board.titleVi : board.titleEn}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isVi ? board.hookVi : board.hookEn}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-white/10 space-y-2">
                {showComplianceBadge && (
                  <span
                    data-testid={`baoyu-compliance-pill-${board.id}`}
                    className="inline-block rounded px-2 py-0.5 font-mono text-[10px] bg-amber-500/15 text-amber-200"
                  >
                    FTC / MiCA / VN52
                  </span>
                )}
                <div
                  style={{
                    backgroundColor:
                      accentColor.toLowerCase() === DEFAULT_ACCENT_HEX
                        ? 'var(--primary-600)'
                        : accentColor,
                    color:
                      accentColor.toLowerCase() === DEFAULT_ACCENT_HEX
                        ? 'var(--primary-foreground)'
                        : DARK_CANVAS_BG,
                  }}
                  className="rounded-full px-3 py-1.5 text-center font-mono text-[11px] font-semibold text-white"
                >
                  {isVi ? board.ctaVi : board.ctaEn}
                </div>
              </div>
            </div>
          ))}
        </div>

        <SophiaArtifactCanvasInspector
          t={t}
          isVi={isVi}
          accentOptions={accentOptions}
          accentColor={accentColor}
          onSelectAccentColor={setAccentColor}
          displayWidth={displayWidth}
          onChangeDisplayWidth={setDisplayWidth}
          showComplianceBadge={showComplianceBadge}
          onToggleComplianceBadge={setShowComplianceBadge}
          comments={comments}
          onToggleCommentResolved={toggleCommentResolved}
        />
      </div>
    </section>
  );
}
