'use client';

import { Input } from '@/components/ui/input';
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

interface ProfileSectionProps {
  form: UseFormReturn<UserProfileFormValues>;
  isPending: boolean;
}

export function ProfileSection({ form, isPending }: ProfileSectionProps) {
  const { register, formState: { errors } } = form;

  return (
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
  );
}
