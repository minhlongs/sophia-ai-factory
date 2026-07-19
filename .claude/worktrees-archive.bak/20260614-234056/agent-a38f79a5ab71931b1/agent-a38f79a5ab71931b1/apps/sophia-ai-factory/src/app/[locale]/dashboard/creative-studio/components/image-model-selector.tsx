'use client';

import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/seed/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/seed/components/ui/tooltip';
import type { Tier } from '@/seed/types';

interface ModelMeta {
  id: string;
  label: string;
  description: string;
}

const ALL_MODELS: ModelMeta[] = [
  { id: 'flux-schnell', label: 'Flux Schnell (Fast)', description: 'Fastest, great for drafts' },
  { id: 'flux-dev', label: 'Flux Dev (Quality)', description: 'Balanced speed and quality' },
  { id: 'hidream', label: 'HiDream (Artistic)', description: 'Painterly, creative styles' },
  { id: 'flux-kontext', label: 'Flux Kontext (Precise)', description: 'High-fidelity, prompt-accurate' },
  { id: 'midjourney-v7', label: 'Midjourney v7 (Premium)', description: 'Best quality, slowest' },
];

/** Models unlocked per tier — must mirror image-generate-action.ts TIER_ALLOWED_MODELS */
const TIER_UNLOCKED: Record<Tier, string[]> = {
  BASIC: ['flux-schnell'],
  PREMIUM: ['flux-schnell', 'flux-dev', 'hidream'],
  ENTERPRISE: ['flux-schnell', 'flux-dev', 'hidream', 'flux-kontext', 'midjourney-v7'],
  MASTER: ['flux-schnell', 'flux-dev', 'hidream', 'flux-kontext', 'midjourney-v7'],
};

interface ImageModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  tier: Tier;
}

export function ImageModelSelector({ value, onChange, tier }: ImageModelSelectorProps) {
  const t = useTranslations('creativeStudio.image');
  const unlocked = TIER_UNLOCKED[tier] ?? TIER_UNLOCKED.BASIC;

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{t('modelLabel')}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('modelPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {ALL_MODELS.map((model) => {
            const isLocked = !unlocked.includes(model.id);
            if (isLocked) {
              return (
                <TooltipProvider key={model.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="flex items-center justify-between px-2 py-1.5 text-sm text-muted-foreground cursor-not-allowed rounded-sm"
                      aria-disabled="true"
                    >
                      <span className="flex items-center gap-2">
                        <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                        {model.label}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{t('upgradeToUnlock')} — {model.description}</p>
                  </TooltipContent>
                </Tooltip>
                </TooltipProvider>
              );
            }
            return (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col">
                  <span>{model.label}</span>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
