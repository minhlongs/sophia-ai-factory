'use client';

import { useTranslations } from 'next-intl';

interface TemplateOption {
  id: string;
  nameKey: string;
  descriptionKey: string;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: 'path-a', nameKey: 'video.templateCinematicName', descriptionKey: 'video.templateCinematicDesc' },
  { id: 'path-b', nameKey: 'video.templateOverlayName', descriptionKey: 'video.templateOverlayDesc' },
];

interface VideoTemplateSelectorProps {
  value: string;
  onChange: (id: string) => void;
}

export function VideoTemplateSelector({ value, onChange }: VideoTemplateSelectorProps) {
  const t = useTranslations('creativeStudio');

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t('video.templateLabel')}</span>
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATE_OPTIONS.map((tpl) => {
          const isSelected = value === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onChange(tpl.id)}
              className={[
                'flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors',
                isSelected
                  ? 'border-primary ring-2 ring-primary ring-offset-1 bg-primary/5'
                  : 'border-border hover:border-primary/50',
              ].join(' ')}
              aria-pressed={isSelected}
            >
              <span className="text-sm font-medium">{t(tpl.nameKey as Parameters<typeof t>[0])}</span>
              <span className="text-xs text-muted-foreground">
                {t(tpl.descriptionKey as Parameters<typeof t>[0])}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
