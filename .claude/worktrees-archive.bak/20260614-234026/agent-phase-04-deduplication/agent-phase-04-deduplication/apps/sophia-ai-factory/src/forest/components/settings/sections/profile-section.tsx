'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/seed/components/ui/input';
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

interface ProfileSectionProps {
  form: UseFormReturn<UserProfileFormValues>;
  isPending: boolean;
}

export function ProfileSection({ form, isPending }: ProfileSectionProps) {
  const t = useTranslations('settings.profile');
  const { register, formState: { errors } } = form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">{t('fullName')}</Label>
          <Input
            id="fullName"
            placeholder={t('fullNamePlaceholder')}
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
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            {...register('email')}
            disabled={true}
            className="bg-muted text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">{t('emailManagedNote')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
