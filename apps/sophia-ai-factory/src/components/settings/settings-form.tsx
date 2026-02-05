'use client';

import { useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  userProfileFormSchema,
  UserProfileFormValues,
} from '@/lib/schemas/settings';
import { updateUserProfile } from '@/app/actions/settings';

interface SettingsFormProps {
  defaultValues: UserProfileFormValues;
}

export function SettingsForm({ defaultValues }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const form = useForm<UserProfileFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(userProfileFormSchema) as any, // Cast to any to resolve TS mismatch with zodResolver
    defaultValues,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  // Use watched values for switches
  const marketingEmail = watch('settings.notifications.email.marketing');
  const securityEmail = watch('settings.notifications.email.security');
  const telegramEnabled = watch('settings.notifications.telegram.enabled');

  const onSubmit = (data: UserProfileFormValues) => {
    startTransition(async () => {
      try {
        const result = await updateUserProfile(data);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success('Settings updated successfully');
        }
      } catch (error) {
        console.error(error);
        toast.error('Something went wrong. Please try again.');
      }
    });
  };

  const toggleKeyVisibility = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="grid gap-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Manage your public profile information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                {...register('fullName')}
                disabled={isPending}
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                {...register('email')}
                disabled={true}
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Email address is managed via your authentication provider and cannot be changed here.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Section */}
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
                    watch('settings.theme') === 'light'
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
                    watch('settings.theme') === 'dark'
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
                    watch('settings.theme') === 'system'
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

        {/* API Keys Section */}
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Securely store your API keys. They are encrypted at rest. Leave
              empty to keep existing keys unchanged.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai">OpenAI API Key</Label>
              <div className="relative">
                <Input
                  id="openai"
                  type={showKeys.openai ? 'text' : 'password'}
                  placeholder={
                    defaultValues.apiKeys.openai ? '********' : 'sk-...'
                  }
                  {...register('apiKeys.openai')}
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => toggleKeyVisibility('openai')}
                >
                  {showKeys.openai ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="anthropic">Anthropic API Key</Label>
              <div className="relative">
                <Input
                  id="anthropic"
                  type={showKeys.anthropic ? 'text' : 'password'}
                  placeholder={
                    defaultValues.apiKeys.anthropic ? '********' : 'sk-ant-...'
                  }
                  {...register('apiKeys.anthropic')}
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => toggleKeyVisibility('anthropic')}
                >
                  {showKeys.anthropic ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="elevenlabs">ElevenLabs API Key</Label>
              <div className="relative">
                <Input
                  id="elevenlabs"
                  type={showKeys.elevenlabs ? 'text' : 'password'}
                  placeholder={
                    defaultValues.apiKeys.elevenlabs ? '********' : 'xi-...'
                  }
                  {...register('apiKeys.elevenlabs')}
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => toggleKeyVisibility('elevenlabs')}
                >
                  {showKeys.elevenlabs ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
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
      </div>
    </form>
  );
}
