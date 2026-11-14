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

  // Reconcile initial saved DB preference into ZenThemeProvider on first mount
  // if no explicit runtime selection overrides it yet, while delegating cross-route
  // `'system'` persistence and OS `matchMedia` tracking to ZenThemeProvider.
  React.useEffect(() => {
    if (!theme) return;
    if (activeTheme !== theme) {
      setTheme(theme);
    }
    // Intentionally run once on mount so DB-backed form default aligns runtime theme
    // without overwriting subsequent topbar toggles while editing other fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
