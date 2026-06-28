'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import {
  userProfileFormSchema,
  UserProfileFormValues,
} from '@/land/schemas/settings';
import { updateUserProfile } from '@/app/actions/settings';
import { ProfileSection } from './sections/profile-section';
import { AppearanceSection } from './sections/appearance-section';
import { ApiKeysSection } from './sections/api-keys-section';
import { NotificationsSection } from './sections/notifications-section';

interface SettingsFormProps {
  defaultValues: UserProfileFormValues;
}

export function SettingsForm({ defaultValues }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<UserProfileFormValues>({
    // Zod version mismatch between zodResolver's Zod type and ours requires the
    // two-step cast through `unknown` to land on react-hook-form's Resolver.
    resolver: zodResolver(userProfileFormSchema) as unknown as import('react-hook-form').Resolver<UserProfileFormValues>,
    defaultValues,
  });

  const { handleSubmit } = form;

  const onSubmit = (data: UserProfileFormValues) => {
    startTransition(async () => {
      try {
        const result = await updateUserProfile(data);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success('Settings updated successfully');
        }
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="grid gap-6">
        <ProfileSection form={form} isPending={isPending} />
        <AppearanceSection form={form} />
        <ApiKeysSection form={form} isPending={isPending} defaultValues={defaultValues} />
        <NotificationsSection form={form} isPending={isPending} />
      </div>
    </form>
  );
}
