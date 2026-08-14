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
        className="flex items-center justify-between border-b px-6 py-4"
        style={{
          backgroundColor: '#1a1a21',
          borderColor: '#484750',
        }}
      >
        <h2 className="text-lg font-bold text-[#e7e4f0]">{t('scriptEditor')}</h2>
        <button
          type="button"
          onClick={onAIGenerate}
          className="group flex items-center gap-2 rounded-lg bg-[#25252e] px-4 py-2 text-sm text-[#e7e4f0] transition-all hover:bg-[#4e4f74]"
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
          className="stitch-scrollbar w-full resize-none rounded-lg border bg-black p-4 text-[#e7e4f0] placeholder-[#acaab5] outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#c3c3ee]"
          style={{ borderColor: '#484750' }}
          aria-label={t('scriptInput')}
        />

        {/* Generated Script Preview */}
        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#acaab5]">
            {t('generatedPreview')}
          </h3>
          <div
            className="stitch-scrollbar max-h-64 overflow-y-auto rounded-lg border p-4 leading-relaxed md:p-6"
            style={{
              backgroundColor: '#131318',
              borderColor: '#484750',
              color: 'rgba(231, 228, 240, 0.8)',
            }}
          >
            {script.trim() ? (
              <p className="text-sm">{script}</p>
            ) : (
              <div className="space-y-4 text-sm">
                <p>{t('previewPlaceholder1')}</p>
                <p>{t('previewPlaceholder2')}</p>
                <p>{t('previewPlaceholder3')}</p>
                <p>{t('previewPlaceholder4')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Character Counter */}
        <div className="flex items-center justify-between text-xs text-[#acaab5]">
          <span>{t('characterCount', { count: charCount, max: MAX_CHARS })}</span>
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 w-24 overflow-hidden rounded-full"
              style={{ backgroundColor: '#25252e' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${percentUsed}%`,
                  backgroundColor:
                    percentUsed >= 90
                      ? 'rgba(239, 68, 68, 0.6)'
                      : percentUsed >= 70
                        ? 'rgba(234, 179, 8, 0.6)'
                        : 'rgba(195, 195, 238, 0.4)',
                }}
              />
            </div>
            <span className="font-medium">{percentUsed}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
