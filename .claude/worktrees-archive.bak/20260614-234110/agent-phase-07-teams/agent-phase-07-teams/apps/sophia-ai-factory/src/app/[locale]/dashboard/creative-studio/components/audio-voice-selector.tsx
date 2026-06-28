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
import { Label } from '@/seed/components/ui/label';

interface VoiceOption {
  id: string;
  label: string;
  description: string;
  minTier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
}

const VOICES: VoiceOption[] = [
  { id: 'adam',    label: 'Adam',    description: 'Deep male voice',      minTier: 'BASIC' },
  { id: 'bella',   label: 'Bella',   description: 'Warm female voice',    minTier: 'PREMIUM' },
  { id: 'josh',    label: 'Josh',    description: 'Friendly male voice',  minTier: 'PREMIUM' },
  { id: 'rachel',  label: 'Rachel',  description: 'Clear female voice',   minTier: 'ENTERPRISE' },
  { id: 'antoni',  label: 'Antoni',  description: 'Smooth male voice',    minTier: 'ENTERPRISE' },
  { id: 'elli',    label: 'Elli',    description: 'Young female voice',   minTier: 'ENTERPRISE' },
];

const TIER_ORDER: Record<string, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
};

function isVoiceLocked(voiceMinTier: string, userTier: string): boolean {
  const voiceLevel = TIER_ORDER[voiceMinTier] ?? 0;
  const userLevel = TIER_ORDER[userTier] ?? 0;
  return userLevel < voiceLevel;
}

interface AudioVoiceSelectorProps {
  value: string;
  onChange: (id: string) => void;
  tier: string;
}

export function AudioVoiceSelector({ value, onChange, tier }: AudioVoiceSelectorProps) {
  const t = useTranslations('creativeStudio.audio');
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="tts-voice-select">{t('voiceLabel')}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="tts-voice-select">
          <SelectValue placeholder={t('voicePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {VOICES.map((voice) => {
            const locked = isVoiceLocked(voice.minTier, tier);
            return (
              <SelectItem
                key={voice.id}
                value={voice.id}
                disabled={locked}
                className="flex items-center gap-2"
              >
                <span className="flex items-center gap-2">
                  {locked && <Lock className="w-3 h-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  {voice.label} — {voice.description}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
