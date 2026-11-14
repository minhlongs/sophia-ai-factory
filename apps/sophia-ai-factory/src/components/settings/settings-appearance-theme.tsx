'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/seed/utils/cn';

const THEME_MODES = [
  { id: 'light' as const, labelKey: 'themeLight' as const, icon: Sun },
  { id: 'dark' as const, labelKey: 'themeDark' as const, icon: Moon },
  { id: 'system' as const, labelKey: 'themeSystem' as const, icon: Monitor },
];

export function SettingsAppearanceThemeSection() {
  const t = useTranslations('settings.appearance');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentMode = mounted ? (theme ?? 'dark') : 'dark';
  const themeLabels = {
    light: t('themeLight'),
    dark: t('themeDark'),
    system: t('themeSystem'),
  } as const;

  return (
    <section
      data-testid="settings-appearance-theme"
      className="bg-card rounded-2xl p-6 shadow-sm border border-border space-y-4"
    >
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
          <Monitor className="w-5 h-5 text-primary" aria-hidden="true" />
          {t('title')}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label={t('themeAriaLabel')}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {THEME_MODES.map((option) => {
          const Icon = option.icon;
          const isSelected = currentMode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-testid={`settings-theme-${option.id}`}
              onClick={() => setTheme(option.id)}
              className={cn(
                'h-[50px] flex items-center justify-between px-4 rounded-xl transition-all text-left',
                isSelected
                  ? 'border-2 border-primary bg-primary/10'
                  : 'border border-border bg-background/60 hover:bg-muted',
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
                <span className="text-xs font-bold text-foreground">
                  {themeLabels[option.id]}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'w-4 h-4 rounded-full transition-all',
                  isSelected ? 'border-4 border-primary bg-card' : 'border-2 border-border',
                )}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
