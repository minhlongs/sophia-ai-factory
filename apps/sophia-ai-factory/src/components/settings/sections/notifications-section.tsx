'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { UserProfileFormValues } from '@/lib/schemas/settings';

interface NotificationsSectionProps {
  form: UseFormReturn<UserProfileFormValues>;
  isPending: boolean;
}

export function NotificationsSection({ form, isPending }: NotificationsSectionProps) {
  const { watch, setValue } = form;

  // Use watched values for switches
  const marketingEmail = watch('settings.notifications.email.marketing');
  const securityEmail = watch('settings.notifications.email.security');
  const telegramEnabled = watch('settings.notifications.telegram.enabled');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Choose what updates you want to receive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Marketing Emails</Label>
            <p className="text-sm text-muted-foreground">
              Receive emails about new features and promotions.
            </p>
          </div>
          <Switch
            disabled={isPending}
            checked={marketingEmail}
            onCheckedChange={(checked) =>
              setValue('settings.notifications.email.marketing', checked, { shouldDirty: true })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Security Alerts</Label>
            <p className="text-sm text-muted-foreground">
              Get notified about suspicious activity on your account.
            </p>
          </div>
          <Switch
            disabled={isPending}
            checked={securityEmail}
            onCheckedChange={(checked) =>
              setValue('settings.notifications.email.security', checked, { shouldDirty: true })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Telegram Integration</Label>
            <p className="text-sm text-muted-foreground">
              Receive notifications via Telegram bot.
            </p>
          </div>
          <Switch
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
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </CardFooter>
    </Card>
  );
}
