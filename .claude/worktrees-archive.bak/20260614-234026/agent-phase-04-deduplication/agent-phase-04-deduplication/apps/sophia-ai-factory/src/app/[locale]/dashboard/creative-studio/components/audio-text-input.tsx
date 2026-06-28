'use client';

import { useTranslations } from 'next-intl';
import { Textarea } from '@/seed/components/ui/textarea';
import { Label } from '@/seed/components/ui/label';

interface AudioTextInputProps {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}

export function AudioTextInput({ value, onChange, maxLength = 5000 }: AudioTextInputProps) {
  const t = useTranslations('creativeStudio.audio');
  const remaining = maxLength - value.length;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="tts-text-input">{t('textLabel')}</Label>
      <Textarea
        id="tts-text-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={t('textPlaceholder')}
        className="min-h-[160px] resize-y"
        aria-describedby="tts-char-count"
      />
      <p
        id="tts-char-count"
        className={`text-xs text-right ${remaining < 200 ? 'text-amber-500' : 'text-muted-foreground'}`}
      >
        {value.length} / {maxLength}
      </p>
    </div>
  );
}
