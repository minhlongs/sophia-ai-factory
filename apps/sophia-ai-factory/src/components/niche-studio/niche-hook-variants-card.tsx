// i18n-namespace: nicheStudio
/**
 * Niche Hook Variants Card
 *
 * Displays generated psychological hook variants for A/B split testing.
 *
 * @module components/niche-studio/niche-hook-variants-card
 */

import React from 'react';
import type { HookVariantPackage } from '@/tree/video/ab-testing/hook-variant-types';

interface NicheHookVariantsCardProps {
  hookPackage: HookVariantPackage | null;
  selectedHookId: string | null;
  onSelectHook: (id: string) => void;
  t: (key: string) => string;
}

export function NicheHookVariantsCard({
  hookPackage,
  selectedHookId,
  onSelectHook,
  t,
}: NicheHookVariantsCardProps) {
  if (!hookPackage) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur text-center text-muted-foreground">
        <p className="text-sm">{t('hooksEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
        <div>
          <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
            <span>⚡</span> {t('hooksTitle')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('hooksSubtitle')}</p>
        </div>
        <span className="px-2.5 py-1 bg-primary/10 text-primary font-medium text-xs rounded-full">
          {hookPackage.variants.length} {t('variants')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {hookPackage.variants.map((v) => {
          const isSelected = (selectedHookId || hookPackage.recommendedVariantId) === v.id;
          const isRec = hookPackage.recommendedVariantId === v.id;

          return (
            <div
              key={v.id}
              onClick={() => onSelectHook(v.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer text-left space-y-2 ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40'
                  : 'border-border/60 bg-muted/20 hover:border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  {v.headline}
                  {isRec && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold rounded">
                      ★ {t('recommendedBadge')}
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-mono text-primary font-semibold">
                  {v.estimatedRetentionScore}% {t('retention')}
                </span>
              </div>

              <p className="text-xs text-foreground/80 italic line-clamp-2">
                &ldquo;{v.narration}&rdquo;
              </p>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span className="truncate max-w-[180px]">📺 {v.overlayText}</span>
                <span className="text-primary font-medium">
                  {isSelected ? `✓ ${t('selected')}` : t('select')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
