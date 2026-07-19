'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Tier } from '@/seed/types';

interface VoiceOption {
  id: string;
  name: string;
  requiredTier: Tier;
}

const TIER_RANK: Record<Tier, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
};

const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'adam', name: 'Adam', requiredTier: 'BASIC' },
  { id: 'bella', name: 'Bella', requiredTier: 'PREMIUM' },
  { id: 'josh', name: 'Josh', requiredTier: 'PREMIUM' },
  { id: 'rachel', name: 'Rachel', requiredTier: 'ENTERPRISE' },
  { id: 'antoni', name: 'Antoni', requiredTier: 'ENTERPRISE' },
  { id: 'elli', name: 'Elli', requiredTier: 'ENTERPRISE' },
];

interface VideoVoicePickerProps {
  value: string;
  onChange: (id: string) => void;
  tier: Tier;
}

export function VideoVoicePicker({ value, onChange, tier }: VideoVoicePickerProps) {
  const t = useTranslations('creativeStudio');
  const userRank = TIER_RANK[tier] ?? 0;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="voice-select" className="text-sm font-medium">
        {t('video.voiceLabel')}
      </label>
      <div className="flex flex-col gap-1">
        {VOICE_OPTIONS.map((voice) => {
          const locked = TIER_RANK[voice.requiredTier] > userRank;
          const isSelected = value === voice.id;
          return (
            <button
              key={voice.id}
              type="button"
              disabled={locked}
              onClick={() => !locked && onChange(voice.id)}
              className={[
                'flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors',
                locked
                  ? 'cursor-not-allowed border-border text-muted-foreground opacity-60'
                  : isSelected
                  ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                  : 'border-border hover:border-primary/50 text-foreground',
              ].join(' ')}
              aria-pressed={!locked && isSelected}
            >
              <span>{voice.name}</span>
              {locked && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  {voice.requiredTier}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
