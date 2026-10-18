/**
 * CreatorSettingsForm — client component for editing creator profile settings.
 *
 * Pre-fills fields from existing profile data and uses updateCreatorProfile()
 * server action to save changes.
 *
 * @module app/creator/settings/settings-form
 */

'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { updateCreatorProfile } from '@/land/sop-marketplace';
import type { CreatorProfileView } from '@/land/sop-marketplace';
import {
  CreatorSettingsFields,
  type CreatorSettingsInitValues,
} from './settings-form-fields';

type FormState = (
  | { ok: true; value: { profileId: string } }
  | { ok: false; error: { code: string; message: string } }
) | null;

function initialState(profile: CreatorProfileView): CreatorSettingsInitValues {
  return {
    displayName: profile.displayName,
    bio: profile.bio ?? '',
    payoutMethod: profile.payoutMethod ?? '',
    payoutAddress: profile.payoutAddress ?? '',
  };
}

export default function CreatorSettingsForm({
  profile,
}: {
  profile: CreatorProfileView;
}) {
  const t = useTranslations('marketplace.creator');

  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      const displayName = formData.get('displayName') as string;
      const bio = (formData.get('bio') as string) || undefined;
      const payoutMethodRaw = formData.get('payoutMethod') as string;
      const payoutAddress = (formData.get('payoutAddress') as string) || undefined;

      const payoutMethod = payoutMethodRaw
        ? (payoutMethodRaw as 'nowpayments' | 'stripe_connect' | 'usdt')
        : undefined;

      return updateCreatorProfile({
        displayName: displayName || undefined,
        bio,
        payoutMethod,
        payoutAddress,
      });
    },
    null,
  );

  const init = initialState(profile);

  return (
    <form action={formAction} className="space-y-5">
      {state?.ok && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-400">
          {t('settingsSaved')}
        </div>
      )}
      {state?.ok === false && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {state.error.message}
        </div>
      )}

      <CreatorSettingsFields init={init} />

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ...
          </span>
        ) : (
          t('save')
        )}
      </button>
    </form>
  );
}
