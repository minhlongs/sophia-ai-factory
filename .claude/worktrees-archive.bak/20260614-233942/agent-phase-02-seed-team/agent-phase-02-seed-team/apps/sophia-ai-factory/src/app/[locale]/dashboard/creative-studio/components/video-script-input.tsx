'use client';

import { useTranslations } from 'next-intl';

interface VideoScriptInputProps {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}

export function VideoScriptInput({ value, onChange, maxLength = 2000 }: VideoScriptInputProps) {
  const t = useTranslations('creativeStudio');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="video-script" className="text-sm font-medium">
        {t('video.scriptLabel')}
      </label>
      <textarea
        id="video-script"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        maxLength={maxLength}
        placeholder={t('video.scriptPlaceholder')}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <span className="text-xs text-muted-foreground text-right">
        {value.length}/{maxLength}
      </span>
    </div>
  );
}
