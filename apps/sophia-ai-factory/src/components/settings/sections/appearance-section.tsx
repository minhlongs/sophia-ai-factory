'use client';

import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UseFormReturn } from 'react-hook-form';
import { UserProfileFormValues } from '@/lib/schemas/settings';

interface AppearanceSectionProps {
  form: UseFormReturn<UserProfileFormValues>;
}

export function AppearanceSection({ form }: AppearanceSectionProps) {
  const { watch, setValue } = form;
  const theme = watch('settings.theme');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize the look and feel of the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label>Theme Preference</Label>
          <div className="grid grid-cols-3 gap-4">
            <div
              className={`cursor-pointer items-center justify-between rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground ${
                theme === 'light'
                  ? 'border-primary'
                  : 'border-muted'
              }`}
              onClick={() =>
                setValue('settings.theme', 'light', { shouldDirty: true })
              }
            >
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border border-primary bg-[#ffffff]" />
                <span className="font-medium">Light</span>
              </div>
            </div>
            <div
              className={`cursor-pointer items-center justify-between rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground ${
                theme === 'dark'
                  ? 'border-primary'
                  : 'border-muted'
              }`}
              onClick={() =>
                setValue('settings.theme', 'dark', { shouldDirty: true })
              }
            >
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border border-primary bg-[#09090b]" />
                <span className="font-medium">Dark</span>
              </div>
            </div>
            <div
              className={`cursor-pointer items-center justify-between rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground ${
                theme === 'system'
                  ? 'border-primary'
                  : 'border-muted'
              }`}
              onClick={() =>
                setValue('settings.theme', 'system', { shouldDirty: true })
              }
            >
              <div className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center rounded-full border border-primary bg-transparent">
                  <span className="text-[10px] font-bold">A</span>
                </div>
                <span className="font-medium">System</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Select your preferred theme for the dashboard.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
