'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import { Textarea } from '@/seed/components/ui/textarea';
import { ImageModelSelector } from './image-model-selector';
import type { Tier } from '@/seed/types';

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3'] as const;
type AspectRatio = (typeof ASPECT_RATIOS)[number];

const MAX_PROMPT_CHARS = 2000;

interface ImagePromptFormProps {
  prompt: string;
  onPromptChange: (v: string) => void;
  model: string;
  onModelChange: (v: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  tier: Tier;
}

export function ImagePromptForm({
  prompt,
  onPromptChange,
  model,
  onModelChange,
  aspectRatio,
  onAspectRatioChange,
  onSubmit,
  isLoading,
  tier,
}: ImagePromptFormProps) {
  const t = useTranslations('creativeStudio.image');
  const charsLeft = MAX_PROMPT_CHARS - prompt.length;
  const canSubmit = prompt.trim().length >= 3 && !isLoading;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Prompt textarea */}
      <div className="space-y-1">
        <label htmlFor="image-prompt" className="text-sm font-medium text-foreground">
          {t('promptLabel')}
        </label>
        <Textarea
          id="image-prompt"
          placeholder={t('promptPlaceholder')}
          value={prompt}
          onChange={(e) => {
            if (e.target.value.length <= MAX_PROMPT_CHARS) {
              onPromptChange(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          rows={4}
          className="resize-none"
          disabled={isLoading}
        />
        <p className={`text-xs text-right ${charsLeft < 100 ? 'text-warning' : 'text-muted-foreground'}`}>
          {charsLeft} {t('charsRemaining')}
        </p>
      </div>

      {/* Model selector */}
      <ImageModelSelector value={model} onChange={onModelChange} tier={tier} />

      {/* Aspect ratio */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">{t('aspectRatioLabel')}</label>
        <div className="flex gap-2 flex-wrap">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => onAspectRatioChange(ratio)}
              disabled={isLoading}
              className={[
                'px-3 py-1.5 text-sm rounded-md border transition-colors',
                aspectRatio === ratio
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
            {t('generating')}
          </>
        ) : (
          t('generateImage')
        )}
      </Button>
    </div>
  );
}

export type { AspectRatio };
