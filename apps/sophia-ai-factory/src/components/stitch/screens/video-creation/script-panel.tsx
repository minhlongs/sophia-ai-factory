'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { MAX_CHARS } from './video-creation-types';

interface ScriptPanelProps {
  script: string;
  charCount: number;
  percentUsed: number;
  onScriptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onAIGenerate: () => void;
}

/**
 * Script editing panel with character count, AI generate button, and preview.
 */
export function ScriptPanel({
  script,
  charCount,
  percentUsed,
  onScriptChange,
  onAIGenerate,
}: ScriptPanelProps) {
  const t = useTranslations('stitch.video-creation');

  return (
    <div className="flex-1 flex flex-col">
      {/* Panel Header */}
      <div
        className="flex items-center justify-between border-b border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] px-6 py-4"
      >
        <h2 className="text-lg font-bold text-foreground dark:text-white">{t('scriptEditor')}</h2>
        <button
          type="button"
          onClick={onAIGenerate}
          className="group flex items-center gap-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 px-4 py-2 text-sm font-semibold transition-all hover:bg-amber-500/20"
          aria-label={t('aiGenerate')}
        >
          <Sparkles
            className="h-[18px] w-[18px] transition-transform group-hover:rotate-12"
            aria-hidden="true"
          />
          {t('aiGenerate')}
        </button>
      </div>

      {/* Panel Body */}
      <div className="space-y-6 p-6">
        <textarea
          value={script}
          onChange={onScriptChange}
          placeholder={t('scriptPlaceholder')}
          rows={6}
          className="stitch-scrollbar w-full resize-none rounded-lg border border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] p-4 text-foreground dark:text-white placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30"
          aria-label={t('scriptInput')}
        />

        {/* Generated Script Preview */}
        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('generatedPreview')}
          </h3>
          <div
            className="stitch-scrollbar max-h-64 overflow-y-auto rounded-lg border border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] p-4 leading-relaxed text-foreground/90 dark:text-slate-200 md:p-6"
          >
            {script.trim() ? (
              <p className="text-sm">{script}</p>
            ) : (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>{t('previewPlaceholder1')}</p>
                <p>{t('previewPlaceholder2')}</p>
                <p>{t('previewPlaceholder3')}</p>
                <p>{t('previewPlaceholder4')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Character Counter */}
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>{t('characterCount', { count: charCount, max: MAX_CHARS })}</span>
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 w-24 overflow-hidden rounded-full bg-muted dark:bg-white/[0.08]"
            >
              <div
                className={`h-2 rounded-full transition-all ${
                      percentUsed >= 90
                        ? 'bg-red-500/80'
                        : percentUsed >= 70
                          ? 'bg-amber-500/80'
                          : 'bg-primary'
                    }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <span className="font-mono font-medium text-foreground dark:text-white">{percentUsed}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
