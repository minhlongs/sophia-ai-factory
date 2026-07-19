'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Label } from '@/seed/components/ui/label';
import { Switch } from '@/seed/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import { Loader2 } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { UserProfileFormValues } from '@/land/schemas/settings';

interface NotificationsSectionProps {
  form: UseFormReturn<UserProfileFormValues>;
  isPending: boolean;
}

export function NotificationsSection({ form, isPending }: NotificationsSectionProps) {
  const t = useTranslations('settings.notifications');
  const { watch, setValue } = form;

  // Use watched values for switches
  const marketingEmail = watch('settings.notifications.email.marketing');
  const securityEmail = watch('settings.notifications.email.security');
  const telegramEnabled = watch('settings.notifications.telegram.enabled');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="notif-marketing" className="text-base">{t('marketingTitle')}</Label>
            <p className="text-sm text-muted-foreground">{t('marketingDesc')}</p>
          </div>
          <Switch
            id="notif-marketing"
            disabled={isPending}
            checked={marketingEmail}
            onCheckedChange={(checked) =>
              setValue('settings.notifications.email.marketing', checked, { shouldDirty: true })
            }
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="notif-security" className="text-base">{t('securityTitle')}</Label>
            <p className="text-sm text-muted-foreground">{t('securityDesc')}</p>
          </div>
          <Switch
            id="notif-security"
            disabled={isPending}
            checked={securityEmail}
            onCheckedChange={(checked) =>
              setValue('settings.notifications.email.security', checked, { shouldDirty: true })
            }
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="notif-telegram" className="text-base">{t('telegramTitle')}</Label>
            <p className="text-sm text-muted-foreground">{t('telegramDesc')}</p>
          </div>
          <Switch
            id="notif-telegram"
            disabled={isPending}
            checked={telegramEnabled}
            onCheckedChange={(checked) =>
              setValue('settings.notifications.telegram.enabled', checked, { shouldDirty: true })
            }
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
          {t('saveButton')}
        </Button>
      </CardFooter>
    </Card>
  );
}
