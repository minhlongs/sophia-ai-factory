'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Label } from '@/seed/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import { UseFormReturn } from 'react-hook-form';
import { UserProfileFormValues } from '@/land/schemas/settings';

interface AppearanceSectionProps {
  form: UseFormReturn<UserProfileFormValues>;
}

export function AppearanceSection({ form }: AppearanceSectionProps) {
  const t = useTranslations('settings.appearance');
  const { theme: activeTheme, setTheme } = useTheme();
  const { watch, setValue } = form;
  const theme = watch('settings.theme');

  // Reconcile initial saved preference on first mount without clobbering an
  // explicit runtime selection already stored in `sophia-zen-theme`.
  const didInitRef = React.useRef(false);
  React.useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('sophia-zen-theme')
        : null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      if (theme !== stored) {
        setValue('settings.theme', stored, { shouldDirty: false });
      }
      return;
    }
    if (theme && activeTheme !== theme) {
      setTheme(theme);
    }
  }, [activeTheme, setTheme, setValue, theme]);

  const handleSelectTheme = (nextTheme: 'light' | 'dark' | 'system') => {
    setValue('settings.theme', nextTheme, { shouldDirty: true });
    setTheme(nextTheme);
  };

  return (
    <Card className="bg-card border-border dark:border-white/[0.08]">
      <CardHeader>
        <CardTitle className="text-foreground dark:text-white">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label className="text-foreground dark:text-white">{t('themeLabel')}</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" role="radiogroup" aria-label={t('themeAriaLabel')}>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              className={`cursor-pointer items-center justify-between rounded-md border-2 p-4 hover:bg-muted text-left w-full ${
                theme === 'light'
                  ? 'border-primary bg-primary/5'
                  : 'border-border dark:border-white/[0.08]'
              }`}
              onClick={() => handleSelectTheme('light')}
            >
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border border-primary bg-slate-100" aria-hidden="true" />
                <span className="font-medium text-foreground dark:text-white">{t('themeLight')}</span>
              </div>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              className={`cursor-pointer items-center justify-between rounded-md border-2 p-4 hover:bg-muted text-left w-full ${
                theme === 'dark'
                  ? 'border-primary bg-primary/5'
                  : 'border-border dark:border-white/[0.08]'
              }`}
              onClick={() => handleSelectTheme('dark')}
            >
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border border-primary bg-slate-950" aria-hidden="true" />
                <span className="font-medium text-foreground dark:text-white">{t('themeDark')}</span>
              </div>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'system'}
              className={`cursor-pointer items-center justify-between rounded-md border-2 p-4 hover:bg-muted text-left w-full ${
                theme === 'system'
                  ? 'border-primary bg-primary/5'
                  : 'border-border dark:border-white/[0.08]'
              }`}
              onClick={() => handleSelectTheme('system')}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center rounded-full border border-primary bg-transparent" aria-hidden="true">
                  <span className="text-[10px] font-bold">A</span>
                </div>
                <span className="font-medium text-foreground dark:text-white">{t('themeSystem')}</span>
              </div>
            </button>
          </div>
          <p className="text-sm text-muted-foreground">{t('themeHelp')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
