'use client';

import { useTranslations } from 'next-intl';
import { Label } from '@/seed/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import { UseFormReturn } from 'react-hook-form';
import { UserProfileFormValues } from '@/lib/schemas/settings';

interface AppearanceSectionProps {
  form: UseFormReturn<UserProfileFormValues>;
}

export function AppearanceSection({ form }: AppearanceSectionProps) {
  const t = useTranslations('settings.appearance');
  const { watch, setValue } = form;
  const theme = watch('settings.theme');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label>{t('themeLabel')}</Label>
          <div className="grid grid-cols-3 gap-4" role="radiogroup" aria-label={t('themeAriaLabel')}>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              className={`cursor-pointer items-center justify-between rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground text-left w-full ${
                theme === 'light'
                  ? 'border-primary'
                  : 'border-muted'
              }`}
              onClick={() =>
                setValue('settings.theme', 'light', { shouldDirty: true })
              }
            >
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border border-primary bg-[#ffffff]" aria-hidden="true" />
                <span className="font-medium">{t('themeLight')}</span>
              </div>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              className={`cursor-pointer items-center justify-between rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground text-left w-full ${
                theme === 'dark'
                  ? 'border-primary'
                  : 'border-muted'
              }`}
              onClick={() =>
                setValue('settings.theme', 'dark', { shouldDirty: true })
              }
            >
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border border-primary bg-[#09090b]" aria-hidden="true" />
                <span className="font-medium">{t('themeDark')}</span>
              </div>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'system'}
              className={`cursor-pointer items-center justify-between rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground text-left w-full ${
                theme === 'system'
                  ? 'border-primary'
                  : 'border-muted'
              }`}
              onClick={() =>
                setValue('settings.theme', 'system', { shouldDirty: true })
              }
            >
              <div className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center rounded-full border border-primary bg-transparent" aria-hidden="true">
                  <span className="text-[10px] font-bold">A</span>
                </div>
                <span className="font-medium">{t('themeSystem')}</span>
              </div>
            </button>
          </div>
          <p className="text-sm text-muted-foreground">{t('themeHelp')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
